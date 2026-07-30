/**
 * `/api/v1/webhooks/stripe` is a re-export, not a second webhook — §14: "Nie
 * twórz drugiego webhooka". Both this path and the legacy `/api/webhook`
 * point at the exact same handler (signature verification, idempotent
 * `webhook_events` dedup, one DB transaction — see src/app/api/webhook/route.ts).
 * Only one of the two should actually be registered in the Stripe Dashboard
 * at a time; see docs/AUTH_MIGRATION.md / docs/PRODUCTION_CHECKLIST.md for
 * the cutover instructions (a Stripe Dashboard change, done manually).
 */
export { POST } from "@/app/api/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
