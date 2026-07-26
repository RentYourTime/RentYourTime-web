import { jsonError, json, rateLimit, readJsonBody, requireAdmin } from "@/lib/auth";
import { getFounderTierById, serializeFounderTier, setFounderTierActive, updateFounderTierLimit } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  action?: unknown;
  totalQuantity?: unknown;
}

/**
 * PATCH /api/admin/founders/tiers/[id] — either `{ action: "activate" | "deactivate" }`
 * or `{ totalQuantity: number }` (never below what's already sold — enforced
 * in `updateFounderTierLimit`, not just here).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders", 60, 60, gate.user.id);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await readJsonBody<PatchBody>(req);
  if ("error" in parsed) return parsed.error;

  const { action, totalQuantity } = parsed.body;

  if (action !== undefined) {
    if (action !== "activate" && action !== "deactivate") return jsonError("invalid_action", 422);
    const tier = setFounderTierActive(id, action === "activate");
    if (!tier) return jsonError("not_found", 404);
    return json({ ok: true, tier: { id: tier.id, ...serializeFounderTier(tier) } });
  }

  if (totalQuantity !== undefined) {
    if (typeof totalQuantity !== "number" || !Number.isInteger(totalQuantity) || totalQuantity < 0) {
      return jsonError("invalid_total_quantity", 422);
    }
    const result = updateFounderTierLimit(id, totalQuantity);
    if (!result.ok) {
      return jsonError(result.error, result.error === "not_found" ? 404 : 409);
    }
    return json({ ok: true, tier: { id: result.tier.id, ...serializeFounderTier(result.tier) } });
  }

  const tier = getFounderTierById(id);
  if (!tier) return jsonError("not_found", 404);
  return jsonError("no_op", 400);
}
