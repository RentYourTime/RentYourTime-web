import { beforeAll, describe, expect, it } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import type { UserRow } from "@/lib/auth";
import { ApiError } from "@/lib/http/errors";
import { getProfile, updateProfile } from "@/server/profile";

function makeUser(): UserRow {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', ?)`)
    .run(id, `${id}@example.com`, new Date().toISOString());
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
}

describe("profile service", () => {
  it("lazily creates a default profile on first read", () => {
    const user = makeUser();
    const profile = getProfile(user);
    expect(profile.locale).toBe("en-US");
    expect(profile.timezone).toBe("UTC");
    expect(profile.currency).toBe("usd");
    expect(profile.version).toBe(1);
  });

  it("updates fields and increments version", () => {
    const user = makeUser();
    const initial = getProfile(user);
    const updated = updateProfile(user, {
      timezone: "Europe/Warsaw",
      currency: "eur",
      dailyFreeMinutes: 90,
      rentRatePerHour: 2.5,
      version: initial.version,
    });
    expect(updated.timezone).toBe("Europe/Warsaw");
    expect(updated.currency).toBe("eur");
    expect(updated.dailyFreeMinutes).toBe(90);
    expect(updated.rentRatePerHour).toBe(2.5);
    expect(updated.version).toBe(initial.version + 1);
  });

  it("rejects a stale version with VERSION_CONFLICT", () => {
    const user = makeUser();
    const initial = getProfile(user);
    updateProfile(user, { locale: "pl-PL", version: initial.version });

    expect(() => updateProfile(user, { locale: "de-DE", version: initial.version })).toThrow(ApiError);
    try {
      updateProfile(user, { locale: "de-DE", version: initial.version });
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("VERSION_CONFLICT");
    }
  });

  it("rejects an invalid IANA timezone", () => {
    const user = makeUser();
    const initial = getProfile(user);
    try {
      updateProfile(user, { timezone: "Not/AZone", version: initial.version });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).fields?.timezone).toBeTruthy();
    }
  });

  it("rejects a non-ISO-4217-shaped currency", () => {
    const user = makeUser();
    const initial = getProfile(user);
    try {
      updateProfile(user, { currency: "dollars", version: initial.version });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).fields?.currency).toBeTruthy();
    }
  });

  it("rejects dailyFreeMinutes out of range", () => {
    const user = makeUser();
    const initial = getProfile(user);
    try {
      updateProfile(user, { dailyFreeMinutes: 5000, version: initial.version });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).fields?.dailyFreeMinutes).toBeTruthy();
    }
  });

  it("clears displayName when explicitly set to null", () => {
    const user = makeUser();
    const initial = getProfile(user);
    updateProfile(user, { displayName: "Alice", version: initial.version });
    const cleared = updateProfile(user, { displayName: null, version: initial.version + 1 });
    expect(cleared.displayName).toBeNull();
  });
});
