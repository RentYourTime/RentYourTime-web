import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { validationError } from "@/lib/http/errors";
import { trustedClientIp } from "@/lib/http/security";
import { resetPassword } from "@/server/auth/passwordReset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResetPasswordBody {
  token?: unknown;
  newPassword?: unknown;
}

export const POST = withApiRoute(async (req) => {
  enforceRateLimit(req, "v1_reset_password", 10, 900, trustedClientIp(req));

  const body = await readV1JsonBody<ResetPasswordBody>(req);
  if (typeof body.token !== "string" || !body.token) throw validationError({ token: "Wymagany token." });
  if (typeof body.newPassword !== "string") throw validationError({ newPassword: "Wymagane nowe hasło." });

  resetPassword(body.token, body.newPassword);
  return apiSuccess({ reset: true });
});
