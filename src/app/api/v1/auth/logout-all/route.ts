import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { logoutAll, requireAuth } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const revokedSessions = logoutAll(ctx.user.id);
  return apiSuccess({ revokedSessions });
});
