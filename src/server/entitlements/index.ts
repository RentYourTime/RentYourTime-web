import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { getSubscriptionForUser, subscriptionGrantsPro } from "@/lib/subscriptions";
import { recordAudit } from "@/server/audit";

/**
 * EntitlementService (§13) — a read-side merge, never a new write path.
 * STRIPE/APPLE come from `subscriptions` (written only by the existing
 * Stripe/Apple webhooks, src/lib/subscriptions.ts). FOUNDER comes straight
 * from `founder_purchases`/`founder_tiers` (src/lib/founders.ts) — not from
 * `subscriptions.source = 'MANUAL'`, even though `grantFounderPro()` does
 * also write a MANUAL row there for `subscriptionGrantsPro()`'s benefit
 * elsewhere in the app; re-deriving Founder access independently here means
 * a refunded/failed purchase can never leave a stale MANUAL row granting
 * Pro through this service. ADMIN/PROMO come from the new `entitlements`
 * table, which only an admin action writes — never client input.
 */

export type EntitlementSource = "APPLE" | "STRIPE" | "FOUNDER" | "ADMIN" | "PROMO";
export type EntitlementPlan = "MONTHLY" | "YEARLY" | "LIFETIME" | "UNKNOWN";
export type EntitlementStatus = "ACTIVE" | "INACTIVE";
export type ManualEntitlementType = "PRO" | "FOUNDER" | "EARLY_ACCESS";

export interface UserAccess {
  isPro: boolean;
  isFounder: boolean;
  earlyAccess: boolean;
  sources: EntitlementSource[];
  primaryProvider: EntitlementSource | null;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  expiresAt: string | null;
  features: string[];
}

interface ManualEntitlementRow {
  id: string;
  user_id: string;
  type: string;
  source: string;
  starts_at: string;
  ends_at: string | null;
  metadata: string | null;
  revoked_at: string | null;
}

function activeManualEntitlements(userId: string): ManualEntitlementRow[] {
  const now = new Date().toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM entitlements
       WHERE user_id = ? AND revoked_at IS NULL AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)`
    )
    .all(userId, now, now) as ManualEntitlementRow[];
}

interface FounderAccessRow {
  is_lifetime_pro: number;
  pro_ends_at: string | null;
  early_access_days: number;
}

function activeFounderPurchase(userId: string): FounderAccessRow | null {
  const now = new Date().toISOString();
  const row = getDb()
    .prepare(
      `SELECT p.is_lifetime_pro, p.pro_ends_at, t.early_access_days
       FROM founder_purchases p JOIN founder_tiers t ON t.id = p.founder_tier_id
       WHERE p.user_id = ? AND p.payment_status = 'PAID' AND (p.is_lifetime_pro = 1 OR p.pro_ends_at IS NULL OR p.pro_ends_at > ?)
       ORDER BY p.is_lifetime_pro DESC, p.created_at DESC LIMIT 1`
    )
    .get(userId, now) as FounderAccessRow | undefined;
  return row ?? null;
}

export function getUserAccess(userId: string): UserAccess {
  const sources = new Set<EntitlementSource>();
  let isPro = false;
  let isFounder = false;
  let earlyAccess = false;
  let plan: EntitlementPlan = "UNKNOWN";
  let primaryProvider: EntitlementSource | null = null;
  let anyLifetime = false;
  let latestExpiryMs: number | null = null;

  const considerExpiry = (endsAtIso: string | null) => {
    if (endsAtIso === null) {
      anyLifetime = true;
      return;
    }
    const t = new Date(endsAtIso).getTime();
    if (latestExpiryMs === null || t > latestExpiryMs) latestExpiryMs = t;
  };

  const sub = getSubscriptionForUser(userId);
  if (sub && (sub.source === "STRIPE" || sub.source === "APPLE") && subscriptionGrantsPro(sub)) {
    isPro = true;
    sources.add(sub.source);
    primaryProvider = sub.source;
    if (sub.plan === "MONTHLY" || sub.plan === "YEARLY") plan = sub.plan;
    considerExpiry(sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null);
  }

  const founder = activeFounderPurchase(userId);
  if (founder) {
    isFounder = true;
    isPro = true; // Founder always implies Pro, independent of any Stripe/Apple state (§13).
    sources.add("FOUNDER");
    if (!primaryProvider) primaryProvider = "FOUNDER";
    if (founder.is_lifetime_pro) {
      plan = "LIFETIME";
      considerExpiry(null);
    } else {
      considerExpiry(founder.pro_ends_at);
    }
    if (founder.early_access_days > 0) earlyAccess = true;
  }

  for (const row of activeManualEntitlements(userId)) {
    const source = row.source === "ADMIN" || row.source === "PROMO" ? row.source : null;
    if (!source) continue;
    sources.add(source);
    if (!primaryProvider) primaryProvider = source;
    if (row.type === "PRO") {
      isPro = true;
      considerExpiry(row.ends_at);
      if (!row.ends_at && plan === "UNKNOWN") plan = "LIFETIME";
    }
    if (row.type === "FOUNDER") isFounder = true;
    if (row.type === "EARLY_ACCESS") earlyAccess = true;
  }

  const expiresAt = isPro ? (anyLifetime ? null : latestExpiryMs !== null ? new Date(latestExpiryMs).toISOString() : null) : null;

  return {
    isPro,
    isFounder,
    earlyAccess,
    sources: Array.from(sources),
    primaryProvider,
    plan,
    status: isPro || isFounder ? "ACTIVE" : "INACTIVE",
    expiresAt,
    features: [],
  };
}

export interface GrantManualEntitlementParams {
  userId: string;
  type: ManualEntitlementType;
  source: "ADMIN" | "PROMO";
  endsAt: string | null;
  metadata?: Record<string, unknown>;
  grantedByUserId: string;
}

/** Admin-only primitive (no route wires this up yet — see docs/ENTITLEMENTS.md "Not built in this pass"). Never reachable from client input. */
export function grantManualEntitlement(params: GrantManualEntitlementParams): string {
  const id = randomBytes(12).toString("hex");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO entitlements (id, user_id, type, source, starts_at, ends_at, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, params.userId, params.type, params.source, now, params.endsAt, params.metadata ? JSON.stringify(params.metadata) : null, now, now);
  recordAudit({
    userId: params.grantedByUserId,
    action: "entitlement.granted",
    entityType: "entitlement",
    entityId: id,
    metadata: { targetUserId: params.userId, type: params.type, source: params.source },
  });
  return id;
}

export function revokeManualEntitlement(entitlementId: string, revokedByUserId: string): void {
  getDb()
    .prepare("UPDATE entitlements SET revoked_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL")
    .run(new Date().toISOString(), new Date().toISOString(), entitlementId);
  recordAudit({
    userId: revokedByUserId,
    action: "entitlement.revoked",
    entityType: "entitlement",
    entityId: entitlementId,
  });
}
