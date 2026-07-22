import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Points DATA_DIR at a fresh temp directory so this test file's SQLite
 * database is fully isolated from every other file and from any real dev
 * database. Must run before the first call to `getDb()` in the process
 * (getDb() resolves DATA_DIR lazily on first use, so calling this in
 * `beforeAll` — even after the module under test has been imported — is
 * sufficient).
 */
export function useIsolatedDataDir(): void {
  const dir = mkdtempSync(path.join(tmpdir(), "ryt-test-"));
  process.env.DATA_DIR = dir;
}

function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

/**
 * Builds a JSON Request for a route handler under test. Defaults to a
 * fresh random `x-forwarded-for` per call so independent test cases don't
 * trip each other's per-IP rate limits (rate limiting itself is exercised
 * separately, by reusing the same `ip` on purpose).
 */
export function jsonRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    contentType?: string;
    ip?: string;
  } = {}
): Request {
  const headers: Record<string, string> = {
    "Content-Type": options.contentType ?? "application/json",
    "x-forwarded-for": options.ip ?? randomIp(),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  return new Request(url, {
    method: options.method ?? "POST",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

export function authedRequest(url: string, token: string, method = "GET"): Request {
  return new Request(url, { method, headers: { Authorization: `Bearer ${token}` } });
}
