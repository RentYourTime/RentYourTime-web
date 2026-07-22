import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistForm } from "@/components/WaitlistForm";
import { PhoneCardRing } from "@/components/PhoneCardRing";
import { Reveal } from "@/components/motion/Reveal";
import { GlowLayer } from "@/components/motion/GlowLayer";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";
import { CountUp } from "@/components/motion/CountUp";

const steps = [
  {
    n: "01 · SET YOUR LIMIT",
    h: "Start with free time.",
    p: "Choose how much screen time you want each day. Your allowance is always free.",
  },
  {
    n: "02 · WATCH THE METER",
    h: "See the real trade-off.",
    p: "After your allowance runs out, every extra minute adds virtual rent to your daily bill.",
  },
  {
    n: "03 · RECLAIM YOUR DAY",
    h: "Make a conscious choice.",
    p: "Close the app, keep your streak alive, and see how much time and rent you avoided.",
  },
];

const stats: {
  target: number;
  fmt?: "hm";
  prefix?: string;
  suffix?: string;
  g: boolean;
  k: string;
}[] = [
  { target: -38, suffix: "%", g: true, k: "screen time after 30 days" },
  { target: 560, fmt: "hm", g: false, k: "average time reclaimed weekly" },
  { target: 61, prefix: "$", g: false, k: "average rent avoided monthly" },
];

export default function HomePage() {
  return (
    <div className="relative [overflow-x:clip]">
      <GlowLayer
        blobs={[
          { top: "-160px", left: "-120px", size: "520px", rgb: "0,230,118", opacity: 0.16 },
          { top: "320px", right: "-160px", size: "560px", rgb: "255,59,48", opacity: 0.1 },
        ]}
      />
      <ScrollProgressBar />

      <div className="relative z-10 mx-auto max-w-[1100px]">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteNav active="how" />

        <main id="main">
          {/* hero */}
          <section
            aria-labelledby="hero-title"
            className="flex items-center gap-12 px-6 py-16 max-[900px]:flex-col max-[900px]:items-start sm:px-12 sm:py-[72px]"
          >
            <div className="flex flex-1 flex-col gap-6">
              <Reveal
                delayMs={0}
                className="text-[13px] font-semibold tracking-[0.1em] text-signal"
              >
                iOS · COMING THIS FALL
              </Reveal>
              <Reveal
                as="h1"
                id="hero-title"
                delayMs={68}
                className="m-0 text-[42px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[58px]"
              >
                Your screen time
                <br />
                now has rent<span className="text-signal">.</span>
              </Reveal>
              <Reveal
                delayMs={136}
                className="m-0 max-w-[440px] text-[19px] leading-[1.55] text-white/55"
              >
                3 free hours a day. After that, every minute generates a bill. Virtual — but
                you&rsquo;ll feel it. The average person avoids paying $61/month.
              </Reveal>
              <Reveal delayMs={204}>
                <WaitlistForm />
              </Reveal>
              <Reveal delayMs={272} className="text-[15px]">
                Don&rsquo;t want to wait?{" "}
                <Link href="/demo" className="font-medium text-signal no-underline hover:underline">
                  Try the live demo →
                </Link>
              </Reveal>
            </div>

            {/* phone card — live demo preview */}
            <Reveal delayMs={340} className="max-[900px]:self-center">
              <Link
                href="/demo"
                title="Open the live demo"
                className="flex w-[300px] flex-none flex-col gap-4 rounded-[36px] bg-card p-6 text-white no-underline shadow-[0_40px_100px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-spring hover:-translate-y-1.5"
              >
                <div className="flex justify-between text-xs text-white/45">
                  <span>TODAY</span>
                  <b className="font-semibold text-signal">12-day streak</b>
                </div>
                <PhoneCardRing target={91} />
                <div className="flex items-baseline justify-between rounded-[18px] bg-ink px-4 py-3.5">
                  <span className="text-[13px] text-white/50">Today&rsquo;s rent</span>
                  <CountUp
                    target={2.7}
                    decimals={2}
                    prefix="$"
                    className="tnum text-[22px] font-bold text-rent"
                  />
                </div>
                <div className="flex items-baseline justify-between rounded-[18px] bg-ink px-4 py-3.5">
                  <span className="text-[13px] text-white/50">Avoided in July</span>
                  <CountUp
                    target={84}
                    prefix="$"
                    className="tnum text-[22px] font-bold text-signal"
                  />
                </div>
                <div className="pt-0.5 text-center text-[13px] font-semibold text-signal">
                  ▶ Try the live demo
                </div>
              </Link>
            </Reveal>
          </section>

          {/* how it works */}
          <section id="how" className="border-t border-white/[0.06] px-6 py-14 sm:px-12 sm:py-[72px]">
            <Reveal delayMs={0} className="mb-9 max-w-[600px]">
              <div className="text-[13px] font-semibold tracking-[0.1em] text-signal">
                HOW IT WORKS
              </div>
              <h2 className="my-3 text-[32px] tracking-[-0.03em] sm:text-[38px]">
                A small price changes how you spend your time.
              </h2>
              <p className="m-0 text-[17px] leading-[1.55] text-white/50">
                RentYourTime turns abstract screen-time numbers into something you can immediately
                understand: a daily allowance and a visible cost.
              </p>
            </Reveal>
            <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
              {steps.map((s, i) => (
                <Reveal
                  key={s.n}
                  as="article"
                  delayMs={i * 68}
                  className="min-h-[210px] rounded-[24px] bg-card p-[26px] transition-[transform,background-color] duration-300 ease-spring hover:-translate-y-1 hover:bg-[#1a1a1a] max-[900px]:min-h-0"
                >
                  <div className="text-[13px] font-bold tracking-[0.08em] text-signal">{s.n}</div>
                  <h3 className="mb-2.5 mt-[30px] text-[21px] tracking-[-0.02em]">{s.h}</h3>
                  <p className="m-0 text-[15px] leading-[1.55] text-white/50">{s.p}</p>
                </Reveal>
              ))}
            </div>
          </section>

          {/* stats */}
          <div className="flex border-t border-white/[0.06] max-[900px]:flex-col">
            {stats.map((s, i) => (
              <Reveal
                key={s.k}
                delayMs={i * 68}
                className="flex-1 border-r border-white/[0.06] px-6 py-7 last:border-r-0 max-[900px]:border-b max-[900px]:border-r-0 sm:px-12"
              >
                {s.fmt === "hm" ? (
                  <CountUp target={s.target} format="hm" className="tnum text-2xl font-bold" />
                ) : (
                  <CountUp
                    target={s.target}
                    suffix={s.suffix}
                    prefix={s.prefix}
                    className={`tnum text-2xl font-bold ${s.g ? "text-signal" : ""}`}
                  />
                )}
                <div className="mt-1 text-[13px] text-white/50">{s.k}</div>
              </Reveal>
            ))}
          </div>
        </main>

        <SiteFooter href="/demo" label="Open the app demo →" />
      </div>
    </div>
  );
}
