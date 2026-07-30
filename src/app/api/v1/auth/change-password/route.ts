import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { validationError } from "@/lib/http/errors";
import { changePassword, requireAuth } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChangePasswordBody {
  currentPassword?: unknown;
  newPassword?: unknown;
}

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_auth_change_password", 5, 900, ctx.user.id);

  const body = await readV1JsonBody<ChangePasswordBody>(req);
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    throw validationError({ newPassword: "Wymagane currentPassword i newPassword." });
  }

  // Keeps the session that made this call active; every other session for the account is revoked.
  await changePassword(ctx.user, body.currentPassword, body.newPassword, ctx.session.id);
  return apiSuccess({ changed: true });
});
