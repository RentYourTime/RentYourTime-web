# Waitlist

## Flow

1. `POST /api/waitlist` (`src/app/api/waitlist/route.ts`) validates the email,
   checks the honeypot, rate-limits (20/h/IP), and does an atomic
   `INSERT ... ON CONFLICT(email) DO NOTHING` (`insertWaitlistSignup` in
   `src/lib/waitlist.ts`) — `source='WEBSITE'`, `status='NEW'`, IP stored as a
   SHA-256 hash, not raw.
2. The response is always `{ ok: true, message: "You're on the list.", count }`
   — whether the address was new or already on the list is never disclosed.
3. Only for a genuine new signup, **after** the response is built (never
   awaited — a slow or failing send must not delay or fail the user's
   request), two independent emails are attempted:
   - a confirmation to the user (`sendWaitlistConfirmationEmail`) — sets
     `confirmation_sent = 1` only once SES confirms the send;
   - if `WAITLIST_NOTIFY_EMAIL` is set, a notification to the owner
     (`sendWaitlistOwnerNotificationEmail`) — sets `owner_email_notified = 1`
     the same way.
   Each is independent: one failing doesn't affect the other, and neither is
   ever logged with the actual email address (only the row `id` on failure).
4. Separately, the Discord bot (`bot/index.js`, `bot/waitlist-notifier.js`)
   polls the same `waitlist` table every 20s for `notified = 0` rows and DMs
   `DISCORD_OWNER_ID`. This is fully decoupled from the HTTP request — the
   signup never depends on Discord being configured, reachable, or even
   running.

## Why the owner might not have been getting notified (fixed here)

- **Email:** previously `WAITLIST_NOTIFY_EMAIL` only triggered a
  `console.info` — no email was ever actually sent. Now it uses the AWS SES
  infrastructure already set up for email verification
  (`docs/EMAIL_VERIFICATION.md`).
- **Discord:** the old poller marked a row `notified = 1` **even when the DM
  failed** (closed DMs, no shared server, a Discord hiccup) — so a failure
  silently stopped all future notifications for that signup, forever.
  `bot/waitlist-notifier.js` now only marks a row notified when the DM
  actually sends, and retries on the next poll (with a 5-minute per-row
  cooldown so a permanently-unreachable owner doesn't hammer Discord's API).

## Discord configuration

Set `DISCORD_OWNER_ID` in **`bot/.env`** (not the main app's `.env` — that's
the process that reads it) to your Discord user ID. You must share a server
with the bot and allow DMs from server members. See `bot/README.md` for the
full bot setup.

## Email configuration

Reuses the AWS SES setup from `docs/EMAIL_VERIFICATION.md` — same
`AWS_REGION`/`EMAIL_FROM`/(optional `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`)
in the main app's `.env`. Set `WAITLIST_NOTIFY_EMAIL` to the address that
should receive new-signup notifications; leave it empty to disable owner
emails (the Discord DM path is independent and still works either way).

## `DATA_DIR` for the website and the bot

Both processes must point at the **same** SQLite file — see
`bot/README.md` and `DEPLOY_AWS.md`. In production, set `DATA_DIR` to the
same absolute path in both the app's `.env` and `bot/.env`
(e.g. `/var/lib/rentyourtime`).

## Running the bot as systemd

Already documented in `bot/README.md` (`rentyourtime-bot.service`) — nothing
about this change requires a different setup. Redeploy and restart the
service as usual after pulling this update.

## Granting the `ADMIN` role

Nothing ever grants `ADMIN` automatically — not even a matching
`ADMIN_ACCOUNT_EMAIL`, which exists purely as an input to the manual steps
below, never read by any request-handling code.

**Option A — raw SQL**, after the person has registered a normal account:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'owner@example.com';
```

```bash
sqlite3 /var/lib/rentyourtime/rentyourtime.sqlite \
  "UPDATE users SET role = 'ADMIN' WHERE email = 'owner@example.com';"
```

**Option B — the bootstrap script** (`scripts/grant-admin.mjs`):

```bash
npm run admin:grant -- owner@example.com
# or
ADMIN_ACCOUNT_EMAIL=owner@example.com npm run admin:grant
```

It resolves the same `DATA_DIR` as the app and the bot, fails clearly if the
account doesn't exist yet (they must register first), and is a no-op if
they're already `ADMIN`.

## Admin panel

`/admin/waitlist` — client-side gated (this app has no server sessions, only
Bearer tokens in `sessionStorage`, same as `/account`): checks `GET /api/me`'s
`role`, redirects to `/account` if missing or not `ADMIN`. Backing API:
`GET /api/admin/waitlist` (list + stats, `search`/`source`/`status` filters,
`limit`/`offset`), `PATCH /api/admin/waitlist/[id]` (only `status`, `notes`,
`contacted_at` are ever writable), `GET /api/admin/waitlist/export` (CSV,
excludes `ip`/`user_agent`). All three require `requireAdmin()`
(`src/lib/auth.ts`) — 401 with no token, 403 for a non-`ADMIN` role, read only
from the `users` row, never from anything the client sends.

## Diagnosing "the owner still isn't getting notified"

**Discord:**
- Is `bot/index.js` actually running? (`systemctl status rentyourtime-bot` in
  production, or check the `bot` process in `npm run dev`'s output locally.)
- Is `DISCORD_OWNER_ID` set in `bot/.env`? Missing → the bot logs
  `[bot] DISCORD_OWNER_ID not set — DM notifications disabled.` once at
  startup and never polls at all.
- Does the owner share a server with the bot, and do they allow DMs from
  server members? A closed-DM owner shows up as
  `Could not DM owner: ...` in the bot's logs — the row will keep retrying
  every ~20s (past the 5-minute cooldown) until this is fixed.
- Do `DATA_DIR` in `bot/.env` and the main app's `.env` point at the exact
  same directory? If not, the bot is polling an empty/different database.

**Email:**
- Is `WAITLIST_NOTIFY_EMAIL` set in the main app's `.env`? Empty → owner
  emails are skipped entirely (Discord is unaffected).
- Check the app's logs for `[waitlist] owner notification email failed for
  signup <id>: ...` — the message names the AWS/SES error, never the email
  address or content.
- Is the SES account still in **Sandbox**? It can only send to individually
  verified addresses until Production Access is granted — see
  `docs/EMAIL_VERIFICATION.md`.
- Is `EMAIL_FROM`'s domain verified in SES with passing DKIM?
