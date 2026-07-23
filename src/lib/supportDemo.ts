/**
 * Development-only demo data for the "Support the project" screen
 * (docs/CONTRIBUTIONS.md → "Development demo mode"). Lets `/panel` show a
 * realistic accrued-rent figure when a real one hasn't synced yet, while
 * Stripe Checkout stays 100% real (Test Mode) — this module only ever
 * supplies the *input number*, never touches the checkout/webhook flow
 * itself.
 *
 * Hard, server-only kill switch: `NODE_ENV === "production"` always wins,
 * checked first, with no code path that can be overridden from the client.
 */

export function isSupportDemoEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ENABLE_SUPPORT_DEMO === "true";
}

export interface DemoAccruedRent {
  cents: number;
  currency: string;
}

/** Null unless demo mode is enabled and `SUPPORT_DEMO_ACCRUED_RENT_CENTS` is a valid positive integer. */
export function getDemoAccruedRent(): DemoAccruedRent | null {
  if (!isSupportDemoEnabled()) return null;
  const raw = process.env.SUPPORT_DEMO_ACCRUED_RENT_CENTS;
  const cents = Number(raw);
  if (!raw || !Number.isFinite(cents) || !Number.isInteger(cents) || cents <= 0) return null;
  const currency = (process.env.SUPPORT_DEMO_CURRENCY || "usd").trim().toLowerCase() || "usd";
  return { cents, currency };
}
