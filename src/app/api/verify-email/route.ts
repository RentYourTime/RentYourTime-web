import { json, jsonError, rateLimit, readJsonBody } from "@/lib/auth";
import { verifyEmailToken } from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyEmailBody {
  token?: unknown;
}

export async function POST(req: Request) {
  // Defense in depth beyond the token's own 256 bits of entropy — every
  // other public POST in this app is rate-limited too.
  const limited = rateLimit(req, "verify_email", 20, 900);
  if (limited) return limited;

  const parsed = await readJsonBody<VerifyEmailBody>(req);
  if ("error" in parsed) return parsed.error;

  const token = typeof parsed.body.token === "string" ? parsed.body.token : "";
  if (!token) return jsonError("invalid_or_expired_token", 400);

  const result = verifyEmailToken(token);
  if (result.ok) return json({ ok: true, email_verified: true });
  if (result.reason === "already_verified") {
    return jsonError("email_already_verified", 409);
  }
  return jsonError("invalid_or_expired_token", 400);
}
