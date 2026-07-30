import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { verifyAccessToken } from "@/server/auth/tokens";
import { getConfig } from "@/server/feature-flags";
import { bearerToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public — a logged-out client (first launch, before login) still needs
 * `maintenance`/`minimumAppVersion` to decide whether it can even show a
 * login screen. An optional Bearer token personalizes `features`/
 * `founderEarlyAccess`; an invalid/expired one is treated the same as no
 * token at all rather than rejected, since this endpoint never returns
 * anything private.
 */
export const GET = withApiRoute(async (req) => {
  const url = new URL(req.url);
  const appVersion = url.searchParams.get("appVersion");

  const token = bearerToken(req);
  const verified = token ? verifyAccessToken(token) : null;
  const userId = verified?.ok ? verified.claims.sub : null;

  return apiSuccess(getConfig(userId, appVersion));
});
