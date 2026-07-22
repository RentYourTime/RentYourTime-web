# RentYourTime — Discord beta bot

A small Discord bot that collects **beta-tester emails** and stores them in the
same SQLite database as the web app (table `beta_testers`), so everything lives
in one place.

## How members use it

- `/beta` or `/register` — opens a private popup to enter an email (email is **never** shown in chat).
- A **"Join the beta"** button panel — post it once with `/beta-setup`; anyone can click it.

Both open the same private modal and reply **only to that user** (ephemeral).

## Get DMed about new signups

Set `DISCORD_OWNER_ID` to your own Discord user ID and the bot will **DM you the
email of every new person** — both from the Discord `/beta` command **and from the
website waitlist form**. Duplicates and pre-existing signups don't notify.

The website form and the bot are separate processes; they share one SQLite
database. The bot polls the `waitlist` table every ~20s and DMs you about rows it
hasn't announced yet (tracked via a `notified` flag), so nothing is missed or sent twice.
The DM includes the email, source, signup date, and running total
(`bot/waitlist-notifier.js`).

A row is only marked as announced once the DM **actually sends** — if your DMs are
closed or the bot doesn't share a server with you, it keeps retrying on later polls
(with a 5-minute cooldown per row, so it doesn't hammer Discord's API) instead of
silently giving up. See `docs/WAITLIST.md` for the full diagnostic checklist if
notifications stop arriving.

The website also emails the owner directly (AWS SES) when `WAITLIST_NOTIFY_EMAIL`
is set in the **main app's** `.env` — that's independent of this Discord path and
documented in `docs/WAITLIST.md`, not here.

Enable Developer Mode → right-click your name → **Copy User ID**. You must share
a server with the bot and allow DMs from server members. Leave it empty to disable.

## Admin commands (require *Manage Server*)

- `/beta-setup` — post the sign-up button panel in the current channel.
- `/beta-count` — how many people signed up.
- `/beta-export` — download all collected emails as a CSV.

## Create the bot (Discord Developer Portal)

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. **Bot** tab → **Reset Token** → copy it → `DISCORD_TOKEN`.
3. **General Information** → copy **Application ID** → `DISCORD_CLIENT_ID`.
4. Invite the bot to your server — **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Attach Files`
   - Open the generated URL and add it to your server.
5. In Discord, enable **Developer Mode** (User Settings → Advanced), right-click
   your server → **Copy Server ID** → `DISCORD_GUILD_ID`.

No privileged intents are needed (the bot never reads message content).

## Run

```bash
cd bot
npm install
cp .env.example .env      # fill in the three Discord values
npm run register          # register slash commands (run once, and after changes)
npm run start             # start the bot
```

Then in your server run `/beta-setup` to post the button, or just use `/beta`.

> `DATA_DIR` must point at the **same** directory as the web app so emails share
> one database. It defaults to `../.data` (correct when the bot sits next to the
> app). In production set both to the same absolute path (e.g. `/var/lib/rentyourtime`).

## Run in production (systemd)

On the same server as the app (`/var/www/rentyourtime`):

```bash
cd /var/www/rentyourtime/bot
npm install
cp .env.example .env && nano .env      # set token, client id, guild id, DATA_DIR=/var/lib/rentyourtime
npm run register
```

Create `/etc/systemd/system/rentyourtime-bot.service`:

```ini
[Unit]
Description=RentYourTime Discord beta bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/rentyourtime/bot
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rentyourtime-bot
journalctl -u rentyourtime-bot -f
```

## Where the emails go

Table `beta_testers` in `<DATA_DIR>/rentyourtime.sqlite`:

| column | meaning |
| --- | --- |
| `email` | the tester's email (unique, case-insensitive) |
| `discord_id` | who submitted it |
| `discord_username` | their Discord username |
| `created_at` | ISO timestamp |

Inspect from the shell:

```bash
sqlite3 /var/lib/rentyourtime/rentyourtime.sqlite \
  "SELECT email, discord_username, created_at FROM beta_testers ORDER BY created_at;"
```
