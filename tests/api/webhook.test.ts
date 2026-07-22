import { beforeAll, describe, expect, it, vi } from "vitest";
import { jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

// This file only needs a real registered user (via the real /api/register
// flow) to exercise webhook/subscription logic — not email delivery, so the
// SES send is mocked. Token creation still runs for real.
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
import { getInvoicesForUser } from "@/lib/billing";

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

function subscriptionUpdatedEvent(opts: {
  id: string;
  created: number;
  userId: string;
  subscriptionId: string;
  customerId: string;
  status: string;
  currentPeriodEnd: number | null;
  interval: "month" | "year";
}) {
  return {
    id: opts.id,
    type: "customer.subscription.updated",
    created: opts.created,
    livemode: false,
    data: {
      object: {
        id: opts.subscriptionId,
        object: "subscription",
        status: opts.status,
        customer: opts.customerId,
        cancel_at_period_end: false,
        start_date: opts.created - 100,
        canceled_at: null,
        trial_end: null,
        current_period_end: opts.currentPeriodEnd,
        metadata: { user_id: opts.userId },
        items: {
          data: [
            {
              current_period_end: opts.currentPeriodEnd,
              price: {
                id: `price_${opts.interval}`,
                product: "prod_pro",
                recurring: { interval: opts.interval },
              },
            },
          ],
        },
      },
    },
  };
}

function invoiceEvent(opts: {
  id: string;
  type: string;
  created: number;
  invoiceId: string;
  userId: string;
  customerId: string;
  subscriptionId?: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  number?: string | null;
}) {
  return {
    id: opts.id,
    type: opts.type,
    created: opts.created,
    livemode: false,
    data: {
      object: {
        id: opts.invoiceId,
        object: "invoice",
        number: opts.number ?? "INV-0001",
        status: opts.status,
        amount_due: opts.amountDue,
        amount_paid: opts.amountPaid,
        currency: "usd",
        hosted_invoice_url: `https://invoice.stripe.com/i/${opts.invoiceId}`,
        invoice_pdf: `https://invoice.stripe.com/i/${opts.invoiceId}/pdf`,
        billing_reason: "subscription_cycle",
        period_start: opts.created - 2592000,
        period_end: opts.created,
        created: opts.created,
        customer: opts.customerId,
        metadata: { user_id: opts.userId },
        parent: opts.subscriptionId
          ? { subscription_details: { subscription: opts.subscriptionId, metadata: null } }
          : null,
      },
    },
  };
}

function chargeEvent(opts: {
  id: string;
  type: string;
  created: number;
  chargeId: string;
  customerId: string;
  paymentIntentId?: string | null;
  refunded?: boolean;
}) {
  return {
    id: opts.id,
    type: opts.type,
    created: opts.created,
    livemode: false,
    data: {
      object: {
        id: opts.chargeId,
        object: "charge",
        amount: 8999,
        amount_refunded: opts.refunded ? 8999 : 0,
        currency: "usd",
        customer: opts.customerId,
        payment_intent: opts.paymentIntentId ?? null,
        receipt_url: `https://pay.stripe.com/receipts/${opts.chargeId}`,
        refunded: !!opts.refunded,
        status: "succeeded",
      },
    },
  };
}

describe("POST /api/webhook", () => {
  it("rejects a request with an invalid signature", async () => {
    const res = await webhook(
      new Request("http://localhost/api/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bad" },
        body: JSON.stringify({ id: "evt_bad", type: "customer.subscription.updated" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_signature");
  });

  it("activates a subscription on customer.subscription.updated and tags source=STRIPE", async () => {
    const userId = await makeUser("webhook-user@example.com");
    const future = Math.floor(Date.now() / 1000) + 3600;

    const res = await webhook(
      signedRequest(
        subscriptionUpdatedEvent({
          id: "evt_sub_1",
          created: 1000,
          userId,
          subscriptionId: "sub_abc",
          customerId: "cus_abc",
          status: "active",
          currentPeriodEnd: future,
          interval: "year",
        })
      )
    );
    expect(res.status).toBe(200);

    const sub = getSubscriptionForUser(userId);
    expect(sub).not.toBeNull();
    expect(sub!.source).toBe("STRIPE");
    expect(sub!.plan).toBe("YEARLY");
    expect(subscriptionGrantsPro(sub)).toBe(true);
  });

  it("is idempotent: replaying the same event id is a no-op the second time", async () => {
    const userId = await makeUser("webhook-idempotent@example.com");
    const future = Math.floor(Date.now() / 1000) + 3600;
    const event = subscriptionUpdatedEvent({
      id: "evt_idem_1",
      created: 2000,
      userId,
      subscriptionId: "sub_idem",
      customerId: "cus_idem",
      status: "active",
      currentPeriodEnd: future,
      interval: "month",
    });

    const res1 = await webhook(signedRequest(event));
    expect(res1.status).toBe(200);
    expect((await res1.json()).duplicate).toBeUndefined();

    const res2 = await webhook(signedRequest(event));
    expect(res2.status).toBe(200);
    expect((await res2.json()).duplicate).toBe(true);

    const count = getDb()
      .prepare("SELECT COUNT(*) AS n FROM webhook_events WHERE event_id = ?")
      .get("evt_idem_1") as { n: number };
    expect(count.n).toBe(1);
  });

  it("cancellation (subscription.deleted) revokes Pro", async () => {
    const userId = await makeUser("webhook-cancel@example.com");
    const future = Math.floor(Date.now() / 1000) + 3600;

    await webhook(
      signedRequest(
        subscriptionUpdatedEvent({
          id: "evt_cancel_1",
          created: 3000,
          userId,
          subscriptionId: "sub_cancel",
          customerId: "cus_cancel",
          status: "active",
          currentPeriodEnd: future,
          interval: "month",
        })
      )
    );
    expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(true);

    const deletedEvent = {
      id: "evt_cancel_2",
      type: "customer.subscription.deleted",
      created: 3100,
      livemode: false,
      data: {
        object: {
          id: "sub_cancel",
          object: "subscription",
          status: "canceled",
          customer: "cus_cancel",
          cancel_at_period_end: false,
          start_date: 2900,
          canceled_at: 3100,
          trial_end: null,
          current_period_end: future,
          metadata: { user_id: userId },
          items: {
            data: [
              {
                current_period_end: future,
                price: { id: "price_month", product: "prod_pro", recurring: { interval: "month" } },
              },
            ],
          },
        },
      },
    };
    const res = await webhook(signedRequest(deletedEvent));
    expect(res.status).toBe(200);
    expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(false);
  });

  it("invoice.paid creates a billing_records row", async () => {
    const userId = await makeUser("webhook-invoice-paid@example.com");
    const event = invoiceEvent({
      id: "evt_inv_paid_1",
      type: "invoice.paid",
      created: 4000,
      invoiceId: "in_paid_1",
      userId,
      customerId: "cus_inv_1",
      subscriptionId: "sub_inv_1",
      status: "paid",
      amountDue: 8999,
      amountPaid: 8999,
    });

    const res = await webhook(signedRequest(event));
    expect(res.status).toBe(200);

    const invoices = getInvoicesForUser(userId);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].provider_invoice_id).toBe("in_paid_1");
    expect(invoices[0].status).toBe("paid");
    expect(invoices[0].amount_paid).toBe(8999);
    expect(invoices[0].invoice_number).toBe("INV-0001");
    expect(invoices[0].hosted_invoice_url).toBe("https://invoice.stripe.com/i/in_paid_1");
    expect(invoices[0].provider_subscription_id).toBe("sub_inv_1");
  });

  it("replaying the same invoice.paid event does not create a duplicate row", async () => {
    const userId = await makeUser("webhook-invoice-replay@example.com");
    const event = invoiceEvent({
      id: "evt_inv_replay_1",
      type: "invoice.paid",
      created: 4100,
      invoiceId: "in_replay_1",
      userId,
      customerId: "cus_inv_2",
      status: "paid",
      amountDue: 899,
      amountPaid: 899,
    });

    await webhook(signedRequest(event));
    const res2 = await webhook(signedRequest(event));
    expect((await res2.json()).duplicate).toBe(true);
    expect(getInvoicesForUser(userId)).toHaveLength(1);
  });

  it("invoice.payment_failed moves the subscription to past_due", async () => {
    const userId = await makeUser("webhook-invoice-failed@example.com");
    // Get the subscription into `active` first via a subscription.updated event.
    const future = Math.floor(Date.now() / 1000) + 3600;
    await webhook(
      signedRequest(
        subscriptionUpdatedEvent({
          id: "evt_failed_sub_1",
          created: 4200,
          userId,
          subscriptionId: "sub_failed_1",
          customerId: "cus_inv_3",
          status: "active",
          currentPeriodEnd: future,
          interval: "month",
        })
      )
    );
    expect(subscriptionGrantsPro(getSubscriptionForUser(userId))).toBe(true);

    // A real Stripe invoice stays `open` on a failed payment attempt (it
    // retries) — the failure is signalled by the event type, not a
    // dedicated invoice status. The subscription is what actually flips.
    const event = invoiceEvent({
      id: "evt_inv_failed_1",
      type: "invoice.payment_failed",
      created: 4300,
      invoiceId: "in_failed_1",
      userId,
      customerId: "cus_inv_3",
      subscriptionId: "sub_failed_1",
      status: "open",
      amountDue: 899,
      amountPaid: 0,
    });
    const res = await webhook(signedRequest(event));
    expect(res.status).toBe(200);

    expect(getSubscriptionForUser(userId)?.status).toBe("past_due");
    const invoices = getInvoicesForUser(userId);
    expect(invoices[0].status).toBe("open");
  });

  it("charge.refunded marks the most recent invoice record as refunded", async () => {
    const userId = await makeUser("webhook-invoice-refund@example.com");
    // charge.refunded correlates by customer, via users.stripe_customer_id —
    // normally set by checkout.session.completed. invoice.paid alone (used
    // below to seed the record) resolves the user via metadata.user_id and
    // never touches this column, so set it up explicitly here.
    getDb().prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run("cus_inv_4", userId);
    await webhook(
      signedRequest(
        invoiceEvent({
          id: "evt_inv_refund_1",
          type: "invoice.paid",
          created: 4400,
          invoiceId: "in_refund_1",
          userId,
          customerId: "cus_inv_4",
          status: "paid",
          amountDue: 8999,
          amountPaid: 8999,
        })
      )
    );

    const res = await webhook(
      signedRequest(
        chargeEvent({
          id: "evt_charge_refund_1",
          type: "charge.refunded",
          created: 4500,
          chargeId: "ch_refund_1",
          customerId: "cus_inv_4",
          refunded: true,
        })
      )
    );
    expect(res.status).toBe(200);

    const invoices = getInvoicesForUser(userId);
    expect(invoices[0].status).toBe("refunded");
  });

  it("charge.succeeded attaches a payment id to the matching invoice row", async () => {
    const userId = await makeUser("webhook-charge-succeeded@example.com");
    getDb().prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run("cus_inv_5", userId);
    await webhook(
      signedRequest(
        invoiceEvent({
          id: "evt_inv_charge_1",
          type: "invoice.paid",
          created: 4600,
          invoiceId: "in_charge_1",
          userId,
          customerId: "cus_inv_5",
          status: "paid",
          amountDue: 899,
          amountPaid: 899,
        })
      )
    );

    const res = await webhook(
      signedRequest(
        chargeEvent({
          id: "evt_charge_succeeded_1",
          type: "charge.succeeded",
          created: 4700,
          chargeId: "ch_succeeded_1",
          customerId: "cus_inv_5",
          paymentIntentId: "pi_succeeded_1",
        })
      )
    );
    expect(res.status).toBe(200);

    const invoices = getInvoicesForUser(userId);
    expect(invoices[0].provider_payment_id).toBe("ch_succeeded_1");
    expect(invoices[0].provider_payment_intent_id).toBe("pi_succeeded_1");
  });
});
