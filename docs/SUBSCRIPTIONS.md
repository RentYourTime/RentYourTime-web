# Subscriptions / Pro entitlement

[`src/lib/subscriptions.ts`](../src/lib/subscriptions.ts) is the **single source of
truth** for whether a user has Pro. Nothing else — no route, no component — should
compute Pro status itself; everything reads it from here.

## Table shape

One row per user (`subscriptions.user_id` is the primary key), extended with:

| Column | Meaning |
| --- | --- |
| `source` | `STRIPE` \| `APPLE` \| `MANUAL` \| `NONE` (default `STRIPE`) |
| `provider_customer_id` / `provider_subscription_id` | Generalized versions of the legacy `stripe_customer_id`(on `users`) / `stripe_subscription_id` columns. Both are still written for Stripe rows — nothing that reads the old columns breaks. |
| `product_id` / `price_id` | Stripe Price/Product IDs, or the Apple product id. |
| `plan` | `MONTHLY` \| `YEARLY` \| `UNKNOWN` |
| `started_at` / `canceled_at` / `trial_ends_at` | ISO timestamps, nullable |
| `auto_renew` | `0`/`1` — inverse of Stripe's `cancel_at_period_end` |
| `original_transaction_id` | Apple-specific, mirrors `users.apple_original_transaction_id` |
| `environment` | `live`/`test` (Stripe) or `Sandbox`/`Production` mapped to the same |
| `last_provider_event_id` | Last webhook/event id that touched this row |

**One subscription per user, one provider at a time.** If a user somehow has both an
active Stripe subscription and starts an Apple purchase, the row is overwritten by
whichever provider's event lands last — there's no multi-provider merge. This matches
the product today (a user buys Pro through exactly one channel); revisit if that ever
changes.

**No SQL `CHECK` constraint** on `status`/`source` — SQLite would require rebuilding
the whole table to add one, which is riskier than it's worth on a live database.
Valid values are enforced in application code (`subscriptionGrantsPro`, the
`upsert*Subscription` callers) instead of the schema.

## Entitlement rule (`subscriptionGrantsPro`)

Pro is granted only if **all** of:
1. A subscription row exists.
2. `status` is `active` or `trialing`.
3. `current_period_end` is either unset (`NULL`) or strictly in the future.

`canceled`, `expired`, `refunded`, `past_due`, and `inactive` never grant Pro, even if
`current_period_end` hasn't passed yet — once the provider reports one of those
statuses, we trust it immediately rather than waiting out the stored period end.

## Public shape (`serializeSubscription`)

Shared verbatim by `GET /api/me` (`user.subscription`) and
`GET /api/subscriptions/status` (`subscription`):

```json
{
  "is_pro": true,
  "source": "STRIPE",
  "status": "active",
  "plan": "YEARLY",
  "product_id": "prod_...",
  "price_id": "price_...",
  "current_period_end": 1784678399,
  "auto_renew": true
}
```

No Stripe customer/subscription ID is ever included in this shape — the frontend
never needs them, and they aren't meaningful to a user.

## Known limitations

- Subscription rows written before this migration show `plan = 'UNKNOWN'` until the
  next `customer.subscription.*` webhook refreshes them (renewal, plan change, or a
  manual Stripe Dashboard nudge). There is no backfill script — running one would
  require live Stripe credentials at migration time, which wasn't requested.
- `upsertAppleSubscription` is fully implemented and unit-tested, but has no real
  caller yet — see [`APPLE_SUBSCRIPTIONS.md`](./APPLE_SUBSCRIPTIONS.md).
