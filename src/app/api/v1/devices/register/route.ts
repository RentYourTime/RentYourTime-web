import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { bindSessionDevice } from "@/server/auth/sessions";
import { registerDevice } from "@/server/devices";
import { isValidPlatform } from "@/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterDeviceBody {
  installationId?: unknown;
  platform?: unknown;
  deviceName?: unknown;
  systemVersion?: unknown;
  appVersion?: unknown;
  pushToken?: unknown;
  pushEnvironment?: unknown;
}

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const body = await readV1JsonBody<RegisterDeviceBody>(req);

  if (typeof body.installationId !== "string") throw validationError({ installationId: "Wymagane installationId." });
  if (!isValidPlatform(body.platform)) throw validationError({ platform: "Nieprawidłowa platforma." });

  const device = registerDevice(ctx.user.id, {
    installationId: body.installationId,
    platform: body.platform,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined,
    systemVersion: typeof body.systemVersion === "string" ? body.systemVersion : undefined,
    appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
    pushToken: typeof body.pushToken === "string" ? body.pushToken : undefined,
    pushEnvironment: typeof body.pushEnvironment === "string" ? body.pushEnvironment : undefined,
  });

  // Binds this device to the session that registered it, if that session has no device yet (§11/§7).
  bindSessionDevice(ctx.session.id, device.id);

  return apiSuccess({ device }, { status: 201 });
});
