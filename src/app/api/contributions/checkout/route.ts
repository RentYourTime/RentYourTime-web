import { currentUser, json, jsonError, rateLimit, readJsonBody } from "@/lib/auth";
import { envRequired, getStripe, ServerConfigError } from "@/lib/stripe";
import { resolveAccruedRentForUser } from "@/lib/accruedRent";
import {
  attachCheckoutSession,
  computeAmountCents,
  createPendingContribution,
  findRecentPendingContribution,
  isAllowedPercentage,
  minimumChargeCents,
} from "@/lib/contributions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CheckoutBody {
  percentage?: unknown;
}

const PRODUCT_NAME = "Support RentYourTime";
const PRODUCT_DESCRIPTION =
  "Optional one-time contribution based on a percentage of virtual accrued rent.";

/**
 * POST /api/contributions/checkout — the only input accepted from the
 * client is `{ percentage }`. userId comes from the session, accrued rent
 * and amount are computed server-side (see docs/CONTRIBUTIONS.md §5) —
 * never trust amount/accruedRent/currency/userId from the request body.
 */
export async function POST(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "contributions_checkout", 10, 600, user.id);
  if (limited) return limited;

  const parsed = await readJsonBody<CheckoutBody>(req);
  if ("error" in parsed) return parsed.error;

  const percentage = parsed.body.percentage;
  if (!isAllowedPercentage(percentage)) return jsonError("invalid_percentage", 400);

  const accrued = resolveAccruedRentForUser(user.id);
  if (!accrued) return jsonError("accrued_rent_unavailable", 409);

  const amountCents = computeAmountCents(accrued.cents, percentage);
  const minimumCents = minimumChargeCents(accrued.currency);
  if (amountCents < minimumCents) {
    return json(
      {
        ok: false,
        error: "amount_too_low",
        minimumCents,
        currency: accrued.currency,
      },
      422
    );
  }

  try {
    // Reuse a still-open Checkout Session from a very recent identical
    // request (double-click / client retry) rather than creating a second one.
    const reusable = findRecentPendingContribution(user.id, percentage);
    if (reusable?.stripe_checkout_session_id) {
      try {
        const existingSession = await getStripe().checkout.sessions.retrieve(
          reusable.stripe_checkout_session_id
        );
        if (existingSession.status === "open" && existingSession.url) {
          return json({ ok: true, checkoutUrl: existingSession.url, contributionId: reusable.id });
        }
      } catch {
        // Session lookup failed (expired/deleted) — fall through and create a fresh one.
      }
    }

    const contribution = createPendingContribution({
      userId: user.id,
      percentage,
      accruedRentCents: accrued.cents,
      amountCents,
      currency: accrued.currency,
      isDemo: accrued.isDemo,
    });

    const siteUrl = envRequired("APP_URL").replace(/\/+$/, "");
    const metadata = {
      kind: "contribution",
      contributionId: contribution.id,
      userId: user.id,
      percentage: String(percentage),
      // Marks a real Stripe Test Mode charge whose amount came from dev-only
      // demo data (docs/CONTRIBUTIONS.md) — not a mock payment, just a demo input.
      ...(accrued.isDemo ? { source: "demo", environment: process.env.NODE_ENV || "development" } : {}),
    };

    const idempotencyHeader = req.headers.get("idempotency-key")?.trim();
    const idempotencyKey = `contribution_${user.id}_${idempotencyHeader || contribution.id}`;

    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: accrued.currency,
              unit_amount: amountCents,
              product_data: { name: PRODUCT_NAME, description: PRODUCT_DESCRIPTION },
            },
            quantity: 1,
          },
        ],
        success_url: `${siteUrl}/panel?tab=contribute&contribution=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/panel?tab=contribute&contribution=cancelled`,
        ...(user.stripe_customer_id
          ? { customer: user.stripe_customer_id }
          : { customer_email: user.email }),
        metadata,
        payment_intent_data: { metadata },
      },
      { idempotencyKey }
    );

    if (!session.url) return jsonError("checkout_url_missing", 502);
    attachCheckoutSession(contribution.id, session.id);

    return json({ ok: true, checkoutUrl: session.url, contributionId: contribution.id });
  } catch (e) {
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    console.error("Contribution checkout error:", e instanceof Error ? e.message : e);
    return jsonError("payment_provider_error", 502);
  }
}
