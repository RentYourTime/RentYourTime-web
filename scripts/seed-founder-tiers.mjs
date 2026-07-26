#!/usr/bin/env node
// One-time / idempotent seed for the three Founder Program tiers
// (docs/FOUNDER_PROGRAM.md). Safe to run repeatedly — upserts by `slug` and
// never touches `sold_quantity` (never resets numbers already handed out) or
// `total_quantity` on an existing row, so re-running this after tiers have
// started selling can't silently change the limit under real buyers.
//
// Usage: node scripts/seed-founder-tiers.mjs
//   or:  npm run founders:seed
//
// Reads Stripe Price IDs from the environment if present (same variables the
// app itself reads — see .env.example):
//   STRIPE_FOUNDER_FIRST_PRICE_ID, STRIPE_FOUNDER_GOLD_PRICE_ID, STRIPE_FOUNDER_BLACK_PRICE_ID

import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function dataDir() {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, "..", ".data");
}

const dbFile = path.join(dataDir(), "rentyourtime.sqlite");
if (!existsSync(dbFile)) {
  console.error(
    `Database not found at ${dbFile} — run the app once first (it creates the schema on startup), or set DATA_DIR.`
  );
  process.exit(1);
}

const db = new Database(dbFile);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='founder_tiers'")
  .get();
if (!tables) {
  console.error(
    "founder_tiers table doesn't exist yet — start the app once (it runs the migration on the first getDb() call), then re-run this seed."
  );
  process.exit(1);
}

const TIERS = [
  {
    slug: "founder-first",
    name: "Founder First",
    price_cents: 5000,
    currency: "USD",
    total_quantity: 300,
    stripe_price_id: process.env.STRIPE_FOUNDER_FIRST_PRICE_ID || null,
    pro_duration_months: 12,
    is_lifetime_pro: 0,
    early_access_days: 7,
    is_active: 1,
    sort_order: 0,
  },
  {
    slug: "founder-gold",
    name: "Founder Gold",
    price_cents: 12500,
    currency: "USD",
    total_quantity: 150,
    stripe_price_id: process.env.STRIPE_FOUNDER_GOLD_PRICE_ID || null,
    pro_duration_months: 36,
    is_lifetime_pro: 0,
    early_access_days: 30,
    is_active: 1,
    sort_order: 1,
  },
  {
    slug: "founder-black",
    name: "Founder Black",
    price_cents: 189900,
    currency: "USD",
    total_quantity: 20,
    stripe_price_id: process.env.STRIPE_FOUNDER_BLACK_PRICE_ID || null,
    pro_duration_months: null,
    is_lifetime_pro: 1,
    early_access_days: 365,
    is_active: 1,
    sort_order: 2,
  },
];

const now = new Date().toISOString();
const upsert = db.prepare(`
  INSERT INTO founder_tiers
    (id, slug, name, price_cents, currency, total_quantity, sold_quantity, stripe_price_id,
     pro_duration_months, is_lifetime_pro, early_access_days, is_active, sort_order, created_at, updated_at)
  VALUES
    (@id, @slug, @name, @price_cents, @currency, @total_quantity, 0, @stripe_price_id,
     @pro_duration_months, @is_lifetime_pro, @early_access_days, @is_active, @sort_order, @created_at, @updated_at)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    stripe_price_id = excluded.stripe_price_id,
    pro_duration_months = excluded.pro_duration_months,
    is_lifetime_pro = excluded.is_lifetime_pro,
    early_access_days = excluded.early_access_days,
    sort_order = excluded.sort_order,
    updated_at = excluded.updated_at
`);

for (const tier of TIERS) {
  const existing = db.prepare("SELECT id FROM founder_tiers WHERE slug = ?").get(tier.slug);
  upsert.run({
    id: existing?.id ?? randomBytes(12).toString("hex"),
    ...tier,
    created_at: now,
    updated_at: now,
  });
  const priceNote = tier.stripe_price_id ? tier.stripe_price_id : "⚠ no Stripe Price ID set yet";
  console.log(`✓ ${tier.name} (${tier.slug}) — $${(tier.price_cents / 100).toFixed(2)} — ${priceNote}`);
}

console.log("\nDone. Prices/names/Stripe IDs are kept in sync on re-run; total_quantity and sold_quantity are never touched once a tier exists.");
