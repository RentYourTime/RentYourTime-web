import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { sha256 } from "@/lib/auth";

/**
 * Refresh-token session store for /api/v1 (§7/§8 of the brief). Kept
 * deliberately separate from the legacy `tokens` table — see
 * docs/AUTH_MIGRATION.md. One row per issued refresh token; rotating
 * creates a new row and marks the old one `revoked_at` +
 * `replaced_by_session_id` rather than mutating it in place, so the full
 * chain is inspectable for reuse detection and support/audit purposes.
 */

export interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  token_family_id: string;
  platform: string;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by_session_id: string | null;
}

function refreshTokenTtlDays(): number {
  const raw = process.env.REFRESH_TOKEN_TTL_DAYS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export interface CreateSessionParams {
  userId: string;
  platform: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** Omit to start a new family (fresh login); pass the current family when rotating. */
  tokenFamilyId?: string;
}

export interface IssuedSession {
  session: SessionRow;
  refreshToken: string;
}

function generateSession(params: CreateSessionParams): IssuedSession {
  const db = getDb();
  const id = randomBytes(16).toString("hex");
  const refreshToken = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + refreshTokenTtlDays() * 86_400_000).toISOString();
  const familyId = params.tokenFamilyId ?? randomBytes(12).toString("hex");

  db.prepare(
    `INSERT INTO sessions
       (id, user_id, refresh_token_hash, token_family_id, platform, device_id, ip_address, user_agent, created_at, last_used_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.userId,
    sha256(refreshToken),
    familyId,
    params.platform,
    params.deviceId,
    params.ipAddress,
    params.userAgent,
    now.toISOString(),
    now.toISOString(),
    expiresAt
  );

  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow;
  return { session, refreshToken };
}

export function createSession(params: CreateSessionParams): IssuedSession {
  return generateSession(params);
}

export function getSessionById(id: string): SessionRow | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
  return row ?? null;
}

export function getSessionByRefreshToken(rawToken: string): SessionRow | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE refresh_token_hash = ?").get(sha256(rawToken)) as
    | SessionRow
    | undefined;
  return row ?? null;
}

export function isSessionActive(session: SessionRow): boolean {
  if (session.revoked_at) return false;
  return session.expires_at > new Date().toISOString();
}

/** One-time link: only takes effect while the session has no device yet, so a later call can't silently reassign an already-bound session. */
export function bindSessionDevice(sessionId: string, deviceId: string): void {
  getDb().prepare("UPDATE sessions SET device_id = ? WHERE id = ? AND device_id IS NULL").run(deviceId, sessionId);
}

export function touchSession(id: string): void {
  getDb().prepare("UPDATE sessions SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function revokeSession(id: string): void {
  getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), id);
}

/** Revokes every session sharing this token family — the reuse-detection response. */
export function revokeFamily(tokenFamilyId: string): void {
  getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE token_family_id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), tokenFamilyId);
}

export function revokeAllSessionsForUser(userId: string): number {
  return getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), userId).changes;
}

export function revokeOtherSessions(userId: string, keepSessionId: string): number {
  return getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), userId, keepSessionId).changes;
}

export function revokeSessionsForDevice(deviceId: string): number {
  return getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), deviceId).changes;
}

export function listActiveSessionsForUser(userId: string): SessionRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_used_at DESC"
    )
    .all(userId, new Date().toISOString()) as SessionRow[];
}

export type RotateResult =
  | { outcome: "rotated"; issued: IssuedSession; previous: SessionRow }
  | { outcome: "reuse_detected"; userId: string; tokenFamilyId: string }
  | { outcome: "invalid" };

/**
 * Rotates a refresh token. The presented raw token must hash to a session
 * row; that session is then revoked (`replaced_by_session_id` set) and a
 * new session in the same token family is created.
 *
 * Reuse detection: a hash that matches an *already-revoked* session means
 * this exact refresh token was already rotated away once — a strong signal
 * of token theft/replay. The entire family is revoked so every device in
 * that lineage is forced back through a full login.
 */
export function rotateSession(rawRefreshToken: string): RotateResult {
  const db = getDb();
  const hash = sha256(rawRefreshToken);
  const existing = db.prepare("SELECT * FROM sessions WHERE refresh_token_hash = ?").get(hash) as
    | SessionRow
    | undefined;

  if (!existing) return { outcome: "invalid" };

  if (existing.revoked_at) {
    revokeFamily(existing.token_family_id);
    return { outcome: "reuse_detected", userId: existing.user_id, tokenFamilyId: existing.token_family_id };
  }

  if (existing.expires_at <= new Date().toISOString()) {
    revokeSession(existing.id);
    return { outcome: "invalid" };
  }

  const issued = generateSession({
    userId: existing.user_id,
    platform: existing.platform,
    deviceId: existing.device_id,
    ipAddress: existing.ip_address,
    userAgent: existing.user_agent,
    tokenFamilyId: existing.token_family_id,
  });

  const now = new Date().toISOString();
  db.prepare("UPDATE sessions SET revoked_at = ?, replaced_by_session_id = ? WHERE id = ?").run(
    now,
    issued.session.id,
    existing.id
  );

  return { outcome: "rotated", issued, previous: existing };
}
