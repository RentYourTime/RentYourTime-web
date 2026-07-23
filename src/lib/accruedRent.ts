import { getDb } from "./db";
import { getDemoAccruedRent } from "./supportDemo";

/**
 * Single server-side source of truth for "accrued rent" — the only thing
 * the contribution flow (docs/CONTRIBUTIONS.md) is ever allowed to compute
 * a payment amount from. The rent meter itself lives on-device (see the
 * Privacy Policy: it's computed on the phone and "by default it never
 * touches our servers"), so there is currently no real sync pipeline
 * writing into `users.accrued_rent_cents` — it reads back `null` for every
 * user until one exists. Nothing here fabricates a number, and no request
 * handler is allowed to accept accrued rent from the client.
 */

export interface AccruedRent {
  cents: number;
  currency: string;
}

export function getAccruedRentForUser(userId: string): AccruedRent | null {
  const row = getDb()
    .prepare("SELECT accrued_rent_cents, accrued_rent_currency FROM users WHERE id = ?")
    .get(userId) as { accrued_rent_cents: number | null; accrued_rent_currency: string } | undefined;
  if (!row || row.accrued_rent_cents === null || row.accrued_rent_cents <= 0) return null;
  return { cents: row.accrued_rent_cents, currency: row.accrued_rent_currency };
}

export interface ResolvedAccruedRent extends AccruedRent {
  /** True when this value came from `SUPPORT_DEMO_ACCRUED_RENT_CENTS`, not real synced data. */
  isDemo: boolean;
}

/**
 * Real synced data always wins. Only when a user has none does this fall
 * back to the dev-only demo figure (`src/lib/supportDemo.ts`), which is
 * itself a no-op outside development — so in production this is exactly
 * equivalent to `getAccruedRentForUser`.
 */
export function resolveAccruedRentForUser(userId: string): ResolvedAccruedRent | null {
  const real = getAccruedRentForUser(userId);
  if (real) return { ...real, isDemo: false };
  const demo = getDemoAccruedRent();
  return demo ? { ...demo, isDemo: true } : null;
}
