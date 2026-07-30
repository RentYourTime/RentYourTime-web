import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { validationError } from "@/lib/http/errors";
import { verifyEmailToken } from "@/lib/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyEmailBody {
  token?: unknown;
}

/** Reuses `@/lib/email-verification` unchanged — the same tokens/table the legacy `POST /api/verify-email` uses. */
export const POST = withApiRoute(async (req) => {
  enforceRateLimit(req, "v1_verify_email", 20, 900);

  const body = await readV1JsonBody<VerifyEmailBody>(req);
  if (typeof body.token !== "string" || !body.token) throw validationError({ token: "Wymagany token." });

  const result = verifyEmailToken(body.token);
  if (!result.ok) throw validationError({ token: "Nieprawidłowy lub wygasły token." });

  return apiSuccess({ verified: true });
});
