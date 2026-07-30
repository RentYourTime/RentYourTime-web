import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { ServerConfigError } from "@/lib/stripe";
import { createBillingPortalSession, StripeCustomerMissingError } from "@/server/subscriptions/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "billing_portal", 10, 600, user.id);
  if (limited) return limited;

  try {
    const { portalUrl } = await createBillingPortalSession({ stripeCustomerId: user.stripe_customer_id });
    return json({ ok: true, portal_url: portalUrl });
  } catch (e) {
    if (e instanceof StripeCustomerMissingError) return jsonError("customer_not_found", 400);
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    console.error("Billing portal error:", e instanceof Error ? e.message : e);
    return jsonError("portal_unavailable", 502);
  }
}
