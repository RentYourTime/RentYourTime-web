import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt — no native bcrypt dependency.
 * Stored format: `scrypt$<N>$<saltHex>$<hashHex>`.
 */

const KEYLEN = 64;
const COST = 16384; // 2^14

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN, { N: COST });
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2]!, "hex");
  const expected = Buffer.from(parts[3]!, "hex");
  if (!Number.isFinite(cost) || salt.length === 0 || expected.length === 0) return false;
  const derived = scryptSync(password, salt, expected.length, { N: cost });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Password policy: 10-200 chars, at least one lowercase letter, one
 * uppercase letter, and one digit. Returns an error code, or null if the
 * password is acceptable.
 */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 10 || password.length > 200) return "invalid_password";
  if (!/[a-z]/.test(password)) return "invalid_password";
  if (!/[A-Z]/.test(password)) return "invalid_password";
  if (!/[0-9]/.test(password)) return "invalid_password";
  return null;
}

/**
 * Whether a stored hash was made with an older cost factor than today's
 * `COST` and should be rehashed. Callers should only rehash right after a
 * successful `verifyPassword()` (i.e. they already have the plaintext),
 * never independently — this never invalidates existing accounts on its
 * own, it just lets a future COST bump roll forward opportunistically.
 */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  return Number.isFinite(cost) && cost < COST;
}
