import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Confetti } from "@/components/Confetti";

export const metadata: Metadata = {
  title: "Welcome to Pro",
  description: "Thanks for upgrading to RentYourTime Pro.",
};

const DISCORD_URL = "https://discord.gg/BWVeQxRDsx";

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-[1100px]">
      <Confetti />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav
        aria-label="Account navigation"
        className="flex h-[87px] items-center justify-between border-b border-white/[0.06] px-6 max-[600px]:h-[70px] sm:px-12"
      >
        <Wordmark href="/" />
        <Link href="/account" className="text-sm text-white/50 no-underline">
          Manage account →
        </Link>
      </nav>

      <main
        id="main"
        className="flex flex-col items-center px-6 py-[72px] text-center max-[600px]:py-12"
      >
        {/* success ring */}
        <div
          className="mb-8 flex size-[112px] items-center justify-center rounded-full"
          style={{ background: "conic-gradient(var(--signal) 0 100%, var(--signal) 0)" }}
        >
          <div className="flex size-[96px] items-center justify-center rounded-full bg-ink">
            <svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{ filter: "drop-shadow(0 0 8px rgba(0,230,118,0.5))" }}
            >
              <path
                d="M5 12.5l4.2 4.3L19 7"
                stroke="var(--signal)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-[13px] font-bold tracking-[0.1em] text-signal">PAYMENT CONFIRMED</div>
        <h1 className="mx-auto mt-3 max-w-[620px] text-[40px] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[52px]">
          You&rsquo;re in. Welcome to Pro<span className="text-signal">.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[500px] text-[18px] leading-[1.55] text-white/55">
          Thank you for upgrading. Every Pro subscription helps us keep building a calmer, more
          honest relationship with your phone. Pro unlocks automatically once your payment is
          confirmed — you don&rsquo;t need to do anything else.
        </p>

        {/* Discord CTA */}
        <div className="mt-10 w-full max-w-[420px]">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[56px] w-full items-center justify-center gap-3 rounded-[28px] text-[16px] font-semibold text-white no-underline transition-transform duration-150 ease-spring hover:scale-[1.02]"
            style={{ background: "#5865F2" }}
          >
            <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
              <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
            </svg>
            Join the Discord
          </a>
          <p className="mt-3 text-[13px] text-white/40">
            Meet other members, share wins, and shape what we build next.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/demo"
              className="flex h-[52px] w-full items-center justify-center rounded-[26px] bg-white/[0.08] text-[15px] font-semibold text-white no-underline transition-transform duration-150 ease-spring hover:scale-[1.02]"
            >
              Open the app demo
            </Link>
            <Link href="/" className="text-[14px] text-white/45 no-underline hover:text-white">
              Back to home
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter href="/pricing" label="View plans →" />
    </div>
  );
}
