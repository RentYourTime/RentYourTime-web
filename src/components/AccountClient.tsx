"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/SiteNav";
import { AuthPanel, type AuthSubmitPayload } from "@/components/AuthPanel";
import { AccountOverview, type OverviewUser, type ResendStatus } from "@/components/AccountOverview";
import { SubscriptionCard, type SubscriptionData } from "@/components/SubscriptionCard";
import { BillingHistory, type InvoicesState } from "@/components/BillingHistory";

const TOKEN_KEY = "ryt-auth-token";

const ERROR_MAP: Record<string, string> = {
  email_taken: "This email already has an account.",
  invalid_credentials: "Incorrect email or password.",
  invalid_password:
    "Use at least 10 characters, with an uppercase letter, a lowercase letter, and a number.",
  invalid_email: "Enter a valid email address.",
  customer_not_found: "No billing account yet — subscribe to Pro first.",
};

interface AccountData extends OverviewUser {
  subscription: SubscriptionData;
}

export function AccountClient() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [token, setToken] = useState<string>("");
  const [account, setAccount] = useState<AccountData | null>(null);
  const [invoicesState, setInvoicesState] = useState<InvoicesState>({ status: "loading" });
  const [invoicesRefreshing, setInvoicesRefreshing] = useState(false);
  const [status, setStatus] = useState<{ text: string; error: boolean }>({
    text: "",
    error: false,
  });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");

  const message = useCallback(
    (text: string, error = false) => setStatus({ text, error }),
    []
  );

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

  const loadInvoices = useCallback(
    async (activeToken: string, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setInvoicesState({ status: "loading" });
      setInvoicesRefreshing(true);
      try {
        const data = await api("billing/invoices", { auth: activeToken });
        setInvoicesState({ status: "ready", invoices: data.invoices });
      } catch {
        setInvoicesState({ status: "error", message: "Couldn't load billing history." });
      } finally {
        setInvoicesRefreshing(false);
      }
    },
    [api]
  );

  const loadAccount = useCallback(
    async (activeToken: string) => {
      const data = await api("me", { auth: activeToken });
      setAccount({
        id: data.user.id,
        email: data.user.email,
        display_name: data.user.display_name,
        email_verified: !!data.user.email_verified,
        created_at: data.user.created_at,
        subscription: data.user.subscription,
      });
      if (data.user.subscription?.is_pro) message("Pro is active on this account.");
      setResendStatus("idle");
      void loadInvoices(activeToken);
    },
    [api, loadInvoices, message]
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
    // Restoring a session only needs to happen once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAuthSubmit(payload: AuthSubmitPayload) {
    setBusy(true);
    message("");
    try {
      const body: Record<string, string> = { email: payload.email, password: payload.password };
      if (mode === "register" && payload.displayName) body.displayName = payload.displayName;
      const auth = await api(mode, { method: "POST", body: JSON.stringify(body) });
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

  async function onResendVerification() {
    setResendStatus("sending");
    try {
      await api("resend-verification", { method: "POST", body: "{}" });
      setResendStatus("sent");
    } catch {
      // The endpoint itself always returns a generic success message, so a
      // thrown error here means the request didn't even reach it (offline,
      // rate-limited, etc.) — fall back to idle so the button is retryable.
      setResendStatus("idle");
      message("Couldn't send the verification email. Please try again.", true);
    }
  }

  async function onManageSubscription() {
    setBusy(true);
    message("");
    try {
      const data = await api("billing/portal", { method: "POST", body: "{}" });
      window.location.href = data.portal_url;
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      message(ERROR_MAP[code] || "Couldn't open the billing portal.", true);
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
    setInvoicesState({ status: "loading" });
    message("");
  }

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

      <main
        id="main"
        className="flex justify-center px-6 py-[70px] max-[600px]:px-[18px] max-[600px]:py-9"
      >
        <div className="flex w-full max-w-[560px] flex-col gap-5">
          {!account ? (
            <section className="rounded-[28px] border border-white/[0.08] bg-card p-8 max-[600px]:px-[22px] max-[600px]:py-[26px]">
              <AuthPanel
                mode={mode}
                onModeChange={setMode}
                onSubmit={onAuthSubmit}
                busy={busy}
                message={message}
              />
              <div
                className={`mt-3.5 min-h-5 text-[13px] leading-[1.45] ${statusColor}`}
                role="status"
                aria-live="polite"
              >
                {ready ? status.text : ""}
              </div>
            </section>
          ) : (
            <>
              <AccountOverview
                user={account}
                onLogout={onLogout}
                onResendVerification={onResendVerification}
                resendStatus={resendStatus}
                busy={busy}
              />
              <SubscriptionCard
                subscription={account.subscription}
                plan={plan}
                onPlanChange={setPlan}
                onCheckout={onCheckout}
                onManageSubscription={onManageSubscription}
                busy={busy}
              />
              <BillingHistory
                state={invoicesState}
                refreshing={invoicesRefreshing}
                onRefresh={() => loadInvoices(token)}
              />
              <div
                className={`text-center text-[13px] leading-[1.45] ${statusColor}`}
                role="status"
                aria-live="polite"
              >
                {status.text}
              </div>
            </>
          )}
          <div className="text-center text-[11px] text-white/30">
            Subscriptions are confirmed by the payment provider before Pro is activated.
          </div>
        </div>
      </main>
    </div>
  );
}
