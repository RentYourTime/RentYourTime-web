# Production Checklist

Everything below that touches infrastructure (nginx, systemd, DNS, the Stripe
Dashboard, App Store Connect) is a **manual step for a human with access to those
systems** — nothing in this repository or this pass executes any of it. See
[`DEPLOY_AWS.md`](../DEPLOY_AWS.md) for the existing full deployment guide this
checklist supplements (not replaces).

## Before deploying this change

- [ ] `npm ci && npm run lint && npx tsc --noEmit && npm run test && npm run build` all
      pass (see [final report](#) / this session's verification output).
- [ ] `.env` on the target host has every new var from `.env.example` filled in:
      `ACCESS_TOKEN_SECRET` (generate fresh — `openssl rand -hex 32`; do **not** reuse a
      value from another environment), `ACCESS_TOKEN_ISSUER`, `ACCESS_TOKEN_AUDIENCE`,
      `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `CORS_ALLOWED_ORIGINS`,
      `TRUSTED_PROXY_COUNT`, `API_BASE_URL`, `APP_BASE_URL`, `APP_ENV`.
- [ ] Confirm `DATA_DIR` points at the existing persistent SQLite disk — the new tables
      (`sessions`, `devices`, `user_profiles`, `daily_usage`, `feature_flags`,
      `entitlements`, `idempotency_keys`, `audit_log`, `password_reset_tokens`) are
      created automatically on first `getDb()` call, additively, in the same database
      file. **Back up that file before the first deploy of this change regardless**
      (`cp rentyourtime.sqlite rentyourtime.sqlite.pre-v1-backup` or a proper
      `.backup` — see [`docs/DATABASE_MIGRATION.md`](./DATABASE_MIGRATION.md)'s backup
      step for the WAL-safe method).
- [ ] Seed the reserved feature-flag rows if you want `GET /api/v1/config` to report
      anything other than defaults: a `maintenance` row and an `app` row (minimum/latest
      version) in `feature_flags` — see [`docs/API_ARCHITECTURE.md`](./API_ARCHITECTURE.md#feature-flags--remote-config).
      No seed script ships in this pass; insert directly via `sqlite3` or a short
      one-off script mirroring `scripts/seed-founder-tiers.mjs`'s pattern.

## nginx / reverse proxy (manual)

- [ ] Set `TRUSTED_PROXY_COUNT=1` (or however many proxy hops actually sit in front of
      the app) **only after** confirming nginx (or equivalent) is configured to
      *overwrite*, not append to, `X-Forwarded-For` — e.g.
      `proxy_set_header X-Forwarded-For $remote_addr;` if nginx is the first hop, or the
      standard `proxy_add_x_forwarded_for` pattern chained correctly if there are
      multiple hops. Getting this wrong lets a client spoof its own rate-limit bucket.
- [ ] No new routes need a new nginx location block — `/api/v1/*`, `/health`, `/ready`
      all pass through the existing `location /` → Next.js proxy_pass, same as every
      other route today.
- [ ] Confirm `/health` and `/ready` are reachable *without* going through any
      IP-allowlist or basic-auth rule that might otherwise apply to `/api/*` —
      orchestrators/load balancers need to reach them.

## systemd (manual)

- [ ] No new service unit needed — `/api/v1` is served by the same Next.js process
      (`npm run start`) as everything else. If your orchestrator has its own health
      check config (systemd doesn't natively, but a wrapper/monitoring agent might),
      point it at `GET /ready`.

## DNS (manual)

- [ ] If `api.rentyourtime.app` is meant to be a distinct hostname from the web app's
      (per §3 of the brief's environment table), create that DNS record and terminate
      TLS for it — routing to the *same* Next.js deployment (this repo doesn't split
      the API into a separate service). Until that DNS record exists, `API_BASE_URL`
      can safely point at the same host the web app already uses; `/api/v1` works
      either way.

## Stripe Dashboard (manual)

- [ ] **Do not add a second webhook endpoint.** `/api/v1/webhooks/stripe` is a
      re-export of the exact same handler already registered (presumably) at
      `/api/webhook`. Either:
      - leave the Dashboard pointed at `/api/webhook` (simplest — no Dashboard change
        needed for this deploy), or
      - if you want the Dashboard to reflect the new versioned path going forward,
        update the existing webhook endpoint's URL from `.../api/webhook` to
        `.../api/v1/webhooks/stripe` (edit in place — don't add a second endpoint, or
        Stripe will deliver every event twice and `webhook_events` dedup will just
        silently drop the second delivery, wasting quota).
      - Either way, `STRIPE_WEBHOOK_SECRET` is unchanged either way — same signing
        secret, same event subscriptions (see `docs/STRIPE.md`).
- [ ] No new Price IDs required for this pass (`STRIPE_PRICE_ID_MONTHLY/YEARLY`,
      Founder tier prices — all unchanged).

## App Store Connect (manual)

- [ ] **Do not register `/api/v1/webhooks/apple` (or the legacy `/api/webhooks/apple`)
      as a Server Notifications V2 URL yet.** Both currently always return `501` — see
      [`docs/APPLE_SUBSCRIPTIONS.md`](./APPLE_SUBSCRIPTIONS.md). Registering it early
      just means Apple retries a non-2xx response for a while and gives up — harmless,
      but pointless until real JWS verification is implemented.
  - [ ] Once verification *is* implemented (future work, not this pass): create the two
        subscription products (`com.rentyourtime.app.pro.monthly`,
        `com.rentyourtime.app.pro.annual`) if they don't already exist, generate an App
        Store Server API key (Issuer ID / Key ID / `.p8` private key) for
        `APPLE_ISSUER_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY`, and only then set the
        Server Notifications V2 URL to `https://api.rentyourtime.app/api/v1/webhooks/apple`.

## Data retention

Account deletion (`DELETE /api/v1/account`, `src/server/account/index.ts`) soft-deletes
and scrubs directly-identifying fields (`email`, `password_hash`, `display_name`) but
**deliberately retains** `billing_records` and `founder_purchases` rows — these are
financial/tax records referencing `users.id` via foreign key, and most jurisdictions
require retaining invoice-equivalent records for a fixed period regardless of account
deletion. `user_profiles` and `daily_usage` (no such requirement) are deleted outright.
If your jurisdiction's retention period for billing records is known, encode it as an
explicit purge job (not built in this pass) rather than deleting immediately on account
deletion.

## Elements not verifiable locally

See the final report's item 18 — Stripe Dashboard/App Store Connect state, real traffic
against `/health`/`/ready` behind a real reverse proxy, and TLS termination can't be
exercised from this repository alone.
