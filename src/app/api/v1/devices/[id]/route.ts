import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { requireAuth } from "@/server/auth/service";
import { deleteDevice } from "@/server/devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** Revokes the device and, per §11, every session tied to it (including — deliberately — the session making this call, if it's the same device). */
export const DELETE = withApiRoute<RouteCtx>(async (req, { routeCtx }) => {
  const ctx = requireAuth(req);
  const { id } = await routeCtx.params;
  deleteDevice(ctx.user.id, id);
  return apiSuccess({ deleted: true });
});
