"use client";

import { useRef, useState } from "react";

type StatusType = "" | "success" | "error";

export function TeamsPilotForm() {
  const [status, setStatus] = useState<{ text: string; type: StatusType }>({ text: "", type: "" });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = inputRef.current!;
    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    setBusy(true);
    setStatus({ text: "", type: "" });
    try {
      const res = await fetch("/api/teams/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => {
        throw new Error("response");
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "request");
      input.value = "";
      setStatus({
        text: "Thanks — we’ll reach out within one business day to set up your pilot.",
        type: "success",
      });
    } catch {
      setStatus({ text: "We couldn’t send that. Please try again in a moment.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const statusColor =
    status.type === "success"
      ? "text-signal"
      : status.type === "error"
        ? "text-[#ff8a84]"
        : "text-white/55";

  return (
    <>
      <form className="mt-6 flex max-w-[480px] flex-wrap gap-2.5" onSubmit={onSubmit} noValidate>
        <input
          ref={inputRef}
          type="email"
          name="email"
          placeholder="you@company.com"
          aria-label="Work email address"
          autoComplete="email"
          maxLength={254}
          required
          className="h-[54px] min-w-0 flex-1 basis-[220px] rounded-[27px] border-0 bg-white/[0.07] px-5 text-[15px] text-white outline-none placeholder:text-white/35 focus:bg-white/10"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-[54px] whitespace-nowrap rounded-[27px] border-0 bg-signal px-6 text-[15px] font-semibold text-sig-ink transition-transform duration-150 ease-spring active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? "Sending…" : "Request a pilot"}
        </button>
      </form>
      <div className={`mt-2.5 min-h-5 text-[13px] ${statusColor}`} role="status" aria-live="polite">
        {status.text}
      </div>
    </>
  );
}
