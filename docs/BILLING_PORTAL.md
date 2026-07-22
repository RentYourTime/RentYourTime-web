# Billing history + Stripe Customer Portal

## Identifiers, disambiguated

The account panel surfaces several different Stripe identifiers. It's easy to
confuse them:

| ID | Looks like | What it identifies | Where it lives |
| --- | --- | --- | --- |
| **User ID** | 32-char hex | Your internal account row (`users.id`) | Ours, not Stripe's |
| **Subscription ID** | `sub_...` | One Stripe Subscription (recurring billing) | `subscriptions.provider_subscription_id` |
| **Invoice ID** | `in_...` | One bill for a billing period | `billing_records.provider_invoice_id` |
| **Payment Intent ID** | `pi_...` | One attempt to collect payment for an invoice | `billing_records.provider_payment_intent_id` |
| **Charge ID** | `ch_...` | The actual card/bank charge behind a successful Payment Intent | `billing_records.provider_payment_id` |

A subscription has many invoices over its lifetime (one per billing cycle); an
invoice has at most one successful Payment Intent, which has at most one
Charge. `stripe_customer_id` is deliberately **not** in this table — it's
never shown to the user (see `docs/AUTH.md`).

## `billing_records` migration

New table, not an `ALTER` on anything existing — see `src/lib/db.ts`. Safe on a
running production database: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF
NOT EXISTS` are both no-ops if already applied, and nothing is dropped or
rewritten. One row per Stripe invoice, upserted by `provider_invoice_id`.
Starts empty on an existing deployment — there is no backfill of historical
Stripe invoices; the table fills in from the first webhook event after
deploy. Indexes: `user_id` (the list endpoint's main filter),
`provider_subscription_id`, `provider_payment_intent_id`, `created_at`
(ordering).

## Why payment linkage is best-effort

Checked directly against the installed `stripe` package's types
(`node_modules/stripe/types`, pinned `apiVersion: "2025-08-27.basil"` in
`src/lib/stripe.ts`):

- `Stripe.Invoice` has **no top-level `payment_intent` field** in this API
  version. Payment linkage moved to `invoice.payments: ApiList<InvoicePayment>`
  — a field that's only populated when explicitly expanded, which a normal
  webhook payload doesn't do.
- `Stripe.Charge` and `Stripe.PaymentIntent` have **no `invoice` field** in
  this API version either.

So there is no reliable way to go from a `charge.succeeded` /
`payment_intent.succeeded` event straight to "which invoice". Design:

- `invoice.*` events (`created`, `finalized`, `paid`, `payment_failed`,
  `voided`) are the reliable source for a `billing_records` row — full
  amounts, status, links, everything except payment linkage.
- `charge.succeeded` / `payment_intent.succeeded` events **enrich** the most
  recent row for that customer that's still missing the corresponding id
  (`attachPaymentToInvoice` in `src/lib/billing.ts`). If the invoice event
  hasn't landed yet, it's a no-op — the invoice event will still produce a
  correct row, just without a payment id attached retroactively.
- `charge.refunded` (full refund only) marks the customer's most recent
  non-refunded row `refunded` (`markMostRecentInvoiceRefunded`) — same
  by-customer correlation technique already used for
  `subscriptions.status` in the base webhook (see `docs/STRIPE.md`).

This only affects the two optional "Payment ID"/"Payment Intent ID" fields
shown for copying — invoice status, amounts, and links are always accurate
from the invoice events directly.

## Endpoints

- **`GET /api/billing/invoices`** — Bearer required, 60 req/min/user.
  `?limit=` (default 20, max 100) and `?offset=` (default 0). Always scoped
  to `currentUser(req).id` — there is no `userId` parameter, and none is
  accepted even if sent.
- **`GET /api/billing/invoices/[invoiceId]`** — `invoiceId` is the **local**
  `billing_records.id`, not Stripe's `in_...` — this keeps the identifier
  opaque and lets the ownership check be a single `WHERE id = ? AND user_id
  = ?` query. Missing or someone else's invoice → **404** in both cases (no
  way to distinguish "doesn't exist" from "not yours" from the response).
  If `hosted_invoice_url`/`invoice_pdf_url` is missing, this endpoint makes
  one best-effort `stripe.invoices.retrieve()` call, checks the invoice's
  `customer` matches the caller's `stripe_customer_id`, and persists the
  refreshed links — errors here are swallowed (logged, never surfaced) since
  it's a nice-to-have, not the primary functionality.
- **`POST /api/billing/portal`** — Bearer required, 10 req/10min/user. No
  `stripe_customer_id` on the account → **400** `customer_not_found` (this
  means "you've never checked out," not a server error). Otherwise creates a
  Stripe Billing Portal session with `return_url = APP_URL/account` and
  returns `{ portal_url }`.

## Stripe Customer Portal setup

1. Stripe Dashboard → **Settings → Billing → Customer portal**.
2. Enable at least "Update payment method" and "Cancel subscription" (match
   whatever self-service you want customers to have — this app doesn't
   configure portal features itself, that's entirely Dashboard-side).
3. No new env var — `POST /api/billing/portal` only needs the existing
   `STRIPE_SECRET_KEY` and `APP_URL`.
4. The "Manage subscription" button only renders when
   `subscription.source === "STRIPE"` — Apple and Manual subscriptions never
   see it (Apple gets a message pointing to Apple ID settings instead; see
   `docs/APPLE_SUBSCRIPTIONS.md`).

## Webhook events required

Add these to the **existing** `/api/webhook` endpoint in the Stripe
Dashboard (do not create a second webhook):

- `invoice.created`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.voided`
- `charge.succeeded`
- `charge.refunded`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

(Plus the events already required for subscription state — see
`docs/STRIPE.md` for the full list.)
