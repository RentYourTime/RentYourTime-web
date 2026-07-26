"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/SiteNav";
import { FOUNDER_TIER_CONTENT, type FounderTierSlug } from "@/lib/founderContent";

const TOKEN_KEY = "ryt-auth-token";

type Gate = "checking" | "signedOut" | "granted";
type Tab = "overview" | "usage" | "contribute" | "founder" | "settings";

interface PanelAccount {
  email: string;
  display_name: string | null;
  created_at: string;
  is_pro: boolean;
}

const NAV: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "usage", label: "Usage & apps" },
  { key: "contribute", label: "Support the project" },
  { key: "founder", label: "Founder Status" },
  { key: "settings", label: "Settings" },
];

const TITLES: Record<Tab, string> = {
  overview: "Overview",
  usage: "Usage & apps",
  contribute: "Support the project",
  founder: "Founder Status",
  settings: "Settings",
};

const VALID_TABS: readonly Tab[] = ["overview", "usage", "contribute", "founder", "settings"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export function PanelClient() {
  const searchParams = useSearchParams();
  const [gate, setGate] = useState<Gate>("checking");
  const [account, setAccount] = useState<PanelAccount | null>(null);
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get("tab");
    return VALID_TABS.includes(requested as Tab) ? (requested as Tab) : "overview";
  });

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!stored) {
      setGate("signedOut");
      return;
    }
    setToken(stored);
    fetch("/api/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data?.ok) throw new Error();
        setAccount({
          email: data.user.email,
          display_name: data.user.display_name,
          created_at: data.user.created_at,
          is_pro: !!data.user.subscription?.is_pro,
        });
        setGate("granted");
      })
      .catch(() => setGate("signedOut"));
  }, []);

  if (gate === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-white/40">
        Loading your dashboard…
      </div>
    );
  }

  if (gate === "signedOut" || !account) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-24 text-center">
        <Wordmark />
        <p className="mt-8 text-[15px] text-white/50">Sign in to see your dashboard.</p>
        <Link
          href="/account"
          className="mt-4 inline-block rounded-full bg-signal px-5 py-2.5 text-[13px] font-semibold text-sig-ink no-underline"
        >
          Go to your account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen [overflow-x:clip] bg-ink text-white">
      <aside className="flex w-[248px] flex-none flex-col gap-1.5 border-r border-white/[0.06] bg-[#0e0e0e] p-4">
        <Wordmark />
        <div className="px-2.5 pb-1.5 pt-5 text-[11px] font-semibold tracking-[0.08em] text-white/30">
          YOUR DASHBOARD
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setTab(n.key)}
              className={`h-[42px] rounded-xl px-3.5 text-left text-sm font-semibold transition-colors ${
                tab === n.key ? "bg-signal/10 text-white shadow-[inset_2px_0_0_var(--signal)]" : "bg-transparent text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 rounded-2xl bg-card p-3">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-signal text-[13px] font-bold text-sig-ink">
            {(account.display_name || account.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">
              {account.display_name || account.email}
            </div>
            <div className="truncate text-xs text-white/45">{account.email}</div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-7 py-[22px]">
          <h1 className="m-0 text-[23px] font-bold tracking-[-0.02em]">{TITLES[tab]}</h1>
          <div className="flex items-center gap-3.5">
            <span className="inline-flex h-[30px] items-center rounded-full bg-signal/[0.12] px-3.5 text-xs font-bold tracking-[0.04em] text-signal">
              {account.is_pro ? "PRO" : "FREE"}
            </span>
            <span className="text-[13px] text-white/40">12-day streak</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-7">
          {tab === "overview" && <OverviewTab />}
          {tab === "usage" && <UsageTab />}
          {tab === "contribute" && <ContributeTab token={token} />}
          {tab === "founder" && <FounderStatusTab token={token} />}
          {tab === "settings" && <SettingsTab account={account} />}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, valueClass, sub }: { label: string; value: string; valueClass?: string; sub?: string }) {
  return (
    <div className="rounded-[20px] bg-card p-5">
      <div className="text-[13px] text-white/50">{label}</div>
      <div className={`mt-2 text-[28px] font-bold tabular-nums ${valueClass ?? ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

const WEEK_BARS = [
  ["M", 27], ["T", 3], ["W", 76], ["T", 18], ["F", 3], ["S", 100], ["S", 40],
] as const;

function OverviewTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today’s rent" value="$2.70" valueClass="text-rent" sub="18m over allowance" />
        <StatCard label="Allowance used" value="3h 18m" sub="of 3h 00m" />
        <StatCard label="Current streak" value="12 days" valueClass="text-signal" sub="personal best: 21" />
        <StatCard label="Avoided in July" value="$84" valueClass="text-signal" sub="rent you didn’t pay" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col items-center gap-4 rounded-[24px] bg-card p-[26px]">
          <div className="self-start text-[13px] font-semibold text-white/50">TODAY</div>
          <div
            className="flex h-[170px] w-[170px] items-center justify-center rounded-full"
            style={{ background: "conic-gradient(#00e676 0 88%, #ff3b30 88% 100%)" }}
          >
            <div className="flex h-[138px] w-[138px] flex-col items-center justify-center rounded-full bg-card">
              <div className="text-[34px] font-bold tabular-nums">3:18</div>
              <div className="text-xs text-rent">18m over</div>
            </div>
          </div>
          <div className="text-center text-[13px] text-white/45">
            You’ve used your full free allowance. Every extra minute now adds rent.
          </div>
        </div>
        <div className="rounded-[24px] bg-card p-[26px]">
          <div className="flex items-baseline justify-between">
            <div className="text-base font-semibold">This week</div>
            <div className="text-[13px] text-white/45">minutes over allowance</div>
          </div>
          <div className="mt-[22px] flex h-[150px] items-end gap-3.5">
            {WEEK_BARS.map(([label, pct], i) => (
              <div key={label + i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div
                  className={`w-full rounded-t-md ${pct === 100 ? "bg-rent" : "bg-signal"}`}
                  style={{ height: `${pct}%`, opacity: pct === 100 ? 1 : 0.85 }}
                />
                <span className="text-xs text-white/40">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DAY_BARS = [
  ["Mon", 58], ["Tue", 42], ["Wed", 80], ["Thu", 50], ["Fri", 38], ["Sat", 100], ["Sun", 66],
] as const;

const APPS = [
  ["Instagram", "1h 12m", 100],
  ["TikTok", "48m", 67],
  ["Safari", "32m", 44],
  ["X", "20m", 28],
  ["Mail", "9m", 13],
] as const;

function UsageTab() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="text-base font-semibold">Screen time this week</div>
        <div className="mt-0.5 text-[13px] text-white/45">
          Total 24h 06m · 9h 20m reclaimed vs last week
        </div>
        <div className="mt-6 flex h-[200px] items-end gap-4">
          {DAY_BARS.map(([label, pct]) => (
            <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div
                className={`w-full rounded-t-lg ${pct === 100 ? "bg-rent" : "bg-signal"}`}
                style={{ height: `${pct}%`, opacity: pct === 100 ? 1 : 0.85 }}
              />
              <span className="text-xs text-white/40">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-[18px] text-base font-semibold">Top apps today</div>
        <div className="flex flex-col gap-4">
          {APPS.map(([name, time, pct]) => (
            <div key={name}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span>{name}</span>
                <b className="font-semibold text-white/60">{time}</b>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-white/[0.08]">
                <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Contribution {
  id: string;
  percentage: number;
  amountCents: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  createdAt: string;
  paidAt: string | null;
  isDemo: boolean;
}

const PERCENTAGES = [5, 10, 25, 50, 75, 100] as const;

/**
 * Fixed, fictional entries shown only when the account's accrued rent is
 * demo-sourced (dev-only — see docs/CONTRIBUTIONS.md). Never persisted,
 * never fetched from the API, never counted in any real total.
 */
const DEMO_PREVIEW_HISTORY: { date: string; percentage: number; amountCents: number }[] = [
  { date: "Jul 1, 2026", percentage: 10, amountCents: 284 },
  { date: "Jun 1, 2026", percentage: 10, amountCents: 310 },
  { date: "May 1, 2026", percentage: 25, amountCents: 666 },
];
const DEMO_PREVIEW_TOTAL_CENTS = DEMO_PREVIEW_HISTORY.reduce((sum, c) => sum + c.amountCents, 0);

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  invalid_percentage: "Pick one of the percentages above.",
  accrued_rent_unavailable:
    "Your rent ledger isn’t syncing from the app yet, so there’s nothing to contribute from right now.",
  server_not_configured: "Payments aren’t configured yet. Please try again later.",
  payment_provider_error: "Couldn’t reach Stripe. Please try again in a moment.",
};

function formatCents(cents: number, currency: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: currency.toUpperCase() });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatContributionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ContributeTab({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const [pct, setPct] = useState<(typeof PERCENTAGES)[number]>(10);
  const [loading, setLoading] = useState(true);
  const [accruedRentCents, setAccruedRentCents] = useState<number | null>(null);
  const [isDemoAccruedRent, setIsDemoAccruedRent] = useState(false);
  const [currency, setCurrency] = useState("usd");
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [totalContributedCents, setTotalContributedCents] = useState(0);
  const [demoTestPaymentsCents, setDemoTestPaymentsCents] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingSessionStatus, setPendingSessionStatus] = useState<
    "confirming" | "paid" | "cancelled" | null
  >(searchParams.get("contribution") === "cancelled" ? "cancelled" : null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contributions", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      setAccruedRentCents(data.data.accruedRentCents);
      setIsDemoAccruedRent(!!data.data.isDemoAccruedRent);
      setCurrency(data.data.currency);
      setContributions(data.data.contributions);
      setTotalContributedCents(data.data.totalContributedCents);
      setDemoTestPaymentsCents(data.data.demoTestPaymentsCents);
    } catch {
      setError("Couldn’t load your contributions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void load();
    // Re-runs only when the token first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // A same-tab return from Stripe Checkout: poll the local session status
  // (never trust `?contribution=success` on its own) until it settles.
  useEffect(() => {
    if (!token) return;
    const sessionId = searchParams.get("session_id");
    if (searchParams.get("contribution") !== "success" || !sessionId) return;

    setPendingSessionStatus("confirming");
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/contributions/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.ok && data.data.status === "PAID") {
          setPendingSessionStatus("paid");
          void load();
          return;
        }
      } catch {
        /* keep polling until the attempt budget runs out */
      }
      if (!cancelled && attempts < 8) setTimeout(poll, 1500);
    };
    void poll();

    window.history.replaceState({}, "", "/panel?tab=contribute");
    return () => {
      cancelled = true;
    };
    // Runs once per session_id that appears in the URL on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onContribute() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/contributions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ percentage: pct }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "amount_too_low") {
          setError(
            `That’s below Stripe’s minimum charge (${formatCents(data.minimumCents, data.currency)}) — try a higher percentage.`
          );
        } else {
          setError(CHECKOUT_ERROR_MESSAGES[data.error] || "Something went wrong. Please try again.");
        }
        setBusy(false);
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setError("Couldn’t start checkout. Please try again.");
      setBusy(false);
    }
  }

  const available = accruedRentCents !== null && accruedRentCents > 0;
  const amountCents = available ? Math.round((accruedRentCents! * pct) / 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="rounded-[24px] bg-card p-[30px]">
        <h2 className="m-0 text-2xl tracking-[-0.02em]">
          Support the project<span className="text-signal">.</span>
        </h2>
        <p className="m-0 mt-3 max-w-[520px] text-[15px] leading-[1.6] text-white/55">
          Your rent is virtual — you never owe it. If RentYourTime helps you, you can choose to
          contribute a share of your accrued rent to keep it running and independent. Entirely
          optional.
        </p>

        {pendingSessionStatus === "confirming" && (
          <div className="mt-5 rounded-2xl bg-signal/[0.08] px-4 py-3 text-[13px] text-signal" role="status">
            Payment is being confirmed…
          </div>
        )}
        {pendingSessionStatus === "paid" && (
          <div className="mt-5 rounded-2xl bg-signal/[0.08] px-4 py-3 text-[13px] text-signal" role="status">
            Thank you — your contribution is confirmed.
          </div>
        )}
        {pendingSessionStatus === "cancelled" && (
          <div className="mt-5 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13px] text-white/60" role="status">
            Checkout was cancelled — nothing was charged. You can try again below.
          </div>
        )}

        {loading ? (
          <div className="mt-6 h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : (
          <div className="mt-6 flex items-center justify-between rounded-2xl bg-ink px-5 py-[18px]">
            <span className="flex items-center gap-2 text-sm text-white/55">
              Accrued rent this month
              {isDemoAccruedRent && (
                <span className="inline-flex h-5 items-center rounded-full bg-white/10 px-2 text-[10px] font-bold tracking-[0.04em] text-white/60">
                  DEMO DATA
                </span>
              )}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {available ? formatCents(accruedRentCents!, currency) : "—"}
            </span>
          </div>
        )}

        {isDemoAccruedRent && !loading && (
          <p className="mt-3 text-xs leading-[1.5] text-white/40">
            Showing demo test data because your account has no synced rent ledger yet.
            Contributing still opens a real Stripe Checkout session in Test Mode.
          </p>
        )}

        {!loading && !available ? (
          <p className="mt-4 text-sm leading-[1.55] text-white/45">
            Your rent ledger isn’t syncing from the app yet, so there’s nothing to contribute from
            right now — check back once it does.
          </p>
        ) : (
          <>
            <div className="mb-2.5 mt-[22px] text-[13px] font-semibold text-white/50">
              I’d like to contribute
            </div>
            <div className="flex flex-wrap gap-2.5">
              {PERCENTAGES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPct(p)}
                  className={`h-[42px] rounded-[21px] border px-[22px] text-[15px] font-semibold tabular-nums transition-colors ${
                    p === pct
                      ? "border-signal bg-signal text-sig-ink"
                      : "border-signal/30 bg-signal/[0.08] text-signal"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
            <div className="mt-[26px] flex flex-wrap items-center gap-[18px]">
              <div>
                <div className="text-xs text-white/45">That’s {pct}% of your rent</div>
                <div className="text-[32px] font-bold tabular-nums text-signal">
                  {formatCents(amountCents, currency)}
                </div>
              </div>
              <button
                type="button"
                onClick={onContribute}
                disabled={busy}
                className="h-[52px] rounded-[26px] border-0 bg-signal px-7 text-[15px] font-semibold text-sig-ink transition-transform duration-150 ease-spring active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Redirecting to Stripe…" : `Contribute ${formatCents(amountCents, currency)}`}
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-3.5 text-[13px] text-[#ff8a84]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-3.5 text-xs leading-[1.5] text-white/40">
          One-time optional contribution. Does not unlock features. Does not reduce or settle
          virtual rent. See the{" "}
          <Link href="/terms" className="text-signal">
            Terms
          </Link>
          .
        </div>
      </div>
      {loading ? (
        <div className="rounded-[24px] bg-card p-[26px]">
          <div className="flex flex-col gap-3">
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
            <div className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
        </div>
      ) : isDemoAccruedRent ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] bg-card p-[26px]">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold">
              Preview contributions
              <span className="inline-flex h-5 items-center rounded-full bg-white/10 px-2 text-[10px] font-bold tracking-[0.04em] text-white/60">
                DEMO DATA
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {DEMO_PREVIEW_HISTORY.map((c) => (
                <div
                  key={c.date}
                  className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0"
                >
                  <div>
                    <div className="text-sm">{c.date}</div>
                    <div className="text-xs text-white/40">{c.percentage}% of rent</div>
                  </div>
                  <b className="font-semibold tabular-nums text-white/40">
                    {formatCents(c.amountCents, currency)}
                  </b>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-ink p-4 text-center">
              <div className="text-xs text-white/45">Preview total — not real, never saved</div>
              <div className="text-2xl font-bold tabular-nums text-white/50">
                {formatCents(DEMO_PREVIEW_TOTAL_CENTS, currency)}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-card p-[26px]">
            <div className="mb-4 text-base font-semibold">Test Stripe payments</div>
            {contributions.filter((c) => c.isDemo).length === 0 ? (
              <p className="text-sm text-white/40">
                No test payments yet — contributing above creates a real Stripe Test Mode charge.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {contributions
                  .filter((c) => c.isDemo)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0"
                    >
                      <div>
                        <div className="text-sm">{formatContributionDate(c.paidAt ?? c.createdAt)}</div>
                        <div className="text-xs text-white/40">
                          {c.percentage}% of rent · Stripe test
                          {c.status !== "PAID" ? ` · ${c.status.toLowerCase()}` : ""}
                        </div>
                      </div>
                      <b className={`font-semibold tabular-nums ${c.status === "PAID" ? "text-signal" : "text-white/40"}`}>
                        {formatCents(c.amountCents, c.currency)}
                      </b>
                    </div>
                  ))}
              </div>
            )}
            <div className="mt-5 rounded-2xl bg-ink p-4 text-center">
              <div className="text-xs text-white/45">Real Stripe Test Mode payments</div>
              <div className="text-2xl font-bold tabular-nums">
                {formatCents(demoTestPaymentsCents, currency)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] bg-card p-[26px]">
          <div className="mb-4 text-base font-semibold">Your contributions</div>
          {contributions.length === 0 ? (
            <p className="text-sm text-white/40">You haven’t contributed yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {contributions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0"
                >
                  <div>
                    <div className="text-sm">{formatContributionDate(c.paidAt ?? c.createdAt)}</div>
                    <div className="text-xs text-white/40">
                      {c.percentage}% of rent{c.status !== "PAID" ? ` · ${c.status.toLowerCase()}` : ""}
                    </div>
                  </div>
                  <b className={`font-semibold tabular-nums ${c.status === "PAID" ? "text-signal" : "text-white/40"}`}>
                    {formatCents(c.amountCents, c.currency)}
                  </b>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 rounded-2xl bg-ink p-4 text-center">
            <div className="text-xs text-white/45">Contributed so far</div>
            <div className="text-2xl font-bold tabular-nums">
              {formatCents(totalContributedCents, currency)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FounderBlackKit {
  fullName: string | null;
  shippingAddress: string | null;
  country: string | null;
  shirtSize: string | null;
  cardStatus: "pending" | "prepared" | "shipped";
  certificateStatus: "pending" | "prepared" | "shipped";
  letterStatus: "pending" | "prepared" | "shipped";
  shirtStatus: "pending" | "prepared" | "shipped";
  trackingNumber: string | null;
  shippedAt: string | null;
}

interface FounderPurchase {
  id: string;
  tierSlug: string;
  tierName: string;
  founderNumber: number | null;
  founderNumberFormatted: string | null;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  fulfillmentStatus: string;
  purchasedAt: string;
  proStartsAt: string | null;
  proEndsAt: string | null;
  isLifetimePro: boolean;
  discordSyncStatus: "pending" | "assigned" | "failed" | "removed";
  blackKit: FounderBlackKit | null;
}

const KIT_STATUS_LABEL: Record<string, string> = { pending: "Pending", prepared: "Prepared", shipped: "Shipped" };
const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function BlackKitForm({ purchase, token, onSubmitted }: { purchase: FounderPurchase; token: string; onSubmitted: () => void }) {
  const [fullName, setFullName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [country, setCountry] = useState("");
  const [shirtSize, setShirtSize] = useState("M");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/founders/black-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purchaseId: purchase.id, fullName, shippingAddress, country, shirtSize }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      onSubmitted();
    } catch {
      setError("Couldn’t save your shipping details. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 rounded-2xl bg-ink p-4">
      <div className="text-[13px] font-semibold text-white/60">Shipping details for your Founder Black kit</div>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        required
        maxLength={200}
        className="h-11 rounded-xl border-0 bg-white/[0.07] px-4 text-sm text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
      />
      <textarea
        value={shippingAddress}
        onChange={(e) => setShippingAddress(e.target.value)}
        placeholder="Shipping address"
        required
        maxLength={500}
        rows={3}
        className="rounded-xl border-0 bg-white/[0.07] px-4 py-2.5 text-sm text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country"
          required
          maxLength={100}
          className="h-11 rounded-xl border-0 bg-white/[0.07] px-4 text-sm text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
        />
        <select
          value={shirtSize}
          onChange={(e) => setShirtSize(e.target.value)}
          className="h-11 rounded-xl border-0 bg-white/[0.07] px-4 text-sm text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
        >
          {SHIRT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-[13px] text-[#ff8a84]" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-xl border-0 bg-signal text-sm font-semibold text-sig-ink disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save shipping details"}
      </button>
    </form>
  );
}

function FounderPurchaseCard({ purchase, token, onRefresh }: { purchase: FounderPurchase; token: string; onRefresh: () => void }) {
  const content = FOUNDER_TIER_CONTENT[purchase.tierSlug as FounderTierSlug];
  const isBlack = purchase.tierSlug === "founder-black";

  return (
    <div className="rounded-[24px] bg-card p-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold tracking-[0.08em]" style={{ color: content?.accent ?? "#00e676" }}>
            {purchase.tierName.toUpperCase()} {purchase.founderNumberFormatted ?? ""}
          </div>
          <div className="mt-1 text-[13px] text-white/45">
            Purchased {formatContributionDate(purchase.purchasedAt)}
          </div>
        </div>
        <span
          className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-bold ${
            purchase.paymentStatus === "PAID"
              ? "bg-signal/[0.12] text-signal"
              : purchase.paymentStatus === "REFUNDED"
                ? "bg-white/10 text-white/50"
                : "bg-[rgba(255,193,7,0.14)] text-[#ffca28]"
          }`}
        >
          {purchase.paymentStatus}
        </span>
      </div>

      <div className="mt-4 flex flex-col text-[14px]">
        <div className="flex items-center justify-between border-b border-white/[0.06] py-2.5">
          <span className="text-white/40">Pro access</span>
          <span>{purchase.isLifetimePro ? "Lifetime" : purchase.proEndsAt ? `Until ${formatContributionDate(purchase.proEndsAt)}` : "—"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-white/[0.06] py-2.5">
          <span className="text-white/40">Discord role sync</span>
          <span className="capitalize">{purchase.discordSyncStatus}</span>
        </div>
        {isBlack && (
          <div className="flex items-center justify-between py-2.5">
            <span className="text-white/40">Kit fulfillment</span>
            <span>{purchase.fulfillmentStatus.replace("_", " ").toLowerCase()}</span>
          </div>
        )}
      </div>

      {content && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-white/50">Your benefits</summary>
          <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] leading-[1.5] text-white/60">
            {content.benefits.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-signal">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {isBlack && purchase.paymentStatus === "PAID" && (
        <>
          {!purchase.blackKit?.shippingAddress ? (
            <BlackKitForm purchase={purchase} token={token} onSubmitted={onRefresh} />
          ) : (
            <div className="mt-4 rounded-2xl bg-ink p-4">
              <div className="mb-2.5 text-[13px] font-semibold text-white/60">Founder Black kit status</div>
              <div className="grid grid-cols-2 gap-2 text-[13px] text-white/60 sm:grid-cols-4">
                <div>
                  Card <b className="block text-white">{KIT_STATUS_LABEL[purchase.blackKit.cardStatus]}</b>
                </div>
                <div>
                  Certificate <b className="block text-white">{KIT_STATUS_LABEL[purchase.blackKit.certificateStatus]}</b>
                </div>
                <div>
                  Letter <b className="block text-white">{KIT_STATUS_LABEL[purchase.blackKit.letterStatus]}</b>
                </div>
                <div>
                  Shirt <b className="block text-white">{KIT_STATUS_LABEL[purchase.blackKit.shirtStatus]}</b>
                </div>
              </div>
              {purchase.blackKit.trackingNumber && (
                <div className="mt-2.5 text-[13px] text-white/60">
                  Tracking: <code className="text-white">{purchase.blackKit.trackingNumber}</code>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FounderStatusTab({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<FounderPurchase[]>([]);
  const [profile, setProfile] = useState({ displayName: "", consentDirectory: false, consentCredits: false, consentCaseStudy: false });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pendingSessionStatus, setPendingSessionStatus] = useState<"confirming" | "paid" | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/founders/me", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      setPurchases(data.data.purchases);
      if (data.data.profile) {
        setProfile({
          displayName: data.data.profile.displayName || "",
          consentDirectory: data.data.profile.consentDirectory,
          consentCredits: data.data.profile.consentCredits,
          consentCaseStudy: data.data.profile.consentCaseStudy,
        });
      }
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const sessionId = searchParams.get("session_id");
    if (searchParams.get("founder") !== "success" || !sessionId) return;
    setPendingSessionStatus("confirming");
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/founders/session/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.ok && data.data.status === "PAID") {
          setPendingSessionStatus("paid");
          void load();
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled && attempts < 8) setTimeout(poll, 1500);
    };
    void poll();
    window.history.replaceState({}, "", "/panel?tab=founder");
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSaveProfile() {
    setSavingProfile(true);
    try {
      await fetch("/api/founders/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: profile.displayName,
          consentDirectory: profile.consentDirectory,
          consentCredits: profile.consentCredits,
          consentCaseStudy: profile.consentCaseStudy,
        }),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="rounded-[24px] bg-card p-[30px] text-center">
        <h2 className="m-0 text-2xl tracking-[-0.02em]">
          Not a Founder yet<span className="text-signal">.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-[1.6] text-white/55">
          You don’t hold a Founder status on this account. Founder tiers are limited and numbered —
          once they’re gone, they’re gone.
        </p>
        <Link
          href="/founders"
          className="mt-6 inline-flex h-[48px] items-center rounded-[24px] bg-signal px-7 text-[15px] font-semibold text-sig-ink no-underline"
        >
          View the Founder Program
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingSessionStatus === "confirming" && (
        <div className="rounded-2xl bg-signal/[0.08] px-4 py-3 text-[13px] text-signal" role="status">
          Payment is being confirmed…
        </div>
      )}
      {pendingSessionStatus === "paid" && (
        <div className="rounded-2xl bg-signal/[0.08] px-4 py-3 text-[13px] text-signal" role="status">
          Welcome, Founder — your purchase is confirmed.
        </div>
      )}

      {purchases.map((p) => (
        <FounderPurchaseCard key={p.id} purchase={p} token={token} onRefresh={load} />
      ))}

      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-1 text-base font-semibold">Founders Directory &amp; credits</div>
        <p className="m-0 mb-4 text-[13px] text-white/45">
          These consents are optional and can be changed any time.
        </p>
        <label className="mb-3 block text-[13px] text-white/50">
          Display name (shown only if you opt in below)
          <input
            value={profile.displayName}
            onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
            maxLength={80}
            placeholder="Optional"
            className="mt-1.5 h-11 w-full max-w-sm rounded-xl border-0 bg-white/[0.07] px-4 text-sm text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
          />
        </label>
        <div className="flex flex-col gap-2.5 text-[13px] text-white/60">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={profile.consentDirectory}
              onChange={(e) => setProfile((p) => ({ ...p, consentDirectory: e.target.checked }))}
              className="h-4 w-4 accent-signal"
            />
            List me in the Founders directory
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={profile.consentCredits}
              onChange={(e) => setProfile((p) => ({ ...p, consentCredits: e.target.checked }))}
              className="h-4 w-4 accent-signal"
            />
            Include me in the app credits
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={profile.consentCaseStudy}
              onChange={(e) => setProfile((p) => ({ ...p, consentCaseStudy: e.target.checked }))}
              className="h-4 w-4 accent-signal"
            />
            I&rsquo;m open to being featured in promotional material or case studies
          </label>
        </div>
        <button
          type="button"
          onClick={onSaveProfile}
          disabled={savingProfile}
          className="mt-4 h-10 rounded-full border-0 bg-signal px-5 text-[13px] font-semibold text-sig-ink disabled:cursor-wait disabled:opacity-60"
        >
          {savingProfile ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}

function SettingsTab({ account }: { account: PanelAccount }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-4 text-base font-semibold">Account</div>
        <div className="flex flex-col gap-3.5 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">Email</span>
            <span>{account.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Member since</span>
            <span>{formatDate(account.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50">Plan</span>
            <span className="inline-flex h-[26px] items-center rounded-full bg-signal/[0.12] px-3 text-xs font-bold text-signal">
              {account.is_pro ? "Pro" : "Free"}
            </span>
          </div>
        </div>
        <Link
          href="/account"
          className="mt-5 inline-flex h-[42px] items-center rounded-[21px] border border-white/15 px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/5"
        >
          Manage subscription
        </Link>
      </div>
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-4 text-base font-semibold">Preferences</div>
        <div className="flex flex-col gap-3.5 text-sm">
          <div className="flex justify-between">
            <span className="text-white/50">Daily allowance</span>
            <span>3h 00m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">iCloud backup</span>
            <span className="text-signal">On</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Reduce motion</span>
            <span className="text-white/50">Follows system</span>
          </div>
        </div>
        <div className="mt-5 text-[13px] text-white/40">
          Read our{" "}
          <Link href="/privacy" className="text-signal">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-signal">
            Terms of Service
          </Link>
          .
        </div>
      </div>
      <div className="rounded-[24px] border border-rent/25 bg-card p-[26px] sm:col-span-2">
        <div className="text-base font-semibold text-[#ff6b60]">Delete account</div>
        <p className="m-0 mb-4 mt-2 max-w-[560px] text-sm leading-[1.55] text-white/50">
          This erases your account and personal data from active systems immediately, and from
          backups within 30 days.
        </p>
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="h-[42px] rounded-[21px] border border-rent/50 bg-transparent px-5 text-sm font-semibold text-[#ff6b60] transition-colors hover:bg-rent/10"
          >
            Delete my account
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-white/60">
              This can’t be undone — deletion isn’t wired up on the site yet. Contact support to
              request it.
            </span>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="h-9 rounded-full border border-white/15 px-4 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
