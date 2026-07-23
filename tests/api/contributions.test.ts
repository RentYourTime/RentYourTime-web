import { beforeAll, describe, expect, it } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

// Only needs a real registered user via /api/register — email delivery is mocked.
import { vi } from "vitest";
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
});

import { POST as register } from "@/app/api/register/route";
import { POST as checkout } from "@/app/api/contributions/checkout/route";
import { GET as history } from "@/app/api/contributions/route";
import { GET as sessionStatus } from "@/app/api/contributions/session/[sessionId]/route";
import { getDb } from "@/lib/db";
import {
  attachCheckoutSession,
  createPendingContribution,
  markContributionPaid,
} from "@/lib/contributions";

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  return res.json();
}

function setAccruedRent(userId: string, cents: number, currency = "usd") {
  getDb()
    .prepare("UPDATE users SET accrued_rent_cents = ?, accrued_rent_currency = ? WHERE id = ?")
    .run(cents, currency, userId);
}

describe("POST /api/contributions/checkout", () => {
  it("requires authorization", async () => {
    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", { body: { percentage: 10 } })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a percentage outside the allowed list", async () => {
    const user = await registerUser("contrib-badpct@example.com");
    setAccruedRent(user.user.id, 10000);
    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", {
        body: { percentage: 7 },
        token: user.token,
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_percentage");
  });

  it("never accepts an amount, accruedRent, or userId supplied by the client", async () => {
    const user = await registerUser("contrib-noamount@example.com");
    setAccruedRent(user.user.id, 10000);
    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", {
        body: { percentage: 10, amount: 999999, accruedRent: 999999, userId: "someone-else" },
        token: user.token,
      })
    );
    // The extra fields are simply ignored — amount is always recomputed
    // server-side from the DB value, not from anything in the request body.
    expect(res.status).not.toBe(400);
  });

  it("returns 409 when the user has no accrued-rent data yet", async () => {
    const user = await registerUser("contrib-noaccrued@example.com");
    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", {
        body: { percentage: 10 },
        token: user.token,
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("accrued_rent_unavailable");
  });

  it("rejects an amount below Stripe's minimum charge instead of silently rounding up", async () => {
    const user = await registerUser("contrib-toolow@example.com");
    setAccruedRent(user.user.id, 100); // $1.00 accrued
    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", {
        body: { percentage: 5 }, // 5 cents — below the 50-cent usd minimum
        token: user.token,
      })
    );
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe("amount_too_low");
    expect(data.minimumCents).toBe(50);
  });
});

describe("GET /api/contributions", () => {
  it("requires authorization", async () => {
    const res = await history(new Request("http://localhost/api/contributions"));
    expect(res.status).toBe(401);
  });

  it("only returns the caller's contributions and sums PAID only", async () => {
    const alice = await registerUser("contrib-alice@example.com");
    const bob = await registerUser("contrib-bob@example.com");
    setAccruedRent(alice.user.id, 2840);

    const paid = createPendingContribution({
      userId: alice.user.id,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
    });
    markContributionPaid({ id: paid.id, paymentIntentId: "pi_hist_1", stripeEventId: "evt_hist_1" });
    createPendingContribution({
      userId: alice.user.id,
      percentage: 25,
      accruedRentCents: 2840,
      amountCents: 710,
      currency: "usd",
    }); // stays PENDING — must not appear

    const aliceRes = await history(authedRequest("http://localhost/api/contributions", alice.token));
    const aliceData = await aliceRes.json();
    expect(aliceData.data.contributions).toHaveLength(1);
    expect(aliceData.data.totalContributedCents).toBe(284);
    expect(aliceData.data.accruedRentCents).toBe(2840);

    const bobRes = await history(authedRequest("http://localhost/api/contributions", bob.token));
    const bobData = await bobRes.json();
    expect(bobData.data.contributions).toHaveLength(0);
    expect(bobData.data.totalContributedCents).toBe(0);
  });
});

describe("GET /api/contributions/session/[sessionId]", () => {
  it("requires authorization", async () => {
    const res = await sessionStatus(new Request("http://localhost/api/contributions/session/x"), {
      params: Promise.resolve({ sessionId: "cs_whatever" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 (not 403) for another user's session — no ownership leak", async () => {
    const carol = await registerUser("contrib-carol@example.com");
    const dave = await registerUser("contrib-dave@example.com");
    const c = createPendingContribution({
      userId: carol.user.id,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
    });
    attachCheckoutSession(c.id, "cs_carol_1");

    const res = await sessionStatus(
      authedRequest("http://localhost/api/contributions/session/x", dave.token),
      { params: Promise.resolve({ sessionId: "cs_carol_1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns the local status without contacting Stripe once already settled", async () => {
    const erin = await registerUser("contrib-erin@example.com");
    const c = createPendingContribution({
      userId: erin.user.id,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
    });
    attachCheckoutSession(c.id, "cs_erin_1");
    markContributionPaid({ id: c.id, paymentIntentId: "pi_erin_1", stripeEventId: "evt_erin_1" });

    const res = await sessionStatus(
      authedRequest("http://localhost/api/contributions/session/x", erin.token),
      { params: Promise.resolve({ sessionId: "cs_erin_1" }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("PAID");
  });

  it("returns 404 for a nonexistent session id", async () => {
    const frank = await registerUser("contrib-frank@example.com");
    const res = await sessionStatus(
      authedRequest("http://localhost/api/contributions/session/x", frank.token),
      { params: Promise.resolve({ sessionId: "cs_does_not_exist" }) }
    );
    expect(res.status).toBe(404);
  });
});
