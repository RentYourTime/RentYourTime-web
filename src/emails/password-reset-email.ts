/**
 * Password reset email — same table-based/inline-CSS technique as
 * verification-email.ts (see that file for the detailed rationale on solid
 * hex colors + inner-<span> link styling for webmail clients).
 */

const COLORS = {
  background: "#050505",
  card: "#0a0a0a",
  cardBorder: "#1e1e1e",
  text: "#ffffff",
  textSecondary: "#a8a8a8",
  textMuted: "#707070",
  pillBg: "#141414",
  green: "#00e676",
  buttonText: "#001a0b",
} as const;

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const SUBJECT = "Reset your RentYourTime password";
const PREHEADER = "Use this link to set a new password for your RentYourTime account.";

export interface RenderPasswordResetEmailParams {
  resetUrl: string;
  displayName?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPasswordResetEmail({ resetUrl, displayName }: RenderPasswordResetEmailParams): RenderedEmail {
  const safeUrl = escapeHtml(resetUrl);
  const greeting = displayName ? `, ${escapeHtml(displayName)}` : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SUBJECT}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:${FONT_STACK};">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${escapeHtml(PREHEADER)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;">
            <tr>
              <td style="background-color:${COLORS.card}; border:1px solid ${COLORS.cardBorder}; border-radius:28px; padding:40px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:${FONT_STACK}; font-size:12px; font-weight:700; letter-spacing:0.1em; color:${COLORS.green} !important;">
                      RESET PASSWORD
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px; font-family:${FONT_STACK}; font-size:30px; line-height:1.2; font-weight:700; color:${COLORS.text} !important;">
                      Reset your password.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:16px; font-family:${FONT_STACK}; font-size:15px; line-height:1.55; color:${COLORS.textSecondary} !important;">
                      We received a request to reset the password for your RentYourTime account${greeting}. Tap the button below to choose a new one.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="border-radius:26px; background-color:${COLORS.green};" bgcolor="${COLORS.green}">
                            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                               style="display:inline-block; min-height:48px; line-height:48px; padding:0 32px; font-family:${FONT_STACK}; font-size:15px; font-weight:700; color:${COLORS.buttonText} !important; text-decoration:none !important; border-radius:26px;">
                              <span style="color:${COLORS.buttonText} !important; text-decoration:none !important;">Reset password</span>
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="background-color:${COLORS.pillBg}; border-radius:16px; padding:14px 18px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${COLORS.textSecondary} !important;">
                            &#9203; This link is valid for <b style="color:${COLORS.text} !important;">1 hour</b> and can only be used once.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:24px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; word-break:break-all;">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${COLORS.green} !important; text-decoration:underline !important;"><span style="color:${COLORS.green} !important;">${safeUrl}</span></a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:24px; border-top:1px solid ${COLORS.cardBorder};">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-top:20px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${COLORS.textMuted} !important;">
                            Didn't request this? Your password hasn't changed — you can safely ignore this email.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:28px; font-family:${FONT_STACK}; font-size:12px; line-height:1.6; color:${COLORS.textMuted} !important;">
                RentYourTime &middot; Every minute costs.<br />
                This is an automated account message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `RESET PASSWORD

Reset your password.

We received a request to reset the password for your RentYourTime account${displayName ? `, ${displayName}` : ""}. Use the link below to choose a new one.

Reset password: ${resetUrl}

This link is valid for 1 hour and can only be used once.

Didn't request this? Your password hasn't changed — you can safely ignore this email.

RentYourTime · Every minute costs.
This is an automated account message.
`;

  return { subject: SUBJECT, html, text };
}
