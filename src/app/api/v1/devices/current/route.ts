import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { ApiError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { updateCurrentDevice } from "@/server/devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchDeviceBody {
  deviceName?: unknown;
  systemVersion?: unknown;
  appVersion?: unknown;
  pushToken?: unknown;
  pushEnvironment?: unknown;
}

/** "Current" device = the one bound to this session (set by `POST /devices/register`), never taken from a client-supplied id. */
export const PATCH = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  if (!ctx.session.device_id) throw new ApiError("DEVICE_NOT_FOUND", "Ta sesja nie ma jeszcze powiązanego urządzenia — najpierw wywołaj POST /devices/register.");

  const body = await readV1JsonBody<PatchDeviceBody>(req);
  const device = updateCurrentDevice(ctx.user.id, ctx.session.device_id, {
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined,
    systemVersion: typeof body.systemVersion === "string" ? body.systemVersion : undefined,
    appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
    pushToken: typeof body.pushToken === "string" ? body.pushToken : undefined,
    pushEnvironment: typeof body.pushEnvironment === "string" ? body.pushEnvironment : undefined,
  });

  return apiSuccess({ device });
});
