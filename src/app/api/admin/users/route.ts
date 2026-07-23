import { json, rateLimit, requireAdmin } from "@/lib/auth";
import { listAdminUsers } from "@/lib/adminUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_users", 60, 60, gate.user.id);
  if (limited) return limited;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const { users, total } = listAdminUsers({
    search,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return json({ ok: true, total, users });
}
