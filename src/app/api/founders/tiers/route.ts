import { json } from "@/lib/auth";
import { listActiveFounderTiers, serializeFounderTier } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/founders/tiers — public (no auth required, matches the marketing
 * page). Deliberately uncached (`force-dynamic`, no Cache-Control beyond the
 * no-store `json()` already sets) so remaining-quantity is always current —
 * see docs/FOUNDER_PROGRAM.md "Availability" for why this can't be cached.
 */
export async function GET() {
  const tiers = listActiveFounderTiers().map(serializeFounderTier);
  return json({ ok: true, tiers });
}
