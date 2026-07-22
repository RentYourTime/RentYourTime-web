import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { envRequired, getStripe, ServerConfigError } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "billing_portal", 10, 600, user.id);
  if (limited) return limited;

  if (!user.stripe_customer_id) return jsonError("customer_not_found", 400);

  try {
    const siteUrl = envRequired("APP_URL").replace(/\/+$/, "");
    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${siteUrl}/account`,
    });
    return json({ ok: true, portal_url: session.url });
  } catch (e) {
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    console.error("Billing portal error:", e instanceof Error ? e.message : e);
    return jsonError("portal_unavailable", 502);
  }
}
