import { randomBytes } from "node:crypto";
import { sha256, type UserRow } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { envRequired } from "@/lib/stripe";
import { hashPassword, passwordPolicyError } from "@/lib/password";
import { validationError } from "@/lib/http/errors";
import { recordAudit } from "@/server/audit";
import { revokeAllSessionsForUser } from "./sessions";

/**
 * "Forgot password" — the one auth capability the legacy system never had
 * (docs/AUTH.md lists it explicitly as a known gap). Same technique as
 * `email-verification.ts`: a random 256-bit token, only its SHA-256 hash
 * stored, single-use, short TTL (1h — shorter than email verification's 24h,
 * since this token grants an account takeover if leaked).
 */

const RESET_TOKEN_HOURS = 1;
const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

interface ResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export function invalidateExistingResetTokens(userId: string): void {
  getDb()
    .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL")
    .run(new Date().toISOString(), userId);
}

/**
 * Always succeeds from the caller's perspective — returns null when the
 * email doesn't match an account so the route can still send the same
 * generic "check your email" response either way (no account-existence
 * leak, mirroring the login/register error philosophy).
 */
export function createPasswordResetToken(email: string): { user: UserRow; token: string } | null {
  const normalized = email.trim().toLowerCase();
  const user = getDb().prepare("SELECT * FROM users WHERE email = ? AND is_active = 1").get(normalized) as
    | UserRow
    | undefined;
  if (!user) return null;

  invalidateExistingResetTokens(user.id);

  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_HOURS * 3600 * 1000).toISOString();

  getDb()
    .prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(randomBytes(16).toString("hex"), user.id, sha256(token), expiresAt, now.toISOString());

  recordAudit({ userId: user.id, action: "auth.password_reset_requested" });
  return { user, token };
}

export function buildPasswordResetUrl(rawToken: string): string {
  const base = envRequired("APP_URL").replace(/\/+$/, "");
  return `${base}/reset-password?token=${rawToken}`;
}

/**
 * Verifies a raw token and, on success, sets a new password — inside one
 * transaction, and revokes every existing session/legacy token family for
 * the account (a password reset is a strong signal the old credential may
 * have been compromised). Never reveals whether a malformed/unknown/
 * expired/already-used token existed.
 */
export function resetPassword(rawToken: string, newPassword: string): void {
  if (!TOKEN_FORMAT.test(rawToken)) throw validationError({ token: "Nieprawidłowy lub wygasły token." });

  const passwordError = passwordPolicyError(newPassword);
  if (passwordError) {
    throw validationError({ password: "Hasło musi mieć 10-200 znaków oraz małą i wielką literę i cyfrę." });
  }

  const db = getDb();
  const tokenHash = sha256(rawToken);

  const userId = db.transaction((): string => {
    const row = db.prepare("SELECT * FROM password_reset_tokens WHERE token_hash = ?").get(tokenHash) as
      | ResetTokenRow
      | undefined;

    if (!row || row.used_at || row.expires_at <= new Date().toISOString()) {
      throw validationError({ token: "Nieprawidłowy lub wygasły token." });
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      hashPassword(newPassword),
      now,
      row.user_id
    );
    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").run(now, row.id);
    invalidateExistingResetTokens(row.user_id);

    return row.user_id;
  })();

  // Legacy `tokens` (used by /api/login-issued sessions) revoked too — a
  // reset must not leave a pre-reset bearer token usable.
  db.prepare("DELETE FROM tokens WHERE user_id = ?").run(userId);
  revokeAllSessionsForUser(userId);
  recordAudit({ userId, action: "auth.password_reset_completed" });
}
