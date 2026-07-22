import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { getDb } from "@/lib/db";
import {
  cleanupExpiredVerificationTokens,
  createEmailVerificationToken,
  invalidateExistingVerificationTokens,
  verifyEmailToken,
} from "@/lib/email-verification";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', datetime('now'))"
    )
    .run(id, `${id}@example.com`);
  return id;
}

describe("email-verification", () => {
  it("stores only the token hash — the raw token never appears in the database", () => {
    const userId = makeUser();
    const { token } = createEmailVerificationToken(userId);

    const rows = getDb()
      .prepare("SELECT token_hash FROM email_verification_tokens WHERE user_id = ?")
      .all(userId) as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("verifies a valid token and sets email_verified", () => {
    const userId = makeUser();
    const { token } = createEmailVerificationToken(userId);

    expect(verifyEmailToken(token)).toEqual({ ok: true });

    const user = getDb().prepare("SELECT email_verified FROM users WHERE id = ?").get(userId) as {
      email_verified: number;
    };
    expect(user.email_verified).toBe(1);
  });

  it("a token can only be used once", () => {
    const userId = makeUser();
    const { token } = createEmailVerificationToken(userId);

    expect(verifyEmailToken(token)).toEqual({ ok: true });
    expect(verifyEmailToken(token)).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("rejects an expired token", () => {
    const userId = makeUser();
    const { token } = createEmailVerificationToken(userId);
    getDb()
      .prepare("UPDATE email_verification_tokens SET expires_at = ? WHERE user_id = ?")
      .run("2000-01-01T00:00:00.000Z", userId);

    expect(verifyEmailToken(token)).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("rejects a malformed or unknown token without touching data", () => {
    expect(verifyEmailToken("not-a-valid-token")).toEqual({
      ok: false,
      reason: "invalid_or_expired",
    });
    expect(verifyEmailToken("a".repeat(63))).toEqual({ ok: false, reason: "invalid_or_expired" });
    expect(verifyEmailToken("f".repeat(64))).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("invalidateExistingVerificationTokens makes prior tokens unusable", () => {
    const userId = makeUser();
    const { token } = createEmailVerificationToken(userId);
    invalidateExistingVerificationTokens(userId);

    expect(verifyEmailToken(token)).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("creating a new token invalidates the previous one", () => {
    const userId = makeUser();
    const { token: first } = createEmailVerificationToken(userId);
    const { token: second } = createEmailVerificationToken(userId);

    expect(verifyEmailToken(first)).toEqual({ ok: false, reason: "invalid_or_expired" });
    expect(verifyEmailToken(second)).toEqual({ ok: true });
  });

  it("returns already_verified for a fresh token issued after the account was verified", () => {
    const userId = makeUser();
    const { token: first } = createEmailVerificationToken(userId);
    expect(verifyEmailToken(first)).toEqual({ ok: true });

    // Simulates a resend that raced with/followed a successful verification.
    const { token: second } = createEmailVerificationToken(userId);
    expect(verifyEmailToken(second)).toEqual({ ok: false, reason: "already_verified" });
  });

  it("cleanupExpiredVerificationTokens removes expired rows", () => {
    const userId = makeUser();
    createEmailVerificationToken(userId);
    getDb()
      .prepare("UPDATE email_verification_tokens SET expires_at = ? WHERE user_id = ?")
      .run("2000-01-01T00:00:00.000Z", userId);

    cleanupExpiredVerificationTokens();

    const rows = getDb()
      .prepare("SELECT * FROM email_verification_tokens WHERE user_id = ?")
      .all(userId);
    expect(rows).toHaveLength(0);
  });
});
