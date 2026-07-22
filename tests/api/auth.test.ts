import { beforeAll, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

// This file exercises register/login/logout/me directly, not email
// delivery, so the SES send is mocked. Token creation still runs for real.
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
});

import { POST as register } from "@/app/api/register/route";
import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as me } from "@/app/api/me/route";
import { getDb } from "@/lib/db";

const STRONG_PASSWORD = "StrongPassword123!";

async function registerUser(email: string, password = STRONG_PASSWORD) {
  const res = await register(jsonRequest("http://localhost/api/register", { body: { email, password } }));
  return { res, data: await res.json() };
}

describe("POST /api/register", () => {
  it("creates a new account and issues a token, without leaking the password hash", async () => {
    const { res, data } = await registerUser("alice@example.com");
    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.user.email).toBe("alice@example.com");
    expect(data.user.role).toBe("USER");
    expect(typeof data.token).toBe("string");
    expect(typeof data.expires_at).toBe("string");
    expect(data.user.password_hash).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("scrypt$");
  });

  it("rejects a duplicate email with 409", async () => {
    await registerUser("bob@example.com");
    const { res, data } = await registerUser("bob@example.com");
    expect(res.status).toBe(409);
    expect(data.error).toBe("email_taken");
  });

  it("rejects a password that fails the complexity policy", async () => {
    const { res, data } = await registerUser("carol@example.com", "alllowercase1");
    expect(res.status).toBe(422);
    expect(data.error).toBe("invalid_password");
  });
});

describe("POST /api/login", () => {
  it("logs in with correct credentials", async () => {
    await registerUser("dave@example.com");
    const res = await login(
      jsonRequest("http://localhost/api/login", {
        body: { email: "dave@example.com", password: STRONG_PASSWORD },
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.token).toBe("string");
  });

  it("rejects a wrong password with a generic 401 (no account-existence leak)", async () => {
    await registerUser("erin@example.com");
    const res = await login(
      jsonRequest("http://localhost/api/login", {
        body: { email: "erin@example.com", password: "WrongPassword123" },
      })
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("invalid_credentials");
  });

  it("rejects an unknown email with the same generic 401", async () => {
    const res = await login(
      jsonRequest("http://localhost/api/login", {
        body: { email: "nobody@example.com", password: STRONG_PASSWORD },
      })
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("invalid_credentials");
  });

  it("rejects a deactivated account with the same generic 401", async () => {
    await registerUser("frank@example.com");
    getDb().prepare("UPDATE users SET is_active = 0 WHERE email = ?").run("frank@example.com");
    const res = await login(
      jsonRequest("http://localhost/api/login", {
        body: { email: "frank@example.com", password: STRONG_PASSWORD },
      })
    );
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("invalid_credentials");
  });
});

describe("GET /api/me and POST /api/logout", () => {
  it("returns the current user with a NONE subscription by default", async () => {
    const { data: reg } = await registerUser("grace@example.com");
    const res = await me(authedRequest("http://localhost/api/me", reg.token));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.user.email).toBe("grace@example.com");
    expect(typeof data.user.id).toBe("string");
    expect(data.user.id.length).toBeGreaterThan(0);
    expect(data.user.id).toBe(reg.user.id);
    expect(data.user.subscription.is_pro).toBe(false);
    expect(data.user.subscription.source).toBe("NONE");
  });

  it("rejects an expired token", async () => {
    const { data: reg } = await registerUser("heidi@example.com");
    getDb()
      .prepare(
        `UPDATE tokens SET expires_at = '2000-01-01T00:00:00.000Z'
         WHERE user_id = (SELECT id FROM users WHERE email = ?)`
      )
      .run("heidi@example.com");
    const res = await me(authedRequest("http://localhost/api/me", reg.token));
    expect(res.status).toBe(401);
  });

  it("logout revokes the token and is idempotent when called again", async () => {
    const { data: reg } = await registerUser("ivan@example.com");

    const res1 = await logout(authedRequest("http://localhost/api/logout", reg.token, "POST"));
    expect(res1.status).toBe(200);
    expect((await res1.json()).ok).toBe(true);

    const meAfterLogout = await me(authedRequest("http://localhost/api/me", reg.token));
    expect(meAfterLogout.status).toBe(401);

    // Calling logout again with the now-revoked token must not error.
    const res2 = await logout(authedRequest("http://localhost/api/logout", reg.token, "POST"));
    expect(res2.status).toBe(200);
    expect((await res2.json()).ok).toBe(true);
  });
});
