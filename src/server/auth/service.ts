import { randomBytes } from "node:crypto";
import { bearerToken, type UserRow } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hashPassword, needsRehash, passwordPolicyError, verifyPassword } from "@/lib/password";
import { ApiError, validationError } from "@/lib/http/errors";
import { recordAudit } from "@/server/audit";
import type { Platform } from "@/server/validation";
import {
  createSession,
  getSessionById,
  getSessionByRefreshToken,
  isSessionActive,
  revokeAllSessionsForUser,
  revokeOtherSessions,
  revokeSession,
  rotateSession,
  touchSession,
  type SessionRow,
} from "./sessions";
import { issueAccessToken, verifyAccessToken, type AccessTokenClaims } from "./tokens";

/**
 * Orchestration layer behind /api/v1/auth/*. Reuses the exact same
 * primitives the legacy `/api/register` and `/api/login` routes use
 * (`@/lib/password`'s hashing/policy, the `users` table shape) so account
 * creation/credential rules can never drift between the two token systems —
 * only the *session* model (this file's `sessions.ts`) differs, which is
 * the whole point of the migration window (docs/AUTH_MIGRATION.md).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME_LENGTH = 80;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  role: string;
}

export function serializeAuthUser(user: UserRow): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    emailVerified: !!user.email_verified,
    role: user.role,
  };
}

export interface RegisterParams {
  email: string;
  password: string;
  displayName?: string | null;
}

export function registerAccount(params: RegisterParams): { user: UserRow } {
  const email = params.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw validationError({ email: "Nieprawidłowy adres e-mail." });
  }
  const passwordError = passwordPolicyError(params.password);
  if (passwordError) {
    throw validationError({ password: "Hasło musi mieć 10-200 znaków oraz małą i wielką literę i cyfrę." });
  }
  let displayName: string | null = null;
  if (params.displayName !== undefined && params.displayName !== null) {
    const trimmed = params.displayName.trim();
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      throw validationError({ displayName: "Nazwa wyświetlana jest za długa." });
    }
    displayName = trimmed || null;
  }

  const id = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, display_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, email, hashPassword(params.password), now, displayName, now);
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint/i.test(e.message)) throw new ApiError("EMAIL_TAKEN");
    throw e;
  }

  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
  return { user };
}

/** Same generic-failure philosophy as the legacy login route: unknown email, wrong password, and a deactivated account all collapse to one `INVALID_CREDENTIALS` after a constant-ish delay. */
export async function authenticateCredentials(email: string, password: string): Promise<UserRow> {
  const normalized = email.trim().toLowerCase();
  const user = getDb().prepare("SELECT * FROM users WHERE email = ?").get(normalized) as UserRow | undefined;

  if (!user || !verifyPassword(password, user.password_hash) || !user.is_active) {
    await sleep(250);
    throw new ApiError("INVALID_CREDENTIALS");
  }

  if (needsRehash(user.password_hash)) {
    getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), user.id);
  }

  const now = new Date().toISOString();
  getDb().prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(now, now, user.id);
  return user;
}

export interface SessionTokens {
  user: UserRow;
  session: SessionRow;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface IssueSessionParams {
  platform: Platform;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Shared by `login()` and `POST /api/v1/auth/register` (registering also logs the caller in — same contract as the legacy `/api/register`, which returns a usable token immediately). */
export function issueSessionTokens(user: UserRow, params: IssueSessionParams): SessionTokens {
  const { session, refreshToken } = createSession({
    userId: user.id,
    platform: params.platform,
    deviceId: params.deviceId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
  const { token: accessToken, expiresAt } = issueAccessToken({
    userId: user.id,
    sessionId: session.id,
    role: user.role,
  });
  return { user, session, accessToken, refreshToken, accessTokenExpiresAt: expiresAt };
}

export interface LoginParams {
  email: string;
  password: string;
  platform: Platform;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export async function login(params: LoginParams): Promise<SessionTokens> {
  const user = await authenticateCredentials(params.email, params.password);
  const tokens = issueSessionTokens(user, params);

  recordAudit({
    userId: user.id,
    action: "auth.login",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: { platform: params.platform },
  });

  return tokens;
}

export interface RefreshContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Rotates a refresh token. Throws `TOKEN_REUSE_DETECTED` (after revoking
 * the whole token family and writing an AuditLog entry) if the presented
 * token had already been rotated away once before — see
 * `rotateSession()` in `./sessions` for the detection logic itself.
 */
export function refreshSession(rawRefreshToken: string, ctx: RefreshContext): SessionTokens {
  const result = rotateSession(rawRefreshToken);

  if (result.outcome === "invalid") throw new ApiError("TOKEN_INVALID");

  if (result.outcome === "reuse_detected") {
    recordAudit({
      userId: result.userId,
      action: "auth.refresh_reuse_detected",
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { tokenFamilyId: result.tokenFamilyId },
    });
    throw new ApiError("TOKEN_REUSE_DETECTED");
  }

  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(result.issued.session.user_id) as
    | UserRow
    | undefined;
  if (!user || !user.is_active) {
    revokeSession(result.issued.session.id);
    throw new ApiError("TOKEN_INVALID");
  }

  const { token: accessToken, expiresAt } = issueAccessToken({
    userId: user.id,
    sessionId: result.issued.session.id,
    role: user.role,
  });

  return {
    user,
    session: result.issued.session,
    accessToken,
    refreshToken: result.issued.refreshToken,
    accessTokenExpiresAt: expiresAt,
  };
}

/** Idempotent: revoking an unknown/already-revoked refresh token is a no-op, same contract as the legacy `POST /api/logout`. */
export function logout(rawRefreshToken: string): void {
  const session = getSessionByRefreshToken(rawRefreshToken);
  if (session) revokeSession(session.id);
}

export function logoutAll(userId: string): number {
  const count = revokeAllSessionsForUser(userId);
  recordAudit({ userId, action: "auth.logout_all", metadata: { revokedSessions: count } });
  return count;
}

export function logoutOthers(userId: string, keepSessionId: string): number {
  const count = revokeOtherSessions(userId, keepSessionId);
  recordAudit({ userId, action: "auth.logout_others", metadata: { revokedSessions: count } });
  return count;
}

export async function changePassword(
  user: UserRow,
  currentPassword: string,
  newPassword: string,
  keepSessionId: string | null
): Promise<void> {
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw validationError({ currentPassword: "Nieprawidłowe obecne hasło." });
  }
  const passwordError = passwordPolicyError(newPassword);
  if (passwordError) {
    throw validationError({ newPassword: "Hasło musi mieć 10-200 znaków oraz małą i wielką literę i cyfrę." });
  }

  const now = new Date().toISOString();
  getDb().prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
    hashPassword(newPassword),
    now,
    user.id
  );

  const revoked = keepSessionId ? revokeOtherSessions(user.id, keepSessionId) : revokeAllSessionsForUser(user.id);
  recordAudit({ userId: user.id, action: "auth.change_password", metadata: { revokedSessions: revoked } });
}

export interface SessionDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export function serializeSessionTokens(tokens: SessionTokens): SessionDto {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  };
}

export interface AuthContext {
  user: UserRow;
  session: SessionRow;
  claims: AccessTokenClaims;
}

/**
 * Resolves the caller from a v1 Bearer access token: verifies the JWT
 * signature/issuer/audience/expiry, then confirms the session it names is
 * still active (not revoked/expired) and the account is still active.
 * `role` for authorization decisions is always re-read from `users` here,
 * never trusted from the token claim, even though the claim is present for
 * client convenience (§7's claim list).
 */
export function requireAuth(req: Request): AuthContext {
  const token = bearerToken(req);
  if (!token) throw new ApiError("UNAUTHORIZED");

  const verified = verifyAccessToken(token);
  if (!verified.ok) throw new ApiError(verified.reason === "expired" ? "TOKEN_EXPIRED" : "TOKEN_INVALID");

  const session = getSessionById(verified.claims.sessionId);
  if (!session || !isSessionActive(session) || session.user_id !== verified.claims.sub) {
    throw new ApiError("TOKEN_INVALID");
  }

  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) as UserRow | undefined;
  if (!user || !user.is_active) throw new ApiError("TOKEN_INVALID");

  touchSession(session.id);
  return { user, session, claims: verified.claims };
}

export function requireAdmin(ctx: AuthContext): void {
  if (ctx.user.role !== "ADMIN") throw new ApiError("FORBIDDEN");
}
