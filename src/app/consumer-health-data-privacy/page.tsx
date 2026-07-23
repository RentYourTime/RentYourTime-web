import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/motion/Reveal";
import { GlowLayer } from "@/components/motion/GlowLayer";
import { ScrollProgressBar } from "@/components/motion/ScrollProgressBar";

export const metadata: Metadata = {
  title: "Consumer Health Data Privacy Policy",
  description:
    "RentYourTime's Washington My Health My Data Act and Nevada SB 370 disclosures for consumer health data.",
};

const toc = [
  ["what-we-collect", "1. What we collect, and why"],
  ["source", "2. Where the data comes from"],
  ["sharing", "3. What we share, and with whom"],
  ["no-sale", "4. We do not sell your data"],
  ["no-geofencing", "5. We do not use geofencing"],
  ["your-rights", "6. Your rights, and how to use them"],
  ["security", "7. How we keep it safe"],
  ["changes", "8. Changes"],
  ["contact", "9. Contact"],
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
      <table className="w-full min-w-[480px] border-collapse text-left text-[13px] leading-[1.5]">
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

export default function ConsumerHealthDataPrivacyPage() {
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
              CONSUMER HEALTH DATA PRIVACY POLICY
            </Reveal>
            <Reveal
              as="h1"
              delayMs={68}
              className="m-0 mt-4 text-[34px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[46px]"
            >
              For Washington and Nevada residents<span className="text-signal">.</span>
            </Reveal>
            <Reveal delayMs={136} className="m-0 mt-[22px] text-lg leading-[1.6] text-white/55">
              This policy is required by the Washington My Health My Data Act (RCW 19.373) and
              the Nevada consumer health data law (SB 370, 2023). It applies only to consumer
              health data, and only to residents of Washington and Nevada and to data collected
              in those states. All other data we handle is described in our main{" "}
              <Link href="/privacy" className="font-semibold text-signal">
                Privacy Policy
              </Link>
              .
            </Reveal>
            <Reveal delayMs={170} className="m-0 mt-4 text-sm leading-[1.6] text-white/40">
              The controller of this data — the &ldquo;regulated entity&rdquo; under both laws
              — is <B>ATLASHC Paweł Dolatowski</B>, ul. Sadowa 9, 64-514 Pamiątkowo, Poland,{" "}
              <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                privacy@rentyourtime.app
              </a>
              .
            </Reveal>
            <Reveal
              delayMs={204}
              className="mt-[26px] flex flex-wrap gap-6 text-[13px] text-white/40"
            >
              <span>
                Effective <b className="font-semibold text-white/65">July 23, 2026</b>
              </span>
              <span>Version 1.0</span>
            </Reveal>
          </header>

          <section className="flex flex-wrap items-start gap-14 px-6 pb-6 pt-11 sm:px-12">
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
              <section id="what-we-collect">
                <SectionHead n="1" title="What consumer health data we collect, and why" />
                <P>
                  RentYourTime is a digital wellbeing app. Most of what it measures never
                  reaches us: your per-app breakdown and your live usage meter are computed and
                  stored on your iPhone using Apple&rsquo;s Screen Time frameworks, and we
                  cannot read them.
                </P>
                <P>We treat the following as consumer health data:</P>
                <Table head={["Category", "Purpose and use"]}>
                  <Tr>
                    <Td>
                      Aggregated daily wellbeing totals — minutes over your allowance and
                      &ldquo;rent avoided&rdquo; — collected only if you switch on cloud backup
                    </Td>
                    <Td>To restore your streak and history when you move to a new phone. Nothing else.</Td>
                  </Tr>
                  <Tr>
                    <Td>The account identifier (your email address) to the extent it links you to the totals above</Td>
                    <Td>To associate the backup with your account so it can be restored to you</Td>
                  </Tr>
                </Table>
                <P>
                  We do not collect any other category of consumer health data. We do not infer
                  or derive health conditions, diagnoses, treatment, medication use,
                  reproductive or sexual health information, biometric or genetic data, or
                  precise location from what we collect, and we do not collect precise location
                  at all.
                </P>
                <P>
                  If we ever wish to collect a category or serve a purpose not listed above, we
                  will ask for your consent first.
                </P>
              </section>

              <section id="source">
                <SectionHead n="2" title="Where the data comes from" />
                <P>
                  The sole source is <B>you and your iPhone</B>, through the RentYourTime app,
                  after you switch on cloud backup. We do not obtain consumer health data from
                  data brokers, advertising networks, public records, or any other outside
                  source.
                </P>
              </section>

              <section id="sharing">
                <SectionHead n="3" title="What we share, and with whom" />
                <P>We do not share consumer health data with third parties for their own purposes.</P>
                <P>
                  The data described in §1 is stored on our behalf by a service provider acting
                  as our processor under a written contract that forbids any use other than
                  delivering the service to you:
                </P>
                <Table head={["Processor", "Role", "Contact"]}>
                  <Tr>
                    <Td>Amazon Web Services EMEA SARL (Luxembourg) / Amazon Web Services, Inc. (USA)</Td>
                    <Td>Hosting and encrypted storage in AWS region eu-central-1 (Frankfurt, Germany)</Td>
                    <Td>aws.amazon.com/contact-us</Td>
                  </Tr>
                </Table>
                <P>We share no consumer health data with affiliates. We have no affiliates.</P>
              </section>

              <section id="no-sale">
                <SectionHead n="4" title="We do not sell your consumer health data" />
                <P>
                  We have never sold consumer health data and we do not sell it. Under both
                  laws, any sale would require your signed, separate valid authorization
                  obtained in advance, and we would have to give you a copy of it. We are not
                  asking for one.
                </P>
              </section>

              <section id="no-geofencing">
                <SectionHead n="5" title="We do not use geofencing" />
                <P>
                  We do not use a geofence around any health care facility, and we do not use
                  geofencing to identify or track you, to collect consumer health data, or to
                  send you notifications or advertising. We do not collect precise location
                  information.
                </P>
              </section>

              <section id="your-rights">
                <SectionHead n="6" title="Your rights, and how to use them" />
                <P>Washington and Nevada residents have the right to:</P>
                <Ul>
                  <li className="my-2">
                    <B>Confirm and access.</B> Ask whether we are collecting, sharing, or
                    selling your consumer health data, and receive a copy of it, together with a
                    list of all third parties and affiliates with whom we have shared or sold it
                    and an active means of contacting them.
                  </li>
                  <li className="my-2">
                    <B>Withdraw consent.</B> Withdraw your consent to our collection of your
                    consumer health data, and separately to any sharing of it.
                  </li>
                  <li className="my-2">
                    <B>Delete.</B> Have your consumer health data deleted from our records.
                  </li>
                </Ul>

                <P>
                  <B>Self-service.</B> The fastest route for all three is inside the app, at{" "}
                  <B>Settings → Privacy</B>: switch cloud backup off to withdraw consent and
                  stop collection, export your data, or delete your account.
                </P>
                <P>
                  <B>By email.</B> Write to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  with the subject line &ldquo;Consumer Health Data Request&rdquo; from the
                  email address on your account. That is how we verify you. You may use an
                  authorised agent, who must supply written proof of authority.
                </P>
                <P>
                  <B>Our response.</B> We answer within 45 days. If we need more time, we will
                  tell you within those 45 days and take up to 45 days more. Requests are free,
                  up to twice a year.
                </P>
                <P>
                  <B>Deletion.</B> When you ask us to delete, we remove your consumer health data
                  from our active systems and from archived and backup systems within 30 days,
                  and we notify our processor to do the same. We will confirm when it is done.
                </P>
                <P>
                  <B>Appeals.</B> If we refuse a request, we will tell you why and how to appeal.
                  Write to{" "}
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  with &ldquo;Appeal&rdquo; in the subject line and we will respond in writing.
                  If we deny your appeal, you may complain to your Attorney General:
                </P>
                <div className="mt-3.5 flex flex-col gap-3 rounded-[16px] bg-card p-5 text-sm leading-[1.6] text-white/60">
                  <div>
                    <B>Washington:</B> Office of the Attorney General, Consumer Protection
                    Division — file a complaint at atg.wa.gov
                  </div>
                  <div>
                    <B>Nevada:</B> Office of the Attorney General, Bureau of Consumer Protection
                    — ag.nv.gov
                  </div>
                </div>
              </section>

              <section id="security">
                <SectionHead n="7" title="How we keep it safe" />
                <P>
                  We restrict access to consumer health data to the people who need it to do
                  their job, and we protect it with encryption in transit and at rest and with
                  the on-device architecture described in §1, which means most of what the app
                  measures is never in our possession at all.
                </P>
              </section>

              <section id="changes">
                <SectionHead n="8" title="Changes" />
                <P>
                  If we change this policy in a way that affects you, we will update the version
                  and date above and tell you inside the app before the change takes effect.
                  Where a change requires your consent, we will ask for it separately.
                </P>
              </section>

              <section id="contact">
                <SectionHead n="9" title="Contact" />
                <P>
                  <a href="mailto:privacy@rentyourtime.app" className="font-semibold">
                    privacy@rentyourtime.app
                  </a>{" "}
                  — a human, not a bot, will reply.
                </P>
              </section>
            </article>
          </section>
        </main>

        <SiteFooter href="/privacy" label="Back to the main Privacy Policy →" />
      </div>
    </div>
  );
}
