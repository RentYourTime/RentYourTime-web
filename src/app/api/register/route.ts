import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { issueToken, json, jsonError, rateLimit } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const limited = rateLimit(req, "register", 8, 3600);
  if (limited) return limited;

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email) || email.length > 254) return jsonError("invalid_email", 422);
  if (password.length < 10 || password.length > 200) return jsonError("invalid_password", 422);

  const id = randomBytes(16).toString("hex");
  try {
    getDb()
      .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(id, email, hashPassword(password), new Date().toISOString());
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint/i.test(e.message)) {
      return jsonError("email_taken", 409);
    }
    throw e;
  }

  const auth = issueToken(id);
  return json({ ok: true, user: { id, email }, auth }, 201);
}
