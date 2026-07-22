import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The bot shares the Next app's SQLite database so all emails live in one place.
 * DATA_DIR must point at the same directory the app uses (defaults to ../.data,
 * i.e. the app's default when the bot runs from this subfolder).
 */
function dataDir() {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, "..", ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

let db;
export function getDb() {
  if (db) return db;
  db = new Database(path.join(dataDir(), "rentyourtime.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_testers (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      discord_id TEXT,
      discord_username TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS waitlist (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      created_at TEXT NOT NULL,
      ip TEXT,
      notified INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migration for databases whose waitlist table predates the `notified` column.
  // Existing rows are marked notified so historical signups aren't DMed.
  const cols = db.prepare("PRAGMA table_info(waitlist)").all().map((c) => c.name);
  if (!cols.includes("notified")) {
    db.exec("ALTER TABLE waitlist ADD COLUMN notified INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE waitlist SET notified = 1");
  }
  // The bot only ever writes `notified`/`updated_at` itself — the rest of the
  // admin-panel columns (source, status, ...) are owned and migrated by the
  // website (src/lib/db.ts); this table is shared, so those columns already
  // exist by the time either process touches a real deployment's database.
  if (!cols.includes("updated_at")) {
    db.exec("ALTER TABLE waitlist ADD COLUMN updated_at TEXT");
  }

  return db;
}

/**
 * Website waitlist signups the bot hasn't announced yet. Only selects
 * columns the bot's own (minimal) CREATE TABLE guarantees exist, so this
 * works even if the bot starts before the website has ever run its fuller
 * migration (src/lib/db.ts) on a brand-new database. `source` isn't needed
 * here: this table is only ever written to by the website's waitlist form,
 * so every row the bot ever sees is a website signup by construction.
 */
export function getUnnotifiedWaitlist() {
  return getDb()
    .prepare("SELECT email, created_at FROM waitlist WHERE notified = 0 ORDER BY created_at")
    .all();
}

export function markWaitlistNotified(email) {
  getDb()
    .prepare("UPDATE waitlist SET notified = 1, updated_at = ? WHERE email = ?")
    .run(new Date().toISOString(), email);
}

/** Total waitlist signups, for the "Total signups" line in the owner DM. */
export function countWaitlist() {
  return getDb().prepare("SELECT COUNT(*) AS n FROM waitlist").get().n;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email) {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/** Insert a beta tester. Returns { added:false } if the email already exists. */
export function addBetaTester(email, discordId, discordUsername) {
  const conn = getDb();
  if (conn.prepare("SELECT 1 FROM beta_testers WHERE email = ?").get(email)) {
    return { added: false };
  }
  conn
    .prepare(
      "INSERT INTO beta_testers (email, discord_id, discord_username, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(email, discordId, discordUsername, new Date().toISOString());
  return { added: true };
}

export function countBetaTesters() {
  return getDb().prepare("SELECT COUNT(*) AS n FROM beta_testers").get().n;
}

export function allBetaTesters() {
  return getDb()
    .prepare("SELECT email, discord_username, created_at FROM beta_testers ORDER BY created_at")
    .all();
}
