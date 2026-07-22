import { describe, expect, it } from "vitest";
import { renderVerificationEmail } from "@/emails/verification-email";

describe("renderVerificationEmail", () => {
  it("includes the verification URL in both the HTML and text bodies", () => {
    const url = "https://example.test/verify?token=abc123";
    const { html, text, subject } = renderVerificationEmail({
      verificationUrl: url,
      displayName: "Ann",
    });
    expect(subject).toBe("Verify your RentYourTime account");
    expect(html).toContain(url);
    expect(text).toContain(url);
  });

  it("HTML-escapes the display name instead of interpolating it raw", () => {
    const malicious = `<script>alert('xss')</script>`;
    const { html } = renderVerificationEmail({
      verificationUrl: "https://example.test/verify?token=abc",
      displayName: malicious,
    });
    expect(html).not.toContain(malicious);
    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("renders without a display name", () => {
    const { html, text } = renderVerificationEmail({
      verificationUrl: "https://example.test/verify?token=abc",
      displayName: null,
    });
    expect(html).toContain("Thanks for joining RentYourTime.");
    expect(text).toContain("Thanks for joining RentYourTime.");
  });
});
