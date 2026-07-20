import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { json, jsonError } from "@/lib/auth";
import { envRequired, getStripe, ServerConfigError } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const process = db.transaction(() => {
    const seen = db.prepare("SELECT 1 FROM webhook_events WHERE event_id = ?").get(event.id);
    if (seen) return { duplicate: true };

    const type = event.type;

    if (type === "checkout.session.completed") {
      const object = event.data.object as Stripe.Checkout.Session;
      const userId = String(object.client_reference_id ?? object.metadata?.user_id ?? "");
      if (userId) {
        if (object.customer) {
          db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(
            String(object.customer),
            userId
          );
        }
        if (object.subscription) {
          const status = object.payment_status === "paid" ? "active" : "pending";
          db.prepare(
            `INSERT OR IGNORE INTO subscriptions
               (user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at)
             VALUES (?, ?, ?, NULL, ?, ?)`
          ).run(userId, String(object.subscription), status, event.created, now());
        }
      }
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const object = event.data.object as Stripe.Subscription;
      let userId = String(object.metadata?.user_id ?? "");
      if (!userId && object.customer) {
        const found = db
          .prepare("SELECT id FROM users WHERE stripe_customer_id = ?")
          .get(String(object.customer)) as { id: string } | undefined;
        userId = found?.id ?? "";
      }
      if (userId) {
        const status = type === "customer.subscription.deleted" ? "canceled" : object.status;
        const periodEnd =
          (object as unknown as { current_period_end?: number }).current_period_end ?? null;
        db.prepare(
          `INSERT INTO subscriptions
             (user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             stripe_subscription_id = excluded.stripe_subscription_id,
             status = excluded.status,
             current_period_end = excluded.current_period_end,
             last_event_created = excluded.last_event_created,
             updated_at = excluded.updated_at
           WHERE excluded.last_event_created >= subscriptions.last_event_created`
        ).run(userId, object.id, status, periodEnd, event.created, now());
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
