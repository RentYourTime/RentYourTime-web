import { json, rateLimit, requireAdmin } from "@/lib/auth";
import { getWaitlistStats, listWaitlistForAdmin, serializeWaitlistRecord } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_waitlist", 60, 60, gate.user.id);
  if (limited) return limited;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || undefined;
  const source = url.searchParams.get("source") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const { records, total } = listWaitlistForAdmin({
    search,
    source,
    status,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return json({
    ok: true,
    stats: getWaitlistStats(),
    total,
    records: records.map(serializeWaitlistRecord),
  });
}
