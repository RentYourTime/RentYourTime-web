"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CopyButton } from "./CopyButton";

export interface OverviewUser {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  created_at: string;
  role: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2.5 last:border-0">
      <span className="text-white/40">{label}</span>
      <span className="text-right text-white">{children}</span>
    </div>
  );
}

export type ResendStatus = "idle" | "sending" | "sent";

export function AccountOverview({
  user,
  onLogout,
  onResendVerification,
  resendStatus,
  busy,
}: {
  user: OverviewUser;
  onLogout: () => void;
  onResendVerification: () => void;
  resendStatus: ResendStatus;
  busy: boolean;
}) {
  return (
    <section
      aria-labelledby="account-overview-heading"
      className="rounded-[28px] border border-white/[0.08] bg-card p-6 sm:p-8"
    >
      <h2
        id="account-overview-heading"
        className="text-xs font-bold tracking-[0.1em] text-signal"
      >
        ACCOUNT
      </h2>

      {!user.email_verified && (
        <div
          role="alert"
          className="mt-4 flex flex-col items-start gap-2 rounded-2xl bg-[#3a2410] px-4 py-3 text-[13px] text-[#ffb86b] sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Your email address has not been verified.</span>
          <button
            type="button"
            onClick={onResendVerification}
            disabled={busy || resendStatus === "sending"}
            className="shrink-0 rounded-full border border-[#ffb86b]/40 bg-transparent px-3 py-1.5 text-[12px] font-semibold text-[#ffb86b] transition-colors hover:bg-[#ffb86b]/10 disabled:cursor-wait disabled:opacity-60"
          >
            {resendStatus === "sending"
              ? "Sending…"
              : resendStatus === "sent"
                ? "Email sent"
                : "Resend verification email"}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col text-[14px]">
        <Row label="Name">{user.display_name || "—"}</Row>
        <Row label="Email">{user.email}</Row>
        <Row label="User ID">
          <span className="flex items-center gap-2">
            <code className="truncate text-white/70">{user.id}</code>
            <CopyButton value={user.id} label="Copy" />
          </span>
        </Row>
        <Row label="Member since">{formatDate(user.created_at)}</Row>
        <Row label="Email verified">{user.email_verified ? "Verified" : "Not verified"}</Row>
      </div>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link
          href="/panel"
          className="inline-flex h-11 items-center rounded-full border border-white/10 bg-transparent px-5 text-[13px] font-semibold text-white/70 no-underline transition-colors hover:bg-white/5"
        >
          Open your dashboard →
        </Link>
        {user.role === "ADMIN" && (
          <Link
            href="/admin"
            className="inline-flex h-11 items-center rounded-full border border-signal/30 bg-signal/[0.08] px-5 text-[13px] font-semibold text-signal no-underline transition-colors hover:bg-signal/[0.14]"
          >
            Admin panel →
          </Link>
        )}
        {user.role === "ADMIN_TEAMS" && (
          <Link
            href="/team-admin"
            className="inline-flex h-11 items-center rounded-full border border-signal/30 bg-signal/[0.08] px-5 text-[13px] font-semibold text-signal no-underline transition-colors hover:bg-signal/[0.14]"
          >
            Team admin panel →
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={onLogout}
        disabled={busy}
        aria-label="Sign out of your account"
        className="mt-3.5 h-11 rounded-full border border-white/10 bg-transparent px-5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/5 focus:outline-none focus-visible:shadow-[0_0_0_1px_var(--signal)] disabled:cursor-wait disabled:opacity-60"
      >
        Sign out
      </button>
    </section>
  );
}
