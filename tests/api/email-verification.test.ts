import { beforeAll, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

// The only way to observe a verification token in tests, per design: real
// sends never happen here, and production never returns the raw token in
// an API response.
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.APP_URL = "https://example.test";
  process.env.EMAIL_FROM = "RentYourTime <no-reply@example.test>";
});

import { POST as register } from "@/app/api/register/route";
import { POST as verifyEmail } from "@/app/api/verify-email/route";
import { POST as resendVerification } from "@/app/api/resend-verification/route";
import { sendVerificationEmail } from "@/lib/email";
import { getDb } from "@/lib/db";

const mockSend = vi.mocked(sendVerificationEmail);

function extractToken(verificationUrl: string): string {
  const token = new URL(verificationUrl).searchParams.get("token");
  if (!token) throw new Error("verificationUrl had no token");
  return token;
}

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  return res.json();
}

describe("registration creates a verification token and emails it", () => {
  it("creates an unverified user, sends a token, and never leaks it in the response", async () => {
    mockSend.mockClear();
    const data = await registerUser("verify-alice@example.com");

    expect(data.ok).toBe(true);
    expect(data.user.email_verified).toBe(false);
    expect(data.verification_email_sent).toBe(true);
    // The bearer token is a legitimate 64-hex-char field; only a literal
    // "token=<hex>" (verification URL query string) would be a real leak.
    expect(JSON.stringify(data)).not.toMatch(/token=[0-9a-f]{64}/);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.email).toBe("verify-alice@example.com");
    expect(call.verificationUrl).toMatch(
      /^https:\/\/example\.test\/verify\?token=[0-9a-f]{64}$/
    );
  });

  it("does not delete or block the user when the email provider fails", async () => {
    mockSend.mockClear();
    mockSend.mockRejectedValueOnce(new Error("SES is down"));

    const res = await register(
      jsonRequest("http://localhost/api/register", {
        body: { email: "verify-dave@example.com", password: "StrongPassword123!" },
      })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.verification_email_sent).toBe(false);

    const row = getDb().prepare("SELECT id FROM users WHERE email = ?").get("verify-dave@example.com");
    expect(row).toBeTruthy();

    mockSend.mockResolvedValue(undefined);
  });
});

describe("POST /api/verify-email", () => {
  it("verifies the account using the token captured from the mocked email", async () => {
    mockSend.mockClear();
    await registerUser("verify-bob@example.com");
    const rawToken = extractToken(mockSend.mock.calls[0][0].verificationUrl);

    const res = await verifyEmail(
      jsonRequest("http://localhost/api/verify-email", { body: { token: rawToken } })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, email_verified: true });
  });

  it("rejects reusing the same token a second time", async () => {
    mockSend.mockClear();
    await registerUser("verify-carol@example.com");
    const rawToken = extractToken(mockSend.mock.calls[0][0].verificationUrl);

    await verifyEmail(
      jsonRequest("http://localhost/api/verify-email", { body: { token: rawToken } })
    );
    const res2 = await verifyEmail(
      jsonRequest("http://localhost/api/verify-email", { body: { token: rawToken } })
    );
    expect(res2.status).toBe(400);
    expect((await res2.json()).error).toBe("invalid_or_expired_token");
  });

  it("rejects an unknown/malformed token", async () => {
    const res = await verifyEmail(
      jsonRequest("http://localhost/api/verify-email", { body: { token: "not-a-real-token" } })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_or_expired_token");
  });
});

describe("POST /api/resend-verification", () => {
  it("requires authorization", async () => {
    const res = await resendVerification(
      new Request("http://localhost/api/resend-verification", { method: "POST" })
    );
    expect(res.status).toBe(401);
  });

  it("invalidates the previous token and issues a new one", async () => {
    mockSend.mockClear();
    const data = await registerUser("verify-erin@example.com");
    const firstToken = extractToken(mockSend.mock.calls[0][0].verificationUrl);

    mockSend.mockClear();
    const res = await resendVerification(
      authedRequest("http://localhost/api/resend-verification", data.token, "POST")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      message: "If verification is still required, a new email has been sent.",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const secondToken = extractToken(mockSend.mock.calls[0][0].verificationUrl);
    expect(secondToken).not.toBe(firstToken);

    const oldRes = await verifyEmail(
      jsonRequest("http://localhost/api/verify-email", { body: { token: firstToken } })
    );
    expect(oldRes.status).toBe(400);

    const newRes = await verifyEmail(
      jsonRequest("http://localhost/api/verify-email", { body: { token: secondToken } })
    );
    expect(newRes.status).toBe(200);
  });

  it("gives the same generic response for an already-verified account, without sending anything", async () => {
    mockSend.mockClear();
    const data = await registerUser("verify-frank@example.com");
    const token = extractToken(mockSend.mock.calls[0][0].verificationUrl);
    await verifyEmail(jsonRequest("http://localhost/api/verify-email", { body: { token } }));

    mockSend.mockClear();
    const res = await resendVerification(
      authedRequest("http://localhost/api/resend-verification", data.token, "POST")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).message).toBe(
      "If verification is still required, a new email has been sent."
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("is rate-limited to 3 per hour per user", async () => {
    mockSend.mockClear();
    mockSend.mockResolvedValue(undefined);
    const data = await registerUser("verify-grace@example.com");

    for (let i = 0; i < 3; i++) {
      const res = await resendVerification(
        authedRequest("http://localhost/api/resend-verification", data.token, "POST")
      );
      expect(res.status).toBe(200);
    }
    const res4 = await resendVerification(
      authedRequest("http://localhost/api/resend-verification", data.token, "POST")
    );
    expect(res4.status).toBe(429);
  });
});
