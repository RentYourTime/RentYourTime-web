"use client";

import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export interface SubscriptionData {
  is_pro: boolean;
  source: "STRIPE" | "APPLE" | "MANUAL" | "NONE";
  status: string;
  plan: "MONTHLY" | "YEARLY" | "UNKNOWN";
  subscription_id: string | null;
  product_id: string | null;
  price_id: string | null;
  started_at: string | null;
  current_period_end: number | null;
  auto_renew: boolean;
  environment: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  STRIPE: "Stripe",
  APPLE: "App Store",
  MANUAL: "Manual",
  NONE: "—",
};

const PLAN_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
  UNKNOWN: "—",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Expired",
  refunded: "Refunded",
  inactive: "Inactive",
};

function formatDate(value: string | number): string {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2.5 last:border-0">
      <span className="text-white/40">{label}</span>
      <span className="text-right text-white">{children}</span>
    </div>
  );
}

export function SubscriptionCard({
  subscription,
  plan,
  onPlanChange,
  onCheckout,
  onManageSubscription,
  busy,
}: {
  subscription: SubscriptionData;
  plan: "monthly" | "yearly";
  onPlanChange: (plan: "monthly" | "yearly") => void;
  onCheckout: () => void;
  onManageSubscription: () => void;
  busy: boolean;
}) {
  const isPastDue = subscription.status === "past_due";
  const isCanceling = subscription.is_pro && !subscription.auto_renew;

  return (
    <section
      aria-labelledby="subscription-heading"
      className="rounded-[28px] border border-white/[0.08] bg-card p-6 sm:p-8"
    >
      <div className="flex items-center justify-between">
        <h2 id="subscription-heading" className="text-xs font-bold tracking-[0.1em] text-signal">
          SUBSCRIPTION
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
            subscription.is_pro ? "bg-signal/[0.12] text-signal" : "bg-white/[0.06] text-white/50"
          }`}
        >
          {subscription.is_pro ? "Pro" : "Free"}
        </span>
      </div>

      {isPastDue && (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-[#3a2410] px-4 py-3 text-[13px] text-[#ffb86b]"
        >
          Your last payment failed. Update your payment method to keep Pro active.
        </p>
      )}
      {isCanceling && (
        <p className="mt-4 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13px] text-white/60">
          Your subscription ends{" "}
          {subscription.current_period_end
            ? `on ${formatDate(subscription.current_period_end)}`
            : "at the current period end"}{" "}
          and won&apos;t renew.
        </p>
      )}

      <div className="mt-4 flex flex-col text-[14px]">
        <Row label="Source">{SOURCE_LABELS[subscription.source] ?? subscription.source}</Row>
        <Row label="Plan">{PLAN_LABELS[subscription.plan] ?? subscription.plan}</Row>
        <Row label="Status">{STATUS_LABELS[subscription.status] ?? subscription.status}</Row>
        <Row label="Subscription ID">
          {subscription.subscription_id ? (
            <span className="flex items-center gap-2">
              <code className="truncate text-white/70">{subscription.subscription_id}</code>
              <CopyButton value={subscription.subscription_id} label="Copy" />
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Product ID">
          <code className="text-white/70">{subscription.product_id ?? "—"}</code>
        </Row>
        <Row label="Price ID">
          <code className="text-white/70">{subscription.price_id ?? "—"}</code>
        </Row>
        <Row label="Started">
          {subscription.started_at ? formatDate(subscription.started_at) : "—"}
        </Row>
        <Row label="Current period ends">
          {subscription.current_period_end ? formatDate(subscription.current_period_end) : "—"}
        </Row>
        <Row label="Auto-renew">
          {subscription.is_pro ? (subscription.auto_renew ? "On" : "Off") : "—"}
        </Row>
        <Row label="Environment">{subscription.environment ?? "—"}</Row>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!subscription.is_pro && (
          <>
            <div
              role="group"
              aria-label="Billing period"
              className="flex items-center gap-1 rounded-[22px] bg-[#0b0b0b] p-1"
            >
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPlanChange(p)}
                  aria-pressed={plan === p}
                  className={`h-9 rounded-[18px] px-4 text-[13px] font-semibold ${
                    plan === p ? "bg-white/10 text-white" : "bg-transparent text-white/50"
                  }`}
                >
                  {p === "monthly" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onCheckout}
              disabled={busy}
              className="h-11 rounded-full border-0 bg-signal px-5 text-[13px] font-bold text-sig-ink disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Upgrade to Pro"}
            </button>
          </>
        )}
        {subscription.source === "STRIPE" && (
          <button
            type="button"
            onClick={onManageSubscription}
            disabled={busy}
            className="h-11 rounded-full border border-white/10 bg-transparent px-5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/5 focus:outline-none focus-visible:shadow-[0_0_0_1px_var(--signal)] disabled:cursor-wait disabled:opacity-60"
          >
            Manage subscription
          </button>
        )}
        {subscription.source === "APPLE" && (
          <p className="text-[13px] text-white/50">
            Manage this subscription in your Apple ID subscription settings.
          </p>
        )}
      </div>
    </section>
  );
}
