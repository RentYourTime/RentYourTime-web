import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { requireAuth } from "@/server/auth/service";
import { withIdempotency } from "@/server/idempotency";
import { upsertDailyUsageBatch } from "@/server/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Larger than the default 16KB cap — up to 100 records (§12/MAX_BATCH_RECORDS) at ~250 bytes each comfortably fits in 64KB.
const MAX_BATCH_BODY_BYTES = 64 * 1024;

interface BatchBody {
  records?: unknown;
}

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const body = await readV1JsonBody<BatchBody>(req, MAX_BATCH_BODY_BYTES);
  const idempotencyKey = req.headers.get("idempotency-key");

  const result = await withIdempotency(
    { userId: ctx.user.id, endpoint: "usage.daily.batch", key: idempotencyKey, requestBody: body },
    async () => ({ status: 200, data: { results: upsertDailyUsageBatch(ctx.user.id, body.records) } })
  );

  return apiSuccess(result.data, { status: result.status });
});
