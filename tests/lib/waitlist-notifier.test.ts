import { describe, expect, it, vi } from "vitest";
import { createWaitlistNotifier, formatWaitlistDm } from "../../bot/waitlist-notifier.js";

describe("formatWaitlistDm", () => {
  it("includes email, source, date, and total signups", () => {
    const msg = formatWaitlistDm(
      { email: "a@example.com", created_at: "2026-07-22T02:15:00.000Z" },
      123
    );
    expect(msg.title).toBe("New RentYourTime waitlist signup");
    const values = msg.fields.map((f) => f.value);
    expect(values).toContain("a@example.com");
    expect(values).toContain("Website");
    expect(values).toContain("123");
  });
});

describe("createWaitlistNotifier", () => {
  it("marks a row notified only after a successful DM", async () => {
    const marked: string[] = [];
    const notifier = createWaitlistNotifier({
      getUnnotified: () => [{ email: "a@example.com", created_at: "2026-01-01T00:00:00.000Z" }],
      markNotified: (email: string) => marked.push(email),
      countTotal: () => 1,
      sendOwnerDm: vi.fn().mockResolvedValue(true),
    });
    await notifier();
    expect(marked).toEqual(["a@example.com"]);
  });

  it("does not mark a row notified when the DM resolves false", async () => {
    const marked: string[] = [];
    const notifier = createWaitlistNotifier({
      getUnnotified: () => [{ email: "a@example.com", created_at: "2026-01-01T00:00:00.000Z" }],
      markNotified: (email: string) => marked.push(email),
      countTotal: () => 1,
      sendOwnerDm: vi.fn().mockResolvedValue(false),
    });
    await notifier();
    expect(marked).toEqual([]);
  });

  it("does not mark a row notified when the DM throws", async () => {
    const marked: string[] = [];
    const notifier = createWaitlistNotifier({
      getUnnotified: () => [{ email: "a@example.com", created_at: "2026-01-01T00:00:00.000Z" }],
      markNotified: (email: string) => marked.push(email),
      countTotal: () => 1,
      sendOwnerDm: vi.fn().mockRejectedValue(new Error("discord down")),
    });
    await notifier();
    expect(marked).toEqual([]);
  });

  it("applies a cooldown before retrying a row that just failed", async () => {
    let time = 0;
    const send = vi.fn().mockResolvedValue(false);
    const notifier = createWaitlistNotifier({
      getUnnotified: () => [{ email: "a@example.com", created_at: "2026-01-01T00:00:00.000Z" }],
      markNotified: () => {},
      countTotal: () => 1,
      sendOwnerDm: send,
      cooldownMs: 1000,
      now: () => time,
    });

    await notifier();
    expect(send).toHaveBeenCalledTimes(1);

    time += 500; // still within cooldown
    await notifier();
    expect(send).toHaveBeenCalledTimes(1);

    time += 600; // 1100ms elapsed, past cooldown
    await notifier();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("passes the injected total count through to the DM", async () => {
    const send = vi.fn().mockResolvedValue(true);
    const notifier = createWaitlistNotifier({
      getUnnotified: () => [{ email: "a@example.com", created_at: "2026-01-01T00:00:00.000Z" }],
      markNotified: () => {},
      countTotal: () => 42,
      sendOwnerDm: send,
    });
    await notifier();
    const [message] = send.mock.calls[0];
    expect(message.fields.find((f: { name: string }) => f.name === "Total signups").value).toBe(
      "42"
    );
  });

  it("swallows a getUnnotified failure without throwing", async () => {
    const notifier = createWaitlistNotifier({
      getUnnotified: () => {
        throw new Error("db down");
      },
      markNotified: () => {},
      countTotal: () => 0,
      sendOwnerDm: vi.fn(),
    });
    await expect(notifier()).resolves.toBeUndefined();
  });
});
