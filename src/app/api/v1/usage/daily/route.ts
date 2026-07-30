import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { withIdempotency } from "@/server/idempotency";
import { isValidDateString } from "@/server/validation";
import { listDailyUsage, upsertDailyUsage } from "@/server/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const body = await readV1JsonBody<unknown>(req);
  const idempotencyKey = req.headers.get("idempotency-key");

  const result = await withIdempotency(
    { userId: ctx.user.id, endpoint: "usage.daily.upsert", key: idempotencyKey, requestBody: body },
    async () => ({ status: 200, data: upsertDailyUsage(ctx.user.id, body) })
  );

  return apiSuccess(result.data, { status: result.status });
});

export const GET = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const deviceId = url.searchParams.get("deviceId") ?? undefined;

  if (from && !isValidDateString(from)) throw validationError({ from: "Nieprawidłowa data (YYYY-MM-DD)." });
  if (to && !isValidDateString(to)) throw validationError({ to: "Nieprawidłowa data (YYYY-MM-DD)." });

  return apiSuccess({ records: listDailyUsage(ctx.user.id, { from, to, deviceId }) });
});
