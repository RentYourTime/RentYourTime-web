import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

/**
 * Append-only security/audit trail (docs/API_ARCHITECTURE.md). Never throws
 * — a logging failure must not fail the request it's describing — and never
 * receives a password/token/secret in `metadata` (callers pass identifiers,
 * counts, and booleans only).
 */

export interface RecordAuditParams {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export function recordAudit(params: RecordAuditParams): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        randomBytes(12).toString("hex"),
        params.userId,
        params.action,
        params.entityType ?? null,
        params.entityId ?? null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        new Date().toISOString()
      );
  } catch (e) {
    console.error("[audit] failed to record entry:", e instanceof Error ? e.message : e);
  }
}
