import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { resolveAccruedRentForUser } from "@/lib/accruedRent";
import {
  getDemoTestPaymentsCentsForUser,
  getTotalContributedCentsForUser,
  listContributionsForUser,
  serializeContribution,
} from "@/lib/contributions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/contributions — always scoped to the caller; no userId
 * parameter is ever accepted. Also returns the caller's current accrued
 * rent for display only — the checkout endpoint recomputes it server-side
 * from the same source and never trusts a value echoed back by the client.
 */
export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "contributions_list", 60, 60, user.id);
  if (limited) return limited;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const contributions = listContributionsForUser(user.id, Number.isFinite(limit) ? limit : 50);
  const totalContributedCents = getTotalContributedCentsForUser(user.id);
  const demoTestPaymentsCents = getDemoTestPaymentsCentsForUser(user.id);
  const accrued = resolveAccruedRentForUser(user.id);

  return json({
    ok: true,
    data: {
      contributions: contributions.map(serializeContribution),
      totalContributedCents,
      demoTestPaymentsCents,
      accruedRentCents: accrued?.cents ?? null,
      currency: accrued?.currency ?? "usd",
      isDemoAccruedRent: accrued?.isDemo ?? false,
    },
  });
}
