import { getDb } from "./db";
import { getSubscriptionForUser, subscriptionGrantsPro } from "./subscriptions";

/** Admin-panel reads/writes on the `users` table (suspend/restore + listing). Delete is deliberately absent here — the admin panel's "Delete" action stays UI-only for now. */

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: number;
  created_at: string;
}

export interface SerializedAdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_pro: boolean;
  is_active: boolean;
  created_at: string;
}

function serialize(row: AdminUserRow): SerializedAdminUser {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    is_active: !!row.is_active,
    is_pro: subscriptionGrantsPro(getSubscriptionForUser(row.id)),
    created_at: row.created_at,
  };
}

export interface ListAdminUsersOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export function listAdminUsers(
  opts: ListAdminUsersOptions
): { users: SerializedAdminUser[]; total: number } {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 50), 1), 200);
  const offset = Math.max(Math.floor(opts.offset ?? 0), 0);
  const db = getDb();

  const where = opts.search ? "WHERE email LIKE ?" : "";
  const params = opts.search ? [`%${opts.search}%`] : [];

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM users ${where}`).get(...params) as { n: number }
  ).n;
  const rows = db
    .prepare(
      `SELECT id, email, display_name, role, is_active, created_at FROM users ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as AdminUserRow[];

  return { users: rows.map(serialize), total };
}

export interface AdminOverviewStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  proUsers: number;
  freeUsers: number;
  teamAdmins: number;
}

/** Walks every user once to reuse `subscriptionGrantsPro` as the single source of truth for Pro status, rather than re-deriving its active/trialing + period-end rule in SQL. Fine at this scale — a local SQLite file, admin-only, low-traffic endpoint. */
export function getAdminOverviewStats(): AdminOverviewStats {
  const rows = getDb()
    .prepare("SELECT id, role, is_active FROM users")
    .all() as { id: string; role: string; is_active: number }[];

  let activeUsers = 0;
  let suspendedUsers = 0;
  let proUsers = 0;
  let teamAdmins = 0;

  for (const row of rows) {
    if (row.is_active) activeUsers++;
    else suspendedUsers++;
    if (row.role === "ADMIN_TEAMS") teamAdmins++;
    if (subscriptionGrantsPro(getSubscriptionForUser(row.id))) proUsers++;
  }

  return {
    totalUsers: rows.length,
    activeUsers,
    suspendedUsers,
    proUsers,
    freeUsers: rows.length - proUsers,
    teamAdmins,
  };
}

export function getAdminUserById(id: string): AdminUserRow | null {
  const row = getDb()
    .prepare("SELECT id, email, display_name, role, is_active, created_at FROM users WHERE id = ?")
    .get(id) as AdminUserRow | undefined;
  return row ?? null;
}

/** Flips `is_active` — real and immediately effective (`currentUser()` rejects deactivated accounts on their very next request). */
export function setUserActive(id: string, active: boolean): SerializedAdminUser | null {
  const existing = getAdminUserById(id);
  if (!existing) return null;
  getDb()
    .prepare("UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?")
    .run(active ? 1 : 0, new Date().toISOString(), id);
  return serialize({ ...existing, is_active: active ? 1 : 0 });
}
