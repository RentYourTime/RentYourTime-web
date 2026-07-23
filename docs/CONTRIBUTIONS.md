# Contributions ("Support the project")

Voluntary, one-time Stripe payments a user can make from `/panel` (tab `contribute`),
based on a percentage of their virtual accrued rent. Entirely separate from the Pro
subscription system documented in [`docs/STRIPE.md`](./STRIPE.md) and
[`docs/SUBSCRIPTIONS.md`](./SUBSCRIPTIONS.md) — a contribution never grants Pro, never
touches the `subscriptions` table, and never marks rent as settled (the rent figure is
motivational, not a real debt — see [`docs/AUTH.md`](./AUTH.md) and the Terms page).

## Why this isn't a subscription

RentYourTime's "rent" is a behavioral nudge, not a bill. Contributing is a separate,
optional way to support the project financially — it doesn't unlock features, doesn't
change subscription status, and doesn't reduce or settle the rent figure. The code
enforces this by keeping contributions in their own table and lib
(`src/lib/contributions.ts`), never importing from `src/lib/subscriptions.ts` or
calling anything that grants entitlements.

## The accrued-rent gap

The rent meter is computed **on-device** (see the Privacy Policy: "computed on your
phone... by default it never touches our servers"), so there is currently **no real
sync pipeline** writing a user's actual accrued rent to this backend.
`src/lib/accruedRent.ts` — the single function anything server-side is allowed to read
accrued rent from — reads `users.accrued_rent_cents`, which is `NULL` for every user
until a real on-device usage-sync exists. Until then:

- `POST /api/contributions/checkout` returns `409 accrued_rent_unavailable`.
- The UI shows "Your rent ledger isn't syncing from the app yet" instead of a
  contribute button.

To make the feature live for a real user, something trusted (a future authenticated
sync endpoint from the iOS app, or a manual operator action) needs to
`UPDATE users SET accrued_rent_cents = ?, accrued_rent_currency = ? WHERE id = ?`. No
request handler accepts this value from the client — see §5 below.

In development, `ENABLE_SUPPORT_DEMO` (below) fills this gap with a realistic demo
figure so the screen and the real Stripe flow can be exercised end to end without
manually seeding a user row.

## Flow

1. `/panel` (tab `contribute`) loads → `GET /api/contributions` returns the caller's
   `accruedRentCents`/`currency` (display only), contribution history, and
   `totalContributedCents`.
2. User picks 5/10/25/50/75/100% → the amount shown is computed client-side purely for
   display.
3. "Contribute $X" → `POST /api/contributions/checkout` with **only**
   `{ "percentage": 10 }`. The server re-reads accrued rent, recomputes the amount, and
   creates a `PENDING` row + a Stripe Checkout Session (`mode: "payment"`, dynamic
   `price_data`).
4. Browser redirects to Stripe via `window.location.assign(checkoutUrl)`.
5. Stripe redirects back to `/panel?tab=contribute&contribution=success&session_id={CHECKOUT_SESSION_ID}`
   (or `...&contribution=cancelled` if the user backs out). The success page **never**
   trusts `?contribution=success` on its own — it polls
   `GET /api/contributions/session/[sessionId]` until the *local* status is `PAID`.
6. The webhook (`POST /api/webhook` — see below) is the actual authority: it marks the
   row `PAID` once Stripe confirms payment. The session-status endpoint has a
   same-tab-convenience fallback that re-checks Stripe directly if the local row is
   still `PENDING`, so the success page doesn't have to wait out webhook delivery.

## Amount security (§5 of the original spec)

The client sends `{ "percentage": 5|10|25|50|75|100 }` and nothing else.
`POST /api/contributions/checkout`:

1. Resolves the user from the Bearer token (`currentUser(req)`), never from the body.
2. Reads accrued rent from `users.accrued_rent_cents` via `getAccruedRentForUser`.
3. Computes `amountCents = round(accruedRentCents * percentage / 100)`
   (`computeAmountCents` in `src/lib/contributions.ts`).
4. Rejects amounts below `minimumChargeCents(currency)` with `422 amount_too_low` —
   never silently rounds up.
5. Creates the Checkout Session itself with that computed `unit_amount` — the amount
   is never round-tripped through the client.

Money is stored as **integer cents** (`amount_cents`, `accrued_rent_cents`,
`refunded_amount_cents` are all `INTEGER`), never `REAL`/float.

## Database model

New table, additive only (see `src/lib/db.ts`, same `CREATE TABLE IF NOT EXISTS` +
`CREATE INDEX IF NOT EXISTS` migration style as every other table in this file — no
separate migration framework exists in this repo):

```sql
CREATE TABLE contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percentage INTEGER NOT NULL,
  accrued_rent_cents INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,                    -- PENDING | PAID | FAILED | EXPIRED | REFUNDED
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_event_id TEXT,
  refunded_amount_cents INTEGER,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  failed_at TEXT,
  refunded_at TEXT
);
```

Indexes: `user_id`, `status`, `created_at`, `stripe_checkout_session_id`,
`stripe_payment_intent_id`.

Also additive: `users.accrued_rent_cents` (nullable `INTEGER`) and
`users.accrued_rent_currency` (`TEXT`, default `'usd'`).

### Status semantics

- **PENDING** — Checkout Session created, not yet resolved.
- **PAID** — Stripe confirmed payment (`checkout.session.completed` /
  `async_payment_succeeded` with `payment_status: "paid"`, cross-checked against the
  row — see below).
- **FAILED** — `checkout.session.async_payment_failed`.
- **EXPIRED** — `checkout.session.expired` (session timed out unpaid).
- **REFUNDED** — only on a **full** refund (`amount_refunded >= amount_cents`). A
  *partial* refund stays `PAID` and instead sets `refunded_amount_cents`.

`getTotalContributedCentsForUser` sums `amount_cents - COALESCE(refunded_amount_cents, 0)`
for `status = 'PAID'` rows only — `PENDING`/`FAILED`/`EXPIRED`/`REFUNDED` never count.

## Endpoints

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/contributions/checkout` | Bearer | Body: `{ percentage }` only. 10 req/10min/user. Returns `{ checkoutUrl, contributionId }`. |
| `GET` | `/api/contributions` | Bearer | Always scoped to the caller — no `userId` param. Returns history + `totalContributedCents` + display-only accrued rent. |
| `GET` | `/api/contributions/session/[sessionId]` | Bearer | 404 (not 403) if the session isn't the caller's — same "don't disclose existence" pattern as `/api/billing/invoices/[invoiceId]`. |

No new endpoint namespace was introduced (`/api/v1/...`) — this repo's routes are all
flat under `/api/*`, so contributions follow that.

## Idempotency

- The frontend disables the "Contribute" button while a request is in flight.
- `findRecentPendingContribution` reuses a still-`open` Checkout Session created for
  the same user + percentage in the last 10 minutes instead of creating a second one
  on a retried click.
- Stripe's own `idempotencyKey` is passed to `checkout.sessions.create`, scoped to
  `contribution_<userId>_<Idempotency-Key header or generated contribution id>` — a
  client that sends a stable `Idempotency-Key` header on retry gets the exact same
  Stripe session back even across a dropped response.
- The webhook is idempotent the same way every other event in this app is: checked
  against, then recorded into, `webhook_events` inside the same DB transaction as the
  state change (see `docs/STRIPE.md`).

## Webhook — extends the existing `POST /api/webhook`

**No second webhook endpoint was created.** `docs/STRIPE.md` is explicit that
`/api/webhook` is the only one — contributions are just new branches inside the same
handler, distinguished by `metadata.kind === "contribution"` (set on both the Checkout
Session and, via `payment_intent_data.metadata`, the resulting PaymentIntent).

New event types to add to the **existing** Stripe Dashboard endpoint (same instructions
as `docs/STRIPE.md` — add to the existing endpoint, never create a second one):

- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

(`checkout.session.completed` and `charge.refunded` are already required by the
existing Pro-subscription flow and are reused here.)

### Settlement logic (`settleContributionFromSession` in `src/lib/contributions.ts`)

Shared by both the webhook and the session-status poll endpoint, so the checks below
can never diverge between the two call sites:

1. No-op unless `session.metadata.kind === "contribution"` and
   `session.payment_status === "paid"`.
2. No-op if the local row isn't `PENDING` (already settled — idempotent).
3. Refuses (`console.error`s and leaves `PENDING`) if the session's `userId` doesn't
   match the row's `user_id`, or if `amount_total`/`currency` don't match what was
   computed at checkout time. **Metadata alone is never trusted** — it's cross-checked
   against the PENDING row created server-side before redirecting to Stripe.

### Refunds

`charge.refunded` now checks whether the charge's `payment_intent` matches a known
contribution (`getContributionByPaymentIntentId`) before falling into the existing
by-customer subscription-refund logic. `object.amount_refunded` decides full vs.
partial (see Status semantics above) — a partial refund (e.g. a goodwill credit) never
gets treated as if the whole contribution came back.

### A pre-existing correlation limitation, now slightly wider

`docs/BILLING_PORTAL.md` already documents that `charge.succeeded` /
`payment_intent.succeeded` linkage to `billing_records` is "best-effort," correlated by
Stripe customer because `Stripe.Charge`/`Stripe.PaymentIntent` carry no `invoice` field
in the pinned API version. Adding a second charge stream (contributions) per customer
makes that heuristic slightly less safe, so:

- `payment_intent.succeeded`/`payment_intent.payment_failed` skip invoice-linkage
  entirely when `object.metadata.kind === "contribution"` (the PaymentIntent inherits
  the metadata set via `payment_intent_data.metadata` at checkout).
- `charge.succeeded` skips invoice-linkage when its `payment_intent` already matches a
  known contribution.
- The remaining race (a `charge.succeeded` arriving *before* the contribution's
  `checkout.session.completed` has stored its payment_intent id) is cosmetic only — at
  worst a `billing_records` row briefly shows the wrong Payment ID for copying. It
  never affects amounts, Pro status, or contribution `PAID` status, which are gated
  independently by the exact-match checks above.

## Currency

Everything in this product is USD today (fixed $8.99/$89.99 on `/pricing`, no
per-user currency field anywhere). `accrued_rent_currency` defaults to `'usd'` and
`minimumChargeCents()` in `src/lib/contributions.ts` only has verified entries for
`usd`/`eur`/`gbp` — verify against
[Stripe's minimum charge amounts](https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts)
before relying on any other currency. UI formatting goes through
`toLocaleString(..., { style: "currency", currency })`, never string-concatenated
`"$" + amount`.

## Environment variables

No new variables. Contributions reuse the existing `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, and `APP_URL` — dynamic `price_data` means no
`STRIPE_CONTRIBUTION_PRICE_ID` is needed. See `.env.example`.

## Development demo mode

Lets `/panel` show a realistic accrued-rent figure and history for accounts with no
real synced ledger yet, **without ever mocking Stripe** — contributing still opens a
real Stripe Checkout session in Test Mode, still goes through the real webhook, and
still writes a real `contributions` row.

### Enabling it

Set in your local `.env` (see `.env.example`):

```
ENABLE_SUPPORT_DEMO=true
SUPPORT_DEMO_ACCRUED_RENT_CENTS=2840
SUPPORT_DEMO_CURRENCY=usd
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### How it behaves

- **Never active in production.** `isSupportDemoEnabled()` in `src/lib/supportDemo.ts`
  checks `process.env.NODE_ENV === "production"` first, unconditionally, before even
  looking at `ENABLE_SUPPORT_DEMO` — a hard, server-only kill switch with no code path
  that reads it from the client. In production, `ENABLE_SUPPORT_DEMO` and
  `SUPPORT_DEMO_ACCRUED_RENT_CENTS` are simply never consulted.
- **Real data always wins.** `resolveAccruedRentForUser()` in `src/lib/accruedRent.ts`
  tries `getAccruedRentForUser()` (the real, on-device-synced value) first; the demo
  figure is only used as a fallback when that's `null`. The moment a real
  `accrued_rent_cents` exists for an account, demo mode stops applying to it — even
  with `ENABLE_SUPPORT_DEMO=true`.
- **Checkout is 100% real.** `POST /api/contributions/checkout` calls
  `resolveAccruedRentForUser()` instead of `getAccruedRentForUser()` — that's the only
  change. The amount is still computed server-side, the client still only ever sends
  `{ percentage }`, and `stripe.checkout.sessions.create()` is called exactly as
  normal. The only extra is metadata (`source: "demo"`,
  `environment: process.env.NODE_ENV`) stamped on the Checkout Session and
  PaymentIntent, and `contributions.is_demo_source = 1` on the local row — both purely
  informational, and neither affects settlement logic in
  `settleContributionFromSession()`, which cross-checks amount/currency/user exactly
  the same way regardless.
- **Preview history is fictional and never persisted.** The three example past entries
  and the "Preview total" shown alongside a real Stripe Test Mode section are a fixed,
  hardcoded array in `PanelClient.tsx` (`DEMO_PREVIEW_HISTORY`) — the frontend renders
  them whenever the API says `isDemoAccruedRent: true`, but they never touch
  `POST /api/contributions/checkout` or any database table. They're visually labeled
  "Demo data" and kept in their own card, never summed into a real total.
- **Real test payments get their own total.** Once a demo-sourced Checkout Session is
  actually paid (via the webhook, same as any other contribution), it shows up under
  "Test Stripe payments" — a real `contributions` row, real money in Stripe Test Mode
  — with its own running total (`GET /api/contributions` → `demoTestPaymentsCents`,
  `getDemoTestPaymentsCentsForUser()` in `src/lib/contributions.ts`). This is never
  combined with the fake preview total, and — outside of this dedicated demo
  breakdown — it's still included in the account's normal
  `totalContributedCents` (it's real money either way; only the *input* amount came
  from demo data).
- **Never grants Pro.** Unaffected by any of this — `settleContributionFromSession()`
  never touches `src/lib/subscriptions.ts` regardless of `is_demo_source`.

### Disabling it

Remove or set `ENABLE_SUPPORT_DEMO=false` (anything other than the exact string
`"true"` disables it) — or just deploy to production, where it's always off
regardless of the env file.

## Stripe Dashboard setup

1. **Webhook**: open the *existing* endpoint (the one already receiving
   `checkout.session.completed` etc. for Pro) and add the three new event types listed
   above. Do not create a new endpoint. On this deployment that's
   `https://dev.rentyourtime.atlashc.pl/api/webhook` for DEV.
2. No new Price objects are needed — contributions use `price_data` inline.
3. Nothing else changes: Customer Portal, `STRIPE_PRICE_ID_MONTHLY`/`_YEARLY`, and the
   subscription webhook branches are untouched.

## Testing locally

- `tests/lib/contributions.test.ts` — pure validation/amount-calculation and DB-layer
  unit tests (percentage allowlist, cent rounding, refund netting, PENDING exclusion).
- `tests/api/contributions.test.ts` — checkout validation (401, `invalid_percentage`,
  `accrued_rent_unavailable`, `amount_too_low`), history scoping, session-status
  ownership. Like the existing `/api/checkout` and `/api/billing/portal` routes, the
  success path that actually calls `stripe.checkout.sessions.create` isn't exercised
  here — this repo doesn't mock the Stripe SDK client, so those tests stop at the last
  branch reachable without a live Stripe call.
- `tests/api/contributions-webhook.test.ts` — full webhook settlement logic using
  `getStripe().webhooks.generateTestHeaderString()` to sign synthetic events, same
  pattern as `tests/api/webhook.test.ts`. Covers: paid, amount/currency/user mismatch
  refusal, duplicate-event idempotency, expired, async-failed, full and partial refund,
  and confirms a contribution never creates a `subscriptions` row.
- `tests/lib/supportDemo.test.ts` — the production kill switch, the `ENABLE_SUPPORT_DEMO`
  gate, and that real ledger data always outranks the demo fallback.
- `tests/api/contributions-demo.test.ts` — API-level precedence/serialization
  (`isDemoAccruedRent`, per-contribution `isDemo`, `demoTestPaymentsCents`) and webhook
  settlement of a demo-sourced contribution (still real, still no Pro) — no Stripe
  mocking, same conventions as the rest of the suite.
- `tests/api/contributions-checkout-demo.test.ts` — the one file in this suite that
  mocks `@/lib/stripe`'s `getStripe()`, specifically to assert the demo-triggered
  Checkout Session carries `metadata.source === "demo"` and the correct computed
  amount without a live network call. Every other test file still avoids mocking the
  Stripe SDK client (see below).
- For manual end-to-end testing against a live Stripe test-mode account: run
  `stripe listen --forward-to localhost:3000/api/webhook`, then either set
  `accrued_rent_cents` directly via SQL for a test user (`UPDATE users SET
  accrued_rent_cents = 2840 WHERE email = '...'`) or, more conveniently, set
  `ENABLE_SUPPORT_DEMO=true` (see "Development demo mode" above) so any account with
  no real ledger gets the same $28.40 figure automatically. Either way, use a
  [Stripe test card](https://stripe.com/docs/testing#cards) (e.g. `4242 4242 4242 4242`,
  any future expiry, any CVC) at Checkout.

## Known limitations

- No real accrued-rent source yet — see "The accrued-rent gap" above. The feature is
  fully wired but inert for every user until that's connected.
- Only `usd`/`eur`/`gbp` have a verified Stripe minimum-charge value; other currencies
  fall back to a conservative default that should be checked before use.
- The `charge.succeeded`/`payment_intent.succeeded` → `billing_records` linkage race
  described above is a narrowing of an existing, already-documented limitation, not a
  new one.
