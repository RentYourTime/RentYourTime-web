import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { getInvoicesForUser, serializeBillingRecord } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "billing_invoices", 60, 60, user.id);
  if (limited) return limited;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const records = getInvoicesForUser(user.id, {
    limit: Number.isFinite(limit) ? limit : 20,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return json({ ok: true, invoices: records.map(serializeBillingRecord) });
}
