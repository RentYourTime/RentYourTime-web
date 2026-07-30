import { envRequired, getStripe, isProCheckoutEnabled } from "@/lib/stripe";

/**
 * The one place a Pro Checkout Session / Customer Portal Session gets
 * created. Both the legacy `POST /api/checkout` / `POST /api/billing/portal`
 * and the new `POST /api/v1/subscription/stripe/checkout` / `.../portal`
 * call these — see docs/API_ARCHITECTURE.md: "Nie twórz drugiego webhooka"
 * applies equally to not building a second checkout-creation code path.
 * `getStripe()`/`envRequired()` (from `@/lib/stripe`) remain the single
 * Stripe client and env-var reader; nothing here constructs its own.
 *
 * Deliberately throws distinct error classes rather than one generic error
 * — the legacy routes map these to their existing, test-covered
 * `{ ok:false, error:"..." }` codes; the v1 routes map the same classes to
 * `ApiError` codes. Neither call site duplicates the Stripe logic itself.
 */

export class StripeCheckoutDisabledError extends Error {}
export class StripePriceUnavailableError extends Error {}
export class StripeCheckoutUrlMissingError extends Error {}
export class StripeCustomerMissingError extends Error {}

/** Shared by the legacy and v1 checkout routes — tolerant of an empty/non-JSON body (mobile and web both may send no body at all), defaulting to yearly. */
export async function parseCheckoutPlan(req: Request): Promise<"monthly" | "yearly"> {
  try {
    const body = (await req.json()) as { plan?: unknown };
    if (body?.plan === "monthly") return "monthly";
  } catch {
    /* empty / non-JSON body -> keep the default */
  }
  return "yearly";
}

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  stripeCustomerId: string | null;
  plan: "monthly" | "yearly";
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
}

export async function createProCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
  if (!isProCheckoutEnabled()) throw new StripeCheckoutDisabledError();

  const priceId =
    params.plan === "monthly"
      ? envRequired("STRIPE_PRICE_ID_MONTHLY")
      : process.env.STRIPE_PRICE_ID_YEARLY?.trim() || envRequired("STRIPE_PRICE_ID");
  const siteUrl = envRequired("APP_URL").replace(/\/+$/, "");
  const stripe = getStripe();

  const price = await stripe.prices.retrieve(priceId).catch(() => null);
  if (!price || !price.active) {
    console.error(`Stripe price not found or inactive: ${priceId}`);
    throw new StripePriceUnavailableError();
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: params.userId,
    success_url: params.successUrl ?? `${siteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl ?? `${siteUrl}/pricing?checkout=cancelled`,
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: params.userId, plan: params.plan } },
    metadata: { user_id: params.userId, plan: params.plan },
    ...(params.stripeCustomerId ? { customer: params.stripeCustomerId } : { customer_email: params.userEmail }),
  });

  if (!session.url) throw new StripeCheckoutUrlMissingError();
  return { checkoutUrl: session.url, sessionId: session.id };
}

export interface CreatePortalSessionParams {
  stripeCustomerId: string | null;
  returnUrl?: string;
}

export async function createBillingPortalSession(params: CreatePortalSessionParams): Promise<{ portalUrl: string }> {
  if (!params.stripeCustomerId) throw new StripeCustomerMissingError();
  const siteUrl = envRequired("APP_URL").replace(/\/+$/, "");
  const session = await getStripe().billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl ?? `${siteUrl}/account`,
  });
  return { portalUrl: session.url };
}
