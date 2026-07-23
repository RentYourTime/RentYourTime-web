import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { getDb } from "./db";

/**
 * "Support the project" — voluntary, one-time Stripe payments based on a
 * percentage of virtual accrued rent. See docs/CONTRIBUTIONS.md. Entirely
 * separate from `subscriptions`/`billing_records`: nothing in this file
 * ever calls into subscription/entitlement code, and a contribution can
 * never grant Pro.
 */

export const ALLOWED_PERCENTAGES = [5, 10, 25, 50, 75, 100] as const;
export type AllowedPercentage = (typeof ALLOWED_PERCENTAGES)[number];

export function isAllowedPercentage(value: unknown): value is AllowedPercentage {
  return typeof value === "number" && (ALLOWED_PERCENTAGES as readonly number[]).includes(value);
}

/** amountCents = round(accruedRentCents * percentage / 100) — server-computed, never accepted from the client. */
export function computeAmountCents(accruedRentCents: number, percentage: AllowedPercentage): number {
  return Math.round((accruedRentCents * percentage) / 100);
}

/**
 * Stripe's documented per-currency minimum charge amount, in the currency's
 * smallest unit. Only `usd` is exercised by this product today (see
 * `src/lib/accruedRent.ts`) — verify against
 * https://stripe.com/docs/currencies#minimum-and-maximum-charge-amounts
 * before relying on any other entry here.
 */
const MINIMUM_CHARGE_CENTS: Record<string, number> = {
  usd: 50,
  eur: 50,
  gbp: 30,
};
const DEFAULT_MINIMUM_CHARGE_CENTS = 50;

export function minimumChargeCents(currency: string): number {
  return MINIMUM_CHARGE_CENTS[currency.toLowerCase()] ?? DEFAULT_MINIMUM_CHARGE_CENTS;
}

export type ContributionStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

export interface ContributionRow {
  id: string;
  user_id: string;
  percentage: number;
  accrued_rent_cents: number;
  amount_cents: number;
  currency: string;
  status: ContributionStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_event_id: string | null;
  refunded_amount_cents: number | null;
  is_demo_source: number;
  created_at: string;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
}

export interface SerializedContribution {
  id: string;
  percentage: number;
  amountCents: number;
  currency: string;
  status: ContributionStatus;
  createdAt: string;
  paidAt: string | null;
  /** True when the amount was computed from dev-only demo accrued rent, not real synced data — see `src/lib/supportDemo.ts`. Never true in production. */
  isDemo: boolean;
}

export function serializeContribution(row: ContributionRow): SerializedContribution {
  return {
    id: row.id,
    percentage: row.percentage,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    isDemo: !!row.is_demo_source,
  };
}

export interface CreatePendingContributionParams {
  userId: string;
  percentage: AllowedPercentage;
  accruedRentCents: number;
  amountCents: number;
  currency: string;
  isDemo?: boolean;
}

export function createPendingContribution(params: CreatePendingContributionParams): ContributionRow {
  const id = randomBytes(12).toString("hex");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO contributions
         (id, user_id, percentage, accrued_rent_cents, amount_cents, currency, status, is_demo_source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.percentage,
      params.accruedRentCents,
      params.amountCents,
      params.currency,
      params.isDemo ? 1 : 0,
      now
    );
  return getContributionById(id)!;
}

const PENDING_REUSE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Finds a still-fresh PENDING contribution for this user+percentage with an
 * attached Checkout Session, so a retried/double-clicked checkout request
 * can reuse the existing Stripe session instead of creating a second one.
 */
export function findRecentPendingContribution(
  userId: string,
  percentage: AllowedPercentage
): ContributionRow | null {
  const since = new Date(Date.now() - PENDING_REUSE_WINDOW_MS).toISOString();
  const row = getDb()
    .prepare(
      `SELECT * FROM contributions
       WHERE user_id = ? AND percentage = ? AND status = 'PENDING'
         AND stripe_checkout_session_id IS NOT NULL AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId, percentage, since) as ContributionRow | undefined;
  return row ?? null;
}

export function attachCheckoutSession(contributionId: string, checkoutSessionId: string): void {
  getDb()
    .prepare("UPDATE contributions SET stripe_checkout_session_id = ? WHERE id = ?")
    .run(checkoutSessionId, contributionId);
}

export function getContributionById(id: string): ContributionRow | null {
  const row = getDb().prepare("SELECT * FROM contributions WHERE id = ?").get(id) as
    | ContributionRow
    | undefined;
  return row ?? null;
}

export function getContributionByCheckoutSessionId(sessionId: string): ContributionRow | null {
  const row = getDb()
    .prepare("SELECT * FROM contributions WHERE stripe_checkout_session_id = ?")
    .get(sessionId) as ContributionRow | undefined;
  return row ?? null;
}

export function getContributionByPaymentIntentId(paymentIntentId: string): ContributionRow | null {
  const row = getDb()
    .prepare("SELECT * FROM contributions WHERE stripe_payment_intent_id = ?")
    .get(paymentIntentId) as ContributionRow | undefined;
  return row ?? null;
}

export function markContributionPaid(params: {
  id: string;
  paymentIntentId: string | null;
  stripeEventId: string;
}): void {
  getDb()
    .prepare(
      `UPDATE contributions
       SET status = 'PAID', paid_at = ?, stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id), stripe_event_id = ?
       WHERE id = ? AND status = 'PENDING'`
    )
    .run(new Date().toISOString(), params.paymentIntentId, params.stripeEventId, params.id);
}

export function markContributionFailed(params: { id: string; stripeEventId: string }): void {
  getDb()
    .prepare(
      `UPDATE contributions SET status = 'FAILED', failed_at = ?, stripe_event_id = ?
       WHERE id = ? AND status = 'PENDING'`
    )
    .run(new Date().toISOString(), params.stripeEventId, params.id);
}

export function markContributionExpired(params: { id: string; stripeEventId: string }): void {
  getDb()
    .prepare(
      `UPDATE contributions SET status = 'EXPIRED', failed_at = ?, stripe_event_id = ?
       WHERE id = ? AND status = 'PENDING'`
    )
    .run(new Date().toISOString(), params.stripeEventId, params.id);
}

/**
 * `refundedAmountCents >= amount_cents` is a full refund (status →
 * REFUNDED, excluded entirely from `getTotalContributedCentsForUser`);
 * anything less is partial and stays PAID but nets out of the total.
 */
export function applyRefund(params: {
  id: string;
  refundedAmountCents: number;
  stripeEventId: string;
}): void {
  const row = getContributionById(params.id);
  if (!row || row.status !== "PAID") return;
  const now = new Date().toISOString();
  if (params.refundedAmountCents >= row.amount_cents) {
    getDb()
      .prepare(
        `UPDATE contributions
         SET status = 'REFUNDED', refunded_amount_cents = ?, refunded_at = ?, stripe_event_id = ?
         WHERE id = ?`
      )
      .run(params.refundedAmountCents, now, params.stripeEventId, params.id);
  } else {
    getDb()
      .prepare(
        `UPDATE contributions
         SET refunded_amount_cents = ?, refunded_at = ?, stripe_event_id = ?
         WHERE id = ?`
      )
      .run(params.refundedAmountCents, now, params.stripeEventId, params.id);
  }
}

export function listContributionsForUser(userId: string, limit = 50): ContributionRow[] {
  const capped = Math.min(Math.max(Math.floor(limit), 1), 200);
  return getDb()
    .prepare(
      `SELECT * FROM contributions WHERE user_id = ? AND status != 'PENDING'
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, capped) as ContributionRow[];
}

/**
 * Only PAID rows, net of any partial refund — see `applyRefund`. REFUNDED
 * (full) rows are excluded entirely. Includes demo-sourced rows: those are
 * still real Stripe Test Mode charges, just computed from a demo ledger
 * value — see `getDemoTestPaymentsCentsForUser` for that subset alone.
 */
export function getTotalContributedCentsForUser(userId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents - COALESCE(refunded_amount_cents, 0)), 0) AS total
       FROM contributions WHERE user_id = ? AND status = 'PAID'`
    )
    .get(userId) as { total: number };
  return row.total;
}

/**
 * The subset of `getTotalContributedCentsForUser` that came from a demo
 * accrued-rent value (`is_demo_source = 1`) — real money, real Stripe Test
 * Mode charges, just kept as its own figure so the UI never silently mixes
 * it into a total that looks like genuine production contributions. Always
 * 0 in production (no demo-sourced row can ever be created there).
 */
export function getDemoTestPaymentsCentsForUser(userId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents - COALESCE(refunded_amount_cents, 0)), 0) AS total
       FROM contributions WHERE user_id = ? AND status = 'PAID' AND is_demo_source = 1`
    )
    .get(userId) as { total: number };
  return row.total;
}

export interface ContributionSessionMeta {
  contributionId: string;
  userId: string;
}

/** Reads back the `{ kind, contributionId, userId }` metadata set at checkout creation — null for a non-contribution session. */
export function contributionSessionMetadata(
  session: Stripe.Checkout.Session
): ContributionSessionMeta | null {
  if (session.metadata?.kind !== "contribution") return null;
  const contributionId = String(session.metadata?.contributionId ?? "");
  const userId = String(session.metadata?.userId ?? "");
  if (!contributionId || !userId) return null;
  return { contributionId, userId };
}

/**
 * Marks a contribution PAID from a Checkout Session — the single place
 * both the webhook and the session-status poll endpoint settle a
 * contribution from, so the cross-checks below can never diverge between
 * the two call sites. Only acts once `session.payment_status === "paid"`,
 * and cross-checks the session's own user/amount/currency against the
 * PENDING row created at checkout time rather than trusting metadata alone.
 * `sourceEventId` is either a real Stripe event id (webhook) or a
 * synthetic `poll:<sessionId>` marker (status endpoint) — never unique
 * per row, purely for auditing which path settled it.
 */
export function settleContributionFromSession(
  session: Stripe.Checkout.Session,
  sourceEventId: string
): ContributionRow | null {
  const meta = contributionSessionMetadata(session);
  if (!meta || session.payment_status !== "paid") return null;

  const contribution = getContributionById(meta.contributionId);
  if (!contribution) {
    console.error(`[contributions] ${meta.contributionId} not found for session ${session.id}`);
    return null;
  }
  if (contribution.status !== "PENDING") return contribution; // already settled — idempotent

  if (contribution.user_id !== meta.userId) {
    console.error(`[contributions] ${contribution.id}: session user mismatch — refusing to mark paid`);
    return null;
  }
  if (session.amount_total !== contribution.amount_cents) {
    console.error(`[contributions] ${contribution.id}: amount mismatch — refusing to mark paid`);
    return null;
  }
  if ((session.currency ?? "").toLowerCase() !== contribution.currency.toLowerCase()) {
    console.error(`[contributions] ${contribution.id}: currency mismatch — refusing to mark paid`);
    return null;
  }

  const pi = session.payment_intent;
  const paymentIntentId = pi ? (typeof pi === "string" ? pi : pi.id) : null;
  markContributionPaid({ id: contribution.id, paymentIntentId, stripeEventId: sourceEventId });
  return getContributionById(contribution.id);
}
