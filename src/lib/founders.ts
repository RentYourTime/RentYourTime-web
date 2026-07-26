import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { getDb } from "./db";
import { grantFounderPro } from "./subscriptions";

/**
 * RentYourTime Founder Program — limited, numbered, one-time-payment tiers.
 * See docs/FOUNDER_PROGRAM.md. Availability (`sold_quantity`/`total_quantity`)
 * lives only in `founder_tiers`, never in a frontend constant — every read
 * path here goes straight to the database, no caching layer.
 */

export type FounderPaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
export type FounderFulfillmentStatus = "NOT_APPLICABLE" | "PENDING" | "IN_PROGRESS" | "COMPLETED";
export type DiscordSyncStatus = "pending" | "assigned" | "failed" | "removed";
export type KitItemStatus = "pending" | "prepared" | "shipped";

export interface FounderTierRow {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  total_quantity: number;
  sold_quantity: number;
  stripe_price_id: string | null;
  pro_duration_months: number | null;
  is_lifetime_pro: number;
  early_access_days: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SerializedFounderTier {
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  isSoldOut: boolean;
  isAlmostGone: boolean;
  proDurationMonths: number | null;
  isLifetimePro: boolean;
  earlyAccessDays: number;
  isActive: boolean;
  numberPadding: number;
}

export function remainingQuantity(tier: FounderTierRow): number {
  return Math.max(0, tier.total_quantity - tier.sold_quantity);
}

export function isSoldOut(tier: FounderTierRow): boolean {
  return remainingQuantity(tier) <= 0;
}

/** "Almost gone" once 10% or less of the total remains (and it isn't already sold out). */
export function isAlmostGone(tier: FounderTierRow): boolean {
  const remaining = remainingQuantity(tier);
  return remaining > 0 && remaining <= Math.ceil(tier.total_quantity * 0.1);
}

export function numberPaddingForTier(tier: FounderTierRow): number {
  return String(tier.total_quantity).length;
}

export function formatFounderNumber(tier: FounderTierRow, founderNumber: number): string {
  return `#${String(founderNumber).padStart(numberPaddingForTier(tier), "0")}`;
}

export function serializeFounderTier(tier: FounderTierRow): SerializedFounderTier {
  return {
    slug: tier.slug,
    name: tier.name,
    priceCents: tier.price_cents,
    currency: tier.currency,
    totalQuantity: tier.total_quantity,
    soldQuantity: tier.sold_quantity,
    remainingQuantity: remainingQuantity(tier),
    isSoldOut: isSoldOut(tier),
    isAlmostGone: isAlmostGone(tier),
    proDurationMonths: tier.pro_duration_months,
    isLifetimePro: !!tier.is_lifetime_pro,
    earlyAccessDays: tier.early_access_days,
    isActive: !!tier.is_active,
    numberPadding: numberPaddingForTier(tier),
  };
}

export function getFounderTierBySlug(slug: string): FounderTierRow | null {
  const row = getDb().prepare("SELECT * FROM founder_tiers WHERE slug = ?").get(slug) as
    | FounderTierRow
    | undefined;
  return row ?? null;
}

export function getFounderTierById(id: string): FounderTierRow | null {
  const row = getDb().prepare("SELECT * FROM founder_tiers WHERE id = ?").get(id) as
    | FounderTierRow
    | undefined;
  return row ?? null;
}

/** Public marketing page — active tiers only, in display order. */
export function listActiveFounderTiers(): FounderTierRow[] {
  return getDb()
    .prepare("SELECT * FROM founder_tiers WHERE is_active = 1 ORDER BY sort_order ASC")
    .all() as FounderTierRow[];
}

/** Admin — every tier regardless of active state. */
export function listAllFounderTiers(): FounderTierRow[] {
  return getDb().prepare("SELECT * FROM founder_tiers ORDER BY sort_order ASC").all() as FounderTierRow[];
}

export function setFounderTierActive(tierId: string, active: boolean): FounderTierRow | null {
  getDb()
    .prepare("UPDATE founder_tiers SET is_active = ?, updated_at = ? WHERE id = ?")
    .run(active ? 1 : 0, new Date().toISOString(), tierId);
  return getFounderTierById(tierId);
}

/** Never allows the new limit to drop below what's already sold. */
export function updateFounderTierLimit(
  tierId: string,
  newTotalQuantity: number
): { ok: true; tier: FounderTierRow } | { ok: false; error: "below_sold_quantity" | "not_found" } {
  const tier = getFounderTierById(tierId);
  if (!tier) return { ok: false, error: "not_found" };
  if (newTotalQuantity < tier.sold_quantity) return { ok: false, error: "below_sold_quantity" };
  getDb()
    .prepare("UPDATE founder_tiers SET total_quantity = ?, updated_at = ? WHERE id = ?")
    .run(newTotalQuantity, new Date().toISOString(), tierId);
  return { ok: true, tier: getFounderTierById(tierId)! };
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export interface FounderPurchaseRow {
  id: string;
  user_id: string;
  founder_tier_id: string;
  founder_number: number | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_event_id: string | null;
  amount_cents: number;
  currency: string;
  payment_status: FounderPaymentStatus;
  fulfillment_status: FounderFulfillmentStatus;
  pro_starts_at: string | null;
  pro_ends_at: string | null;
  is_lifetime_pro: number;
  discord_sync_status: DiscordSyncStatus;
  created_at: string;
  updated_at: string;
}

export function getFounderPurchaseById(id: string): FounderPurchaseRow | null {
  const row = getDb().prepare("SELECT * FROM founder_purchases WHERE id = ?").get(id) as
    | FounderPurchaseRow
    | undefined;
  return row ?? null;
}

export function getFounderPurchaseByCheckoutSessionId(sessionId: string): FounderPurchaseRow | null {
  const row = getDb()
    .prepare("SELECT * FROM founder_purchases WHERE stripe_checkout_session_id = ?")
    .get(sessionId) as FounderPurchaseRow | undefined;
  return row ?? null;
}

export function getFounderPurchaseByPaymentIntentId(paymentIntentId: string): FounderPurchaseRow | null {
  const row = getDb()
    .prepare("SELECT * FROM founder_purchases WHERE stripe_payment_intent_id = ?")
    .get(paymentIntentId) as FounderPurchaseRow | undefined;
  return row ?? null;
}

/** A PENDING or PAID row for this (user, tier) — mirrors the partial unique index. */
export function getActiveFounderPurchase(userId: string, tierId: string): FounderPurchaseRow | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM founder_purchases
       WHERE user_id = ? AND founder_tier_id = ? AND payment_status IN ('PENDING', 'PAID')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId, tierId) as FounderPurchaseRow | undefined;
  return row ?? null;
}

export function createPendingFounderPurchase(params: {
  userId: string;
  tierId: string;
  amountCents: number;
  currency: string;
}): FounderPurchaseRow {
  const id = randomBytes(12).toString("hex");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO founder_purchases
         (id, user_id, founder_tier_id, amount_cents, currency, payment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`
    )
    .run(id, params.userId, params.tierId, params.amountCents, params.currency, now, now);
  return getFounderPurchaseById(id)!;
}

export function attachFounderCheckoutSession(purchaseId: string, checkoutSessionId: string): void {
  getDb()
    .prepare("UPDATE founder_purchases SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?")
    .run(checkoutSessionId, new Date().toISOString(), purchaseId);
}

const SECONDS_PER_MONTH = 30 * 24 * 3600;

/**
 * Atomically reserves the next founder number for a tier — a single SQLite
 * UPDATE...WHERE guards the hard cap (`sold_quantity < total_quantity`); if
 * `changes === 0` the tier is exactly full (or was disabled mid-flight) and
 * no number is handed out, however many buyers race for the last slot.
 */
function tryAssignFounderNumber(tierId: string): number | null {
  const db = getDb();
  const now = new Date().toISOString();
  const updated = db
    .prepare(
      `UPDATE founder_tiers SET sold_quantity = sold_quantity + 1, updated_at = ?
       WHERE id = ? AND sold_quantity < total_quantity`
    )
    .run(now, tierId);
  if (updated.changes === 0) return null;
  const row = db.prepare("SELECT sold_quantity FROM founder_tiers WHERE id = ?").get(tierId) as {
    sold_quantity: number;
  };
  return row.sold_quantity;
}

export interface FounderSessionMeta {
  purchaseId: string;
  userId: string;
}

export function founderSessionMetadata(session: Stripe.Checkout.Session): FounderSessionMeta | null {
  if (session.metadata?.kind !== "founder") return null;
  const purchaseId = String(session.metadata?.purchaseId ?? "");
  const userId = String(session.metadata?.userId ?? "");
  if (!purchaseId || !userId) return null;
  return { purchaseId, userId };
}

/**
 * Settles a Founder purchase from a paid Checkout Session — the one place
 * both the webhook and any future status-poll endpoint do this, so the
 * cross-checks can't diverge. Cross-checks user/amount/currency against the
 * PENDING row (never trusts metadata alone), then — inside one DB
 * transaction — assigns the founder number and marks PAID atomically, and
 * only then grants Pro (a side effect outside the DB transaction, but
 * idempotent: `grantFounderPro` is a pure upsert, and this whole function
 * already refuses to run twice for the same purchase).
 */
export function settleFounderPurchaseFromSession(
  session: Stripe.Checkout.Session,
  sourceEventId: string
): FounderPurchaseRow | null {
  const meta = founderSessionMetadata(session);
  if (!meta || session.payment_status !== "paid") return null;

  const purchase = getFounderPurchaseById(meta.purchaseId);
  if (!purchase) {
    console.error(`[founders] purchase ${meta.purchaseId} not found for session ${session.id}`);
    return null;
  }
  if (purchase.payment_status !== "PENDING") return purchase; // already settled — idempotent

  if (purchase.user_id !== meta.userId) {
    console.error(`[founders] purchase ${purchase.id}: session user mismatch — refusing to settle`);
    return null;
  }
  if (session.amount_total !== purchase.amount_cents) {
    console.error(`[founders] purchase ${purchase.id}: amount mismatch — refusing to settle`);
    return null;
  }
  if ((session.currency ?? "").toLowerCase() !== purchase.currency.toLowerCase()) {
    console.error(`[founders] purchase ${purchase.id}: currency mismatch — refusing to settle`);
    return null;
  }

  const tier = getFounderTierById(purchase.founder_tier_id);
  if (!tier) {
    console.error(`[founders] purchase ${purchase.id}: tier ${purchase.founder_tier_id} not found`);
    return null;
  }

  const db = getDb();
  const now = new Date().toISOString();
  const pi = session.payment_intent;
  const paymentIntentId = pi ? (typeof pi === "string" ? pi : pi.id) : null;

  const founderNumber = db.transaction(() => {
    const number = tryAssignFounderNumber(tier.id);
    db.prepare(
      `UPDATE founder_purchases
       SET payment_status = 'PAID', founder_number = ?, stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           stripe_event_id = ?, updated_at = ?,
           fulfillment_status = CASE WHEN ? = 1 THEN 'PENDING' ELSE fulfillment_status END
       WHERE id = ?`
    ).run(number, paymentIntentId, sourceEventId, now, tier.slug === "founder-black" ? 1 : 0, purchase.id);
    return number;
  })();

  if (founderNumber === null) {
    // Extremely rare: Stripe already confirmed payment but the tier filled
    // up in the race between checkout and webhook. The purchase is honored
    // (PAID) but has no number — needs manual admin resolution (refund or
    // raise the limit by one). See docs/FOUNDER_PROGRAM.md.
    console.error(
      `[founders] purchase ${purchase.id}: tier ${tier.slug} sold out before settlement — PAID with no founder_number, needs manual review`
    );
  } else {
    const isLifetime = !!tier.is_lifetime_pro;
    const startsAtSeconds = Math.floor(Date.now() / 1000);
    const endsAtSeconds = isLifetime
      ? null
      : startsAtSeconds + (tier.pro_duration_months ?? 0) * SECONDS_PER_MONTH;
    db.prepare(
      `UPDATE founder_purchases SET pro_starts_at = ?, pro_ends_at = ?, is_lifetime_pro = ? WHERE id = ?`
    ).run(
      new Date(startsAtSeconds * 1000).toISOString(),
      endsAtSeconds ? new Date(endsAtSeconds * 1000).toISOString() : null,
      isLifetime ? 1 : 0,
      purchase.id
    );
    grantFounderPro({ userId: purchase.user_id, isLifetime, endsAtSeconds });
  }

  return getFounderPurchaseById(purchase.id);
}

export function markFounderPurchaseFailed(params: { id: string; stripeEventId: string }): void {
  getDb()
    .prepare(
      `UPDATE founder_purchases SET payment_status = 'FAILED', stripe_event_id = ?, updated_at = ?
       WHERE id = ? AND payment_status = 'PENDING'`
    )
    .run(params.stripeEventId, new Date().toISOString(), params.id);
}

export function markFounderPurchaseExpired(params: { id: string; stripeEventId: string }): void {
  getDb()
    .prepare(
      `UPDATE founder_purchases SET payment_status = 'EXPIRED', stripe_event_id = ?, updated_at = ?
       WHERE id = ? AND payment_status = 'PENDING'`
    )
    .run(params.stripeEventId, new Date().toISOString(), params.id);
}

/**
 * Full refund only marks the purchase REFUNDED — it does not automatically
 * revoke any Pro access already granted via `grantFounderPro` (that merge is
 * one-directional by design; safely reversing it needs to know how much of
 * the user's current window came from *this* purchase specifically, which
 * isn't tracked). See docs/FOUNDER_PROGRAM.md "Known limitations" — clawing
 * back access on refund is a manual admin action for now.
 */
export function applyFounderRefund(params: { id: string; stripeEventId: string }): void {
  getDb()
    .prepare(
      `UPDATE founder_purchases SET payment_status = 'REFUNDED', stripe_event_id = ?, updated_at = ?
       WHERE id = ? AND payment_status = 'PAID'`
    )
    .run(params.stripeEventId, new Date().toISOString(), params.id);
}

export function listFounderPurchasesForUser(userId: string): FounderPurchaseRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM founder_purchases WHERE user_id = ? AND payment_status != 'PENDING'
       ORDER BY created_at DESC`
    )
    .all(userId) as FounderPurchaseRow[];
}

export interface AdminFounderPurchaseRow extends FounderPurchaseRow {
  user_email: string;
  tier_slug: string;
  tier_name: string;
}

export interface ListAdminPurchasesOptions {
  tierSlug?: string;
  status?: FounderPaymentStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export function listAdminFounderPurchases(
  opts: ListAdminPurchasesOptions
): { purchases: AdminFounderPurchaseRow[]; total: number } {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 100), 1), 500);
  const offset = Math.max(Math.floor(opts.offset ?? 0), 0);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.tierSlug) {
    clauses.push("t.slug = ?");
    params.push(opts.tierSlug);
  }
  if (opts.status) {
    clauses.push("p.payment_status = ?");
    params.push(opts.status);
  }
  if (opts.search) {
    clauses.push("u.email LIKE ?");
    params.push(`%${opts.search}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const db = getDb();

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM founder_purchases p
         JOIN users u ON u.id = p.user_id
         JOIN founder_tiers t ON t.id = p.founder_tier_id ${where}`
      )
      .get(...params) as { n: number }
  ).n;

  const purchases = db
    .prepare(
      `SELECT p.*, u.email AS user_email, t.slug AS tier_slug, t.name AS tier_name
       FROM founder_purchases p
       JOIN users u ON u.id = p.user_id
       JOIN founder_tiers t ON t.id = p.founder_tier_id
       ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as AdminFounderPurchaseRow[];

  return { purchases, total };
}

// ---------------------------------------------------------------------------
// Founder profile (display name + directory/credits/case-study consents)
// ---------------------------------------------------------------------------

export interface FounderProfileRow {
  id: string;
  user_id: string;
  display_name: string | null;
  consent_directory: number;
  consent_credits: number;
  consent_case_study: number;
  created_at: string;
  updated_at: string;
}

export function getFounderProfile(userId: string): FounderProfileRow | null {
  const row = getDb().prepare("SELECT * FROM founder_profiles WHERE user_id = ?").get(userId) as
    | FounderProfileRow
    | undefined;
  return row ?? null;
}

export function upsertFounderProfile(params: {
  userId: string;
  displayName?: string | null;
  consentDirectory?: boolean;
  consentCredits?: boolean;
  consentCaseStudy?: boolean;
}): FounderProfileRow {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getFounderProfile(params.userId);
  if (!existing) {
    const id = randomBytes(12).toString("hex");
    db.prepare(
      `INSERT INTO founder_profiles
         (id, user_id, display_name, consent_directory, consent_credits, consent_case_study, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      params.userId,
      params.displayName ?? null,
      params.consentDirectory ? 1 : 0,
      params.consentCredits ? 1 : 0,
      params.consentCaseStudy ? 1 : 0,
      now,
      now
    );
  } else {
    db.prepare(
      `UPDATE founder_profiles SET
         display_name = ?, consent_directory = ?, consent_credits = ?, consent_case_study = ?, updated_at = ?
       WHERE user_id = ?`
    ).run(
      params.displayName !== undefined ? params.displayName : existing.display_name,
      params.consentDirectory !== undefined ? (params.consentDirectory ? 1 : 0) : existing.consent_directory,
      params.consentCredits !== undefined ? (params.consentCredits ? 1 : 0) : existing.consent_credits,
      params.consentCaseStudy !== undefined ? (params.consentCaseStudy ? 1 : 0) : existing.consent_case_study,
      now,
      params.userId
    );
  }
  return getFounderProfile(params.userId)!;
}

// ---------------------------------------------------------------------------
// Founder Black physical kit fulfillment
// ---------------------------------------------------------------------------

export interface FounderBlackFulfillmentRow {
  id: string;
  founder_purchase_id: string;
  full_name: string | null;
  shipping_address: string | null;
  country: string | null;
  shirt_size: string | null;
  card_status: KitItemStatus;
  certificate_status: KitItemStatus;
  letter_status: KitItemStatus;
  shirt_status: KitItemStatus;
  tracking_number: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getFounderBlackFulfillment(purchaseId: string): FounderBlackFulfillmentRow | null {
  const row = getDb()
    .prepare("SELECT * FROM founder_black_fulfillments WHERE founder_purchase_id = ?")
    .get(purchaseId) as FounderBlackFulfillmentRow | undefined;
  return row ?? null;
}

/** User-submitted shipping details (client panel). Never logs the address — only that it was set. */
export function submitFounderBlackShippingDetails(params: {
  purchaseId: string;
  fullName: string;
  shippingAddress: string;
  country: string;
  shirtSize: string;
}): FounderBlackFulfillmentRow {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getFounderBlackFulfillment(params.purchaseId);
  if (!existing) {
    const id = randomBytes(12).toString("hex");
    db.prepare(
      `INSERT INTO founder_black_fulfillments
         (id, founder_purchase_id, full_name, shipping_address, country, shirt_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, params.purchaseId, params.fullName, params.shippingAddress, params.country, params.shirtSize, now, now);
  } else {
    db.prepare(
      `UPDATE founder_black_fulfillments
       SET full_name = ?, shipping_address = ?, country = ?, shirt_size = ?, updated_at = ?
       WHERE founder_purchase_id = ?`
    ).run(params.fullName, params.shippingAddress, params.country, params.shirtSize, now, params.purchaseId);
  }
  console.info(`[founders] shipping details submitted for purchase ${params.purchaseId}`);
  return getFounderBlackFulfillment(params.purchaseId)!;
}

const KIT_STATUS_FIELDS = ["card_status", "certificate_status", "letter_status", "shirt_status"] as const;
export type KitStatusField = (typeof KIT_STATUS_FIELDS)[number];
export function isKitStatusField(value: unknown): value is KitStatusField {
  return typeof value === "string" && (KIT_STATUS_FIELDS as readonly string[]).includes(value);
}

/** Admin action — marks one kit item pending/prepared/shipped, then rolls up `founder_purchases.fulfillment_status`. */
export function updateFounderBlackKitStatus(
  purchaseId: string,
  field: KitStatusField,
  status: KitItemStatus
): FounderBlackFulfillmentRow | null {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getFounderBlackFulfillment(purchaseId);
  if (!existing) return null;
  db.prepare(`UPDATE founder_black_fulfillments SET ${field} = ?, updated_at = ? WHERE founder_purchase_id = ?`).run(
    status,
    now,
    purchaseId
  );
  const updated = getFounderBlackFulfillment(purchaseId)!;
  const statuses = KIT_STATUS_FIELDS.map((f) => updated[f]);
  const rollup: FounderFulfillmentStatus = statuses.every((s) => s === "shipped")
    ? "COMPLETED"
    : statuses.some((s) => s !== "pending")
      ? "IN_PROGRESS"
      : "PENDING";
  db.prepare("UPDATE founder_purchases SET fulfillment_status = ?, updated_at = ? WHERE id = ?").run(
    rollup,
    now,
    purchaseId
  );
  return updated;
}

/** Admin action — never logged verbatim (tracking numbers are fine to log, but keep the call site explicit). */
export function setFounderBlackTracking(purchaseId: string, trackingNumber: string): FounderBlackFulfillmentRow | null {
  const db = getDb();
  const now = new Date().toISOString();
  if (!getFounderBlackFulfillment(purchaseId)) return null;
  db.prepare(
    "UPDATE founder_black_fulfillments SET tracking_number = ?, shipped_at = ?, updated_at = ? WHERE founder_purchase_id = ?"
  ).run(trackingNumber, now, now, purchaseId);
  return getFounderBlackFulfillment(purchaseId);
}
