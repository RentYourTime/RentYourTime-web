import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { renderVerificationEmail } from "@/emails/verification-email";
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
  const from = envRequired("EMAIL_FROM");
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const { subject, html, text } = renderVerificationEmail({
    verificationUrl: params.verificationUrl,
    displayName: params.displayName,
  });

  await getSesClient().send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [params.email] },
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
    })
  );
}
