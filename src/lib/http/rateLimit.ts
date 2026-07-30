import { rateLimit } from "@/lib/auth";
import { ApiError } from "./errors";

/** Adapts the shared `rateLimit()` bucket (same `rate_limits` table every route already uses) into a thrown `ApiError`, preserving the `Retry-After` header. */
export function enforceRateLimit(
  req: Request,
  action: string,
  maxAttempts: number,
  windowSeconds: number,
  keyOverride?: string
): void {
  const limited = rateLimit(req, action, maxAttempts, windowSeconds, keyOverride);
  if (!limited) return;
  const retryAfter = limited.headers.get("Retry-After");
  throw new ApiError("RATE_LIMITED", undefined, undefined, retryAfter ? { "Retry-After": retryAfter } : undefined);
}
