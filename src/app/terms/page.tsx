import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/motion/Reveal";
import { GlowLayer } from "@/components/motion/GlowLayer";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that cover how you may use RentYourTime.",
};

const toc = [
  ["accept", "Accepting these terms"],
  ["service", "The service"],
  ["account", "Eligibility & account"],
  ["billing", "Subscriptions & billing"],
  ["cancel", "Cancellation & refunds"],
  ["use", "Acceptable use"],
  ["ip", "Intellectual property"],
  ["disclaimer", "Disclaimers"],
  ["liability", "Limitation of liability"],
  ["changes", "Changes"],
  ["law", "Governing law"],
  ["contact", "Contact"],
] as const;

const contributionPcts = ["5%", "10%", "25%", "50%", "75%", "100%"];

export default function TermsPage() {
  return (
    <div className="relative [overflow-x:clip]">
      <GlowLayer
        blobs={[
          { top: "-180px", left: "-120px", size: "520px", rgb: "0,230,118", opacity: 0.16 },
          { top: "520px", right: "-160px", size: "560px", rgb: "0,230,118", opacity: 0.06 },
        ]}
      />
      <ScrollProgressBar />

      <div className="relative z-10 mx-auto max-w-[1100px]">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteNav />

        <main id="main">
          <header className="max-w-[720px] px-6 pb-2 pt-[58px] sm:px-12 sm:pt-[72px]">
            <Reveal delayMs={0} className="text-[13px] font-semibold tracking-[0.1em] text-signal">
              TERMS OF SERVICE
            </Reveal>
            <Reveal
              as="h1"
              delayMs={68}
              className="m-0 mt-4 text-[38px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[56px]"
            >
              The short, honest kind<span className="text-signal">.</span>
            </Reveal>
            <Reveal delayMs={136} className="m-0 mt-[22px] text-lg leading-[1.6] text-white/55">
              These terms cover how you may use RentYourTime. We&rsquo;ve kept them as plain as we
              can. The one thing worth reading twice: the &ldquo;rent&rdquo; you see in the app is a
              motivational figure, not a real bill.
            </Reveal>
            <Reveal
              delayMs={204}
              className="mt-[26px] flex flex-wrap gap-6 text-[13px] text-white/40"
            >
              <span>
                Last updated <b className="font-semibold text-white/65">July 22, 2026</b>
              </span>
              <span>Applies to iOS app &amp; website</span>
            </Reveal>
          </header>

          <section className="flex flex-wrap items-start gap-14 px-6 pb-6 pt-10 sm:px-12">
            <aside className="sticky top-7 hidden flex-none flex-col gap-3 lg:flex lg:w-[200px]">
              <div className="mb-0.5 text-xs font-semibold tracking-[0.08em] text-white/35">
                ON THIS PAGE
              </div>
              {toc.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block border-l-2 border-white/[0.08] pl-4 text-[13px] leading-[1.35] text-white/45 transition-colors hover:border-signal hover:text-white"
                >
                  {label}
                </a>
              ))}
            </aside>

            <article className="flex max-w-[660px] flex-1 flex-col gap-10">
              <section id="accept">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">01</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Accepting these terms</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  By downloading the app or using this website, you agree to these Terms and to our{" "}
                  <a href="/privacy" className="font-semibold">
                    Privacy Policy
                  </a>
                  . If you don&rsquo;t agree, please don&rsquo;t use RentYourTime. These Terms form
                  an agreement between you and ATLASHC Paweł Dolatowski, the provider of
                  RentYourTime (&ldquo;we&rdquo;, &ldquo;us&rdquo;) — full company details are in the
                  Contact section below.
                </p>
              </section>

              <section id="service">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">02</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">The service</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  RentYourTime gives you a daily screen-time allowance and, once you pass it, shows a
                  growing amount of virtual &ldquo;rent&rdquo;.
                </p>
                <div className="mt-4 rounded-2xl border border-signal/[0.18] bg-signal/[0.07] px-[18px] py-4 text-[15px] leading-[1.6] text-white/75">
                  This rent is <b className="font-semibold text-signal">not a real charge</b>. We
                  never bill you for time spent on your phone and no money changes hands over your
                  usage. The only real payment is an optional Pro subscription, described below.
                </div>
                <p className="m-0 mt-[18px] text-base leading-[1.65] text-white/60">
                  Because that rent isn&rsquo;t real, you never owe us anything for it. If you want
                  to, though, you can{" "}
                  <b className="font-semibold text-white/85">voluntarily support the project</b>{" "}
                  from inside the app by contributing an amount equal to a share of your accrued
                  rent. You choose how much:
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  {contributionPcts.map((pct) => (
                    <span
                      key={pct}
                      className="inline-flex h-10 items-center rounded-full border border-signal/35 bg-signal/[0.08] px-5 text-[15px] font-semibold tabular-nums text-signal"
                    >
                      {pct}
                    </span>
                  ))}
                </div>
                <p className="m-0 mt-3.5 text-sm leading-[1.6] text-white/45">
                  These contributions are entirely optional and one-off. They don&rsquo;t unlock
                  features or change how the app works — choosing nothing is always fine.
                </p>
              </section>

              <section id="account">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">03</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Eligibility &amp; your account
                </h2>
                <ul className="m-0 mt-3.5 list-disc pl-5 text-base leading-[1.65] text-white/60">
                  <li className="my-2">
                    You must be at least 16 (or the age set by your local law) to use RentYourTime.
                  </li>
                  <li className="my-2">
                    Give accurate account information and keep your login credentials safe.
                  </li>
                  <li className="my-2">
                    You&rsquo;re responsible for activity under your account. Tell us promptly if you
                    suspect unauthorised use.
                  </li>
                </ul>
              </section>

              <section id="billing">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">04</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Subscriptions &amp; billing
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  The Free plan is free. Pro is a paid subscription billed monthly or yearly through
                  Apple or Stripe. Subscriptions renew automatically unless cancelled at least 24
                  hours before the current period ends. App Store purchases are also governed by
                  Apple&rsquo;s terms. If prices change, we&rsquo;ll give you notice before your next
                  renewal. See{" "}
                  <a href="/pricing" className="font-semibold">
                    pricing
                  </a>{" "}
                  for current plans.
                </p>
              </section>

              <section id="cancel">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">05</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Cancellation &amp; refunds
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  Cancel any time from your account settings or your App Store subscriptions. You
                  keep Pro until the end of the period you&rsquo;ve already paid for. Refunds are
                  handled according to the applicable store&rsquo;s policy and your local consumer
                  rights, including any statutory withdrawal period where it applies.
                </p>
              </section>

              <section id="use">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">06</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Acceptable use</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">Please don&rsquo;t:</p>
                <ul className="m-0 mt-3.5 list-disc pl-5 text-base leading-[1.65] text-white/60">
                  <li className="my-2">
                    Copy, resell, reverse-engineer, or tamper with the app or its systems.
                  </li>
                  <li className="my-2">
                    Use RentYourTime to break the law or to harm, harass, or surveil another person.
                  </li>
                  <li className="my-2">
                    Attempt to disrupt the service or access it through unofficial means.
                  </li>
                </ul>
              </section>

              <section id="ip">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">07</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Intellectual property</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  The app, our brand, and everything we create remain ours. We grant you a limited,
                  personal, non-transferable licence to use RentYourTime for its intended purpose.
                  Your data stays yours — how we handle it is set out in the{" "}
                  <a href="/privacy" className="font-semibold">
                    Privacy Policy
                  </a>
                  .
                </p>
              </section>

              <section id="disclaimer">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">08</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Disclaimers</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  RentYourTime is provided &ldquo;as is&rdquo;. Screen-time and rent figures are
                  estimates derived from your device&rsquo;s data and may not be exact. The app is a
                  behavioural nudge, not medical, psychological, or financial advice, and individual
                  results vary.
                </p>
              </section>

              <section id="liability">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">09</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Limitation of liability
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  To the extent permitted by law, we&rsquo;re not liable for indirect or
                  consequential losses, and our total liability is limited to the amount you paid us
                  in the 12 months before the claim. Nothing in these Terms limits liability that
                  cannot legally be excluded, including your mandatory consumer rights.
                </p>
              </section>

              <section id="changes">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">10</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Changes</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  We may update the service and these Terms over time. If a change is material,
                  we&rsquo;ll tell you inside the app before it takes effect. Continuing to use
                  RentYourTime afterwards means you accept the updated Terms.
                </p>
              </section>

              <section id="law">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">11</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Governing law</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  These Terms are governed by the laws of the country where RentYourTime is
                  established, without taking away the mandatory consumer protections of your own
                  country of residence.
                </p>
              </section>

              <section id="contact">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">12</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Contact</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  Questions about these Terms? Email{" "}
                  <a href="mailto:legal@rentyourtime.app" className="font-semibold">
                    legal@rentyourtime.app
                  </a>{" "}
                  and a human will get back to you.
                </p>
                <div className="mt-5 rounded-[18px] bg-card p-[22px] text-[15px] leading-[1.75] text-white/60">
                  <div className="mb-3 text-xs font-bold tracking-[0.08em] text-signal">
                    SERVICE PROVIDER
                  </div>
                  <div className="mb-1.5 text-base font-semibold text-white">
                    ATLASHC Paweł Dolatowski
                  </div>
                  <div>ul. Sadowa 9, 64-514 Pamiątkowo, Poland</div>
                  <div>
                    VAT ID: <b className="font-semibold text-white/85">PL7871113283</b>
                  </div>
                  <div>Owner: Paweł Dolatowski</div>
                </div>
                <div className="mt-4 rounded-[18px] bg-card px-[22px] py-5 text-sm leading-[1.6] text-white/50">
                  Plain version:{" "}
                  <b className="font-semibold text-signal">
                    the rent is pretend — the only thing we ever actually charge for is Pro.
                  </b>
                </div>
              </section>
            </article>
          </section>
        </main>

        <SiteFooter href="/demo" label="Open the app demo →" />
      </div>
    </div>
  );
}
