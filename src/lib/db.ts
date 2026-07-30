import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Single shared SQLite connection.
 *
 * Mirrors the schema from the original PHP backend and adds a `waitlist`
 * table (previously a flat CSV file). The database file lives in DATA_DIR
 * (default: <cwd>/.data) which must be on a persistent disk — this app is
 * built for a long-running Node process, not serverless.
 */

let db: Database.Database | null = null;

/** Add a column to an existing table if it isn't already there. Idempotent. */
function addColumnIfMissing(
  conn: Database.Database,
  table: string,
  column: string,
  definition: string
): void {
  const cols = (conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes(column)) {
    conn.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function dataDir(): string {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), ".data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o750 });
  }
  return dir;
}

export function getDb(): Database.Database {
  if (db) return db;

  const file = path.join(dataDir(), "rentyourtime.sqlite");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      stripe_customer_id TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      stripe_subscription_id TEXT UNIQUE,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      last_event_created INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      resets_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      created_at TEXT NOT NULL,
      ip TEXT,
      notified INTEGER NOT NULL DEFAULT 0
    );

    -- Beta-tester emails collected by the Discord bot (see /bot).
    CREATE TABLE IF NOT EXISTS beta_testers (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      discord_id TEXT,
      discord_username TEXT,
      created_at TEXT NOT NULL
    );

    -- One row per invoice (billing history). Charge/PaymentIntent webhook
    -- events enrich an existing row rather than creating their own — see
    -- docs/STRIPE.md for why (Stripe API version 2025-08-27.basil dropped
    -- the direct invoice<->charge/payment_intent cross-references).
    CREATE TABLE IF NOT EXISTS billing_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      provider_invoice_id TEXT UNIQUE,
      provider_payment_id TEXT,
      provider_payment_intent_id TEXT,
      provider_subscription_id TEXT,
      invoice_number TEXT,
      status TEXT NOT NULL,
      amount_due INTEGER NOT NULL DEFAULT 0,
      amount_paid INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      hosted_invoice_url TEXT,
      invoice_pdf_url TEXT,
      receipt_url TEXT,
      billing_reason TEXT,
      period_start INTEGER,
      period_end INTEGER,
      created_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_billing_records_user_id ON billing_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_billing_records_provider_subscription_id ON billing_records(provider_subscription_id);
    CREATE INDEX IF NOT EXISTS idx_billing_records_provider_payment_intent_id ON billing_records(provider_payment_intent_id);
    CREATE INDEX IF NOT EXISTS idx_billing_records_created_at ON billing_records(created_at);

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_tokens(expires_at);

    -- Voluntary one-time "Support the project" payments (docs/CONTRIBUTIONS.md).
    -- Entirely separate from subscriptions/entitlements — never grants Pro,
    -- never touches the subscriptions table.
    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      percentage INTEGER NOT NULL,
      accrued_rent_cents INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      stripe_checkout_session_id TEXT UNIQUE,
      stripe_payment_intent_id TEXT UNIQUE,
      stripe_event_id TEXT,
      refunded_amount_cents INTEGER,
      is_demo_source INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      failed_at TEXT,
      refunded_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON contributions(user_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
    CREATE INDEX IF NOT EXISTS idx_contributions_created_at ON contributions(created_at);
    CREATE INDEX IF NOT EXISTS idx_contributions_checkout_session ON contributions(stripe_checkout_session_id);
    CREATE INDEX IF NOT EXISTS idx_contributions_payment_intent ON contributions(stripe_payment_intent_id);

    -- RentYourTime Founder Program (docs/FOUNDER_PROGRAM.md). Limited, numbered,
    -- one-time-payment tiers. A confirmed purchase can grant real Pro via
    -- src/lib/subscriptions.ts's grantFounderPro() — unlike contributions,
    -- which never touch subscriptions at all.
    CREATE TABLE IF NOT EXISTS founder_tiers (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      sold_quantity INTEGER NOT NULL DEFAULT 0,
      stripe_price_id TEXT,
      pro_duration_months INTEGER,
      is_lifetime_pro INTEGER NOT NULL DEFAULT 0,
      early_access_days INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS founder_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      founder_tier_id TEXT NOT NULL REFERENCES founder_tiers(id),
      founder_number INTEGER,
      stripe_checkout_session_id TEXT UNIQUE,
      stripe_payment_intent_id TEXT UNIQUE,
      stripe_event_id TEXT,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
      pro_starts_at TEXT,
      pro_ends_at TEXT,
      is_lifetime_pro INTEGER NOT NULL DEFAULT 0,
      discord_sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(founder_tier_id, founder_number)
    );
    CREATE INDEX IF NOT EXISTS idx_founder_purchases_user_id ON founder_purchases(user_id);
    CREATE INDEX IF NOT EXISTS idx_founder_purchases_tier_id ON founder_purchases(founder_tier_id);
    CREATE INDEX IF NOT EXISTS idx_founder_purchases_status ON founder_purchases(payment_status);
    CREATE INDEX IF NOT EXISTS idx_founder_purchases_created_at ON founder_purchases(created_at);
    -- Only one *active* (not yet resolved, or successfully paid) purchase per
    -- user+tier — a FAILED/EXPIRED/REFUNDED attempt frees the slot for a retry.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_founder_purchases_user_tier_active
      ON founder_purchases(user_id, founder_tier_id)
      WHERE payment_status IN ('PENDING', 'PAID');

    CREATE TABLE IF NOT EXISTS founder_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT,
      consent_directory INTEGER NOT NULL DEFAULT 0,
      consent_credits INTEGER NOT NULL DEFAULT 0,
      consent_case_study INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Founder Black physical kit only. Shipping address is never exposed by
    -- any public or client-facing read path — see src/lib/founders.ts.
    CREATE TABLE IF NOT EXISTS founder_black_fulfillments (
      id TEXT PRIMARY KEY,
      founder_purchase_id TEXT NOT NULL UNIQUE REFERENCES founder_purchases(id) ON DELETE CASCADE,
      full_name TEXT,
      shipping_address TEXT,
      country TEXT,
      shirt_size TEXT,
      card_status TEXT NOT NULL DEFAULT 'pending',
      certificate_status TEXT NOT NULL DEFAULT 'pending',
      letter_status TEXT NOT NULL DEFAULT 'pending',
      shirt_status TEXT NOT NULL DEFAULT 'pending',
      tracking_number TEXT,
      shipped_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- ------------------------------------------------------------------
    -- /api/v1 central API tables (docs/API_ARCHITECTURE.md). All additive —
    -- none of the tables above are touched. See docs/DATABASE_MIGRATION.md
    -- for the eventual Postgres path; these definitions are written to be a
    -- 1:1 port (explicit columns, no SQLite-only tricks besides INTEGER
    -- booleans and TEXT timestamps, which the migration script converts).
    -- ------------------------------------------------------------------

    -- One-to-one with users. Distinct from account security fields (which
    -- stay on 'users') — this is user-controlled product preferences only.
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      locale TEXT NOT NULL DEFAULT 'en-US',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      currency TEXT NOT NULL DEFAULT 'usd',
      daily_free_minutes INTEGER NOT NULL DEFAULT 60,
      rent_rate_per_hour_minor INTEGER NOT NULL DEFAULT 0,
      analytics_consent INTEGER NOT NULL DEFAULT 0,
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    -- Devices first (sessions reference them). installation_id is a
    -- client-generated stable UUID (iOS: identifierForVendor-derived; web:
    -- a random id persisted in an HttpOnly cookie) — never the Apple
    -- vendor/advertising identifier itself.
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      installation_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_name TEXT,
      system_version TEXT,
      app_version TEXT,
      push_token TEXT,
      push_environment TEXT,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_installation ON devices(user_id, installation_id);
    CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

    -- Refresh-token sessions for /api/v1 (docs/AUTH_FLOW.md). Deliberately
    -- separate from the legacy 'tokens' table — see docs/AUTH_MIGRATION.md
    -- for why both exist during the migration window. refresh_token_hash is
    -- SHA-256 of the raw refresh token, same technique as 'tokens'/
    -- 'email_verification_tokens'. token_family_id ties together every
    -- session produced by rotating the same original login, so reuse of a
    -- superseded refresh token can revoke the whole family.
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      token_family_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      replaced_by_session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_family_id ON sessions(token_family_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);

    -- Same technique as email_verification_tokens, for "forgot password".
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

    -- Manual (non-provider) entitlement grants only — ADMIN comps and PROMO
    -- codes. STRIPE/APPLE/FOUNDER entitlements are derived read-side by
    -- EntitlementService straight from 'subscriptions'/'founder_purchases';
    -- this table is never written by a webhook or by client input.
    CREATE TABLE IF NOT EXISTS entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements(user_id);

    -- Aggregated per-device-per-day usage sync (docs/API_ENDPOINTS.md §usage).
    -- Never stores per-app breakdowns or FamilyControls tokens — totals only.
    CREATE TABLE IF NOT EXISTS daily_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      total_seconds INTEGER NOT NULL,
      free_seconds INTEGER NOT NULL,
      billable_seconds INTEGER NOT NULL,
      virtual_rent_amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      goal_met INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      client_updated_at TEXT NOT NULL,
      server_updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_usage_user_device_date ON daily_usage(user_id, device_id, date);
    CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

    CREATE TABLE IF NOT EXISTS feature_flags (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      free_enabled INTEGER NOT NULL DEFAULT 1,
      pro_enabled INTEGER NOT NULL DEFAULT 1,
      founder_enabled INTEGER NOT NULL DEFAULT 1,
      rollout_percentage INTEGER NOT NULL DEFAULT 100,
      minimum_app_version TEXT,
      latest_app_version TEXT,
      starts_at TEXT,
      ends_at TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- One row per (user, Idempotency-Key, endpoint) — a retried request with
    -- the same key+endpoint+body replays the stored response instead of
    -- re-executing side effects. See docs/API_ARCHITECTURE.md.
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_user_key_endpoint ON idempotency_keys(user_id, key, endpoint);
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency_keys(expires_at);

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
  `);

  // Migration: add waitlist.notified to older databases. Existing rows are
  // backfilled as already-notified so the bot never DMs about historical signups.
  const waitlistCols = (db.prepare("PRAGMA table_info(waitlist)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!waitlistCols.includes("notified")) {
    db.exec("ALTER TABLE waitlist ADD COLUMN notified INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE waitlist SET notified = 1");
  }

  // Migration: extend waitlist with admin-panel + notification-tracking
  // columns. `email` remains the primary key (unchanged) — `id` is added as
  // a plain, backfilled, uniquely-indexed column so admin routes have a
  // stable identifier without rebuilding the table.
  addColumnIfMissing(db, "waitlist", "id", "id TEXT");
  addColumnIfMissing(db, "waitlist", "source", "source TEXT NOT NULL DEFAULT 'WEBSITE'");
  addColumnIfMissing(db, "waitlist", "status", "status TEXT NOT NULL DEFAULT 'NEW'");
  addColumnIfMissing(
    db,
    "waitlist",
    "confirmation_sent",
    "confirmation_sent INTEGER NOT NULL DEFAULT 0"
  );
  addColumnIfMissing(
    db,
    "waitlist",
    "owner_email_notified",
    "owner_email_notified INTEGER NOT NULL DEFAULT 0"
  );
  addColumnIfMissing(db, "waitlist", "user_agent", "user_agent TEXT");
  addColumnIfMissing(db, "waitlist", "updated_at", "updated_at TEXT");
  addColumnIfMissing(db, "waitlist", "contacted_at", "contacted_at TEXT");
  addColumnIfMissing(db, "waitlist", "notes", "notes TEXT");

  const waitlistMissingId = db
    .prepare("SELECT email FROM waitlist WHERE id IS NULL")
    .all() as { email: string }[];
  if (waitlistMissingId.length > 0) {
    const assignId = db.prepare("UPDATE waitlist SET id = ? WHERE email = ?");
    for (const row of waitlistMissingId) {
      assignId.run(randomBytes(12).toString("hex"), row.email);
    }
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_id ON waitlist(id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source)");

  // Migration: extend users/subscriptions with entitlement + Apple-readiness
  // columns on older databases. Additive only — no existing column is
  // touched, dropped, or renamed, and no user/subscription ID changes.
  addColumnIfMissing(db, "users", "display_name", "display_name TEXT");
  addColumnIfMissing(db, "users", "email_verified", "email_verified INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "users", "is_active", "is_active INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(db, "users", "role", "role TEXT NOT NULL DEFAULT 'USER'");
  addColumnIfMissing(db, "users", "last_login_at", "last_login_at TEXT");
  addColumnIfMissing(db, "users", "updated_at", "updated_at TEXT");
  addColumnIfMissing(
    db,
    "users",
    "apple_original_transaction_id",
    "apple_original_transaction_id TEXT"
  );
  addColumnIfMissing(db, "users", "apple_account_token", "apple_account_token TEXT");
  // Server-known accrued rent, in cents, for the "Support the project" flow
  // (docs/CONTRIBUTIONS.md). NULL until a real on-device usage-sync exists —
  // no request handler may ever set this from client input.
  addColumnIfMissing(db, "users", "accrued_rent_cents", "accrued_rent_cents INTEGER");
  addColumnIfMissing(db, "users", "accrued_rent_currency", "accrued_rent_currency TEXT NOT NULL DEFAULT 'usd'");
  // Migration: contributions.is_demo_source for pre-existing databases (new
  // databases already get it from the CREATE TABLE above).
  addColumnIfMissing(db, "contributions", "is_demo_source", "is_demo_source INTEGER NOT NULL DEFAULT 0");

  addColumnIfMissing(db, "subscriptions", "source", "source TEXT NOT NULL DEFAULT 'STRIPE'");
  addColumnIfMissing(db, "subscriptions", "provider_customer_id", "provider_customer_id TEXT");
  addColumnIfMissing(
    db,
    "subscriptions",
    "provider_subscription_id",
    "provider_subscription_id TEXT"
  );
  addColumnIfMissing(db, "subscriptions", "product_id", "product_id TEXT");
  addColumnIfMissing(db, "subscriptions", "price_id", "price_id TEXT");
  addColumnIfMissing(db, "subscriptions", "plan", "plan TEXT NOT NULL DEFAULT 'UNKNOWN'");
  addColumnIfMissing(db, "subscriptions", "started_at", "started_at TEXT");
  addColumnIfMissing(db, "subscriptions", "canceled_at", "canceled_at TEXT");
  addColumnIfMissing(db, "subscriptions", "trial_ends_at", "trial_ends_at TEXT");
  addColumnIfMissing(db, "subscriptions", "auto_renew", "auto_renew INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing(
    db,
    "subscriptions",
    "original_transaction_id",
    "original_transaction_id TEXT"
  );
  addColumnIfMissing(db, "subscriptions", "environment", "environment TEXT");
  addColumnIfMissing(
    db,
    "subscriptions",
    "last_provider_event_id",
    "last_provider_event_id TEXT"
  );

  // Backfill the new generalized provider columns from the legacy
  // Stripe-only columns so rows written before this migration are still
  // picked up by code that reads provider_subscription_id/provider_customer_id.
  db.exec(
    `UPDATE subscriptions SET provider_subscription_id = stripe_subscription_id
     WHERE provider_subscription_id IS NULL AND stripe_subscription_id IS NOT NULL`
  );
  db.exec(
    `UPDATE subscriptions SET provider_customer_id = (
       SELECT u.stripe_customer_id FROM users u WHERE u.id = subscriptions.user_id
     )
     WHERE provider_customer_id IS NULL`
  );

  // Opportunistic cleanup (~1% of connections), matching the PHP behaviour.
  if (Math.floor(Math.random() * 100) === 0) {
    db.prepare("DELETE FROM tokens WHERE expires_at <= ?").run(new Date().toISOString());
    db.prepare("DELETE FROM rate_limits WHERE resets_at <= ?").run(Math.floor(Date.now() / 1000));
    const nowIso = new Date().toISOString();
    // Revoked/expired sessions are kept (audit trail, reuse-detection needs
    // the row) — only the strictly-expired idempotency cache and used/expired
    // password reset tokens are opportunistically pruned.
    db.prepare("DELETE FROM idempotency_keys WHERE expires_at <= ?").run(nowIso);
    db.prepare("DELETE FROM password_reset_tokens WHERE expires_at <= ?").run(nowIso);
  }

  return db;
}
