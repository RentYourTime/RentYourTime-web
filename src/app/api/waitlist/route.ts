import { json, jsonError, rateLimit, sha256 } from "@/lib/auth";
import { envRequired } from "@/lib/stripe";
import {
  countWaitlist,
  getWaitlistById,
  insertWaitlistSignup,
  markConfirmationSent,
  markOwnerEmailNotified,
} from "@/lib/waitlist";
import { sendWaitlistConfirmationEmail, sendWaitlistOwnerNotificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_USER_AGENT_LENGTH = 300;

function count(): number {
  return countWaitlist();
}

/** GET /api/waitlist — current signup count for the landing counter. */
export async function GET() {
  return json({ ok: true, count: count() });
}

/**
 * Fire-and-forget: never awaited by the route handler ("don't block the
 * user's response on send time"). Each email is independent — one failing
 * never prevents the other, and each only flips its own DB flag on
 * confirmed success. Never logs an email address, only the row id.
 */
async function notifyAboutNewSignup(id: string, email: string): Promise<void> {
  try {
    await sendWaitlistConfirmationEmail(email);
    markConfirmationSent(id);
  } catch (e) {
    console.error(
      `[waitlist] confirmation email failed for signup ${id}:`,
      e instanceof Error ? e.message : e
    );
  }

  const ownerEmail = process.env.WAITLIST_NOTIFY_EMAIL?.trim();
  if (!ownerEmail) return;

  try {
    const row = getWaitlistById(id);
    if (!row) return;
    const appUrl = envRequired("APP_URL").replace(/\/+$/, "");
    await sendWaitlistOwnerNotificationEmail(ownerEmail, {
      email: row.email,
      source: "Website",
      createdAt: row.created_at,
      totalSignups: countWaitlist(),
      adminUrl: `${appUrl}/admin/waitlist`,
    });
    markOwnerEmailNotified(id);
  } catch (e) {
    console.error(
      `[waitlist] owner notification email failed for signup ${id}:`,
      e instanceof Error ? e.message : e
    );
  }
}

/** POST /api/waitlist — add an email. Accepts JSON or form-encoded. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "waitlist", 20, 3600);
  if (limited) return limited;

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return jsonError("payload_too_large", 413);

  let email = "";
  let honeypot = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { email?: unknown; website?: unknown };
      email = String(body.email ?? "").trim();
      honeypot = String(body.website ?? "");
    } else {
      const form = await req.formData();
      email = String(form.get("email") ?? "").trim();
      honeypot = String(form.get("website") ?? "");
    }
  } catch {
    return jsonError("invalid", 422);
  }

  // Honeypot: the hidden "website" field is only filled by bots. Pretend success.
  if (honeypot) return json({ ok: true, message: "You're on the list.", count: count() });

  email = email.toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("invalid", 422);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = ip ? sha256(ip) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null;

  const { id, isNew } = insertWaitlistSignup({ email, ipHash, userAgent });

  // Never disclose whether the address already existed — same response either way.
  const response = json({ ok: true, message: "You're on the list.", count: count() });

  if (isNew && id) {
    void notifyAboutNewSignup(id, email).catch((e) => {
      console.error("[waitlist] notification pipeline failed unexpectedly:", e);
    });
  }

  return response;
}
