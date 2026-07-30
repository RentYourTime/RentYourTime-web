import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { isValidDateString } from "@/server/validation";
import { getUsageTrends } from "@/server/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 30;

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (DEFAULT_WINDOW_DAYS - 1) * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export const GET = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  if (fromParam && !isValidDateString(fromParam)) throw validationError({ from: "Nieprawidłowa data (YYYY-MM-DD)." });
  if (toParam && !isValidDateString(toParam)) throw validationError({ to: "Nieprawidłowa data (YYYY-MM-DD)." });

  const fallback = defaultRange();
  const points = getUsageTrends(ctx.user.id, { from: fromParam ?? fallback.from, to: toParam ?? fallback.to });
  return apiSuccess({ points });
});
