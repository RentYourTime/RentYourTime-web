# Stripe

## Checkout — `POST /api/checkout`

Gated by `isProCheckoutEnabled()` in `src/lib/stripe.ts`: returns
`pro_checkout_disabled` (503) unless `ENABLE_PRO_CHECKOUT=true` is set — disabled by
default. This only stops *new* regular Pro sign-ups; it doesn't touch existing Pro
subscribers, the Customer Portal, Contributions, or the Founder Program, which are
separate flows with their own checkout routes. `GET /api/me` exposes the current
value as `pro_checkout_enabled` so the account page can show a proper disabled state
instead of a button that just errors; `/pricing`'s Pro card reads the same flag
server-side.

Bearer-authenticated, rate-limited (10 / 10 min / IP). Body: `{ "plan": "monthly" |
"yearly" }` (defaults to `yearly`).

- Resolves the Price ID from `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY`
  (yearly falls back to the legacy `STRIPE_PRICE_ID` if the yearly-specific var isn't
  set).
- **Validates the Price ID against Stripe** (`stripe.prices.retrieve`) before
  creating the session — a deleted/inactive/typo'd Price ID now fails fast with
  `server_not_configured` (503) instead of a confusing Stripe error at checkout time.
- Sets `client_reference_id`, `metadata.user_id`, `metadata.plan`, and mirrors the
  same on `subscription_data.metadata` so the resulting Subscription object carries
  `user_id`/`plan` too — the webhook relies on this as a fallback lookup.
- Reuses `users.stripe_customer_id` when present; otherwise passes `customer_email`
  and lets Stripe create the customer.
- `allow_promotion_codes: true`.

## Webhook — `POST /api/webhook`

**This is the one and only Stripe webhook endpoint** — don't create a second one, and
don't change this path; it's already configured in the Stripe Dashboard for any
existing deployment.

Point Stripe's webhook at `https://<domain>/api/webhook` and subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.created`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.voided`
- `charge.succeeded`
- `charge.refunded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

If you're updating an existing Dashboard webhook, add whichever of these aren't
already selected to the **existing** endpoint's event list — never create a second
endpoint. The `invoice.*`/`charge.*`/`payment_intent.*` events populate billing
history (`billing_records`) — see [`docs/BILLING_PORTAL.md`](./BILLING_PORTAL.md)
for what each one does and why payment-id linkage is best-effort in the pinned API
version. The three `checkout.session.*` events beyond `completed` — plus the
`checkout.session.completed`/`charge.refunded` branches when their metadata says
`kind: "contribution"` or `kind: "founder"` — belong to two separate one-time-payment
flows: "Support the project" ([`docs/CONTRIBUTIONS.md`](./CONTRIBUTIONS.md)) and the
Founder Program ([`docs/FOUNDER_PROGRAM.md`](./FOUNDER_PROGRAM.md)). No new event
types were needed for the Founder Program — it reuses this exact same list.

### How it works

- Signature verified with `STRIPE_WEBHOOK_SECRET` against the **raw** request body
  (`req.text()`, never `req.json()`).
- Idempotent: every event is checked against, then recorded into, `webhook_events`
  (keyed by Stripe's `event.id`) inside the **same SQL transaction** as the actual
  subscription update — an event is never marked processed unless the update it
  implies actually committed.
- Out-of-order protection: `customer.subscription.*` writes go through
  `upsertStripeSubscription()`, which only overwrites a row if the incoming event's
  `created` timestamp is `>=` what's stored.
- User mapping, in order: `metadata.user_id` → `client_reference_id` (checkout only)
  → lookup by `stripe_customer_id`.

### Event → field mapping

- `plan`: derived from `subscription.items.data[0].price.recurring.interval`
  (`month`/`year`) — not from matching against `STRIPE_PRICE_ID_*`, so it survives
  Stripe-side price rotation.
- `product_id` / `price_id`: from the same first subscription item.
- `auto_renew`: `!subscription.cancel_at_period_end`.
- `started_at` / `canceled_at` / `trial_ends_at`: from `start_date` / `canceled_at` /
  `trial_end`.
- `environment`: `event.livemode ? "live" : "test"`.
- `invoice.payment_failed` / `invoice.paid`: **not** authoritative for status —
  `customer.subscription.*` is. These two only provide a fast defensive transition:
  a failed invoice moves a non-terminal subscription to `past_due`; a subsequent paid
  invoice recovers it from `past_due` back to `active`. This avoids two competing
  sources of truth for `status`.
- `charge.refunded`: only a **full** refund (`charge.refunded === true`) marks the
  subscription `refunded`; partial refunds (e.g. goodwill credits) leave status
  untouched. Correlated by `charge.customer`, not by invoice — this account only
  creates subscription-mode Checkout charges once Contributions and Founder Program
  purchases are excluded (checked first, by `payment_intent`), so every remaining
  charge against a customer with a subscription row belongs to that subscription. If
  this product ever sells anything else through Stripe, this correlation needs to
  become invoice-based.

### A real bug this fixes

`current_period_end` moved off the top-level `Subscription` object onto each
subscription **item** in newer Stripe API versions (confirmed against the installed
`stripe` package's `2025-08-27.basil` types — `Subscriptions.d.ts` has no
`current_period_end` field at all anymore). The old code read it via an unsafe cast
that could silently resolve to `undefined`. `getStripe()` now pins
`apiVersion: "2025-08-27.basil"` explicitly, and `resolveCurrentPeriodEnd()` in
`src/lib/stripe.ts` reads the top-level field if present (older API versions) and
falls back to `items.data[0].current_period_end` otherwise. Same treatment for
`Invoice.subscription`, which moved to
`invoice.parent.subscription_details.subscription`.

## Testing webhooks locally

`getStripe().webhooks.generateTestHeaderString({ payload, secret })` produces a valid
`stripe-signature` header without any network call — see `tests/api/webhook.test.ts`
for the pattern used in the automated suite. For manual testing against a live
account, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhook`.
