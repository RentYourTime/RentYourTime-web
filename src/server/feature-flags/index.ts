import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { getUserAccess } from "@/server/entitlements";

/**
 * Feature flags / remote config (§17). Rollout is deterministic —
 * `sha256(userId:featureKey)` bucketed into 0-99 — so the same user always
 * lands in the same bucket for a given flag; nothing here calls `Math.random()`
 * per request. Two reserved flag keys carry app-wide state rather than a
 * per-feature toggle: `maintenance` (its `enabled` bit is the kill switch)
 * and `app` (its `minimum_app_version`/`latest_app_version` are the global
 * force-upgrade gate) — both are ordinary rows in the same `feature_flags`
 * table, seeded by an admin, not a separate schema.
 */

export interface FeatureFlagRow {
  id: string;
  key: string;
  enabled: number;
  free_enabled: number;
  pro_enabled: number;
  founder_enabled: number;
  rollout_percentage: number;
  minimum_app_version: string | null;
  latest_app_version: string | null;
  starts_at: string | null;
  ends_at: string | null;
  metadata: string | null;
}

function deterministicBucket(userId: string, featureKey: string): number {
  const hash = createHash("sha256").update(`${userId}:${featureKey}`).digest();
  return hash.readUInt32BE(0) % 100;
}

function isWithinWindow(row: FeatureFlagRow): boolean {
  const now = new Date().toISOString();
  if (row.starts_at && row.starts_at > now) return false;
  if (row.ends_at && row.ends_at <= now) return false;
  return true;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface ResolvedFeature {
  key: string;
  enabled: boolean;
}

export function resolveFeaturesForUser(userId: string | null, appVersion: string | null): ResolvedFeature[] {
  const rows = (getDb().prepare("SELECT * FROM feature_flags WHERE key NOT IN ('maintenance', 'app')").all() as FeatureFlagRow[]);
  const access = userId ? getUserAccess(userId) : null;

  return rows.map((row) => {
    let enabled = !!row.enabled && isWithinWindow(row);

    if (enabled && row.minimum_app_version && appVersion && compareVersions(appVersion, row.minimum_app_version) < 0) {
      enabled = false;
    }
    if (enabled && row.latest_app_version && appVersion && compareVersions(appVersion, row.latest_app_version) > 0) {
      enabled = false;
    }

    if (enabled) {
      const tierEnabled = access?.isFounder ? row.founder_enabled : access?.isPro ? row.pro_enabled : row.free_enabled;
      if (!tierEnabled) enabled = false;
    }

    if (enabled && row.rollout_percentage <= 0) {
      enabled = false;
    } else if (enabled && row.rollout_percentage < 100) {
      const bucketKey = userId ?? "anonymous";
      if (deterministicBucket(bucketKey, row.key) >= row.rollout_percentage) enabled = false;
    }

    return { key: row.key, enabled };
  });
}

export interface ConfigResponse {
  maintenance: boolean;
  minimumAppVersion: string | null;
  latestAppVersion: string | null;
  features: Record<string, boolean>;
  requiresPro: string[];
  requiresFounder: string[];
  founderEarlyAccess: boolean;
}

export function getConfig(userId: string | null, appVersion: string | null): ConfigResponse {
  const db = getDb();
  const maintenanceRow = db.prepare("SELECT enabled FROM feature_flags WHERE key = 'maintenance'").get() as
    | { enabled: number }
    | undefined;
  const appRow = db
    .prepare("SELECT minimum_app_version, latest_app_version FROM feature_flags WHERE key = 'app'")
    .get() as { minimum_app_version: string | null; latest_app_version: string | null } | undefined;

  const features = resolveFeaturesForUser(userId, appVersion);
  const access = userId ? getUserAccess(userId) : null;

  const requiresPro = db
    .prepare("SELECT key FROM feature_flags WHERE key NOT IN ('maintenance','app') AND pro_enabled = 1 AND free_enabled = 0")
    .all() as { key: string }[];
  const requiresFounder = db
    .prepare("SELECT key FROM feature_flags WHERE key NOT IN ('maintenance','app') AND founder_enabled = 1 AND pro_enabled = 0")
    .all() as { key: string }[];

  return {
    maintenance: !!maintenanceRow?.enabled,
    minimumAppVersion: appRow?.minimum_app_version ?? null,
    latestAppVersion: appRow?.latest_app_version ?? null,
    features: Object.fromEntries(features.map((f) => [f.key, f.enabled])),
    requiresPro: requiresPro.map((r) => r.key),
    requiresFounder: requiresFounder.map((r) => r.key),
    founderEarlyAccess: access?.earlyAccess ?? false,
  };
}
