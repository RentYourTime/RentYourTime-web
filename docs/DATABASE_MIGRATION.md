# Database Migration — SQLite → PostgreSQL (plan only)

**Nothing in this document has been executed.** SQLite via `better-sqlite3` remains the
active, authoritative database (see [`docs/AUDIT.md`](./AUDIT.md) — "SQLite i
PostgreSQL"). This is the plan for when a future pass actually performs the move,
written now so that decision is safe to make later without re-deriving it from scratch.

## Why not now

- The brief (§6) explicitly says: keep SQLite working, don't perform a destructive
  migration, don't add an ORM "for aesthetics."
- `better-sqlite3` is synchronous, single-file, single-writer — fine for the current
  deployment (one long-running Node process, one VPS/container, WAL mode). A move to
  Postgres is a scaling/operational decision (multi-instance writes, managed backups,
  read replicas), not something this pass has the operational context (target Postgres
  instance, connection pooling strategy, hosting) to actually carry out safely.

## Current data-access shape

All access already goes through `src/lib/db.ts`'s single `getDb()` connection and
hand-written `better-sqlite3` prepared statements in `src/lib/*.ts` / `src/server/**`
"repository-shaped" modules (`registerDevice`, `getUserAccess`, `upsertDailyUsage`, ...
— see [`docs/API_ARCHITECTURE.md`](./API_ARCHITECTURE.md#directory-layout)). This is
already the "repositories/adapters instead of an ORM" shape the brief asks for (§6) —
raw SQL is not scattered across route handlers, it's confined to these modules. That
containment is what makes a future engine swap tractable: only these modules would need
a Postgres-flavored rewrite (parameter placeholders `?` → `$1`, `INTEGER` booleans →
`BOOLEAN`, `TEXT` timestamps → `TIMESTAMPTZ`, `db.transaction(fn)` → a pg transaction
wrapper), not the route handlers or the `src/emails`/UI layers above them.

## Target schema shape

Every table added in this pass (`user_profiles`, `devices`, `sessions`,
`password_reset_tokens`, `entitlements`, `daily_usage`, `feature_flags`,
`idempotency_keys`, `audit_log` — see `src/lib/db.ts`) was written with a 1:1 Postgres
port in mind:

- explicit columns, no `SELECT *`-only design
- `INTEGER` 0/1 booleans → become native `BOOLEAN`
- ISO-8601 `TEXT` timestamps → become `TIMESTAMPTZ`
- `TEXT PRIMARY KEY` random hex ids → stay as `TEXT`/`VARCHAR` (no dependency on SQLite
  `ROWID` or autoincrement anywhere in the schema — every id is already
  application-generated via `randomBytes(...).toString("hex")`)
- foreign keys already declared (`REFERENCES users(id) ON DELETE CASCADE`, etc.) —
  Postgres enforces them identically

## Migration procedure (when it happens)

1. **Freeze writes** (maintenance window, or `GET /api/v1/config`'s `maintenance` flag
   flipped on — client-visible, not enforced server-side yet in this pass, see
   [`docs/PRODUCTION_CHECKLIST.md`](./PRODUCTION_CHECKLIST.md)).
2. **Backup**: copy the SQLite file (`DATA_DIR/rentyourtime.sqlite`, default `./.data`)
   to a timestamped path; `sqlite3 rentyourtime.sqlite ".backup backup.sqlite"` for a
   consistency-safe copy even if WAL is active.
3. **Export**: dump every table to newline-delimited JSON or CSV, one file per table
   (`sqlite3 -json rentyourtime.sqlite "SELECT * FROM users" > users.json`, etc.) —
   scriptable, one line per table name, no manual per-row work.
4. **Provision** the Postgres schema (a straight port of `src/lib/db.ts`'s `CREATE
   TABLE` statements, per the type mapping above).
5. **Import**: load each table's export into Postgres, preserving:
   - **IDs** — insert them verbatim (already text, no auto-increment to reconcile).
   - **`password_hash`** — insert the `scrypt$N$salt$hash` string verbatim; `src/lib/password.ts`
     is engine-agnostic (pure Node `crypto`), so no re-hashing, no forced password
     reset for any user.
   - **Subscriptions** (`subscriptions` table) — insert verbatim; `source`,
     `provider_subscription_id`, `current_period_end` etc. carry over unchanged, so
     `subscriptionGrantsPro()` keeps returning the same answer post-migration.
   - **Founder purchases** (`founder_purchases`, `founder_tiers`) — insert verbatim,
     including `founder_number` (never regenerate a founder number during migration —
     it's a numbered, customer-facing identifier).
6. **Verify — record counts**: for every table, `SELECT COUNT(*)` on both sides must
   match exactly before cutover. Spot-check a sample of `users`/`subscriptions`/
   `founder_purchases` rows field-by-field (a scripted diff, not eyeballing).
7. **Cutover**: point `DATABASE_URL` at Postgres, swap `src/lib/db.ts`'s
   `better-sqlite3` calls for a Postgres client in the repository modules listed above,
   redeploy.
8. **Unfreeze writes.**

## Rollback

Until step 7 (cutover) actually redeploys code pointing at Postgres, the SQLite file
from step 2 is untouched and remains the live database — rollback is "don't deploy
step 7," nothing to undo. After cutover, rollback means: stop the Postgres-pointed
deployment, redeploy the pre-migration build against the step-2 SQLite backup (any
writes accepted between cutover and rollback are lost — this is why the record-count
verification in step 6 must pass *before* step 7, not after).

## Env var

`DATABASE_URL` is already present in `.env.example`, reserved and unused, so it can be
introduced without another env-var round-trip when this actually happens.
