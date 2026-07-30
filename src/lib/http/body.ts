import { readJsonBody } from "@/lib/auth";
import { ApiError } from "./errors";

/**
 * Adapts `@/lib/auth`'s `readJsonBody` (Content-Type + size-cap enforcement,
 * already shared by every legacy route) into the /api/v1 envelope — reuses
 * the same parsing logic rather than re-implementing it, only translates
 * the resulting error shape.
 */
export async function readV1JsonBody<T>(req: Request, maxBytes?: number): Promise<T> {
  const result = await readJsonBody<T>(req, maxBytes);
  if ("error" in result) {
    const status = result.error.status;
    if (status === 415) throw new ApiError("UNSUPPORTED_MEDIA_TYPE");
    if (status === 413) throw new ApiError("PAYLOAD_TOO_LARGE");
    throw new ApiError("VALIDATION_ERROR", "Nieprawidłowy JSON w treści żądania.");
  }
  return result.body;
}
