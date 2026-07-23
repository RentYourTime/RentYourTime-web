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
import { getSubscriptionForUser } from "@/lib/subscriptions";
import {
  type AllowedPercentage,
  createPendingContribution,
  getContributionById,
} from "@/lib/contributions";

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
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  const data = await res.json();
  return data.user.id as string;
}

function seedContribution(
  userId: string,
  percentage: AllowedPercentage,
  accruedCents: number,
  amountCents: number
) {
  const c = createPendingContribution({
    userId,
    percentage,
    accruedRentCents: accruedCents,
    amountCents,
    currency: "usd",
  });
  getDb()
    .prepare("UPDATE contributions SET stripe_checkout_session_id = ? WHERE id = ?")
    .run(`cs_${c.id}`, c.id);
  return c;
}

function checkoutCompletedEvent(opts: {
  id: string;
  created: number;
  sessionId: string;
  contributionId: string;
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
        metadata: { kind: "contribution", contributionId: opts.contributionId, userId: opts.userId },
      },
    },
  };
}

function sessionLifecycleEvent(
  type: "checkout.session.expired" | "checkout.session.async_payment_failed",
  opts: { id: string; created: number; sessionId: string; contributionId: string; userId: string }
) {
  return {
    id: opts.id,
    type,
    created: opts.created,
    livemode: false,
    data: {
      object: {
        id: opts.sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: "unpaid",
        metadata: { kind: "contribution", contributionId: opts.contributionId, userId: opts.userId },
      },
    },
  };
}

function chargeRefundedEvent(opts: {
  id: string;
  created: number;
  chargeId: string;
  paymentIntentId: string;
  amountRefunded: number;
  amount: number;
}) {
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

describe("POST /api/webhook — contributions", () => {
  it("marks a contribution PAID on checkout.session.completed and never touches subscriptions", async () => {
    const userId = await makeUser("contrib-wh-paid@example.com");
    const c = seedContribution(userId, 10, 2840, 284);

    const res = await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_contrib_paid_1",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
          paymentStatus: "paid",
          amountTotal: 284,
          currency: "usd",
          paymentIntent: "pi_contrib_1",
        })
      )
    );
    expect(res.status).toBe(200);

    const updated = getContributionById(c.id)!;
    expect(updated.status).toBe("PAID");
    expect(updated.paid_at).not.toBeNull();
    expect(updated.stripe_payment_intent_id).toBe("pi_contrib_1");

    // A contribution must never grant Pro or create a subscription row.
    expect(getSubscriptionForUser(userId)).toBeNull();
  });

  it("does not settle again if payment_status is not yet paid (async payment pending)", async () => {
    const userId = await makeUser("contrib-wh-unpaid@example.com");
    const c = seedContribution(userId, 10, 2840, 284);

    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_contrib_unpaid_1",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
          paymentStatus: "unpaid",
          amountTotal: 284,
          currency: "usd",
        })
      )
    );
    expect(getContributionById(c.id)!.status).toBe("PENDING");
  });

  it("refuses to mark paid when the session amount does not match the PENDING row", async () => {
    const userId = await makeUser("contrib-wh-amount@example.com");
    const c = seedContribution(userId, 10, 2840, 284);

    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_contrib_amount_1",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
          paymentStatus: "paid",
          amountTotal: 99999, // does not match amount_cents=284
          currency: "usd",
        })
      )
    );
    expect(getContributionById(c.id)!.status).toBe("PENDING");
  });

  it("refuses to mark paid when the session currency does not match the PENDING row", async () => {
    const userId = await makeUser("contrib-wh-currency@example.com");
    const c = seedContribution(userId, 10, 2840, 284);

    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_contrib_currency_1",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
          paymentStatus: "paid",
          amountTotal: 284,
          currency: "eur", // row is usd
        })
      )
    );
    expect(getContributionById(c.id)!.status).toBe("PENDING");
  });

  it("replaying the same completed event id does not re-process (webhook_events dedupe)", async () => {
    const userId = await makeUser("contrib-wh-replay@example.com");
    const c = seedContribution(userId, 10, 2840, 284);
    const event = checkoutCompletedEvent({
      id: "evt_contrib_replay_1",
      created: 1000,
      sessionId: `cs_${c.id}`,
      contributionId: c.id,
      userId,
      paymentStatus: "paid",
      amountTotal: 284,
      currency: "usd",
      paymentIntent: "pi_replay_1",
    });

    const res1 = await webhook(signedRequest(event));
    expect((await res1.json()).duplicate).toBeUndefined();
    const res2 = await webhook(signedRequest(event));
    expect((await res2.json()).duplicate).toBe(true);

    expect(getContributionById(c.id)!.status).toBe("PAID");
  });

  it("checkout.session.expired marks an untouched PENDING contribution EXPIRED", async () => {
    const userId = await makeUser("contrib-wh-expired@example.com");
    const c = seedContribution(userId, 10, 2840, 284);

    await webhook(
      signedRequest(
        sessionLifecycleEvent("checkout.session.expired", {
          id: "evt_contrib_expired_1",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
        })
      )
    );
    expect(getContributionById(c.id)!.status).toBe("EXPIRED");
  });

  it("checkout.session.async_payment_failed marks a PENDING contribution FAILED", async () => {
    const userId = await makeUser("contrib-wh-failed@example.com");
    const c = seedContribution(userId, 10, 2840, 284);

    await webhook(
      signedRequest(
        sessionLifecycleEvent("checkout.session.async_payment_failed", {
          id: "evt_contrib_failed_1",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
        })
      )
    );
    expect(getContributionById(c.id)!.status).toBe("FAILED");
  });

  it("charge.refunded (full) marks a PAID contribution REFUNDED", async () => {
    const userId = await makeUser("contrib-wh-refund-full@example.com");
    const c = seedContribution(userId, 10, 2840, 284);
    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_contrib_refundfull_paid",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
          paymentStatus: "paid",
          amountTotal: 284,
          currency: "usd",
          paymentIntent: "pi_refund_full_1",
        })
      )
    );

    const res = await webhook(
      signedRequest(
        chargeRefundedEvent({
          id: "evt_contrib_refundfull_1",
          created: 1100,
          chargeId: "ch_refund_full_1",
          paymentIntentId: "pi_refund_full_1",
          amount: 284,
          amountRefunded: 284,
        })
      )
    );
    expect(res.status).toBe(200);
    expect(getContributionById(c.id)!.status).toBe("REFUNDED");
  });

  it("charge.refunded (partial) keeps the contribution PAID and records the partial amount", async () => {
    const userId = await makeUser("contrib-wh-refund-partial@example.com");
    const c = seedContribution(userId, 50, 2840, 1420);
    await webhook(
      signedRequest(
        checkoutCompletedEvent({
          id: "evt_contrib_refundpartial_paid",
          created: 1000,
          sessionId: `cs_${c.id}`,
          contributionId: c.id,
          userId,
          paymentStatus: "paid",
          amountTotal: 1420,
          currency: "usd",
          paymentIntent: "pi_refund_partial_1",
        })
      )
    );

    await webhook(
      signedRequest(
        chargeRefundedEvent({
          id: "evt_contrib_refundpartial_1",
          created: 1100,
          chargeId: "ch_refund_partial_1",
          paymentIntentId: "pi_refund_partial_1",
          amount: 1420,
          amountRefunded: 500,
        })
      )
    );
    const updated = getContributionById(c.id)!;
    expect(updated.status).toBe("PAID");
    expect(updated.refunded_amount_cents).toBe(500);
  });
});
