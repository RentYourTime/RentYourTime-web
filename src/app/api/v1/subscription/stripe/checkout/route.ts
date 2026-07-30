import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { ApiError } from "@/lib/http/errors";
import { ServerConfigError } from "@/lib/stripe";
import { requireAuth } from "@/server/auth/service";
import {
  createProCheckoutSession,
  parseCheckoutPlan,
  StripeCheckoutDisabledError,
  StripeCheckoutUrlMissingError,
  StripePriceUnavailableError,
} from "@/server/subscriptions/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Thin wrapper — same `createProCheckoutSession()` the legacy `POST /api/checkout` calls (§14: no second Stripe client/checkout path). */
export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_stripe_checkout", 10, 600, ctx.user.id);

  const plan = await parseCheckoutPlan(req);

  try {
    const { checkoutUrl, sessionId } = await createProCheckoutSession({
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      stripeCustomerId: ctx.user.stripe_customer_id,
      plan,
    });
    return apiSuccess({ checkoutUrl, sessionId });
  } catch (e) {
    if (e instanceof StripeCheckoutDisabledError) {
      throw new ApiError("SERVICE_UNAVAILABLE", "Zakup Pro jest obecnie wyłączony.");
    }
    if (e instanceof StripePriceUnavailableError || e instanceof ServerConfigError) {
      if (e instanceof ServerConfigError) console.error(e.message);
      throw new ApiError("SERVICE_UNAVAILABLE");
    }
    if (e instanceof StripeCheckoutUrlMissingError) throw new ApiError("SERVER_ERROR");
    console.error("Stripe checkout error:", e);
    throw new ApiError("SERVER_ERROR", "Błąd dostawcy płatności.");
  }
});
