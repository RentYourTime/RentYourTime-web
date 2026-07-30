import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { ApiError } from "@/lib/http/errors";
import { ServerConfigError } from "@/lib/stripe";
import { requireAuth } from "@/server/auth/service";
import { createBillingPortalSession, StripeCustomerMissingError } from "@/server/subscriptions/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Thin wrapper — same `createBillingPortalSession()` the legacy `POST /api/billing/portal` calls. */
export const POST = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_stripe_portal", 10, 600, ctx.user.id);

  try {
    const { portalUrl } = await createBillingPortalSession({ stripeCustomerId: ctx.user.stripe_customer_id });
    return apiSuccess({ portalUrl });
  } catch (e) {
    if (e instanceof StripeCustomerMissingError) throw new ApiError("NOT_FOUND", "Brak klienta Stripe dla tego konta.");
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      throw new ApiError("SERVICE_UNAVAILABLE");
    }
    console.error("Billing portal error:", e instanceof Error ? e.message : e);
    throw new ApiError("SERVER_ERROR", "Błąd dostawcy płatności.");
  }
});
