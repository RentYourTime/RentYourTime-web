import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal HS256 JWT sign/verify — no external dependency (matches this
 * project's existing "no NextAuth, no JWT library" stance in
 * src/lib/auth.ts). Produces and accepts standard compact
 * `header.payload.signature` JWS tokens (RFC 7519), so any generic JWT
 * decoder (including client-side debugging on iOS) can read the claims —
 * only the verification/signing is hand-rolled, not the wire format.
 */

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function hmacSign(data: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(data).digest());
}

const JWT_HEADER = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export function signJwt(claims: Record<string, unknown>, secret: string): string {
  const payload = base64url(JSON.stringify(claims));
  const data = `${JWT_HEADER}.${payload}`;
  return `${data}.${hmacSign(data, secret)}`;
}

export type JwtVerifyResult<T> =
  | { ok: true; claims: T }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "not_yet_valid" };

interface StandardClaims {
  exp?: number;
  nbf?: number;
}

/** Verifies signature, `exp`, and `nbf` (when present). Does not check `iss`/`aud` — callers compare those explicitly against their own expected values. */
export function verifyJwt<T extends StandardClaims>(token: string, secret: string): JwtVerifyResult<T> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = Buffer.from(hmacSign(data, secret));
  const actualSig = Buffer.from(signatureB64);
  if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) {
    return { ok: false, reason: "bad_signature" };
  }

  let claims: T;
  try {
    claims = JSON.parse(base64urlDecode(payloadB64).toString("utf8")) as T;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp <= now) return { ok: false, reason: "expired" };
  if (typeof claims.nbf === "number" && claims.nbf > now) return { ok: false, reason: "not_yet_valid" };

  return { ok: true, claims };
}
