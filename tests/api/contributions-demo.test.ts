import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake_secret";
});

import { POST as register } from "@/app/api/register/route";
import { GET as history } from "@/app/api/contributions/route";
import { POST as webhook } from "@/app/api/webhook/route";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getSubscriptionForUser } from "@/lib/subscriptions";
import { createPendingContribution, getContributionById, markContributionPaid } from "@/lib/contributions";

const ENV_KEYS = ["NODE_ENV", "ENABLE_SUPPORT_DEMO", "SUPPORT_DEMO_ACCRUED_RENT_CENTS", "SUPPORT_DEMO_CURRENCY"] as const;
let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  (process.env as Record<string, string | undefined>).NODE_ENV ="development";
  process.env.ENABLE_SUPPORT_DEMO = "true";
  process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
  process.env.SUPPORT_DEMO_CURRENCY = "usd";
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = snapshot[k];
  }
});

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  return res.json();
}

function setRealAccruedRent(userId: string, cents: number, currency = "usd") {
  getDb()
    .prepare("UPDATE users SET accrued_rent_cents = ?, accrued_rent_currency = ? WHERE id = ?")
    .run(cents, currency, userId);
}

describe("GET /api/contributions — demo mode", () => {
  it("reports demo accrued rent for an account with no real ledger", async () => {
    const user = await registerUser("contrib-demo-fallback@example.com");
    const res = await history(authedRequest("http://localhost/api/contributions", user.token));
    const data = await res.json();
    expect(data.data.isDemoAccruedRent).toBe(true);
    expect(data.data.accruedRentCents).toBe(2840);
    expect(data.data.currency).toBe("usd");
  });

  it("prefers real ledger data over demo at the API level too", async () => {
    const user = await registerUser("contrib-demo-real-wins@example.com");
    setRealAccruedRent(user.user.id, 500, "eur");
    const res = await history(authedRequest("http://localhost/api/contributions", user.token));
    const data = await res.json();
    expect(data.data.isDemoAccruedRent).toBe(false);
    expect(data.data.accruedRentCents).toBe(500);
    expect(data.data.currency).toBe("eur");
  });

  it("ignores demo env entirely when NODE_ENV=production", async () => {
    const user = await registerUser("contrib-demo-prod@example.com");
    (process.env as Record<string, string | undefined>).NODE_ENV ="production";
    const res = await history(authedRequest("http://localhost/api/contributions", user.token));
    const data = await res.json();
    expect(data.data.isDemoAccruedRent).toBe(false);
    expect(data.data.accruedRentCents).toBeNull();
  });

  it("tags demo-sourced contributions and totals them separately from the main total", async () => {
    const user = await registerUser("contrib-demo-totals@example.com");

    const demo = createPendingContribution({
      userId: user.user.id,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
      isDemo: true,
    });
    markContributionPaid({ id: demo.id, paymentIntentId: "pi_demo_1", stripeEventId: "evt_demo_1" });

    const real = createPendingContribution({
      userId: user.user.id,
      percentage: 25,
      accruedRentCents: 500,
      amountCents: 125,
      currency: "usd",
      isDemo: false,
    });
    markContributionPaid({ id: real.id, paymentIntentId: "pi_real_1", stripeEventId: "evt_real_1" });

    const res = await history(authedRequest("http://localhost/api/contributions", user.token));
    const data = await res.json();

    const demoRow = data.data.contributions.find((c: { id: string }) => c.id === demo.id);
    const realRow = data.data.contributions.find((c: { id: string }) => c.id === real.id);
    expect(demoRow.isDemo).toBe(true);
    expect(realRow.isDemo).toBe(false);

    expect(data.data.totalContributedCents).toBe(284 + 125);
    expect(data.data.demoTestPaymentsCents).toBe(284);
  });
});

function signedRequest(eventObj: unknown): Request {
  const payload = JSON.stringify(eventObj);
  const header = getStripe().webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return new Request("http://localhost/api/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

describe("webhook settlement of a demo-sourced contribution", () => {
  it("settles it PAID exactly like any other contribution, and never grants Pro", async () => {
    const user = await registerUser("contrib-demo-webhook@example.com");
    const c = createPendingContribution({
      userId: user.user.id,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
      isDemo: true,
    });
    getDb()
      .prepare("UPDATE contributions SET stripe_checkout_session_id = ? WHERE id = ?")
      .run(`cs_${c.id}`, c.id);

    const res = await webhook(
      signedRequest({
        id: "evt_demo_webhook_1",
        type: "checkout.session.completed",
        created: 1000,
        livemode: false,
        data: {
          object: {
            id: `cs_${c.id}`,
            object: "checkout.session",
            mode: "payment",
            payment_status: "paid",
            amount_total: 284,
            currency: "usd",
            customer: null,
            client_reference_id: null,
            subscription: null,
            payment_intent: "pi_demo_webhook_1",
            metadata: { kind: "contribution", contributionId: c.id, userId: user.user.id, source: "demo", environment: "development" },
          },
        },
      })
    );
    expect(res.status).toBe(200);

    const updated = getContributionById(c.id)!;
    expect(updated.status).toBe("PAID");
    expect(updated.is_demo_source).toBe(1);
    expect(getSubscriptionForUser(user.user.id)).toBeNull();
  });
});
