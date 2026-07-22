"use client";

import { useState } from "react";

/** Reusable "Copy" button for identifiers (User ID, Subscription ID, Invoice ID, ...). */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — button just
      // won't confirm; nothing to recover from here.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Copied to clipboard" : `${label} to clipboard`}
      className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:shadow-[0_0_0_1px_var(--signal)]"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
