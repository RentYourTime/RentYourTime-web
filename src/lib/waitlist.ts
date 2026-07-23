import { randomBytes } from "node:crypto";
import { getDb } from "./db";

/** All `waitlist` table reads/writes live here — routes and the admin API stay thin. */

export type WaitlistSource = "WEBSITE" | "DISCORD" | "MANUAL" | "TEAMS";
export type WaitlistStatus = "NEW" | "CONTACTED" | "INVITED" | "CONVERTED" | "UNSUBSCRIBED";

const SOURCES: ReadonlySet<string> = new Set(["WEBSITE", "DISCORD", "MANUAL", "TEAMS"]);
const STATUSES: ReadonlySet<string> = new Set([
  "NEW",
  "CONTACTED",
  "INVITED",
  "CONVERTED",
  "UNSUBSCRIBED",
]);

export function isWaitlistSource(value: unknown): value is WaitlistSource {
  return typeof value === "string" && SOURCES.has(value);
}

export function isWaitlistStatus(value: unknown): value is WaitlistStatus {
  return typeof value === "string" && STATUSES.has(value);
}

export interface WaitlistRow {
  email: string;
  created_at: string;
  ip: string | null;
  notified: number;
  id: string;
  source: WaitlistSource;
  status: WaitlistStatus;
  confirmation_sent: number;
  owner_email_notified: number;
  user_agent: string | null;
  updated_at: string | null;
  contacted_at: string | null;
  notes: string | null;
}

export interface SerializedWaitlistRecord {
  id: string;
  email: string;
  source: WaitlistSource;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string | null;
  contacted_at: string | null;
  notified: boolean;
  owner_email_notified: boolean;
  confirmation_sent: boolean;
  notes: string | null;
}

export function countWaitlist(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM waitlist").get() as { n: number }).n;
}

export interface WaitlistStats {
  total: number;
  new: number;
  website: number;
  discord: number;
}

/** "New" means signed up in the last 7 days (admin panel shows it as "New (7d)"), not status=NEW. */
export function getWaitlistStats(): WaitlistStats {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_count,
         SUM(CASE WHEN source = 'WEBSITE' THEN 1 ELSE 0 END) AS website_count,
         SUM(CASE WHEN source = 'DISCORD' THEN 1 ELSE 0 END) AS discord_count
       FROM waitlist`
    )
    .get(sevenDaysAgo) as {
    total: number;
    new_count: number | null;
    website_count: number | null;
    discord_count: number | null;
  };
  return {
    total: row.total,
    new: row.new_count ?? 0,
    website: row.website_count ?? 0,
    discord: row.discord_count ?? 0,
  };
}

export interface InsertWaitlistSignupParams {
  email: string;
  ipHash: string | null;
  userAgent: string | null;
  source?: WaitlistSource;
}

/**
 * Atomic insert-or-ignore (`ON CONFLICT DO NOTHING`), so concurrent
 * duplicate submissions can never race into two rows the way a
 * SELECT-then-INSERT check could. `email` is the primary key across every
 * source, so a repeat signup under a different source is a silent no-op —
 * same "never disclose whether the address already existed" behavior the
 * caller already relies on.
 */
export function insertWaitlistSignup(
  params: InsertWaitlistSignupParams
): { id: string; isNew: boolean } {
  const db = getDb();
  const id = randomBytes(12).toString("hex");
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO waitlist
         (email, created_at, ip, notified, id, source, status, confirmation_sent, owner_email_notified, user_agent, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, 'NEW', 0, 0, ?, ?)
       ON CONFLICT(email) DO NOTHING`
    )
    .run(params.email, now, params.ipHash, id, params.source ?? "WEBSITE", params.userAgent, now);

  if (result.changes > 0) return { id, isNew: true };

  const existing = db.prepare("SELECT id FROM waitlist WHERE email = ?").get(params.email) as
    | { id: string | null }
    | undefined;
  return { id: existing?.id ?? "", isNew: false };
}

export function getWaitlistById(id: string): WaitlistRow | null {
  const row = getDb().prepare("SELECT * FROM waitlist WHERE id = ?").get(id) as
    | WaitlistRow
    | undefined;
  return row ?? null;
}

export function markConfirmationSent(id: string): void {
  getDb()
    .prepare("UPDATE waitlist SET confirmation_sent = 1, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function markOwnerEmailNotified(id: string): void {
  getDb()
    .prepare("UPDATE waitlist SET owner_email_notified = 1, updated_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export interface ListWaitlistOptions {
  search?: string;
  source?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export function listWaitlistForAdmin(opts: ListWaitlistOptions): {
  records: WaitlistRow[];
  total: number;
} {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 50), 1), 200);
  const offset = Math.max(Math.floor(opts.offset ?? 0), 0);
  const { where, params } = buildWaitlistFilter(opts);
  const db = getDb();

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM waitlist ${where}`).get(...params) as { n: number }
  ).n;

  const records = db
    .prepare(`SELECT * FROM waitlist ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as WaitlistRow[];

  return { records, total };
}

/** No pagination — used only by CSV export, which needs every matching row. */
export function getAllWaitlistRecords(
  opts: { search?: string; source?: string; status?: string } = {}
): WaitlistRow[] {
  const { where, params } = buildWaitlistFilter(opts);
  return getDb()
    .prepare(`SELECT * FROM waitlist ${where} ORDER BY created_at DESC`)
    .all(...params) as WaitlistRow[];
}

function buildWaitlistFilter(opts: {
  search?: string;
  source?: string;
  status?: string;
}): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts.search) {
    clauses.push("email LIKE ?");
    params.push(`%${opts.search}%`);
  }
  if (isWaitlistSource(opts.source)) {
    clauses.push("source = ?");
    params.push(opts.source);
  }
  if (isWaitlistStatus(opts.status)) {
    clauses.push("status = ?");
    params.push(opts.status);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export interface UpdateWaitlistParams {
  status?: unknown;
  notes?: unknown;
  contactedAt?: unknown;
}

/** Whitelisted update — only status/notes/contacted_at are ever writable here. */
export function updateWaitlistRecord(id: string, params: UpdateWaitlistParams): WaitlistRow | null {
  const existing = getWaitlistById(id);
  if (!existing) return null;

  const status = isWaitlistStatus(params.status) ? params.status : existing.status;
  const notes =
    params.notes === undefined
      ? existing.notes
      : params.notes === null
        ? null
        : String(params.notes).slice(0, 2000);
  let contactedAt =
    params.contactedAt === undefined
      ? existing.contacted_at
      : params.contactedAt === null
        ? null
        : String(params.contactedAt);
  if (status === "CONTACTED" && !contactedAt) {
    contactedAt = new Date().toISOString();
  }

  getDb()
    .prepare(
      "UPDATE waitlist SET status = ?, notes = ?, contacted_at = ?, updated_at = ? WHERE id = ?"
    )
    .run(status, notes, contactedAt, new Date().toISOString(), id);

  return getWaitlistById(id);
}

export function serializeWaitlistRecord(row: WaitlistRow): SerializedWaitlistRecord {
  return {
    id: row.id,
    email: row.email,
    source: row.source,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contacted_at: row.contacted_at,
    notified: !!row.notified,
    owner_email_notified: !!row.owner_email_notified,
    confirmation_sent: !!row.confirmation_sent,
    notes: row.notes,
  };
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPORT_COLUMNS = [
  "email",
  "source",
  "status",
  "created_at",
  "contacted_at",
  "notified",
  "owner_email_notified",
  "confirmation_sent",
  "notes",
] as const;

/** No `ip`/`user_agent` — not needed by whoever consumes this export. */
export function exportWaitlistCsv(records: WaitlistRow[]): string {
  const header = EXPORT_COLUMNS.join(",");
  const lines = records.map((row) => {
    const serialized = serializeWaitlistRecord(row);
    return EXPORT_COLUMNS.map((col) => csvEscape(serialized[col])).join(",");
  });
  return [header, ...lines].join("\n");
}
