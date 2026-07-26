import { currentUser, json, jsonError, rateLimit, readJsonBody } from "@/lib/auth";
import { envRequired, getStripe, ServerConfigError } from "@/lib/stripe";
import {
  attachFounderCheckoutSession,
  createPendingFounderPurchase,
  getActiveFounderPurchase,
  getFounderTierBySlug,
  isSoldOut,
} from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutBody {
  tierSlug?: unknown;
}

/**
 * POST /api/founders/checkout — the only input accepted from the client is
 * `{ tierSlug }`. Price, currency, Stripe Price ID, and availability are all
 * resolved server-side from `founder_tiers` — never trust anything else
 * about the purchase from the request body (see docs/FOUNDER_PROGRAM.md §5).
 */
export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "founders_checkout", 10, 600, user.id);
  if (limited) return limited;

  const parsed = await readJsonBody<CheckoutBody>(req);
  if ("error" in parsed) return parsed.error;

  const tierSlug = parsed.body.tierSlug;
  if (typeof tierSlug !== "string" || !tierSlug) return jsonError("invalid_tier", 400);

  const tier = getFounderTierBySlug(tierSlug);
  if (!tier) return jsonError("invalid_tier", 400);
  if (!tier.is_active) return jsonError("tier_inactive", 409);
  if (isSoldOut(tier)) return jsonError("sold_out", 409);
  if (!tier.stripe_price_id) return jsonError("server_not_configured", 503);

  const existing = getActiveFounderPurchase(user.id, tier.id);
  if (existing?.payment_status === "PAID") return jsonError("already_owned", 409);

  try {
    // Reuse a still-open Checkout Session from a very recent identical
    // request (double-click / client retry) rather than creating a second one.
    if (existing?.stripe_checkout_session_id) {
      try {
        const existingSession = await getStripe().checkout.sessions.retrieve(
          existing.stripe_checkout_session_id
        );
        if (existingSession.status === "open" && existingSession.url) {
          return json({ ok: true, checkoutUrl: existingSession.url, purchaseId: existing.id });
        }
      } catch {
        // Session lookup failed (expired/deleted) — fall through and create a fresh one.
      }
    }

    const price = await getStripe()
      .prices.retrieve(tier.stripe_price_id)
      .catch(() => null);
    if (!price || !price.active) {
      console.error(`Founder tier ${tier.slug}: Stripe price not found or inactive: ${tier.stripe_price_id}`);
      return jsonError("server_not_configured", 503);
    }

    const purchase = createPendingFounderPurchase({
      userId: user.id,
      tierId: tier.id,
      amountCents: tier.price_cents,
      currency: tier.currency,
    });

    const siteUrl = envRequired("APP_URL").replace(/\/+$/, "");
    const metadata = {
      kind: "founder",
      purchaseId: purchase.id,
      userId: user.id,
      tierSlug: tier.slug,
    };

    const idempotencyHeader = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey = `founder_${user.id}_${idempotencyHeader || purchase.id}`;

    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
        success_url: `${siteUrl}/panel?tab=founder&founder=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/founders?checkout=cancelled`,
        ...(user.stripe_customer_id
          ? { customer: user.stripe_customer_id }
          : { customer_email: user.email }),
        metadata,
        payment_intent_data: { metadata },
      },
      { idempotencyKey }
    );

    if (!session.url) return jsonError("checkout_url_missing", 502);
    attachFounderCheckoutSession(purchase.id, session.id);

    return json({ ok: true, checkoutUrl: session.url, purchaseId: purchase.id });
  } catch (e) {
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    console.error("Founder checkout error:", e instanceof Error ? e.message : e);
    return jsonError("payment_provider_error", 502);
  }
}
