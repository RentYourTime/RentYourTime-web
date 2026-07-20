import Link from "next/link";

export function SiteFooter({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-8 text-[13px] text-white/35 max-[900px]:flex-col sm:px-12">
      <span>
        Every minute costs<span className="text-signal">.</span>
      </span>
      <Link href={href} className="text-signal no-underline">
        {label}
      </Link>
    </footer>
  );
}
