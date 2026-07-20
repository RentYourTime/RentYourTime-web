import { getDb } from "@/lib/db";
import { issueToken, json, jsonError, rateLimit, type UserRow } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const limited = rateLimit(req, "login", 12, 900);
  if (limited) return limited;

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | UserRow
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    await sleep(250); // constant-ish delay to blunt timing/enumeration
    return jsonError("invalid_credentials", 401);
  }

  const auth = issueToken(user.id);
  return json({ ok: true, user: { id: user.id, email: user.email }, auth });
}
