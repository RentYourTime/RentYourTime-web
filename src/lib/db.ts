import Database from "better-sqlite3";
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
      ip TEXT
    );

    -- Beta-tester emails collected by the Discord bot (see /bot).
    CREATE TABLE IF NOT EXISTS beta_testers (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      discord_id TEXT,
      discord_username TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Opportunistic cleanup (~1% of connections), matching the PHP behaviour.
  if (Math.floor(Math.random() * 100) === 0) {
    db.prepare("DELETE FROM tokens WHERE expires_at <= ?").run(new Date().toISOString());
    db.prepare("DELETE FROM rate_limits WHERE resets_at <= ?").run(Math.floor(Date.now() / 1000));
  }

  return db;
}
