import { beforeAll, describe, expect, it, vi } from "vitest";
import { authedRequest, jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

// This file only needs real registered users (via the real /api/register
// flow) to exercise the admin waitlist API — not email delivery, so the SES
// send is mocked. Token creation still runs for real.
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
});

import { POST as register } from "@/app/api/register/route";
import { GET as listWaitlist } from "@/app/api/admin/waitlist/route";
import { PATCH as patchWaitlist } from "@/app/api/admin/waitlist/[id]/route";
import { GET as exportWaitlist } from "@/app/api/admin/waitlist/export/route";
import { getDb } from "@/lib/db";
import { insertWaitlistSignup } from "@/lib/waitlist";

async function registerUser(email: string, role: "USER" | "ADMIN" = "USER") {
  const res = await register(
    jsonRequest("http://localhost/api/register", {
      body: { email, password: "StrongPassword123!" },
    })
  );
  const data = await res.json();
  if (role === "ADMIN") {
    getDb().prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?").run(data.user.id);
  }
  return data;
}

describe("GET /api/admin/waitlist", () => {
  it("requires authorization", async () => {
    const res = await listWaitlist(new Request("http://localhost/api/admin/waitlist"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const user = await registerUser("plain-user@example.com");
    const res = await listWaitlist(
      authedRequest("http://localhost/api/admin/waitlist", user.token)
    );
    expect(res.status).toBe(403);
  });

  it("lets an admin see the list and stats, without ip/user_agent", async () => {
    const admin = await registerUser("waitlist-admin@example.com", "ADMIN");
    insertWaitlistSignup({ email: "seed1@example.com", ipHash: "hash1", userAgent: "UA/1" });
    insertWaitlistSignup({ email: "seed2@example.com", ipHash: "hash2", userAgent: "UA/2" });

    const res = await listWaitlist(
      authedRequest("http://localhost/api/admin/waitlist", admin.token)
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stats.total).toBeGreaterThanOrEqual(2);
    expect(data.records.some((r: { email: string }) => r.email === "seed1@example.com")).toBe(
      true
    );
    expect(data.records[0].ip).toBeUndefined();
    expect(data.records[0].user_agent).toBeUndefined();
  });
});

describe("PATCH /api/admin/waitlist/[id]", () => {
  it("only ever writes status/notes/contacted_at — other fields are ignored", async () => {
    const admin = await registerUser("waitlist-admin-2@example.com", "ADMIN");
    const { id } = insertWaitlistSignup({
      email: "patchme@example.com",
      ipHash: null,
      userAgent: null,
    });

    const res = await patchWaitlist(
      jsonRequest("http://localhost/api/admin/waitlist/x", {
        method: "PATCH",
        token: admin.token,
        body: { status: "CONTACTED", email: "hacker@evil.example", source: "MANUAL" },
      }),
      { params: Promise.resolve({ id }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.record.status).toBe("CONTACTED");
    expect(data.record.email).toBe("patchme@example.com");

    const row = getDb().prepare("SELECT * FROM waitlist WHERE id = ?").get(id) as {
      source: string;
      contacted_at: string | null;
    };
    expect(row.source).toBe("WEBSITE");
    expect(row.contacted_at).toBeTruthy(); // auto-filled by the CONTACTED transition
  });

  it("returns 404 for an unknown id", async () => {
    const admin = await registerUser("waitlist-admin-3@example.com", "ADMIN");
    const res = await patchWaitlist(
      jsonRequest("http://localhost/api/admin/waitlist/x", {
        method: "PATCH",
        token: admin.token,
        body: { status: "CONTACTED" },
      }),
      { params: Promise.resolve({ id: "does-not-exist" }) }
    );
    expect(res.status).toBe(404);
  });

  it("requires admin", async () => {
    const user = await registerUser("waitlist-nonadmin@example.com");
    const res = await patchWaitlist(
      jsonRequest("http://localhost/api/admin/waitlist/x", {
        method: "PATCH",
        token: user.token,
        body: { status: "CONTACTED" },
      }),
      { params: Promise.resolve({ id: "whatever" }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/waitlist/export", () => {
  it("returns a CSV with the expected columns and no ip/user_agent", async () => {
    const admin = await registerUser("waitlist-admin-4@example.com", "ADMIN");
    insertWaitlistSignup({
      email: "exportme@example.com",
      ipHash: "should-not-appear-in-csv",
      userAgent: "Mozilla/5.0-should-not-appear",
    });

    const res = await exportWaitlist(
      authedRequest("http://localhost/api/admin/waitlist/export", admin.token)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const csv = await res.text();
    expect(csv.split("\n")[0]).toBe(
      "email,source,status,created_at,contacted_at,notified,owner_email_notified,confirmation_sent,notes"
    );
    expect(csv).toContain("exportme@example.com");
    expect(csv).not.toContain("should-not-appear-in-csv");
    expect(csv).not.toContain("Mozilla/5.0-should-not-appear");
  });

  it("requires admin", async () => {
    const res = await exportWaitlist(new Request("http://localhost/api/admin/waitlist/export"));
    expect(res.status).toBe(401);
  });
});
