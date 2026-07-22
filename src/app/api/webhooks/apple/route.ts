import { jsonError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Structural placeholder for Apple's App Store Server Notifications V2.
 * Apple POSTs `{ signedPayload: "<JWS>" }`. This handler deliberately does
 * NOT decode or trust that payload — verifying it against Apple's root CA
 * (App Store Server Library) is not implemented yet, so no notification
 * here may ever grant, renew, or revoke Pro.
 *
 * Do NOT register this URL in App Store Connect until real verification
 * lands; Apple will keep retrying a non-2xx response, which is fine while
 * this endpoint isn't live. See docs/APPLE_SUBSCRIPTIONS.md.
 *
 * Once verification is implemented, this becomes a switch over the
 * decoded `notificationType` (`AppleNotificationType` in
 * `@/lib/apple-subscriptions`): SUBSCRIBED/DID_RENEW -> active,
 * DID_FAIL_TO_RENEW -> past_due, EXPIRED/GRACE_PERIOD_EXPIRED -> expired,
 * REFUND -> refunded, REVOKE -> canceled — each branch calling
 * `upsertAppleSubscription(...)` from `@/lib/subscriptions`.
 */
export async function POST(req: Request) {
  await req.text(); // drain the body; nothing is parsed or trusted yet
  return jsonError("not_implemented", 501);
}
