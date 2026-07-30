# Audit — Central API expansion (2026-07-30)

This audit precedes the `/api/v1` central-API work described in
[`docs/API_ARCHITECTURE.md`](./API_ARCHITECTURE.md). It reflects the codebase as it
existed before that work started — a working Next.js 15 / TypeScript / SQLite
(`better-sqlite3`) app with its own Bearer-token auth, Stripe billing, a Founder
Program, an admin panel, a Discord bot, and a Vitest suite. Nothing below was
rewritten "because it looked old" — see the Plan column for what actually changes.

## Method

Read in full: `package.json`, `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/password.ts`,
`src/lib/subscriptions.ts`, `src/lib/stripe.ts`, `src/lib/apple-subscriptions.ts`,
`src/lib/founders.ts`, `src/lib/email-verification.ts`, `src/middleware.ts`, every
route under `src/app/api/**/route.ts` (36 files), `tests/**`, `docs/**` (9 existing
docs), `.env.example`, `vitest.config.ts`, `tsconfig.json`, `next.config.ts`, and the
`bot/` and `legacy/` directories.

## Table

| Obszar | Obecny stan | Problem | Ryzyko | Plan |
|---|---|---|---|---|
| Users table | `users` (id, email, password_hash, stripe_customer_id, display_name, email_verified, is_active, role, last_login_at, apple_original_transaction_id, apple_account_token, accrued_rent_cents/currency) | No profile fields (locale/timezone/currency/rate), no soft-delete/export flow | Low — additive | Keep table as-is; add `user_profiles` 1:1 table (§10) |
| Auth tokens | `tokens` (token_hash, user_id, expires_at) — flat 30-day bearer tokens, no rotation, no device binding, no session listing | Long-lived, unrotatable, unrevocable-per-device tokens; no refresh flow; can't power iOS/Watch/widget session management | Medium — real security gap for a multi-device future, but the current web still depends on it | Introduce `sessions` + short-lived JWT access tokens for `/api/v1` (§7); keep `tokens`/`currentUser()` live for legacy adapters during migration (§8); do not drop `tokens` yet |
| Password hashing | `src/lib/password.ts` — Node `scrypt`, self-describing `scrypt$N$salt$hash`, `needsRehash()` for opportunistic upgrades | None found | None | Reuse as-is for both legacy and v1 — no parallel hashing scheme |
| Password reset | **Does not exist.** `docs/AUTH.md` lists it explicitly as a known gap | Spec requires `forgot-password`/`reset-password` | Low (additive) | New `password_reset_tokens` table + `server/auth`, mirroring the existing `email_verification_tokens` pattern 1:1 |
| Email verification | `email_verification_tokens` + `src/lib/email-verification.ts`, SHA-256-hashed single-use tokens, 24h TTL, AWS SES | None found | None | Reuse unchanged; exposed again under `/api/v1/auth/verify-email` and `/resend-verification` calling the same functions |
| Subscriptions / entitlements | `subscriptions` (1 row per user) with `source ∈ {STRIPE, APPLE, MANUAL, NONE}`, `subscriptionGrantsPro()`, `grantFounderPro()` merge logic already handles "don't clobber a provider-managed row" | No unified multi-source view (isFounder/isPro/earlyAccess), no ADMIN/PROMO grant path, "isPro" is a derived boolean not an entitlement list | Medium — spec explicitly forbids a second subscriptions table/duplicate webhook | New thin `entitlements` table for ADMIN/PROMO grants only; `EntitlementService.getUserAccess()` (§13) is a read-side merge over `subscriptions` + `founder_purchases` + `entitlements` — no new write path for Stripe/Apple/Founder data |
| Stripe integration | `src/lib/stripe.ts`, `POST /api/checkout`, `POST /api/billing/portal`, `POST /api/webhook` (single webhook, idempotent via `webhook_events`, one DB transaction, handles checkout/subscription/invoice/charge/refund events, dispatches contributions vs Founder vs Pro subscription by `metadata.kind`) | None structurally — this is the most mature part of the codebase | Low | **Do not duplicate.** `/api/v1/webhooks/stripe` re-exports the existing handler; `/api/v1/subscription/stripe/checkout`+`/portal` extract the existing route bodies into `server/subscriptions/stripe.ts`, called by both old and new routes |
| Apple integration | `src/lib/apple-subscriptions.ts` + `/api/subscriptions/apple/sync` + `/api/webhooks/apple` — **intentionally structure-only**, `verifyAndDecodeTransaction()` always throws (503/501), documented in `docs/APPLE_SUBSCRIPTIONS.md` as "nothing here may ever grant Pro" | Real JWS/x5c verification against Apple's root CA is real, non-trivial work (App Store Server Library) | High if faked — a stub verifier returning `true` would let anyone self-grant Pro | Preserve the "never trust unverified data" contract exactly; add `/api/v1/subscription/apple/verify` and `/restore` as the same structural placeholder, returning the same 503/501 semantics; document the real integration steps in `docs/APPLE_SUBSCRIPTIONS.md` (updated) |
| Founder Program | `founder_tiers`, `founder_purchases`, `founder_profiles`, `founder_black_fulfillments` in `src/lib/founders.ts` — atomic numbered-slot assignment, idempotent webhook settlement, refund handling, admin CRUD | None found | Low | Reuse unchanged; `EntitlementService` reads `founder_purchases`/`grantFounderPro()` output, no new table |
| Billing history | `billing_records` + `src/lib/billing.ts`, already generalized for STRIPE source | None found | None | Unchanged; not in scope for this pass (still reachable at `/api/billing/*`) |
| Admin panel | `/admin`, `/admin/waitlist`, `/team-admin`, gated by `role ∈ {ADMIN, ADMIN_TEAMS}` via `requireAdmin`/`requireAdminTeams`, client-side role check (no server session middleware) | Same pattern the whole app uses; consistent with "no NextAuth" decision | Low | Untouched in this pass |
| Discord bot | `bot/` — separate long-running Node process (discord.js), own `bot/db.js` opening the **same** SQLite file directly for waitlist/beta-tester rows | Reads the shared DB file directly rather than through an API — acceptable for a single-VPS deployment, but not how the target architecture describes it ("Wspólna warstwa serwisowa lub bezpieczne API wewnętrzne") | Low today, grows if the bot needs write access to sessions/entitlements later | **Not modified in this pass** (out of the audited change set — see final report). Documented as a follow-up: an `INTERNAL` platform + service-account bearer token against `/api/v1` is the intended future path, replacing direct SQLite access |
| Route inventory | 36 route files under `src/app/api/**` | Flat, ungrouped, several call Stripe/SES SDKs directly in the handler | Low | See "Endpoint disposition" below |
| Response shape | Ad hoc per route: `{ ok, ...fields }` success, `{ ok:false, error }` errors, via `json()`/`jsonError()` in `auth.ts` | No `requestId`, no field-level validation errors, inconsistent with the `{data,meta}`/`{error,meta}` envelope the spec requires for `/api/v1` | Low | New envelope lives in `src/lib/http/`; **legacy routes keep their existing shape** (changing it would break the web client and existing tests) — only a `Deprecation` header is added |
| Security headers | Global CSP/HSTS-adjacent headers in `next.config.ts`; `Cache-Control: no-store` + `X-Content-Type-Options: nosniff` per-response via `json()` | Already solid | None | Reuse `next.config.ts` headers; v1 envelope sets the same two headers explicitly per response too |
| Rate limiting | `rateLimit()` in `auth.ts`, fixed-window SQLite-backed, per-IP or per-user bucket | Works, but IP is read from `x-forwarded-for` unconditionally (first hop) | Low today (single reverse proxy assumed) | Reuse `rateLimit()` for v1 routes; document `TRUSTED_PROXY_COUNT` for future hardening, not enforced yet (see Production Checklist) |
| Tests | 22 Vitest files, `tests/setup.ts`, isolated temp-dir SQLite per file (`useIsolatedDataDir()`), `fileParallelism:false` | Only covers existing (legacy) surface | None — pattern is good | New v1 logic gets its own test files following the exact same `useIsolatedDataDir()` / `jsonRequest()` helpers |
| Env vars | `.env.example` has `APP_URL`, Stripe, Apple (partial), SES, admin bootstrap, `DATA_DIR` | Missing everything the spec's §24 list requires for v1 (access/refresh token config, `API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, etc.) | Low | Additive `.env.example` update — no existing var renamed or removed |
| Database engine | SQLite via `better-sqlite3`, single shared connection, WAL mode, migrations via `addColumnIfMissing()` | Not horizontally scalable, single-writer | Medium, long-term | No destructive migration in this pass; `docs/DATABASE_MIGRATION.md` documents a safe Postgres path for later |

## Endpoint disposition

Every existing endpoint keeps working. None are deleted in this pass.

**Stay exactly as-is (not part of the v1 surface, no auth/session model change):**
`/api/waitlist`, `/api/teams/pilot`, `/api/verify-email`, `/api/resend-verification`,
`/api/billing/*`, `/api/checkout`, `/api/contributions/*`, `/api/founders/*`,
`/api/admin/*`, `/api/webhook`, `/api/webhooks/apple`, `/api/subscriptions/apple/sync`,
`/api/subscriptions/status`.

**Become legacy compatibility adapters** (same handler code, `Deprecation` header
added, documented in `docs/AUTH_MIGRATION.md`), because `/api/v1/auth/*` now covers
the same job with a different (session/JWT) token model:
`/api/login`, `/api/register`, `/api/logout`, `/api/me`.

**New in `/api/v1`** (see `docs/API_ENDPOINTS.md` for the full list): `auth/*`,
`profile`, `devices/*`, `usage/*`, `subscription/*` (thin wrappers over the existing
Stripe/Apple/Founder logic — no parallel billing system), `account/*`, `push/*`,
`config`, `webhooks/stripe` (re-export of the existing handler), `webhooks/apple`
(re-export of the existing structural placeholder).

**Not built in this pass** (see final report, item 18): a second Postgres database,
real Apple JWS verification, and any change to `bot/`.
