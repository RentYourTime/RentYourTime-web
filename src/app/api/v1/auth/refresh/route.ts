import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { trustedClientIp } from "@/lib/http/security";
import { validationError } from "@/lib/http/errors";
import { refreshSession, serializeAuthUser, serializeSessionTokens } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefreshBody {
  refreshToken?: unknown;
}

export const POST = withApiRoute(async (req) => {
  enforceRateLimit(req, "v1_auth_refresh", 30, 900, trustedClientIp(req));

  const body = await readV1JsonBody<RefreshBody>(req);
  if (typeof body.refreshToken !== "string" || !body.refreshToken) {
    throw validationError({ refreshToken: "Wymagany refreshToken." });
  }

  const tokens = refreshSession(body.refreshToken, {
    ipAddress: trustedClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess({
    user: serializeAuthUser(tokens.user),
    session: serializeSessionTokens(tokens),
  });
});
