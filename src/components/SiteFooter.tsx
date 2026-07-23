import Link from "next/link";

export function SiteFooter({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-white/[0.06] px-6 py-8 text-[13px] text-white/35 max-[900px]:flex-col sm:px-12">
      <span>
        Every minute costs<span className="text-signal">.</span>
      </span>
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/privacy" className="link-underline text-white/50 no-underline hover:text-white">
          Privacy
        </Link>
        <Link href="/teams" className="link-underline text-white/50 no-underline hover:text-white">
          Teams
        </Link>
        <Link href="/terms" className="link-underline text-white/50 no-underline hover:text-white">
          Terms
        </Link>
        <Link href={href} className="text-signal no-underline">
          {label}
        </Link>
      </div>
    </footer>
  );
}
