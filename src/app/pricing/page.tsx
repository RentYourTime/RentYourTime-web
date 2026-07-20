import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare RentYourTime Free and Pro plans.",
};

const compareRows: [string, string, string][] = [
  ["Live daily meter", "✓", "✓"],
  ["Rent history", "7 days", "Unlimited"],
  ["Custom limits and rates", "—", "✓"],
  ["Per-app insights", "—", "✓"],
  ["Focus goals", "—", "✓"],
];

const faqs = [
  {
    q: "Is the rent real?",
    a: "No. By default, every bill is virtual. It is a behavioral signal designed to make time feel tangible.",
  },
  {
    q: "Can I cancel Pro?",
    a: "Yes. You can cancel at any time and keep using the Free plan.",
  },
  {
    q: "Will the founder price change?",
    a: "Early members keep the displayed yearly price for as long as their subscription remains active.",
  },
  {
    q: "When does the app launch?",
    a: "RentYourTime is planned for iOS this fall. Join the waitlist to get early access.",
  },
];

function Cell({ value }: { value: string }) {
  if (value === "✓") return <span className="text-center text-signal">✓</span>;
  if (value === "—") return <span className="text-center text-white/30">—</span>;
  return <span className="text-center">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteNav active="pricing" />

      <header className="px-6 pb-12 pt-[86px] text-center max-[720px]:pt-[58px]">
        <div className="text-[13px] font-bold tracking-[0.1em] text-signal">SIMPLE PRICING</div>
        <h1 className="mx-auto my-4 max-w-[760px] text-[42px] leading-[1.04] tracking-[-0.04em] sm:text-[58px]">
          Start free. Upgrade when your time becomes priceless<span className="text-signal">.</span>
        </h1>
        <p className="mx-auto max-w-[570px] text-lg leading-[1.55] text-white/50">
          The meter works for everyone. Pro gives you deeper insights and more control over the
          habits you want to change.
        </p>
      </header>

      <main id="main">
        {/* plans */}
        <section
          aria-label="Pricing plans"
          className="mx-auto grid max-w-[940px] grid-cols-2 gap-[18px] px-6 pb-20 pt-6 max-[720px]:grid-cols-1 sm:px-12"
        >
          {/* Free */}
          <article className="flex min-h-[510px] flex-col rounded-[28px] border border-white/[0.07] bg-card p-8 max-[720px]:min-h-0">
            <h2 className="mb-[18px] text-[25px]">Free</h2>
            <div className="text-[48px] font-[750] tracking-[-0.04em]">
              $0<span className="text-[15px] font-medium tracking-normal text-white/50"> forever</span>
            </div>
            <p className="mb-7 mt-3.5 min-h-[46px] text-[15px] leading-[1.5] text-white/50">
              Everything you need to see the cost of your screen time.
            </p>
            <div className="mb-[30px] flex flex-col gap-[15px] text-[15px]">
              {[
                "Daily screen-time meter",
                "Virtual daily rent bill",
                "Streaks and weekly overview",
                "Three-hour daily allowance",
              ].map((f) => (
                <div key={f} className="flex gap-2.5 leading-[1.35]">
                  <span className="font-extrabold text-signal">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/demo"
              className="mt-auto flex h-[52px] items-center justify-center rounded-[26px] bg-white text-[15px] font-bold text-ink no-underline transition-transform hover:scale-[1.02]"
            >
              Try the demo
            </Link>
            <div className="mt-3 text-center text-xs text-white/35">No card. No actual charges.</div>
          </article>

          {/* Pro */}
          <article className="relative flex min-h-[510px] flex-col rounded-[28px] border border-signal/40 bg-card p-8 shadow-[0_30px_80px_rgba(0,0,0,0.34)] max-[720px]:min-h-0">
            <div className="absolute right-6 top-6 rounded-[20px] bg-signal/[0.12] px-2.5 py-[7px] text-[11px] font-bold tracking-[0.06em] text-signal">
              FOUNDER PRICE
            </div>
            <h2 className="mb-[18px] text-[25px]">Pro</h2>
            <div className="text-[48px] font-[750] tracking-[-0.04em]">
              $8.99<span className="text-[15px] font-medium tracking-normal text-white/50"> / year</span>
            </div>
            <p className="mb-7 mt-3.5 min-h-[46px] text-[15px] leading-[1.5] text-white/50">
              Advanced tools for building a healthier relationship with your phone.
            </p>
            <div className="mb-[30px] flex flex-col gap-[15px] text-[15px]">
              {[
                "Everything in Free",
                "Per-app rent rates and exemptions",
                "Custom allowance and focus goals",
                "Monthly and yearly insights",
                "Widgets and Watch app",
              ].map((f) => (
                <div key={f} className="flex gap-2.5 leading-[1.35]">
                  <span className="font-extrabold text-signal">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <Link
              href="/account"
              className="mt-auto flex h-[52px] items-center justify-center rounded-[26px] bg-signal text-[15px] font-bold text-sig-ink no-underline transition-transform hover:scale-[1.02]"
            >
              Choose Pro
            </Link>
            <div className="mt-3 text-center text-xs text-white/35">
              85% off forever for early members.
            </div>
          </article>
        </section>

        {/* compare */}
        <section className="border-t border-white/[0.06] px-6 py-[72px] sm:px-12">
          <h2 className="mb-[30px] text-[36px] tracking-[-0.03em]">Compare plans</h2>
          <div className="border-t border-white/10">
            <div className="grid grid-cols-[1fr_140px_140px] gap-3 border-b border-white/[0.08] px-2 py-[18px] text-xs font-bold tracking-[0.06em] text-white/50 max-[720px]:grid-cols-[1fr_70px_70px]">
              <span>FEATURE</span>
              <span className="text-center">FREE</span>
              <span className="text-center">PRO</span>
            </div>
            {compareRows.map(([feature, free, pro]) => (
              <div
                key={feature}
                className="grid grid-cols-[1fr_140px_140px] gap-3 border-b border-white/[0.08] px-2 py-[18px] text-sm max-[720px]:grid-cols-[1fr_70px_70px]"
              >
                <span>{feature}</span>
                <Cell value={free} />
                <Cell value={pro} />
              </div>
            ))}
          </div>
        </section>

        {/* faq */}
        <section className="border-t border-white/[0.06] px-6 py-[72px] sm:px-12">
          <h2 className="mb-[30px] text-[36px] tracking-[-0.03em]">Good to know</h2>
          <div className="grid grid-cols-2 gap-x-12 gap-y-7 max-[720px]:grid-cols-1">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="mb-2 text-[17px]">{f.q}</h3>
                <p className="m-0 text-sm leading-[1.55] text-white/50">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter href="/" label="Back to home →" />
    </div>
  );
}
