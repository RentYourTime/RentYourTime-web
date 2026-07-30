# iOS API Integration

Guidance for the `RentYourTime` iOS app (separate repository, **not modified by this
pass**) integrating with the central API. The contract is
[`docs/openapi.yaml`](./openapi.yaml); this document is the narrative version.

## Base URL

One constant, driven by build configuration — never hardcoded per call site:

```swift
enum APIEnvironment {
    static let baseURL: URL = {
        #if DEBUG
        return URL(string: "https://dev.rentyourtime.atlashc.pl/api/v1")!
        #else
        return URL(string: "https://api.rentyourtime.app/api/v1")!
        #endif
    }()
}
```

## Auth

1. `POST /auth/register` or `POST /auth/login` with `platform: "IOS"`. Response:
   `{ user, session: { accessToken, refreshToken, accessTokenExpiresAt } }`.
2. Store `refreshToken` in the **Keychain** (`kSecAttrAccessibleAfterFirstUnlock` or
   stricter) — never `UserDefaults`, never on disk unencrypted. `accessToken` can live
   in memory only; it's cheap to re-derive via refresh and expires in 15-60 minutes
   anyway.
3. Attach `Authorization: Bearer <accessToken>` to every subsequent `/api/v1` request.
4. On `401 TOKEN_EXPIRED`, call `POST /auth/refresh` with the stored `refreshToken`,
   replace both stored tokens with the response, and retry the original request once.
   On `401 TOKEN_REUSE_DETECTED` or `TOKEN_INVALID` from refresh itself, clear all
   stored tokens and force the user back to login — this indicates the session (or its
   whole token family) was revoked server-side, most commonly because the same refresh
   token was presented twice (see [`docs/AUTH_FLOW.md`](./AUTH_FLOW.md#refresh-rotation--reuse-detection)).
5. Immediately after first login/register, call `POST /devices/register` with
   `installationId` (a client-generated stable UUID — `identifierForVendor`-derived is
   fine, **never** IDFA), `platform: "IOS"`, `deviceName`, `systemVersion`, `appVersion`.
   This binds the device to the session that just logged in, which `DELETE /devices/:id`
   later needs to revoke the right sessions.

### Codable models

```swift
struct SessionResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let accessTokenExpiresAt: Date // ISO-8601 — configure JSONDecoder.dateDecodingStrategy = .iso8601
}

struct AuthUser: Codable {
    let id: String
    let email: String
    let displayName: String?
    let emailVerified: Bool
    let role: String
}

struct APIEnvelope<T: Decodable>: Decodable {
    let data: T
    let meta: Meta
    struct Meta: Decodable { let requestId: String }
}

struct APIErrorEnvelope: Decodable {
    let error: APIError
    let meta: APIEnvelope<Int>.Meta // reuse Meta's shape
    struct APIError: Decodable {
        let code: String
        let message: String
        let fields: [String: String]?
    }
}
```

Every response is `{ data, meta }` or `{ error, meta }` — decode `data`/`error`
depending on the HTTP status class, never assume the field is present unconditionally.

## Entitlements

`GET /subscription/status` after every launch and after returning to the app from
background (not on every screen — cache for the session, refresh on
`applicationDidBecomeActive`). Never derive `isPro` locally from a StoreKit transaction
— always defer to this endpoint, which is the merged view across Stripe/Apple/Founder
(see [`docs/ENTITLEMENTS.md`](./ENTITLEMENTS.md)).

## Usage sync

Aggregate locally (e.g. via Screen Time / `DeviceActivity`, batched once per day or on
app foreground), then:

```json
POST /usage/daily
{
  "date": "2026-07-30",
  "deviceId": "device_...",
  "totalSeconds": 17400,
  "freeSeconds": 10800,
  "billableSeconds": 6600,
  "virtualRentAmountMinor": 1833,
  "currency": "USD",
  "goalMet": false,
  "version": 1,
  "updatedAt": "2026-07-30T20:30:00Z"
}
```

For multiple pending days (e.g. after being offline), use `POST /usage/daily/batch`
with `{ "records": [...] }` (max 100/request) instead of one call per day. Set an
`Idempotency-Key` header (a UUID generated once per sync attempt, reused only on retry
of that exact attempt) so a network retry after a dropped response never double-applies
— see [`docs/API_ENDPOINTS.md#apiv1usage`](./API_ENDPOINTS.md#apiv1usage). Never send raw
per-app FamilyControls tokens or per-app breakdowns — totals only.

## Push

`POST /push/register` with `{ deviceId, pushToken, pushEnvironment: "sandbox" | "production" }`
right after obtaining an APNs token (and again whenever it rotates). `DELETE
/push/current` on logout/notification opt-out.

## Config / feature flags / force-upgrade

`GET /config?appVersion=1.2.0` (no auth required, but send the Bearer token if the user
is logged in for personalized `features`/`founderEarlyAccess`) on launch. Respect
`maintenance` (show a blocking screen), `minimumAppVersion` (block launch, deep-link to
the App Store) and `latestAppVersion` (soft "update available" banner).

## Status of this integration in this pass

This pass ships the server-side contract only. The `RentYourTime` iOS repository is
explicitly out of scope (per the brief) and was not touched — the guidance above is
what its next update needs to implement.
