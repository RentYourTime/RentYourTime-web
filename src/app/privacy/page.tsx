import type { Metadata } from "next";
import Link from "next/link";
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
    n: "ON-DEVICE BY DEFAULT",
    h: "On-device by default",
    p: "Your usage meter and per-app breakdown are computed on your phone. They only leave it if you switch on encrypted backup.",
  },
  {
    n: "NO ADS, NO DATA BROKERS",
    h: "No third-party advertising or analytics SDKs in the app",
    p: "No data brokers, no selling. We make money from subscriptions. We do use one analytics tool on our marketing website — §4 tells you exactly where and how.",
  },
  {
    n: "YOU HOLD THE DELETE BUTTON",
    h: "Export or wipe your account in two taps",
    p: "Deletion is real deletion, subject only to the narrow legal retention described in §8.",
  },
];

const toc = [
  ["who-controls", "1. Who is responsible for your data"],
  ["what-we-collect", "2. What we collect, why, and legal basis"],
  ["on-device", "3. What stays on your device"],
  ["cookies-analytics", "4. The website, cookies and analytics"],
  ["never", "5. What we never do"],
  ["recipients", "6. Who else touches your data"],
  ["transfers", "7. International transfers"],
  ["retention", "8. How long we keep it"],
  ["your-rights", "9. Your rights"],
  ["security", "10. How we protect your data"],
  ["children", "11. Children’s privacy"],
  ["changes", "12. Changes to this policy"],
  ["contact", "13. Contact"],
] as const;

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 align-bottom font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-white/65">{children}</td>;
}
function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08]">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px] leading-[1.5]">
        <thead>
          <tr className="bg-white/[0.02] text-[11px] uppercase tracking-[0.05em] text-white/40">
            {head.map((h, i) => (
              <Th key={i}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Tr({ children }: { children: React.ReactNode }) {
  return <tr className="border-t border-white/[0.05]">{children}</tr>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-3.5 text-base leading-[1.65] text-white/60 first:mt-0">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="m-0 mt-3.5 list-disc pl-5 text-base leading-[1.65] text-white/60">{children}</ul>;
}
function B({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-white/85">{children}</b>;
}
function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <>
      <div className="text-xs font-bold tracking-[0.08em] text-signal">{n}</div>
      <h2 className="mb-1 mt-2.5 text-[26px] tracking-[-0.02em]">{title}</h2>
    </>
  );
}

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
          <header className="max-w-[760px] px-6 pb-2 pt-[58px] sm:px-12 sm:pt-[72px]">
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
              RentYourTime exists to help you use your phone less. We keep your minute-by-minute
              usage data on your device, we don&rsquo;t sell your data, and we run no
              advertising or analytics inside the app. We do use one analytics tool on our
              marketing website, and this policy tells you exactly where and how.
            </Reveal>
            <Reveal delayMs={170} className="m-0 mt-4 text-sm leading-[1.6] text-white/40">
              This document is the legally binding version. The summary points below are a
              plain-language shortcut, not a replacement for the sections that follow.
            </Reveal>
            <Reveal
              delayMs={204}
              className="mt-[26px] flex flex-wrap gap-6 text-[13px] text-white/40"
            >
              <span>
                Last updated <b className="font-semibold text-white/65">July 23, 2026</b>
              </span>
              <span>Version 2.0</span>
              <span>Effective from July 23, 2026</span>
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
            <aside className="sticky top-7 hidden flex-none flex-col gap-3 lg:flex lg:w-[220px]">
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

            <article className="flex max-w-[680px] flex-1 flex-col gap-10">
              <section id="who-controls">
                <SectionHead n="1" title="Who is responsible for your data" />
                <P>
                  The controller of your personal data, within the meaning of Article 4(7)
                  GDPR and the &ldquo;business&rdquo; under US state privacy laws, is:
                </P>
                <div className="mt-4 rounded-[18px] bg-card p-[22px] text-[15px] leading-[1.75] text-white/60">
                  <div className="mb-1.5 text-base font-semibold text-white">
                    ATLASHC Paweł Dolatowski
                  </div>
                  <div>ul. Sadowa 9, 64-514 Pamiątkowo, Poland</div>
                  <div>
                    NIP (VAT ID): <B>PL7871113283</B>
                  </div>
                  <div>
                    Email:{" "}
                    <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                      privacy@rentyourtime.app
                    </a>
                  </div>
                </div>
                <P>
                  We have not appointed a Data Protection Officer, because we are not required
                  to under Article 37 GDPR. Privacy questions go to the address above and are
                  answered by a human.
                </P>
              </section>

              <section id="what-we-collect">
                <SectionHead n="2" title="What we collect, why, and on what legal basis" />
                <Table head={["Data", "Why we process it", "Legal basis (GDPR)"]}>
                  <Tr>
                    <Td>Email address</Td>
                    <Td>To create your account, sign you in, and send essential service and billing notices</Td>
                    <Td>Art. 6(1)(b) — performance of contract</Td>
                  </Tr>
                  <Tr>
                    <Td>Subscription status (Free / Pro), purchase and renewal dates, transaction identifiers</Td>
                    <Td>To give you the plan you paid for and handle refunds and disputes</Td>
                    <Td>Art. 6(1)(b) — performance of contract</Td>
                  </Tr>
                  <Tr>
                    <Td>Billing and invoicing records</Td>
                    <Td>To meet Polish accounting and tax law</Td>
                    <Td>Art. 6(1)(c) — legal obligation (Ustawa o rachunkowości; Ordynacja podatkowa)</Td>
                  </Tr>
                  <Tr>
                    <Td>Crash reports, app version, OS version, device model, tied to a randomly generated device identifier</Td>
                    <Td>To find and fix bugs and keep the app stable and secure</Td>
                    <Td>Art. 6(1)(f) — legitimate interest in a working, secure product</Td>
                  </Tr>
                  <Tr>
                    <Td>Anonymised daily totals (minutes over allowance, rent avoided) — only if you enable cloud backup</Td>
                    <Td>So your streak survives a new phone</Td>
                    <Td>Art. 6(1)(a) — your consent, withdrawable in Settings → Privacy</Td>
                  </Tr>
                  <Tr>
                    <Td>Support correspondence</Td>
                    <Td>To answer you and keep a record of what we agreed</Td>
                    <Td>Art. 6(1)(b) and 6(1)(f)</Td>
                  </Tr>
                  <Tr>
                    <Td>Website analytics (see §4)</Td>
                    <Td>To understand how people find and use our marketing site</Td>
                    <Td>Art. 6(1)(a) — your consent via the cookie banner</Td>
                  </Tr>
                  <Tr>
                    <Td>Website server logs (IP address, timestamp, requested page, user agent)</Td>
                    <Td>To serve the website, keep it available, and detect abuse</Td>
                    <Td>Art. 6(1)(f) — legitimate interest in security and availability</Td>
                  </Tr>
                </Table>
                <P>
                  Providing your email address is necessary to have an account; without it we
                  cannot provide the service. Everything else is either automatic and minimal,
                  or optional.
                </P>
                <P>We never see your full card number. Payments are handled by Apple or Stripe.</P>
              </section>

              <section id="on-device">
                <SectionHead n="3" title="What stays on your device" />
                <P>
                  The heart of the app — your live allowance, the running rent meter, and your
                  per-app time breakdown — is calculated and stored on your iPhone using
                  Apple&rsquo;s Screen Time, FamilyControls and DeviceActivity frameworks.
                  Apple&rsquo;s design and our use of these entitlements mean that app-level
                  usage data is not readable by us and does not reach our servers.
                </P>
                <P>
                  If you turn on cloud backup, only aggregated daily totals — minutes over
                  allowance and rent avoided — are synced. Individual app names, bundle
                  identifiers and per-app timings never leave the device.
                </P>
                <P>
                  <B>We run no third-party analytics or advertising SDK inside the iOS app.</B>{" "}
                  There is no Google Analytics, no Firebase Analytics, and no ad network in the
                  application itself.
                </P>
              </section>

              <section id="cookies-analytics">
                <SectionHead n="4" title="The website, cookies and analytics" />
                <P>Our marketing website currently uses only:</P>
                <Ul>
                  <li className="my-2">
                    <B>Strictly necessary storage</B>, required to deliver the pages you request.
                    No consent is needed for this, and none of it is used for analytics or
                    advertising.
                  </li>
                </Ul>
                <P>
                  We do not currently run Google Analytics, any other third-party analytics
                  tool, or any advertising pixel on this website, and we set no non-essential
                  cookies. If that changes, we will add a consent banner using Google Consent
                  Mode (or an equivalent mechanism) before any non-essential identifier is set
                  for EEA or UK visitors, publish a full cookie table listing every cookie and
                  identifier, its purpose and its lifetime, and update this section — with
                  advance notice under §12 — before doing so.
                </P>
                <P>
                  <B>Opt-out preference signals.</B> We honour the Global Privacy Control (GPC)
                  signal. If your browser sends it, we treat it as a request to opt out of
                  sharing your personal information for cross-context behavioural advertising —
                  which, as described above, we do not do in any case.
                </P>
              </section>

              <section id="never">
                <SectionHead n="5" title="What we never do" />
                <Ul>
                  <li className="my-2">Sell, rent, or trade your personal data.</li>
                  <li className="my-2">Share your personal information for cross-context behavioural advertising.</li>
                  <li className="my-2">Run third-party advertising or analytics SDKs in the app.</li>
                  <li className="my-2">Read the content of your messages, notifications, or the apps you use.</li>
                  <li className="my-2">Track your precise location or build an advertising profile.</li>
                  <li className="my-2">
                    Subject you to automated decision-making producing legal or similarly
                    significant effects, including profiling, within the meaning of Article 22
                    GDPR.
                  </li>
                </Ul>
              </section>

              <section id="recipients">
                <SectionHead n="6" title="Who else touches your data" />
                <Table head={["Recipient", "Role", "What they receive"]}>
                  <Tr>
                    <Td>Apple Distribution International Ltd (Ireland) / Apple Inc. (USA)</Td>
                    <Td>Independent controller as merchant of record for App Store and in-app purchases; our processor for crash reporting where you opted into sharing with developers</Td>
                    <Td>Purchase and subscription records; crash diagnostics</Td>
                  </Tr>
                  <Tr>
                    <Td>Stripe Payments Europe Ltd (Ireland) / Stripe, Inc. (USA)</Td>
                    <Td>Independent controller for fraud prevention and its own regulatory duties; our processor for web billing</Td>
                    <Td>Email, payment metadata, transaction records</Td>
                  </Tr>
                  <Tr>
                    <Td>Amazon Web Services EMEA SARL (Luxembourg) / Amazon Web Services, Inc. (USA)</Td>
                    <Td>Processor — hosting, storage and transactional email (Amazon SES)</Td>
                    <Td>Encrypted account data, backup aggregates, email address and delivery metadata</Td>
                  </Tr>
                  <Tr>
                    <Td>Accountant, tax authorities, courts, where legally required</Td>
                    <Td>Independent controllers</Td>
                    <Td>Billing records only, to the extent required</Td>
                  </Tr>
                </Table>
                <P>
                  Each processor is bound by a data processing agreement under Article 28 GDPR
                  and may use your data only on our documented instructions. Apple and Stripe
                  act partly as controllers in their own right; for that processing, their own
                  privacy policies apply.
                </P>
              </section>

              <section id="transfers">
                <SectionHead n="7" title="International transfers" />
                <P>
                  Account and backup data is stored in AWS region{" "}
                  <B>eu-central-1 (Frankfurt, Germany)</B>, inside the European Economic Area,
                  and is not moved outside it in the ordinary course of running the service.
                </P>
                <P>Where personal data is transferred outside the EEA, we rely on:</P>
                <Ul>
                  <li className="my-2">
                    the European Commission&rsquo;s adequacy decision for the EU–US Data Privacy
                    Framework, where the recipient organisation is certified under it; and
                  </li>
                  <li className="my-2">
                    Standard Contractual Clauses adopted by the European Commission under
                    Article 46(2)(c) GDPR — including the AWS Data Transfer Addendum — together
                    with supplementary measures such as encryption in transit and at rest, as a
                    parallel safeguard.
                  </li>
                </Ul>
                <P>
                  You can request a copy of the safeguards we use by writing to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>
                  .
                </P>
              </section>

              <section id="retention">
                <SectionHead n="8" title="How long we keep it" />
                <Table head={["Data", "Retention"]}>
                  <Tr>
                    <Td>Account data (email, settings)</Td>
                    <Td>For as long as your account exists</Td>
                  </Tr>
                  <Tr>
                    <Td>Backup aggregates</Td>
                    <Td>For as long as your account exists and backup is switched on</Td>
                  </Tr>
                  <Tr>
                    <Td>Crash diagnostics</Td>
                    <Td>90 days from receipt</Td>
                  </Tr>
                  <Tr>
                    <Td>Website server logs</Td>
                    <Td>30 days</Td>
                  </Tr>
                  <Tr>
                    <Td>Support correspondence</Td>
                    <Td>Up to 3 years after the case is closed, matching the limitation period for business-related claims under Polish civil law</Td>
                  </Tr>
                  <Tr>
                    <Td>Billing and invoicing records</Td>
                    <Td>5 years from the end of the calendar year in which the tax payment deadline fell, as required by Polish accounting and tax law</Td>
                  </Tr>
                </Table>
                <P>
                  When you delete your account, we erase your personal data from active systems
                  immediately and from backups within 30 days. The one exception is billing
                  records, which we are legally required to keep for the period above and which
                  we do not use for any other purpose.
                </P>
                <P>
                  Fully anonymised aggregates, which can no longer be traced back to you, may be
                  retained indefinitely. Anonymised data is not personal data, so the rights
                  below do not apply to it.
                </P>
              </section>

              <section id="your-rights">
                <SectionHead n="9" title="Your rights" />

                <h3 className="mb-1.5 mt-5 text-[17px] tracking-[-0.01em] text-white">Everyone</h3>
                <P>
                  From <B>Settings → Privacy</B> in the app you can export your data, turn cloud
                  backup on or off, and delete your account. For anything else, write to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>
                  . We verify requests by confirming control of the account email address, and
                  we do not charge for them. You may use an authorised agent, who must provide
                  written proof of authority.
                </P>

                <h3 className="mb-1.5 mt-6 text-[17px] tracking-[-0.01em] text-white">
                  If the GDPR applies to you (EEA, UK)
                </h3>
                <P>
                  You have the right to <B>access</B>, <B>rectification</B>, <B>erasure</B>,{" "}
                  <B>restriction of processing</B>, <B>data portability</B>,{" "}
                  <B>objection</B> to processing based on legitimate interests (Art. 21), and{" "}
                  <B>withdrawal of consent</B> at any time without affecting the lawfulness of
                  earlier processing. We respond within one month, extendable by two further
                  months for complex requests, and we will tell you if we need the extension.
                </P>
                <P>
                  <B>Right to complain.</B> You can lodge a complaint with the Polish supervisory
                  authority:
                </P>
                <div className="mt-3.5 rounded-[16px] bg-card p-5 text-sm leading-[1.7] text-white/60">
                  Prezes Urzędu Ochrony Danych Osobowych (UODO)
                  <br />
                  ul. Stawki 2, 00-193 Warszawa, Poland — uodo.gov.pl
                </div>
                <P>If you live elsewhere in the EEA, you may complain to your local supervisory authority.</P>

                <h3 className="mb-1.5 mt-6 text-[17px] tracking-[-0.01em] text-white">
                  If you live in the United States
                </h3>
                <P>
                  Depending on your state, you may have the right to know what personal
                  information we collect and why, to obtain a copy of it, to correct it, to
                  delete it, to opt out of sale, sharing, or targeted advertising, and to be free
                  from discrimination for exercising these rights.
                </P>
                <P>
                  <B>
                    We do not sell your personal information and we do not share it for
                    cross-context behavioural advertising
                  </B>
                  , as those terms are defined in the California Consumer Privacy Act and
                  comparable state laws. We do not use or disclose sensitive personal
                  information for purposes beyond those permitted without a right to limit. We
                  do not knowingly collect or sell the personal information of anyone under 16.
                </P>
                <P>
                  Categories of personal information we collect are listed in §2, the sources
                  are you and your device, the purposes are in §2, and the categories of
                  recipients are in §6. We retain each category for the periods in §8.
                </P>
                <P>
                  <B>Appeals.</B> If we decline your request, you may appeal by replying to our
                  decision email or writing to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  with &ldquo;Appeal&rdquo; in the subject line. We will respond within 45 days
                  with a written explanation. If we deny the appeal, residents of Colorado,
                  Connecticut, Virginia and other states with an appeal right may contact their
                  state Attorney General.
                </P>

                <h3 className="mb-1.5 mt-6 text-[17px] tracking-[-0.01em] text-white">
                  If you live in Washington or Nevada
                </h3>
                <P>
                  Some of what RentYourTime handles may qualify as &ldquo;consumer health
                  data&rdquo; under Washington&rsquo;s My Health My Data Act and Nevada SB 370.
                  Those laws give you additional rights and require a separate notice, which you
                  will find here:{" "}
                  <Link href="/consumer-health-data-privacy" className="font-semibold text-signal">
                    Consumer Health Data Privacy Policy
                  </Link>
                  .
                </P>
              </section>

              <section id="security">
                <SectionHead n="10" title="How we protect your data" />
                <P>
                  We use encryption in transit (TLS) and at rest, access controls limiting
                  account data to the people who need it, and the on-device architecture
                  described in §3, which means the most sensitive data is simply not in our
                  possession. No system is perfectly secure, but if a breach is likely to result
                  in a high risk to your rights we will notify you without undue delay, as
                  Article 34 GDPR and applicable US state breach laws require.
                </P>
              </section>

              <section id="children">
                <SectionHead n="11" title="Children’s privacy" />
                <P>
                  RentYourTime is intended for people aged <B>16 and over</B>, and our App Store
                  age rating matches this. We do not knowingly collect personal information from
                  children under 13 (COPPA) or from anyone under 16. If you believe a child has
                  created an account, write to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  and we will delete it.
                </P>
              </section>

              <section id="changes">
                <SectionHead n="12" title="Changes to this policy" />
                <P>
                  If we make a meaningful change, we will update the date and version at the top
                  and notify you in the app or by email at least 14 days before it takes effect.
                  Where a change requires your consent, we will ask for it separately rather than
                  treating continued use as agreement. Previous versions are available on
                  request.
                </P>
              </section>

              <section id="contact">
                <SectionHead n="13" title="Contact" />
                <P>
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  — a human, not a bot, will reply.
                </P>
                <div className="mt-5 rounded-[18px] bg-card px-[22px] py-5 text-sm leading-[1.6] text-white/50">
                  The short version: <B>we help you look at your phone less, so we built the
                  whole thing to look at your data less.</B>
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
