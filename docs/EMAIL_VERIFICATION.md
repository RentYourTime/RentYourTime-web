# Email verification

## Flow

1. `POST /api/register` creates the user (`email_verified = 0`), then calls
   `createEmailVerificationToken()` and `sendVerificationEmail()`. A send failure
   is caught and logged (never with the token/URL itself) — **registration always
   succeeds** as long as the account was created; `verification_email_sent: false`
   tells the client to expect no email and offer a resend.
2. The email links to `${APP_URL}/verify?token=<raw token>`.
3. `/verify` (`src/app/verify/page.tsx` + `src/components/VerifyClient.tsx`) POSTs
   the token to `POST /api/verify-email`, shows a state (verifying / verified /
   already verified / invalid or expired / missing token / error), and always
   strips the token from the address bar via `history.replaceState` once the
   request settles — regardless of outcome.
4. `POST /api/resend-verification` (Bearer-authenticated, 3/hour/user) issues a
   fresh token and invalidates the previous one. Response is identical whether the
   account was already verified, the send succeeded, or it silently failed — the
   endpoint never reveals which.

## Tokens

`src/lib/email-verification.ts` — same technique as the existing Bearer session
tokens in `src/lib/auth.ts`: `randomBytes(32).toString("hex")` (256 bits), only
`sha256()` of it stored (reusing `auth.ts`'s exported `sha256`), 24-hour expiry,
single use. The `email_verification_tokens` table only has `used_at` (no separate
"revoked" column), so invalidating a still-valid token and consuming it on
successful verification are the same operation — both just set `used_at`.
Verification and setting `users.email_verified = 1` happen in one SQLite
transaction (`verifyEmailToken`), so a token is never marked used without the
flag actually being set, and vice versa.

A malformed token (wrong length/charset) is rejected by a regex check before any
database query runs. An unknown, expired, or already-used token all return the
same `invalid_or_expired_token` (400) — the endpoint never reveals which case it
was. A structurally valid, unexpired, unused token whose owner is *already*
verified (e.g. a resend raced a successful verification) returns
`email_already_verified` (409) instead.

## AWS SES v2

`src/lib/email.ts` — `@aws-sdk/client-sesv2`, `SendEmailCommand` with
`Content.Simple` (both HTML and text bodies). No explicit `credentials` are
passed to `SESv2Client` — the SDK's default provider chain resolves them:
environment variables when `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are set,
otherwise the EC2/ECS instance's attached IAM role automatically. `AWS_REGION` is
a standard AWS SDK environment variable name and is read the same way.

`sendVerificationEmail()` throws on failure (a normal AWS SDK error) — callers
(`register`, `resend-verification`) catch it, log only the error message (never
the token, verification URL, or full AWS error payload), and degrade gracefully.

### Required IAM permission

The credential (user or role) needs at minimum:

```json
{
  "Effect": "Allow",
  "Action": "ses:SendEmail",
  "Resource": "*"
}
```

### Domain verification (SPF / DKIM / DMARC)

1. SES Console → **Verified identities** → **Create identity** → Domain →
   enter your sending domain (e.g. `rentyourtime.app`, or a subdomain like
   `dev.rentyourtime.atlashc.pl` for a dev/staging `EMAIL_FROM`).
2. Enable **Easy DKIM** — SES gives you 3 CNAME records; add them at your DNS
   provider. This is what actually signs outgoing mail (DKIM).
3. Add an SPF record authorizing SES to send for the domain:
   ```
   TXT  @  "v=spf1 include:amazonses.com ~all"
   ```
   (merge with any existing SPF record — a domain can only have one.)
4. Add a DMARC record once SPF/DKIM are passing reliably:
   ```
   TXT  _dmarc  "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@your-domain.com"
   ```
   Start with `p=none` (monitor only) if you want to observe reports before
   enforcing; move to `p=quarantine` or `p=reject` once confident.
5. Wait for DNS propagation, then confirm "Verified" status in the SES console.

### Sandbox vs Production Access

New SES accounts start in **Sandbox mode**: you can only send to addresses you've
individually verified, and volume is capped. To send to real, unverified
recipients (i.e. actual users registering), you must request **Production
Access**: SES Console → **Account dashboard** → **Request production access** —
describe the use case (transactional account-verification email), expected
volume, and how you handle bounces/complaints. Approval typically takes a few
hours to a day. Until then, verify your own test addresses individually under
**Verified identities** to test the full flow end-to-end.

## Required environment variables

```
AWS_REGION=eu-central-1
# Optional — omit on EC2/ECS with an IAM role attached; the SDK falls back
# to the instance's default credential chain automatically.
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
EMAIL_FROM=RentYourTime <no-reply@your-domain.com>
# Optional.
EMAIL_REPLY_TO=
```

Reuses the existing `APP_URL` (verification link base) — no new variable needed
for that.

## Local / automated testing

Never send real email in tests. `tests/api/email-verification.test.ts` mocks the
entire `@/lib/email` module (`vi.mock("@/lib/email", ...)`) so no AWS SDK call
ever happens; the mock captures each call's `verificationUrl` argument, which is
the *only* place a raw token is ever observable outside the user's inbox —
exactly mirroring the production constraint that the API never returns it. To
exercise the flow manually without a real SES setup, temporarily log
`verificationUrl` in `register`'s catch-free path in a local `.env` (never commit
this) or point `EMAIL_FROM` at an SES sandbox-verified address and check your
own inbox.

## Resending

`POST /api/resend-verification` (Bearer) is rate-limited to 3 requests/hour/user
(`rateLimit(req, "resend_verification", 3, 3600, user.id)`, the same per-user
variant already used by `billing/portal` and `subscriptions/apple/sync`). The
response is always `{ ok: true, message: "If verification is still required, a
new email has been sent." }` — identical whether the account was already
verified or the send failed, so the client never has to special-case either.
The account panel (`AccountOverview.tsx`) shows a warning banner with a "Resend
verification email" button whenever `email_verified` is `false`.
