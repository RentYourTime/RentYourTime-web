import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import { subscriptionGrantsPro, type SubscriptionRow } from "./subscriptions";

export const API_TOKEN_DAYS = 30;
export const MAX_JSON_BODY_BYTES = 16 * 1024;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  stripe_customer_id: string | null;
  created_at: string;
  display_name: string | null;
  email_verified: number;
  is_active: number;
  /** 'USER' (default) | 'ADMIN' (platform admin) | 'ADMIN_TEAMS' (team admin) */
  role: string;
  last_login_at: string | null;
  updated_at: string | null;
  apple_original_transaction_id: string | null;
  apple_account_token: string | null;
  accrued_rent_cents: number | null;
  accrued_rent_currency: string;
}

export type { SubscriptionRow };

/** JSON response with the no-store / nosniff headers the API guarantees. */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function jsonError(error: string, status: number): NextResponse {
  return json({ ok: false, error }, status);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Per-IP (or, with `keyOverride`, per-arbitrary-key — e.g. per-user)
 * rate limiter. Returns a 429 response when the caller has exhausted its
 * budget, or null when the request may proceed.
 */
export function rateLimit(
  req: Request,
  action: string,
  maxAttempts: number,
  windowSeconds: number,
  keyOverride?: string
): NextResponse | null {
  const bucket = sha256(`${action}:${keyOverride ?? clientIp(req)}`);
  const now = Math.floor(Date.now() / 1000);
  const db = getDb();

  const row = db
    .prepare("SELECT attempts, resets_at FROM rate_limits WHERE bucket = ?")
    .get(bucket) as { attempts: number; resets_at: number } | undefined;

  if (!row || row.resets_at <= now) {
    db.prepare(
      `INSERT INTO rate_limits (bucket, attempts, resets_at) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET attempts = 1, resets_at = excluded.resets_at`
    ).run(bucket, now + windowSeconds);
    return null;
  }

  if (row.attempts >= maxAttempts) {
    const retry = Math.max(1, row.resets_at - now);
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retry), "Cache-Control": "no-store" } }
    );
  }

  db.prepare("UPDATE rate_limits SET attempts = attempts + 1 WHERE bucket = ?").run(bucket);
  return null;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

/**
 * Reads and parses a JSON request body, enforcing Content-Type and a size
 * cap so a caller can't send an oversized or mistyped payload. Returns
 * either the parsed body or a ready-to-return error response.
 */
export async function readJsonBody<T>(
  req: Request,
  maxBytes = MAX_JSON_BODY_BYTES
): Promise<{ body: T } | { error: NextResponse }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { error: jsonError("unsupported_content_type", 415) };
  }

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { error: jsonError("payload_too_large", 413) };
  }

  try {
    return { body: (text ? JSON.parse(text) : {}) as T };
  } catch {
    return { error: jsonError("invalid_json", 400) };
  }
}

export function issueToken(userId: string): { token: string; expires_at: string } {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + API_TOKEN_DAYS * 86400 * 1000).toISOString();
  getDb()
    .prepare("INSERT INTO tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), userId, expires, new Date().toISOString());
  return { token, expires_at: expires };
}

/**
 * Resolve the authenticated user from the Bearer token, or null. Deactivated
 * accounts (`is_active = 0`) are rejected here too, not just at login, so a
 * deactivation takes effect immediately for any already-issued token.
 */
export function currentUser(req: Request): UserRow | null {
  const token = bearerToken(req);
  if (!token) return null;
  const user = getDb()
    .prepare(
      `SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.expires_at > ? AND u.is_active = 1`
    )
    .get(sha256(token), new Date().toISOString()) as UserRow | undefined;
  return user ?? null;
}

export function revokeToken(token: string): void {
  getDb().prepare("DELETE FROM tokens WHERE token_hash = ?").run(sha256(token));
}

/**
 * Gate for admin-only routes: 401 with no token, 403 for anyone whose role
 * isn't `ADMIN`. `role` is only ever read from the `users` row via
 * `currentUser()` — never accepted from the client.
 */
export function requireAdmin(req: Request): { user: UserRow } | { error: NextResponse } {
  const user = currentUser(req);
  if (!user) return { error: jsonError("unauthorized", 401) };
  if (user.role !== "ADMIN") return { error: jsonError("forbidden", 403) };
  return { user };
}

/**
 * Gate for the team-admin panel: 401 with no token, 403 for anyone whose
 * role isn't `ADMIN_TEAMS`. A platform `ADMIN` does not automatically pass
 * this gate — the two roles are granted independently (see
 * `scripts/grant-admin.mjs`).
 */
export function requireAdminTeams(req: Request): { user: UserRow } | { error: NextResponse } {
  const user = currentUser(req);
  if (!user) return { error: jsonError("unauthorized", 401) };
  if (user.role !== "ADMIN_TEAMS") return { error: jsonError("forbidden", 403) };
  return { user };
}

/** @deprecated Use `subscriptionGrantsPro` from `@/lib/subscriptions`. Kept as a thin re-export so nothing importing this from `auth.ts` breaks. */
export const subscriptionIsPro = subscriptionGrantsPro;

export { sha256 };
