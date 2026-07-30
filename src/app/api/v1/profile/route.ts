import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { getProfile, updateProfile, type UpdateProfileParams } from "@/server/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  return apiSuccess({ profile: getProfile(ctx.user) });
});

interface PatchProfileBody {
  displayName?: unknown;
  locale?: unknown;
  timezone?: unknown;
  currency?: unknown;
  dailyFreeMinutes?: unknown;
  rentRatePerHour?: unknown;
  analyticsConsent?: unknown;
  marketingConsent?: unknown;
  version?: unknown;
}

/** Shape/type guarding lives here (§2: "zwalidować dane" at the route); range/format rules (IANA tz, ISO 4217, etc.) live in `updateProfile()`. */
function parsePatchBody(body: PatchProfileBody): UpdateProfileParams {
  const fields: Record<string, string> = {};
  const out: Partial<UpdateProfileParams> = {};

  if (body.displayName !== undefined) {
    if (body.displayName === null) out.displayName = null;
    else if (typeof body.displayName === "string") out.displayName = body.displayName;
    else fields.displayName = "Nazwa wyświetlana musi być tekstem.";
  }
  if (body.locale !== undefined) {
    if (typeof body.locale === "string") out.locale = body.locale;
    else fields.locale = "Pole locale musi być tekstem.";
  }
  if (body.timezone !== undefined) {
    if (typeof body.timezone === "string") out.timezone = body.timezone;
    else fields.timezone = "Pole timezone musi być tekstem.";
  }
  if (body.currency !== undefined) {
    if (typeof body.currency === "string") out.currency = body.currency;
    else fields.currency = "Pole currency musi być tekstem.";
  }
  if (body.dailyFreeMinutes !== undefined) {
    if (typeof body.dailyFreeMinutes === "number") out.dailyFreeMinutes = body.dailyFreeMinutes;
    else fields.dailyFreeMinutes = "Pole dailyFreeMinutes musi być liczbą.";
  }
  if (body.rentRatePerHour !== undefined) {
    if (typeof body.rentRatePerHour === "number") out.rentRatePerHour = body.rentRatePerHour;
    else fields.rentRatePerHour = "Pole rentRatePerHour musi być liczbą.";
  }
  if (body.analyticsConsent !== undefined) {
    if (typeof body.analyticsConsent === "boolean") out.analyticsConsent = body.analyticsConsent;
    else fields.analyticsConsent = "Pole analyticsConsent musi być wartością logiczną.";
  }
  if (body.marketingConsent !== undefined) {
    if (typeof body.marketingConsent === "boolean") out.marketingConsent = body.marketingConsent;
    else fields.marketingConsent = "Pole marketingConsent musi być wartością logiczną.";
  }
  if (typeof body.version === "number") out.version = body.version;
  else fields.version = "Pole version jest wymagane (liczba).";

  if (Object.keys(fields).length > 0) throw validationError(fields);
  return out as UpdateProfileParams;
}

export const PATCH = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const body = await readV1JsonBody<PatchProfileBody>(req);
  const params = parsePatchBody(body);
  const profile = updateProfile(ctx.user, params);
  return apiSuccess({ profile });
});
