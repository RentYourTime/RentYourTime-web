import { currentUser, json, jsonError } from "@/lib/auth";
import { getStripe, ServerConfigError } from "@/lib/stripe";
import { getContributionByCheckoutSessionId, settleContributionFromSession } from "@/lib/contributions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/contributions/session/[sessionId] — the success page polls this
 * instead of trusting `?session_id=` from the URL. Ownership is checked
 * against the local PENDING/PAID row, never against Stripe directly, so a
 * guessed session id can never leak another user's contribution.
 */
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const { sessionId } = await params;
  const contribution = getContributionByCheckoutSessionId(sessionId);
  if (!contribution || contribution.user_id !== user.id) return jsonError("not_found", 404);

  // The webhook is the authority; this is a same-tab convenience so the
  // success page doesn't have to wait on webhook delivery to show PAID.
  if (contribution.status === "PENDING") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const settled = settleContributionFromSession(session, `poll:${sessionId}`);
      return json({ ok: true, data: { status: (settled ?? contribution).status } });
    } catch (e) {
      if (e instanceof ServerConfigError) {
        console.error(e.message);
        return jsonError("server_not_configured", 503);
      }
      // Stripe lookup failed — fall back to whatever the local row says.
      console.error("Contribution session status sync error:", e instanceof Error ? e.message : e);
    }
  }

  return json({ ok: true, data: { status: contribution.status } });
}
