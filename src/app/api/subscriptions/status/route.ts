import { currentUser, jsonError, json } from "@/lib/auth";
import { getSubscriptionForUser, serializeSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const sub = getSubscriptionForUser(user.id);
  return json({ ok: true, subscription: serializeSubscription(sub) });
}
