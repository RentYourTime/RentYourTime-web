import { bearerToken, json, jsonError, revokeToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) return jsonError("unauthorized", 401);
  revokeToken(token);
  return json({ ok: true });
}
