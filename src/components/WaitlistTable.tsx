"use client";

import type { SerializedWaitlistRecord, WaitlistStatus } from "@/lib/waitlist";

const STATUS_STYLES: Record<WaitlistStatus, { label: string; className: string }> = {
  NEW: {
    label: "New",
    className: "text-signal bg-[rgba(0,230,118,0.12)] border-[rgba(0,230,118,0.3)]",
  },
  CONTACTED: {
    label: "Contacted",
    className: "text-[#8ab4ff] bg-[rgba(138,180,255,0.12)] border-[rgba(138,180,255,0.3)]",
  },
  INVITED: {
    label: "Invited",
    className: "text-[#ffd166] bg-[rgba(255,209,102,0.12)] border-[rgba(255,209,102,0.3)]",
  },
  CONVERTED: {
    label: "Converted",
    className: "text-white bg-white/10 border-white/25",
  },
  UNSUBSCRIBED: {
    label: "Unsubscribed",
    className: "text-[#ff8a84] bg-[rgba(255,138,132,0.12)] border-[rgba(255,138,132,0.3)]",
  },
};

const ACTION_LABELS: Record<"CONTACTED" | "INVITED" | "CONVERTED", string> = {
  CONTACTED: "Contacted",
  INVITED: "Invited",
  CONVERTED: "Converted",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Mark({ on }: { on: boolean }) {
  return on ? (
    <span className="text-[15px] text-signal">✓</span>
  ) : (
    <span className="text-white/25">—</span>
  );
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
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.08]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-white/[0.02] text-[11px] uppercase tracking-[0.05em] text-white/40">
              <th className="px-4 py-3.5 font-semibold">Email</th>
              <th className="px-4 py-3.5 font-semibold">Source</th>
              <th className="px-4 py-3.5 font-semibold">Status</th>
              <th className="px-4 py-3.5 font-semibold">Date</th>
              <th className="px-4 py-3.5 text-center font-semibold">Notified</th>
              <th className="px-4 py-3.5 text-center font-semibold">Confirmed</th>
              <th className="px-4 py-3.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                  No signups match these filters.
                </td>
              </tr>
            )}
            {records.map((r) => {
              const statusStyle = STATUS_STYLES[r.status];
              return (
                <tr
                  key={r.id}
                  className="border-t border-white/[0.05] align-middle transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3.5 text-white">{r.email}</td>
                  <td className="px-4 py-3.5 text-white/55">{r.source}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle.className}`}
                    >
                      {statusStyle.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-white/40">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Mark on={r.notified} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Mark on={r.confirmation_sent} />
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {(["CONTACTED", "INVITED", "CONVERTED"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busyId === r.id || r.status === s}
                          onClick={() => onSetStatus(r.id, s)}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {ACTION_LABELS[s]}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => onAddNote(r.id)}
                        className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Note
                      </button>
                    </div>
                    {r.notes && (
                      <p className="mt-2 max-w-[240px] truncate text-[11px] text-white/35">
                        📝 {r.notes}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
