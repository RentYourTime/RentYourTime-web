import { currentUser, json, jsonError } from "@/lib/auth";
import { getStripe, ServerConfigError } from "@/lib/stripe";
import { getFounderPurchaseByCheckoutSessionId, settleFounderPurchaseFromSession } from "@/lib/founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/founders/session/[sessionId] — the same "never trust the success
 * URL" pattern as /api/contributions/session/[sessionId]: the client panel
 * polls this instead of treating a redirect back from Stripe as activation
 * (see docs/FOUNDER_PROGRAM.md §"System dostępności" #8). Ownership is
 * checked against the local row, never against Stripe directly.
 */
export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const { sessionId } = await params;
  const purchase = getFounderPurchaseByCheckoutSessionId(sessionId);
  if (!purchase || purchase.user_id !== user.id) return jsonError("not_found", 404);

  // The webhook is the authority; this is a same-tab convenience so the
  // success screen doesn't have to wait out webhook delivery to show PAID.
  if (purchase.payment_status === "PENDING") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const settled = settleFounderPurchaseFromSession(session, `poll:${sessionId}`);
      return json({ ok: true, data: { status: (settled ?? purchase).payment_status } });
    } catch (e) {
      if (e instanceof ServerConfigError) {
        console.error(e.message);
        return jsonError("server_not_configured", 503);
      }
      console.error("Founder session status sync error:", e instanceof Error ? e.message : e);
    }
  }

  return json({ ok: true, data: { status: purchase.payment_status } });
}
