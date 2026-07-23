"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Self-contained, no-login, no-backend mockup of the "Support the project"
 * screen — lets anyone see the real flow's UI/UX (percentage → amount →
 * "Contribute" → confirming → confirmed → history) without a Stripe account,
 * an authenticated session, or real accrued-rent data. Nothing here calls
 * `/api/contributions/*` — see `src/components/panel/PanelClient.tsx`'s
 * `ContributeTab` for the real, backend-wired version at `/panel`.
 */

const PERCENTAGES = [5, 10, 25, 50, 75, 100] as const;

const MOCK_DEBT_CENTS = 2840;

interface DemoContribution {
  id: string;
  date: string;
  percentage: number;
  amountCents: number;
}

const INITIAL_HISTORY: DemoContribution[] = [
  { id: "d1", date: "Jul 1, 2026", percentage: 10, amountCents: 284 },
  { id: "d2", date: "Jun 1, 2026", percentage: 10, amountCents: 310 },
  { id: "d3", date: "May 1, 2026", percentage: 25, amountCents: 666 },
];

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

type FlowState = "idle" | "redirecting" | "confirming" | "confirmed";

export function SupportProjectDemo() {
  const [pct, setPct] = useState<(typeof PERCENTAGES)[number]>(10);
  const [flow, setFlow] = useState<FlowState>("idle");
  const [history, setHistory] = useState<DemoContribution[]>(INITIAL_HISTORY);

  const amountCents = Math.round((MOCK_DEBT_CENTS * pct) / 100);
  const totalContributedCents = history.reduce((sum, c) => sum + c.amountCents, 0);

  function onContribute() {
    if (flow !== "idle") return;
    setFlow("redirecting");
    // Simulates: redirect to Stripe Checkout -> webhook confirms payment.
    setTimeout(() => setFlow("confirming"), 900);
    setTimeout(() => {
      setHistory((prev) => [
        { id: `d${Date.now()}`, date: "Today", percentage: pct, amountCents },
        ...prev,
      ]);
      setFlow("confirmed");
    }, 2200);
  }

  function reset() {
    setFlow("idle");
    setHistory(INITIAL_HISTORY);
    setPct(10);
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav
        aria-label="Demo navigation"
        className="flex h-[87px] items-center justify-between border-b border-white/[0.06] px-6 max-[600px]:h-[70px] sm:px-12"
      >
        <div className="flex items-center gap-3.5">
          <Link href="/" className="text-[18px] font-bold tracking-[-0.02em] text-white no-underline">
            rentyourtime<span className="text-signal">.</span>
          </Link>
          <span className="rounded-md border border-white/[0.12] px-2 py-[3px] text-[11px] font-bold tracking-[0.08em] text-white/40">
            DEMO
          </span>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/panel" className="text-white/50 no-underline hover:text-white">
            Open your real dashboard →
          </Link>
        </div>
      </nav>

      <main className="flex justify-center px-6 py-14 sm:px-12">
        <div className="w-full max-w-[900px]">
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-[13px] leading-[1.5] text-white/55">
            This is a mockup — no Stripe account is used and no real payment happens. Numbers
            below are fake. The real, Stripe-backed version lives at{" "}
            <Link href="/panel" className="text-signal">
              /panel → Support the project
            </Link>
            .
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="rounded-[24px] bg-card p-[30px]">
              <h2 className="m-0 text-2xl tracking-[-0.02em]">
                Support the project<span className="text-signal">.</span>
              </h2>
              <p className="m-0 mt-3 max-w-[520px] text-[15px] leading-[1.6] text-white/55">
                Your rent is virtual — you never owe it. If RentYourTime helps you, you can choose
                to contribute a share of your accrued rent to keep it running and independent.
                Entirely optional.
              </p>

              {flow === "confirming" && (
                <div className="mt-5 rounded-2xl bg-signal/[0.08] px-4 py-3 text-[13px] text-signal" role="status">
                  Payment is being confirmed…
                </div>
              )}
              {flow === "confirmed" && (
                <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-signal/[0.08] px-4 py-3 text-[13px] text-signal" role="status">
                  <span>Thank you — your contribution is confirmed.</span>
                  <button type="button" onClick={reset} className="shrink-0 font-semibold underline">
                    Reset demo
                  </button>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between rounded-2xl bg-ink px-5 py-[18px]">
                <span className="text-sm text-white/55">Accrued rent this month</span>
                <span className="text-2xl font-bold tabular-nums">{formatCents(MOCK_DEBT_CENTS)}</span>
              </div>

              <div className="mb-2.5 mt-[22px] text-[13px] font-semibold text-white/50">
                I’d like to contribute
              </div>
              <div className="flex flex-wrap gap-2.5">
                {PERCENTAGES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPct(p)}
                    disabled={flow !== "idle"}
                    className={`h-[42px] rounded-[21px] border px-[22px] text-[15px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
                    {formatCents(amountCents)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onContribute}
                  disabled={flow !== "idle"}
                  className="h-[52px] rounded-[26px] border-0 bg-signal px-7 text-[15px] font-semibold text-sig-ink transition-transform duration-150 ease-spring active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                >
                  {flow === "idle" && `Contribute ${formatCents(amountCents)}`}
                  {flow === "redirecting" && "Redirecting to Stripe…"}
                  {flow === "confirming" && "Waiting for confirmation…"}
                  {flow === "confirmed" && "Contributed ✓"}
                </button>
              </div>

              <div className="mt-3.5 text-xs leading-[1.5] text-white/40">
                One-time optional contribution. Does not unlock features. Does not reduce or
                settle virtual rent. See the{" "}
                <Link href="/terms" className="text-signal">
                  Terms
                </Link>
                .
              </div>
            </div>

            <div className="rounded-[24px] bg-card p-[26px]">
              <div className="mb-4 text-base font-semibold">Your contributions</div>
              {history.length === 0 ? (
                <p className="text-sm text-white/40">You haven’t contributed yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between border-b border-white/[0.06] pb-3 last:border-0"
                    >
                      <div>
                        <div className="text-sm">{c.date}</div>
                        <div className="text-xs text-white/40">{c.percentage}% of rent</div>
                      </div>
                      <b className="font-semibold tabular-nums text-signal">
                        {formatCents(c.amountCents)}
                      </b>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5 rounded-2xl bg-ink p-4 text-center">
                <div className="text-xs text-white/45">Contributed so far</div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatCents(totalContributedCents)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
