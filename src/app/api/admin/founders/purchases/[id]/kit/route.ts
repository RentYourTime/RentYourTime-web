import { jsonError, json, rateLimit, readJsonBody, requireAdmin } from "@/lib/auth";
import {
  getFounderBlackFulfillment,
  getFounderPurchaseById,
  isKitStatusField,
  updateFounderBlackKitStatus,
} from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — the one place shipping address/full name are returned to an admin.
 * Operational necessity (fulfilling a physical kit), never part of any bulk
 * export or list response — see docs/FOUNDER_PROGRAM.md "Privacy".
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders", 60, 60, gate.user.id);
  if (limited) return limited;

  const { id } = await params;
  const purchase = getFounderPurchaseById(id);
  if (!purchase) return jsonError("not_found", 404);
  const kit = getFounderBlackFulfillment(id);

  return json({
    ok: true,
    data: kit
      ? {
          fullName: kit.full_name,
          shippingAddress: kit.shipping_address,
          country: kit.country,
          shirtSize: kit.shirt_size,
          cardStatus: kit.card_status,
          certificateStatus: kit.certificate_status,
          letterStatus: kit.letter_status,
          shirtStatus: kit.shirt_status,
          trackingNumber: kit.tracking_number,
          shippedAt: kit.shipped_at,
        }
      : null,
  });
}

interface PatchBody {
  field?: unknown;
  status?: unknown;
}

const ITEM_STATUSES: ReadonlySet<string> = new Set(["pending", "prepared", "shipped"]);

/** PATCH — `{ field: "card_status"|"certificate_status"|"letter_status"|"shirt_status", status }`. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders", 60, 60, gate.user.id);
  if (limited) return limited;

  const { id } = await params;
  const parsed = await readJsonBody<PatchBody>(req);
  if ("error" in parsed) return parsed.error;

  const { field, status } = parsed.body;
  if (!isKitStatusField(field)) return jsonError("invalid_field", 422);
  if (typeof status !== "string" || !ITEM_STATUSES.has(status)) return jsonError("invalid_status", 422);

  const updated = updateFounderBlackKitStatus(id, field, status as "pending" | "prepared" | "shipped");
  if (!updated) return jsonError("not_found", 404);

  return json({ ok: true, data: { [field]: updated[field] } });
}
