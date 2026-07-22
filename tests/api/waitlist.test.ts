import { beforeAll, describe, expect, it, vi } from "vitest";
import { jsonRequest, useIsolatedDataDir } from "../helpers/testDb";

vi.mock("@/lib/email", () => ({
  sendWaitlistConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendWaitlistOwnerNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(() => {
  useIsolatedDataDir();
  process.env.APP_URL = "https://example.test";
});

import { POST as postWaitlist } from "@/app/api/waitlist/route";
import { getDb } from "@/lib/db";
import { sendWaitlistConfirmationEmail, sendWaitlistOwnerNotificationEmail } from "@/lib/email";

const mockConfirmation = vi.mocked(sendWaitlistConfirmationEmail);
const mockOwnerNotify = vi.mocked(sendWaitlistOwnerNotificationEmail);

/** Lets the route's fire-and-forget notification chain (mocked, no real I/O) settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function postJson(body: unknown, ip?: string) {
  return postWaitlist(jsonRequest("http://localhost/api/waitlist", { body, ip }));
}

function getRow(email: string) {
  return getDb().prepare("SELECT * FROM waitlist WHERE email = ?").get(email) as
    | Record<string, unknown>
    | undefined;
}

describe("POST /api/waitlist", () => {
  it("creates a record with the correct defaults for a new email", async () => {
    const res = await postJson({ email: "New@Example.com" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, message: "You're on the list.", count: expect.any(Number) });

    const row = getRow("new@example.com");
    expect(row).toBeTruthy();
    expect(row!.source).toBe("WEBSITE");
    expect(row!.status).toBe("NEW");
    expect(row!.notified).toBe(0);
    expect(row!.id).toBeTruthy();
  });

  it("does not create a second row for a duplicate, and never discloses it", async () => {
    await postJson({ email: "dup@example.com" });
    const res2 = await postJson({ email: "dup@example.com" });
    const data2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(data2).toEqual({ ok: true, message: "You're on the list.", count: expect.any(Number) });
    expect(Object.keys(data2)).not.toContain("new");

    const rows = getDb().prepare("SELECT * FROM waitlist WHERE email = ?").all("dup@example.com");
    expect(rows).toHaveLength(1);
  });

  it("stores the IP as a hash, never raw", async () => {
    await postJson({ email: "iptest@example.com" }, "203.0.113.5");
    const row = getRow("iptest@example.com");
    expect(row!.ip).not.toBe("203.0.113.5");
    expect(row!.ip).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sends a confirmation email and sets confirmation_sent once it succeeds", async () => {
    mockConfirmation.mockClear();
    await postJson({ email: "confirm@example.com" });
    await flush();

    expect(mockConfirmation).toHaveBeenCalledWith("confirm@example.com");
    expect(getRow("confirm@example.com")!.confirmation_sent).toBe(1);
  });

  it("leaves confirmation_sent at 0 when the send fails", async () => {
    mockConfirmation.mockClear();
    mockConfirmation.mockRejectedValueOnce(new Error("SES is down"));
    await postJson({ email: "failconfirm@example.com" });
    await flush();

    expect(getRow("failconfirm@example.com")!.confirmation_sent).toBe(0);
    mockConfirmation.mockResolvedValue(undefined);
  });

  it("notifies the owner by email only when WAITLIST_NOTIFY_EMAIL is set", async () => {
    mockOwnerNotify.mockClear();
    delete process.env.WAITLIST_NOTIFY_EMAIL;
    await postJson({ email: "noowner@example.com" });
    await flush();
    expect(mockOwnerNotify).not.toHaveBeenCalled();

    process.env.WAITLIST_NOTIFY_EMAIL = "owner@example.com";
    await postJson({ email: "withowner@example.com" });
    await flush();
    expect(mockOwnerNotify).toHaveBeenCalledTimes(1);
    expect(getRow("withowner@example.com")!.owner_email_notified).toBe(1);
    delete process.env.WAITLIST_NOTIFY_EMAIL;
  });

  it("honeypot: pretends success without creating a row", async () => {
    const res = await postJson({ email: "bot@example.com", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(getRow("bot@example.com")).toBeUndefined();
  });

  it("rejects an invalid email", async () => {
    const res = await postJson({ email: "not-an-email" });
    expect(res.status).toBe(422);
  });
});
