import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { issueToken, json, jsonError, rateLimit, readJsonBody } from "@/lib/auth";
import { hashPassword, passwordPolicyError } from "@/lib/password";
import { buildVerificationUrl, createEmailVerificationToken } from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DISPLAY_NAME_LENGTH = 80;

interface RegisterBody {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "register", 5, 900);
  if (limited) return limited;

  const parsed = await readJsonBody<RegisterBody>(req);
  if ("error" in parsed) return parsed.error;
  const body = parsed.body;

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("invalid_email", 422);

  const passwordError = passwordPolicyError(password);
  if (passwordError) return jsonError(passwordError, 422);

  let displayName: string | null = null;
  if (body.displayName !== undefined && body.displayName !== null) {
    if (typeof body.displayName !== "string") return jsonError("invalid_display_name", 422);
    const trimmed = body.displayName.trim();
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) return jsonError("invalid_display_name", 422);
    displayName = trimmed || null;
  }

  const id = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at, display_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, email, hashPassword(password), now, displayName, now);
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint/i.test(e.message)) {
      return jsonError("email_taken", 409);
    }
    throw e;
  }

  const { token, expires_at } = issueToken(id);

  // A verification-email failure must never fail registration — the account
  // already exists and has a valid session; the user can always resend.
  let verificationEmailSent = false;
  try {
    const { token: verificationToken } = createEmailVerificationToken(id);
    const verificationUrl = buildVerificationUrl(verificationToken);
    await sendVerificationEmail({ email, displayName, verificationUrl });
    verificationEmailSent = true;
  } catch (e) {
    // Never log the token/URL itself — only that sending failed.
    console.error("Verification email send failed:", e instanceof Error ? e.message : e);
  }

  return json(
    {
      ok: true,
      user: { id, email, display_name: displayName, role: "USER", email_verified: false },
      token,
      expires_at,
      verification_email_sent: verificationEmailSent,
    },
    201
  );
}
