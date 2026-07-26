import { json, rateLimit, requireAdmin } from "@/lib/auth";
import { formatFounderNumber, getFounderTierById, listAdminFounderPurchases } from "@/lib/founders";
import type { FounderPaymentStatus } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ReadonlySet<string> = new Set(["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"]);

export async function GET(req: Request) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_founders", 60, 60, gate.user.id);
  if (limited) return limited;

  const url = new URL(req.url);
  const tierSlug = url.searchParams.get("tier") || undefined;
  const statusParam = url.searchParams.get("status") || undefined;
  const status = statusParam && STATUSES.has(statusParam) ? (statusParam as FounderPaymentStatus) : undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const limit = Number(url.searchParams.get("limit") ?? 100);

  const { purchases, total } = listAdminFounderPurchases({
    tierSlug,
    status,
    search,
    limit: Number.isFinite(limit) ? limit : 100,
  });

  return json({
    ok: true,
    total,
    purchases: purchases.map((p) => {
      const tier = getFounderTierById(p.founder_tier_id);
      return {
        id: p.id,
        email: p.user_email,
        tierSlug: p.tier_slug,
        tierName: p.tier_name,
        founderNumber: p.founder_number,
        founderNumberFormatted: tier && p.founder_number !== null ? formatFounderNumber(tier, p.founder_number) : null,
        amountCents: p.amount_cents,
        currency: p.currency,
        paymentStatus: p.payment_status,
        fulfillmentStatus: p.fulfillment_status,
        discordSyncStatus: p.discord_sync_status,
        purchasedAt: p.created_at,
      };
    }),
  });
}
