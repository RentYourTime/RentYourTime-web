import { jsonError, json, rateLimit, readJsonBody, requireAdmin } from "@/lib/auth";
import { serializeWaitlistRecord, updateWaitlistRecord } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchWaitlistBody {
  status?: unknown;
  notes?: unknown;
  contacted_at?: unknown;
}

/** Whitelisted: only status/notes/contacted_at can ever change here. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireAdmin(req);
  if ("error" in gate) return gate.error;

  const limited = rateLimit(req, "admin_waitlist", 60, 60, gate.user.id);
  if (limited) return limited;

  const parsed = await readJsonBody<PatchWaitlistBody>(req);
  if ("error" in parsed) return parsed.error;

  const { id } = await params;
  const updated = updateWaitlistRecord(id, {
    status: parsed.body.status,
    notes: parsed.body.notes,
    contactedAt: parsed.body.contacted_at,
  });
  if (!updated) return jsonError("not_found", 404);

  return json({ ok: true, record: serializeWaitlistRecord(updated) });
}
