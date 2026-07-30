import { randomBytes } from "node:crypto";
import type { UserRow } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { validationError } from "@/lib/http/errors";
import { getSubscriptionForUser, serializeSubscription } from "@/lib/subscriptions";
import { getFounderProfile, listFounderPurchasesForUser } from "@/lib/founders";
import { recordAudit } from "@/server/audit";
import { revokeAllSessionsForUser, listActiveSessionsForUser } from "@/server/auth/sessions";
import { listDevicesForUser } from "@/server/devices";
import { getProfile } from "@/server/profile";

/** §18 — account export/delete. Never includes `password_hash`, any token hash, or a secret. */

interface DailyUsageExportRow {
  date: string;
  device_id: string;
  total_seconds: number;
  free_seconds: number;
  billable_seconds: number;
  virtual_rent_amount_minor: number;
  currency: string;
  goal_met: number;
}

export function exportAccountData(user: UserRow) {
  const db = getDb();

  const usageRows = db
    .prepare(
      `SELECT date, device_id, total_seconds, free_seconds, billable_seconds, virtual_rent_amount_minor, currency, goal_met
       FROM daily_usage WHERE user_id = ? ORDER BY date DESC LIMIT 3660`
    )
    .all(user.id) as DailyUsageExportRow[];

  const founderProfile = getFounderProfile(user.id);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      emailVerified: !!user.email_verified,
      role: user.role,
      createdAt: user.created_at,
    },
    profile: getProfile(user),
    devices: listDevicesForUser(user.id),
    sessions: listActiveSessionsForUser(user.id).map((s) => ({
      id: s.id,
      platform: s.platform,
      deviceId: s.device_id,
      createdAt: s.created_at,
      lastUsedAt: s.last_used_at,
      expiresAt: s.expires_at,
    })),
    usage: usageRows.map((r) => ({
      date: r.date,
      deviceId: r.device_id,
      totalSeconds: r.total_seconds,
      freeSeconds: r.free_seconds,
      billableSeconds: r.billable_seconds,
      virtualRentAmountMinor: r.virtual_rent_amount_minor,
      currency: r.currency,
      goalMet: !!r.goal_met,
    })),
    subscription: serializeSubscription(getSubscriptionForUser(user.id)),
    founder: {
      purchases: listFounderPurchasesForUser(user.id).map((p) => ({
        id: p.id,
        founderNumber: p.founder_number,
        paymentStatus: p.payment_status,
        isLifetimePro: !!p.is_lifetime_pro,
        proStartsAt: p.pro_starts_at,
        proEndsAt: p.pro_ends_at,
        createdAt: p.created_at,
      })),
      profile: founderProfile
        ? {
            displayName: founderProfile.display_name,
            consentDirectory: !!founderProfile.consent_directory,
            consentCredits: !!founderProfile.consent_credits,
            consentCaseStudy: !!founderProfile.consent_case_study,
          }
        : null,
    },
  };
}

export interface DeleteAccountParams {
  user: UserRow;
  password: string;
  confirm: boolean;
}

/**
 * Requires the current password (reauthorization) and an explicit
 * `confirm: true` (§18). Soft-deletes: `users` is deactivated and scrubbed
 * of directly-identifying fields rather than hard-deleted, because
 * `billing_records`/`founder_purchases` (tax/financial records) are kept
 * per retention policy and reference `users.id` via foreign key — see
 * docs/PRODUCTION_CHECKLIST.md "Data retention". Profile and usage rows,
 * which carry no such retention requirement, are deleted outright.
 */
export function deleteAccount(params: DeleteAccountParams): void {
  if (params.confirm !== true) throw validationError({ confirm: "Wymagane potwierdzenie usunięcia konta." });
  if (!verifyPassword(params.password, params.user.password_hash)) {
    throw validationError({ password: "Nieprawidłowe hasło." });
  }

  const db = getDb();
  const now = new Date().toISOString();

  revokeAllSessionsForUser(params.user.id);
  db.prepare("DELETE FROM tokens WHERE user_id = ?").run(params.user.id);
  db.prepare("UPDATE devices SET revoked_at = ?, push_token = NULL, push_environment = NULL WHERE user_id = ?").run(
    now,
    params.user.id
  );
  db.prepare("DELETE FROM user_profiles WHERE user_id = ?").run(params.user.id);
  db.prepare("DELETE FROM daily_usage WHERE user_id = ?").run(params.user.id);

  db.prepare(
    `UPDATE users
     SET is_active = 0, email = ?, password_hash = ?, display_name = NULL,
         apple_original_transaction_id = NULL, apple_account_token = NULL, updated_at = ?
     WHERE id = ?`
  ).run(`deleted+${params.user.id}@rentyourtime.invalid`, randomBytes(32).toString("hex"), now, params.user.id);

  recordAudit({ userId: params.user.id, action: "account.deleted" });
}
