import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { buildVerificationUrl, createEmailVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_RESPONSE = {
  ok: true,
  message: "If verification is still required, a new email has been sent.",
};

export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "resend_verification", 3, 3600, user.id);
  if (limited) return limited;

  // Same response either way — never reveal verification state or whether
  // sending actually succeeded (provider errors are never surfaced here).
  if (!user.email_verified) {
    try {
      const { token } = createEmailVerificationToken(user.id);
      const verificationUrl = buildVerificationUrl(token);
      await sendVerificationEmail({
        email: user.email,
        displayName: user.display_name,
        verificationUrl,
      });
    } catch (e) {
      console.error("Resend verification email failed:", e instanceof Error ? e.message : e);
    }
  }

  return json(GENERIC_RESPONSE);
}
