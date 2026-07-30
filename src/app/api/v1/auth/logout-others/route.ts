import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { logoutOthers, requireAuth } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const revokedSessions = logoutOthers(ctx.user.id, ctx.session.id);
  return apiSuccess({ revokedSessions });
});
