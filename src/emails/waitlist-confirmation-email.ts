/**
 * Waitlist confirmation email — table-based HTML.
 *
 * Uses solid hex colors instead of translucent rgba() throughout, and drops
 * `color-scheme: dark` — see the detailed rationale in
 * waitlist-owner-notification-email.ts (same root cause: semi-transparent
 * colors + a dark-mode hint were getting reprocessed by webmail clients into
 * a washed-out, low-contrast render, confirmed via screenshots).
 */

const COLORS = {
  background: "#050505",
  card: "#0a0a0a",
  cardBorder: "#1e1e1e",
  boxBg: "#111111",
  boxBorder: "#191919",
  text: "#ffffff",
  textSecondary: "#a8a8a8",
  textMuted: "#707070",
  boxBodyText: "#b6b6b6",
  green: "#00e676",
  badgeBg: "#092015",
  badgeBorder: "#0d3f28",
} as const;

// Single-quoted font name (not double) — this gets embedded inside
// double-quoted HTML style="" attributes, so a literal " here would close
// the attribute early and silently truncate every style using it.
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const SUBJECT = "You're on the RentYourTime waitlist";
const PREHEADER = "We'll let you know when beta access opens.";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderWaitlistConfirmationEmail(): RenderedEmail {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SUBJECT}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:${FONT_STACK};">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${PREHEADER}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;">
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <span style="font-family:${FONT_STACK}; font-size:18px; font-weight:700; color:${COLORS.text} !important;">
                  rentyourtime<span style="color:${COLORS.green} !important;">.</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="background-color:${COLORS.card}; border:1px solid ${COLORS.cardBorder}; border-radius:28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="height:4px; line-height:4px; font-size:0; background-color:${COLORS.green};" bgcolor="${COLORS.green}">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:44px 40px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-radius:999px; background-color:${COLORS.badgeBg}; border:1px solid ${COLORS.badgeBorder};">
                        <tr>
                          <td style="padding:6px 12px 6px 10px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="padding-right:8px;">
                                  <div style="width:7px; height:7px; border-radius:999px; background-color:${COLORS.green}; font-size:0; line-height:0;">&nbsp;</div>
                                </td>
                                <td style="font-family:${FONT_STACK}; font-size:11px; font-weight:700; letter-spacing:0.12em; color:${COLORS.green} !important; white-space:nowrap;">YOU'RE ON THE LIST</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <div style="padding-top:20px; font-family:${FONT_STACK}; font-size:34px; line-height:1.12; font-weight:700; color:${COLORS.text} !important;">
                        Welcome to<br />RentYourTime.
                      </div>

                      <div style="padding-top:18px; font-family:${FONT_STACK}; font-size:15px; line-height:1.6; color:${COLORS.textSecondary} !important; max-width:440px;">
                        You're now on the beta waitlist. We'll email you the moment early access
                        opens &mdash; no spam, just the signal.
                      </div>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px; background-color:${COLORS.boxBg}; border:1px solid ${COLORS.boxBorder}; border-radius:18px;">
                        <tr>
                          <td style="padding:20px 22px;">
                            <div style="font-family:${FONT_STACK}; font-size:12px; letter-spacing:0.06em; text-transform:uppercase; color:${COLORS.textMuted} !important;">
                              While you wait
                            </div>
                            <div style="padding-top:6px; font-family:${FONT_STACK}; font-size:14px; line-height:1.55; color:${COLORS.boxBodyText} !important;">
                              Every scroll, every tap, every minute &mdash; it all adds up. Soon
                              you'll see exactly what it costs.
                            </div>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px; border-top:1px solid ${COLORS.cardBorder};">
                        <tr>
                          <td style="padding-top:24px; font-family:${FONT_STACK}; font-size:14px; font-weight:700; color:${COLORS.green} !important;">
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
              <td align="center" style="padding-top:28px; font-family:${FONT_STACK}; font-size:12px; line-height:1.6; color:${COLORS.textMuted} !important;">
                RentYourTime &middot; You received this because you joined the waitlist.
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

You're now on the beta waitlist. We'll email you the moment early access opens —
no spam, just the signal.

While you wait: every scroll, every tap, every minute — it all adds up. Soon
you'll see exactly what it costs.

Every minute costs.

RentYourTime · You received this because you joined the waitlist.
`;

  return { subject: SUBJECT, html, text };
}
