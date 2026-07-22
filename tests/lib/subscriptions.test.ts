import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

// Setting DATA_DIR here, before any test body runs, is safe even though
// these modules are imported statically above/below: none of them call
// getDb() at import time, only lazily when a function actually runs.
beforeAll(() => {
  useIsolatedDataDir();
});

import { getDb } from "@/lib/db";
import {
  getActiveSubscriptionForUser,
  getSubscriptionForUser,
  serializeSubscription,
  subscriptionGrantsPro,
  upsertAppleSubscription,
  upsertStripeSubscription,
} from "@/lib/subscriptions";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', datetime('now'))"
    )
    .run(id, `${id}@example.com`);
  return id;
}

describe("subscriptions", () => {
  it("no subscription -> not pro, source NONE", () => {
    const userId = makeUser();
    const sub = getSubscriptionForUser(userId);
    expect(sub).toBeNull();
    expect(serializeSubscription(sub)).toEqual({
      is_pro: false,
      source: "NONE",
      status: "inactive",
      plan: "UNKNOWN",
      product_id: null,
      price_id: null,
      current_period_end: null,
      auto_renew: false,
    });
  });

  it("active Stripe subscription grants Pro with source STRIPE", () => {
    const userId = makeUser();
    const future = Math.floor(Date.now() / 1000) + 3600;
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_1",
      customerId: "cus_1",
      status: "active",
      currentPeriodEnd: future,
      productId: "prod_1",
      priceId: "price_1",
      plan: "YEARLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_1",
    });
    const active = getActiveSubscriptionForUser(userId);
    expect(active).not.toBeNull();
    const serialized = serializeSubscription(active);
    expect(serialized.is_pro).toBe(true);
    expect(serialized.source).toBe("STRIPE");
    expect(serialized.plan).toBe("YEARLY");
  });

  it("active Apple subscription grants Pro with source APPLE", () => {
    const userId = makeUser();
    const future = Math.floor(Date.now() / 1000) + 3600;
    upsertAppleSubscription({
      userId,
      originalTransactionId: "apple_txn_1",
      status: "active",
      currentPeriodEnd: future,
      productId: "com.rentyourtime.pro.monthly",
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "Sandbox",
      eventId: null,
    });
    const active = getActiveSubscriptionForUser(userId);
    expect(active).not.toBeNull();
    const serialized = serializeSubscription(active);
    expect(serialized.is_pro).toBe(true);
    expect(serialized.source).toBe("APPLE");
    expect(serialized.plan).toBe("MONTHLY");
  });

  it("expired current_period_end does not grant Pro", () => {
    const userId = makeUser();
    const past = Math.floor(Date.now() / 1000) - 3600;
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_2",
      customerId: "cus_2",
      status: "active",
      currentPeriodEnd: past,
      productId: null,
      priceId: null,
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_2",
    });
    expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(false);
  });

  it.each(["canceled", "refunded", "expired", "inactive", "past_due"])(
    "status=%s never grants Pro even with a future period end",
    (status) => {
      const userId = makeUser();
      const future = Math.floor(Date.now() / 1000) + 3600;
      upsertStripeSubscription({
        userId,
        subscriptionId: `sub_${status}`,
        customerId: "cus_3",
        status,
        currentPeriodEnd: future,
        productId: null,
        priceId: null,
        plan: "MONTHLY",
        autoRenew: false,
        startedAt: null,
        canceledAt: null,
        trialEndsAt: null,
        environment: "test",
        eventCreated: 1,
        eventId: `evt_${status}`,
      });
      expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(false);
    }
  );

  it("trialing grants Pro", () => {
    const userId = makeUser();
    const future = Math.floor(Date.now() / 1000) + 3600;
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_trial",
      customerId: "cus_4",
      status: "trialing",
      currentPeriodEnd: future,
      productId: null,
      priceId: null,
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: String(future),
      environment: "test",
      eventCreated: 1,
      eventId: "evt_trial",
    });
    expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(true);
  });

  it("out-of-order events do not overwrite a newer row", () => {
    const userId = makeUser();
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_order",
      customerId: "cus_5",
      status: "active",
      currentPeriodEnd: null,
      productId: null,
      priceId: null,
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 100,
      eventId: "evt_new",
    });
    // An older event (lower eventCreated) arrives late — must not win.
    upsertStripeSubscription({
      userId,
      subscriptionId: "sub_order",
      customerId: "cus_5",
      status: "canceled",
      currentPeriodEnd: null,
      productId: null,
      priceId: null,
      plan: "MONTHLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 50,
      eventId: "evt_old",
    });
    expect(getSubscriptionForUser(userId)?.status).toBe("active");
  });
});
