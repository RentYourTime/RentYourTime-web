import { apiSuccess, withApiRoute } from "@/lib/http/envelope";
import { readV1JsonBody } from "@/lib/http/body";
import { enforceRateLimit } from "@/lib/http/rateLimit";
import { validationError } from "@/lib/http/errors";
import { requireAuth } from "@/server/auth/service";
import { deleteAccount } from "@/server/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeleteAccountBody {
  password?: unknown;
  confirm?: unknown;
}

export const DELETE = withApiRoute(async (req) => {
  const ctx = requireAuth(req);
  enforceRateLimit(req, "v1_account_delete", 5, 3600, ctx.user.id);

  const body = await readV1JsonBody<DeleteAccountBody>(req);
  if (typeof body.password !== "string" || !body.password) throw validationError({ password: "Wymagane hasło." });
  if (body.confirm !== true) throw validationError({ confirm: "Wymagane potwierdzenie (confirm: true)." });

  deleteAccount({ user: ctx.user, password: body.password, confirm: body.confirm });
  return apiSuccess({ deleted: true });
});
