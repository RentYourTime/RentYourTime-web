import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/motion/Reveal";
import { GlowLayer } from "@/components/motion/GlowLayer";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How RentYourTime collects, stores, and protects your data.",
};

const principles = [
  {
    n: "01 · ON DEVICE",
    h: "On-device by default",
    p: "Your usage meter and per-app breakdown are computed on your phone. They only leave it if you switch on encrypted backup.",
  },
  {
    n: "02 · NO ADS",
    h: "No ad networks",
    p: "No third-party advertising SDKs, no tracking pixels, no data brokers. We make money from subscriptions, not from you.",
  },
  {
    n: "03 · YOUR DATA",
    h: "You hold the delete button",
    p: "Export everything or wipe your account in two taps. Deletion is real deletion, finished within 30 days.",
  },
];

const toc = [
  ["collect", "What we collect"],
  ["ondevice", "What stays on your device"],
  ["never", "What we never do"],
  ["processors", "Who we work with"],
  ["controls", "Your controls & rights"],
  ["retention", "How long we keep it"],
  ["children", "Children’s privacy"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact us"],
] as const;

export default function PrivacyPage() {
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
              PRIVACY POLICY
            </Reveal>
            <Reveal
              as="h1"
              delayMs={68}
              className="m-0 mt-4 text-[38px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[56px]"
            >
              Privacy, by design<span className="text-signal">.</span>
            </Reveal>
            <Reveal delayMs={136} className="m-0 mt-[22px] text-lg leading-[1.6] text-white/55">
              RentYourTime exists to help you use your phone less. It would be absurd to build that
              on top of surveillance. So we collect as little as possible, keep your minute-by-minute
              data on your device, and never sell a single byte of it.
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

          <section className="px-6 pb-3 pt-11 sm:px-12">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {principles.map((p, i) => (
                <Reveal
                  key={p.n}
                  as="article"
                  delayMs={i * 68}
                  className="rounded-[22px] bg-card p-6 transition-[transform,background-color] duration-300 ease-spring hover:-translate-y-1 hover:bg-[#1a1a1a]"
                >
                  <div className="text-[13px] font-bold tracking-[0.08em] text-signal">{p.n}</div>
                  <h3 className="mb-2 mt-4 text-[18px] tracking-[-0.01em]">{p.h}</h3>
                  <p className="m-0 text-sm leading-[1.55] text-white/50">{p.p}</p>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap items-start gap-14 px-6 pb-6 pt-9 sm:px-12">
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
              <section id="collect">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">01</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">What we collect</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  We keep the account itself deliberately thin:
                </p>
                <ul className="m-0 mt-3.5 list-disc pl-5 text-base leading-[1.65] text-white/60">
                  <li className="my-2">
                    <b className="font-semibold text-white/85">Your email address</b> — to sign you
                    in and send essential account and billing notices.
                  </li>
                  <li className="my-2">
                    <b className="font-semibold text-white/85">Subscription status</b> — whether
                    you&rsquo;re on Free or Pro, handled through Apple or Stripe. We never see your
                    full card number.
                  </li>
                  <li className="my-2">
                    <b className="font-semibold text-white/85">Basic diagnostics</b> — crash reports
                    and app version, tied to a random device identifier rather than your name.
                  </li>
                </ul>
              </section>

              <section id="ondevice">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">02</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  What stays on your device
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  The heart of the app — your live allowance, the running rent meter, and your
                  per-app time breakdown — is calculated and stored on your iPhone using
                  Apple&rsquo;s Screen Time framework. We can&rsquo;t read it, and by default it
                  never touches our servers.
                </p>
                <p className="m-0 mt-3.5 text-base leading-[1.65] text-white/60">
                  If you turn on <b className="font-semibold text-white/85">iCloud backup</b>, only
                  anonymized daily totals — minutes over allowance and rent avoided — sync so your
                  streak survives a new phone. Individual app names never leave the device.
                </p>
              </section>

              <section id="never">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">03</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">What we never do</h2>
                <ul className="m-0 mt-3.5 list-disc pl-5 text-base leading-[1.65] text-white/60">
                  <li className="my-2">Sell, rent, or trade your data to anyone.</li>
                  <li className="my-2">Load third-party advertising or analytics trackers.</li>
                  <li className="my-2">
                    Read the content of your messages, notifications, or the apps you use.
                  </li>
                  <li className="my-2">Track your precise location or build an advertising profile.</li>
                </ul>
              </section>

              <section id="processors">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">04</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Who we work with</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  A short list of processors help us run the service, each bound by contract to use
                  your data only on our instructions:
                </p>
                <ul className="m-0 mt-3.5 list-disc pl-5 text-base leading-[1.65] text-white/60">
                  <li className="my-2">
                    <b className="font-semibold text-white/85">Apple</b> — App Store purchases and
                    in-app subscriptions.
                  </li>
                  <li className="my-2">
                    <b className="font-semibold text-white/85">Stripe</b> — web billing for Pro
                    plans.
                  </li>
                  <li className="my-2">
                    <b className="font-semibold text-white/85">A European cloud host</b> — encrypted
                    storage for account and backup data.
                  </li>
                </ul>
              </section>

              <section id="controls">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">05</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Your controls &amp; rights
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  From <b className="font-semibold text-white/85">Settings → Privacy</b> in the app
                  you can export your data, turn cloud backup on or off, and delete your account.
                  Wherever you live, we honour the access, correction, and erasure rights granted by
                  laws such as the GDPR and CCPA — no lawyer required. We also respect your system{" "}
                  <b className="font-semibold text-white/85">Reduce Motion</b> setting across the app
                  and this site.
                </p>
              </section>

              <section id="retention">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">06</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">How long we keep it</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  Account data lives only as long as your account does. When you delete it, we erase
                  your personal data from active systems immediately and from backups within 30
                  days. Fully anonymized aggregates — which can no longer be traced back to you —
                  may be retained to understand how the product helps people overall.
                </p>
              </section>

              <section id="children">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">07</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Children&rsquo;s privacy
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  RentYourTime is intended for people aged 16 and over (13+ where local law permits
                  with guardian consent). We don&rsquo;t knowingly collect data from children below
                  that age. If you believe a child has created an account, contact us and
                  we&rsquo;ll remove it.
                </p>
              </section>

              <section id="changes">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">08</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">
                  Changes to this policy
                </h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  If we make a meaningful change, we&rsquo;ll update the date above and tell you
                  inside the app before it takes effect. Continuing to use RentYourTime after that
                  means you accept the revised policy.
                </p>
              </section>

              <section id="contact">
                <div className="text-xs font-bold tracking-[0.08em] text-signal">09</div>
                <h2 className="mb-3 mt-2.5 text-[26px] tracking-[-0.02em]">Contact us</h2>
                <p className="m-0 text-base leading-[1.65] text-white/60">
                  Questions about your privacy? Write to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  and a human — not a bot — will reply. You may also contact our EU data protection
                  representative through the same address.
                </p>
                <div className="mt-5 rounded-[18px] bg-card p-[22px] text-[15px] leading-[1.75] text-white/60">
                  <div className="mb-3 text-xs font-bold tracking-[0.08em] text-signal">
                    DATA CONTROLLER
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
                  Prefer plain language? The short version:{" "}
                  <b className="font-semibold text-signal">
                    we help you look at your phone less, so we built the whole thing to look at
                    your data less.
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
