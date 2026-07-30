import { ApiError } from "./errors";

/**
 * Shared request-hygiene helpers for /api/v1. The legacy `rateLimit()` /
 * `bearerToken()` in `@/lib/auth` are reused as-is (see
 * docs/API_ARCHITECTURE.md) — this file only adds what didn't exist yet:
 * trusted-proxy-aware client IP, CORS allowlisting, and origin/redirect
 * checks for the cookie-based web session (§9 of the brief).
 */

/**
 * `x-forwarded-for` is attacker-controlled unless a reverse proxy is known
 * to overwrite (not append to) it. `TRUSTED_PROXY_COUNT` (default 0 — trust
 * nothing, fall back to the raw socket-adjacent header) says how many
 * comma-separated hops, counted from the right, were added by proxies we
 * control; only the value to the left of those is treated as the client IP.
 * With 0 configured, the header is never trusted and "unknown" is used —
 * callers should treat that as "IP-based limiting unavailable" rather than
 * silently rate-limiting a shared bucket.
 */
export function trustedClientIp(req: Request): string {
  const trustedHops = Math.max(0, Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "0", 10) || 0);
  if (trustedHops <= 0) return req.headers.get("x-real-ip")?.trim() || "unknown";

  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return req.headers.get("x-real-ip")?.trim() || "unknown";

  const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
  const index = hops.length - trustedHops;
  return index >= 0 ? hops[index]! : hops[0] ?? "unknown";
}

function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return allowedOrigins().includes(origin);
}

/** CORS headers for a preflight/actual response — only ever echoes an allowlisted origin, never `*` (this API carries credentials). */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

/**
 * CSRF defense for cookie-authenticated (web BFF) state-changing requests:
 * the browser always sends `Origin` on cross-site fetch/XHR/form submits,
 * and same-site requests always match. Bearer-token calls (iOS/Watch/bot)
 * don't rely on ambient cookie auth, so they are not subject to this check —
 * callers only invoke it from the cookie-session path. Throws FORBIDDEN
 * rather than returning a boolean so a route can't accidentally ignore it.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin navigations/non-CORS requests don't send Origin
  const appOrigin = (process.env.APP_BASE_URL ?? "").replace(/\/+$/, "");
  if (origin === appOrigin || isAllowedOrigin(origin)) return;
  throw new ApiError("FORBIDDEN", "Nieprawidłowe źródło żądania.");
}

/**
 * Guards a post-login/logout redirect target against open-redirect: only a
 * path starting with a single `/` (never `//`, `/\`, or an absolute URL) is
 * accepted. Returns the safe fallback for anything else.
 */
export function safeRedirectPath(candidate: string | null | undefined, fallback = "/"): string {
  if (!candidate) return fallback;
  if (!/^\/(?!\/|\\)/.test(candidate)) return fallback;
  return candidate;
}
