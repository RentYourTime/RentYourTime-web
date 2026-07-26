import { beforeAll, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
});

import { POST as register } from "@/app/api/register/route";
import { GET as listTiers } from "@/app/api/admin/founders/tiers/route";
import { PATCH as patchTier } from "@/app/api/admin/founders/tiers/[id]/route";
import { GET as listPurchases } from "@/app/api/admin/founders/purchases/route";
import { GET as getKit, PATCH as patchKit } from "@/app/api/admin/founders/purchases/[id]/kit/route";
import { PATCH as patchTracking } from "@/app/api/admin/founders/purchases/[id]/tracking/route";
import { GET as exportCsv } from "@/app/api/admin/founders/export/route";
import { getDb } from "@/lib/db";
import { createPendingFounderPurchase, submitFounderBlackShippingDetails } from "@/lib/founders";

async function registerUser(email: string) {
  const res = await register(jsonRequest("http://localhost/api/register", { body: { email, password: "StrongPassword123!" } }));
  return res.json();
}

async function makeAdmin(email: string) {
  const user = await registerUser(email);
  getDb().prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(user.user.id);
  return user;
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

describe("admin Founder Program routes — access control", () => {
  it("GET tiers requires admin (401 with no token)", async () => {
    const res = await listTiers(new Request("http://localhost/api/admin/founders/tiers"));
    expect(res.status).toBe(401);
  });

  it("GET tiers rejects a non-admin user (403)", async () => {
    const user = await registerUser("founders-admin-notadmin@example.com");
    const res = await listTiers(authedRequest("http://localhost/api/admin/founders/tiers", user.token));
    expect(res.status).toBe(403);
  });

  it("export requires admin", async () => {
    const res = await exportCsv(new Request("http://localhost/api/admin/founders/export"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/founders/tiers/[id]", () => {
  it("activates and deactivates a tier", async () => {
    const admin = await makeAdmin("founders-admin-toggle@example.com");
    const tier = insertTier({ slug: "founder-toggle-test" });

    const off = await patchTier(
      jsonRequest(`http://localhost/api/admin/founders/tiers/${tier.id}`, { body: { action: "deactivate" }, token: admin.token }),
      { params: Promise.resolve({ id: tier.id }) }
    );
    expect((await off.json()).tier.isActive).toBe(false);

    const on = await patchTier(
      jsonRequest(`http://localhost/api/admin/founders/tiers/${tier.id}`, { body: { action: "activate" }, token: admin.token }),
      { params: Promise.resolve({ id: tier.id }) }
    );
    expect((await on.json()).tier.isActive).toBe(true);
  });

  it("refuses to drop the limit below sold_quantity", async () => {
    const admin = await makeAdmin("founders-admin-limit@example.com");
    const tier = insertTier({ slug: "founder-limit-test", total_quantity: 10, sold_quantity: 8 });

    const res = await patchTier(
      jsonRequest(`http://localhost/api/admin/founders/tiers/${tier.id}`, { body: { totalQuantity: 5 }, token: admin.token }),
      { params: Promise.resolve({ id: tier.id }) }
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("below_sold_quantity");
  });

  it("accepts a valid new limit", async () => {
    const admin = await makeAdmin("founders-admin-limit2@example.com");
    const tier = insertTier({ slug: "founder-limit-test2", total_quantity: 10, sold_quantity: 2 });

    const res = await patchTier(
      jsonRequest(`http://localhost/api/admin/founders/tiers/${tier.id}`, { body: { totalQuantity: 50 }, token: admin.token }),
      { params: Promise.resolve({ id: tier.id }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).tier.totalQuantity).toBe(50);
  });
});

describe("GET /api/admin/founders/purchases", () => {
  it("lists purchases with the buyer's email, scoped to admin only", async () => {
    const admin = await makeAdmin("founders-admin-list@example.com");
    const buyer = await registerUser("founders-admin-buyer@example.com");
    const tier = insertTier({ slug: "founder-list-test" });
    createPendingFounderPurchase({ userId: buyer.user.id, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });

    const res = await listPurchases(authedRequest("http://localhost/api/admin/founders/purchases", admin.token));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.purchases.some((p: { email: string }) => p.email === "founders-admin-buyer@example.com")).toBe(true);
  });
});

describe("Founder Black kit admin endpoints", () => {
  it("shows shipping details once submitted, and lets an admin update kit item status + tracking", async () => {
    const admin = await makeAdmin("founders-admin-kit@example.com");
    const buyer = await registerUser("founders-admin-kit-buyer@example.com");
    const tier = insertTier({ slug: "founder-black-admin-test", is_lifetime_pro: 1 });
    const purchase = createPendingFounderPurchase({ userId: buyer.user.id, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    getDb().prepare("UPDATE founder_purchases SET payment_status = 'PAID' WHERE id = ?").run(purchase.id);

    const empty = await getKit(authedRequest(`http://localhost/api/admin/founders/purchases/${purchase.id}/kit`, admin.token), {
      params: Promise.resolve({ id: purchase.id }),
    });
    expect((await empty.json()).data).toBeNull();

    submitFounderBlackShippingDetails({
      purchaseId: purchase.id,
      fullName: "Alex Founder",
      shippingAddress: "1 Main St",
      country: "USA",
      shirtSize: "L",
    });

    const filled = await getKit(authedRequest(`http://localhost/api/admin/founders/purchases/${purchase.id}/kit`, admin.token), {
      params: Promise.resolve({ id: purchase.id }),
    });
    const filledData = (await filled.json()).data;
    expect(filledData.shippingAddress).toBe("1 Main St");
    expect(filledData.cardStatus).toBe("pending");

    const patched = await patchKit(
      jsonRequest(`http://localhost/api/admin/founders/purchases/${purchase.id}/kit`, {
        body: { field: "card_status", status: "shipped" },
        token: admin.token,
      }),
      { params: Promise.resolve({ id: purchase.id }) }
    );
    expect((await patched.json()).data.card_status).toBe("shipped");

    const tracked = await patchTracking(
      jsonRequest(`http://localhost/api/admin/founders/purchases/${purchase.id}/tracking`, {
        body: { trackingNumber: "1Z999AA10123456784" },
        token: admin.token,
      }),
      { params: Promise.resolve({ id: purchase.id }) }
    );
    const trackedData = await tracked.json();
    expect(trackedData.data.trackingNumber).toBe("1Z999AA10123456784");
    expect(trackedData.data.shippedAt).not.toBeNull();
  });

  it("rejects an invalid kit status field", async () => {
    const admin = await makeAdmin("founders-admin-kit-badfield@example.com");
    const buyer = await registerUser("founders-admin-kit-badfield-buyer@example.com");
    const tier = insertTier({ slug: "founder-black-admin-test2", is_lifetime_pro: 1 });
    const purchase = createPendingFounderPurchase({ userId: buyer.user.id, tierId: tier.id, amountCents: tier.price_cents, currency: "usd" });
    getDb().prepare("UPDATE founder_purchases SET payment_status = 'PAID' WHERE id = ?").run(purchase.id);
    submitFounderBlackShippingDetails({
      purchaseId: purchase.id,
      fullName: "X",
      shippingAddress: "Y",
      country: "Z",
      shirtSize: "M",
    });

    const res = await patchKit(
      jsonRequest(`http://localhost/api/admin/founders/purchases/${purchase.id}/kit`, {
        body: { field: "not_a_real_field", status: "shipped" },
        token: admin.token,
      }),
      { params: Promise.resolve({ id: purchase.id }) }
    );
    expect(res.status).toBe(422);
  });
});
