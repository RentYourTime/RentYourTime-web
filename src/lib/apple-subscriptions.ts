import type { SubscriptionPlan, UpsertAppleSubscriptionParams } from "./subscriptions";

/**
 * Apple App Store Server API / Server Notifications V2 integration —
 * STRUCTURE ONLY. Nothing in this file performs real cryptographic JWS
 * verification (validating the `x5c` certificate chain against Apple's
 * root CA), so nothing here may ever grant Pro. That work requires
 * integrating Apple's App Store Server Library and is intentionally not
 * implemented yet. See docs/APPLE_SUBSCRIPTIONS.md.
 */

export class AppleConfigError extends Error {
  constructor(public variable: string) {
    super(`Missing environment variable: ${variable}`);
    this.name = "AppleConfigError";
  }
}

export class AppleVerificationNotImplementedError extends Error {
  constructor() {
    super(
      "Apple JWS signature verification is not implemented — refusing to trust unverified transaction data."
    );
    this.name = "AppleVerificationNotImplementedError";
  }
}

function appleEnvRequired(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new AppleConfigError(name);
  return value.trim();
}

/** Whether all Apple server-API credentials are present (not whether verification is implemented). */
export function appleConfigured(): boolean {
  return (
    !!process.env.APPLE_ISSUER_ID?.trim() &&
    !!process.env.APPLE_KEY_ID?.trim() &&
    !!process.env.APPLE_PRIVATE_KEY?.trim() &&
    !!process.env.APPLE_BUNDLE_ID?.trim()
  );
}

export type AppleEnvironment = "Sandbox" | "Production";

export type AppleNotificationType =
  | "SUBSCRIBED"
  | "DID_RENEW"
  | "DID_FAIL_TO_RENEW"
  | "EXPIRED"
  | "REFUND"
  | "REVOKE"
  | "GRACE_PERIOD_EXPIRED";

export interface AppleDecodedTransaction {
  originalTransactionId: string;
  productId: string;
  expiresDateMs: number | null;
  environment: AppleEnvironment;
  appAccountToken: string | null;
}

export interface AppleDecodedRenewalInfo {
  originalTransactionId: string;
  autoRenewStatus: boolean;
  autoRenewProductId: string | null;
  environment: AppleEnvironment;
}

/**
 * Would verify the JWS signature of a StoreKit `signedTransactionInfo` and
 * decode its payload. Always throws today: env vars missing ->
 * `AppleConfigError` (caller should respond 503); env vars present ->
 * `AppleVerificationNotImplementedError` (caller should respond 501).
 * Never returns a value a caller could mistake for verified data.
 */
export async function verifyAndDecodeTransaction(
  signedTransactionInfo: string
): Promise<AppleDecodedTransaction> {
  appleEnvRequired("APPLE_ISSUER_ID");
  appleEnvRequired("APPLE_KEY_ID");
  appleEnvRequired("APPLE_PRIVATE_KEY");
  appleEnvRequired("APPLE_BUNDLE_ID");
  void signedTransactionInfo;
  throw new AppleVerificationNotImplementedError();
}

/** Same contract as `verifyAndDecodeTransaction`, for `signedRenewalInfo`. */
export async function verifyAndDecodeRenewalInfo(
  signedRenewalInfo: string
): Promise<AppleDecodedRenewalInfo> {
  appleEnvRequired("APPLE_ISSUER_ID");
  appleEnvRequired("APPLE_KEY_ID");
  appleEnvRequired("APPLE_PRIVATE_KEY");
  appleEnvRequired("APPLE_BUNDLE_ID");
  void signedRenewalInfo;
  throw new AppleVerificationNotImplementedError();
}

function planFromAppleProductId(productId: string): SubscriptionPlan {
  // Placeholder heuristic based on product ID naming convention
  // (e.g. com.rentyourtime.pro.yearly) — replace with a real lookup
  // against the configured product catalog once verification lands.
  if (/year/i.test(productId)) return "YEARLY";
  if (/month/i.test(productId)) return "MONTHLY";
  return "UNKNOWN";
}

/**
 * Pure mapping from decoded (verified, in the future) Apple transaction
 * data to the `subscriptions.ts` upsert shape. Ready to use, but only ever
 * safe to call once `verifyAndDecodeTransaction` actually verifies —
 * today that function always throws, so this has no live caller yet.
 */
export function mapAppleTransactionToSubscription(
  userId: string,
  transaction: AppleDecodedTransaction,
  renewal: AppleDecodedRenewalInfo | null
): UpsertAppleSubscriptionParams {
  return {
    userId,
    originalTransactionId: transaction.originalTransactionId,
    status: "active",
    currentPeriodEnd:
      transaction.expiresDateMs !== null ? Math.floor(transaction.expiresDateMs / 1000) : null,
    productId: transaction.productId,
    plan: planFromAppleProductId(transaction.productId),
    autoRenew: renewal?.autoRenewStatus ?? true,
    startedAt: null,
    canceledAt: null,
    trialEndsAt: null,
    environment: transaction.environment === "Production" ? "live" : "test",
    eventId: null,
  };
}
