"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/SiteNav";

type VerifyStatus =
  | "verifying"
  | "verified"
  | "already_verified"
  | "invalid"
  | "missing_token"
  | "error";

const COPY: Record<VerifyStatus, { title: string; subtitle: string }> = {
  verifying: { title: "Verifying your email…", subtitle: "This only takes a moment." },
  verified: { title: "Email confirmed.", subtitle: "Your RentYourTime account is ready." },
  already_verified: {
    title: "Already verified.",
    subtitle: "This account's email address is already confirmed.",
  },
  invalid: {
    title: "This verification link is invalid or has expired.",
    subtitle: "Request a new verification email.",
  },
  missing_token: {
    title: "Missing verification link.",
    subtitle: "Open the link from your verification email, or request a new one.",
  },
  error: {
    title: "Something went wrong.",
    subtitle: "Please try again in a moment.",
  },
};

export function VerifyClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerifyStatus>("verifying");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("missing_token");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && data?.ok) setStatus("verified");
        else if (res.status === 409) setStatus("already_verified");
        else if (res.status === 400) setStatus("invalid");
        else setStatus("error");
      } catch {
        if (!cancelled) setStatus("error");
      } finally {
        // Strip the (single-use) token from the address bar regardless of
        // outcome, so it doesn't linger in browser history or bfcache.
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/verify");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once, against whatever token was present when the page loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = COPY[status];
  const showAccountButton = status === "verified" || status === "already_verified";
  const showResendHint = status === "invalid" || status === "missing_token";

  return (
    <div className="mx-auto max-w-[1100px]">
      <nav
        aria-label="Verify navigation"
        className="flex h-[87px] items-center justify-between border-b border-white/[0.06] px-6 max-[600px]:h-[70px] sm:px-12"
      >
        <Wordmark href="/" />
      </nav>

      <main className="flex justify-center px-6 py-[70px] max-[600px]:px-[18px] max-[600px]:py-9">
        <section className="w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-card p-8 text-center max-[600px]:px-[22px] max-[600px]:py-[26px]">
          <div className="text-xs font-bold tracking-[0.1em] text-signal">VERIFY ACCOUNT</div>
          <h1 className="mb-2 mt-3 text-[26px] leading-[1.2] tracking-[-0.02em]">{copy.title}</h1>
          <p
            className="text-[15px] leading-[1.55] text-white/50"
            role="status"
            aria-live="polite"
          >
            {copy.subtitle}
          </p>
          {showAccountButton && (
            <Link
              href="/account"
              className="mt-6 inline-flex h-[52px] items-center justify-center rounded-[26px] bg-signal px-8 text-[15px] font-bold text-sig-ink no-underline"
            >
              Go to your account
            </Link>
          )}
          {showResendHint && (
            <Link
              href="/account"
              className="mt-6 inline-block text-[13px] font-semibold text-signal underline"
            >
              Request a new verification email
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
