import { randomBytes } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { getDb } from "@/lib/db";
import { getAccruedRentForUser, resolveAccruedRentForUser } from "@/lib/accruedRent";
import { getDemoAccruedRent, isSupportDemoEnabled } from "@/lib/supportDemo";

const ENV_KEYS = ["NODE_ENV", "ENABLE_SUPPORT_DEMO", "SUPPORT_DEMO_ACCRUED_RENT_CENTS", "SUPPORT_DEMO_CURRENCY"] as const;
let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = snapshot[k];
  }
});

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', datetime('now'))"
    )
    .run(id, `${id}@example.com`);
  return id;
}

function setRealAccruedRent(userId: string, cents: number, currency = "usd") {
  getDb()
    .prepare("UPDATE users SET accrued_rent_cents = ?, accrued_rent_currency = ? WHERE id = ?")
    .run(cents, currency, userId);
}

describe("isSupportDemoEnabled", () => {
  it("is disabled by default (no ENABLE_SUPPORT_DEMO set)", () => {
    delete process.env.ENABLE_SUPPORT_DEMO;
    expect(isSupportDemoEnabled()).toBe(false);
  });

  it("requires the exact string 'true'", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    for (const v of ["1", "yes", "TRUE", "True", ""]) {
      process.env.ENABLE_SUPPORT_DEMO = v;
      expect(isSupportDemoEnabled()).toBe(false);
    }
    process.env.ENABLE_SUPPORT_DEMO = "true";
    expect(isSupportDemoEnabled()).toBe(true);
  });

  it("is force-disabled in production even with ENABLE_SUPPORT_DEMO=true", () => {
    process.env.ENABLE_SUPPORT_DEMO = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV ="production";
    expect(isSupportDemoEnabled()).toBe(false);
  });

  it("is enabled outside production (development or test) when the flag is set", () => {
    process.env.ENABLE_SUPPORT_DEMO = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    expect(isSupportDemoEnabled()).toBe(true);
    (process.env as Record<string, string | undefined>).NODE_ENV ="test";
    expect(isSupportDemoEnabled()).toBe(true);
  });
});

describe("getDemoAccruedRent", () => {
  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    process.env.ENABLE_SUPPORT_DEMO = "true";
  });

  it("is null when demo mode is disabled, regardless of the amount env var", () => {
    process.env.ENABLE_SUPPORT_DEMO = "false";
    process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
    expect(getDemoAccruedRent()).toBeNull();
  });

  it.each(["", "0", "-5", "12.5", "abc"])("is null for an invalid amount %p", (v) => {
    process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = v;
    expect(getDemoAccruedRent()).toBeNull();
  });

  it("returns the configured cents and currency", () => {
    process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
    process.env.SUPPORT_DEMO_CURRENCY = "usd";
    expect(getDemoAccruedRent()).toEqual({ cents: 2840, currency: "usd" });
  });

  it("defaults currency to usd when unset", () => {
    process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
    delete process.env.SUPPORT_DEMO_CURRENCY;
    expect(getDemoAccruedRent()).toEqual({ cents: 2840, currency: "usd" });
  });

  it("is force-disabled in production even with a valid amount configured", () => {
    process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
    (process.env as Record<string, string | undefined>).NODE_ENV ="production";
    expect(getDemoAccruedRent()).toBeNull();
  });
});

describe("resolveAccruedRentForUser", () => {
  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV ="development";
    process.env.ENABLE_SUPPORT_DEMO = "true";
    process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS = "2840";
    process.env.SUPPORT_DEMO_CURRENCY = "usd";
  });

  it("returns null when the user has no real data and demo mode is off", () => {
    process.env.ENABLE_SUPPORT_DEMO = "false";
    const userId = makeUser();
    expect(resolveAccruedRentForUser(userId)).toBeNull();
    expect(getAccruedRentForUser(userId)).toBeNull();
  });

  it("falls back to demo data when the user has no real ledger", () => {
    const userId = makeUser();
    expect(resolveAccruedRentForUser(userId)).toEqual({ cents: 2840, currency: "usd", isDemo: true });
  });

  it("prefers real ledger data over demo, even with demo enabled", () => {
    const userId = makeUser();
    setRealAccruedRent(userId, 999, "eur");
    expect(resolveAccruedRentForUser(userId)).toEqual({ cents: 999, currency: "eur", isDemo: false });
  });

  it("never falls back to demo in production, even with a real-data-less user", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV ="production";
    const userId = makeUser();
    expect(resolveAccruedRentForUser(userId)).toBeNull();
  });
});
