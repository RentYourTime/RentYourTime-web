/**
 * Verification email template — table-based HTML with inline CSS so it
 * renders consistently in Gmail, Apple Mail, Outlook, and mobile mail apps
 * (no CSS Grid/Flexbox, no JavaScript, no external fonts). See
 * docs/EMAIL_VERIFICATION.md for the design rationale.
 *
 * Uses solid hex colors instead of translucent rgba(), drops
 * `color-scheme: dark`, and wraps link text in an inner <span> with
 * `!important` styling — see waitlist-owner-notification-email.ts for the
 * detailed rationale. Same root cause here: webmail clients (Gmail etc.)
 * override an <a>'s own color/underline and reprocess translucent colors
 * for "dark mode", producing a washed-out render with default blue links
 * regardless of the CSS we author. The inner-<span> + solid-color + no
 * dark-mode-hint combination is the standard email-dev workaround.
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

// Single-quoted font name (not double) — this gets embedded inside
// double-quoted HTML style="" attributes, so a literal " here would close
// the attribute early and silently truncate every style using it.
const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

const SUBJECT = "Verify your RentYourTime account";
const PREHEADER = "Confirm your email address to finish setting up your RentYourTime account.";

// Small green "loading ring" mark next to the wordmark, inlined as a data
// URI (no external asset request — some mail clients block those outright).
// Single-quoted attributes throughout so it can sit inside a double-quoted
// HTML src="" without breaking attribute parsing.
const LOGO_ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18' fill='none'>" +
  "<circle cx='9' cy='9' r='7' stroke='#00e676' stroke-width='2.4' stroke-linecap='round' stroke-dasharray='38 6'/>" +
  "</svg>";
const LOGO_ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_ICON_SVG)}`;

export interface RenderVerificationEmailParams {
  verificationUrl: string;
  displayName?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Minimal HTML-entity escaping for values interpolated into the markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderVerificationEmail({
  verificationUrl,
  displayName,
}: RenderVerificationEmailParams): RenderedEmail {
  const safeUrl = escapeHtml(verificationUrl);
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
                    <td style="padding-bottom:24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-right:8px; vertical-align:middle;">
                            <img src="${LOGO_ICON_DATA_URI}" width="18" height="18" alt="" style="display:block; border:0;" />
                          </td>
                          <td style="vertical-align:middle; font-family:${FONT_STACK}; font-size:16px; font-weight:700; color:${COLORS.text} !important;">
                            rentyourtime<span style="color:${COLORS.green} !important;">.</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:${FONT_STACK}; font-size:12px; font-weight:700; letter-spacing:0.1em; color:${COLORS.green} !important;">
                      VERIFY ACCOUNT
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:12px; font-family:${FONT_STACK}; font-size:30px; line-height:1.2; font-weight:700; color:${COLORS.text} !important;">
                      Confirm your email address.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:16px; font-family:${FONT_STACK}; font-size:15px; line-height:1.55; color:${COLORS.textSecondary} !important;">
                      Thanks for joining RentYourTime${greeting}. Tap the button below to confirm this
                      address belongs to you and finish setting up your account.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:28px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="border-radius:26px; background-color:${COLORS.green};" bgcolor="${COLORS.green}">
                            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                               style="display:inline-block; min-height:48px; line-height:48px; padding:0 32px; font-family:${FONT_STACK}; font-size:15px; font-weight:700; color:${COLORS.buttonText} !important; text-decoration:none !important; border-radius:26px;">
                              <span style="color:${COLORS.buttonText} !important; text-decoration:none !important;">Verify email</span>
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
                            &#9203; This link is valid for <b style="color:${COLORS.text} !important;">24 hours</b>. After that you'll need to request a new one.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:24px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${COLORS.textMuted} !important;">
                      Button not working? Copy this link into your browser:
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:8px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; word-break:break-all;">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${COLORS.green} !important; text-decoration:underline !important;"><span style="color:${COLORS.green} !important;">${safeUrl}</span></a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:24px; border-top:1px solid ${COLORS.cardBorder};">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="padding-top:20px; font-family:${FONT_STACK}; font-size:13px; line-height:1.5; color:${COLORS.textMuted} !important;">
                            Didn't create a RentYourTime account? You can safely ignore this email —
                            nothing happens without your click.
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

  const text = `VERIFY ACCOUNT

Confirm your email address.

Thanks for joining RentYourTime${displayName ? `, ${displayName}` : ""}. Tap the link below to confirm this
address belongs to you and finish setting up your account.

Verify email: ${verificationUrl}

This link is valid for 24 hours. After that you'll need to request a new one.

Button not working? Copy this link into your browser:

${verificationUrl}

Didn't create a RentYourTime account? You can safely ignore this email —
nothing happens without your click.

RentYourTime · Every minute costs.
This is an automated account message.
`;

  return { subject: SUBJECT, html, text };
}
