"use client";

import { useCallback, useEffect, useState } from "react";
import { WaitlistTable } from "@/components/WaitlistTable";
import type { SerializedWaitlistRecord, WaitlistStatus } from "@/lib/waitlist";

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

/**
 * The waitlist admin body — stats, filters, table, export. No auth gate or
 * page chrome of its own, so it can be embedded either inside the standalone
 * `/admin/waitlist` page (which owns the gate) or inside the Account panel's
 * Admin tab (which already knows the caller is an admin before mounting this).
 */
export function AdminWaitlistPanel({ token }: { token: string }) {
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

  const load = useCallback(async () => {
    if (!token) return;
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
  }, [token, api, search, source, status, limit]);

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

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em]">Waitlist</h2>
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
            <option value="TEAMS">Teams pilot</option>
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
          <WaitlistTable records={records} busyId={busyId} onSetStatus={onSetStatus} onAddNote={onAddNote} />
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
    </div>
  );
}
