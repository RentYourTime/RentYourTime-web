"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";
import { AdminWaitlistPanel } from "@/components/AdminWaitlistPanel";

const TOKEN_KEY = "ryt-auth-token";

type Gate = "checking" | "denied" | "granted";

export function AdminWaitlistClient() {
  const [gate, setGate] = useState<Gate>("checking");
  const [token, setToken] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!stored) {
      setGate("denied");
      return;
    }
    setToken(stored);
    fetch("/api/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setGate(data?.ok && data.user?.role === "ADMIN" ? "granted" : "denied"))
      .catch(() => setGate("denied"));
  }, []);

  if (gate === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[14px] text-white/40">
        Checking access…
      </div>
    );
  }

  if (gate === "denied") {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-24 text-center">
        <p className="text-[15px] text-white/50">You need an admin account to view this page.</p>
        <Link
          href="/account"
          className="mt-4 inline-block text-[13px] font-semibold text-signal underline"
        >
          Go to your account
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav
        aria-label="Admin navigation"
        className="flex h-[87px] items-center justify-between border-b border-white/[0.06] px-6 max-[600px]:h-[70px] sm:px-12"
      >
        <div className="flex items-center gap-3.5">
          <Wordmark href="/" />
          <span className="rounded-md border border-white/[0.12] px-2 py-[3px] text-[11px] font-bold tracking-[0.08em] text-white/40">
            ADMIN
          </span>
        </div>
        <Link href="/account" className="text-sm text-white/50 no-underline">
          ← Back to account
        </Link>
      </nav>

      <main className="px-6 py-10 sm:px-12">
        <AdminWaitlistPanel token={token} />
      </main>
    </div>
  );
}
