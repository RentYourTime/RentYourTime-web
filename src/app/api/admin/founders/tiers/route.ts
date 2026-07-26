import { json, rateLimit, requireAdmin } from "@/lib/auth";
import { listAllFounderTiers, serializeFounderTier } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders", 60, 60, gate.user.id);
  if (limited) return limited;

  const tiers = listAllFounderTiers().map((t) => ({
    id: t.id,
    ...serializeFounderTier(t),
  }));
  return json({ ok: true, tiers });
}
