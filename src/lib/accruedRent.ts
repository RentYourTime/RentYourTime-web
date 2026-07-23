import { getDb } from "./db";

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
