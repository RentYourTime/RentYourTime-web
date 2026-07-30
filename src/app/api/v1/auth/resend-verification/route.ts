import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { ApiError } from "@/lib/http/errors";
import { buildVerificationUrl, createEmailVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { requireAuth } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reuses `@/lib/email-verification` + `@/lib/email` unchanged — same tokens/SES call as the legacy `POST /api/resend-verification`. */
export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_resend_verification", 3, 3600, ctx.user.id);

  if (ctx.user.email_verified) throw new ApiError("CONFLICT", "Adres e-mail jest już zweryfikowany.");

  const { token } = createEmailVerificationToken(ctx.user.id);
  try {
    await sendVerificationEmail({
      email: ctx.user.email,
      displayName: ctx.user.display_name,
      verificationUrl: buildVerificationUrl(token),
    });
  } catch (e) {
    console.error("Verification email send failed:", e instanceof Error ? e.message : e);
    throw new ApiError("SERVICE_UNAVAILABLE", "Nie udało się wysłać wiadomości e-mail.");
  }

  return apiSuccess({ sent: true });
});
