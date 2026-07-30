# Web API Integration (BFF pattern)

How the RentYourTime web app should consume `/api/v1` — as its own Backend-For-Frontend,
not as a public API client. See [`docs/AUTH_FLOW.md`](./AUTH_FLOW.md#login--web) for the
sequence diagram this describes.

## Status

**Not wired into the existing UI in this pass.** `src/components/AuthPanel.tsx` and
`src/components/AccountClient.tsx` still call the legacy `/api/login`, `/api/register`,
`/api/me`, `/api/logout` today and store the returned bearer token client-side (per
`docs/AUTH.md`) — that continues to work unchanged (see
[`docs/AUTH_MIGRATION.md`](./AUTH_MIGRATION.md)). This document specifies the target
for when that frontend work happens; the `/api/v1/auth/*` endpoints it depends on
already exist and are ready to be called this way.

## The pattern

The web app's own Next.js server (this same process) is the only thing that ever holds
a raw access/refresh token pair. The browser only ever receives an **HttpOnly session
cookie** — never a token in a JS-readable cookie, `localStorage`, `sessionStorage`, or a
URL.

1. A Server Action or Route Handler under `src/app/api/**` (the *web app's own*
   surface, not `/api/v1` itself) calls `POST /api/v1/auth/login` server-side
   (`platform: "WEB"`).
2. On success, it sets:

   ```
   Set-Cookie: rt=<refreshToken>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=<REFRESH_TOKEN_TTL_DAYS in seconds>
   ```

   `Secure` in production only (a local `http://localhost` dev server can't set it);
   `SameSite=Lax` (not `Strict`) so a link from an external site into a logged-in page
   still works, while still blocking cross-site POST/fetch forgery for the cases that
   matter. `Path=/api/v1/auth` scopes the cookie so it's never sent to unrelated
   routes.
3. Every subsequent server-side call to `/api/v1/**` on behalf of that browser session
   reads `rt` from the incoming request's cookies, calls `POST /api/v1/auth/refresh`
   (or reuses a still-valid cached access token — short-lived, so caching it in an
   in-memory/edge cache keyed by session id is safe and cheap) to get a fresh access
   token, and attaches it as `Authorization: Bearer <accessToken>` on the *server-to-API*
   call. The browser never sees the access token.
4. Logout: read `rt`, call `POST /api/v1/auth/logout`, clear the cookie
   (`Set-Cookie: rt=; Max-Age=0`).

## CSRF

Because the browser automatically attaches the `rt` cookie to same-site requests, any
state-changing web-app route that relies on it must call
`assertSameOrigin(req)` (`src/lib/http/security.ts`) before acting — it throws
`FORBIDDEN` unless the request's `Origin` header matches `APP_BASE_URL` or is on
`CORS_ALLOWED_ORIGINS`. Bearer-token calls (iOS/Watch/bot) don't go through this check;
they don't rely on ambient cookie auth in the first place, so CSRF doesn't apply to them.

## Session fixation

Every login issues a brand-new session (new `sessions` row, new token family) — never
reuses an existing session id across a privilege change (e.g. login after being
anonymous). `POST /auth/change-password` and `POST /auth/reset-password` both revoke
every *other* session, so a fixed/leaked pre-change session cookie stops working
immediately.

## Open redirect

Any post-login/logout `?next=` or `?redirect=` query parameter must be validated with
`safeRedirectPath()` (`src/lib/http/security.ts`) before use — it only accepts a path
starting with a single `/` (rejects `//evil.com`, `/\evil.com`, and any absolute URL),
falling back to `/` otherwise.

## Caching

Every `/api/v1` response already sets `Cache-Control: no-store` (the envelope,
`src/lib/http/envelope.ts`) — the web app's own pages/route handlers that surface
account-specific data must do the same on their own responses (Next.js `fetch` calls to
`/api/v1` from a Server Component should pass `{ cache: "no-store" }` explicitly; don't
rely on the default).

## Origin validation for CORS

The web app itself never needs `CORS_ALLOWED_ORIGINS` (it calls `/api/v1` server-side,
same process — no browser-originated cross-origin request involved). That allowlist
exists for a *future* separate web/admin frontend origin, if one is ever split out.
