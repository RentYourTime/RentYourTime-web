/** Shared field validators for /api/v1 request bodies. Pure functions only — no DB access, no throwing (callers assemble an ApiError with a `fields` map from these). */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;
const CURRENCY_RE = /^[a-z]{3}$/i;

export function isValidLocale(value: string): boolean {
  if (!LOCALE_RE.test(value)) return false;
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch {
    return false;
  }
}

/** IANA time zone name (e.g. `Europe/Warsaw`) — validated via Intl rather than a static list, so new tz database entries just work. */
export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** ISO 4217 currency code, lowercased for storage (matches the existing `subscriptions`/`billing_records`/`contributions` convention). */
export function isValidCurrencyCode(value: string): boolean {
  return CURRENCY_RE.test(value);
}

export function normalizeCurrencyCode(value: string): string {
  return value.toLowerCase();
}

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Rejects a date more than one day in the future (client clock skew tolerance) — usage sync should never record "tomorrow". */
export function isNotFutureDate(value: string, toleranceDays = 1): boolean {
  const d = new Date(`${value}T00:00:00.000Z`).getTime();
  const maxAllowed = Date.now() + toleranceDays * 86_400_000;
  return d <= maxAllowed;
}

export function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function isOptionalString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

const PLATFORMS = ["IOS", "WEB", "WATCHOS", "ADMIN_WEB", "DISCORD_BOT", "INTERNAL"] as const;
export type Platform = (typeof PLATFORMS)[number];
export function isValidPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

const PUSH_ENVIRONMENTS = ["sandbox", "production"] as const;
export type PushEnvironment = (typeof PUSH_ENVIRONMENTS)[number];
export function isValidPushEnvironment(value: unknown): value is PushEnvironment {
  return typeof value === "string" && (PUSH_ENVIRONMENTS as readonly string[]).includes(value);
}

/** Loose semver-ish check (`1`, `1.2`, `1.2.3`, `1.2.3-beta.1`) — app versions aren't strictly semver on all platforms. */
export function isValidAppVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+(\.\d+){0,2}(-[0-9A-Za-z.-]+)?$/.test(value) && value.length <= 32;
}

export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
