import { beforeAll, describe, expect, it, vi } from "vitest";
import { jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake_secret";
});

import { POST as webhook } from "@/app/api/webhook/route";
import { POST as register } from "@/app/api/register/route";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getSubscriptionForUser, subscriptionGrantsPro } from "@/lib/subscriptions";
import { createPendingFounderPurchase, getFounderPurchaseById } from "@/lib/founders";

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

async function makeUser(email: string): Promise<string> {
  const res = await register(jsonRequest("http://localhost/api/register", { body: { email, password: "StrongPassword123!" } }));
  const data = await res.json();
  return data.user.id as string;
}

function insertTier(overrides: Record<string, unknown> = {}) {
  const id = Math.random().toString(36).slice(2);
  const now = new Date().toISOString();
  const row = {
    id,
    slug: "founder-first",
    name: "Founder First",
    price_cents: 5000,
    currency: "usd",
    total_quantity: 300,
    sold_quantity: 0,
    stripe_price_id: "price_test_first",
    pro_duration_months: 12,
    is_lifetime_pro: 0,
    early_access_days: 7,
    is_active: 1,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
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

function seedPurchase(userId: string, tier: ReturnType<typeof insertTier>) {
  const purchase = createPendingFounderPurchase({
    userId,
    tierId: tier.id,
    amountCents: tier.price_cents,
    currency: "usd",
  });
  getDb()
    .prepare("UPDATE founder_purchases SET stripe_checkout_session_id = ? WHERE id = ?")
    .run(`cs_${purchase.id}`, purchase.id);
  return purchase;
}

function checkoutCompletedEvent(opts: {
  id: string;
  created: number;
  sessionId: string;
  purchaseId: string;
  userId: string;
  paymentStatus: string;
  amountTotal: number;
  currency: string;
  paymentIntent?: string | null;
}) {
  return {
    id: opts.id,
    type: "checkout.session.completed",
    created: opts.created,
    livemode: false,
    data: {
      object: {
        id: opts.sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: opts.paymentStatus,
        amount_total: opts.amountTotal,
        currency: opts.currency,
        customer: null,
        client_reference_id: null,
        subscription: null,
        payment_intent: opts.paymentIntent ?? null,
        metadata: { kind: "founder", purchaseId: opts.purchaseId, userId: opts.userId },
      },
    },
  };
}

function chargeRefundedEvent(opts: { id: string; created: number; chargeId: string; paymentIntentId: string; amountRefunded: number; amount: number }) {
  return {
    id: opts.id,
    type: "charge.refunded",
    created: opts.created,
    livemode: false,
    data: {
      object: {
        id: opts.chargeId,
        object: "charge",
        amount: opts.amount,
        amount_refunded: opts.amountRefunded,
        currency: "usd",
        customer: null,
        payment_intent: opts.paymentIntentId,
        refunded: opts.amountRefunded >= opts.amount,
        status: "succeeded",
      },
    },
  };
}

describe("POST /api/webhook — Founder Program", () => {
  it("settles PAID, assigns a founder number, and grants Pro", async () => {
    const tier = insertTier({ slug: "founder-first-wh1" });
    const userId = await makeUser("founder-wh-paid@example.com");
    const purchase = seedPurchase(userId, tier);

    const res = await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_founder_paid_1",
          created: 1000,
          sessionId: `cs_${purchase.id}`,
          purchaseId: purchase.id,
          userId,
          paymentStatus: "paid",
          amountTotal: tier.price_cents,
          currency: "usd",
          paymentIntent: "pi_founder_1",
        })
      )
    );
    expect(res.status).toBe(200);

    const updated = getFounderPurchaseById(purchase.id)!;
    expect(updated.payment_status).toBe("PAID");
    expect(updated.founder_number).toBe(1);
    expect(updated.stripe_payment_intent_id).toBe("pi_founder_1");
    expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(true);
  });

  it("refuses to settle on an amount mismatch", async () => {
    const tier = insertTier({ slug: "founder-first-wh2" });
    const userId = await makeUser("founder-wh-amount@example.com");
    const purchase = seedPurchase(userId, tier);

    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_founder_amount_1",
          created: 1000,
          sessionId: `cs_${purchase.id}`,
          purchaseId: purchase.id,
          userId,
          paymentStatus: "paid",
          amountTotal: 999999,
          currency: "usd",
        })
      )
    );
    expect(getFounderPurchaseById(purchase.id)!.payment_status).toBe("PENDING");
  });

  it("replaying the same completed event id does not re-process (webhook_events dedupe)", async () => {
    const tier = insertTier({ slug: "founder-first-wh3" });
    const userId = await makeUser("founder-wh-replay@example.com");
    const purchase = seedPurchase(userId, tier);
    const event = checkoutCompletedEvent({
      id: "evt_founder_replay_1",
      created: 1000,
      sessionId: `cs_${purchase.id}`,
      purchaseId: purchase.id,
      userId,
      paymentStatus: "paid",
      amountTotal: tier.price_cents,
      currency: "usd",
      paymentIntent: "pi_replay_1",
    });

    const res1 = await webhook(signedRequest(event));
    expect((await res1.json()).duplicate).toBeUndefined();
    const res2 = await webhook(signedRequest(event));
    expect((await res2.json()).duplicate).toBe(true);

    expect(getFounderPurchaseById(purchase.id)!.payment_status).toBe("PAID");
    expect(getFounderPurchaseById(purchase.id)!.founder_number).toBe(1);
  });

  it("does not double-decrement availability across a duplicate delivery with a different event id", async () => {
    const tier = insertTier({ slug: "founder-first-wh4" });
    const userId = await makeUser("founder-wh-nodouble@example.com");
    const purchase = seedPurchase(userId, tier);
    const session = checkoutCompletedEvent({
      id: "evt_founder_nodouble_1",
      created: 1000,
      sessionId: `cs_${purchase.id}`,
      purchaseId: purchase.id,
      userId,
      paymentStatus: "paid",
      amountTotal: tier.price_cents,
      currency: "usd",
      paymentIntent: "pi_nodouble_1",
    });
    await webhook(signedRequest(session));
    // A second, distinct event id referencing the same already-PAID purchase
    // (e.g. Stripe's own retry with a new delivery id) must not assign a second number.
    await webhook(signedRequest({ ...session, id: "evt_founder_nodouble_2" }));

    const db = getDb();
    const tierRow = db.prepare("SELECT sold_quantity FROM founder_tiers WHERE id = ?").get(tier.id) as {
      sold_quantity: number;
    };
    expect(tierRow.sold_quantity).toBe(1);
  });

  it("charge.refunded marks a PAID Founder purchase REFUNDED", async () => {
    const tier = insertTier({ slug: "founder-first-wh5" });
    const userId = await makeUser("founder-wh-refund@example.com");
    const purchase = seedPurchase(userId, tier);
    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_founder_refund_paid",
          created: 1000,
          sessionId: `cs_${purchase.id}`,
          purchaseId: purchase.id,
          userId,
          paymentStatus: "paid",
          amountTotal: tier.price_cents,
          currency: "usd",
          paymentIntent: "pi_refund_1",
        })
      )
    );

    const res = await webhook(
      signedRequest(
        chargeRefundedEvent({
          id: "evt_founder_refund_1",
          created: 1100,
          chargeId: "ch_founder_refund_1",
          paymentIntentId: "pi_refund_1",
          amount: tier.price_cents,
          amountRefunded: tier.price_cents,
        })
      )
    );
    expect(res.status).toBe(200);
    expect(getFounderPurchaseById(purchase.id)!.payment_status).toBe("REFUNDED");
  });

  it("grants Pro from a Founder purchase without disturbing an existing STRIPE subscription's source", async () => {
    const tier = insertTier({ slug: "founder-first-wh6" });
    const userId = await makeUser("founder-wh-stripe-safe@example.com");

    // Give the user a real, active Stripe subscription first.
    const stripeEnd = Math.floor(Date.now() / 1000) + 3600;
    await webhook(
      signedRequest({
        id: "evt_founder_stripe_seed",
        type: "customer.subscription.updated",
        created: 500,
        livemode: false,
        data: {
          object: {
            id: "sub_founder_safety",
            object: "subscription",
            status: "active",
            customer: "cus_founder_safety",
            cancel_at_period_end: false,
            start_date: 400,
            canceled_at: null,
            trial_end: null,
            current_period_end: stripeEnd,
            metadata: { user_id: userId },
            items: {
              data: [
                {
                  current_period_end: stripeEnd,
                  price: { id: "price_month", product: "prod_pro", recurring: { interval: "month" } },
                },
              ],
            },
          },
        },
      })
    );
    expect(getSubscriptionForUser(userId)!.source).toBe("STRIPE");

    const purchase = seedPurchase(userId, tier);
    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_founder_stripe_safety",
          created: 1000,
          sessionId: `cs_${purchase.id}`,
          purchaseId: purchase.id,
          userId,
          paymentStatus: "paid",
          amountTotal: tier.price_cents,
          currency: "usd",
          paymentIntent: "pi_stripe_safety_1",
        })
      )
    );

    const sub = getSubscriptionForUser(userId)!;
    expect(sub.source).toBe("STRIPE"); // never clobbered by the Founder grant
    expect(subscriptionGrantsPro(sub)).toBe(true);
  });
});
