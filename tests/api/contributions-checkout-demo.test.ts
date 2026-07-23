import { randomBytes } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

// The only file in this suite that mocks the Stripe SDK client — see
// docs/CONTRIBUTIONS.md ("Testing locally") for why every other file avoids
// it. Needed here specifically to assert on the demo metadata/amount passed
// to `checkout.sessions.create` without a live network call.
const { createSessionMock } = vi.hoisted(() => ({ createSessionMock: vi.fn() }));
vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    getStripe: () => ({
      checkout: {
        sessions: {
          create: createSessionMock,
          retrieve: vi.fn(),
        },
      },
    }),
  };
});

beforeAll(() => {
  useIsolatedDataDir();
  process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
  process.env.APP_URL = "http://localhost:3000";
});

import { POST as register } from "@/app/api/register/route";
import { POST as checkout } from "@/app/api/contributions/checkout/route";
import { getContributionById } from "@/lib/contributions";

const ENV_KEYS = ["NODE_ENV", "ENABLE_SUPPORT_DEMO", "SUPPORT_DEMO_ACCRUED_RENT_CENTS", "SUPPORT_DEMO_CURRENCY"] as const;
let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  (process.env as Record<string, string | undefined>).NODE_ENV ="development";
  process.env.ENABLE_SUPPORT_DEMO = "true";
  process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
  process.env.SUPPORT_DEMO_CURRENCY = "usd";
  createSessionMock.mockReset();
  createSessionMock.mockImplementation(async () => {
    const id = `cs_demo_test_${randomBytes(6).toString("hex")}`;
    return { id, url: `https://checkout.stripe.com/test/${id}` };
  });
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

describe("POST /api/contributions/checkout — demo-sourced amount", () => {
  it("still creates a real Checkout Session (never a mocked URL), tagged with demo metadata", async () => {
    const user = await registerUser("contrib-checkout-demo@example.com");

    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", {
        body: { percentage: 10 },
        token: user.token,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\/test\//);

    expect(createSessionMock).toHaveBeenCalledTimes(1);
    const [params] = createSessionMock.mock.calls[0];
    expect(params.mode).toBe("payment");
    expect(params.line_items[0].price_data.unit_amount).toBe(284); // 10% of 2840
    expect(params.line_items[0].price_data.currency).toBe("usd");
    expect(params.metadata.source).toBe("demo");
    expect(params.metadata.environment).toBe("development");
    expect(params.payment_intent_data.metadata.source).toBe("demo");

    const contribution = getContributionById(data.contributionId)!;
    expect(contribution.is_demo_source).toBe(1);
    expect(contribution.accrued_rent_cents).toBe(2840);
    expect(contribution.amount_cents).toBe(284);
  });

  it("does not stamp demo metadata once the user has real ledger data", async () => {
    const user = await registerUser("contrib-checkout-real@example.com");
    const { getDb } = await import("@/lib/db");
    getDb()
      .prepare("UPDATE users SET accrued_rent_cents = 500, accrued_rent_currency = 'usd' WHERE id = ?")
      .run(user.user.id);

    const res = await checkout(
      jsonRequest("http://localhost/api/contributions/checkout", {
        body: { percentage: 10 },
        token: user.token,
      })
    );
    expect(res.status).toBe(200);

    const [params] = createSessionMock.mock.calls[0];
    expect(params.metadata.source).toBeUndefined();
    expect(params.line_items[0].price_data.unit_amount).toBe(50); // 10% of 500

    const data = await res.json();
    const contribution = getContributionById(data.contributionId)!;
    expect(contribution.is_demo_source).toBe(0);
  });
});
