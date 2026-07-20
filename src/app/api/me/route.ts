import { getDb } from "@/lib/db";
import { currentUser, json, jsonError, subscriptionIsPro, type SubscriptionRow } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const sub = getDb()
    .prepare("SELECT * FROM subscriptions WHERE user_id = ?")
    .get(user.id) as SubscriptionRow | undefined;

  const pro = subscriptionIsPro(sub);
  return json({
    ok: true,
    user: { id: user.id, email: user.email },
    entitlements: {
      pro,
      plan: pro ? "pro" : "free",
      status: sub?.status ?? null,
      current_period_end: sub?.current_period_end ?? null,
    },
  });
}
