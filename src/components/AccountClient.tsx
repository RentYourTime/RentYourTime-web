"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";

const TOKEN_KEY = "ryt-auth-token";

const ERROR_MAP: Record<string, string> = {
  email_taken: "This email already has an account.",
  invalid_credentials: "Incorrect email or password.",
  invalid_password: "Use at least 10 characters, with an uppercase letter, a lowercase letter, and a number.",
  invalid_email: "Enter a valid email address.",
};

const SOURCE_LABELS: Record<string, string> = {
  STRIPE: "Stripe",
  APPLE: "App Store",
  MANUAL: "Manual",
  NONE: "—",
};

const PLAN_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
  UNKNOWN: "—",
};

function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface SubscriptionData {
  is_pro: boolean;
  source: "STRIPE" | "APPLE" | "MANUAL" | "NONE";
  status: string;
  plan: "MONTHLY" | "YEARLY" | "UNKNOWN";
  current_period_end: number | null;
  auto_renew: boolean;
}

interface AccountData {
  email: string;
  subscription: SubscriptionData;
}

export function AccountClient() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [token, setToken] = useState<string>("");
  const [account, setAccount] = useState<AccountData | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean }>({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");

  const message = (text: string, error = false) => setStatus({ text, error });

  const api = useCallback(
    async (path: string, options: RequestInit & { auth?: string } = {}) => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (options.body) headers["Content-Type"] = "application/json";
      const t = options.auth ?? token;
      if (t) headers.Authorization = `Bearer ${t}`;
      const res = await fetch(`/api/${path}`, { ...options, headers });
      const data = await res.json().catch(() => {
        throw new Error("Invalid server response");
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    [token]
  );

  const loadAccount = useCallback(
    async (activeToken: string) => {
      const data = await api("me", { auth: activeToken });
      const subscription: SubscriptionData = data.user.subscription;
      setAccount({ email: data.user.email, subscription });
      if (subscription.is_pro) message("Pro is active on this account.");
    },
    [api]
  );

  // Restore an existing session on mount.
  useEffect(() => {
    const stored = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!stored) {
      setReady(true);
      return;
    }
    setToken(stored);
    loadAccount(stored)
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken("");
      })
      .finally(() => setReady(true));
  }, [loadAccount]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setBusy(true);
    message("");
    try {
      const auth = await api(mode, { method: "POST", body: JSON.stringify({ email, password }) });
      const newToken = auth.token as string;
      sessionStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      await loadAccount(newToken);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      message(ERROR_MAP[code] || "Something went wrong. Please try again.", true);
    } finally {
      setBusy(false);
    }
  }

  async function onCheckout() {
    setBusy(true);
    message("");
    try {
      const data = await api("checkout", { method: "POST", body: JSON.stringify({ plan }) });
      window.location.href = data.checkout_url;
    } catch {
      message("Checkout is not configured yet. Check the server settings.", true);
      setBusy(false);
    }
  }

  async function onLogout() {
    try {
      await api("logout", { method: "POST", body: "{}" });
    } catch {
      /* ignore — clear locally regardless */
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAccount(null);
    message("");
  }

  const authLabel = mode === "register" ? "Create account" : "Sign in";
  const statusColor = status.error ? "text-[#ff8a84]" : "text-white/50";

  return (
    <div className="mx-auto max-w-[1100px]">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav
        aria-label="Account navigation"
        className="flex h-[87px] items-center justify-between border-b border-white/[0.06] px-6 max-[600px]:h-[70px] sm:px-12"
      >
        <Wordmark href="/" />
        <Link href="/pricing" className="text-sm text-white/50 no-underline">
          ← Back to pricing
        </Link>
      </nav>

      <main id="main" className="flex justify-center px-6 py-[70px] max-[600px]:px-[18px] max-[600px]:py-9">
        <section className="w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-card p-8 max-[600px]:px-[22px] max-[600px]:py-[26px]">
          {/* auth panel */}
          {!account && (
            <div>
              <div className="text-xs font-bold tracking-[0.1em] text-signal">YOUR ACCOUNT</div>
              <h1 className="mb-2 mt-3 text-[34px] tracking-[-0.03em]">
                Unlock Pro<span className="text-signal">.</span>
              </h1>
              <p className="mb-[26px] text-[15px] leading-[1.5] text-white/50">
                Use the same account here and in the app. Your subscription will follow you
                automatically.
              </p>
              <div className="mb-[22px] grid grid-cols-2 gap-0 rounded-[22px] bg-[#0b0b0b] p-1">
                {(["register", "login"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      message("");
                    }}
                    className={`h-[38px] rounded-[19px] border-0 text-sm font-semibold ${
                      mode === m ? "bg-white/10 text-white" : "bg-transparent text-white/50"
                    }`}
                  >
                    {m === "register" ? "Create account" : "Sign in"}
                  </button>
                ))}
              </div>
              <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                <label htmlFor="email" className="mx-1 -mb-1.5 text-xs text-white/50">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="you@email.com"
                  className="h-[50px] rounded-2xl border-0 bg-white/[0.07] px-4 text-[15px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
                />
                <label htmlFor="password" className="mx-1 -mb-1.5 text-xs text-white/50">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  minLength={10}
                  maxLength={200}
                  required
                  placeholder="At least 10 characters"
                  className="h-[50px] rounded-2xl border-0 bg-white/[0.07] px-4 text-[15px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 h-[52px] rounded-[26px] border-0 bg-signal text-[15px] font-bold text-sig-ink disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Please wait…" : authLabel}
                </button>
              </form>
            </div>
          )}

          {/* account panel */}
          {account && (
            <div>
              <div className="text-xs font-bold tracking-[0.1em] text-signal">READY FOR PRO</div>
              <h1 className="mb-2 mt-3 text-[34px] tracking-[-0.03em]">
                Continue to checkout<span className="text-signal">.</span>
              </h1>
              <p className="mb-[26px] text-[15px] leading-[1.5] text-white/50">
                Stripe securely handles the payment. RentYourTime never receives your card details.
              </p>
              <div className="mb-5 border-b border-white/[0.08] pb-6 pt-4">
                <b className="block">{account.email}</b>
                <span className="mt-[5px] block text-[13px] text-white/50">
                  Current plan: {account.subscription.is_pro ? "Pro" : "Free"}
                </span>
                {account.subscription.is_pro && (
                  <span className="mt-1 block text-[13px] text-white/50">
                    {SOURCE_LABELS[account.subscription.source]} ·{" "}
                    {PLAN_LABELS[account.subscription.plan]}
                    {account.subscription.current_period_end && (
                      <>
                        {" "}
                        · {account.subscription.auto_renew ? "renews" : "ends"}{" "}
                        {formatDate(account.subscription.current_period_end)}
                      </>
                    )}
                  </span>
                )}
              </div>
              {!account.subscription.is_pro && (
                <>
                  <div className="mb-3 grid grid-cols-2 gap-0 rounded-[22px] bg-[#0b0b0b] p-1">
                    {(
                      [
                        { id: "monthly", label: "Monthly", price: "$8.99/mo" },
                        { id: "yearly", label: "Yearly", price: "$89.99/yr" },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        className={`flex h-[46px] flex-col items-center justify-center rounded-[18px] border-0 leading-tight ${
                          plan === p.id ? "bg-white/10 text-white" : "bg-transparent text-white/50"
                        }`}
                      >
                        <span className="text-[13px] font-semibold">{p.label}</span>
                        <span className="text-[12px] opacity-80">{p.price}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onCheckout}
                    disabled={busy}
                    className="h-[52px] w-full rounded-[26px] border-0 bg-signal text-[15px] font-bold text-sig-ink disabled:cursor-wait disabled:opacity-60"
                  >
                    {busy
                      ? "Please wait…"
                      : plan === "monthly"
                        ? "Continue to Stripe · $8.99/month"
                        : "Continue to Stripe · $89.99/year"}
                  </button>
                  {plan === "yearly" && (
                    <div className="mt-2 text-center text-[12px] text-signal">
                      Save 17% vs monthly
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="mx-auto mt-[18px] block border-0 bg-transparent text-white/50"
              >
                Sign out
              </button>
            </div>
          )}

          <div className={`mt-3.5 min-h-5 text-[13px] leading-[1.45] ${statusColor}`} role="status" aria-live="polite">
            {ready ? status.text : ""}
          </div>
          <div className="mt-5 text-center text-[11px] text-white/30">
            Subscriptions are confirmed by the payment provider before Pro is activated.
          </div>
        </section>
      </main>
    </div>
  );
}
