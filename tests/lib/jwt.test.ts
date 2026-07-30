import { describe, expect, it } from "vitest";
import { signJwt, verifyJwt } from "@/lib/crypto/jwt";

interface Claims {
  sub: string;
  exp: number;
  iat: number;
}

describe("signJwt / verifyJwt", () => {
  it("round-trips claims through a valid signature", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({ sub: "user_1", iat: now, exp: now + 900 }, "secret");
    const result = verifyJwt<Claims>(token, "secret");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims.sub).toBe("user_1");
    }
  });

  it("produces a standard three-part compact JWS", () => {
    const token = signJwt({ sub: "user_1" }, "secret");
    expect(token.split(".")).toHaveLength(3);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signJwt({ sub: "user_1" }, "secret-a");
    const result = verifyJwt(token, "secret-b");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("rejects a tampered payload even if the signature segment is untouched", () => {
    const token = signJwt({ sub: "user_1", role: "USER" }, "secret");
    const [header, , signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: "user_1", role: "ADMIN" })).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    const result = verifyJwt(tampered, "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("rejects an expired token", () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const token = signJwt({ sub: "user_1", exp: past }, "secret");
    const result = verifyJwt(token, "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects a malformed token", () => {
    const result = verifyJwt("not-a-jwt", "secret");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });
});
