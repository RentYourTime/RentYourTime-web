import { currentUser, jsonError, json, rateLimit, readJsonBody } from "@/lib/auth";
import { getFounderPurchaseById, getFounderTierById, submitFounderBlackShippingDetails } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BlackKitBody {
  purchaseId?: unknown;
  fullName?: unknown;
  shippingAddress?: unknown;
  country?: unknown;
  shirtSize?: unknown;
}

const SHIRT_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL"]);
const MAX_LEN = { fullName: 200, shippingAddress: 500, country: 100 };

function cleanString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

/**
 * POST /api/founders/black-kit — the Founder Black shipping-details form.
 * Ownership is enforced (`purchase.user_id !== user.id` → 404, same
 * no-disclosure pattern used everywhere else), and only a PAID Founder
 * Black purchase can submit — never logs the address itself, only the
 * purchase id (see `submitFounderBlackShippingDetails`).
 */
export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "founders_black_kit", 10, 600, user.id);
  if (limited) return limited;

  const parsed = await readJsonBody<BlackKitBody>(req);
  if ("error" in parsed) return parsed.error;

  const purchaseId = typeof parsed.body.purchaseId === "string" ? parsed.body.purchaseId : "";
  const purchase = purchaseId ? getFounderPurchaseById(purchaseId) : null;
  if (!purchase || purchase.user_id !== user.id) return jsonError("not_found", 404);
  if (purchase.payment_status !== "PAID") return jsonError("not_paid", 409);

  const tier = getFounderTierById(purchase.founder_tier_id);
  if (!tier || tier.slug !== "founder-black") return jsonError("not_founder_black", 409);

  const fullName = cleanString(parsed.body.fullName, MAX_LEN.fullName);
  const shippingAddress = cleanString(parsed.body.shippingAddress, MAX_LEN.shippingAddress);
  const country = cleanString(parsed.body.country, MAX_LEN.country);
  const shirtSize = typeof parsed.body.shirtSize === "string" ? parsed.body.shirtSize.trim().toUpperCase() : "";

  if (!fullName || !shippingAddress || !country || !SHIRT_SIZES.has(shirtSize)) {
    return jsonError("invalid_shipping_details", 400);
  }

  const fulfillment = submitFounderBlackShippingDetails({
    purchaseId: purchase.id,
    fullName,
    shippingAddress,
    country,
    shirtSize,
  });

  return json({
    ok: true,
    data: {
      fullName: fulfillment.full_name,
      shippingAddress: fulfillment.shipping_address,
      country: fulfillment.country,
      shirtSize: fulfillment.shirt_size,
    },
  });
}
