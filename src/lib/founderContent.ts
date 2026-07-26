/**
 * Static English copy for the Founder Program (benefits, CTAs, comparison
 * table, accent colors). Kept out of the page/component JSX — matching how
 * `Pricing.tsx`/`Privacy.tsx`/`Terms.tsx` already extract their content into
 * local data — so it's one place to translate later if this repo ever grows
 * a real localization system (none exists today — see docs/FOUNDER_PROGRAM.md).
 *
 * Language throughout: "Founder", never "Funder". Benefit copy deliberately
 * avoids: guaranteed employment/cooperation, equity, code rights, revenue
 * rights, unlimited creator access, 24/7 support, or a guaranteed exact
 * pre-launch date — see docs/FOUNDER_PROGRAM.md "Benefit language rules".
 */

export type FounderTierSlug = "founder-first" | "founder-gold" | "founder-black";

export interface FounderTierContent {
  slug: FounderTierSlug;
  ctaLabel: string;
  accent: string;
  accentSoft: string;
  badge?: string;
  tagline: string;
  benefits: string[];
}

export const FOUNDER_TIER_CONTENT: Record<FounderTierSlug, FounderTierContent> = {
  "founder-first": {
    slug: "founder-first",
    ctaLabel: "Become a Founder",
    accent: "#CD7F32",
    accentSoft: "rgba(205,127,50,0.12)",
    tagline: "The first wave in — a year of Pro and a permanent, numbered place in RentYourTime's history.",
    benefits: [
      "RentYourTime Pro for 1 year",
      "Early access roughly 7 days before public launch",
      "Exclusive Founder First rank on Discord",
      "Founder First badge in the client panel",
      "Founder First status attached to your account",
      "Access to private Founder channels on Discord",
      "Numbered Founder status",
    ],
  },
  "founder-gold": {
    slug: "founder-gold",
    ctaLabel: "Become a Gold Founder",
    accent: "#FFD700",
    accentSoft: "rgba(255,215,0,0.12)",
    badge: "Most Popular",
    tagline: "Everything in Founder First, plus three years of Pro, a voice in the roadmap, and early beta builds.",
    benefits: [
      "Everything in Founder First",
      "RentYourTime Pro for 3 years",
      "Early access roughly 30 days before public launch",
      "Exclusive Founder Gold rank on Discord",
      "Founder Gold badge in the client panel",
      "Gold badge inside the app",
      "Option to display your name or nickname in the Founders tab",
      "Access to private beta builds",
      "Priority consideration when voting on selected roadmap items",
      "Access to the Founder Feedback and Founder Roadmap channels",
      "Numbered Founder status",
    ],
  },
  "founder-black": {
    slug: "founder-black",
    ctaLabel: "Join Founder Black",
    accent: "#B0B0B8",
    accentSoft: "rgba(255,255,255,0.06)",
    tagline: "The most exclusive tier — lifetime Pro, a physical kit, and direct, priority access to the team.",
    benefits: [
      "Everything in Founder First and Founder Gold",
      "RentYourTime Pro for life",
      "Early access to development builds as they become available — up to roughly 12 months before public launch",
      "Priority consideration for new features",
      "Priority consideration for closed beta testing",
      "Early information about selected updates",
      "Early information about selected hiring and collaboration opportunities — purchase does not guarantee employment or cooperation",
      "Access to a private roadmap",
      "Ability to submit features for priority review",
      "Numbered aluminum Founder Black card",
      "Personalized certificate",
      "Signed thank-you letter",
      "Limited-edition RentYourTime T-shirt with your individual number",
      "Founder Black number from #01 to #20",
      "Highest Founder Black rank on Discord",
      "Dedicated Founder Black profile in the app and client panel",
      "Credits entry, with your consent",
      "Private section or Discord channel",
      "Closed product meetings",
      "Option to take part in selected promotional material or case studies, with your consent",
      "One individual online call per week, subject to booking and availability",
      "Two extended product consultations per quarter",
      "Priority support",
      "Response within 6 hours during published support hours",
    ],
  },
};

/** Shown under the weekly-call benefit and in the Terms — the exact limits your own spec requires. */
export const FOUNDER_BLACK_CALL_TERMS = [
  "Requires booking in advance — calls are not automatic.",
  "Slot availability is limited and subject to scheduling.",
  "Unused calls do not roll over or accumulate.",
  "A booked call may need to be rescheduled.",
  "All calls are governed by the Founder Program terms.",
];

export const FOUNDER_LEGAL_NOTES = [
  "Purchasing a Founder tier does not grant equity, ownership, or any share in RentYourTime.",
  "Purchasing a Founder tier does not grant rights to RentYourTime's code, intellectual property, or revenue.",
  "Purchase does not guarantee employment or cooperation with RentYourTime.",
  "Roadmap voting and feature submissions receive priority consideration — RentYourTime is not obligated to build any specific feature.",
  "Final product decisions remain with RentYourTime.",
  "Benefits described as \"priority\" or \"early access\" are subject to scheduling and availability, and dates are estimates, not guarantees.",
];

/** [label, First, Gold, Black] — "✓" / "—" / a short string. */
export const FOUNDER_COMPARISON_ROWS: [string, string, string, string][] = [
  ["One-time price", "$50", "$125", "$1,899"],
  ["Limit", "300", "150", "20"],
  ["Pro access", "1 year", "3 years", "Lifetime"],
  ["Early access", "~7 days", "~30 days", "Up to ~12 months"],
  ["Numbered Founder status", "✓", "✓", "✓"],
  ["Discord rank", "Founder First", "Founder Gold", "Founder Black"],
  ["Client panel status", "✓", "✓", "✓"],
  ["In-app badge", "✓", "Gold badge", "Dedicated profile"],
  ["Private Founder channels", "✓", "✓", "✓"],
  ["Founders tab listing", "—", "Optional", "Optional"],
  ["Beta build access", "—", "✓", "✓"],
  ["Roadmap voting", "—", "Priority consideration", "Priority consideration"],
  ["Private roadmap", "—", "—", "✓"],
  ["Priority update info", "—", "—", "✓"],
  ["Hiring/collaboration info", "—", "—", "✓"],
  ["Priority feature review", "—", "—", "✓"],
  ["Closed product meetings", "—", "—", "✓"],
  ["Weekly call", "—", "—", "✓ (booking required)"],
  ["Quarterly consultations (2)", "—", "—", "✓"],
  ["Priority support (≤6h)", "—", "—", "✓"],
  ["Credits entry", "—", "—", "With consent"],
  ["Case study participation", "—", "—", "With consent"],
  ["Aluminum card", "—", "—", "✓"],
  ["Certificate", "—", "—", "✓"],
  ["Thank-you letter", "—", "—", "✓"],
  ["Numbered T-shirt", "—", "—", "✓"],
];

export const FOUNDER_COMPARISON_COLUMNS = ["Founder First", "Founder Gold", "Founder Black"] as const;
