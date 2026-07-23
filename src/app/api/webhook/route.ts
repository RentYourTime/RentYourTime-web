import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { json, jsonError } from "@/lib/auth";
import {
  envRequired,
  getStripe,
  planFromInterval,
  resolveCurrentPeriodEnd,
  ServerConfigError,
} from "@/lib/stripe";
import { upsertStripeSubscription } from "@/lib/subscriptions";
import {
  attachPaymentToInvoice,
  markMostRecentInvoiceRefunded,
  upsertInvoiceRecord,
} from "@/lib/billing";
import {
  applyRefund,
  contributionSessionMetadata,
  getContributionByPaymentIntentId,
  markContributionExpired,
  markContributionFailed,
  settleContributionFromSession,
} from "@/lib/contributions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIso(epochSeconds: number | null | undefined): string | null {
  return typeof epochSeconds === "number" ? new Date(epochSeconds * 1000).toISOString() : null;
}

type CustomerRef = string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined;

function customerId(value: CustomerRef): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * `Invoice.subscription` moved to `invoice.parent.subscription_details.subscription`
 * in newer Stripe API versions — same shape churn as `current_period_end`.
 * Read both, preferring the legacy top-level field when present.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | Stripe.Subscription })
    .subscription;
  if (legacy) return typeof legacy === "string" ? legacy : legacy.id;
  const nested = invoice.parent?.subscription_details?.subscription;
  if (!nested) return null;
  return typeof nested === "string" ? nested : nested.id;
}

function findUserIdForSubscription(
  db: ReturnType<typeof getDb>,
  subscription: Stripe.Subscription
): string {
  let userId = String(subscription.metadata?.user_id ?? "");
  if (!userId) {
    const custId = customerId(subscription.customer);
    if (custId) {
      const found = db
        .prepare("SELECT id FROM users WHERE stripe_customer_id = ?")
        .get(custId) as { id: string } | undefined;
      userId = found?.id ?? "";
    }
  }
  return userId;
}

function findUserIdByCustomer(db: ReturnType<typeof getDb>, custId: string | null): string {
  if (!custId) return "";
  const found = db.prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(custId) as
    | { id: string }
    | undefined;
  return found?.id ?? "";
}

/**
 * Mapping order per docs/STRIPE.md: metadata.user_id -> (rarely-expanded)
 * subscription metadata.user_id -> customer -> stripe_customer_id ->
 * subscription id -> subscriptions.provider_subscription_id.
 */
function resolveUserIdForInvoice(db: ReturnType<typeof getDb>, invoice: Stripe.Invoice): string {
  let userId = String(invoice.metadata?.user_id ?? "");
  if (!userId) {
    const nestedSub = invoice.parent?.subscription_details?.subscription;
    if (nestedSub && typeof nestedSub !== "string") {
      userId = String(nestedSub.metadata?.user_id ?? "");
    }
  }
  if (!userId) {
    userId = findUserIdByCustomer(db, customerId(invoice.customer));
  }
  if (!userId) {
    const subId = invoiceSubscriptionId(invoice);
    if (subId) {
      const found = db
        .prepare(
          "SELECT user_id FROM subscriptions WHERE provider_subscription_id = ? OR stripe_subscription_id = ?"
        )
        .get(subId, subId) as { user_id: string } | undefined;
      userId = found?.user_id ?? "";
    }
  }
  return userId;
}

/**
 * `invoice.payments` (the new Invoice Payments list) is only populated when
 * explicitly expanded — almost never true for a webhook payload — so this
 * is a defensive bonus, not the primary payment-linkage mechanism. See
 * docs/STRIPE.md: the reliable path is the charge.succeeded /
 * payment_intent.succeeded events enriching the row afterwards.
 */
function extractInvoicePaymentIds(invoice: Stripe.Invoice): {
  paymentIntentId: string | null;
  chargeId: string | null;
} {
  const payment = invoice.payments?.data?.[0]?.payment;
  if (!payment) return { paymentIntentId: null, chargeId: null };
  const pi = payment.payment_intent;
  const charge = payment.charge;
  return {
    paymentIntentId: pi ? (typeof pi === "string" ? pi : pi.id) : null,
    chargeId: charge ? (typeof charge === "string" ? charge : charge.id) : null,
  };
}

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    const secret = envRequired("STRIPE_WEBHOOK_SECRET");
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (e) {
    if (e instanceof ServerConfigError) {
      console.error(e.message);
      return jsonError("server_not_configured", 503);
    }
    return jsonError("invalid_signature", 400);
  }

  const db = getDb();
  const now = () => new Date().toISOString();
  const environment = event.livemode ? "live" : "test";

  const process = db.transaction(() => {
    const seen = db.prepare("SELECT 1 FROM webhook_events WHERE event_id = ?").get(event.id);
    if (seen) return { duplicate: true };

    const type = event.type;

    if (type === "checkout.session.completed") {
      const object = event.data.object as Stripe.Checkout.Session;
      if (object.metadata?.kind === "contribution") {
        settleContributionFromSession(object, event.id);
      } else {
        const userId = String(object.client_reference_id ?? object.metadata?.user_id ?? "");
        if (userId) {
          const custId = customerId(object.customer);
          if (custId) {
            db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(custId, userId);
          }
          if (object.subscription) {
            // Seed a minimal row so Pro can appear right away; the
            // customer.subscription.* event that follows is the real
            // authority on status/period end/plan and overwrites this.
            const status = object.payment_status === "paid" ? "active" : "inactive";
            db.prepare(
              `INSERT OR IGNORE INTO subscriptions
                 (user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at,
                  source, provider_customer_id, provider_subscription_id, plan, auto_renew)
               VALUES (?, ?, ?, NULL, ?, ?, 'STRIPE', ?, ?, 'UNKNOWN', 1)`
            ).run(
              userId,
              String(object.subscription),
              status,
              event.created,
              now(),
              custId,
              String(object.subscription)
            );
          }
        }
      }
    } else if (type === "checkout.session.async_payment_succeeded") {
      settleContributionFromSession(event.data.object as Stripe.Checkout.Session, event.id);
    } else if (type === "checkout.session.async_payment_failed") {
      const meta = contributionSessionMetadata(event.data.object as Stripe.Checkout.Session);
      if (meta) markContributionFailed({ id: meta.contributionId, stripeEventId: event.id });
    } else if (type === "checkout.session.expired") {
      const meta = contributionSessionMetadata(event.data.object as Stripe.Checkout.Session);
      if (meta) markContributionExpired({ id: meta.contributionId, stripeEventId: event.id });
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const object = event.data.object as Stripe.Subscription;
      const userId = findUserIdForSubscription(db, object);
      if (userId) {
        const item = object.items.data[0];
        const productId = item
          ? typeof item.price.product === "string"
            ? item.price.product
            : item.price.product.id
          : null;
        upsertStripeSubscription({
          userId,
          subscriptionId: object.id,
          customerId: customerId(object.customer),
          status: type === "customer.subscription.deleted" ? "canceled" : object.status,
          currentPeriodEnd: resolveCurrentPeriodEnd(object),
          productId,
          priceId: item?.price.id ?? null,
          plan: planFromInterval(item?.price.recurring?.interval),
          autoRenew: !object.cancel_at_period_end,
          startedAt: toIso(object.start_date),
          canceledAt: toIso(object.canceled_at),
          trialEndsAt: toIso(object.trial_end),
          environment,
          eventCreated: event.created,
          eventId: event.id,
        });
      }
    } else if (
      type === "invoice.created" ||
      type === "invoice.finalized" ||
      type === "invoice.paid" ||
      type === "invoice.payment_failed" ||
      type === "invoice.voided"
    ) {
      const object = event.data.object as Stripe.Invoice;
      const userId = resolveUserIdForInvoice(db, object);
      const subId = invoiceSubscriptionId(object);
      if (userId && object.id) {
        const { paymentIntentId, chargeId } = extractInvoicePaymentIds(object);
        upsertInvoiceRecord({
          userId,
          invoiceId: object.id,
          invoiceNumber: object.number,
          status: object.status ?? "draft",
          amountDue: object.amount_due,
          amountPaid: object.amount_paid,
          currency: object.currency,
          hostedInvoiceUrl: object.hosted_invoice_url ?? null,
          invoicePdfUrl: object.invoice_pdf ?? null,
          billingReason: object.billing_reason,
          periodStart: object.period_start ?? null,
          periodEnd: object.period_end ?? null,
          createdAt: object.created,
          subscriptionId: subId,
          paymentIntentId,
          chargeId,
        });
      }

      // Status stays authoritatively driven by customer.subscription.* —
      // these two events only cover a fast defensive transition to/from
      // past_due so a failed renewal doesn't leave Pro active indefinitely
      // if the subscription.updated event is delayed.
      if (subId && (type === "invoice.paid" || type === "invoice.payment_failed")) {
        if (type === "invoice.payment_failed") {
          db.prepare(
            `UPDATE subscriptions SET status = 'past_due', updated_at = ?, last_provider_event_id = ?
             WHERE (provider_subscription_id = ? OR stripe_subscription_id = ?)
               AND status NOT IN ('canceled', 'refunded')`
          ).run(now(), event.id, subId, subId);
        } else {
          db.prepare(
            `UPDATE subscriptions SET status = 'active', updated_at = ?, last_provider_event_id = ?
             WHERE (provider_subscription_id = ? OR stripe_subscription_id = ?) AND status = 'past_due'`
          ).run(now(), event.id, subId, subId);
        }
      }
    } else if (type === "charge.succeeded") {
      // A contribution charge already known by payment_intent (i.e. its
      // checkout.session.completed already landed) is skipped here — it
      // must never be misattached to an unrelated subscription invoice
      // row that's still waiting on payment linkage. If this event races
      // ahead of checkout.session.completed, the charge is briefly
      // unlinked from either — cosmetic only (see docs/CONTRIBUTIONS.md),
      // never affects amounts, Pro status, or contribution PAID status.
      const object = event.data.object as Stripe.Charge;
      const chargePi = object.payment_intent;
      const chargePiId = chargePi ? (typeof chargePi === "string" ? chargePi : chargePi.id) : null;
      const isKnownContribution = chargePiId ? !!getContributionByPaymentIntentId(chargePiId) : false;
      const userId = isKnownContribution ? "" : findUserIdByCustomer(db, customerId(object.customer));
      if (userId) {
        attachPaymentToInvoice(userId, "provider_payment_id", object.id);
        if (chargePiId) {
          attachPaymentToInvoice(userId, "provider_payment_intent_id", chargePiId);
        }
      }
    } else if (
      type === "payment_intent.succeeded" ||
      type === "payment_intent.payment_failed"
    ) {
      // PaymentIntents created via our contribution Checkout Sessions carry
      // metadata.kind (set through payment_intent_data.metadata) — skip
      // invoice-linkage entirely for those, same reasoning as charge.succeeded above.
      const object = event.data.object as Stripe.PaymentIntent;
      if (object.metadata?.kind !== "contribution") {
        const userId = findUserIdByCustomer(db, customerId(object.customer));
        if (userId) {
          attachPaymentToInvoice(userId, "provider_payment_intent_id", object.id);
        }
      }
    } else if (type === "charge.refunded") {
      const object = event.data.object as Stripe.Charge;
      const refundPi = object.payment_intent;
      const refundPiId = refundPi ? (typeof refundPi === "string" ? refundPi : refundPi.id) : null;
      const contribution = refundPiId ? getContributionByPaymentIntentId(refundPiId) : null;

      if (contribution) {
        if (contribution.status === "PAID") {
          applyRefund({ id: contribution.id, refundedAmountCents: object.amount_refunded, stripeEventId: event.id });
        }
      } else if (object.refunded) {
        // Only a full refund revokes Pro; a partial refund (e.g. a
        // goodwill credit) leaves the subscription status untouched.
        // Correlated by customer rather than invoice: this account only
        // ever creates subscription-mode Checkout charges (contributions
        // are excluded above), so every remaining charge against a
        // customer with a subscription row is that subscription's.
        const custId = customerId(object.customer);
        if (custId) {
          db.prepare(
            `UPDATE subscriptions SET status = 'refunded', updated_at = ?, last_provider_event_id = ?
             WHERE provider_customer_id = ? AND status NOT IN ('canceled', 'refunded')`
          ).run(now(), event.id, custId);
          const userId = findUserIdByCustomer(db, custId);
          if (userId) markMostRecentInvoiceRefunded(userId);
        }
      }
    }

    db.prepare(
      "INSERT INTO webhook_events (event_id, event_type, received_at) VALUES (?, ?, ?)"
    ).run(event.id, event.type, now());

    return { duplicate: false };
  });

  try {
    const result = process();
    return json({ ok: true, ...(result.duplicate ? { duplicate: true } : {}) });
  } catch (e) {
    console.error("Webhook processing error:", e);
    return jsonError("webhook_processing_failed", 500);
  }
}
