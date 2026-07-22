import { mkdirSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { renderVerificationEmail } from "../src/emails/verification-email";
import { renderWaitlistConfirmationEmail } from "../src/emails/waitlist-confirmation-email";
import { renderWaitlistOwnerNotificationEmail } from "../src/emails/waitlist-owner-notification-email";

const OUT_DIR =
  "C:/Users/Awski/AppData/Local/Temp/claude/c--Users-Awski-Downloads-RentYourTime-Calude/33bc9cd9-4a8b-4408-b56a-51f66527f61f/scratchpad/email-preview";

it("writes real rendered HTML output to disk for visual inspection", () => {
  mkdirSync(OUT_DIR, { recursive: true });

  writeFileSync(
    `${OUT_DIR}/verification.html`,
    renderVerificationEmail({
      verificationUrl: "https://rentyourtime.app/verify?token=EXAMPLE_TOKEN",
      displayName: null,
    }).html
  );

  writeFileSync(`${OUT_DIR}/waitlist-confirmation.html`, renderWaitlistConfirmationEmail().html);

  writeFileSync(
    `${OUT_DIR}/waitlist-owner-notification.html`,
    renderWaitlistOwnerNotificationEmail({
      email: "maya.chen@gmail.com",
      source: "Website",
      createdAt: "2026-07-22T09:14:00.000Z",
      totalSignups: 1284,
      adminUrl: "https://rentyourtime.app/admin/waitlist",
    }).html
  );
});
