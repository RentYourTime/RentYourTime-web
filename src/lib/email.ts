import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { renderVerificationEmail } from "@/emails/verification-email";
import { renderWaitlistConfirmationEmail } from "@/emails/waitlist-confirmation-email";
import {
  renderWaitlistOwnerNotificationEmail,
  type WaitlistOwnerNotificationParams,
} from "@/emails/waitlist-owner-notification-email";
import { envRequired } from "./stripe";

let client: SESv2Client | null = null;

/**
 * No explicit `credentials` — the SDK's default provider chain handles both
 * cases: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars when set, or the
 * EC2/ECS instance's IAM role automatically when they aren't. `AWS_REGION`
 * is a standard AWS SDK env var name, read automatically the same way.
 */
export function getSesClient(): SESv2Client {
  if (client) return client;
  client = new SESv2Client({ region: process.env.AWS_REGION });
  return client;
}

interface RenderedEmailLike {
  subject: string;
  html: string;
  text: string;
}

/** Shared SES send — never logs the recipient, subject, or body. */
async function sendRenderedEmail(to: string, rendered: RenderedEmailLike): Promise<void> {
  const from = envRequired("EMAIL_FROM");
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();

  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      Content: {
        Simple: {
          Subject: { Data: rendered.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: rendered.html, Charset: "UTF-8" },
            Text: { Data: rendered.text, Charset: "UTF-8" },
          },
        },
      },
    })
  );
}

export interface SendVerificationEmailParams {
  email: string;
  displayName?: string | null;
  verificationUrl: string;
}

/**
 * Throws on failure — callers decide what that means for their flow (e.g.
 * registration must still succeed). Never logs the verification URL/token,
 * only the fact that a send failed and the AWS error name.
 */
export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<void> {
  const rendered = renderVerificationEmail({
    verificationUrl: params.verificationUrl,
    displayName: params.displayName,
  });
  await sendRenderedEmail(params.email, rendered);
}

/** Throws on failure — the waitlist route must not block the user's response on this. */
export async function sendWaitlistConfirmationEmail(email: string): Promise<void> {
  await sendRenderedEmail(email, renderWaitlistConfirmationEmail());
}

/** Throws on failure — same non-blocking contract as the confirmation email. */
export async function sendWaitlistOwnerNotificationEmail(
  ownerEmail: string,
  params: WaitlistOwnerNotificationParams
): Promise<void> {
  await sendRenderedEmail(ownerEmail, renderWaitlistOwnerNotificationEmail(params));
}
