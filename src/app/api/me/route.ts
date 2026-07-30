import { currentUser, json, jsonError } from "@/lib/auth";
import { isProCheckoutEnabled } from "@/lib/stripe";
import { getSubscriptionForUser, serializeSubscription } from "@/lib/subscriptions";
import { deprecatedRoute } from "@/lib/http/deprecation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const sub = getSubscriptionForUser(user.id);

  return json({
    ok: true,
    pro_checkout_enabled: isProCheckoutEnabled(),
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      email_verified: !!user.email_verified,
      role: user.role,
      created_at: user.created_at,
      subscription: serializeSubscription(sub),
    },
  });
}

/** Legacy compatibility adapter — see docs/AUTH_MIGRATION.md. Prefer GET /api/v1/auth/me + GET /api/v1/subscription/status. */
export const GET = deprecatedRoute("/api/v1/auth/me", handleGet);
