/**
 * Owner-facing "new waitlist signup" email — table-based HTML matching the
 * approved design (badge + glowing dot, big total count, details box,
 * gradient top bar). Flexbox/box-shadow in the source design are
 * approximated with email-safe tables; clients that ignore border-radius/
 * box-shadow (older Outlook) degrade to square corners / no glow, which
 * doesn't break the layout.
 */

const COLORS = {
  background: "#050505",
  card: "#0a0a0a",
  cardBorder: "rgba(255,255,255,0.08)",
  cardBorder2: "rgba(255,255,255,0.06)",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.58)",
  textMuted: "rgba(255,255,255,0.35)",
  green: "#00e676",
  buttonText: "#001a0b",
} as const;

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

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
    <td style="padding:14px 20px; ${isLast ? "" : `border-bottom:1px solid ${COLORS.cardBorder2};`}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" style="font-family:${FONT_STACK}; font-size:13px; color:${COLORS.textMuted};">${label}</td>
          <td align="right" style="font-family:${FONT_STACK}; font-size:14px; color:${COLORS.text};">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function renderWaitlistOwnerNotificationEmail(
  params: WaitlistOwnerNotificationParams
): RenderedEmail {
  const safeEmail = escapeHtml(params.email);
  const safeSource = escapeHtml(params.source);
  const safeAdminUrl = escapeHtml(params.adminUrl);
  const date = formatDate(params.createdAt);
  const totalFormatted = params.totalSignups.toLocaleString("en-US");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${SUBJECT}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;">
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <span style="font-family:${FONT_STACK}; font-size:18px; font-weight:700; color:${COLORS.text};">
                  rentyourtime<span style="color:${COLORS.green};">.</span>
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
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-radius:999px; background-color:rgba(0,230,118,0.1); border:1px solid rgba(0,230,118,0.25);">
                              <tr>
                                <td style="padding:6px 12px 6px 10px;">
                                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                      <td style="padding-right:8px;">
                                        <div style="width:7px; height:7px; border-radius:999px; background-color:${COLORS.green}; font-size:0; line-height:0;">&nbsp;</div>
                                      </td>
                                      <td style="font-family:${FONT_STACK}; font-size:11px; font-weight:700; letter-spacing:0.12em; color:${COLORS.green}; white-space:nowrap;">NEW WAITLIST SIGNUP</td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                            <div style="padding-top:16px; font-family:${FONT_STACK}; font-size:22px; font-weight:700; color:${COLORS.text};">
                              Someone just joined.
                            </div>
                          </td>
                          <td valign="top" align="right" style="white-space:nowrap; padding-left:16px;">
                            <div style="font-family:${FONT_STACK}; font-size:30px; font-weight:700; color:${COLORS.text};">${totalFormatted}</div>
                            <div style="font-family:${FONT_STACK}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:${COLORS.textMuted};">total signups</div>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px; background-color:rgba(255,255,255,0.03); border:1px solid ${COLORS.cardBorder2}; border-radius:18px;">
                        ${detailRow("Email", safeEmail, false)}
                        ${detailRow("Source", safeSource, false)}
                        ${detailRow("Date", escapeHtml(date), true)}
                      </table>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                        <tr>
                          <td style="border-radius:22px; background-color:${COLORS.green};">
                            <a href="${safeAdminUrl}" target="_blank" rel="noopener noreferrer"
                               style="display:inline-block; min-height:44px; line-height:44px; padding:0 28px; font-family:${FONT_STACK}; font-size:14px; font-weight:700; color:${COLORS.buttonText}; text-decoration:none; border-radius:22px;">
                              Open admin panel &rarr;
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
              <td align="center" style="padding-top:28px; font-family:${FONT_STACK}; font-size:12px; line-height:1.6; color:${COLORS.textMuted};">
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
