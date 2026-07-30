# Auth Migration — legacy `tokens` → `/api/v1` `sessions`

Two auth systems intentionally coexist for a while. This document is the plan for
retiring the old one. See [`docs/AUTH_FLOW.md`](./AUTH_FLOW.md) for how the new one
works and [`docs/AUTH.md`](./AUTH.md) for how the old one works (unchanged).

## Why two systems, briefly

The legacy `tokens` table is a flat, 30-day, unrotatable bearer token — one row per
token, no device binding, no session listing, no revoke-one-device. It's simple and it
works for the current web client. The new `sessions` table adds short-lived JWT access
tokens, rotating refresh tokens with reuse detection, and per-device session tracking —
required for iOS/Watch/widgets (§7 of the brief), and a real security upgrade for web
too, but not something to force through in one atomic cutover while the existing web
client and 22 test files depend on the old shape.

## Stages

1. **Done in this pass.** New logins/registrations against `/api/v1/auth/*` use
   `sessions`. `/api/v1/**` only ever accepts the new short-lived access tokens
   (`requireAuth()` in `src/server/auth/service.ts` — verifies the JWT, then checks the
   named session is still active).
2. **Done in this pass.** The legacy endpoints (`/api/login`, `/api/register`,
   `/api/logout`, `/api/me`) keep working, completely unmodified internally — same
   `tokens` table, same `issueToken()`/`currentUser()`/`revokeToken()` from
   `src/lib/auth.ts`. Only a `Deprecation: true` + `Link: <...>; rel="successor-version"`
   header (RFC 8594) was added, via a wrapper (`src/lib/http/deprecation.ts`) around the
   exported handler — zero risk to the existing logic or to the 22 existing test files
   (all still pass unmodified).
3. **Not done in this pass — next step for whoever owns the web client.** Switch the
   web app (`AuthPanel.tsx`, `AccountClient.tsx`, `middleware.ts`) from calling
   `/api/login`/`/api/register` and holding a token in `sessionStorage` (today's
   behavior — see `docs/AUTH.md`) to the BFF/cookie pattern described in
   [`docs/WEB_API_INTEGRATION.md`](./WEB_API_INTEGRATION.md), calling `/api/v1/auth/*`.
   This is a frontend + a bit of server-side plumbing change, not an API change — the
   v1 endpoints already exist and are ready.
4. **Not done in this pass.** Once web is fully cut over, legacy endpoints see
   effectively zero traffic from the app itself (only third-party/forgotten
   integrations, if any). At that point, set a `Sunset` header (RFC 8594) with a
   concrete retirement date and announce it.
5. **Not done in this pass.** After the sunset date, either return `410 Gone` from the
   four legacy routes, or — if any outstanding `tokens` rows still exist — let them
   expire naturally (30-day TTL, opportunistic cleanup already in `src/lib/db.ts`) before
   removing the routes and the `tokens` table itself.

## What is explicitly *not* forced

- **No password reset for existing users.** Nothing in this migration requires anyone
  to reset their password — `src/lib/password.ts`'s scrypt hash format is unchanged and
  used identically by both systems.
- **No forced re-login on deploy.** Existing `tokens` rows keep working through stage 3;
  nothing in this pass revokes them in bulk. (Password reset, change-password, and
  account deletion *do* revoke sessions/tokens — but only for the account performing
  that specific action, same as before.)
- **No second `users` table, no second password hash.** Both systems read/write the
  same `users` row.

## Rollback

Every stage above is additive up through stage 2 (already merged): the `sessions`,
`devices`, `password_reset_tokens` tables are new, the four legacy routes' *logic* is
untouched, and no existing table lost a column or a row. Rolling back to pre-migration
behavior for the web client is therefore just "don't switch it to the BFF pattern yet" —
no data migration to undo.

## Compatibility matrix

| Client / call | Works against `tokens` (legacy) | Works against `sessions` (v1) |
|---|---|---|
| Existing web client (unmodified) | ✅ | n/a — not switched over |
| iOS app (this repo's contract, `RentYourTime` repo not modified here) | n/a — never used the legacy API | ✅ (target from day one) |
| `/api/v1/**` routes | ❌ (by design — `requireAuth()` only verifies v1 access tokens) | ✅ |
| `/api/login`, `/api/register`, `/api/logout`, `/api/me` | ✅ | n/a — these routes don't accept v1 tokens at all; they're a separate, older mechanism entirely |
