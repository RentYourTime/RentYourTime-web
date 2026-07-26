import { jsonError, rateLimit, requireAdmin } from "@/lib/auth";
import { formatFounderNumber, getFounderTierById, listAdminFounderPurchases } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS = [
  "email",
  "tier",
  "founder_number",
  "amount_cents",
  "currency",
  "payment_status",
  "fulfillment_status",
  "discord_sync_status",
  "purchased_at",
] as const;

/**
 * GET /api/admin/founders/export — CSV, no shipping address/full name (see
 * the kit endpoint for that — kept out of bulk exports on purpose).
 */
export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders_export", 10, 600, gate.user.id);
  if (limited) return limited;

  try {
    const { purchases } = listAdminFounderPurchases({ limit: 500 });
    const rows = purchases.map((p) => {
      const tier = getFounderTierById(p.founder_tier_id);
      const formatted = tier && p.founder_number !== null ? formatFounderNumber(tier, p.founder_number) : "";
      return [
        p.user_email,
        p.tier_name,
        formatted,
        p.amount_cents,
        p.currency,
        p.payment_status,
        p.fulfillment_status,
        p.discord_sync_status,
        p.created_at,
      ]
        .map(csvEscape)
        .join(",");
    });
    const csv = [COLUMNS.join(","), ...rows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="founder-purchases.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Founder export error:", e instanceof Error ? e.message : e);
    return jsonError("export_failed", 500);
  }
}
