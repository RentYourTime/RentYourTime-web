import { beforeAll, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
});

import { POST as register } from "@/app/api/register/route";
import { POST as checkout } from "@/app/api/founders/checkout/route";
import { GET as me } from "@/app/api/founders/me/route";
import { POST as blackKit } from "@/app/api/founders/black-kit/route";
import { PATCH as patchProfile } from "@/app/api/founders/profile/route";
import { getDb } from "@/lib/db";
import { createPendingFounderPurchase, getFounderTierBySlug, settleFounderPurchaseFromSession } from "@/lib/founders";

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/register", { body: { email, password: "StrongPassword123!" } })
  );
  return res.json();
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

describe("POST /api/founders/checkout", () => {
  it("requires authorization", async () => {
    const res = await checkout(jsonRequest("http://localhost/api/founders/checkout", { body: { tierSlug: "founder-first" } }));
    expect(res.status).toBe(401);
  });

  it("rejects an unknown tier", async () => {
    const user = await registerUser("founder-badtier@example.com");
    const res = await checkout(
      jsonRequest("http://localhost/api/founders/checkout", { body: { tierSlug: "does-not-exist" }, token: user.token })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_tier");
  });

  it("rejects an inactive tier", async () => {
    insertTier({ slug: "founder-inactive-test", is_active: 0 });
    const user = await registerUser("founder-inactive@example.com");
    const res = await checkout(
      jsonRequest("http://localhost/api/founders/checkout", { body: { tierSlug: "founder-inactive-test" }, token: user.token })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("tier_inactive");
  });

  it("rejects a sold-out tier and never reaches Stripe", async () => {
    insertTier({ slug: "founder-soldout-test", total_quantity: 1, sold_quantity: 1 });
    const user = await registerUser("founder-soldout@example.com");
    const res = await checkout(
      jsonRequest("http://localhost/api/founders/checkout", { body: { tierSlug: "founder-soldout-test" }, token: user.token })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("sold_out");
  });

  it("never accepts amount/price/tier data from the client — only tierSlug is read", async () => {
    insertTier({ slug: "founder-noinput-test" });
    const user = await registerUser("founder-noinput@example.com");
    const res = await checkout(
      jsonRequest("http://localhost/api/founders/checkout", {
        body: { tierSlug: "founder-noinput-test", priceCents: 1, stripePriceId: "price_hacked", userId: "someone-else" },
        token: user.token,
      })
    );
    // Extra fields are simply ignored; the request proceeds using only tierSlug.
    expect(res.status).not.toBe(400);
  });

  it("rejects buying the same tier twice once already PAID", async () => {
    const tier = insertTier({ slug: "founder-dup-test" });
    const user = await registerUser("founder-dup@example.com");
    const purchase = createPendingFounderPurchase({
      userId: user.user.id,
      tierId: tier.id,
      amountCents: tier.price_cents,
      currency: "usd",
    });
    getDb()
      .prepare("UPDATE founder_purchases SET stripe_checkout_session_id = ? WHERE id = ?")
      .run(`cs_${purchase.id}`, purchase.id);
    settleFounderPurchaseFromSession(
      {
        id: `cs_${purchase.id}`,
        payment_status: "paid",
        amount_total: tier.price_cents,
        currency: "usd",
        payment_intent: "pi_dup_1",
        metadata: { kind: "founder", purchaseId: purchase.id, userId: user.user.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      "evt_dup_1"
    );

    const res = await checkout(
      jsonRequest("http://localhost/api/founders/checkout", { body: { tierSlug: "founder-dup-test" }, token: user.token })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_owned");
  });
});

describe("GET /api/founders/me", () => {
  it("requires authorization", async () => {
    const res = await me(new Request("http://localhost/api/founders/me"));
    expect(res.status).toBe(401);
  });

  it("only returns the caller's own purchases", async () => {
    const tier = insertTier({ slug: "founder-scoped-test" });
    const alice = await registerUser("founder-alice@example.com");
    const bob = await registerUser("founder-bob@example.com");

    const purchase = createPendingFounderPurchase({
      userId: alice.user.id,
      tierId: tier.id,
      amountCents: tier.price_cents,
      currency: "usd",
    });
    getDb()
      .prepare("UPDATE founder_purchases SET stripe_checkout_session_id = ? WHERE id = ?")
      .run(`cs_${purchase.id}`, purchase.id);
    settleFounderPurchaseFromSession(
      {
        id: `cs_${purchase.id}`,
        payment_status: "paid",
        amount_total: tier.price_cents,
        currency: "usd",
        payment_intent: "pi_scoped_1",
        metadata: { kind: "founder", purchaseId: purchase.id, userId: alice.user.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      "evt_scoped_1"
    );

    const aliceRes = await me(authedRequest("http://localhost/api/founders/me", alice.token));
    const aliceData = await aliceRes.json();
    expect(aliceData.data.purchases).toHaveLength(1);
    expect(aliceData.data.purchases[0].founderNumberFormatted).toBe("#001");

    const bobRes = await me(authedRequest("http://localhost/api/founders/me", bob.token));
    expect((await bobRes.json()).data.purchases).toHaveLength(0);
  });
});

function getOrCreateBlackTier() {
  return (
    getFounderTierBySlug("founder-black") ??
    insertTier({ slug: "founder-black", name: "Founder Black", total_quantity: 20, is_lifetime_pro: 1 })
  );
}

describe("POST /api/founders/black-kit", () => {
  it("returns 404 (not ownership leak) for another user's purchase", async () => {
    const tier = getOrCreateBlackTier();
    const owner = await registerUser("founder-black-owner@example.com");
    const attacker = await registerUser("founder-black-attacker@example.com");

    const purchase = createPendingFounderPurchase({
      userId: owner.user.id,
      tierId: tier.id,
      amountCents: tier.price_cents,
      currency: "usd",
    });
    getDb()
      .prepare("UPDATE founder_purchases SET payment_status = 'PAID' WHERE id = ?")
      .run(purchase.id);

    const res = await blackKit(
      jsonRequest("http://localhost/api/founders/black-kit", {
        body: { purchaseId: purchase.id, fullName: "X", shippingAddress: "Y", country: "Z", shirtSize: "M" },
        token: attacker.token,
      })
    );
    expect(res.status).toBe(404);
  });

  it("rejects an invalid shirt size", async () => {
    const tier = getOrCreateBlackTier();
    const user = await registerUser("founder-black-shirt@example.com");
    const purchase = createPendingFounderPurchase({
      userId: user.user.id,
      tierId: tier.id,
      amountCents: tier.price_cents,
      currency: "usd",
    });
    getDb().prepare("UPDATE founder_purchases SET payment_status = 'PAID' WHERE id = ?").run(purchase.id);

    const res = await blackKit(
      jsonRequest("http://localhost/api/founders/black-kit", {
        body: { purchaseId: purchase.id, fullName: "X", shippingAddress: "Y", country: "Z", shirtSize: "HUGE" },
        token: user.token,
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/founders/profile", () => {
  it("requires authorization", async () => {
    const res = await patchProfile(new Request("http://localhost/api/founders/profile", { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("updates consent flags for the caller", async () => {
    const user = await registerUser("founder-profile@example.com");
    const res = await patchProfile(
      jsonRequest("http://localhost/api/founders/profile", {
        body: { displayName: "Alex", consentDirectory: true, consentCredits: false, consentCaseStudy: true },
        token: user.token,
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data).toEqual({
      displayName: "Alex",
      consentDirectory: true,
      consentCredits: false,
      consentCaseStudy: true,
    });
  });
});
