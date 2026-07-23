import { json, rateLimit, requireAdmin } from "@/lib/auth";
import { getAdminOverviewStats } from "@/lib/adminUsers";
import { getWaitlistStats } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_overview", 60, 60, gate.user.id);
  if (limited) return limited;

  return json({
    ok: true,
    users: getAdminOverviewStats(),
    waitlist: getWaitlistStats(),
  });
}
