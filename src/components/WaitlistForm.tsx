"use client";

import { useEffect, useRef, useState } from "react";

const BASE_COUNT = 4218;

type StatusType = "" | "success" | "error";

export function WaitlistForm() {
  const [serverCount, setServerCount] = useState(0);
  const [status, setStatus] = useState<{ text: string; type: StatusType }>({ text: "", type: "" });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/waitlist", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (alive && data?.ok) setServerCount(Math.max(0, Number(data.count) || 0));
      })
      .catch(() => {
        /* Base count stays visible when the API is unavailable. */
      });
    return () => {
      alive = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = inputRef.current!;
    const email = input.value.trim();
    if (!email || !input.checkValidity()) {
      input.reportValidity();
      return;
    }
    setBusy(true);
    setStatus({ text: "", type: "" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email,
          website: (form.elements.namedItem("website") as HTMLInputElement)?.value ?? "",
        }),
      });
      const data = await res.json().catch(() => {
        throw new Error("response");
      });
      if (!res.ok || !data.ok) throw new Error(data.error || "request");
      setServerCount(Math.max(0, Number(data.count) || 0));
      input.value = "";
      setStatus({
        text:
          data.new === false
            ? "You’re already on the list — see you this fall."
            : "You’re in! Check back this fall.",
        type: "success",
      });
    } catch {
      setStatus({
        text: "We couldn’t save your email. Please try again in a moment.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const total = (BASE_COUNT + serverCount).toLocaleString("en-US");
  const statusColor =
    status.type === "success"
      ? "text-signal"
      : status.type === "error"
        ? "text-[#ff8a84]"
        : "text-white/55";

  return (
    <>
      <form className="flex max-w-[440px] gap-2.5" onSubmit={onSubmit} noValidate>
        <span id="waitlist-anchor" />
        <input
          ref={inputRef}
          type="email"
          name="email"
          placeholder="you@email.com"
          aria-label="Email address"
          autoComplete="email"
          maxLength={254}
          required
          className="h-[54px] min-w-0 flex-1 rounded-[27px] border-0 bg-white/[0.07] px-5 text-[15px] text-white outline-none placeholder:text-white/35 focus:bg-white/10"
        />
        <label className="sr-only absolute h-px w-px overflow-hidden" aria-hidden="true">
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="h-[54px] whitespace-nowrap rounded-[27px] border-0 bg-signal px-6 text-[15px] font-semibold text-sig-ink transition-transform duration-150 ease-spring active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? "Joining…" : "Get early access"}
        </button>
      </form>
      <div className={`min-h-5 max-w-[440px] text-[13px] ${statusColor}`} role="status" aria-live="polite">
        {status.text}
      </div>
      <div className="text-[13px] text-white/40">
        <b className="tnum font-semibold text-white/60">{total}</b> on the waitlist · founders get
        85% off forever
      </div>
    </>
  );
}
