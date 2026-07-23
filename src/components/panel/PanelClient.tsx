"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";

const TOKEN_KEY = "ryt-auth-token";

type Gate = "checking" | "signedOut" | "granted";
type Tab = "overview" | "usage" | "contribute" | "settings";

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
  { key: "settings", label: "Settings" },
];

const TITLES: Record<Tab, string> = {
  overview: "Overview",
  usage: "Usage & apps",
  contribute: "Support the project",
  settings: "Settings",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export function PanelClient() {
  const [gate, setGate] = useState<Gate>("checking");
  const [account, setAccount] = useState<PanelAccount | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!stored) {
      setGate("signedOut");
      return;
    }
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
          {tab === "contribute" && <ContributeTab />}
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

const PAST_CONTRIBUTIONS = [
  ["Jul 1, 2026", "10% of rent", "$2.84"],
  ["Jun 1, 2026", "10% of rent", "$3.10"],
  ["May 1, 2026", "25% of rent", "$6.66"],
] as const;

function ContributeTab() {
  const [pct, setPct] = useState(10);
  const debt = 28.4;
  const amount = (debt * pct) / 100;

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
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-ink px-5 py-[18px]">
          <span className="text-sm text-white/55">Accrued rent this month</span>
          <span className="text-2xl font-bold tabular-nums">${debt.toFixed(2)}</span>
        </div>
        <div className="mb-2.5 mt-[22px] text-[13px] font-semibold text-white/50">
          I’d like to contribute
        </div>
        <div className="flex flex-wrap gap-2.5">
          {[5, 10, 25, 50, 75, 100].map((p) => (
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
            <div className="text-[32px] font-bold tabular-nums text-signal">${amount.toFixed(2)}</div>
          </div>
          <button
            type="button"
            className="h-[52px] rounded-[26px] border-0 bg-signal px-7 text-[15px] font-semibold text-sig-ink transition-transform duration-150 ease-spring active:scale-[0.97]"
          >
            Contribute ${amount.toFixed(2)}
          </button>
        </div>
        <div className="mt-3.5 text-xs text-white/40">
          One-off. Doesn’t unlock features or change the app. See the{" "}
          <Link href="/terms" className="text-signal">
            Terms
          </Link>
          .
        </div>
      </div>
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-4 text-base font-semibold">Your contributions</div>
        <div className="flex flex-col gap-3">
          {PAST_CONTRIBUTIONS.map(([date, note, amt]) => (
            <div
              key={date}
              className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0"
            >
              <div>
                <div className="text-sm">{date}</div>
                <div className="text-xs text-white/40">{note}</div>
              </div>
              <b className="font-semibold tabular-nums text-signal">{amt}</b>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl bg-ink p-4 text-center">
          <div className="text-xs text-white/45">Contributed so far</div>
          <div className="text-2xl font-bold tabular-nums">$12.60</div>
        </div>
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
