import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { getDb } from "@/lib/db";
import { getAccruedRentForUser } from "@/lib/accruedRent";
import {
  ALLOWED_PERCENTAGES,
  applyRefund,
  computeAmountCents,
  createPendingContribution,
  findRecentPendingContribution,
  getTotalContributedCentsForUser,
  isAllowedPercentage,
  listContributionsForUser,
  markContributionFailed,
  markContributionPaid,
  minimumChargeCents,
} from "@/lib/contributions";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', datetime('now'))"
    )
    .run(id, `${id}@example.com`);
  return id;
}

function setAccruedRent(userId: string, cents: number, currency = "usd") {
  getDb()
    .prepare("UPDATE users SET accrued_rent_cents = ?, accrued_rent_currency = ? WHERE id = ?")
    .run(cents, currency, userId);
}

describe("isAllowedPercentage", () => {
  it.each(ALLOWED_PERCENTAGES)("accepts %d", (p) => {
    expect(isAllowedPercentage(p)).toBe(true);
  });

  it.each([0, 1, 3, 7, 15, 99, 101, -5, 5.5, "5", null, undefined, {}])(
    "rejects %p",
    (value) => {
      expect(isAllowedPercentage(value)).toBe(false);
    }
  );
});

describe("computeAmountCents", () => {
  it("rounds to the nearest cent", () => {
    expect(computeAmountCents(2840, 10)).toBe(284);
    expect(computeAmountCents(100, 5)).toBe(5);
    expect(computeAmountCents(333, 25)).toBe(Math.round((333 * 25) / 100));
  });
});

describe("minimumChargeCents", () => {
  it("returns the usd minimum", () => {
    expect(minimumChargeCents("usd")).toBe(50);
  });

  it("falls back to a default for an unlisted currency", () => {
    expect(minimumChargeCents("xyz")).toBeGreaterThan(0);
  });
});

describe("getAccruedRentForUser", () => {
  it("is null until a value is set", () => {
    const userId = makeUser();
    expect(getAccruedRentForUser(userId)).toBeNull();
  });

  it("is null for a zero or negative value", () => {
    const userId = makeUser();
    setAccruedRent(userId, 0);
    expect(getAccruedRentForUser(userId)).toBeNull();
  });

  it("reads back a positive value", () => {
    const userId = makeUser();
    setAccruedRent(userId, 2840);
    expect(getAccruedRentForUser(userId)).toEqual({ cents: 2840, currency: "usd" });
  });
});

describe("contribution lifecycle", () => {
  it("PENDING contributions are excluded from history and totals", () => {
    const userId = makeUser();
    createPendingContribution({
      userId,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
    });
    expect(listContributionsForUser(userId)).toHaveLength(0);
    expect(getTotalContributedCentsForUser(userId)).toBe(0);
  });

  it("PAID contributions count toward the total; FAILED never do", () => {
    const userId = makeUser();
    const paid = createPendingContribution({
      userId,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
    });
    markContributionPaid({ id: paid.id, paymentIntentId: "pi_1", stripeEventId: "evt_1" });

    const failed = createPendingContribution({
      userId,
      percentage: 25,
      accruedRentCents: 2840,
      amountCents: 710,
      currency: "usd",
    });
    markContributionFailed({ id: failed.id, stripeEventId: "evt_2" });

    const list = listContributionsForUser(userId);
    expect(list).toHaveLength(2);
    expect(getTotalContributedCentsForUser(userId)).toBe(284);
  });

  it("a full refund excludes the contribution from the total entirely", () => {
    const userId = makeUser();
    const c = createPendingContribution({
      userId,
      percentage: 50,
      accruedRentCents: 2840,
      amountCents: 1420,
      currency: "usd",
    });
    markContributionPaid({ id: c.id, paymentIntentId: "pi_full", stripeEventId: "evt_1" });
    expect(getTotalContributedCentsForUser(userId)).toBe(1420);

    applyRefund({ id: c.id, refundedAmountCents: 1420, stripeEventId: "evt_refund" });
    expect(getTotalContributedCentsForUser(userId)).toBe(0);
    expect(listContributionsForUser(userId)[0].status).toBe("REFUNDED");
  });

  it("a partial refund stays PAID but nets out of the total", () => {
    const userId = makeUser();
    const c = createPendingContribution({
      userId,
      percentage: 50,
      accruedRentCents: 2840,
      amountCents: 1420,
      currency: "usd",
    });
    markContributionPaid({ id: c.id, paymentIntentId: "pi_partial", stripeEventId: "evt_1" });

    applyRefund({ id: c.id, refundedAmountCents: 500, stripeEventId: "evt_refund" });
    const row = listContributionsForUser(userId)[0];
    expect(row.status).toBe("PAID");
    expect(getTotalContributedCentsForUser(userId)).toBe(1420 - 500);
  });

  it("findRecentPendingContribution only matches the same user + percentage with an attached session", () => {
    const userId = makeUser();
    const c = createPendingContribution({
      userId,
      percentage: 10,
      accruedRentCents: 2840,
      amountCents: 284,
      currency: "usd",
    });
    expect(findRecentPendingContribution(userId, 10)).toBeNull(); // no session attached yet
    expect(findRecentPendingContribution(userId, 25)).toBeNull(); // different percentage

    getDb()
      .prepare("UPDATE contributions SET stripe_checkout_session_id = ? WHERE id = ?")
      .run("cs_test_1", c.id);
    expect(findRecentPendingContribution(userId, 10)?.id).toBe(c.id);
  });
});
