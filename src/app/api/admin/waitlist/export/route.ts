import { rateLimit, requireAdmin } from "@/lib/auth";
import { exportWaitlistCsv, getAllWaitlistRecords } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_waitlist_export", 10, 600, gate.user.id);
  if (limited) return limited;

  const url = new URL(req.url);
  const csv = exportWaitlistCsv(
    getAllWaitlistRecords({
      search: url.searchParams.get("search")?.trim() || undefined,
      source: url.searchParams.get("source") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    })
  );
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="waitlist-export-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
