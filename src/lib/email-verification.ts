import { randomBytes } from "node:crypto";
import { sha256 } from "./auth";
import { getDb } from "./db";
import { envRequired } from "./stripe";

/**
 * Email verification tokens. Same technique as Bearer tokens in auth.ts
 * (random 256-bit value, only its SHA-256 hash stored) — a separate table
 * because these are single-use and short-lived, unlike session tokens.
 */

export const VERIFICATION_TOKEN_HOURS = 24;
const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

export type VerifyEmailResult =
  | { ok: true }
  | { ok: false; reason: "invalid_or_expired" }
  | { ok: false; reason: "already_verified" };

interface TokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

/** Marks every still-valid (unused) token for a user as used — the schema has no separate "revoked" state. */
export function invalidateExistingVerificationTokens(userId: string): void {
  getDb()
    .prepare(
      "UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL"
    )
    .run(new Date().toISOString(), userId);
}

export function cleanupExpiredVerificationTokens(): void {
  getDb()
    .prepare("DELETE FROM email_verification_tokens WHERE expires_at <= ?")
    .run(new Date().toISOString());
}

/** Invalidates any prior tokens, then issues a fresh one. Returns the raw token — never store this, only its hash. */
export function createEmailVerificationToken(userId: string): {
  token: string;
  expiresAt: string;
} {
  invalidateExistingVerificationTokens(userId);

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_HOURS * 3600 * 1000).toISOString();

  getDb()
    .prepare(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(randomBytes(16).toString("hex"), userId, sha256(token), expiresAt, now.toISOString());

  // Opportunistic cleanup, same ~1% pattern as db.ts's token/rate-limit purge.
  if (Math.floor(Math.random() * 100) === 0) cleanupExpiredVerificationTokens();

  return { token, expiresAt };
}

export function buildVerificationUrl(rawToken: string): string {
  const base = envRequired("APP_URL").replace(/\/+$/, "");
  return `${base}/verify?token=${rawToken}`;
}

/**
 * Verifies a raw token and, on success, sets users.email_verified = 1 — all
 * inside one transaction, so a token is never consumed without the flag
 * actually being set. Never reveals whether a malformed/unknown/expired/
 * already-used token existed — all of those collapse to the same
 * "invalid_or_expired" result.
 */
export function verifyEmailToken(rawToken: string): VerifyEmailResult {
  if (!TOKEN_FORMAT.test(rawToken)) return { ok: false, reason: "invalid_or_expired" };

  const db = getDb();
  const tokenHash = sha256(rawToken);

  return db.transaction((): VerifyEmailResult => {
    const row = db
      .prepare("SELECT * FROM email_verification_tokens WHERE token_hash = ?")
      .get(tokenHash) as TokenRow | undefined;

    if (!row || row.used_at || row.expires_at <= new Date().toISOString()) {
      return { ok: false, reason: "invalid_or_expired" };
    }

    const user = db.prepare("SELECT email_verified FROM users WHERE id = ?").get(row.user_id) as
      | { email_verified: number }
      | undefined;
    if (!user) return { ok: false, reason: "invalid_or_expired" };

    const now = new Date().toISOString();

    if (user.email_verified) {
      db.prepare("UPDATE email_verification_tokens SET used_at = ? WHERE id = ?").run(now, row.id);
      return { ok: false, reason: "already_verified" };
    }

    db.prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?").run(
      now,
      row.user_id
    );
    db.prepare("UPDATE email_verification_tokens SET used_at = ? WHERE id = ?").run(now, row.id);
    invalidateExistingVerificationTokens(row.user_id);

    return { ok: true };
  })();
}
