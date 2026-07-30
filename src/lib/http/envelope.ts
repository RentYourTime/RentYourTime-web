import { NextResponse } from "next/server";
import { ApiError, ERROR_CODES, type ErrorCode } from "./errors";
import { generateRequestId } from "./requestId";

/**
 * Response envelope for /api/v1 (docs/API_ARCHITECTURE.md). Legacy routes
 * under /api/* keep their existing `{ ok, ... }` shape via
 * `@/lib/auth`'s `json()`/`jsonError()` — this is intentionally a separate,
 * parallel helper rather than a rewrite of that one, so the legacy surface
 * never changes shape underneath existing clients/tests.
 */

const PRIVATE_DATA_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

export function apiSuccess<T>(data: T, opts: { status?: number; requestId?: string } = {}): NextResponse {
  const requestId = opts.requestId ?? generateRequestId();
  return NextResponse.json(
    { data, meta: { requestId } },
    { status: opts.status ?? 200, headers: PRIVATE_DATA_HEADERS }
  );
}

export function apiErrorResponse(
  code: ErrorCode,
  opts: { message?: string; fields?: Record<string, string>; requestId?: string; headers?: Record<string, string> } = {}
): NextResponse {
  const requestId = opts.requestId ?? generateRequestId();
  const spec = ERROR_CODES[code];
  return NextResponse.json(
    {
      error: {
        code,
        message: opts.message ?? spec.message,
        ...(opts.fields ? { fields: opts.fields } : {}),
      },
      meta: { requestId },
    },
    { status: spec.status, headers: { ...PRIVATE_DATA_HEADERS, ...opts.headers } }
  );
}

/**
 * Wraps a /api/v1 route handler: generates one requestId shared by success
 * and error paths, catches `ApiError` (expected, user-facing) and any other
 * thrown value (unexpected — logged server-side with the requestId for
 * correlation, never leaked to the client as a stack trace/message).
 *
 * Generic over `RouteCtx` so dynamic segments still work — Next 15 calls a
 * route handler as `(req, { params: Promise<{...}> })`; that second
 * argument is forwarded through untouched as `routeCtx` for handlers that
 * declare it (see `/api/v1/devices/[id]`), and simply unused otherwise.
 */
export function withApiRoute<RouteCtx = unknown>(
  handler: (req: Request, ctx: { requestId: string; routeCtx: RouteCtx }) => Promise<NextResponse>
): (req: Request, routeCtx: RouteCtx) => Promise<NextResponse> {
  return async (req: Request, routeCtx: RouteCtx) => {
    const requestId = generateRequestId();
    try {
      return await handler(req, { requestId, routeCtx });
    } catch (err) {
      if (err instanceof ApiError) {
        return apiErrorResponse(err.code, { message: err.message, fields: err.fields, requestId, headers: err.headers });
      }
      console.error(`[${requestId}] unhandled error:`, err instanceof Error ? err.stack ?? err.message : err);
      return apiErrorResponse("SERVER_ERROR", { requestId });
    }
  };
}
