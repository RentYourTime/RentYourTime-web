/**
 * Waitlist confirmation email — same table-based, inline-CSS, dark/green
 * design as verification-email.ts (see that file for the client-compat
 * rationale: Gmail/Apple Mail/Outlook/mobile, no JS, no external fonts).
 */

const COLORS = {
  background: "#050505",
  card: "#0a0a0a",
  cardBorder: "rgba(255,255,255,0.08)",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.58)",
  textMuted: "rgba(255,255,255,0.35)",
  green: "#00e676",
} as const;

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

const SUBJECT = "You're on the RentYourTime waitlist";
const PREHEADER = "We'll let you know when beta access opens.";

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

export function renderWaitlistConfirmationEmail(): RenderedEmail {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
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
              <td align="center" style="padding-bottom:28px;">
                <span style="font-family:${FONT_STACK}; font-size:18px; font-weight:700; color:${COLORS.text};">
                  rentyourtime<span style="color:${COLORS.green};">.</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="background-color:${COLORS.card}; border:1px solid ${COLORS.cardBorder}; border-radius:28px; padding:40px 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:${FONT_STACK}; font-size:12px; font-weight:700; letter-spacing:0.1em; color:${COLORS.green};">
                      YOU'RE ON THE LIST
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px; font-family:${FONT_STACK}; font-size:30px; line-height:1.2; font-weight:700; color:${COLORS.text};">
                      Welcome to RentYourTime.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:16px; font-family:${FONT_STACK}; font-size:15px; line-height:1.55; color:${COLORS.textSecondary};">
                      You're now on the beta waitlist. We'll email you when early access
                      becomes available.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:28px; border-top:1px solid ${COLORS.cardBorder}; padding-top:24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-top:20px; font-family:${FONT_STACK}; font-size:13px; font-weight:700; color:${COLORS.green};">
                            Every minute costs.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:28px; font-family:${FONT_STACK}; font-size:12px; line-height:1.6; color:${COLORS.textMuted};">
                RentYourTime
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `YOU'RE ON THE LIST

Welcome to RentYourTime.

You're now on the beta waitlist. We'll email you when early access becomes available.

Every minute costs.

RentYourTime
`;

  return { subject: SUBJECT, html, text };
}
