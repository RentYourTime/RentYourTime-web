import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { envRequired, getStripe, ServerConfigError } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = rateLimit(req, "checkout", 10, 600);
  if (limited) return limited;

  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  // Which billing period the customer picked (defaults to yearly).
  let plan: "monthly" | "yearly" = "yearly";
  try {
    const body = (await req.json()) as { plan?: unknown };
    if (body?.plan === "monthly") plan = "monthly";
  } catch {
    /* empty / non-JSON body → keep the default */
  }

  try {
    // Yearly falls back to the legacy STRIPE_PRICE_ID when the year-specific
    // variable isn't set, so existing single-price setups keep working.
    const priceId =
      plan === "monthly"
        ? envRequired("STRIPE_PRICE_ID_MONTHLY")
        : process.env.STRIPE_PRICE_ID_YEARLY?.trim() || envRequired("STRIPE_PRICE_ID");
    const siteUrl = envRequired("APP_URL").replace(/\/+$/, "");
    const stripe = getStripe();

    const price = await stripe.prices.retrieve(priceId).catch(() => null);
    if (!price || !price.active) {
      console.error(`Stripe price not found or inactive: ${priceId}`);
      return jsonError("server_not_configured", 503);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${siteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: user.id, plan } },
      metadata: { user_id: user.id, plan },
      ...(user.stripe_customer_id
        ? { customer: user.stripe_customer_id }
        : { customer_email: user.email }),
    });

    if (!session.url) return jsonError("checkout_url_missing", 502);
    return json({ ok: true, checkout_url: session.url, session_id: session.id });
  } catch (e) {
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    console.error("Stripe checkout error:", e);
    return jsonError("payment_provider_error", 502);
  }
}
