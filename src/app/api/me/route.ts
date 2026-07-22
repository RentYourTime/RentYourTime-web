import { currentUser, json, jsonError } from "@/lib/auth";
import { getSubscriptionForUser, serializeSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const sub = getSubscriptionForUser(user.id);

  return json({
    ok: true,
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
