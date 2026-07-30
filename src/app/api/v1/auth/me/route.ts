import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { requireAuth, serializeAuthUser } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  return apiSuccess({ user: serializeAuthUser(ctx.user) });
});
