import { signJwt, verifyJwt } from "@/lib/crypto/jwt";
import { envRequired } from "@/lib/stripe";

/**
 * /api/v1 access tokens — short-lived, stateless HS256 JWTs (§7 of the
 * brief). Deliberately minimal claims: no `role`-derived permissions beyond
 * the coarse USER/ADMIN/ADMIN_TEAMS role, and never a PRO/Founder flag —
 * entitlement checks always re-read `EntitlementService` server-side
 * (`src/server/entitlements`), never trust a claim in the token itself.
 */

export interface AccessTokenClaims {
  sub: string;
  sessionId: string;
  role: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

function accessTokenTtlSeconds(): number {
  const raw = process.env.ACCESS_TOKEN_TTL_SECONDS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 900; // 15 minutes
}

export interface IssueAccessTokenParams {
  userId: string;
  sessionId: string;
  role: string;
}

export function issueAccessToken(params: IssueAccessTokenParams): { token: string; expiresAt: string } {
  const secret = envRequired("ACCESS_TOKEN_SECRET");
  const issuer = envRequired("ACCESS_TOKEN_ISSUER");
  const audience = envRequired("ACCESS_TOKEN_AUDIENCE");
  const ttl = accessTokenTtlSeconds();
  const now = Math.floor(Date.now() / 1000);

  const claims: AccessTokenClaims = {
    sub: params.userId,
    sessionId: params.sessionId,
    role: params.role,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + ttl,
  };
  return {
    token: signJwt(claims as unknown as Record<string, unknown>, secret),
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
  };
}

export type VerifyAccessTokenResult =
  | { ok: true; claims: AccessTokenClaims }
  | { ok: false; reason: "expired" | "invalid" };

export function verifyAccessToken(token: string): VerifyAccessTokenResult {
  let secret: string, issuer: string, audience: string;
  try {
    secret = envRequired("ACCESS_TOKEN_SECRET");
    issuer = envRequired("ACCESS_TOKEN_ISSUER");
    audience = envRequired("ACCESS_TOKEN_AUDIENCE");
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const result = verifyJwt<AccessTokenClaims>(token, secret);
  if (!result.ok) return { ok: false, reason: result.reason === "expired" ? "expired" : "invalid" };
  if (result.claims.iss !== issuer || result.claims.aud !== audience) return { ok: false, reason: "invalid" };
  return { ok: true, claims: result.claims };
}
