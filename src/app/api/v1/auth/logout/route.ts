import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { validationError } from "@/lib/http/errors";
import { logout } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LogoutBody {
  refreshToken?: unknown;
}

/**
 * Deliberately does not require a valid (unexpired) access token — a client
 * signing out after its short-lived access token has already expired must
 * still be able to revoke the refresh token. Idempotent: an unknown or
 * already-revoked token is a no-op, same contract as the legacy
 * `POST /api/logout`.
 */
export const POST = withApiRoute(async (req) => {
  const body = await readV1JsonBody<LogoutBody>(req);
  if (typeof body.refreshToken !== "string" || !body.refreshToken) {
    throw validationError({ refreshToken: "Wymagany refreshToken." });
  }
  logout(body.refreshToken);
  return apiSuccess({ loggedOut: true });
});
