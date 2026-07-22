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

These paths are intentionally flat (not under `/api/auth/*`) — that's what already
existed in this codebase, and there is no reason to rename them.

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
- `email_verified`: column exists, always `0` today — there is no verification email
  flow yet. Don't build anything that assumes it's ever `1`.
- `role`: always `'USER'` today — no admin endpoints exist. Reserved for later.
- `last_login_at` / `updated_at`: updated on every successful login.

## Rate limiting & request hygiene

`rateLimit(req, action, maxAttempts, windowSeconds, keyOverride?)` in `auth.ts` is a
fixed-window, per-bucket limiter backed by the `rate_limits` table. Buckets are keyed
by `sha256(action:ip)` by default; pass `keyOverride` (e.g. a user id) to key by
something other than IP — used by Apple sync (per-user, since a single account can
call it from one authenticated client).

Every route reads its JSON body through `readJsonBody(req, maxBytes)`, which rejects
a non-`application/json` `Content-Type` (415) and oversized bodies (413) before
parsing. `json()`/`jsonError()` set `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff` on every response.

## Known limitations

- No password reset / email verification flow.
- No admin tooling to flip `is_active` or `role` — today that's a manual SQL update.
- No single-session enforcement or token listing/revocation UI (a user can't see or
  revoke individual devices — only "logout this token").
