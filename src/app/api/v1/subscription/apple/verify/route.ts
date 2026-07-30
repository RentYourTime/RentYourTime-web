import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { ApiError, validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import {
  AppleConfigError,
  AppleVerificationNotImplementedError,
  appleConfigured,
  verifyAndDecodeRenewalInfo,
  verifyAndDecodeTransaction,
} from "@/lib/apple-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thin wrapper over the same `@/lib/apple-subscriptions` functions the
 * legacy `POST /api/subscriptions/apple/sync` calls — see
 * docs/APPLE_SUBSCRIPTIONS.md. `verifyAndDecodeTransaction` always throws
 * today (real JWS/x5c verification isn't implemented), so this — like the
 * legacy endpoint — can never grant Pro from unverified data.
 */

interface AppleVerifyBody {
  signedTransactionInfo?: unknown;
  signedRenewalInfo?: unknown;
}

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_apple_verify", 10, 600, ctx.user.id);

  const body = await readV1JsonBody<AppleVerifyBody>(req, 16 * 1024);
  if (typeof body.signedTransactionInfo !== "string" || !body.signedTransactionInfo) {
    throw validationError({ signedTransactionInfo: "Wymagane signedTransactionInfo." });
  }
  if (body.signedRenewalInfo !== undefined && typeof body.signedRenewalInfo !== "string") {
    throw validationError({ signedRenewalInfo: "Nieprawidłowe signedRenewalInfo." });
  }

  if (!appleConfigured()) throw new ApiError("SERVICE_UNAVAILABLE");

  try {
    await verifyAndDecodeTransaction(body.signedTransactionInfo);
    if (typeof body.signedRenewalInfo === "string" && body.signedRenewalInfo) {
      await verifyAndDecodeRenewalInfo(body.signedRenewalInfo);
    }
    // Unreachable today — see the file-level comment.
    return apiSuccess({});
  } catch (e) {
    if (e instanceof AppleVerificationNotImplementedError) throw new ApiError("NOT_IMPLEMENTED");
    if (e instanceof AppleConfigError) {
      console.error(e.message);
      throw new ApiError("SERVICE_UNAVAILABLE");
    }
    console.error("Apple verify error:", e instanceof Error ? e.message : e);
    throw new ApiError("SERVER_ERROR");
  }
});
