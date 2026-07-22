// Global Vitest setup (see vitest.config.ts's `test.setupFiles`), runs once
// per test file before that file's own code. Several unrelated test suites
// go through the real POST /api/register handler just to get a logged-in
// user — that handler always tries to build a verification link via
// src/lib/email-verification.ts's buildVerificationUrl(), which reads the
// required APP_URL env var and throws if it's missing. Without a value here,
// every one of those registrations logged "Verification email send failed:
// Missing environment variable: APP_URL" to the console. This is a fallback
// only: files that care about the exact URL (or want to assert on it) still
// set their own APP_URL, which simply overrides this default.
if (!process.env.APP_URL) {
  process.env.APP_URL = "http://localhost:3000";
}
