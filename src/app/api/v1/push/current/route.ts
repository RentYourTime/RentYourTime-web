import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { ApiError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { clearPushTokenForDevice } from "@/server/devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Current" device resolved from the session, same convention as `PATCH /devices/current`. */
export const DELETE = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  if (!ctx.session.device_id) throw new ApiError("DEVICE_NOT_FOUND", "Ta sesja nie ma powiązanego urządzenia.");
  clearPushTokenForDevice(ctx.user.id, ctx.session.device_id);
  return apiSuccess({ cleared: true });
});
