# Auth

Custom Bearer-token auth on top of SQLite — no NextAuth, no JWT library. Lives in
[`src/lib/auth.ts`](../src/lib/auth.ts) and [`src/lib/password.ts`](../src/lib/password.ts).

## Endpoints

| Method | Route            | Auth           | Notes |
| ------ | ---------------- | -------------- | ----- |
| POST   | `/api/register`  | —              | 5 attempts / 15 min / IP |
| POST   | `/api/login`     | —              | 10 attempts / 15 min / IP |
| POST   | `/api/logout`    | Bearer         | Idempotent |
| GET    | `/api/me`        | Bearer         | — |
| POST   | `/api/verify-email` | —           | 20 attempts / 15 min / IP |
| POST   | `/api/resend-verification` | Bearer | 3 attempts / hour / user |

These paths are intentionally flat (not under `/api/auth/*`) — that's what already
existed in this codebase, and there is no reason to rename them.

`POST /api/register` accepts an optional `displayName` (trimmed, max 80 chars,
stored in `users.display_name`). The account panel's register form
(`src/components/AuthPanel.tsx`) also collects `confirmPassword` and Terms of
Service / Privacy Policy acceptance checkboxes — both are **client-side only**
gates before submit (there's no `tos_accepted` column and the API still only ever
receives one `password`); don't expect the server to enforce either.

## Passwords

Hashed with Node's built-in `crypto.scryptSync` (`N=16384`, 64-byte key), stored as
`scrypt$<N>$<saltHex>$<hashHex>`. No bcrypt/argon2/pbkdf2 dependency. The format is
self-describing, so `needsRehash()` can detect a hash made with an older, lower cost
factor and `login` transparently rehashes it after a successful verify — bumping
`COST` in `password.ts` in the future rolls forward opportunistically, without
invalidating any existing account.

Policy (enforced in `register`, via `passwordPolicyError()`): 10–200 characters, at
least one lowercase letter, one uppercase letter, one digit.

## Tokens

- Random 256-bit token (`randomBytes(32).toString("hex")`), returned to the client
  once. Only its SHA-256 hash is stored, in the `tokens` table.
- 30-day expiry (`API_TOKEN_DAYS`).
- No refresh tokens, no session scoping — one token = one row; a user can hold many
  valid tokens at once (multiple devices).
- Expired tokens and stale rate-limit buckets are purged opportunistically on ~1% of
  `getDb()` calls.

## Account state

- `is_active` (default `1`): a deactivated account (`0`) is rejected both at login
  (generic `invalid_credentials`, same as a wrong password) **and** for any
  already-issued token — `currentUser()` filters `is_active = 1`, so a deactivation
  takes effect immediately, not just on the next login.
- `email_verified`: set to `1` by `POST /api/verify-email` after a successful
  single-use, 24h token check (`src/lib/email-verification.ts`) — see
  [`docs/EMAIL_VERIFICATION.md`](./EMAIL_VERIFICATION.md) for the full flow,
  token model, and AWS SES setup. Registration never blocks on the email send.
- `role`: always `'USER'` today — no admin endpoints exist. Reserved for later.
- `last_login_at` / `updated_at`: updated on every successful login.

## Rate limiting & request hygiene

`rateLimit(req, action, maxAttempts, windowSeconds, keyOverride?)` in `auth.ts` is a
fixed-window, per-bucket limiter backed by the `rate_limits` table. Buckets are keyed
by `sha256(action:ip)` by default; pass `keyOverride` (e.g. a user id) to key by
something other than IP — used by Apple sync, the billing endpoints, and
`resend-verification` (per-user, since a single account can call them from one
authenticated client): `billing_invoices` (60/min/user), `billing_portal`
(10/10min/user), `resend_verification` (3/hour/user). `verify_email` stays
IP-keyed (20/15min) since it's unauthenticated — defense in depth against
guessing, on top of the token's own 256 bits of entropy.

Every route reads its JSON body through `readJsonBody(req, maxBytes)`, which rejects
a non-`application/json` `Content-Type` (415) and oversized bodies (413) before
parsing. `json()`/`jsonError()` set `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff` on every response.

`src/middleware.ts` is the project's only middleware, and it's scoped to exactly
one route (`matcher: ["/verify"]`): it sets `Cache-Control: no-store` on the
verification page, since a plain page component can't set response headers in
the App Router and that page briefly carries a token in its query string.

## Known limitations

- No password reset flow (email verification exists — see
  [`docs/EMAIL_VERIFICATION.md`](./EMAIL_VERIFICATION.md) — but there's no
  "forgot password" equivalent).
- No admin tooling to flip `is_active` or `role` — today that's a manual SQL update.
- No single-session enforcement or token listing/revocation UI (a user can't see or
  revoke individual devices — only "logout this token").
