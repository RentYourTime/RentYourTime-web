import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistForm } from "@/components/WaitlistForm";

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

const stats = [
  { v: "−38%", g: true, k: "screen time after 30 days" },
  { v: "9h 20m", g: false, k: "average time reclaimed weekly" },
  { v: "$61", g: false, k: "average rent avoided monthly" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1100px]">
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
            <div className="text-[13px] font-semibold tracking-[0.1em] text-signal">
              iOS · COMING THIS FALL
            </div>
            <h1
              id="hero-title"
              className="m-0 text-[42px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[58px]"
            >
              Your screen time
              <br />
              now has rent<span className="text-signal">.</span>
            </h1>
            <p className="m-0 max-w-[440px] text-[19px] leading-[1.55] text-white/55">
              3 free hours a day. After that, every minute generates a bill. Virtual — but you&rsquo;ll
              feel it. The average person avoids paying $61/month.
            </p>
            <WaitlistForm />
            <div className="text-[15px]">
              Don&rsquo;t want to wait?{" "}
              <Link href="/demo" className="font-medium text-signal no-underline hover:underline">
                Try the live demo →
              </Link>
            </div>
          </div>

          {/* phone card — live demo preview */}
          <Link
            href="/demo"
            title="Open the live demo"
            className="flex w-[300px] flex-none flex-col gap-4 rounded-[36px] bg-card p-6 text-white no-underline shadow-[0_40px_100px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-spring hover:-translate-y-1.5 max-[900px]:self-center"
          >
            <div className="flex justify-between text-xs text-white/45">
              <span>TODAY</span>
              <b className="font-semibold text-signal">12-day streak</b>
            </div>
            <div
              className="mx-auto flex size-[150px] items-center justify-center rounded-full"
              style={{ background: "conic-gradient(var(--signal) 0 91%, var(--rent) 91% 100%)" }}
            >
              <div className="flex size-[122px] flex-col items-center justify-center rounded-full bg-card">
                <div className="tnum text-[32px] font-bold">3:18</div>
                <div className="text-[11px] text-rent">18m over</div>
              </div>
            </div>
            <div className="flex items-baseline justify-between rounded-[18px] bg-ink px-4 py-3.5">
              <span className="text-[13px] text-white/50">Today&rsquo;s rent</span>
              <span className="tnum text-[22px] font-bold text-rent">$2.70</span>
            </div>
            <div className="flex items-baseline justify-between rounded-[18px] bg-ink px-4 py-3.5">
              <span className="text-[13px] text-white/50">Avoided in July</span>
              <span className="tnum text-[22px] font-bold text-signal">$84</span>
            </div>
            <div className="pt-0.5 text-center text-[13px] font-semibold text-signal">
              ▶ Try the live demo
            </div>
          </Link>
        </section>

        {/* how it works */}
        <section id="how" className="border-t border-white/[0.06] px-6 py-14 sm:px-12 sm:py-[72px]">
          <div className="mb-9 max-w-[600px]">
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
          </div>
          <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
            {steps.map((s) => (
              <article key={s.n} className="rounded-[24px] bg-card p-[26px] max-[900px]:min-h-0 min-h-[210px]">
                <div className="text-[13px] font-bold tracking-[0.08em] text-signal">{s.n}</div>
                <h3 className="mb-2.5 mt-[30px] text-[21px] tracking-[-0.02em]">{s.h}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-white/50">{s.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* stats */}
        <div className="flex border-t border-white/[0.06] max-[900px]:flex-col">
          {stats.map((s) => (
            <div
              key={s.k}
              className="flex-1 border-r border-white/[0.06] px-6 py-7 last:border-r-0 max-[900px]:border-b max-[900px]:border-r-0 sm:px-12"
            >
              <div className={`tnum text-2xl font-bold ${s.g ? "text-signal" : ""}`}>{s.v}</div>
              <div className="mt-1 text-[13px] text-white/50">{s.k}</div>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter href="/demo" label="Open the app demo →" />
    </div>
  );
}
