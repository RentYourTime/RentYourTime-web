import { jsonError, json, rateLimit, readJsonBody, requireAdmin } from "@/lib/auth";
import { setUserActive } from "@/lib/adminUsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchUserBody {
  action?: unknown;
}

/**
 * PATCH /api/admin/users/[id] — suspend/restore only (`is_active`). There is
 * deliberately no delete action here: the admin panel's "Delete" button
 * stays UI-only until permanent deletion is explicitly wired up.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_users", 60, 60, gate.user.id);
  if (limited) return limited;

  const { id } = await params;
  if (id === gate.user.id) return jsonError("cannot_modify_self", 400);

  const parsed = await readJsonBody<PatchUserBody>(req);
  if ("error" in parsed) return parsed.error;

  const action = parsed.body.action;
  if (action !== "suspend" && action !== "restore") return jsonError("invalid_action", 422);

  const updated = setUserActive(id, action === "restore");
  if (!updated) return jsonError("not_found", 404);

  return json({ ok: true, user: updated });
}
