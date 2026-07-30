import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { registerDevice } from "@/server/devices";
import { getUsageSummary, upsertDailyUsage, upsertDailyUsageBatch } from "@/server/usage";

function makeUserWithDevice(): { userId: string; deviceId: string } {
  const userId = randomBytes(8).toString("hex");
  getDb()
    .prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', ?)`)
    .run(userId, `${userId}@example.com`, new Date().toISOString());
  const device = registerDevice(userId, { installationId: "install-1", platform: "IOS" });
  return { userId, deviceId: device.id };
}

function baseRecord(deviceId: string, overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-30",
    deviceId,
    totalSeconds: 17400,
    freeSeconds: 10800,
    billableSeconds: 6600,
    virtualRentAmountMinor: 1833,
    currency: "USD",
    goalMet: false,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("usage.upsertDailyUsage", () => {
  it("accepts and normalizes a valid record", () => {
    const { userId, deviceId } = makeUserWithDevice();
    const result = upsertDailyUsage(userId, baseRecord(deviceId));
    expect(result.currency).toBe("usd"); // normalized lowercase
    expect(result.totalSeconds).toBe(17400);
  });

  it("is a true upsert on (userId, deviceId, date)", () => {
    const { userId, deviceId } = makeUserWithDevice();
    upsertDailyUsage(userId, baseRecord(deviceId, { version: 1 }));
    const second = upsertDailyUsage(userId, baseRecord(deviceId, { version: 2, totalSeconds: 20000, freeSeconds: 10800, billableSeconds: 9200 }));
    expect(second.totalSeconds).toBe(20000);

    const rows = getDb().prepare("SELECT COUNT(*) AS n FROM daily_usage WHERE user_id = ?").get(userId) as { n: number };
    expect(rows.n).toBe(1);
  });

  it("rejects a device that doesn't belong to the user", () => {
    const { userId } = makeUserWithDevice();
    const { deviceId: otherDeviceId } = makeUserWithDevice();
    expect(() => upsertDailyUsage(userId, baseRecord(otherDeviceId))).toThrow(ApiError);
  });

  it("rejects when freeSeconds + billableSeconds != totalSeconds", () => {
    const { userId, deviceId } = makeUserWithDevice();
    expect(() =>
      upsertDailyUsage(userId, baseRecord(deviceId, { totalSeconds: 100, freeSeconds: 10, billableSeconds: 50 }))
    ).toThrow(ApiError);
  });

  it("rejects negative values", () => {
    const { userId, deviceId } = makeUserWithDevice();
    expect(() => upsertDailyUsage(userId, baseRecord(deviceId, { totalSeconds: -1 }))).toThrow(ApiError);
  });

  it("rejects a future date", () => {
    const { userId, deviceId } = makeUserWithDevice();
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(() => upsertDailyUsage(userId, baseRecord(deviceId, { date: future }))).toThrow(ApiError);
  });

  it("rejects an invalid currency code", () => {
    const { userId, deviceId } = makeUserWithDevice();
    expect(() => upsertDailyUsage(userId, baseRecord(deviceId, { currency: "dollars" }))).toThrow(ApiError);
  });

  it("rejects a stale version against an existing row", () => {
    const { userId, deviceId } = makeUserWithDevice();
    upsertDailyUsage(userId, baseRecord(deviceId, { version: 5 }));
    try {
      upsertDailyUsage(userId, baseRecord(deviceId, { version: 3 }));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("VERSION_CONFLICT");
    }
  });
});

describe("usage.upsertDailyUsageBatch", () => {
  it("applies partial success — one bad record doesn't fail the others", () => {
    const { userId, deviceId } = makeUserWithDevice();
    const results = upsertDailyUsageBatch(userId, [
      baseRecord(deviceId, { date: "2026-07-28" }),
      baseRecord(deviceId, { date: "2026-07-29", totalSeconds: -5 }), // invalid
      baseRecord(deviceId, { date: "2026-07-30" }),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
    expect(results[1]?.error?.code).toBe("VALIDATION_ERROR");
    expect(results[2]?.ok).toBe(true);

    const rows = getDb().prepare("SELECT COUNT(*) AS n FROM daily_usage WHERE user_id = ?").get(userId) as { n: number };
    expect(rows.n).toBe(2);
  });

  it("rejects an empty batch", () => {
    const { userId } = makeUserWithDevice();
    expect(() => upsertDailyUsageBatch(userId, [])).toThrow(ApiError);
  });

  it("rejects a batch larger than the limit", () => {
    const { userId, deviceId } = makeUserWithDevice();
    const records = Array.from({ length: 101 }, (_, i) =>
      baseRecord(deviceId, { date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` })
    );
    expect(() => upsertDailyUsageBatch(userId, records)).toThrow(ApiError);
  });
});

describe("usage.getUsageSummary", () => {
  it("aggregates totals across the date range", () => {
    const { userId, deviceId } = makeUserWithDevice();
    upsertDailyUsage(userId, baseRecord(deviceId, { date: "2026-07-29", totalSeconds: 1000, freeSeconds: 1000, billableSeconds: 0, virtualRentAmountMinor: 0 }));
    upsertDailyUsage(userId, baseRecord(deviceId, { date: "2026-07-30", totalSeconds: 2000, freeSeconds: 1000, billableSeconds: 1000, virtualRentAmountMinor: 500 }));

    const summary = getUsageSummary(userId, { from: "2026-07-01", to: "2026-07-31" });
    expect(summary.totalSeconds).toBe(3000);
    expect(summary.virtualRentAmountMinor).toBe(500);
    expect(summary.daysTracked).toBe(2);
  });
});
