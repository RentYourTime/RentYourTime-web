import { jsonError, json, rateLimit, readJsonBody, requireAdmin } from "@/lib/auth";
import { setFounderBlackTracking } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  trackingNumber?: unknown;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders", 60, 60, gate.user.id);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await readJsonBody<PatchBody>(req);
  if ("error" in parsed) return parsed.error;

  const trackingNumber = typeof parsed.body.trackingNumber === "string" ? parsed.body.trackingNumber.trim() : "";
  if (!trackingNumber || trackingNumber.length > 100) return jsonError("invalid_tracking_number", 422);

  const updated = setFounderBlackTracking(id, trackingNumber);
  if (!updated) return jsonError("not_found", 404);

  return json({ ok: true, data: { trackingNumber: updated.tracking_number, shippedAt: updated.shipped_at } });
}
