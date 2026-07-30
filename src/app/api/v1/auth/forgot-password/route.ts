import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { validationError } from "@/lib/http/errors";
import { trustedClientIp } from "@/lib/http/security";
import { sendPasswordResetEmail } from "@/lib/email";
import { buildPasswordResetUrl, createPasswordResetToken } from "@/server/auth/passwordReset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ForgotPasswordBody {
  email?: unknown;
}

/** Always returns the same generic success, whether or not the email matched an account — no account-existence leak, same philosophy as login/register. */
export const POST = withApiRoute(async (req) => {
  enforceRateLimit(req, "v1_forgot_password", 5, 900, trustedClientIp(req));

  const body = await readV1JsonBody<ForgotPasswordBody>(req);
  if (typeof body.email !== "string" || !body.email) throw validationError({ email: "Wymagany adres e-mail." });

  const result = createPasswordResetToken(body.email);
  if (result) {
    try {
      await sendPasswordResetEmail({
        email: result.user.email,
        displayName: result.user.display_name,
        resetUrl: buildPasswordResetUrl(result.token),
      });
    } catch (e) {
      console.error("Password reset email send failed:", e instanceof Error ? e.message : e);
    }
  }

  return apiSuccess({ sent: true });
});
