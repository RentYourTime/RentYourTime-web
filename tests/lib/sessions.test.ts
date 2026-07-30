import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  createSession,
  getSessionById,
  isSessionActive,
  revokeAllSessionsForUser,
  revokeOtherSessions,
  revokeSession,
  rotateSession,
} from "@/server/auth/sessions";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(
      `INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', ?)`
    )
    .run(id, `${id}@example.com`, new Date().toISOString());
  return id;
}

describe("sessions", () => {
  it("creates an active session with a fresh token family", () => {
    const userId = makeUser();
    const { session, refreshToken } = createSession({
      userId,
      platform: "IOS",
      deviceId: null,
      ipAddress: "10.0.0.1",
      userAgent: "test",
    });
    expect(refreshToken).toHaveLength(64);
    expect(isSessionActive(session)).toBe(true);
    expect(session.token_family_id).toBeTruthy();
  });

  it("rotates a valid refresh token into a new session in the same family", () => {
    const userId = makeUser();
    const { session, refreshToken } = createSession({
      userId,
      platform: "WEB",
      deviceId: null,
      ipAddress: null,
      userAgent: null,
    });

    const result = rotateSession(refreshToken);
    expect(result.outcome).toBe("rotated");
    if (result.outcome !== "rotated") throw new Error("unreachable");

    expect(result.issued.session.token_family_id).toBe(session.token_family_id);
    expect(result.issued.session.id).not.toBe(session.id);

    // the old session is now revoked and points at its replacement
    const oldSession = getSessionById(session.id);
    expect(oldSession?.revoked_at).toBeTruthy();
    expect(oldSession?.replaced_by_session_id).toBe(result.issued.session.id);
  });

  it("detects reuse of an already-rotated refresh token and revokes the whole family", () => {
    const userId = makeUser();
    const { refreshToken: r1 } = createSession({
      userId,
      platform: "IOS",
      deviceId: null,
      ipAddress: null,
      userAgent: null,
    });

    const first = rotateSession(r1);
    expect(first.outcome).toBe("rotated");
    if (first.outcome !== "rotated") throw new Error("unreachable");
    const r2Session = first.issued.session;

    // Attacker (or a buggy retry) replays the original refresh token.
    const reuse = rotateSession(r1);
    expect(reuse.outcome).toBe("reuse_detected");

    // The legitimately-rotated session (r2) must now be revoked too — the whole family.
    const r2After = getSessionById(r2Session.id);
    expect(r2After?.revoked_at).toBeTruthy();
  });

  it("rejects rotation of an unknown token", () => {
    const result = rotateSession("0".repeat(64));
    expect(result.outcome).toBe("invalid");
  });

  it("revokeAllSessionsForUser revokes every active session and none of another user's", () => {
    const userA = makeUser();
    const userB = makeUser();
    const a1 = createSession({ userId: userA, platform: "IOS", deviceId: null, ipAddress: null, userAgent: null });
    const a2 = createSession({ userId: userA, platform: "WEB", deviceId: null, ipAddress: null, userAgent: null });
    const b1 = createSession({ userId: userB, platform: "IOS", deviceId: null, ipAddress: null, userAgent: null });

    const count = revokeAllSessionsForUser(userA);
    expect(count).toBe(2);
    expect(getSessionById(a1.session.id)?.revoked_at).toBeTruthy();
    expect(getSessionById(a2.session.id)?.revoked_at).toBeTruthy();
    expect(getSessionById(b1.session.id)?.revoked_at).toBeFalsy();
  });

  it("revokeOtherSessions keeps the specified session active", () => {
    const userId = makeUser();
    const keep = createSession({ userId, platform: "IOS", deviceId: null, ipAddress: null, userAgent: null });
    const other = createSession({ userId, platform: "WEB", deviceId: null, ipAddress: null, userAgent: null });

    revokeOtherSessions(userId, keep.session.id);
    expect(getSessionById(keep.session.id)?.revoked_at).toBeFalsy();
    expect(getSessionById(other.session.id)?.revoked_at).toBeTruthy();
  });

  it("revokeSession is idempotent", () => {
    const userId = makeUser();
    const { session } = createSession({ userId, platform: "IOS", deviceId: null, ipAddress: null, userAgent: null });
    revokeSession(session.id);
    expect(() => revokeSession(session.id)).not.toThrow();
    expect(getSessionById(session.id)?.revoked_at).toBeTruthy();
  });
});
