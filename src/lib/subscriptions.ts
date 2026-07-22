import { getDb } from "./db";

/**
 * Single source of truth for subscription/Pro entitlement state. Every
 * consumer (API routes, webhooks, future Apple sync) reads and writes
 * subscriptions through this module instead of touching the table directly.
 */

export type SubscriptionSource = "STRIPE" | "APPLE" | "MANUAL" | "NONE";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "refunded"
  | "inactive";

export type SubscriptionPlan = "MONTHLY" | "YEARLY" | "UNKNOWN";

export interface SubscriptionRow {
  user_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: number | null;
  last_event_created: number;
  updated_at: string;
  source: SubscriptionSource;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  product_id: string | null;
  price_id: string | null;
  plan: SubscriptionPlan;
  started_at: string | null;
  canceled_at: string | null;
  trial_ends_at: string | null;
  auto_renew: number;
  original_transaction_id: string | null;
  environment: string | null;
  last_provider_event_id: string | null;
}

export interface SerializedSubscription {
  is_pro: boolean;
  source: SubscriptionSource;
  status: SubscriptionStatus | string;
  plan: SubscriptionPlan;
  product_id: string | null;
  price_id: string | null;
  current_period_end: number | null;
  auto_renew: boolean;
}

const PRO_STATUSES = new Set(["active", "trialing"]);

/** Raw subscription row for a user, or null if none exists yet. */
export function getSubscriptionForUser(userId: string): SubscriptionRow | null {
  const row = getDb()
    .prepare("SELECT * FROM subscriptions WHERE user_id = ?")
    .get(userId) as SubscriptionRow | undefined;
  return row ?? null;
}

/** The user's subscription row, but only when it currently grants Pro. */
export function getActiveSubscriptionForUser(userId: string): SubscriptionRow | null {
  const sub = getSubscriptionForUser(userId);
  return sub && subscriptionGrantsPro(sub) ? sub : null;
}

/**
 * Whether a subscription row currently grants Pro access.
 * - Only `active` or `trialing` status grants Pro.
 * - `current_period_end` (when present) must be in the future.
 * - canceled/expired/refunded/inactive never grant Pro, even before the
 *   stored period end, since those statuses mean the provider has already
 *   told us access should stop.
 */
export function subscriptionGrantsPro(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false;
  if (!PRO_STATUSES.has(sub.status)) return false;
  const end = sub.current_period_end ?? 0;
  return end === 0 || end > Math.floor(Date.now() / 1000);
}

export function resolveSubscriptionSource(
  sub: SubscriptionRow | null | undefined
): SubscriptionSource {
  return sub?.source ?? "NONE";
}

/** Public JSON shape shared by GET /api/me and GET /api/subscriptions/status. */
export function serializeSubscription(
  sub: SubscriptionRow | null | undefined
): SerializedSubscription {
  if (!sub) {
    return {
      is_pro: false,
      source: "NONE",
      status: "inactive",
      plan: "UNKNOWN",
      product_id: null,
      price_id: null,
      current_period_end: null,
      auto_renew: false,
    };
  }
  return {
    is_pro: subscriptionGrantsPro(sub),
    source: resolveSubscriptionSource(sub),
    status: sub.status,
    plan: sub.plan ?? "UNKNOWN",
    product_id: sub.product_id ?? null,
    price_id: sub.price_id ?? null,
    current_period_end: sub.current_period_end ?? null,
    auto_renew: !!sub.auto_renew,
  };
}

export interface UpsertStripeSubscriptionParams {
  userId: string;
  subscriptionId: string;
  customerId: string | null;
  status: string;
  currentPeriodEnd: number | null;
  productId: string | null;
  priceId: string | null;
  plan: SubscriptionPlan;
  autoRenew: boolean;
  startedAt: string | null;
  canceledAt: string | null;
  trialEndsAt: string | null;
  environment: string | null;
  eventCreated: number;
  eventId: string;
}

/**
 * Idempotent upsert for a Stripe-sourced subscription row. Guards against
 * out-of-order webhook delivery the same way the original inline webhook
 * logic did: an incoming event older than what's stored is a no-op.
 */
export function upsertStripeSubscription(params: UpsertStripeSubscriptionParams): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO subscriptions (
         user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at,
         source, provider_customer_id, provider_subscription_id, product_id, price_id, plan,
         started_at, canceled_at, trial_ends_at, auto_renew, environment, last_provider_event_id
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         'STRIPE', ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(user_id) DO UPDATE SET
         stripe_subscription_id = excluded.stripe_subscription_id,
         status = excluded.status,
         current_period_end = excluded.current_period_end,
         last_event_created = excluded.last_event_created,
         updated_at = excluded.updated_at,
         source = 'STRIPE',
         provider_customer_id = excluded.provider_customer_id,
         provider_subscription_id = excluded.provider_subscription_id,
         product_id = excluded.product_id,
         price_id = excluded.price_id,
         plan = excluded.plan,
         started_at = excluded.started_at,
         canceled_at = excluded.canceled_at,
         trial_ends_at = excluded.trial_ends_at,
         auto_renew = excluded.auto_renew,
         environment = excluded.environment,
         last_provider_event_id = excluded.last_provider_event_id
       WHERE excluded.last_event_created >= subscriptions.last_event_created`
    )
    .run(
      params.userId,
      params.subscriptionId,
      params.status,
      params.currentPeriodEnd,
      params.eventCreated,
      now,
      params.customerId,
      params.subscriptionId,
      params.productId,
      params.priceId,
      params.plan,
      params.startedAt,
      params.canceledAt,
      params.trialEndsAt,
      params.autoRenew ? 1 : 0,
      params.environment,
      params.eventId
    );
}

export interface UpsertAppleSubscriptionParams {
  userId: string;
  originalTransactionId: string;
  status: string;
  currentPeriodEnd: number | null;
  productId: string | null;
  plan: SubscriptionPlan;
  autoRenew: boolean;
  startedAt: string | null;
  canceledAt: string | null;
  trialEndsAt: string | null;
  environment: string | null;
  eventId: string | null;
}

/**
 * Idempotent upsert for an Apple-sourced subscription row. Not yet called
 * from any route — it becomes reachable once verifyAndDecodeTransaction()
 * in apple-subscriptions.ts performs real JWS verification.
 */
export function upsertAppleSubscription(params: UpsertAppleSubscriptionParams): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO subscriptions (
         user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at,
         source, provider_subscription_id, product_id, plan, original_transaction_id,
         started_at, canceled_at, trial_ends_at, auto_renew, environment, last_provider_event_id
       ) VALUES (
         ?, NULL, ?, ?, 0, ?,
         'APPLE', ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(user_id) DO UPDATE SET
         status = excluded.status,
         current_period_end = excluded.current_period_end,
         updated_at = excluded.updated_at,
         source = 'APPLE',
         provider_subscription_id = excluded.provider_subscription_id,
         product_id = excluded.product_id,
         plan = excluded.plan,
         original_transaction_id = excluded.original_transaction_id,
         started_at = excluded.started_at,
         canceled_at = excluded.canceled_at,
         trial_ends_at = excluded.trial_ends_at,
         auto_renew = excluded.auto_renew,
         environment = excluded.environment,
         last_provider_event_id = excluded.last_provider_event_id`
    )
    .run(
      params.userId,
      params.status,
      params.currentPeriodEnd,
      now,
      params.originalTransactionId,
      params.productId,
      params.plan,
      params.originalTransactionId,
      params.startedAt,
      params.canceledAt,
      params.trialEndsAt,
      params.autoRenew ? 1 : 0,
      params.environment,
      params.eventId
    );
}
