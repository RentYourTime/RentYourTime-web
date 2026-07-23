#!/usr/bin/env node
// One-time CLI to promote an existing account to ADMIN or ADMIN_TEAMS.
// Deliberately not wired into any request-handling code — this only ever
// runs when an operator invokes it directly, so ADMIN_ACCOUNT_EMAIL can
// never silently grant a role to whoever happens to register with that
// address.
//
// Usage: node scripts/grant-admin.mjs owner@example.com [ADMIN|ADMIN_TEAMS]
//    or: ADMIN_ACCOUNT_EMAIL=owner@example.com ADMIN_ACCOUNT_ROLE=ADMIN_TEAMS node scripts/grant-admin.mjs

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROLES = new Set(["ADMIN", "ADMIN_TEAMS"]);

function dataDir() {
  // Same resolution as bot/db.js and src/lib/db.ts: DATA_DIR env var, else
  // the repo-root .data directory (this script lives in scripts/, a sibling
  // of src/ and bot/, so ".." from here is the repo root).
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, "..", ".data");
}

const email = (process.argv[2] || process.env.ADMIN_ACCOUNT_EMAIL || "").trim().toLowerCase();
const role = (process.argv[3] || process.env.ADMIN_ACCOUNT_ROLE || "ADMIN").trim().toUpperCase();

if (!email) {
  console.error(
    "Usage: node scripts/grant-admin.mjs <email> [ADMIN|ADMIN_TEAMS]  (or set ADMIN_ACCOUNT_EMAIL / ADMIN_ACCOUNT_ROLE)"
  );
  process.exit(1);
}
if (!ROLES.has(role)) {
  console.error(`Unknown role "${role}" — expected ADMIN or ADMIN_TEAMS.`);
  process.exit(1);
}

const dbFile = path.join(dataDir(), "rentyourtime.sqlite");
if (!existsSync(dbFile)) {
  console.error(
    `Database not found at ${dbFile} — set DATA_DIR, or run this from where the app's .data lives.`
  );
  process.exit(1);
}

const db = new Database(dbFile);
const user = db.prepare("SELECT id, role FROM users WHERE email = ?").get(email);
if (!user) {
  console.error(`No account found for ${email} — they need to register first.`);
  process.exit(1);
}

if (user.role === role) {
  console.log(`${email} is already ${role}.`);
  process.exit(0);
}

db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(
  role,
  new Date().toISOString(),
  user.id
);
console.log(`✓ ${email} is now ${role} (was ${user.role}).`);
