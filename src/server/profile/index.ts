import type { UserRow } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ApiError, validationError } from "@/lib/http/errors";
import { isValidCurrencyCode, isValidLocale, isValidTimeZone, normalizeCurrencyCode } from "@/server/validation";

/**
 * User-controlled product preferences (§10). Deliberately separate from
 * account-security fields, which stay on `users` — except `displayName`,
 * which the spec lists as a PATCH /profile field even though it's stored on
 * `users.display_name`; both tables are written in the same call, guarded
 * by the same optimistic-concurrency `version`.
 */

export interface ProfileRow {
  user_id: string;
  locale: string;
  timezone: string;
  currency: string;
  daily_free_minutes: number;
  rent_rate_per_hour_minor: number;
  analytics_consent: number;
  marketing_consent: number;
  version: number;
  updated_at: string;
}

export interface ProfileDto {
  userId: string;
  displayName: string | null;
  locale: string;
  timezone: string;
  currency: string;
  dailyFreeMinutes: number;
  rentRatePerHour: number;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  version: number;
  updatedAt: string;
}

const DEFAULTS = {
  locale: "en-US",
  timezone: "UTC",
  currency: "usd",
  dailyFreeMinutes: 60,
  rentRatePerHourMinor: 0,
};

function ensureProfileRow(userId: string): ProfileRow {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").get(userId) as
    | ProfileRow
    | undefined;
  if (existing) return existing;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_profiles
       (user_id, locale, timezone, currency, daily_free_minutes, rent_rate_per_hour_minor, analytics_consent, marketing_consent, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)`
  ).run(userId, DEFAULTS.locale, DEFAULTS.timezone, DEFAULTS.currency, DEFAULTS.dailyFreeMinutes, DEFAULTS.rentRatePerHourMinor, now);
  return db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").get(userId) as ProfileRow;
}

function serialize(user: UserRow, profile: ProfileRow): ProfileDto {
  return {
    userId: user.id,
    displayName: user.display_name,
    locale: profile.locale,
    timezone: profile.timezone,
    currency: profile.currency,
    dailyFreeMinutes: profile.daily_free_minutes,
    rentRatePerHour: profile.rent_rate_per_hour_minor / 100,
    analyticsConsent: !!profile.analytics_consent,
    marketingConsent: !!profile.marketing_consent,
    version: profile.version,
    updatedAt: profile.updated_at,
  };
}

export function getProfile(user: UserRow): ProfileDto {
  return serialize(user, ensureProfileRow(user.id));
}

export interface UpdateProfileParams {
  displayName?: string | null;
  locale?: string;
  timezone?: string;
  currency?: string;
  dailyFreeMinutes?: number;
  rentRatePerHour?: number;
  analyticsConsent?: boolean;
  marketingConsent?: boolean;
  version: number;
}

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_DAILY_FREE_MINUTES = 1440;
const MAX_RENT_RATE_PER_HOUR = 1000;

export function updateProfile(user: UserRow, params: UpdateProfileParams): ProfileDto {
  const db = getDb();
  const current = ensureProfileRow(user.id);

  if (typeof params.version !== "number" || !Number.isInteger(params.version)) {
    throw validationError({ version: "Pole version jest wymagane." });
  }
  if (params.version !== current.version) throw new ApiError("VERSION_CONFLICT");

  const fields: Record<string, string> = {};

  let displayName = user.display_name;
  if (params.displayName !== undefined) {
    if (params.displayName === null) {
      displayName = null;
    } else {
      const trimmed = params.displayName.trim();
      if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) fields.displayName = "Nazwa wyświetlana jest za długa.";
      displayName = trimmed || null;
    }
  }

  let locale = current.locale;
  if (params.locale !== undefined) {
    if (!isValidLocale(params.locale)) fields.locale = "Nieprawidłowy kod języka.";
    else locale = params.locale;
  }

  let timezone = current.timezone;
  if (params.timezone !== undefined) {
    if (!isValidTimeZone(params.timezone)) fields.timezone = "Nieprawidłowa strefa czasowa IANA.";
    else timezone = params.timezone;
  }

  let currency = current.currency;
  if (params.currency !== undefined) {
    if (!isValidCurrencyCode(params.currency)) fields.currency = "Nieprawidłowy kod waluty (ISO 4217).";
    else currency = normalizeCurrencyCode(params.currency);
  }

  let dailyFreeMinutes = current.daily_free_minutes;
  if (params.dailyFreeMinutes !== undefined) {
    if (
      !Number.isInteger(params.dailyFreeMinutes) ||
      params.dailyFreeMinutes < 0 ||
      params.dailyFreeMinutes > MAX_DAILY_FREE_MINUTES
    ) {
      fields.dailyFreeMinutes = `Wartość musi być liczbą całkowitą 0-${MAX_DAILY_FREE_MINUTES}.`;
    } else {
      dailyFreeMinutes = params.dailyFreeMinutes;
    }
  }

  let rentRateMinor = current.rent_rate_per_hour_minor;
  if (params.rentRatePerHour !== undefined) {
    if (
      typeof params.rentRatePerHour !== "number" ||
      !Number.isFinite(params.rentRatePerHour) ||
      params.rentRatePerHour < 0 ||
      params.rentRatePerHour > MAX_RENT_RATE_PER_HOUR
    ) {
      fields.rentRatePerHour = `Wartość musi być liczbą 0-${MAX_RENT_RATE_PER_HOUR}.`;
    } else {
      rentRateMinor = Math.round(params.rentRatePerHour * 100);
    }
  }

  if (Object.keys(fields).length > 0) throw validationError(fields);

  const now = new Date().toISOString();
  if (displayName !== user.display_name) {
    db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").run(displayName, now, user.id);
  }

  db.prepare(
    `UPDATE user_profiles
     SET locale = ?, timezone = ?, currency = ?, daily_free_minutes = ?, rent_rate_per_hour_minor = ?,
         analytics_consent = ?, marketing_consent = ?, version = version + 1, updated_at = ?
     WHERE user_id = ?`
  ).run(
    locale,
    timezone,
    currency,
    dailyFreeMinutes,
    rentRateMinor,
    params.analyticsConsent !== undefined ? (params.analyticsConsent ? 1 : 0) : current.analytics_consent,
    params.marketingConsent !== undefined ? (params.marketingConsent ? 1 : 0) : current.marketing_consent,
    now,
    user.id
  );

  const updatedProfile = db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").get(user.id) as ProfileRow;
  return serialize({ ...user, display_name: displayName }, updatedProfile);
}
