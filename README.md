# RentYourTime

Make the cost of screen time visible. A Next.js (App Router) rewrite of the
original PHP + static-HTML site.

- **Marketing** — landing (`/`), pricing (`/pricing`), account (`/account`)
- **Interactive demo** — a full iOS-style product demo at `/demo`
- **API** — waitlist, account auth (register / login / me / logout) and Stripe
  subscription checkout + webhooks, backed by SQLite

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
```

### Environment

See `.env.example`. Stripe checkout/webhooks require `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` and `APP_URL`. The waitlist and demo
work without them.

The SQLite database is created automatically in `./.data`
(override with `DATA_DIR`). This directory is git-ignored — back it up.

## Production

```bash
npm run build
npm run start   # serves on PORT (default 3000)
```

Run behind a reverse proxy (nginx/Caddy) terminating HTTPS and forwarding
`X-Forwarded-For` (used for per-IP rate limiting). Point the Stripe webhook at
`https://your-domain/api/webhook` and subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## API

| Method | Route            | Purpose                                  |
| ------ | ---------------- | ---------------------------------------- |
| GET    | `/api/waitlist`  | Current signup count                     |
| POST   | `/api/waitlist`  | Join the waitlist (honeypot-protected)   |
| POST   | `/api/register`  | Create an account → returns bearer token |
| POST   | `/api/login`     | Sign in → returns bearer token           |
| GET    | `/api/me`        | Account + Pro entitlement (Bearer)       |
| POST   | `/api/checkout`  | Create a Stripe Checkout session (Bearer)|
| POST   | `/api/logout`    | Revoke the current token (Bearer)        |
| POST   | `/api/webhook`   | Stripe webhook receiver                  |

Tokens are random, stored only as SHA-256 hashes, and expire after 30 days.
`entitlements.pro` (driven by Stripe webhooks) is the source of truth for Pro —
never grant Pro from a `?checkout=success` redirect alone.

## Legacy

The original PHP/HTML implementation is preserved under `legacy/` for reference.
