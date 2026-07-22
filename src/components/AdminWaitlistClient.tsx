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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
      <div className="text-[22px] font-bold text-white">{value}</div>
      <div className="text-[12px] text-white/40">{label}</div>
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
        <Wordmark href="/" />
        <Link href="/account" className="text-sm text-white/50 no-underline">
          ← Back to account
        </Link>
      </nav>

      <main className="px-6 py-12 sm:px-12">
        <h1 className="mb-6 text-[28px] tracking-[-0.02em]">Waitlist</h1>

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="New" value={stats.new} />
            <StatCard label="Website" value={stats.website} />
            <StatCard label="Discord" value={stats.discord} />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email…"
            aria-label="Search by email"
            className="h-10 rounded-full border-0 bg-white/[0.07] px-4 text-[13px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label="Filter by source"
            className="h-10 rounded-full border-0 bg-white/[0.07] px-3 text-[13px] text-white outline-none"
          >
            <option value="">All sources</option>
            <option value="WEBSITE">Website</option>
            <option value="DISCORD">Discord</option>
            <option value="MANUAL">Manual</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="h-10 rounded-full border-0 bg-white/[0.07] px-3 text-[13px] text-white outline-none"
          >
            <option value="">All statuses</option>
            {(["NEW", "CONTACTED", "INVITED", "CONVERTED", "UNSUBSCRIBED"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onExport}
            className="ml-auto h-10 rounded-full border border-white/10 px-4 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/5"
          >
            Export CSV
          </button>
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
                  Load more ({records.length} of {total})
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
