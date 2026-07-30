import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { isProCheckoutEnabled, ServerConfigError } from "@/lib/stripe";
import {
  createProCheckoutSession,
  parseCheckoutPlan,
  StripeCheckoutDisabledError,
  StripeCheckoutUrlMissingError,
  StripePriceUnavailableError,
} from "@/server/subscriptions/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isProCheckoutEnabled()) return jsonError("pro_checkout_disabled", 503);

  const limited = rateLimit(req, "checkout", 10, 600);
  if (limited) return limited;

  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const plan = await parseCheckoutPlan(req);

  try {
    const { checkoutUrl, sessionId } = await createProCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      stripeCustomerId: user.stripe_customer_id,
      plan,
    });
    return json({ ok: true, checkout_url: checkoutUrl, session_id: sessionId });
  } catch (e) {
    if (e instanceof StripeCheckoutDisabledError) return jsonError("pro_checkout_disabled", 503);
    if (e instanceof StripePriceUnavailableError || e instanceof ServerConfigError) {
      if (e instanceof ServerConfigError) console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    if (e instanceof StripeCheckoutUrlMissingError) return jsonError("checkout_url_missing", 502);
    console.error("Stripe checkout error:", e);
    return jsonError("payment_provider_error", 502);
  }
}
