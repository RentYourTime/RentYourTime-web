import { json, jsonError, rateLimit, sha256 } from "@/lib/auth";
import { envRequired } from "@/lib/stripe";
import { countWaitlist, getWaitlistById, insertWaitlistSignup, markOwnerEmailNotified } from "@/lib/waitlist";
import { sendWaitlistOwnerNotificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8 * 1024;

/**
 * POST /api/teams/pilot — the Teams page's "request a pilot" form. Shares
 * the `waitlist` table (source=TEAMS) rather than a dedicated table, since a
 * pilot request is the same shape as a waitlist signup: an email plus intent
 * to hear back. Surfaces in /admin/waitlist via the "Teams pilot" filter.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, "teams_pilot", 20, 3600);
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return jsonError("payload_too_large", 413);

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = String(body.email ?? "").trim();
  } catch {
    return jsonError("invalid", 422);
  }

  email = email.toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("invalid", 422);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = ip ? sha256(ip) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const { id, isNew } = insertWaitlistSignup({ email, ipHash, userAgent, source: "TEAMS" });

  const response = json({ ok: true, message: "Pilot request received." });

  const ownerEmail = process.env.WAITLIST_NOTIFY_EMAIL?.trim();
  if (isNew && id && ownerEmail) {
    void (async () => {
      try {
        const row = getWaitlistById(id);
        if (!row) return;
        const appUrl = envRequired("APP_URL").replace(/\/+$/, "");
        await sendWaitlistOwnerNotificationEmail(ownerEmail, {
          email: row.email,
          source: "Teams pilot",
          createdAt: row.created_at,
          totalSignups: countWaitlist(),
          adminUrl: `${appUrl}/admin/waitlist`,
        });
        markOwnerEmailNotified(id);
      } catch (e) {
        console.error(`[teams-pilot] owner notification email failed for signup ${id}:`, e instanceof Error ? e.message : e);
      }
    })().catch((e) => {
      console.error("[teams-pilot] notification pipeline failed unexpectedly:", e);
    });
  }

  return response;
}
