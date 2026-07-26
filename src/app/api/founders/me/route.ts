import { currentUser, json, jsonError } from "@/lib/auth";
import {
  formatFounderNumber,
  getFounderBlackFulfillment,
  getFounderProfile,
  getFounderTierById,
  listFounderPurchasesForUser,
} from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/founders/me — always scoped to the caller; no userId parameter is
 * ever accepted. Powers the "Founder Status" tab in the client panel.
 * Shipping address is included here (the owner reading their own data), but
 * is never part of any admin list/export response shape shown elsewhere.
 */
export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const purchases = listFounderPurchasesForUser(user.id).map((p) => {
    const tier = getFounderTierById(p.founder_tier_id)!;
    const fulfillment = tier.slug === "founder-black" ? getFounderBlackFulfillment(p.id) : null;
    return {
      id: p.id,
      tierSlug: tier.slug,
      tierName: tier.name,
      founderNumber: p.founder_number,
      founderNumberFormatted: p.founder_number !== null ? formatFounderNumber(tier, p.founder_number) : null,
      paymentStatus: p.payment_status,
      fulfillmentStatus: p.fulfillment_status,
      purchasedAt: p.created_at,
      proStartsAt: p.pro_starts_at,
      proEndsAt: p.pro_ends_at,
      isLifetimePro: !!p.is_lifetime_pro,
      discordSyncStatus: p.discord_sync_status,
      blackKit: fulfillment
        ? {
            fullName: fulfillment.full_name,
            shippingAddress: fulfillment.shipping_address,
            country: fulfillment.country,
            shirtSize: fulfillment.shirt_size,
            cardStatus: fulfillment.card_status,
            certificateStatus: fulfillment.certificate_status,
            letterStatus: fulfillment.letter_status,
            shirtStatus: fulfillment.shirt_status,
            trackingNumber: fulfillment.tracking_number,
            shippedAt: fulfillment.shipped_at,
          }
        : null,
    };
  });

  const profile = getFounderProfile(user.id);

  return json({
    ok: true,
    data: {
      purchases,
      profile: profile
        ? {
            displayName: profile.display_name,
            consentDirectory: !!profile.consent_directory,
            consentCredits: !!profile.consent_credits,
            consentCaseStudy: !!profile.consent_case_study,
          }
        : null,
    },
  });
}
