import { currentUser, jsonError, rateLimit, readJsonBody } from "@/lib/auth";
import {
  AppleConfigError,
  AppleVerificationNotImplementedError,
  appleConfigured,
  verifyAndDecodeRenewalInfo,
  verifyAndDecodeTransaction,
} from "@/lib/apple-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AppleSyncBody {
  signedTransactionInfo?: unknown;
  signedRenewalInfo?: unknown;
}

export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "apple_sync", 10, 600, user.id);
  if (limited) return limited;

  const parsed = await readJsonBody<AppleSyncBody>(req, 16 * 1024);
  if ("error" in parsed) return parsed.error;
  const body = parsed.body;

  if (typeof body.signedTransactionInfo !== "string" || !body.signedTransactionInfo) {
    return jsonError("invalid_signed_transaction_info", 422);
  }
  if (body.signedRenewalInfo !== undefined && typeof body.signedRenewalInfo !== "string") {
    return jsonError("invalid_signed_renewal_info", 422);
  }

  if (!appleConfigured()) {
    return jsonError("server_not_configured", 503);
  }

  try {
    await verifyAndDecodeTransaction(body.signedTransactionInfo);
    if (typeof body.signedRenewalInfo === "string" && body.signedRenewalInfo) {
      await verifyAndDecodeRenewalInfo(body.signedRenewalInfo);
    }
    // Never reached today: verifyAndDecodeTransaction always throws until
    // real JWS verification is implemented. Left in place so wiring the
    // real verifier later only requires removing the throw above it.
    return jsonError("not_implemented", 501);
  } catch (e) {
    if (e instanceof AppleVerificationNotImplementedError) {
      return jsonError("not_implemented", 501);
    }
    if (e instanceof AppleConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    console.error("Apple sync error:", e instanceof Error ? e.message : e);
    return jsonError("apple_sync_failed", 502);
  }
}
