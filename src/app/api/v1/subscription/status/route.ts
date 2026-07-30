import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { requireAuth } from "@/server/auth/service";
import { getUserAccess } from "@/server/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  return apiSuccess(getUserAccess(ctx.user.id));
});
