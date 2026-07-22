# Apple App Store subscriptions — scaffolding only

**Nothing in this integration is functional yet.** This document exists so nobody
mistakes the presence of these files/endpoints for a working Apple integration.

## What exists

- `src/lib/apple-subscriptions.ts` — types (`AppleDecodedTransaction`,
  `AppleDecodedRenewalInfo`, `AppleNotificationType`), config helpers, and
  `mapAppleTransactionToSubscription()` (a pure mapping function, ready to use).
- `POST /api/subscriptions/apple/sync` — Bearer-authenticated, rate-limited
  (10 / 10 min / **user**, not IP). Accepts
  `{ signedTransactionInfo, signedRenewalInfo? }`.
- `POST /api/webhooks/apple` — structural placeholder for App Store Server
  Notifications V2.
- `upsertAppleSubscription()` in `src/lib/subscriptions.ts` — fully implemented and
  unit-tested, writes a `source = 'APPLE'` row exactly like the Stripe path does.

## What does NOT exist

**Real JWS signature verification.** `verifyAndDecodeTransaction()` and
`verifyAndDecodeRenewalInfo()` in `apple-subscriptions.ts` always throw:

- `AppleConfigError` (→ **503** `server_not_configured`) if `APPLE_ISSUER_ID`,
  `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, or `APPLE_BUNDLE_ID` are missing.
- `AppleVerificationNotImplementedError` (→ **501** `not_implemented`) otherwise.

Neither function decodes or trusts the payload in any way. This is intentional, not
an oversight: verifying an Apple signed transaction means validating the `x5c`
certificate chain in the JWS header against Apple's root CA — that requires
integrating Apple's App Store Server Library (or reimplementing it) and is real,
non-trivial work. **Do not build a verifier that just returns `true`** — that would
let anyone grant themselves Pro by POSTing a fabricated payload.

`POST /api/webhooks/apple` reads and discards the request body without parsing it,
and always returns 501. **Do not register this URL in App Store Connect** until
verification is implemented — Apple will retry a non-2xx response for a while and
then give up, which is the correct behavior for an endpoint that isn't live yet.

## Finishing this integration (future work)

1. Implement real verification in `verifyAndDecodeTransaction` /
   `verifyAndDecodeRenewalInfo` (Apple's App Store Server Library, or manual JWS +
   x5c chain validation against Apple's root certificates).
2. Wire `POST /api/subscriptions/apple/sync` to call
   `mapAppleTransactionToSubscription()` and `upsertAppleSubscription()` once
   verification succeeds — the plumbing already exists, only the `throw` needs to be
   replaced with real decoded data.
3. Implement the `POST /api/webhooks/apple` switch over `notificationType`
   (`AppleNotificationType` in `apple-subscriptions.ts` documents the mapping this
   was designed for: `SUBSCRIBED`/`DID_RENEW` → `active`, `DID_FAIL_TO_RENEW` →
   `past_due`, `EXPIRED`/`GRACE_PERIOD_EXPIRED` → `expired`, `REFUND` → `refunded`,
   `REVOKE` → `canceled`).
4. Only then register the webhook URL in App Store Connect and set `APPLE_ISSUER_ID`
   / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` / `APPLE_BUNDLE_ID` in production.

## Env vars

```
APPLE_BUNDLE_ID=com.rentyourtime.app
APPLE_ISSUER_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

All optional today — their absence just means `apple/sync` returns 503 instead of
501. Never commit real values; see `.env.example`.
