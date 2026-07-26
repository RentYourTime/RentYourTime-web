"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";

const TOKEN_KEY = "ryt-auth-token";

type Gate = "checking" | "denied" | "granted";
type Tab = "overview" | "users" | "subscriptions" | "founders" | "system";

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_pro: boolean;
  is_active: boolean;
  created_at: string;
}

interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  proUsers: number;
  freeUsers: number;
  teamAdmins: number;
}

interface WaitlistStats {
  total: number;
  new: number;
}

const NAV: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "User accounts" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "founders", label: "Founder Program" },
  { key: "system", label: "System" },
];

const TITLES: Record<Tab, string> = {
  overview: "Platform overview",
  users: "User accounts",
  subscriptions: "Subscriptions",
  founders: "Founder Program",
  system: "System",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function AdminClient() {
  const [gate, setGate] = useState<Gate>("checking");
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

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
        <Link href="/account" className="mt-4 inline-block text-[13px] font-semibold text-signal underline">
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
          ADMIN PANEL
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
          <Link
            href="/admin/waitlist"
            className="h-[42px] rounded-xl px-3.5 text-left text-sm font-semibold leading-[42px] text-white/55 no-underline transition-colors hover:bg-white/5 hover:text-white"
          >
            Waitlist →
          </Link>
        </nav>
        <Link
          href="/account"
          className="mt-auto rounded-2xl bg-card p-3 text-[13px] font-semibold text-white/60 no-underline transition-colors hover:text-white"
        >
          ← Back to account
        </Link>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-7 py-[22px]">
          <h1 className="m-0 text-[23px] font-bold tracking-[-0.02em]">{TITLES[tab]}</h1>
          <span className="inline-flex h-7 items-center rounded-full bg-signal/[0.12] px-3 text-xs font-bold tracking-[0.04em] text-signal">
            FULL ACCESS
          </span>
        </header>
        <div className="flex-1 overflow-y-auto p-7">
          {tab === "overview" && <OverviewTab token={token} />}
          {tab === "users" && <UsersTab token={token} />}
          {tab === "subscriptions" && <SubscriptionsTab token={token} />}
          {tab === "founders" && <FoundersTab token={token} />}
          {tab === "system" && <SystemTab />}
        </div>
      </main>
    </div>
  );
}

function useOverview(token: string) {
  const [users, setUsers] = useState<OverviewStats | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!data.ok) throw new Error();
        setUsers(data.users);
        setWaitlist(data.waitlist);
      })
      .catch(() => setError("Couldn't load platform stats."));
  }, [token]);

  return { users, waitlist, error };
}

function Tile({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="rounded-[20px] bg-card p-5">
      <div className="text-[13px] text-white/50">{label}</div>
      <div className={`mt-2 text-[30px] font-bold tabular-nums ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
}

function OverviewTab({ token }: { token: string }) {
  const { users, waitlist, error } = useOverview(token);

  if (error) return <p className="text-[13px] text-[#ff8a84]">{error}</p>;
  if (!users || !waitlist) return <p className="text-[13px] text-white/40">Loading…</p>;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Total users" value={users.totalUsers} />
        <Tile label="Active" value={users.activeUsers} valueClass="text-signal" />
        <Tile label="Suspended" value={users.suspendedUsers} valueClass="text-[#ff6b60]" />
        <Tile label="Pro subscribers" value={users.proUsers} />
        <Tile label="Free users" value={users.freeUsers} />
        <Tile label="Team admins" value={users.teamAdmins} />
        <Tile label="Waitlist" value={waitlist.total.toLocaleString("en-US")} />
        <Tile label="Waitlist (7d)" value={waitlist.new} valueClass="text-signal" />
      </div>
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="text-base font-semibold">Manage the platform</div>
        <p className="m-0 mb-4 mt-2 max-w-[560px] text-sm leading-[1.55] text-white/50">
          Search, suspend, or review any account from <b className="font-semibold text-white">User accounts</b>.
        </p>
      </div>
    </div>
  );
}

interface ConfirmState {
  type: "one" | "bulk";
  id?: string;
  label: string;
}

function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      setUsers(data.users);
      setTotal(data.total);
      setSelected((s) => s.filter((id) => data.users.some((u: AdminUser) => u.id === id)));
    } catch {
      setError("Couldn't load user accounts.");
    } finally {
      setLoading(false);
    }
  }, [token, query]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function onToggleSuspend(u: AdminUser) {
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: u.is_active ? "suspend" : "restore" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error();
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: data.user.is_active } : x)));
    } catch {
      setError("Couldn't update that account.");
    } finally {
      setBusyId(null);
    }
  }

  function doConfirmedRemoval() {
    if (!confirm) return;
    if (confirm.type === "one" && confirm.id) {
      setUsers((prev) => prev.filter((u) => u.id !== confirm.id));
      setSelected((s) => s.filter((id) => id !== confirm.id));
    } else {
      setUsers((prev) => prev.filter((u) => !selected.includes(u.id)));
      setSelected([]);
    }
    setConfirm(null);
  }

  const allSelected = users.length > 0 && users.every((u) => selected.includes(u.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email…"
          aria-label="Search users"
          className="h-11 w-[280px] max-w-full rounded-full border border-white/10 bg-card px-[18px] text-sm text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
        />
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => setConfirm({ type: "bulk", label: `${selected.length} account${selected.length === 1 ? "" : "s"}` })}
          className="h-11 rounded-full border border-rent/50 bg-transparent px-5 text-sm font-semibold text-[#ff6b60] transition-colors hover:bg-rent/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete selected ({selected.length})
        </button>
      </div>

      {error && <p className="text-[13px] text-[#ff8a84]">{error}</p>}

      <div className="overflow-x-auto rounded-[24px] bg-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-white/40">
              <th className="w-9 px-3 py-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? users.map((u) => u.id) : [])}
                  aria-label="Select all"
                  className="h-4 w-4 accent-signal"
                />
              </th>
              <th className="px-2 py-4 font-semibold">Email</th>
              <th className="px-2 py-4 font-semibold">Plan</th>
              <th className="px-2 py-4 font-semibold">Status</th>
              <th className="px-2 py-4 font-semibold">Joined</th>
              <th className="px-2 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  {query ? `No users match “${query}”.` : "No users yet."}
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/[0.05]">
                <td className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, u.id] : s.filter((id) => id !== u.id)))
                    }
                    aria-label={`Select ${u.email}`}
                    className="h-4 w-4 accent-signal"
                  />
                </td>
                <td className="px-2 py-3.5 font-medium">{u.email}</td>
                <td className="px-2 py-3.5">
                  <span
                    className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                      u.is_pro ? "bg-signal/[0.12] text-signal" : "bg-white/[0.08] text-white/55"
                    }`}
                  >
                    {u.is_pro ? "Pro" : "Free"}
                  </span>
                </td>
                <td className="px-2 py-3.5">
                  <span
                    className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                      u.is_active ? "bg-signal/[0.12] text-signal" : "bg-[rgba(255,193,7,0.14)] text-[#ffca28]"
                    }`}
                  >
                    {u.is_active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-2 py-3.5 text-white/50">{formatDate(u.created_at)}</td>
                <td className="px-2 py-3.5">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => onToggleSuspend(u)}
                      className="h-8 rounded-2xl border border-white/15 px-3.5 text-[13px] font-semibold text-white/75 transition-colors hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-50"
                    >
                      {u.is_active ? "Suspend" : "Restore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ type: "one", id: u.id, label: u.email })}
                      className="h-8 rounded-2xl border border-rent/45 px-3.5 text-[13px] font-semibold text-[#ff6b60] transition-colors hover:bg-rent/10"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[13px] text-white/40">
        Showing {users.length} of {total.toLocaleString("en-US")}. Deleting an account erases
        personal data immediately and from backups within 30 days, per the{" "}
        <Link href="/privacy" className="text-signal">
          Privacy Policy
        </Link>
        .
      </div>

      {confirm && (
        <div
          onClick={() => setConfirm(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(5,7,9,0.82)] p-6 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(440px,92vw)] rounded-[20px] border border-rent/25 bg-[#141414] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
          >
            <div className="text-xl font-bold tracking-[-0.01em]">Delete {confirm.label}?</div>
            <p className="m-0 mb-[22px] mt-3 text-[15px] leading-[1.6] text-white/55">
              Permanent deletion isn&rsquo;t wired up on the site yet — this removes the row from
              your current view only. Ask an engineer to enable real deletion when you&rsquo;re
              ready to ship it.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doConfirmedRemoval}
                className="h-11 rounded-full border-0 bg-[#ff3b30] px-[22px] text-sm font-semibold text-white transition-transform active:scale-[0.97]"
              >
                Remove from view
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionsTab({ token }: { token: string }) {
  const { users, error } = useOverview(token);

  if (error) return <p className="text-[13px] text-[#ff8a84]">{error}</p>;
  if (!users) return <p className="text-[13px] text-white/40">Loading…</p>;

  return (
    <div className="grid max-w-[900px] grid-cols-2 gap-4 sm:grid-cols-3">
      <Tile label="Pro subscribers" value={users.proUsers} valueClass="text-signal" />
      <Tile label="Free users" value={users.freeUsers} />
      <Tile
        label="Pro share"
        value={`${users.totalUsers ? Math.round((users.proUsers / users.totalUsers) * 100) : 0}%`}
      />
    </div>
  );
}

interface AdminFounderTier {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  totalQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  isSoldOut: boolean;
  isActive: boolean;
}

interface AdminFounderPurchase {
  id: string;
  email: string;
  tierSlug: string;
  tierName: string;
  founderNumberFormatted: string | null;
  amountCents: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  discordSyncStatus: string;
  purchasedAt: string;
}

interface FounderBlackKitDetail {
  fullName: string | null;
  shippingAddress: string | null;
  country: string | null;
  shirtSize: string | null;
  cardStatus: string;
  certificateStatus: string;
  letterStatus: string;
  shirtStatus: string;
  trackingNumber: string | null;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: currency.toUpperCase() });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

const KIT_FIELDS: { field: "cardStatus" | "certificateStatus" | "letterStatus" | "shirtStatus"; apiField: string; label: string }[] = [
  { field: "cardStatus", apiField: "card_status", label: "Card" },
  { field: "certificateStatus", apiField: "certificate_status", label: "Certificate" },
  { field: "letterStatus", apiField: "letter_status", label: "Letter" },
  { field: "shirtStatus", apiField: "shirt_status", label: "Shirt" },
];

function KitPanel({ purchaseId, token }: { purchaseId: string; token: string }) {
  const [kit, setKit] = useState<FounderBlackKitDetail | null | undefined>(undefined);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/founders/purchases/${purchaseId}/kit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setKit(res.ok && data.ok ? data.data : null);
  }, [purchaseId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(apiField: string, status: string) {
    await fetch(`/api/admin/founders/purchases/${purchaseId}/kit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ field: apiField, status }),
    });
    void load();
  }

  async function setTracking() {
    const trackingNumber = window.prompt("Tracking number:");
    if (!trackingNumber) return;
    await fetch(`/api/admin/founders/purchases/${purchaseId}/tracking`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackingNumber }),
    });
    void load();
  }

  if (kit === undefined) return <p className="p-4 text-[13px] text-white/40">Loading kit details…</p>;
  if (kit === null) {
    return <p className="p-4 text-[13px] text-white/40">The buyer hasn&rsquo;t submitted shipping details yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-ink p-4">
      <div className="grid grid-cols-1 gap-2 text-[13px] text-white/70 sm:grid-cols-2">
        <div>
          <span className="text-white/40">Name: </span>
          {kit.fullName}
        </div>
        <div>
          <span className="text-white/40">Country: </span>
          {kit.country}
        </div>
        <div className="sm:col-span-2">
          <span className="text-white/40">Address: </span>
          {kit.shippingAddress}
        </div>
        <div>
          <span className="text-white/40">Shirt size: </span>
          {kit.shirtSize}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {KIT_FIELDS.map(({ field, apiField, label }) => (
          <div key={field} className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2 py-1">
            <span className="text-[12px] text-white/50">{label}</span>
            <select
              value={kit[field]}
              onChange={(e) => setStatus(apiField, e.target.value)}
              className="rounded-full border-0 bg-transparent text-[12px] font-semibold text-white outline-none"
            >
              <option value="pending">Pending</option>
              <option value="prepared">Prepared</option>
              <option value="shipped">Shipped</option>
            </select>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[13px]">
        <span className="text-white/40">Tracking:</span>
        <span className="text-white">{kit.trackingNumber || "—"}</span>
        <button type="button" onClick={setTracking} className="text-signal underline">
          {kit.trackingNumber ? "Update" : "Add"}
        </button>
      </div>
    </div>
  );
}

function FoundersTab({ token }: { token: string }) {
  const [tiers, setTiers] = useState<AdminFounderTier[]>([]);
  const [purchases, setPurchases] = useState<AdminFounderPurchase[]>([]);
  const [tierFilter, setTierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadTiers = useCallback(async () => {
    const res = await fetch("/api/admin/founders/tiers", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (res.ok && data.ok) setTiers(data.tiers);
  }, [token]);

  const loadPurchases = useCallback(async () => {
    const params = new URLSearchParams();
    if (tierFilter) params.set("tier", tierFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/founders/purchases?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.ok) setPurchases(data.purchases);
    else setError("Couldn't load Founder purchases.");
  }, [token, tierFilter, statusFilter, search]);

  useEffect(() => {
    if (!token) return;
    void loadTiers();
  }, [token, loadTiers]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(loadPurchases, 200);
    return () => clearTimeout(t);
  }, [token, loadPurchases]);

  async function toggleActive(tier: AdminFounderTier) {
    await fetch(`/api/admin/founders/tiers/${tier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: tier.isActive ? "deactivate" : "activate" }),
    });
    void loadTiers();
  }

  async function changeLimit(tier: AdminFounderTier) {
    const input = window.prompt(`New limit for ${tier.name} (currently ${tier.totalQuantity}, sold ${tier.soldQuantity}):`, String(tier.totalQuantity));
    if (input === null) return;
    const totalQuantity = Number(input);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 0) return;
    const res = await fetch(`/api/admin/founders/tiers/${tier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ totalQuantity }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      window.alert(data.error === "below_sold_quantity" ? "Can't set the limit below the number already sold." : "Couldn't update the limit.");
    }
    void loadTiers();
  }

  async function onExport() {
    const res = await fetch("/api/admin/founders/export", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "founder-purchases.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 text-base font-semibold">Tiers</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.id} className="rounded-[20px] bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t.name}</div>
                <span
                  className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold ${
                    t.isActive ? "bg-signal/[0.12] text-signal" : "bg-white/10 text-white/50"
                  }`}
                >
                  {t.isActive ? "ACTIVE" : "OFF"}
                </span>
              </div>
              <div className="mt-2 text-[13px] text-white/50">{formatMoney(t.priceCents, t.currency)} one-time</div>
              <div className="mt-2 text-[13px]">
                <span className={t.isSoldOut ? "text-[#ff6b60]" : "text-white/70"}>
                  {t.soldQuantity} / {t.totalQuantity} sold
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleActive(t)}
                  className="h-8 rounded-full border border-white/15 px-3 text-[12px] font-semibold text-white/75 hover:bg-white/[0.06]"
                >
                  {t.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => changeLimit(t)}
                  className="h-8 rounded-full border border-white/15 px-3 text-[12px] font-semibold text-white/75 hover:bg-white/[0.06]"
                >
                  Change limit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-base font-semibold">Purchases</div>
          <button
            type="button"
            onClick={onExport}
            className="h-9 rounded-full border border-white/[0.12] px-4 text-[13px] font-semibold text-white/80 hover:bg-white/[0.06]"
          >
            Export CSV
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email…"
            className="h-10 w-[220px] rounded-full border border-white/10 bg-card px-4 text-[13px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-10 rounded-full border border-white/10 bg-card px-3 text-[13px] text-white outline-none"
          >
            <option value="">All tiers</option>
            <option value="founder-first">Founder First</option>
            <option value="founder-gold">Founder Gold</option>
            <option value="founder-black">Founder Black</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-full border border-white/10 bg-card px-3 text-[13px] text-white outline-none"
          >
            <option value="">All statuses</option>
            {["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 text-[13px] text-[#ff8a84]">{error}</p>}

        <div className="overflow-x-auto rounded-[24px] bg-card">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.05em] text-white/40">
                <th className="px-4 py-4 font-semibold">Email</th>
                <th className="px-2 py-4 font-semibold">Tier</th>
                <th className="px-2 py-4 font-semibold">#</th>
                <th className="px-2 py-4 font-semibold">Amount</th>
                <th className="px-2 py-4 font-semibold">Payment</th>
                <th className="px-2 py-4 font-semibold">Fulfillment</th>
                <th className="px-2 py-4 font-semibold">Purchased</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                    No purchases match these filters.
                  </td>
                </tr>
              )}
              {purchases.map((p) => (
                <Fragment key={p.id}>
                  <tr
                    className={`border-t border-white/[0.05] ${p.tierSlug === "founder-black" ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
                    onClick={() => p.tierSlug === "founder-black" && setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <td className="px-4 py-3.5 font-medium">{p.email}</td>
                    <td className="px-2 py-3.5">{p.tierName}</td>
                    <td className="px-2 py-3.5 tabular-nums">{p.founderNumberFormatted ?? "—"}</td>
                    <td className="px-2 py-3.5 tabular-nums">{formatMoney(p.amountCents, p.currency)}</td>
                    <td className="px-2 py-3.5">
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${
                          p.paymentStatus === "PAID" ? "bg-signal/[0.12] text-signal" : "bg-white/[0.08] text-white/55"
                        }`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-2 py-3.5 text-white/60">{p.fulfillmentStatus.replace("_", " ")}</td>
                    <td className="px-2 py-3.5 text-white/50">{formatDate(p.purchasedAt)}</td>
                  </tr>
                  {expandedId === p.id && p.tierSlug === "founder-black" && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <KitPanel purchaseId={p.id} token={token} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[13px] text-white/40">Click a Founder Black row to manage its physical kit.</div>
      </div>
    </div>
  );
}

function SystemTab() {
  const [maintenance, setMaintenance] = useState(false);

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-card p-[26px]">
        <div>
          <div className="text-base font-semibold">Maintenance mode</div>
          <div className="mt-0.5 text-[13px] text-white/50">Show a maintenance screen to all users.</div>
        </div>
        <button
          type="button"
          onClick={() => setMaintenance((m) => !m)}
          className="h-10 rounded-[20px] border border-white/15 bg-transparent px-5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
        >
          {maintenance ? "On" : "Off"}
        </button>
      </div>
      <div className="rounded-[24px] bg-card p-[26px]">
        <div className="mb-3.5 text-base font-semibold">Data</div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            className="h-10 rounded-[20px] border border-white/15 bg-transparent px-[18px] text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
          >
            Export all data (CSV)
          </button>
          <button
            type="button"
            className="h-10 rounded-[20px] border border-white/15 bg-transparent px-[18px] text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
          >
            Recompute analytics
          </button>
        </div>
      </div>
      <div className="rounded-[24px] border border-rent/25 bg-card p-[26px]">
        <div className="text-base font-semibold text-[#ff6b60]">Danger zone</div>
        <p className="m-0 mb-4 mt-2 text-sm leading-[1.55] text-white/50">
          Irreversible platform-wide actions. Not wired up yet — these buttons are placeholders.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled
            className="h-10 cursor-not-allowed rounded-[20px] border border-rent/50 bg-transparent px-[18px] text-sm font-semibold text-[#ff6b60] opacity-50"
          >
            Purge waitlist
          </button>
          <button
            type="button"
            disabled
            className="h-10 cursor-not-allowed rounded-[20px] border border-rent/50 bg-transparent px-[18px] text-sm font-semibold text-[#ff6b60] opacity-50"
          >
            Wipe all sessions
          </button>
        </div>
      </div>
    </div>
  );
}
