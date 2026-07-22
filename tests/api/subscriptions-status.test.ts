import { beforeAll, describe, expect, it } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { POST as register } from "@/app/api/register/route";
import { GET as subscriptionStatus } from "@/app/api/subscriptions/status/route";
import { upsertAppleSubscription, upsertStripeSubscription } from "@/lib/subscriptions";

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  return res.json();
}

describe("GET /api/subscriptions/status", () => {
  it("requires authorization", async () => {
    const res = await subscriptionStatus(new Request("http://localhost/api/subscriptions/status"));
    expect(res.status).toBe(401);
  });

  it("reports NONE / not pro for a fresh account", async () => {
    const reg = await registerUser("no-sub@example.com");
    const res = await subscriptionStatus(
      authedRequest("http://localhost/api/subscriptions/status", reg.token)
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.subscription).toEqual({
      is_pro: false,
      source: "NONE",
      status: "inactive",
      plan: "UNKNOWN",
      subscription_id: null,
      product_id: null,
      price_id: null,
      started_at: null,
      environment: null,
      current_period_end: null,
      auto_renew: false,
    });
  });

  it("correctly identifies a Stripe-sourced Pro subscription", async () => {
    const reg = await registerUser("stripe-sub@example.com");
    const future = Math.floor(Date.now() / 1000) + 3600;
    upsertStripeSubscription({
      userId: reg.user.id,
      subscriptionId: "sub_status_1",
      customerId: "cus_status_1",
      status: "active",
      currentPeriodEnd: future,
      productId: "prod_pro",
      priceId: "price_year",
      plan: "YEARLY",
      autoRenew: true,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_status_1",
    });

    const res = await subscriptionStatus(
      authedRequest("http://localhost/api/subscriptions/status", reg.token)
    );
    const data = await res.json();
    expect(data.subscription.is_pro).toBe(true);
    expect(data.subscription.source).toBe("STRIPE");
    expect(data.subscription.plan).toBe("YEARLY");
    expect(data.subscription.current_period_end).toBe(future);
    expect(data.subscription.subscription_id).toBe("sub_status_1");
    expect(data.subscription.environment).toBe("test");
  });

  it("correctly identifies an Apple-sourced Pro subscription", async () => {
    const reg = await registerUser("apple-sub@example.com");
    const future = Math.floor(Date.now() / 1000) + 3600;
    upsertAppleSubscription({
      userId: reg.user.id,
      originalTransactionId: "apple_txn_status_1",
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

    const res = await subscriptionStatus(
      authedRequest("http://localhost/api/subscriptions/status", reg.token)
    );
    const data = await res.json();
    expect(data.subscription.is_pro).toBe(true);
    expect(data.subscription.source).toBe("APPLE");
    expect(data.subscription.plan).toBe("MONTHLY");
  });

  it("does not grant Pro for a refunded subscription", async () => {
    const reg = await registerUser("refunded-sub@example.com");
    const future = Math.floor(Date.now() / 1000) + 3600;
    upsertStripeSubscription({
      userId: reg.user.id,
      subscriptionId: "sub_status_refunded",
      customerId: "cus_status_refunded",
      status: "refunded",
      currentPeriodEnd: future,
      productId: "prod_pro",
      priceId: "price_month",
      plan: "MONTHLY",
      autoRenew: false,
      startedAt: null,
      canceledAt: null,
      trialEndsAt: null,
      environment: "test",
      eventCreated: 1,
      eventId: "evt_status_refunded",
    });

    const res = await subscriptionStatus(
      authedRequest("http://localhost/api/subscriptions/status", reg.token)
    );
    const data = await res.json();
    expect(data.subscription.is_pro).toBe(false);
    expect(data.subscription.status).toBe("refunded");
  });
});
