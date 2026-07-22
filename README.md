# RentYourTime

Make the cost of screen time visible. A Next.js (App Router) rewrite of the
original PHP + static-HTML site.

- **Marketing** — landing (`/`), pricing (`/pricing`), account (`/account`)
- **Interactive demo** — a full iOS-style product demo at `/demo`
- **Customer panel** (`/account`) — account details, subscription status, billing
  history with hosted/PDF invoice links, and the Stripe Customer Portal
- **API** — waitlist, account auth (register / login / me / logout), Stripe
  subscription checkout + webhooks + billing history, and a subscription
  entitlement service that recognizes whether Pro was purchased through Stripe or
  Apple — backed by SQLite

## Stack

| Concern    | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 15 (App Router) + React 19 + TypeScript     |
| Styling    | Tailwind CSS v4 (marketing) + scoped CSS (the demo) |
| Database   | SQLite via `better-sqlite3` (persistent disk)       |
| Payments   | Stripe (official Node SDK)                          |
| Passwords  | Node `scrypt` (no native bcrypt dependency)         |

> Built for a **long-running Node process** (VPS / container), not serverless —
> the SQLite file and rate-limit / waitlist state need a persistent disk.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev            # http://localhost:3000
npm test                # run the test suite (vitest, isolated temp SQLite DBs)
```

### Environment

See `.env.example`. Stripe checkout/webhooks require `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` and `APP_URL`. The waitlist and demo
work without them. `APPLE_*` vars are optional — see
[`docs/APPLE_SUBSCRIPTIONS.md`](docs/APPLE_SUBSCRIPTIONS.md); the Apple sync
endpoint responds 503/501 without them, it never fails silently.

The SQLite database is created automatically in `./.data`
(override with `DATA_DIR`). This directory is git-ignored — back it up.

## Production

```bash
npm run build
npm run start   # serves on PORT (default 3000)
```

Run behind a reverse proxy (nginx/Caddy) terminating HTTPS and forwarding
`X-Forwarded-For` (used for per-IP rate limiting). Point the Stripe webhook at
`https://your-domain/api/webhook` and subscribe to the events listed in
[`docs/STRIPE.md`](docs/STRIPE.md).

## API

| Method | Route                            | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------- |
| GET    | `/api/waitlist`                   | Current signup count                        |
| POST   | `/api/waitlist`                   | Join the waitlist (honeypot-protected)      |
| POST   | `/api/register`                   | Create an account → returns bearer token    |
| POST   | `/api/login`                      | Sign in → returns bearer token              |
| GET    | `/api/me`                         | Account + subscription entitlement (Bearer) |
| POST   | `/api/logout`                     | Revoke the current token (Bearer)           |
| GET    | `/api/subscriptions/status`       | Subscription entitlement only (Bearer)      |
| POST   | `/api/checkout`                   | Create a Stripe Checkout session (Bearer)   |
| POST   | `/api/webhook`                    | Stripe webhook receiver                     |
| GET    | `/api/billing/invoices`           | Your billing history (Bearer)               |
| GET    | `/api/billing/invoices/[id]`      | One invoice, by local ID (Bearer)           |
| POST   | `/api/billing/portal`             | Create a Stripe Customer Portal session     |
| POST   | `/api/subscriptions/apple/sync`   | Apple sync — 501/503 today, see docs        |
| POST   | `/api/webhooks/apple`             | Apple notifications — 501 today, see docs   |

Tokens are random, stored only as SHA-256 hashes, and expire after 30 days.
`src/lib/subscriptions.ts` (driven by Stripe/Apple webhooks) is the single source of
truth for Pro — never grant Pro from a `?checkout=success` redirect alone, and never
trust `productId`/`expiresAt` sent by a client. Billing history
(`src/lib/billing.ts`) is always scoped to the authenticated user — there is no
`userId` request parameter anywhere in the billing API. Details:
[`docs/AUTH.md`](docs/AUTH.md), [`docs/SUBSCRIPTIONS.md`](docs/SUBSCRIPTIONS.md),
[`docs/STRIPE.md`](docs/STRIPE.md), [`docs/BILLING_PORTAL.md`](docs/BILLING_PORTAL.md),
[`docs/APPLE_SUBSCRIPTIONS.md`](docs/APPLE_SUBSCRIPTIONS.md).

## Legacy

The original PHP/HTML implementation is preserved under `legacy/` for reference.
