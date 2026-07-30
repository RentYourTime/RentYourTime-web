import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { upsertStripeSubscription } from "@/lib/subscriptions";
import { getUserAccess, grantManualEntitlement } from "@/server/entitlements";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', ?)`)
    .run(id, `${id}@example.com`, new Date().toISOString());
  return id;
}

function insertFounderTier(overrides: Partial<{ isLifetime: boolean; earlyAccessDays: number }> = {}): string {
  const id = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO founder_tiers (id, slug, name, price_cents, currency, total_quantity, sold_quantity, is_lifetime_pro, early_access_days, created_at, updated_at)
       VALUES (?, ?, 'Tier', 10000, 'usd', 100, 0, ?, ?, ?, ?)`
    )
    .run(id, id, overrides.isLifetime ? 1 : 0, overrides.earlyAccessDays ?? 0, now, now);
  return id;
}

function insertPaidFounderPurchase(
  userId: string,
  tierId: string,
  opts: { isLifetime: boolean; proEndsAt: string | null }
): void {
  const id = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO founder_purchases
         (id, user_id, founder_tier_id, founder_number, amount_cents, currency, payment_status, is_lifetime_pro, pro_starts_at, pro_ends_at, created_at, updated_at)
       VALUES (?, ?, ?, 1, 10000, 'usd', 'PAID', ?, ?, ?, ?, ?)`
    )
    .run(id, userId, tierId, opts.isLifetime ? 1 : 0, now, opts.proEndsAt, now, now);
}

describe("EntitlementService.getUserAccess", () => {
  it("grants nothing for a user with no entitlements", () => {
    const userId = makeUser();
    const access = getUserAccess(userId);
    expect(access.isPro).toBe(false);
    expect(access.isFounder).toBe(false);
    expect(access.status).toBe("INACTIVE");
    expect(access.sources).toEqual([]);
  });

  it("grants Pro from an active Stripe subscription", () => {
    const userId = makeUser();
    const futureEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_1",
      customerId: "cus_1",
      status: "active",
      currentPeriodEnd: futureEnd,
      productId: "prod_1",
      priceId: "price_1",
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_1",
    });

    const access = getUserAccess(userId);
    expect(access.isPro).toBe(true);
    expect(access.sources).toEqual(["STRIPE"]);
    expect(access.plan).toBe("MONTHLY");
    expect(access.expiresAt).toBe(new Date(futureEnd * 1000).toISOString());
  });

  it("Founder grants Pro independently, even with no Stripe subscription at all", () => {
    const userId = makeUser();
    const tierId = insertFounderTier({ isLifetime: false });
    const proEndsAt = new Date(Date.now() + 365 * 86400_000).toISOString();
    insertPaidFounderPurchase(userId, tierId, { isLifetime: false, proEndsAt });

    const access = getUserAccess(userId);
    expect(access.isPro).toBe(true);
    expect(access.isFounder).toBe(true);
    expect(access.sources).toEqual(["FOUNDER"]);
    expect(access.expiresAt).toBe(proEndsAt);
  });

  it("Stripe and Founder can both be active at once, and lifetime Founder wins the expiry merge", () => {
    const userId = makeUser();
    const futureEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_2",
      customerId: "cus_2",
      status: "active",
      currentPeriodEnd: futureEnd,
      productId: "prod_1",
      priceId: "price_1",
      plan: "YEARLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_2",
    });
    const tierId = insertFounderTier({ isLifetime: true });
    insertPaidFounderPurchase(userId, tierId, { isLifetime: true, proEndsAt: null });

    const access = getUserAccess(userId);
    expect(access.isPro).toBe(true);
    expect(access.isFounder).toBe(true);
    expect(access.sources.sort()).toEqual(["FOUNDER", "STRIPE"]);
    expect(access.plan).toBe("LIFETIME");
    // Lifetime (no end date) wins outright over Stripe's finite current_period_end.
    expect(access.expiresAt).toBeNull();
  });

  it("a Stripe refund removes only Stripe access, leaving Founder access untouched", () => {
    const userId = makeUser();
    const tierId = insertFounderTier({ isLifetime: false });
    const proEndsAt = new Date(Date.now() + 365 * 86400_000).toISOString();
    insertPaidFounderPurchase(userId, tierId, { isLifetime: false, proEndsAt });

    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_3",
      customerId: "cus_3",
      status: "active",
      currentPeriodEnd: Math.floor(Date.now() / 1000) + 30 * 86400,
      productId: "prod_1",
      priceId: "price_1",
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_3",
    });

    // Simulate the webhook's charge.refunded handling: subscriptions.status -> 'refunded'.
    getDb().prepare("UPDATE subscriptions SET status = 'refunded' WHERE user_id = ?").run(userId);

    const access = getUserAccess(userId);
    expect(access.isPro).toBe(true); // still true — from Founder
    expect(access.isFounder).toBe(true);
    expect(access.sources).toEqual(["FOUNDER"]); // STRIPE no longer present
  });

  it("an expired (non-lifetime) Founder purchase no longer grants access", () => {
    const userId = makeUser();
    const tierId = insertFounderTier({ isLifetime: false });
    const pastEnd = new Date(Date.now() - 86400_000).toISOString();
    insertPaidFounderPurchase(userId, tierId, { isLifetime: false, proEndsAt: pastEnd });

    const access = getUserAccess(userId);
    expect(access.isPro).toBe(false);
    expect(access.isFounder).toBe(false);
  });

  it("a manual ADMIN grant is independent of every provider source", () => {
    const userId = makeUser();
    const adminId = makeUser();
    grantManualEntitlement({
      userId,
      type: "PRO",
      source: "ADMIN",
      endsAt: null,
      grantedByUserId: adminId,
    });

    const access = getUserAccess(userId);
    expect(access.isPro).toBe(true);
    expect(access.sources).toEqual(["ADMIN"]);
    expect(access.expiresAt).toBeNull();
  });
});
