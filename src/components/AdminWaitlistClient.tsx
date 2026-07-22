"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";
import { WaitlistTable } from "@/components/WaitlistTable";
import type { SerializedWaitlistRecord, WaitlistStatus } from "@/lib/waitlist";

const TOKEN_KEY = "ryt-auth-token";

type Gate = "checking" | "denied" | "granted";

interface Stats {
  total: number;
  new: number;
  website: number;
  discord: number;
}

const STAT_CARDS = [
  { key: "total", label: "Total", classes: "border-white/[0.08] bg-[#161616]", valueClass: "text-white" },
  {
    key: "new",
    label: "New (7d)",
    classes: "border-[rgba(0,230,118,0.2)] bg-[rgba(0,230,118,0.06)]",
    valueClass: "text-signal",
  },
  { key: "website", label: "Website", classes: "border-white/[0.08] bg-[#161616]", valueClass: "text-white" },
  { key: "discord", label: "Discord", classes: "border-white/[0.08] bg-[#161616]", valueClass: "text-white" },
] as const;

function StatCard({
  label,
  value,
  classes,
  valueClass,
}: {
  label: string;
  value: number;
  classes: string;
  valueClass: string;
}) {
  return (
    <div className={`rounded-[18px] border px-5 py-[18px] ${classes}`}>
      <div className="text-[11px] uppercase tracking-[0.06em] text-white/40">{label}</div>
      <div className={`mt-2 text-[28px] font-bold tabular-nums tracking-[-0.02em] ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

export function AdminWaitlistClient() {
  const [gate, setGate] = useState<Gate>("checking");
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<SerializedWaitlistRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(50);

  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (options.body) headers["Content-Type"] = "application/json";
      const res = await fetch(`/api/${path}`, { ...options, headers });
      const data = await res.json().catch(() => {
        throw new Error("Invalid server response");
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    [token]
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!stored) {
      setGate("denied");
      return;
    }
    setToken(stored);
    fetch("/api/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setGate(data?.ok && data.user?.role === "ADMIN" ? "granted" : "denied"))
      .catch(() => setGate("denied"));
  }, []);

  const load = useCallback(async () => {
    if (gate !== "granted") return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (source) params.set("source", source);
      if (status) params.set("status", status);
      params.set("limit", String(limit));
      const data = await api(`admin/waitlist?${params.toString()}`);
      setStats(data.stats);
      setRecords(data.records);
      setTotal(data.total);
    } catch {
      setError("Couldn't load the waitlist.");
    } finally {
      setLoading(false);
    }
  }, [gate, api, search, source, status, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSetStatus(id: string, newStatus: WaitlistStatus) {
    setBusyId(id);
    try {
      await api(`admin/waitlist/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch {
      setError("Couldn't update that signup.");
    } finally {
      setBusyId(null);
    }
  }

  async function onAddNote(id: string) {
    const note = window.prompt("Note for this signup:");
    if (note === null) return;
    setBusyId(id);
    try {
      await api(`admin/waitlist/${id}`, { method: "PATCH", body: JSON.stringify({ notes: note }) });
      await load();
    } catch {
      setError("Couldn't save that note.");
    } finally {
      setBusyId(null);
    }
  }

  async function onExport() {
    try {
      const res = await fetch("/api/admin/waitlist/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "waitlist-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't export the CSV.");
    }
  }

  if (gate === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-white/40">
        Checking access…
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-24 text-center">
        <p className="text-[15px] text-white/50">You need an admin account to view this page.</p>
        <Link
          href="/account"
          className="mt-4 inline-block text-[13px] font-semibold text-signal underline"
        >
          Go to your account
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav
        aria-label="Admin navigation"
        className="flex h-[87px] items-center justify-between border-b border-white/[0.06] px-6 max-[600px]:h-[70px] sm:px-12"
      >
        <div className="flex items-center gap-3.5">
          <Wordmark href="/" />
          <span className="rounded-md border border-white/[0.12] px-2 py-[3px] text-[11px] font-bold tracking-[0.08em] text-white/40">
            ADMIN
          </span>
        </div>
        <Link href="/account" className="text-sm text-white/50 no-underline">
          ← Back to account
        </Link>
      </nav>

      <main className="px-6 py-10 sm:px-12">
        <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold tracking-[-0.02em]">Waitlist</h1>
            <p className="mt-1.5 text-[13px] text-white/40">Signups, status tracking and export.</p>
          </div>
          <button
            type="button"
            onClick={onExport}
            className="h-10 rounded-full border border-white/[0.12] px-[18px] text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06]"
          >
            Export CSV
          </button>
        </div>

        {stats && (
          <div className="mb-7 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {STAT_CARDS.map((card) => (
              <StatCard
                key={card.key}
                label={card.label}
                value={stats[card.key]}
                classes={card.classes}
                valueClass={card.valueClass}
              />
            ))}
          </div>
        )}

        <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] max-w-[320px] flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-white/35">
              🔍
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email…"
              aria-label="Search by email"
              className="h-[42px] w-full rounded-full border border-white/[0.08] bg-white/5 pl-[34px] pr-4 text-[13px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
            />
          </div>
          <div className="relative">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label="Filter by source"
              className="h-[42px] cursor-pointer appearance-none rounded-full border border-white/[0.08] bg-white/5 pl-3.5 pr-[34px] text-[13px] text-white outline-none"
            >
              <option value="">All sources</option>
              <option value="WEBSITE">Website</option>
              <option value="DISCORD">Discord</option>
              <option value="MANUAL">Manual</option>
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-white/40">
              ▼
            </span>
          </div>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
              className="h-[42px] cursor-pointer appearance-none rounded-full border border-white/[0.08] bg-white/5 pl-3.5 pr-[34px] text-[13px] text-white outline-none"
            >
              <option value="">All statuses</option>
              {(["NEW", "CONTACTED", "INVITED", "CONVERTED", "UNSUBSCRIBED"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-white/40">
              ▼
            </span>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-[13px] text-[#ff8a84]" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-center text-[13px] text-white/40">Loading…</p>
        ) : (
          <>
            <WaitlistTable
              records={records}
              busyId={busyId}
              onSetStatus={onSetStatus}
              onAddNote={onAddNote}
            />
            {records.length < total && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + 50)}
                  className="rounded-full border border-white/10 px-4 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/5"
                >
                  Load more · {records.length} of {total.toLocaleString("en-US")}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
