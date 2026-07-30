/**
 * Single place the /api/v1 base URL is read from (§3: "Nie wpisuj base URL
 * w wielu plikach"). Nothing in this repo currently needs to build an
 * absolute link to its own API (routes are relative; Stripe/email links use
 * `APP_URL` via `envRequired("APP_URL")` in `@/lib/stripe`, which is a
 * distinct concern — the *web app's* public URL, not the API's). This
 * exists so the iOS/Watch/widget/Discord-bot clients — and this repo's own
 * OpenAPI doc — have exactly one source to point at, and so any future
 * server-side code that needs to construct a link to /api/v1 does too.
 */
export function apiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? "http://localhost:3000/api/v1").replace(/\/+$/, "");
}
