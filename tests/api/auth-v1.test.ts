import { beforeAll, describe, expect, it, vi } from "vitest";
import { jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
});

import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as refreshRoute } from "@/app/api/v1/auth/refresh/route";
import { POST as logoutAllRoute } from "@/app/api/v1/auth/logout-all/route";
import { GET as meRoute } from "@/app/api/v1/auth/me/route";
import { POST as registerDeviceRoute } from "@/app/api/v1/devices/register/route";
import { DELETE as deleteDeviceRoute } from "@/app/api/v1/devices/[id]/route";
import { GET as listDevicesRoute } from "@/app/api/v1/devices/route";

// Every /api/v1 handler is wrapped by withApiRoute<RouteCtx>, whose second
// (route-context) parameter is only ever supplied by Next.js itself for
// dynamic routes. These thin adapters let tests call non-dynamic handlers
// with just a Request, like the legacy tests/api/auth.test.ts does.
const register = (req: Request) => registerRoute(req, undefined);
const login = (req: Request) => loginRoute(req, undefined);
const refresh = (req: Request) => refreshRoute(req, undefined);
const logoutAll = (req: Request) => logoutAllRoute(req, undefined);
const me = (req: Request) => meRoute(req, undefined);
const registerDevice = (req: Request) => registerDeviceRoute(req, undefined);
const listDevices = (req: Request) => listDevicesRoute(req, undefined);
const deleteDevice = (req: Request, id: string) => deleteDeviceRoute(req, { params: Promise.resolve({ id }) });

const STRONG_PASSWORD = "StrongPassword123!";

function authedRequestV1(url: string, accessToken: string, method = "GET", body?: unknown) {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-forwarded-for": `10.${Math.floor(Math.random() * 254) + 1}.0.1`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function registerUser(email: string) {
  const res = await register(
    jsonRequest("http://localhost/api/v1/auth/register", { body: { email, password: STRONG_PASSWORD, platform: "IOS" } })
  );
  const json = await res.json();
  return { res, data: json.data as { user: { id: string }; session: { accessToken: string; refreshToken: string } } };
}

describe("POST /api/v1/auth/register", () => {
  it("creates an account and returns a session envelope", async () => {
    const { res, data } = await registerUser("v1-alice@example.com");
    expect(res.status).toBe(201);
    expect(data.user.id).toBeTruthy();
    expect(typeof data.session.accessToken).toBe("string");
    expect(typeof data.session.refreshToken).toBe("string");
    expect(data.session.accessToken.split(".")).toHaveLength(3); // JWT shape
  });

  it("rejects a duplicate email with EMAIL_TAKEN", async () => {
    await registerUser("v1-bob@example.com");
    const res = await register(
      jsonRequest("http://localhost/api/v1/auth/register", {
        body: { email: "v1-bob@example.com", password: STRONG_PASSWORD },
      })
    );
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error.code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /api/v1/auth/login + GET /api/v1/auth/me", () => {
  it("logs in and the returned access token authenticates /auth/me", async () => {
    await registerUser("v1-carol@example.com");
    const res = await login(
      jsonRequest("http://localhost/api/v1/auth/login", {
        body: { email: "v1-carol@example.com", password: STRONG_PASSWORD, platform: "IOS" },
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);

    const meRes = await me(authedRequestV1("http://localhost/api/v1/auth/me", json.data.session.accessToken));
    const meJson = await meRes.json();
    expect(meRes.status).toBe(200);
    expect(meJson.data.user.email).toBe("v1-carol@example.com");
  });

  it("rejects wrong credentials with INVALID_CREDENTIALS (generic, no enumeration)", async () => {
    const res = await login(
      jsonRequest("http://localhost/api/v1/auth/login", { body: { email: "nobody@example.com", password: "wrong" } })
    );
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the refresh token and the old one can no longer be used", async () => {
    const { data: reg } = await registerUser("v1-dave@example.com");
    const r1 = reg.session.refreshToken;

    const refreshRes = await refresh(
      jsonRequest("http://localhost/api/v1/auth/refresh", { body: { refreshToken: r1 } })
    );
    const refreshJson = await refreshRes.json();
    expect(refreshRes.status).toBe(200);
    const r2 = refreshJson.data.session.refreshToken;
    expect(r2).not.toBe(r1);

    // Reusing r1 now must fail with reuse detection.
    const reuseRes = await refresh(
      jsonRequest("http://localhost/api/v1/auth/refresh", { body: { refreshToken: r1 } })
    );
    const reuseJson = await reuseRes.json();
    expect(reuseRes.status).toBe(401);
    expect(reuseJson.error.code).toBe("TOKEN_REUSE_DETECTED");

    // And because reuse revokes the whole family, r2 (the legitimately rotated one) is also dead now.
    const r2AgainRes = await refresh(
      jsonRequest("http://localhost/api/v1/auth/refresh", { body: { refreshToken: r2 } })
    );
    expect(r2AgainRes.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout-all", () => {
  it("revokes every session, invalidating even a freshly-issued access token from another login", async () => {
    await registerUser("v1-erin@example.com");
    const login1 = await login(
      jsonRequest("http://localhost/api/v1/auth/login", { body: { email: "v1-erin@example.com", password: STRONG_PASSWORD } })
    );
    const login1Json = await login1.json();
    const login2 = await login(
      jsonRequest("http://localhost/api/v1/auth/login", { body: { email: "v1-erin@example.com", password: STRONG_PASSWORD } })
    );
    const login2Json = await login2.json();

    const logoutRes = await logoutAll(authedRequestV1("http://localhost/api/v1/auth/logout-all", login1Json.data.session.accessToken, "POST"));
    expect(logoutRes.status).toBe(200);

    const meAfter = await me(authedRequestV1("http://localhost/api/v1/auth/me", login2Json.data.session.accessToken));
    expect(meAfter.status).toBe(401);
  });
});

describe("device registration and deletion", () => {
  it("registering a device binds it to the session, and deleting it revokes that session", async () => {
    const { data: reg } = await registerUser("v1-frank@example.com");
    const accessToken = reg.session.accessToken;

    const regDeviceRes = await registerDevice(
      authedRequestV1("http://localhost/api/v1/devices/register", accessToken, "POST", {
        installationId: "install-frank-1",
        platform: "IOS",
        deviceName: "Frank's iPhone",
      })
    );
    const regDeviceJson = await regDeviceRes.json();
    expect(regDeviceRes.status).toBe(201);
    const deviceId = regDeviceJson.data.device.id as string;

    const listRes = await listDevices(authedRequestV1("http://localhost/api/v1/devices", accessToken));
    const listJson = await listRes.json();
    expect(listJson.data.devices).toHaveLength(1);

    const delRes = await deleteDevice(authedRequestV1(`http://localhost/api/v1/devices/${deviceId}`, accessToken, "DELETE"), deviceId);
    expect(delRes.status).toBe(200);

    // The session that registered this device was bound to it, so it's now revoked too.
    const meAfter = await me(authedRequestV1("http://localhost/api/v1/auth/me", accessToken));
    expect(meAfter.status).toBe(401);
  });
});
