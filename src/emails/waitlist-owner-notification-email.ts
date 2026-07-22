/**
 * Owner-facing "new waitlist signup" email — table-based HTML.
 *
 * Two real rendering bugs fixed here (confirmed via screenshots, not just
 * style preference):
 * 1. Webmail clients (Gmail etc.) auto-linkify a bare email address in the
 *    text and re-skin it with their own blue/underline — overriding any
 *    color we set. Fixed by breaking the auto-detect pattern with a
 *    zero-width space; this value was never meant to be a clickable mailto:
 *    link anyway.
 * 2. The same clients frequently override an <a> tag's own `color`/
 *    `text-decoration`, especially inside a colored button. Fixed with the
 *    standard email-dev workaround: put the actual color/no-underline on an
 *    inner <span>, which most clients leave alone even when they reskin the
 *    outer <a>, plus `!important` as a second line of defense.
 * Also: switched every translucent rgba() to a precomputed solid hex value
 * — semi-transparent text/background colors are exactly what dark-mode
 * "smart" re-coloring in Apple Mail / Gmail / Outlook.com tends to mangle,
 * which is what caused the washed-out low-contrast look. Solid colors are
 * rendered as authored. Dropped `color-scheme: dark` for the same reason —
 * this design is already dark-native, so there's nothing for a client's
 * dark-mode reprocessing to "help" with, and asking for it only invites
 * that reprocessing to touch colors we don't want touched.
 */

const COLORS = {
  background: "#050505",
  card: "#0a0a0a",
  cardBorder: "#1e1e1e",
  detailBoxBg: "#111111",
  detailBoxBorder: "#191919",
  text: "#ffffff",
  textSecondary: "#a8a8a8",
  textMuted: "#707070",
  green: "#00e676",
  badgeBg: "#092015",
  badgeBorder: "#0d3f28",
  buttonText: "#001a0b",
} as const;

// Single-quoted font name (not double) — this gets embedded inside
// double-quoted HTML style="" attributes, so a literal " here would close
// the attribute early and silently truncate every style using it.
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const SUBJECT = "New RentYourTime waitlist signup";

export interface WaitlistOwnerNotificationParams {
  email: string;
  source: string;
  createdAt: string;
  totalSignups: number;
  adminUrl: string;
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

/** Breaks webmail auto-linkification of an email address without changing how it looks. */
function unlinkifiableEmail(email: string): string {
  return escapeHtml(email).replace("@", "@&#8203;");
}

function formatDate(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function detailRow(label: string, value: string, isLast: boolean): string {
  return `<tr>
    <td style="padding:14px 20px; ${isLast ? "" : `border-bottom:1px solid ${COLORS.detailBoxBorder};`}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" style="font-family:${FONT_STACK}; font-size:13px; color:${COLORS.textMuted} !important;">${label}</td>
          <td align="right" style="font-family:${FONT_STACK}; font-size:14px; color:${COLORS.text} !important;">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function renderWaitlistOwnerNotificationEmail(
  params: WaitlistOwnerNotificationParams
): RenderedEmail {
  const safeEmail = unlinkifiableEmail(params.email);
  const safeSource = escapeHtml(params.source);
  const safeAdminUrl = escapeHtml(params.adminUrl);
  const date = formatDate(params.createdAt);
  const totalFormatted = params.totalSignups.toLocaleString("en-US");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SUBJECT}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:${FONT_STACK};">
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
                    <td style="padding:40px 36px 36px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td valign="top" align="left">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-radius:999px; background-color:${COLORS.badgeBg}; border:1px solid ${COLORS.badgeBorder};">
                              <tr>
                                <td style="padding:6px 12px 6px 10px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td style="padding-right:8px;">
                                        <div style="width:7px; height:7px; border-radius:999px; background-color:${COLORS.green}; font-size:0; line-height:0;">&nbsp;</div>
                                      </td>
                                      <td style="font-family:${FONT_STACK}; font-size:11px; font-weight:700; letter-spacing:0.12em; color:${COLORS.green} !important; white-space:nowrap;">NEW WAITLIST SIGNUP</td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <div style="padding-top:16px; font-family:${FONT_STACK}; font-size:22px; font-weight:700; color:${COLORS.text} !important;">
                              Someone just joined.
                            </div>
                          </td>
                          <td valign="top" align="right" style="white-space:nowrap; padding-left:16px;">
                            <div style="font-family:${FONT_STACK}; font-size:30px; font-weight:700; color:${COLORS.text} !important;">${totalFormatted}</div>
                            <div style="font-family:${FONT_STACK}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:${COLORS.textMuted} !important;">total signups</div>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px; background-color:${COLORS.detailBoxBg}; border:1px solid ${COLORS.detailBoxBorder}; border-radius:18px;">
                        ${detailRow("Email", safeEmail, false)}
                        ${detailRow("Source", safeSource, false)}
                        ${detailRow("Date", escapeHtml(date), true)}
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                        <tr>
                          <td style="border-radius:22px; background-color:${COLORS.green};" bgcolor="${COLORS.green}">
                            <a href="${safeAdminUrl}" target="_blank" rel="noopener noreferrer"
                               style="display:inline-block; min-height:44px; line-height:44px; padding:0 28px; font-family:${FONT_STACK}; font-size:14px; font-weight:700; color:${COLORS.buttonText} !important; text-decoration:none !important; border-radius:22px;">
                              <span style="color:${COLORS.buttonText} !important; text-decoration:none !important;">Open admin panel &rarr;</span>
                            </a>
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
                RentYourTime &middot; Every minute costs.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `NEW WAITLIST SIGNUP

Someone just joined.

Email: ${params.email}
Source: ${params.source}
Date: ${date}
Total signups: ${totalFormatted}

Open admin panel: ${params.adminUrl}

RentYourTime · Every minute costs.
`;

  return { subject: SUBJECT, html, text };
}
