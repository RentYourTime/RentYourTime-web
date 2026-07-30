import { beforeAll, describe, expect, it, vi } from "vitest";
import { useIsolatedDataDir } from "../helpers/testDb";

beforeAll(() => {
  useIsolatedDataDir();
});

import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/http/errors";
import { withIdempotency } from "@/server/idempotency";

function makeUser(): string {
  const id = randomBytes(8).toString("hex");
  getDb()
    .prepare(`INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, 'x', ?)`)
    .run(id, `${id}@example.com`, new Date().toISOString());
  return id;
}

describe("withIdempotency", () => {
  it("runs the handler exactly once for a given key, replaying afterwards", async () => {
    const userId = makeUser();
    const handler = vi.fn(async () => ({ status: 201, data: { value: 42 } }));

    const first = await withIdempotency(
      { userId, endpoint: "test.endpoint", key: "key-1", requestBody: { a: 1 } },
      handler
    );
    const second = await withIdempotency(
      { userId, endpoint: "test.endpoint", key: "key-1", requestBody: { a: 1 } },
      handler
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.data).toEqual({ value: 42 });
    expect(second.status).toBe(201);
  });

  it("rejects the same key reused with a different request body", async () => {
    const userId = makeUser();
    const handler = vi.fn(async () => ({ status: 200, data: {} }));

    await withIdempotency({ userId, endpoint: "test.endpoint", key: "key-2", requestBody: { a: 1 } }, handler);

    await expect(
      withIdempotency({ userId, endpoint: "test.endpoint", key: "key-2", requestBody: { a: 2 } }, handler)
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("runs the handler every time when no key is provided", async () => {
    const userId = makeUser();
    const handler = vi.fn(async () => ({ status: 200, data: {} }));

    await withIdempotency({ userId, endpoint: "test.endpoint", key: null, requestBody: {} }, handler);
    await withIdempotency({ userId, endpoint: "test.endpoint", key: null, requestBody: {} }, handler);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("scopes keys per endpoint — the same key against a different endpoint runs independently", async () => {
    const userId = makeUser();
    const handler = vi.fn(async () => ({ status: 200, data: {} }));

    await withIdempotency({ userId, endpoint: "endpoint.a", key: "shared-key", requestBody: {} }, handler);
    await withIdempotency({ userId, endpoint: "endpoint.b", key: "shared-key", requestBody: {} }, handler);

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
