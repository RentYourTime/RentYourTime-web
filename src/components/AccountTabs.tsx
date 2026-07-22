"use client";

export type AccountTab = "overview" | "subscription" | "billing" | "admin";

const BASE_TABS: { key: AccountTab; label: string }[] = [
  { key: "overview", label: "Account" },
  { key: "subscription", label: "Subscription" },
  { key: "billing", label: "Billing" },
];

export function AccountTabs({
  tab,
  onTabChange,
  showAdmin,
}: {
  tab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  showAdmin: boolean;
}) {
  const tabs = showAdmin ? [...BASE_TABS, { key: "admin" as const, label: "Admin" }] : BASE_TABS;
  const gridClass = tabs.length === 4 ? "grid-cols-4" : "grid-cols-3";

  return (
    <div
      role="tablist"
      aria-label="Account sections"
      className={`grid ${gridClass} gap-0 rounded-[22px] bg-[#0b0b0b] p-1`}
    >
      {tabs.map((t) => (
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
