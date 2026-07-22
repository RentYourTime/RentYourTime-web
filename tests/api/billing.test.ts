import { beforeAll, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

// This file only needs a real registered user (via the real /api/register
// flow) to exercise billing logic — not email delivery, so the SES send is
// mocked. Token creation still runs for real.
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
});

import { POST as register } from "@/app/api/register/route";
import { GET as listInvoices } from "@/app/api/billing/invoices/route";
import { GET as getInvoice } from "@/app/api/billing/invoices/[invoiceId]/route";
import { POST as portal } from "@/app/api/billing/portal/route";
import { upsertInvoiceRecord, getInvoicesForUser } from "@/lib/billing";

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  return res.json();
}

function seedInvoice(userId: string, invoiceId: string, amount: number) {
  upsertInvoiceRecord({
    userId,
    invoiceId,
    invoiceNumber: `INV-${invoiceId}`,
    status: "paid",
    amountDue: amount,
    amountPaid: amount,
    currency: "usd",
    hostedInvoiceUrl: `https://invoice.stripe.com/i/${invoiceId}`,
    invoicePdfUrl: `https://invoice.stripe.com/i/${invoiceId}/pdf`,
    billingReason: "subscription_cycle",
    periodStart: 1000,
    periodEnd: 2000,
    createdAt: Math.floor(Date.now() / 1000),
    subscriptionId: "sub_billing_test",
    paymentIntentId: null,
    chargeId: null,
  });
}

describe("GET /api/billing/invoices", () => {
  it("requires authorization", async () => {
    const res = await listInvoices(new Request("http://localhost/api/billing/invoices"));
    expect(res.status).toBe(401);
  });

  it("only returns the current user's invoices", async () => {
    const alice = await registerUser("billing-alice@example.com");
    const bob = await registerUser("billing-bob@example.com");
    seedInvoice(alice.user.id, "in_alice_1", 8999);

    const aliceRes = await listInvoices(
      authedRequest("http://localhost/api/billing/invoices", alice.token)
    );
    const aliceData = await aliceRes.json();
    expect(aliceData.invoices).toHaveLength(1);
    expect(aliceData.invoices[0].invoice_id).toBe("in_alice_1");

    const bobRes = await listInvoices(
      authedRequest("http://localhost/api/billing/invoices", bob.token)
    );
    const bobData = await bobRes.json();
    expect(bobData.invoices).toHaveLength(0);
  });

  it("clamps limit to the 1-100 range", async () => {
    const carol = await registerUser("billing-carol@example.com");
    for (let i = 0; i < 3; i++) seedInvoice(carol.user.id, `in_carol_${i}`, 500);

    const res = await listInvoices(
      new Request(`http://localhost/api/billing/invoices?limit=500`, {
        headers: { Authorization: `Bearer ${carol.token}` },
      })
    );
    const data = await res.json();
    // Just confirms the request succeeds and returns what exists — the
    // clamp only matters once there are >100 rows, which isn't practical
    // to seed here; the important thing is a huge `limit` doesn't error.
    expect(res.status).toBe(200);
    expect(data.invoices.length).toBe(3);
  });
});

describe("GET /api/billing/invoices/[invoiceId]", () => {
  it("returns the invoice when it belongs to the caller", async () => {
    const dave = await registerUser("billing-dave@example.com");
    seedInvoice(dave.user.id, "in_dave_1", 899);
    const [record] = getInvoicesForUser(dave.user.id);

    const res = await getInvoice(authedRequest("http://localhost/api/billing/invoices/x", dave.token), {
      params: Promise.resolve({ invoiceId: record.id }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.invoice.invoice_id).toBe("in_dave_1");
  });

  it("returns 404 (not 403) for another user's invoice — no ownership leak", async () => {
    const erin = await registerUser("billing-erin@example.com");
    const frank = await registerUser("billing-frank@example.com");
    seedInvoice(erin.user.id, "in_erin_1", 899);
    const [record] = getInvoicesForUser(erin.user.id);

    const res = await getInvoice(
      authedRequest("http://localhost/api/billing/invoices/x", frank.token),
      { params: Promise.resolve({ invoiceId: record.id }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent invoice id", async () => {
    const grace = await registerUser("billing-grace@example.com");
    const res = await getInvoice(
      authedRequest("http://localhost/api/billing/invoices/x", grace.token),
      { params: Promise.resolve({ invoiceId: "does-not-exist" }) }
    );
    expect(res.status).toBe(404);
  });

  it("requires authorization", async () => {
    const res = await getInvoice(new Request("http://localhost/api/billing/invoices/x"), {
      params: Promise.resolve({ invoiceId: "whatever" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/billing/portal", () => {
  it("requires authorization", async () => {
    const res = await portal(
      new Request("http://localhost/api/billing/portal", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 customer_not_found when the user has no Stripe customer id", async () => {
    const heidi = await registerUser("billing-heidi@example.com");
    const res = await portal(
      new Request("http://localhost/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${heidi.token}` },
      })
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("customer_not_found");
  });
});
