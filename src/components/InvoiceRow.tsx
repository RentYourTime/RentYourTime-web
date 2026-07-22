"use client";

import type { SerializedBillingRecord } from "@/lib/billing";
import { CopyButton } from "./CopyButton";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  paid: "Paid",
  uncollectible: "Uncollectible",
  void: "Void",
  refunded: "Refunded",
};

function formatAmount(cents: number, currency: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function InvoiceRow({ invoice }: { invoice: SerializedBillingRecord }) {
  const amount = invoice.amount_paid || invoice.amount_due;
  const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status;

  return (
    <li className="flex flex-col gap-3 border-b border-white/[0.06] py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-white">
          <span>{formatDate(invoice.created_at)}</span>
          <span className="text-white/30">·</span>
          <span>{formatAmount(amount, invoice.currency)}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              invoice.status === "paid"
                ? "bg-signal/[0.12] text-signal"
                : invoice.status === "refunded"
                  ? "bg-[#3a1414] text-[#ff8a84]"
                  : "bg-white/[0.06] text-white/50"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/40">
          {invoice.invoice_number && <span>Invoice {invoice.invoice_number}</span>}
          {invoice.invoice_id && (
            <span className="flex items-center gap-1">
              <code className="truncate">{invoice.invoice_id}</code>
              <CopyButton value={invoice.invoice_id} label="Copy" />
            </span>
          )}
          {invoice.payment_intent_id && (
            <span className="flex items-center gap-1">
              Payment Intent <code className="truncate">{invoice.payment_intent_id}</code>
              <CopyButton value={invoice.payment_intent_id} label="Copy" />
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {invoice.hosted_invoice_url && (
          <a
            href={invoice.hosted_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/5"
          >
            View invoice
          </a>
        )}
        {invoice.invoice_pdf_url && (
          <a
            href={invoice.invoice_pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/5"
          >
            Download PDF
          </a>
        )}
      </div>
    </li>
  );
}
