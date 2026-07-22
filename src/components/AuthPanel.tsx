"use client";

export interface AuthSubmitPayload {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Login/register form. Validates confirmPassword match and ToS/Privacy
 * acceptance client-side only (the API still only ever receives one
 * `password`) — there's no `tos_accepted` column, this is a pure UX gate.
 */
export function AuthPanel({
  mode,
  onModeChange,
  onSubmit,
  busy,
  message,
}: {
  mode: "register" | "login";
  onModeChange: (mode: "register" | "login") => void;
  onSubmit: (payload: AuthSubmitPayload) => void;
  busy: boolean;
  message: (text: string, error?: boolean) => void;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const displayNameInput = form.elements.namedItem("displayName") as HTMLInputElement | null;
    const displayName = displayNameInput?.value.trim() ?? "";

    if (mode === "register") {
      const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement)
        .value;
      if (password !== confirmPassword) {
        message("Passwords don't match.", true);
        return;
      }
      const tos = (form.elements.namedItem("acceptTos") as HTMLInputElement).checked;
      const privacy = (form.elements.namedItem("acceptPrivacy") as HTMLInputElement).checked;
      if (!tos || !privacy) {
        message("You must accept the Terms of Service and Privacy Policy.", true);
        return;
      }
    }

    onSubmit({ email, password, displayName });
  }

  const authLabel = mode === "register" ? "Create account" : "Sign in";

  return (
    <div>
      <div className="text-xs font-bold tracking-[0.1em] text-signal">YOUR ACCOUNT</div>
      <h1 className="mb-2 mt-3 text-[34px] tracking-[-0.03em]">
        Unlock Pro<span className="text-signal">.</span>
      </h1>
      <p className="mb-[26px] text-[15px] leading-[1.5] text-white/50">
        Use the same account here and in the app. Your subscription will follow you
        automatically.
      </p>
      <div
        role="tablist"
        aria-label="Choose account action"
        className="mb-[22px] grid grid-cols-2 gap-0 rounded-[22px] bg-[#0b0b0b] p-1"
      >
        {(["register", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              onModeChange(m);
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
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {mode === "register" && (
          <>
            <label htmlFor="displayName" className="mx-1 -mb-1.5 text-xs text-white/50">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={80}
              placeholder="Optional"
              className="h-[50px] rounded-2xl border-0 bg-white/[0.07] px-4 text-[15px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
            />
          </>
        )}
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
        {mode === "register" && (
          <>
            <label htmlFor="confirmPassword" className="mx-1 -mb-1.5 text-xs text-white/50">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={200}
              required
              placeholder="Repeat your password"
              className="h-[50px] rounded-2xl border-0 bg-white/[0.07] px-4 text-[15px] text-white outline-none focus:shadow-[0_0_0_1px_var(--signal)]"
            />
            <label className="mt-1 flex items-start gap-2 text-[12px] leading-snug text-white/50">
              <input
                id="acceptTos"
                name="acceptTos"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
              />
              <span>
                I agree to the <b className="font-semibold text-white/70">Terms of Service</b>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[12px] leading-snug text-white/50">
              <input
                id="acceptPrivacy"
                name="acceptPrivacy"
                type="checkbox"
                required
                className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
              />
              <span>
                I agree to the <b className="font-semibold text-white/70">Privacy Policy</b>
              </span>
            </label>
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 h-[52px] rounded-[26px] border-0 bg-signal text-[15px] font-bold text-sig-ink disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Please wait…" : authLabel}
        </button>
      </form>
    </div>
  );
}
