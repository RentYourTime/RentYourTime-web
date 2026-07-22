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
    } else if (type === "invoice.paid" || type === "invoice.payment_failed") {
      // Status stays authoritatively driven by customer.subscription.* —
      // these two events only cover a fast defensive transition to/from
      // past_due so a failed renewal doesn't leave Pro active indefinitely
      // if the subscription.updated event is delayed.
      const object = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(object);
      if (subId) {
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
    } else if (type === "charge.refunded") {
      // Only a full refund revokes Pro; a partial refund (e.g. a
      // goodwill credit) leaves the subscription status untouched.
      // Correlated by customer rather than invoice: this account only
      // ever creates subscription-mode Checkout charges, so every charge
      // against a customer with a subscription row is that subscription's.
      const object = event.data.object as Stripe.Charge;
      if (object.refunded) {
        const custId = customerId(object.customer);
        if (custId) {
          db.prepare(
            `UPDATE subscriptions SET status = 'refunded', updated_at = ?, last_provider_event_id = ?
             WHERE provider_customer_id = ? AND status NOT IN ('canceled', 'refunded')`
          ).run(now(), event.id, custId);
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
