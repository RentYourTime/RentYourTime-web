"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FOUNDER_TIER_CONTENT, type FounderTierSlug } from "@/lib/founderContent";

const TOKEN_KEY = "ryt-auth-token";

// Mirrors `SerializedFounderTier` from src/lib/founders.ts — redefined
// locally (not imported) so this client component never pulls in that
// server-only, better-sqlite3-backed module, matching the same pattern
// PanelClient.tsx already uses for its own local `Contribution` type.
interface FounderTier {
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  isSoldOut: boolean;
  isAlmostGone: boolean;
  isActive: boolean;
  numberPadding: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_tier: "That tier isn't available.",
  tier_inactive: "This tier isn't on sale right now.",
  sold_out: "This tier just sold out.",
  already_owned: "You already hold this Founder tier.",
  server_not_configured: "Founder checkout isn't configured yet. Please try again later.",
  payment_provider_error: "Couldn't reach Stripe. Please try again in a moment.",
};

function formatPrice(cents: number, currency: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    });
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

function TierCard({
  tier,
  busy,
  error,
  loggedIn,
  onBecomeFounder,
}: {
  tier: FounderTier;
  busy: boolean;
  error: string | null;
  loggedIn: boolean;
  onBecomeFounder: (slug: string) => void;
}) {
  const content = FOUNDER_TIER_CONTENT[tier.slug as FounderTierSlug];
  if (!content) return null;
  const isBlack = tier.slug === "founder-black";
  const percentSold = tier.totalQuantity > 0 ? Math.min(100, (tier.soldQuantity / tier.totalQuantity) * 100) : 0;

  return (
    <article
      className={`relative flex flex-col rounded-[28px] p-8 transition-transform duration-300 ease-spring hover:-translate-y-1 ${
        isBlack ? "bg-[#0a0a0a]" : "bg-card"
      }`}
      style={{ border: `1px solid ${content.accent}55`, boxShadow: isBlack ? "0 30px 80px rgba(0,0,0,0.5)" : undefined }}
    >
      {content.badge && !tier.isSoldOut && (
        <div
          className="absolute right-6 top-6 rounded-full px-3 py-1.5 text-[11px] font-bold tracking-[0.06em]"
          style={{ background: content.accentSoft, color: content.accent }}
        >
          {content.badge.toUpperCase()}
        </div>
      )}
      {tier.isSoldOut && (
        <div className="absolute right-6 top-6 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] text-white/60">
          SOLD OUT
        </div>
      )}

      <div className="text-xs font-bold tracking-[0.1em]" style={{ color: content.accent }}>
        {tier.name.toUpperCase()}
      </div>
      <div className="mt-3 text-[42px] font-bold tracking-[-0.03em] text-white">
        {formatPrice(tier.priceCents, tier.currency)}
      </div>
      <div className="mt-1 text-[13px] text-white/45">One-time payment</div>
      <p className="mt-4 min-h-[42px] text-sm leading-[1.55] text-white/55">{content.tagline}</p>

      <div className="mt-5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-white/50">
            Limit {tier.totalQuantity} · Founder #{String(1).padStart(tier.numberPadding, "0")}–#
            {String(tier.totalQuantity).padStart(tier.numberPadding, "0")}
          </span>
          {tier.isAlmostGone && !tier.isSoldOut && (
            <span className="font-semibold text-[#ff8a84]">Almost gone</span>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${percentSold}%`, background: content.accent }}
          />
        </div>
        <div className="mt-1.5 text-[13px] font-semibold text-white/70">
          {tier.isSoldOut ? "Sold out" : `${tier.remainingQuantity} of ${tier.totalQuantity} remaining`}
        </div>
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-[14px] leading-[1.45] text-white/70">
        {content.benefits.map((b) => (
          <li key={b} className="flex gap-2.5">
            <span className="mt-0.5 font-bold" style={{ color: content.accent }}>
              ✓
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 text-[12px] text-white/35">Numbered Founder status — assigned after payment.</div>

      {error && (
        <p className="mt-3 text-[13px] text-[#ff8a84]" role="alert">
          {error}
        </p>
      )}

      {!loggedIn ? (
        <Link
          href="/account"
          className="mt-6 flex h-[52px] items-center justify-center rounded-[26px] text-[15px] font-bold no-underline transition-transform duration-150 ease-spring hover:scale-[1.02]"
          style={{ background: content.accent, color: isBlack ? "#0b0b0b" : "#04140b" }}
        >
          Sign in to become a Founder
        </Link>
      ) : (
        <button
          type="button"
          disabled={tier.isSoldOut || busy || !tier.isActive}
          onClick={() => onBecomeFounder(tier.slug)}
          aria-label={`${content.ctaLabel} — ${tier.name}`}
          className="mt-6 flex h-[52px] items-center justify-center rounded-[26px] text-[15px] font-bold transition-transform duration-150 ease-spring hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          style={{ background: content.accent, color: isBlack ? "#0b0b0b" : "#04140b" }}
        >
          {busy ? "Redirecting to Stripe…" : tier.isSoldOut ? "Sold out" : content.ctaLabel}
        </button>
      )}
    </article>
  );
}

function FounderTierCardsInner({ initialTiers }: { initialTiers: FounderTier[] }) {
  const searchParams = useSearchParams();
  const [tiers, setTiers] = useState(initialTiers);
  const [loggedIn, setLoggedIn] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cancelled = searchParams.get("checkout") === "cancelled";

  useEffect(() => {
    setLoggedIn(!!sessionStorage.getItem(TOKEN_KEY));
    refreshTiers();
    if (cancelled) window.history.replaceState({}, "", "/founders");
    // Refresh availability once on load — never long-cached (docs/FOUNDER_PROGRAM.md).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshTiers() {
    try {
      const res = await fetch("/api/founders/tiers");
      const data = await res.json();
      if (res.ok && data.ok) setTiers(data.tiers);
    } catch {
      /* keep showing the last known tiers */
    }
  }

  async function onBecomeFounder(slug: string) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setBusySlug(slug);
    setErrors((e) => ({ ...e, [slug]: "" }));
    try {
      const res = await fetch("/api/founders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tierSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrors((e) => ({ ...e, [slug]: ERROR_MESSAGES[data.error] || "Something went wrong. Please try again." }));
        setBusySlug(null);
        void refreshTiers();
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setErrors((e) => ({ ...e, [slug]: "Couldn’t start checkout. Please try again." }));
      setBusySlug(null);
    }
  }

  return (
    <>
      {cancelled && (
        <div className="mb-6 rounded-2xl bg-white/[0.05] px-5 py-3.5 text-[13px] text-white/60" role="status">
          Checkout was cancelled — nothing was charged. You can try again below.
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {tiers.map((tier) => (
          <TierCard
            key={tier.slug}
            tier={tier}
            busy={busySlug === tier.slug}
            error={errors[tier.slug] || null}
            loggedIn={loggedIn}
            onBecomeFounder={onBecomeFounder}
          />
        ))}
      </div>
    </>
  );
}

export function FounderTierCards({ initialTiers }: { initialTiers: FounderTier[] }) {
  return (
    <Suspense fallback={<div className="grid grid-cols-1 gap-5 lg:grid-cols-3">{null}</div>}>
      <FounderTierCardsInner initialTiers={initialTiers} />
    </Suspense>
  );
}
