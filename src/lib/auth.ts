import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "./db";

export const API_TOKEN_DAYS = 30;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface SubscriptionRow {
  user_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: number | null;
  last_event_created: number;
  updated_at: string;
}

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
 * Per-IP, per-action rate limiter. Returns a 429 response when the caller has
 * exhausted its budget, or null when the request may proceed.
 */
export function rateLimit(
  req: Request,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): NextResponse | null {
  const bucket = sha256(`${action}:${clientIp(req)}`);
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

export function issueToken(userId: string): { token: string; expires_at: string } {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + API_TOKEN_DAYS * 86400 * 1000).toISOString();
  getDb()
    .prepare("INSERT INTO tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), userId, expires, new Date().toISOString());
  return { token, expires_at: expires };
}

/** Resolve the authenticated user from the Bearer token, or null. */
export function currentUser(req: Request): UserRow | null {
  const token = bearerToken(req);
  if (!token) return null;
  const user = getDb()
    .prepare(
      `SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.expires_at > ?`
    )
    .get(sha256(token), new Date().toISOString()) as UserRow | undefined;
  return user ?? null;
}

export function revokeToken(token: string): void {
  getDb().prepare("DELETE FROM tokens WHERE token_hash = ?").run(sha256(token));
}

export function subscriptionIsPro(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false;
  if (!["active", "trialing"].includes(sub.status)) return false;
  const end = sub.current_period_end ?? 0;
  return end === 0 || end > Math.floor(Date.now() / 1000);
}

export { sha256 };
