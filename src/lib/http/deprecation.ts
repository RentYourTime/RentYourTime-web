import type { NextResponse } from "next/server";

/**
 * Marks a legacy `/api/*` compatibility-adapter response per RFC 8594 —
 * `Deprecation: true` plus a `Link: <...>; rel="successor-version"` pointing
 * at the /api/v1 replacement. See docs/AUTH_MIGRATION.md for the retirement
 * plan. Mutates and returns the same response so call sites can do
 * `return withDeprecation(json(...), "/api/v1/auth/login")`.
 */
export function withDeprecation(res: NextResponse, successorPath: string): NextResponse {
  res.headers.set("Deprecation", "true");
  res.headers.set("Link", `<${successorPath}>; rel="successor-version"`);
  return res;
}

/**
 * Wraps an entire legacy route handler so *every* response it returns
 * (success or error, from any of its internal early-returns) carries the
 * Deprecation headers — without touching a single line of that handler's
 * own logic. Preferred over sprinkling `withDeprecation(...)` at each
 * return site, which would risk missing one.
 */
export function deprecatedRoute<Args extends unknown[]>(
  successorPath: string,
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => withDeprecation(await handler(...args), successorPath);
}
