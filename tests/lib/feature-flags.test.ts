import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { getConfig, resolveFeaturesForUser } from "@/server/feature-flags";

function insertFlag(overrides: Partial<{
  key: string;
  enabled: number;
  freeEnabled: number;
  proEnabled: number;
  founderEnabled: number;
  rolloutPercentage: number;
  minimumAppVersion: string | null;
  latestAppVersion: string | null;
}> = {}): string {
  const key = overrides.key ?? randomBytes(6).toString("hex");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO feature_flags
         (id, key, enabled, free_enabled, pro_enabled, founder_enabled, rollout_percentage, minimum_app_version, latest_app_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomBytes(6).toString("hex"),
      key,
      overrides.enabled ?? 1,
      overrides.freeEnabled ?? 1,
      overrides.proEnabled ?? 1,
      overrides.founderEnabled ?? 1,
      overrides.rolloutPercentage ?? 100,
      overrides.minimumAppVersion ?? null,
      overrides.latestAppVersion ?? null,
      now,
      now
    );
  return key;
}

describe("deterministic feature-flag rollout", () => {
  it("the same user always lands in the same bucket for a given flag (stable across repeated calls)", () => {
    const key = insertFlag({ rolloutPercentage: 50 });
    const userId = randomBytes(8).toString("hex");

    const results = Array.from({ length: 10 }, () => resolveFeaturesForUser(userId, null).find((f) => f.key === key)?.enabled);
    const distinctValues = new Set(results);
    expect(distinctValues.size).toBe(1); // never flips between calls
  });

  it("0% rollout disables the flag for everyone", () => {
    const key = insertFlag({ rolloutPercentage: 0 });
    const userId = randomBytes(8).toString("hex");
    expect(resolveFeaturesForUser(userId, null).find((f) => f.key === key)?.enabled).toBe(false);
  });

  it("100% rollout enables the flag for everyone (tier permitting)", () => {
    const key = insertFlag({ rolloutPercentage: 100 });
    for (let i = 0; i < 5; i++) {
      const userId = randomBytes(8).toString("hex");
      expect(resolveFeaturesForUser(userId, null).find((f) => f.key === key)?.enabled).toBe(true);
    }
  });

  it("a disabled flag is off regardless of rollout percentage", () => {
    const key = insertFlag({ enabled: 0, rolloutPercentage: 100 });
    const userId = randomBytes(8).toString("hex");
    expect(resolveFeaturesForUser(userId, null).find((f) => f.key === key)?.enabled).toBe(false);
  });

  it("gates on minimumAppVersion", () => {
    const key = insertFlag({ minimumAppVersion: "2.0.0" });
    const userId = randomBytes(8).toString("hex");
    expect(resolveFeaturesForUser(userId, "1.9.0").find((f) => f.key === key)?.enabled).toBe(false);
    expect(resolveFeaturesForUser(userId, "2.0.0").find((f) => f.key === key)?.enabled).toBe(true);
    expect(resolveFeaturesForUser(userId, "2.1.0").find((f) => f.key === key)?.enabled).toBe(true);
  });

  it("free_enabled=0 hides the flag from a logged-out (free-tier) caller", () => {
    const key = insertFlag({ freeEnabled: 0 });
    expect(resolveFeaturesForUser(null, null).find((f) => f.key === key)?.enabled).toBe(false);
  });
});

describe("GET /config aggregation", () => {
  it("reflects the reserved maintenance flag", () => {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO feature_flags (id, key, enabled, created_at, updated_at) VALUES (?, 'maintenance', 1, ?, ?)`
      )
      .run(randomBytes(6).toString("hex"), now, now);

    const config = getConfig(null, null);
    expect(config.maintenance).toBe(true);
  });

  it("reflects the reserved app-version flag", () => {
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO feature_flags (id, key, enabled, minimum_app_version, latest_app_version, created_at, updated_at)
         VALUES (?, 'app', 1, '1.0.0', '2.0.0', ?, ?)`
      )
      .run(randomBytes(6).toString("hex"), now, now);

    const config = getConfig(null, null);
    expect(config.minimumAppVersion).toBe("1.0.0");
    expect(config.latestAppVersion).toBe("2.0.0");
  });
});
