import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { TeamsPilotForm } from "@/components/TeamsPilotForm";
import { Reveal } from "@/components/motion/Reveal";
import { GlowLayer } from "@/components/motion/GlowLayer";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";

export const metadata: Metadata = {
  title: "RentYourTime for Teams",
  description: "Bring the rent model to your whole company — anonymized, never surveillance.",
};

const cards = [
  {
    n: "01 · PRIVATE",
    h: "Anonymous by default",
    p: "Individual usage never leaves the employee’s phone. Admins only ever see team-level aggregates.",
  },
  {
    n: "02 · RITUAL",
    h: "Shared focus windows",
    p: "Set team-wide allowances and quiet hours so deep work and after-work rest become the default, together.",
  },
  {
    n: "03 · MEASURABLE",
    h: "Calm you can report on",
    p: "A simple dashboard of reclaimed hours and adherence — real evidence your wellbeing program is working.",
  },
];

const stats = [
  { v: "−31%", k: "after-hours pings in the first month", g: true },
  { v: "6.5h", k: "focus reclaimed per person each week", g: false },
  { v: "88%", k: "of invited employees opt in voluntarily", g: false },
];

const adminFeatures = [
  ["SSO & SCIM", "Okta, Google, and Entra provisioning."],
  ["Org allowances", "set defaults per team or let people choose."],
  ["Role-based access", "nobody can drill into a person."],
  ["Aggregate export", "CSV and API for your wellbeing reports."],
  ["Volume pricing", "one invoice, seats you can move."],
  ["Data residency", "EU hosting, DPA on request."],
];

export default function TeamsPage() {
  return (
    <div className="relative [overflow-x:clip]">
      <GlowLayer
        blobs={[
          { top: "-160px", left: "-120px", size: "520px", rgb: "0,230,118", opacity: 0.16 },
          { top: "360px", right: "-160px", size: "560px", rgb: "0,230,118", opacity: 0.07 },
        ]}
      />
      <ScrollProgressBar />

      <div className="relative z-10 mx-auto max-w-[1100px]">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteNav />

        <main id="main">
          <section className="flex flex-wrap items-center gap-12 px-6 py-14 sm:px-12 sm:py-16">
            <div className="flex flex-1 flex-col gap-6 basis-[380px]">
              <Reveal delayMs={0} className="text-[13px] font-semibold tracking-[0.1em] text-signal">
                RENTYOURTIME FOR TEAMS
              </Reveal>
              <Reveal
                as="h1"
                delayMs={68}
                className="m-0 text-[38px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[56px]"
              >
                Give your team
                <br />
                its focus back<span className="text-signal">.</span>
              </Reveal>
              <Reveal delayMs={136} className="m-0 max-w-[460px] text-lg leading-[1.55] text-white/55">
                Bring the rent model to your whole company. Shared allowances and gentle friction
                help people log off — without a manager ever seeing a minute of anyone&rsquo;s
                individual data.
              </Reveal>
              <Reveal delayMs={204} className="flex flex-wrap gap-3">
                <a
                  href="#pilot"
                  className="inline-flex h-[52px] items-center rounded-[26px] bg-signal px-[26px] text-[15px] font-semibold text-sig-ink no-underline transition-transform duration-150 ease-spring hover:scale-[1.03]"
                >
                  Request a pilot
                </a>
                <Link
                  href="/pricing"
                  className="inline-flex h-[52px] items-center rounded-[26px] border border-white/15 px-[26px] text-[15px] font-semibold text-white no-underline transition-colors hover:bg-white/5"
                >
                  See pricing
                </Link>
              </Reveal>
              <Reveal delayMs={272} className="text-[13px] text-white/40">
                Rolling out with focus-first teams · SSO &amp; SOC 2 (in progress) ·{" "}
                <Link href="/privacy" className="font-medium text-signal no-underline hover:underline">
                  privacy-first by design →
                </Link>
              </Reveal>
            </div>

            <Reveal
              delayMs={340}
              className="mx-auto flex w-[320px] flex-none flex-col gap-[18px] rounded-[32px] bg-card p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>TEAM · THIS WEEK</span>
                <b className="inline-flex h-[22px] items-center rounded-full bg-signal/[0.12] px-2.5 text-[11px] font-semibold text-signal">
                  anonymized
                </b>
              </div>
              <div className="rounded-[18px] bg-ink px-[18px] pb-4 pt-[18px]">
                <div className="text-xs text-white/50">Focus time reclaimed / person</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[38px] font-bold tracking-[-0.02em]">6.5h</span>
                  <span className="text-[13px] text-signal">this week</span>
                </div>
              </div>
              <div className="flex flex-col gap-3.5">
                {[
                  ["Focus adherence", "92%", 92],
                  ["Allowance kept", "3.4 / 5 days", 68],
                  ["Voluntary opt-in", "88%", 88],
                ].map(([label, value, pct]) => (
                  <div key={label as string}>
                    <div className="mb-1.5 flex justify-between text-xs text-white/55">
                      <span>{label}</span>
                      <b className="font-semibold text-white">{value}</b>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-signal"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-white/40">
                Aggregates only. No individual data, ever.
              </div>
            </Reveal>
          </section>

          <section className="border-t border-white/[0.06] px-6 py-14 sm:px-12 sm:py-[72px]">
            <Reveal delayMs={0} className="mb-9 max-w-[600px]">
              <div className="text-[13px] font-semibold tracking-[0.1em] text-signal">
                WHY TEAMS USE IT
              </div>
              <h2 className="my-3 text-[32px] tracking-[-0.03em] sm:text-[38px]">
                Calmer teams, without the surveillance.
              </h2>
              <p className="m-0 text-[17px] leading-[1.55] text-white/50">
                Most &ldquo;productivity monitoring&rdquo; tools spy on people. RentYourTime does the
                opposite: it gives everyone the same gentle nudge and shows leadership nothing but
                the anonymized result.
              </p>
            </Reveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {cards.map((c, i) => (
                <Reveal
                  key={c.n}
                  as="article"
                  delayMs={i * 68}
                  className="min-h-[210px] rounded-[24px] bg-card p-[26px] transition-[transform,background-color] duration-300 ease-spring hover:-translate-y-1 hover:bg-[#1a1a1a]"
                >
                  <div className="text-[13px] font-bold tracking-[0.08em] text-signal">{c.n}</div>
                  <h3 className="mb-2.5 mt-[30px] text-[21px] tracking-[-0.02em]">{c.h}</h3>
                  <p className="m-0 text-[15px] leading-[1.55] text-white/50">{c.p}</p>
                </Reveal>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap border-t border-white/[0.06]">
            {stats.map((s, i) => (
              <Reveal
                key={s.k}
                delayMs={i * 68}
                className="flex-1 basis-[220px] border-r border-white/[0.06] px-6 py-7 last:border-r-0 max-[900px]:border-b max-[900px]:border-r-0 sm:px-12"
              >
                <div className={`text-2xl font-bold tabular-nums ${s.g ? "text-signal" : ""}`}>
                  {s.v}
                </div>
                <div className="mt-1 text-[13px] text-white/50">{s.k}</div>
              </Reveal>
            ))}
          </div>

          <section className="border-t border-white/[0.06] px-6 py-14 sm:px-12 sm:py-[72px]">
            <Reveal delayMs={0} className="mb-7 max-w-[600px]">
              <div className="text-[13px] font-semibold tracking-[0.1em] text-signal">
                BUILT FOR ADMINS
              </div>
              <h2 className="my-3 text-[32px] tracking-[-0.03em] sm:text-[38px]">
                Rolls out in an afternoon.
              </h2>
              <p className="m-0 text-[17px] leading-[1.55] text-white/50">
                Everything an IT and People team needs to deploy responsibly, and nothing that turns
                it into a monitoring tool.
              </p>
            </Reveal>
            <Reveal delayMs={68} className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {adminFeatures.map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-signal/[0.12] text-[13px] font-bold text-signal">
                    ✓
                  </span>
                  <span className="text-[15px] leading-[1.5] text-white/65">
                    <b className="font-semibold text-white">{title}</b> — {desc}
                  </span>
                </div>
              ))}
            </Reveal>
            <Reveal delayMs={136} className="mt-[26px] text-sm text-white/40">
              Want the specifics on what admins can and can&rsquo;t see? Read our{" "}
              <Link href="/privacy" className="font-medium text-signal no-underline hover:underline">
                privacy policy →
              </Link>
            </Reveal>
          </section>

          <Reveal
            as="section"
            id="pilot"
            delayMs={0}
            className="border-t border-white/[0.06] px-6 py-16 sm:px-12"
          >
            <div className="rounded-[28px] bg-gradient-to-br from-[#141a16] to-[#101210] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,230,118,0.12)] sm:p-12">
              <div className="max-w-[520px]">
                <h2 className="m-0 text-[28px] leading-[1.1] tracking-[-0.03em] sm:text-[34px]">
                  Bring rent to your team<span className="text-signal">.</span>
                </h2>
                <p className="m-0 mt-3.5 text-[17px] leading-[1.55] text-white/55">
                  Start a free 30-day pilot with up to 25 seats. Use your work email and
                  we&rsquo;ll set you up.
                </p>
                <TeamsPilotForm />
              </div>
            </div>
          </Reveal>
        </main>

        <SiteFooter href="/demo" label="Open the app demo →" />
      </div>
    </div>
  );
}
