"use client";

import type { SerializedWaitlistRecord, WaitlistStatus } from "@/lib/waitlist";

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INVITED: "Invited",
  CONVERTED: "Converted",
  UNSUBSCRIBED: "Unsubscribed",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function WaitlistTable({
  records,
  busyId,
  onSetStatus,
  onAddNote,
}: {
  records: SerializedWaitlistRecord[];
  busyId: string | null;
  onSetStatus: (id: string, status: WaitlistStatus) => void;
  onAddNote: (id: string) => void;
}) {
  if (records.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-white/40">
        No signups match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-white/40">
            <th className="py-2 pr-4 font-semibold">Email</th>
            <th className="py-2 pr-4 font-semibold">Source</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 pr-4 font-semibold">Date</th>
            <th className="py-2 pr-4 font-semibold">Discord</th>
            <th className="py-2 pr-4 font-semibold">Email</th>
            <th className="py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.05] align-top">
              <td className="py-2.5 pr-4 text-white">{r.email}</td>
              <td className="py-2.5 pr-4 text-white/60">{r.source}</td>
              <td className="py-2.5 pr-4 text-white/60">{STATUS_LABELS[r.status]}</td>
              <td className="py-2.5 pr-4 text-white/40">{formatDate(r.created_at)}</td>
              <td className="py-2.5 pr-4">
                {r.notified ? (
                  <span className="text-signal">✓</span>
                ) : (
                  <span className="text-white/25">—</span>
                )}
              </td>
              <td className="py-2.5 pr-4">
                {r.confirmation_sent ? (
                  <span className="text-signal">✓</span>
                ) : (
                  <span className="text-white/25">—</span>
                )}
              </td>
              <td className="py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {(["CONTACTED", "INVITED", "CONVERTED"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busyId === r.id || r.status === s}
                      onClick={() => onSetStatus(r.id, s)}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => onAddNote(r.id)}
                    className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Note
                  </button>
                </div>
                {r.notes && (
                  <p className="mt-1.5 max-w-[220px] truncate text-[11px] text-white/35">
                    {r.notes}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
