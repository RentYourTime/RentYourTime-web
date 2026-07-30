import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { trustedClientIp } from "@/lib/http/security";
import { validationError } from "@/lib/http/errors";
import { login, serializeAuthUser, serializeSessionTokens } from "@/server/auth/service";
import { bindSessionDevice } from "@/server/auth/sessions";
import { getDeviceRowForUser } from "@/server/devices";
import { isValidPlatform, type Platform } from "@/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginBody {
  email?: unknown;
  password?: unknown;
  platform?: unknown;
  deviceId?: unknown;
}

export const POST = withApiRoute(async (req) => {
  enforceRateLimit(req, "v1_auth_login", 10, 900);

  const body = await readV1JsonBody<LoginBody>(req);
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    throw validationError({ email: "Wymagany e-mail i hasło." });
  }
  const platform: Platform = isValidPlatform(body.platform) ? body.platform : "WEB";

  const tokens = await login({
    email: body.email,
    password: body.password,
    platform,
    deviceId: null,
    ipAddress: trustedClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  // An already-registered deviceId can be attached at login time — must belong to this user.
  if (typeof body.deviceId === "string" && body.deviceId) {
    const device = getDeviceRowForUser(tokens.user.id, body.deviceId);
    if (device && !device.revoked_at) bindSessionDevice(tokens.session.id, device.id);
  }

  return apiSuccess({
    user: serializeAuthUser(tokens.user),
    session: serializeSessionTokens(tokens),
  });
});
