import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, passwordPolicyError, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies a matching password", () => {
    const hash = hashPassword("Sup3rSecret!");
    expect(verifyPassword("Sup3rSecret!", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("Sup3rSecret!");
    expect(verifyPassword("WrongPassword1", hash)).toBe(false);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });

  it("enforces length and complexity", () => {
    expect(passwordPolicyError("short1A")).toBe("invalid_password"); // too short
    expect(passwordPolicyError("alllowercase123")).toBe("invalid_password"); // no uppercase
    expect(passwordPolicyError("ALLUPPERCASE123")).toBe("invalid_password"); // no lowercase
    expect(passwordPolicyError("NoDigitsHereAtAll")).toBe("invalid_password"); // no digit
    expect(passwordPolicyError("StrongPassword123!")).toBeNull();
  });

  it("does not flag a freshly hashed password for rehash", () => {
    expect(needsRehash(hashPassword("StrongPassword123!"))).toBe(false);
  });

  it("flags a lower-cost legacy hash for rehash", () => {
    const legacy = "scrypt$1024$" + "aa".repeat(16) + "$" + "bb".repeat(64);
    expect(needsRehash(legacy)).toBe(true);
  });
});
