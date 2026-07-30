import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { trustedClientIp } from "@/lib/http/security";
import { buildVerificationUrl, createEmailVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { issueSessionTokens, registerAccount, serializeAuthUser, serializeSessionTokens } from "@/server/auth/service";
import { isValidPlatform, type Platform } from "@/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterBody {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  platform?: unknown;
}

export const POST = withApiRoute(async (req) => {
  enforceRateLimit(req, "v1_auth_register", 5, 900);

  const body = await readV1JsonBody<RegisterBody>(req);
  const platform: Platform = isValidPlatform(body.platform) ? body.platform : "WEB";

  const { user } = registerAccount({
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    displayName: typeof body.displayName === "string" ? body.displayName : body.displayName === null ? null : undefined,
  });

  let verificationEmailSent = false;
  try {
    const { token } = createEmailVerificationToken(user.id);
    await sendVerificationEmail({
      email: user.email,
      displayName: user.display_name,
      verificationUrl: buildVerificationUrl(token),
    });
    verificationEmailSent = true;
  } catch (e) {
    // Never log the token/URL — only that sending failed. Registration must still succeed.
    console.error("Verification email send failed:", e instanceof Error ? e.message : e);
  }

  const tokens = issueSessionTokens(user, {
    platform,
    deviceId: null,
    ipAddress: trustedClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess(
    {
      user: serializeAuthUser(user),
      session: serializeSessionTokens(tokens),
      verificationEmailSent,
    },
    { status: 201 }
  );
});
