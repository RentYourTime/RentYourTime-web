import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { ApiError, validationError } from "@/lib/http/errors";
import { isNotFutureDate, isValidCurrencyCode, isValidDateString, normalizeCurrencyCode } from "@/server/validation";
import { getDeviceRowForUser } from "@/server/devices";

/**
 * Daily usage sync (§12). Aggregated per-device-per-day totals only — never
 * per-app breakdowns, never FamilyControls tokens. Upsert key is
 * `(userId, deviceId, date)`; `virtualRentAmountMinor` is informational
 * (see §12: "Wirtualny rent nie jest automatyczną płatnością") and never
 * triggers a charge on its own.
 */

export interface DailyUsageRow {
  id: string;
  user_id: string;
  device_id: string;
  date: string;
  total_seconds: number;
  free_seconds: number;
  billable_seconds: number;
  virtual_rent_amount_minor: number;
  currency: string;
  goal_met: number;
  version: number;
  client_updated_at: string;
  server_updated_at: string;
}

export interface DailyUsageDto {
  date: string;
  deviceId: string;
  totalSeconds: number;
  freeSeconds: number;
  billableSeconds: number;
  virtualRentAmountMinor: number;
  currency: string;
  goalMet: boolean;
  version: number;
  clientUpdatedAt: string;
  serverUpdatedAt: string;
}

function serialize(row: DailyUsageRow): DailyUsageDto {
  return {
    date: row.date,
    deviceId: row.device_id,
    totalSeconds: row.total_seconds,
    freeSeconds: row.free_seconds,
    billableSeconds: row.billable_seconds,
    virtualRentAmountMinor: row.virtual_rent_amount_minor,
    currency: row.currency,
    goalMet: !!row.goal_met,
    version: row.version,
    clientUpdatedAt: row.client_updated_at,
    serverUpdatedAt: row.server_updated_at,
  };
}

const MAX_SECONDS_PER_DAY = 90_000; // 25h — DST / multi-timezone tolerance, still far below a spoofed "days" value
const MAX_VIRTUAL_RENT_MINOR = 1_000_000; // sanity ceiling on a single day's record, not a real billing limit
export const MAX_BATCH_RECORDS = 100;

export interface UsageRecordInput {
  date: string;
  deviceId: string;
  totalSeconds: number;
  freeSeconds: number;
  billableSeconds: number;
  virtualRentAmountMinor: number;
  currency: string;
  goalMet: boolean;
  version: number;
  updatedAt: string;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

type ParsedRecord = { errors: Record<string, string>; record: null } | { errors: null; record: UsageRecordInput };

function parseUsageRecord(userId: string, raw: unknown): ParsedRecord {
  const rec = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const fields: Record<string, string> = {};

  if (typeof raw !== "object" || raw === null) fields.record = "Rekord musi być obiektem JSON.";

  if (typeof rec.date !== "string" || !isValidDateString(rec.date)) fields.date = "Nieprawidłowa data (YYYY-MM-DD).";
  else if (!isNotFutureDate(rec.date)) fields.date = "Data nie może być w przyszłości.";

  let device = null;
  if (typeof rec.deviceId !== "string" || !rec.deviceId) {
    fields.deviceId = "Wymagane deviceId.";
  } else {
    device = getDeviceRowForUser(userId, rec.deviceId);
    if (!device || device.revoked_at) fields.deviceId = "Urządzenie nie należy do użytkownika lub zostało usunięte.";
  }

  if (!isNonNegInt(rec.totalSeconds) || (rec.totalSeconds as number) > MAX_SECONDS_PER_DAY) {
    fields.totalSeconds = `Wartość całkowita 0-${MAX_SECONDS_PER_DAY}.`;
  }
  if (!isNonNegInt(rec.freeSeconds) || (rec.freeSeconds as number) > MAX_SECONDS_PER_DAY) {
    fields.freeSeconds = `Wartość całkowita 0-${MAX_SECONDS_PER_DAY}.`;
  }
  if (!isNonNegInt(rec.billableSeconds) || (rec.billableSeconds as number) > MAX_SECONDS_PER_DAY) {
    fields.billableSeconds = `Wartość całkowita 0-${MAX_SECONDS_PER_DAY}.`;
  }
  if (!fields.totalSeconds && !fields.freeSeconds && !fields.billableSeconds) {
    if ((rec.freeSeconds as number) + (rec.billableSeconds as number) !== rec.totalSeconds) {
      fields.totalSeconds = "totalSeconds musi równać się freeSeconds + billableSeconds.";
    }
  }

  if (!isNonNegInt(rec.virtualRentAmountMinor) || (rec.virtualRentAmountMinor as number) > MAX_VIRTUAL_RENT_MINOR) {
    fields.virtualRentAmountMinor = `Wartość całkowita 0-${MAX_VIRTUAL_RENT_MINOR}.`;
  }

  if (typeof rec.currency !== "string" || !isValidCurrencyCode(rec.currency)) {
    fields.currency = "Nieprawidłowy kod waluty (ISO 4217).";
  }

  if (typeof rec.goalMet !== "boolean") fields.goalMet = "Wymagana wartość logiczna.";

  if (!Number.isInteger(rec.version) || (rec.version as number) < 1) fields.version = "Nieprawidłowa wersja.";

  if (typeof rec.updatedAt !== "string" || Number.isNaN(Date.parse(rec.updatedAt))) {
    fields.updatedAt = "Nieprawidłowa data aktualizacji (ISO 8601).";
  }

  if (Object.keys(fields).length > 0) return { errors: fields, record: null };

  return {
    errors: null,
    record: {
      date: rec.date as string,
      deviceId: rec.deviceId as string,
      totalSeconds: rec.totalSeconds as number,
      freeSeconds: rec.freeSeconds as number,
      billableSeconds: rec.billableSeconds as number,
      virtualRentAmountMinor: rec.virtualRentAmountMinor as number,
      currency: normalizeCurrencyCode(rec.currency as string),
      goalMet: rec.goalMet as boolean,
      version: rec.version as number,
      updatedAt: rec.updatedAt as string,
    },
  };
}

export function upsertDailyUsage(userId: string, raw: unknown): DailyUsageDto {
  const parsed = parseUsageRecord(userId, raw);
  if (parsed.errors) throw validationError(parsed.errors);
  const input = parsed.record;

  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM daily_usage WHERE user_id = ? AND device_id = ? AND date = ?")
    .get(userId, input.deviceId, input.date) as DailyUsageRow | undefined;

  if (existing && input.version < existing.version) throw new ApiError("VERSION_CONFLICT");

  const now = new Date().toISOString();

  if (existing) {
    db.prepare(
      `UPDATE daily_usage
       SET total_seconds = ?, free_seconds = ?, billable_seconds = ?, virtual_rent_amount_minor = ?,
           currency = ?, goal_met = ?, version = ?, client_updated_at = ?, server_updated_at = ?
       WHERE id = ?`
    ).run(
      input.totalSeconds,
      input.freeSeconds,
      input.billableSeconds,
      input.virtualRentAmountMinor,
      input.currency,
      input.goalMet ? 1 : 0,
      input.version,
      input.updatedAt,
      now,
      existing.id
    );
    return serialize(db.prepare("SELECT * FROM daily_usage WHERE id = ?").get(existing.id) as DailyUsageRow);
  }

  const id = randomBytes(12).toString("hex");
  db.prepare(
    `INSERT INTO daily_usage
       (id, user_id, device_id, date, total_seconds, free_seconds, billable_seconds, virtual_rent_amount_minor, currency, goal_met, version, client_updated_at, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    input.deviceId,
    input.date,
    input.totalSeconds,
    input.freeSeconds,
    input.billableSeconds,
    input.virtualRentAmountMinor,
    input.currency,
    input.goalMet ? 1 : 0,
    input.version,
    input.updatedAt,
    now
  );
  return serialize(db.prepare("SELECT * FROM daily_usage WHERE id = ?").get(id) as DailyUsageRow);
}

export interface BatchUsageResult {
  date: string | null;
  deviceId: string | null;
  ok: boolean;
  error?: { code: string; message: string; fields?: Record<string, string> };
}

/** Partial success by design (§12): one bad record in a batch never fails the others. */
export function upsertDailyUsageBatch(userId: string, records: unknown): BatchUsageResult[] {
  if (!Array.isArray(records) || records.length === 0) {
    throw validationError({ records: "Wymagana niepusta tablica records." });
  }
  if (records.length > MAX_BATCH_RECORDS) {
    throw validationError({ records: `Maksymalnie ${MAX_BATCH_RECORDS} rekordów na żądanie.` });
  }

  return records.map((raw) => {
    const rec = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const date = typeof rec.date === "string" ? rec.date : null;
    const deviceId = typeof rec.deviceId === "string" ? rec.deviceId : null;
    try {
      upsertDailyUsage(userId, raw);
      return { date, deviceId, ok: true };
    } catch (e) {
      if (e instanceof ApiError) {
        return { date, deviceId, ok: false, error: { code: e.code, message: e.message, fields: e.fields } };
      }
      throw e;
    }
  });
}

export function listDailyUsage(
  userId: string,
  params: { from?: string; to?: string; deviceId?: string }
): DailyUsageDto[] {
  const clauses = ["user_id = ?"];
  const args: unknown[] = [userId];
  if (params.from) {
    clauses.push("date >= ?");
    args.push(params.from);
  }
  if (params.to) {
    clauses.push("date <= ?");
    args.push(params.to);
  }
  if (params.deviceId) {
    clauses.push("device_id = ?");
    args.push(params.deviceId);
  }
  const rows = getDb()
    .prepare(`SELECT * FROM daily_usage WHERE ${clauses.join(" AND ")} ORDER BY date DESC LIMIT 366`)
    .all(...args) as DailyUsageRow[];
  return rows.map(serialize);
}

export interface UsageSummaryDto {
  totalSeconds: number;
  freeSeconds: number;
  billableSeconds: number;
  virtualRentAmountMinor: number;
  currency: string | null;
  daysTracked: number;
  goalsMet: number;
}

export function getUsageSummary(userId: string, params: { from: string; to: string }): UsageSummaryDto {
  const row = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(total_seconds), 0) AS total_seconds,
         COALESCE(SUM(free_seconds), 0) AS free_seconds,
         COALESCE(SUM(billable_seconds), 0) AS billable_seconds,
         COALESCE(SUM(virtual_rent_amount_minor), 0) AS virtual_rent_amount_minor,
         COUNT(*) AS days_tracked,
         COALESCE(SUM(goal_met), 0) AS goals_met,
         MAX(currency) AS currency
       FROM daily_usage WHERE user_id = ? AND date >= ? AND date <= ?`
    )
    .get(userId, params.from, params.to) as {
    total_seconds: number;
    free_seconds: number;
    billable_seconds: number;
    virtual_rent_amount_minor: number;
    days_tracked: number;
    goals_met: number;
    currency: string | null;
  };

  return {
    totalSeconds: row.total_seconds,
    freeSeconds: row.free_seconds,
    billableSeconds: row.billable_seconds,
    virtualRentAmountMinor: row.virtual_rent_amount_minor,
    currency: row.currency,
    daysTracked: row.days_tracked,
    goalsMet: row.goals_met,
  };
}

export interface UsageTrendPointDto {
  date: string;
  totalSeconds: number;
  billableSeconds: number;
  virtualRentAmountMinor: number;
  goalMet: boolean;
}

export function getUsageTrends(userId: string, params: { from: string; to: string }): UsageTrendPointDto[] {
  const rows = getDb()
    .prepare(
      `SELECT date, SUM(total_seconds) AS total_seconds, SUM(billable_seconds) AS billable_seconds,
              SUM(virtual_rent_amount_minor) AS virtual_rent_amount_minor, MAX(goal_met) AS goal_met
       FROM daily_usage WHERE user_id = ? AND date >= ? AND date <= ?
       GROUP BY date ORDER BY date ASC`
    )
    .all(userId, params.from, params.to) as {
    date: string;
    total_seconds: number;
    billable_seconds: number;
    virtual_rent_amount_minor: number;
    goal_met: number;
  }[];

  return rows.map((r) => ({
    date: r.date,
    totalSeconds: r.total_seconds,
    billableSeconds: r.billable_seconds,
    virtualRentAmountMinor: r.virtual_rent_amount_minor,
    goalMet: !!r.goal_met,
  }));
}
