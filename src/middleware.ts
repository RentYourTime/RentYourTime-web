import { NextResponse } from "next/server";

/**
 * The project's only middleware, scoped narrowly to /verify. A page
 * component can't set arbitrary response headers in the App Router — this
 * is the sole supported way to guarantee `Cache-Control: no-store` on a
 * page that briefly carries a verification token in its query string (see
 * docs/EMAIL_VERIFICATION.md).
 */
export function middleware() {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/verify"],
};
