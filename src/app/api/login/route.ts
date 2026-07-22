import { getDb } from "@/lib/db";
import { issueToken, json, jsonError, rateLimit, readJsonBody, type UserRow } from "@/lib/auth";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(req: Request) {
  const limited = rateLimit(req, "login", 10, 900);
  if (limited) return limited;

  const parsed = await readJsonBody<LoginBody>(req);
  if ("error" in parsed) return parsed.error;
  const body = parsed.body;

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | UserRow
    | undefined;

  // Same generic error whether the account doesn't exist, the password is
  // wrong, or the account is deactivated — never reveal which.
  if (!user || !verifyPassword(password, user.password_hash) || !user.is_active) {
    await sleep(250); // constant-ish delay to blunt timing/enumeration
    return jsonError("invalid_credentials", 401);
  }

  if (needsRehash(user.password_hash)) {
    getDb()
      .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .run(hashPassword(password), user.id);
  }

  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, user.id);

  const { token, expires_at } = issueToken(user.id);
  return json({
    ok: true,
    user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
    token,
    expires_at,
  });
}
