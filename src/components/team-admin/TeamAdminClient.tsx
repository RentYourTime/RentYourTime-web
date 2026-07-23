"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";

const TOKEN_KEY = "ryt-auth-token";

type Gate = "checking" | "denied" | "granted";
type Tab = "overview" | "members" | "billing";

interface TeamAdminAccount {
  email: string;
  display_name: string | null;
}

const NAV: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members & seats" },
  { key: "billing", label: "Billing" },
];

const TITLES: Record<Tab, string> = {
  overview: "Overview",
  members: "Members & seats",
  billing: "Billing",
};

const FOCUS_BARS = [
  ["M", 61], ["T", 78], ["W", 57], ["T", 90], ["F", 100], ["S", 31], ["S", 22],
] as const;

const TEAM_ADHERENCE = [
  ["Engineering", 94],
  ["Design", 90],
  ["Support", 88],
  ["Sales", 83],
] as const;

const MEMBERS = [
  ["Member #A1F", "Engineering", "Active", "Mar 3, 2026"],
  ["Member #7K2", "Design", "Active", "Mar 3, 2026"],
  ["Member #9QP", "Sales", "Invited", "—"],
  ["Member #B4C", "Support", "Active", "Apr 12, 2026"],
  ["Member #D8E", "Engineering", "Paused", "Feb 1, 2026"],
  ["Member #F2H", "Design", "Active", "May 5, 2026"],
] as const;

const INVOICES = [
  ["Jul 1, 2026", "$576.00"],
  ["Jun 1, 2026", "$564.00"],
  ["May 1, 2026", "$540.00"],
] as const;

export function TeamAdminClient() {
  const [gate, setGate] = useState<Gate>("checking");
  const [account, setAccount] = useState<TeamAdminAccount | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!stored) {
      setGate("denied");
      return;
    }
    fetch("/api/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data?.ok && data.user?.role === "ADMIN_TEAMS") {
          setAccount({ email: data.user.email, display_name: data.user.display_name });
          setGate("granted");
        } else {
          setGate("denied");
        }
      })
      .catch(() => setGate("denied"));
  }, []);

  if (gate === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-white/40">
        Checking access…
      </div>
    );
  }

  if (gate === "denied" || !account) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-24 text-center">
        <p className="text-[15px] text-white/50">
          This panel is only available to accounts with the Team admin role.
        </p>
        <Link href="/account" className="mt-4 inline-block text-[13px] font-semibold text-signal underline">
          Go to your account
        </Link>
      </div>
    );
  }

  const orgName = account.display_name ? `${account.display_name}’s team` : "Your team";

  return (
    <div className="flex min-h-screen [overflow-x:clip] bg-ink text-white">
      <aside className="flex w-[248px] flex-none flex-col gap-1.5 border-r border-white/[0.06] bg-[#0e0e0e] p-4">
        <Wordmark />
        <div className="px-2.5 pb-1.5 pt-5 text-[11px] font-semibold tracking-[0.08em] text-white/30">
          TEAM ADMIN
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
        <div className="mt-auto flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 rounded-2xl bg-card p-3">
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-signal/[0.15] text-xs font-bold text-signal">
              NL
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{orgName}</div>
              <div className="text-xs text-white/45">Team plan</div>
            </div>
          </div>
          <Link
            href="/account"
            className="rounded-2xl bg-card p-3 text-center text-[13px] font-semibold text-white/60 no-underline transition-colors hover:text-white"
          >
            ← Back to account
          </Link>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-7 py-[22px]">
          <h1 className="m-0 text-[23px] font-bold tracking-[-0.02em]">{TITLES[tab]}</h1>
          <span className="text-[13px] text-white/50">96 / 120 seats</span>
        </header>

        <div className="flex-1 overflow-y-auto p-7">
          <p className="mb-5 text-[13px] text-white/35">
            Sample data — connect an SSO directory to replace this with your real roster.
          </p>
          {tab === "overview" && <OverviewTab />}
          {tab === "members" && <MembersTab />}
          {tab === "billing" && <BillingTab />}
        </div>
      </main>
    </div>
  );
}

function Tile({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="rounded-[20px] bg-card p-5">
      <div className="text-[13px] text-white/50">{label}</div>
      <div className={`mt-2 text-[30px] font-bold tabular-nums ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Active members" value={96} />
        <Tile label="Focus reclaimed / person" value="6.5h" valueClass="text-signal" />
        <Tile label="Allowance adherence" value="92%" />
        <Tile label="Voluntary opt-in" value="88%" valueClass="text-signal" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-[24px] bg-card p-[26px]">
          <div className="text-base font-semibold">Focus reclaimed</div>
          <div className="mt-0.5 text-[13px] text-white/45">team average, hours per day</div>
          <div className="mt-[22px] flex h-[170px] items-end gap-3.5">
            {FOCUS_BARS.map(([label, pct], i) => (
              <div key={label + i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="w-full rounded-t-md bg-signal" style={{ height: `${pct}%`, opacity: pct === 100 ? 1 : 0.85 }} />
                <span className="text-xs text-white/40">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[24px] bg-card p-[26px]">
          <div className="mb-[18px] text-base font-semibold">Adherence by team</div>
          <div className="flex flex-col gap-4">
            {TEAM_ADHERENCE.map(([name, pct]) => (
              <div key={name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{name}</span>
                  <b className="font-semibold text-white/60">{pct}%</b>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-white/[0.08]">
                  <div className="h-full bg-signal" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="text-[13px] text-white/40">
        Individual usage is never visible to admins — see the{" "}
        <Link href="/privacy" className="text-signal">
          Privacy Policy
        </Link>
        .
      </div>
    </div>
  );
}

function MembersTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex h-[34px] items-center rounded-[17px] bg-signal/10 px-4 text-[13px] font-semibold text-signal">
          All 96
        </span>
        <span className="inline-flex h-[34px] items-center rounded-[17px] bg-card px-4 text-[13px] font-semibold text-white/55">
          Active 90
        </span>
        <span className="inline-flex h-[34px] items-center rounded-[17px] bg-card px-4 text-[13px] font-semibold text-white/55">
          Invited 5
        </span>
        <span className="inline-flex h-[34px] items-center rounded-[17px] bg-card px-4 text-[13px] font-semibold text-white/55">
          Paused 1
        </span>
      </div>
      <div className="overflow-x-auto rounded-[24px] bg-card">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-white/40">
              <th className="px-4 py-4 font-semibold">Member</th>
              <th className="px-2 py-4 font-semibold">Team</th>
              <th className="px-2 py-4 font-semibold">Status</th>
              <th className="px-2 py-4 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map(([member, team, status, joined]) => (
              <tr key={member} className="border-t border-white/[0.05]">
                <td className="px-4 py-3.5 tabular-nums">{member}</td>
                <td className="px-2 py-3.5 text-white/60">{team}</td>
                <td className="px-2 py-3.5">
                  <span
                    className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                      status === "Active"
                        ? "bg-signal/[0.12] text-signal"
                        : status === "Invited"
                          ? "bg-[rgba(255,193,7,0.14)] text-[#ffca28]"
                          : "bg-white/[0.08] text-white/50"
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-2 py-3.5 text-white/50">{joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[13px] text-white/40">
        Members are shown by anonymized ID for seat management only.
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-4 text-base font-semibold">Invoices</div>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-white/40">
              <th className="py-3 font-semibold">Date</th>
              <th className="py-3 font-semibold">Amount</th>
              <th className="py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map(([date, amount]) => (
              <tr key={date} className="border-t border-white/[0.05]">
                <td className="py-3.5">{date}</td>
                <td className="py-3.5 tabular-nums">{amount}</td>
                <td className="py-3.5 text-signal">Paid</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-[24px] bg-card p-[26px]">
          <div className="mb-4 text-base font-semibold">Plan</div>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Tier</span>
              <span>Team · $6 / seat / mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Seats</span>
              <span>96 of 120</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Next invoice</span>
              <span>Aug 1, 2026</span>
            </div>
          </div>
          <Link
            href="/pricing"
            className="mt-5 inline-flex h-[42px] items-center rounded-[21px] border border-white/15 px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/5"
          >
            Change plan
          </Link>
        </div>
      </div>
    </div>
  );
}
