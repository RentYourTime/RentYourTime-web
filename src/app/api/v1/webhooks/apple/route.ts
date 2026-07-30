/**
 * Re-export of the same structural placeholder as the legacy
 * `/api/webhooks/apple` — see docs/APPLE_SUBSCRIPTIONS.md. Neither URL
 * should be registered in App Store Connect until real JWS verification is
 * implemented (src/lib/apple-subscriptions.ts).
 */
export { POST } from "@/app/api/webhooks/apple/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
