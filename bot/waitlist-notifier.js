/**
 * Waitlist owner-DM polling logic, extracted so it's unit-testable without a
 * live Discord connection or SQLite file — everything it needs is injected.
 *
 * The fix this exists for: a failed DM must NOT be marked notified (the
 * previous inline version in index.js called markNotified() unconditionally,
 * so a closed-DM owner silently stopped getting notified forever).
 */

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between retries for a row that just failed

export function formatWaitlistDm(row, total) {
  const date =
    new Date(row.created_at).toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";

  return {
    title: "New RentYourTime waitlist signup",
    fields: [
      { name: "Email", value: row.email },
      // This table is only ever written to by the website's waitlist form,
      // so every row this poller sees is a website signup by construction.
      { name: "Source", value: "Website" },
      { name: "Date", value: date },
      { name: "Total signups", value: String(total) },
    ],
  };
}

/**
 * @param {object} deps
 * @param {() => Array<{email: string, created_at: string}>} deps.getUnnotified
 * @param {(email: string) => void} deps.markNotified
 * @param {() => number} deps.countTotal
 * @param {(message: {title: string, fields: Array}) => Promise<boolean>} deps.sendOwnerDm - resolves true only if actually sent
 * @param {number} [deps.cooldownMs]
 * @param {() => number} [deps.now]
 */
export function createWaitlistNotifier({
  getUnnotified,
  markNotified,
  countTotal,
  sendOwnerDm,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = () => Date.now(),
}) {
  const lastAttempt = new Map();

  return async function pollWaitlist() {
    let rows;
    try {
      rows = getUnnotified();
    } catch (err) {
      console.warn("Waitlist poll failed:", err.message);
      return;
    }

    for (const row of rows) {
      const last = lastAttempt.get(row.email);
      if (last !== undefined && now() - last < cooldownMs) continue;

      let sent = false;
      try {
        const total = countTotal();
        sent = await sendOwnerDm(formatWaitlistDm(row, total));
      } catch (err) {
        console.warn("Waitlist DM failed, will retry later:", err.message);
      }

      if (sent) {
        lastAttempt.delete(row.email);
        markNotified(row.email);
      } else {
        lastAttempt.set(row.email, now());
      }
    }
  };
}
