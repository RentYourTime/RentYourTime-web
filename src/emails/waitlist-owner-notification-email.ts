/** Owner-facing "new waitlist signup" email — same design system, simpler layout. */

const COLORS = {
  background: "#050505",
  card: "#0a0a0a",
  cardBorder: "rgba(255,255,255,0.08)",
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

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0; font-family:${FONT_STACK}; font-size:13px; color:${COLORS.textMuted}; width:120px;">${label}</td>
    <td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${COLORS.text};">${value}</td>
  </tr>`;
}

export function renderWaitlistOwnerNotificationEmail(
  params: WaitlistOwnerNotificationParams
): RenderedEmail {
  const safeEmail = escapeHtml(params.email);
  const safeSource = escapeHtml(params.source);
  const safeAdminUrl = escapeHtml(params.adminUrl);
  const date = formatDate(params.createdAt);

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
              <td style="background-color:${COLORS.card}; border:1px solid ${COLORS.cardBorder}; border-radius:28px; padding:36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:${FONT_STACK}; font-size:12px; font-weight:700; letter-spacing:0.1em; color:${COLORS.green};">
                      NEW WAITLIST SIGNUP
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${row("Email", safeEmail)}
                        ${row("Source", safeSource)}
                        ${row("Date", escapeHtml(date))}
                        ${row("Total signups", String(params.totalSignups))}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="border-radius:22px; background-color:${COLORS.green};">
                            <a href="${safeAdminUrl}" target="_blank" rel="noopener noreferrer"
                               style="display:inline-block; min-height:44px; line-height:44px; padding:0 26px; font-family:${FONT_STACK}; font-size:14px; font-weight:700; color:${COLORS.buttonText}; text-decoration:none; border-radius:22px;">
                              Open admin panel
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

Email: ${params.email}
Source: ${params.source}
Date: ${date}
Total signups: ${params.totalSignups}

Admin panel: ${params.adminUrl}
`;

  return { subject: SUBJECT, html, text };
}
