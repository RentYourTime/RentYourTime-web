import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="text-[18px] font-bold tracking-[-0.02em] text-white no-underline">
      rentyourtime<span className="text-signal">.</span>
    </Link>
  );
}

/**
 * Primary marketing navigation. `active` highlights the matching link.
 */
export function SiteNav({ active }: { active?: "how" | "pricing" }) {
  const linkBase = "text-inherit no-underline transition-colors hover:text-white";
  return (
    <nav
      aria-label="Primary navigation"
      className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5 sm:px-12 sm:py-6"
    >
      <Wordmark />
      <div className="flex items-center gap-7 text-sm text-white/60">
        <Link
          href="/#how"
          className={`${linkBase} max-[900px]:hidden ${active === "how" ? "text-white" : ""}`}
        >
          How it works
        </Link>
        <Link href="/#how" className={`${linkBase} max-[900px]:hidden`}>
          Psychology
        </Link>
        <Link
          href="/pricing"
          className={`${linkBase} max-[900px]:hidden ${active === "pricing" ? "text-white" : ""}`}
        >
          Pricing
        </Link>
        <Link
          href="/account"
          className="inline-flex h-[38px] items-center rounded-[19px] border border-white/15 px-5 text-sm font-semibold text-white no-underline transition-colors max-[900px]:hidden hover:bg-white/5"
        >
          Account
        </Link>
        <Link
          href="/#waitlist-anchor"
          className="inline-flex h-[38px] items-center rounded-[19px] bg-white px-5 text-sm font-semibold text-ink no-underline transition-transform duration-150 ease-spring hover:scale-[1.03]"
        >
          Join waitlist
        </Link>
      </div>
    </nav>
  );
}
