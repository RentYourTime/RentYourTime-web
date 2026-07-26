import { currentUser, json, jsonError, rateLimit, readJsonBody } from "@/lib/auth";
import { upsertFounderProfile } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProfileBody {
  displayName?: unknown;
  consentDirectory?: unknown;
  consentCredits?: unknown;
  consentCaseStudy?: unknown;
}

/** PATCH /api/founders/profile — Founders Directory display name + consent toggles, scoped to the caller. */
export async function PATCH(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "founders_profile", 20, 600, user.id);
  if (limited) return limited;

  const parsed = await readJsonBody<ProfileBody>(req);
  if ("error" in parsed) return parsed.error;

  const displayName =
    typeof parsed.body.displayName === "string" ? parsed.body.displayName.trim().slice(0, 80) || null : undefined;

  const profile = upsertFounderProfile({
    userId: user.id,
    displayName,
    consentDirectory: typeof parsed.body.consentDirectory === "boolean" ? parsed.body.consentDirectory : undefined,
    consentCredits: typeof parsed.body.consentCredits === "boolean" ? parsed.body.consentCredits : undefined,
    consentCaseStudy: typeof parsed.body.consentCaseStudy === "boolean" ? parsed.body.consentCaseStudy : undefined,
  });

  return json({
    ok: true,
    data: {
      displayName: profile.display_name,
      consentDirectory: !!profile.consent_directory,
      consentCredits: !!profile.consent_credits,
      consentCaseStudy: !!profile.consent_case_study,
    },
  });
}
