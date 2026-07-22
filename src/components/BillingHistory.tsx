"use client";

import type { SerializedBillingRecord } from "@/lib/billing";
import { InvoiceRow } from "./InvoiceRow";

export type InvoicesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; invoices: SerializedBillingRecord[] };

function BillingSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

export function BillingHistory({
  state,
  onRefresh,
  refreshing,
}: {
  state: InvoicesState;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section
      aria-labelledby="billing-history-heading"
      className="rounded-[28px] border border-white/[0.08] bg-card p-6 sm:p-8"
    >
      <div className="flex items-center justify-between">
        <h2
          id="billing-history-heading"
          className="text-xs font-bold tracking-[0.1em] text-signal"
        >
          BILLING HISTORY
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh billing data"
          className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/5 focus:outline-none focus-visible:shadow-[0_0_0_1px_var(--signal)] disabled:cursor-wait disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh billing data"}
        </button>
      </div>

      <div className="mt-4">
        {state.status === "loading" && <BillingSkeleton />}

        {state.status === "error" && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 py-6 text-[13px] text-white/50"
          >
            <span>{state.message}</span>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        )}

        {state.status === "ready" && state.invoices.length === 0 && (
          <p className="py-6 text-[13px] text-white/40">No invoices yet.</p>
        )}

        {state.status === "ready" && state.invoices.length > 0 && (
          <ul>
            {state.invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
