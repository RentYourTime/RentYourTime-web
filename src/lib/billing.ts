import { randomBytes } from "node:crypto";
import { getDb } from "./db";

/**
 * Billing history (invoices + best-effort payment linkage). One row per
 * Stripe invoice — `invoice.*` webhook events are the reliable source for
 * everything here; `charge.*`/`payment_intent.*` events only enrich an
 * existing row (see docs/STRIPE.md for why: in the pinned Stripe API
 * version, Charge/PaymentIntent objects carry no `invoice` reference).
 */

export type BillingSource = "STRIPE" | "APPLE" | "MANUAL";

export interface BillingRecordRow {
  id: string;
  user_id: string;
  source: BillingSource;
  provider_invoice_id: string | null;
  provider_payment_id: string | null;
  provider_payment_intent_id: string | null;
  provider_subscription_id: string | null;
  invoice_number: string | null;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  receipt_url: string | null;
  billing_reason: string | null;
  period_start: number | null;
  period_end: number | null;
  created_at: number;
  updated_at: string;
}

export interface SerializedBillingRecord {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  payment_id: string | null;
  payment_intent_id: string | null;
  subscription_id: string | null;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  created_at: number;
}

/** Only ever persist HTTPS invoice links — never render/store anything else. */
export function httpsUrlOrNull(url: string | null | undefined): string | null {
  return url && url.startsWith("https://") ? url : null;
}

export function getInvoicesForUser(
  userId: string,
  opts: { limit?: number; offset?: number } = {}
): BillingRecordRow[] {
  const limit = Math.min(Math.max(Math.floor(opts.limit ?? 20), 1), 100);
  const offset = Math.max(Math.floor(opts.offset ?? 0), 0);
  return getDb()
    .prepare(
      `SELECT * FROM billing_records WHERE user_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(userId, limit, offset) as BillingRecordRow[];
}

/** Scoped to `userId` in the query itself — never fetch-then-check-ownership. */
export function getInvoiceForUser(userId: string, localId: string): BillingRecordRow | null {
  const row = getDb()
    .prepare("SELECT * FROM billing_records WHERE id = ? AND user_id = ?")
    .get(localId, userId) as BillingRecordRow | undefined;
  return row ?? null;
}

export function serializeBillingRecord(row: BillingRecordRow): SerializedBillingRecord {
  return {
    id: row.id,
    invoice_id: row.provider_invoice_id,
    invoice_number: row.invoice_number,
    payment_id: row.provider_payment_id,
    payment_intent_id: row.provider_payment_intent_id,
    subscription_id: row.provider_subscription_id,
    status: row.status,
    amount_due: row.amount_due,
    amount_paid: row.amount_paid,
    currency: row.currency,
    hosted_invoice_url: row.hosted_invoice_url,
    invoice_pdf_url: row.invoice_pdf_url,
    created_at: row.created_at,
  };
}

export interface UpsertInvoiceRecordParams {
  userId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  billingReason: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  createdAt: number;
  subscriptionId: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
}

/**
 * Idempotent upsert keyed by `provider_invoice_id` — safe to call from every
 * `invoice.*` event (created/finalized/paid/payment_failed/voided) with the
 * invoice's current full state; the row just converges to whatever Stripe
 * reports most recently. Payment linkage from a `charge.*`/`payment_intent.*`
 * event that arrived earlier is preserved (COALESCE), never clobbered back
 * to null by a later invoice event that doesn't carry it.
 */
export function upsertInvoiceRecord(params: UpsertInvoiceRecordParams): void {
  const now = new Date().toISOString();
  const id = randomBytes(16).toString("hex");
  getDb()
    .prepare(
      `INSERT INTO billing_records (
         id, user_id, source, provider_invoice_id, provider_payment_id, provider_payment_intent_id,
         provider_subscription_id, invoice_number, status, amount_due, amount_paid, currency,
         hosted_invoice_url, invoice_pdf_url, billing_reason, period_start, period_end, created_at, updated_at
       ) VALUES (
         ?, ?, 'STRIPE', ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?
       )
       ON CONFLICT(provider_invoice_id) DO UPDATE SET
         invoice_number = excluded.invoice_number,
         status = excluded.status,
         amount_due = excluded.amount_due,
         amount_paid = excluded.amount_paid,
         currency = excluded.currency,
         hosted_invoice_url = excluded.hosted_invoice_url,
         invoice_pdf_url = excluded.invoice_pdf_url,
         billing_reason = excluded.billing_reason,
         period_start = excluded.period_start,
         period_end = excluded.period_end,
         provider_subscription_id = excluded.provider_subscription_id,
         provider_payment_id = COALESCE(billing_records.provider_payment_id, excluded.provider_payment_id),
         provider_payment_intent_id = COALESCE(billing_records.provider_payment_intent_id, excluded.provider_payment_intent_id),
         updated_at = excluded.updated_at`
    )
    .run(
      id,
      params.userId,
      params.invoiceId,
      params.chargeId,
      params.paymentIntentId,
      params.subscriptionId,
      params.invoiceNumber,
      params.status,
      params.amountDue,
      params.amountPaid,
      params.currency,
      httpsUrlOrNull(params.hostedInvoiceUrl),
      httpsUrlOrNull(params.invoicePdfUrl),
      params.billingReason,
      params.periodStart,
      params.periodEnd,
      params.createdAt,
      now
    );
}

/**
 * Best-effort enrichment from a `charge.succeeded`/`payment_intent.succeeded`
 * event: attaches the id to the user's most recent row that doesn't have one
 * yet. A no-op if no such row exists (e.g. the invoice event hasn't landed
 * yet) — a later invoice event will still carry the full, correct state.
 */
export function attachPaymentToInvoice(
  userId: string,
  field: "provider_payment_id" | "provider_payment_intent_id",
  value: string
): void {
  getDb()
    .prepare(
      `UPDATE billing_records SET ${field} = ?, updated_at = ?
       WHERE id = (
         SELECT id FROM billing_records
         WHERE user_id = ? AND ${field} IS NULL
         ORDER BY created_at DESC LIMIT 1
       )`
    )
    .run(value, new Date().toISOString(), userId);
}

/** From `charge.refunded` (full refund only) — marks the most recent non-refunded row for this user. */
export function markMostRecentInvoiceRefunded(userId: string): void {
  getDb()
    .prepare(
      `UPDATE billing_records SET status = 'refunded', updated_at = ?
       WHERE id = (
         SELECT id FROM billing_records
         WHERE user_id = ? AND status != 'refunded'
         ORDER BY created_at DESC LIMIT 1
       )`
    )
    .run(new Date().toISOString(), userId);
}

/** Used when refreshing expired/missing invoice links on demand from the Stripe API. */
export function updateInvoiceUrls(
  localId: string,
  hostedInvoiceUrl: string | null,
  invoicePdfUrl: string | null
): void {
  getDb()
    .prepare(
      `UPDATE billing_records SET
         hosted_invoice_url = COALESCE(?, hosted_invoice_url),
         invoice_pdf_url = COALESCE(?, invoice_pdf_url),
         updated_at = ?
       WHERE id = ?`
    )
    .run(httpsUrlOrNull(hostedInvoiceUrl), httpsUrlOrNull(invoicePdfUrl), new Date().toISOString(), localId);
}
