import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { setDevicePushToken } from "@/server/devices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PushRegisterBody {
  deviceId?: unknown;
  pushToken?: unknown;
  pushEnvironment?: unknown;
}

/** Never logs the push token itself (§19) — only the outcome. */
export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const body = await readV1JsonBody<PushRegisterBody>(req);

  if (typeof body.deviceId !== "string" || !body.deviceId) throw validationError({ deviceId: "Wymagane deviceId." });
  if (typeof body.pushToken !== "string" || !body.pushToken) throw validationError({ pushToken: "Wymagany token push." });
  if (typeof body.pushEnvironment !== "string") throw validationError({ pushEnvironment: "Wymagane pushEnvironment." });

  const device = setDevicePushToken(ctx.user.id, body.deviceId, {
    pushToken: body.pushToken,
    pushEnvironment: body.pushEnvironment,
  });

  return apiSuccess({ device });
});
