import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/motion/Reveal";
import { GlowLayer } from "@/components/motion/GlowLayer";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";
import { FounderTierCards } from "@/components/founders/FounderTierCards";
import { FounderComparisonTable } from "@/components/founders/FounderComparisonTable";
import { FOUNDER_BLACK_CALL_TERMS, FOUNDER_LEGAL_NOTES } from "@/lib/founderContent";
import { listActiveFounderTiers, serializeFounderTier } from "@/lib/founders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Founder Program",
  description: "Three limited, numbered Founder tiers — become part of RentYourTime's history.",
};

export default function FoundersPage() {
  // Server Component: availability is read straight from the database on
  // every request (no cache) — see docs/FOUNDER_PROGRAM.md "Availability".
  const tiers = listActiveFounderTiers().map(serializeFounderTier);

  return (
    <div className="relative [overflow-x:clip]">
      <GlowLayer
        blobs={[
          { top: "-160px", left: "-120px", size: "520px", rgb: "205,127,50", opacity: 0.12 },
          { top: "380px", right: "-160px", size: "560px", rgb: "255,215,0", opacity: 0.08 },
        ]}
      />
      <ScrollProgressBar />

      <div className="relative z-10 mx-auto max-w-[1100px]">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteNav />

        <main id="main">
          <header className="px-6 pb-10 pt-[70px] text-center sm:px-12 sm:pt-[86px]">
            <Reveal delayMs={0} className="text-[13px] font-bold tracking-[0.1em] text-signal">
              RENTYOURTIME FOUNDER PROGRAM
            </Reveal>
            <Reveal
              as="h1"
              delayMs={68}
              className="mx-auto my-4 max-w-[760px] text-[38px] leading-[1.06] tracking-[-0.035em] sm:text-[54px]"
            >
              Three hundred, one hundred fifty, twenty<span className="text-signal">.</span>
            </Reveal>
            <Reveal delayMs={136} className="mx-auto max-w-[600px] text-[17px] leading-[1.6] text-white/55">
              A limited, numbered way to back RentYourTime before launch. Each tier is capped, each
              spot is numbered, and once a tier sells out, it&rsquo;s gone for good.
            </Reveal>
          </header>

          <section aria-label="Founder tiers" className="px-6 pb-16 sm:px-12">
            <Reveal delayMs={0}>
              <FounderTierCards initialTiers={tiers} />
            </Reveal>
          </section>

          <section className="border-t border-white/[0.06] px-6 py-14 sm:px-12">
            <Reveal as="h2" delayMs={0} className="mb-7 text-[30px] tracking-[-0.03em] sm:text-[36px]">
              Compare tiers
            </Reveal>
            <Reveal delayMs={68}>
              <FounderComparisonTable />
            </Reveal>
          </section>

          <section className="border-t border-white/[0.06] px-6 py-14 sm:px-12">
            <Reveal delayMs={0} className="max-w-[720px]">
              <h2 className="mb-4 text-[24px] tracking-[-0.02em]">About the Founder Black weekly call</h2>
              <ul className="m-0 list-disc pl-5 text-sm leading-[1.7] text-white/55">
                {FOUNDER_BLACK_CALL_TERMS.map((t) => (
                  <li key={t} className="my-1.5">
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delayMs={136} className="mt-10 max-w-[720px] rounded-2xl bg-card p-6">
              <h2 className="mb-3 text-[15px] font-semibold text-white/80">Good to know</h2>
              <ul className="m-0 list-disc pl-5 text-[13px] leading-[1.7] text-white/45">
                {FOUNDER_LEGAL_NOTES.map((t) => (
                  <li key={t} className="my-1">
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-white/40">
                Full terms apply — see the{" "}
                <Link href="/terms#founder-program" className="text-signal">
                  Founder Program section of our Terms
                </Link>
                .
              </p>
            </Reveal>
          </section>
        </main>

        <SiteFooter href="/pricing" label="See regular pricing →" />
      </div>
    </div>
  );
}
