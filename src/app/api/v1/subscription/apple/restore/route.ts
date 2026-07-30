import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { ApiError, validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import {
  AppleConfigError,
  AppleVerificationNotImplementedError,
  appleConfigured,
  verifyAndDecodeTransaction,
} from "@/lib/apple-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Restore purchases" resubmits the same StoreKit transaction JWS as verify
 * — there is no separate Apple API for it — so this calls the exact same
 * `verifyAndDecodeTransaction()` (see docs/APPLE_SUBSCRIPTIONS.md). Kept as
 * its own route because the client-side trigger and expected UX differ
 * (silent background call vs. an explicit "Restore Purchases" button), but
 * the server-side contract is identical: 501 until real JWS verification is
 * implemented, 503 if Apple env vars are missing, never a silent grant.
 */

interface AppleRestoreBody {
  signedTransactionInfo?: unknown;
}

export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_apple_restore", 10, 600, ctx.user.id);

  const body = await readV1JsonBody<AppleRestoreBody>(req, 16 * 1024);
  if (typeof body.signedTransactionInfo !== "string" || !body.signedTransactionInfo) {
    throw validationError({ signedTransactionInfo: "Wymagane signedTransactionInfo." });
  }

  if (!appleConfigured()) throw new ApiError("SERVICE_UNAVAILABLE");

  try {
    await verifyAndDecodeTransaction(body.signedTransactionInfo);
    return apiSuccess({});
  } catch (e) {
    if (e instanceof AppleVerificationNotImplementedError) throw new ApiError("NOT_IMPLEMENTED");
    if (e instanceof AppleConfigError) {
      console.error(e.message);
      throw new ApiError("SERVICE_UNAVAILABLE");
    }
    console.error("Apple restore error:", e instanceof Error ? e.message : e);
    throw new ApiError("SERVER_ERROR");
  }
});
