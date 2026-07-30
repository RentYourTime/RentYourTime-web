import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";

/**
 * `Idempotency-Key` support (spec §12/§20) for any `/api/v1` write endpoint
 * that a mobile client might retry after a dropped response (usage batch
 * sync, device registration, checkout). Keyed by (userId, key, endpoint) —
 * the same key reused against a *different* endpoint is a different
 * idempotency scope on purpose.
 *
 * Concurrency note: two truly simultaneous requests with the same new key
 * can both pass the initial lookup and both run `handler()`; the second
 * `INSERT` then hits the unique index and is caught, after which we re-read
 * and return the first writer's stored response. The handler itself must
 * still be safe to run twice in that narrow race (usage upsert is — it's a
 * plain upsert on `(userId, deviceId, date)`).
 */

const DEFAULT_TTL_SECONDS = 24 * 3600;

function hashBody(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

interface IdempotencyRow {
  request_hash: string;
  response_status: number | null;
  response_body: string | null;
}

export interface WithIdempotencyParams {
  userId: string;
  endpoint: string;
  key: string | null | undefined;
  requestBody: unknown;
  ttlSeconds?: number;
}

export async function withIdempotency<T>(
  params: WithIdempotencyParams,
  handler: () => Promise<{ status: number; data: T }>
): Promise<{ status: number; data: T; replayed: boolean }> {
  if (!params.key) {
    const result = await handler();
    return { ...result, replayed: false };
  }
  if (params.key.length > 200) {
    throw new ApiError("VALIDATION_ERROR", undefined, { idempotencyKey: "Za długi klucz Idempotency-Key." });
  }

  const db = getDb();
  const requestHash = hashBody(params.requestBody);

  const existing = db
    .prepare(
      "SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE user_id = ? AND key = ? AND endpoint = ?"
    )
    .get(params.userId, params.key, params.endpoint) as IdempotencyRow | undefined;

  if (existing) {
    if (existing.request_hash !== requestHash) throw new ApiError("IDEMPOTENCY_KEY_REUSED");
    return {
      status: existing.response_status ?? 200,
      data: existing.response_body ? (JSON.parse(existing.response_body) as T) : (null as T),
      replayed: true,
    };
  }

  const result = await handler();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000).toISOString();

  try {
    db.prepare(
      `INSERT INTO idempotency_keys (id, user_id, key, endpoint, request_hash, response_status, response_body, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomBytes(12).toString("hex"),
      params.userId,
      params.key,
      params.endpoint,
      requestHash,
      result.status,
      JSON.stringify(result.data),
      expiresAt,
      now.toISOString()
    );
  } catch {
    // Lost the race to a concurrent identical request — replay whatever it stored.
    const raced = db
      .prepare(
        "SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE user_id = ? AND key = ? AND endpoint = ?"
      )
      .get(params.userId, params.key, params.endpoint) as IdempotencyRow | undefined;
    if (raced && raced.request_hash === requestHash) {
      return {
        status: raced.response_status ?? result.status,
        data: raced.response_body ? (JSON.parse(raced.response_body) as T) : result.data,
        replayed: true,
      };
    }
  }

  return { ...result, replayed: false };
}
