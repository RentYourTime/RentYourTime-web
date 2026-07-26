import { FOUNDER_COMPARISON_COLUMNS, FOUNDER_COMPARISON_ROWS } from "@/lib/founderContent";

function Cell({ value }: { value: string }) {
  if (value === "✓") return <span className="text-center text-signal">✓</span>;
  if (value === "—") return <span className="text-center text-white/25">—</span>;
  return <span className="text-center text-white/70">{value}</span>;
}

/**
 * Responsive via horizontal scroll inside its own container (never the page
 * body) — same pattern already used by `WaitlistTable`/`AdminClient` tables
 * elsewhere in this app, chosen over an accordion to stay consistent with
 * the existing architecture.
 */
export function FounderComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-white/[0.08]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-white/[0.02] text-[11px] uppercase tracking-[0.06em] text-white/40">
            <th className="px-4 py-3.5 font-semibold">Feature</th>
            {FOUNDER_COMPARISON_COLUMNS.map((c) => (
              <th key={c} className="px-4 py-3.5 text-center font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FOUNDER_COMPARISON_ROWS.map(([label, first, gold, black]) => (
            <tr key={label} className="border-t border-white/[0.05]">
              <td className="px-4 py-3 text-white/70">{label}</td>
              <td className="px-4 py-3">
                <Cell value={first} />
              </td>
              <td className="px-4 py-3">
                <Cell value={gold} />
              </td>
              <td className="px-4 py-3">
                <Cell value={black} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
