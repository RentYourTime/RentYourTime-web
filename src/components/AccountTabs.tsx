"use client";

export type AccountTab = "overview" | "subscription" | "billing";

const TABS: { key: AccountTab; label: string }[] = [
  { key: "overview", label: "Account" },
  { key: "subscription", label: "Subscription" },
  { key: "billing", label: "Billing" },
];

export function AccountTabs({
  tab,
  onTabChange,
}: {
  tab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Account sections"
      className="grid grid-cols-3 gap-0 rounded-[22px] bg-[#0b0b0b] p-1"
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onTabChange(t.key)}
          className={`h-[38px] rounded-[19px] border-0 text-sm font-semibold transition-colors ${
            tab === t.key ? "bg-white/10 text-white" : "bg-transparent text-white/50 hover:text-white/70"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
