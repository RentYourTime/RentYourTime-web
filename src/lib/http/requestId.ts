import { randomBytes } from "node:crypto";

/** `req_<24 hex chars>` — attached to every /api/v1 response's `meta.requestId` and logged alongside any server-side error for correlation. */
export function generateRequestId(): string {
  return `req_${randomBytes(12).toString("hex")}`;
}
