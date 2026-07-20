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
  `);
  return db;
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
