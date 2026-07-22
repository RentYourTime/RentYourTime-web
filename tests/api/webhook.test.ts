import { beforeAll, describe, expect, it } from "vitest";
import { jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

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
});
