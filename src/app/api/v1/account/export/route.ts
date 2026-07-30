import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { requireAuth } from "@/server/auth/service";
import { exportAccountData } from "@/server/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_account_export", 5, 3600, ctx.user.id);
  return apiSuccess(exportAccountData(ctx.user));
});
