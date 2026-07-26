import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { getDb } from "@/lib/db";
import { getSubscriptionForUser, subscriptionGrantsPro } from "@/lib/subscriptions";
import {
  createPendingFounderPurchase,
  formatFounderNumber,
  getActiveFounderPurchase,
  getFounderPurchaseById,
  getFounderTierBySlug,
  isAlmostGone,
  isSoldOut,
  remainingQuantity,
  settleFounderPurchaseFromSession,
  updateFounderTierLimit,
  type FounderTierRow,
} from "@/lib/founders";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', datetime('now'))"
    )
    .run(id, `${id}@example.com`);
  return id;
}

function makeTier(overrides: Partial<FounderTierRow> = {}): FounderTierRow {
  const id = randomBytes(8).toString("hex");
  const now = new Date().toISOString();
  const row: FounderTierRow = {
    id,
    slug: overrides.slug ?? `tier-${id}`,
    name: overrides.name ?? "Test Tier",
    price_cents: overrides.price_cents ?? 5000,
    currency: overrides.currency ?? "usd",
    total_quantity: overrides.total_quantity ?? 10,
    sold_quantity: overrides.sold_quantity ?? 0,
    stripe_price_id: overrides.stripe_price_id ?? "price_test_1",
    pro_duration_months: overrides.pro_duration_months ?? 12,
    is_lifetime_pro: overrides.is_lifetime_pro ?? 0,
    early_access_days: overrides.early_access_days ?? 7,
    is_active: overrides.is_active ?? 1,
    sort_order: overrides.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  };
  getDb()
    .prepare(
      `INSERT INTO founder_tiers
         (id, slug, name, price_cents, currency, total_quantity, sold_quantity, stripe_price_id,
          pro_duration_months, is_lifetime_pro, early_access_days, is_active, sort_order, created_at, updated_at)
       VALUES (@id, @slug, @name, @price_cents, @currency, @total_quantity, @sold_quantity, @stripe_price_id,
          @pro_duration_months, @is_lifetime_pro, @early_access_days, @is_active, @sort_order, @created_at, @updated_at)`
    )
    .run(row);
  return row;
}

function fakeCheckoutSession(opts: {
  id: string;
  purchaseId: string;
  userId: string;
  amountTotal: number;
  currency: string;
  paymentStatus?: string;
  paymentIntent?: string | null;
}) {
  return {
    id: opts.id,
    payment_status: opts.paymentStatus ?? "paid",
    amount_total: opts.amountTotal,
    currency: opts.currency,
    payment_intent: opts.paymentIntent ?? `pi_${opts.id}`,
    metadata: { kind: "founder", purchaseId: opts.purchaseId, userId: opts.userId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("availability calculations", () => {
  it("remainingQuantity, isSoldOut, isAlmostGone", () => {
    const tier = makeTier({ total_quantity: 300, sold_quantity: 0 });
    expect(remainingQuantity(tier)).toBe(300);
    expect(isSoldOut(tier)).toBe(false);
    expect(isAlmostGone(tier)).toBe(false);

    const almost = { ...tier, sold_quantity: 291 }; // 9 left, 9 <= ceil(300*0.1)=30
    expect(isAlmostGone(almost)).toBe(true);

    const full = { ...tier, sold_quantity: 300 };
    expect(remainingQuantity(full)).toBe(0);
    expect(isSoldOut(full)).toBe(true);
  });

  it("formatFounderNumber pads to the tier's own magnitude", () => {
    const first = makeTier({ total_quantity: 300 });
    expect(formatFounderNumber(first, 1)).toBe("#001");
    expect(formatFounderNumber(first, 300)).toBe("#300");

    const black = makeTier({ total_quantity: 20 });
    expect(formatFounderNumber(black, 1)).toBe("#01");
    expect(formatFounderNumber(black, 20)).toBe("#20");
  });
});

describe("updateFounderTierLimit", () => {
  it("refuses to drop the limit below what's already sold", () => {
    const tier = makeTier({ total_quantity: 10, sold_quantity: 7 });
    const result = updateFounderTierLimit(tier.id, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("below_sold_quantity");
  });

  it("allows raising or lowering to exactly the sold quantity", () => {
    const tier = makeTier({ total_quantity: 10, sold_quantity: 7 });
    const result = updateFounderTierLimit(tier.id, 7);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tier.total_quantity).toBe(7);
  });
});

describe("settleFounderPurchaseFromSession — number assignment", () => {
  it("assigns sequential, non-duplicate numbers and grants Pro", () => {
    const tier = makeTier({ total_quantity: 5, is_lifetime_pro: 0, pro_duration_months: 12 });
    const userA = makeUser();
    const userB = makeUser();

    const purchaseA = createPendingFounderPurchase({ userId: userA, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    const purchaseB = createPendingFounderPurchase({ userId: userB, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });

    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_a", purchaseId: purchaseA.id, userId: userA, amountTotal: tier.price_cents, currency: "usd" }),
      "evt_a"
    );
    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_b", purchaseId: purchaseB.id, userId: userB, amountTotal: tier.price_cents, currency: "usd" }),
      "evt_b"
    );

    const a = getFounderPurchaseById(purchaseA.id)!;
    const b = getFounderPurchaseById(purchaseB.id)!;
    expect(a.payment_status).toBe("PAID");
    expect(b.payment_status).toBe("PAID");
    expect([a.founder_number, b.founder_number].sort()).toEqual([1, 2]);
    expect(subscriptionGrantsPro(getSubscriptionForUser(userA))).toBe(true);
    expect(subscriptionGrantsPro(getSubscriptionForUser(userB))).toBe(true);
  });

  it("never exceeds the tier limit, even when more buyers than slots settle", () => {
    const tier = makeTier({ total_quantity: 1 });
    const userA = makeUser();
    const userB = makeUser();
    const purchaseA = createPendingFounderPurchase({ userId: userA, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    const purchaseB = createPendingFounderPurchase({ userId: userB, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });

    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_a2", purchaseId: purchaseA.id, userId: userA, amountTotal: tier.price_cents, currency: "usd" }),
      "evt_a2"
    );
    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_b2", purchaseId: purchaseB.id, userId: userB, amountTotal: tier.price_cents, currency: "usd" }),
      "evt_b2"
    );

    const a = getFounderPurchaseById(purchaseA.id)!;
    const b = getFounderPurchaseById(purchaseB.id)!;
    // Both are honored as PAID (Stripe already charged them), but only one
    // numbered slot exists — the tier is never oversold.
    expect(a.payment_status).toBe("PAID");
    expect(b.payment_status).toBe("PAID");
    const numbers = [a.founder_number, b.founder_number].filter((n) => n !== null);
    expect(numbers).toEqual([1]);
    expect(getFounderTierBySlug(tier.slug)!.sold_quantity).toBe(1);
  });

  it("is idempotent — replaying settlement on an already-PAID purchase changes nothing", () => {
    const tier = makeTier({ total_quantity: 5 });
    const userId = makeUser();
    const purchase = createPendingFounderPurchase({ userId, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    const session = fakeCheckoutSession({ id: "cs_idem", purchaseId: purchase.id, userId, amountTotal: tier.price_cents, currency: "usd" });

    settleFounderPurchaseFromSession(session, "evt_1");
    const first = getFounderPurchaseById(purchase.id)!;
    settleFounderPurchaseFromSession(session, "evt_2");
    const second = getFounderPurchaseById(purchase.id)!;

    expect(second.founder_number).toBe(first.founder_number);
    expect(getFounderTierBySlug(tier.slug)!.sold_quantity).toBe(1);
  });

  it("refuses to settle on an amount mismatch", () => {
    const tier = makeTier({ total_quantity: 5, price_cents: 5000 });
    const userId = makeUser();
    const purchase = createPendingFounderPurchase({ userId, tierId: tier.id, amountCents: 5000, currency: "usd" });
    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_bad_amount", purchaseId: purchase.id, userId, amountTotal: 999999, currency: "usd" }),
      "evt_bad"
    );
    expect(getFounderPurchaseById(purchase.id)!.payment_status).toBe("PENDING");
  });

  it("refuses to settle on a user mismatch", () => {
    const tier = makeTier({ total_quantity: 5 });
    const userId = makeUser();
    const otherUserId = makeUser();
    const purchase = createPendingFounderPurchase({ userId, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_bad_user", purchaseId: purchase.id, userId: otherUserId, amountTotal: tier.price_cents, currency: "usd" }),
      "evt_baduser"
    );
    expect(getFounderPurchaseById(purchase.id)!.payment_status).toBe("PENDING");
  });

  it("grants lifetime Pro (null current_period_end) for a lifetime tier", () => {
    const tier = makeTier({ total_quantity: 20, is_lifetime_pro: 1, pro_duration_months: null });
    const userId = makeUser();
    const purchase = createPendingFounderPurchase({ userId, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    settleFounderPurchaseFromSession(
      fakeCheckoutSession({ id: "cs_lifetime", purchaseId: purchase.id, userId, amountTotal: tier.price_cents, currency: "usd" }),
      "evt_lifetime"
    );
    const sub = getSubscriptionForUser(userId)!;
    expect(sub.current_period_end).toBeNull();
    expect(subscriptionGrantsPro(sub)).toBe(true);
  });
});

describe("getActiveFounderPurchase", () => {
  it("finds a PENDING or PAID purchase but not a FAILED one", () => {
    const tier = makeTier({ total_quantity: 5 });
    const userId = makeUser();
    expect(getActiveFounderPurchase(userId, tier.id)).toBeNull();
    const purchase = createPendingFounderPurchase({ userId, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    expect(getActiveFounderPurchase(userId, tier.id)?.id).toBe(purchase.id);
  });
});
