import { getDb } from "@/lib/db";
import { json, jsonError, rateLimit } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function count(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM waitlist").get() as { n: number };
  return row.n;
}

/** GET /api/waitlist — current signup count for the landing counter. */
export async function GET() {
  return json({ ok: true, count: count() });
}

/** POST /api/waitlist — add an email. Accepts JSON or form-encoded. */
export async function POST(req: Request) {
  const limited = rateLimit(req, "waitlist", 20, 3600);
  if (limited) return limited;

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
  if (honeypot) return json({ ok: true, count: count(), new: false });

  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("invalid", 422);

  const db = getDb();
  const existing = db.prepare("SELECT 1 FROM waitlist WHERE email = ?").get(email);
  let isNew = false;
  if (!existing) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    db.prepare("INSERT INTO waitlist (email, created_at, ip) VALUES (?, ?, ?)").run(
      email,
      new Date().toISOString(),
      ip
    );
    isNew = true;
    if (process.env.WAITLIST_NOTIFY_EMAIL) {
      // Delivery is intentionally out of scope (no SMTP dependency). Log so an
      // operator can wire this to their mail transport of choice.
      console.info(`[waitlist] new signup: ${email} → notify ${process.env.WAITLIST_NOTIFY_EMAIL}`);
    }
  }

  return json({ ok: true, count: count(), new: isNew });
}
