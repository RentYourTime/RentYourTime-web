import { bearerToken, json, jsonError, revokeToken } from "@/lib/auth";
import { deprecatedRoute } from "@/lib/http/deprecation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const token = bearerToken(req);
  if (!token) return jsonError("unauthorized", 401);
  revokeToken(token);
  return json({ ok: true });
}

/** Legacy compatibility adapter — see docs/AUTH_MIGRATION.md. Prefer POST /api/v1/auth/logout. */
export const POST = deprecatedRoute("/api/v1/auth/logout", handlePost);
