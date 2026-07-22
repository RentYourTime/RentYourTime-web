import { currentUser, json, jsonError, rateLimit } from "@/lib/auth";
import { getInvoiceForUser, serializeBillingRecord, updateInvoiceUrls } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const user = currentUser(req);
  if (!user) return jsonError("unauthorized", 401);

  const limited = rateLimit(req, "billing_invoices", 60, 60, user.id);
  if (limited) return limited;

  const { invoiceId } = await params;
  // Same lookup for "doesn't exist" and "belongs to someone else" — 404
  // either way, so ownership can't be probed from the response.
  const record = getInvoiceForUser(user.id, invoiceId);
  if (!record) return jsonError("not_found", 404);

  // Optional best-effort refresh: hosted_invoice_url/invoice_pdf_url are
  // normally stable once an invoice is paid, but if either is missing
  // (e.g. captured before finalization) try Stripe once, verifying the
  // invoice's customer really is this user's before trusting the result.
  if (
    (!record.hosted_invoice_url || !record.invoice_pdf_url) &&
    record.provider_invoice_id &&
    user.stripe_customer_id
  ) {
    try {
      const invoice = await getStripe().invoices.retrieve(record.provider_invoice_id);
      const invoiceCustomerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (invoiceCustomerId === user.stripe_customer_id) {
        updateInvoiceUrls(record.id, invoice.hosted_invoice_url ?? null, invoice.invoice_pdf ?? null);
        record.hosted_invoice_url = record.hosted_invoice_url ?? invoice.hosted_invoice_url ?? null;
        record.invoice_pdf_url = record.invoice_pdf_url ?? invoice.invoice_pdf ?? null;
      }
    } catch (e) {
      // Best-effort only — never surface the raw Stripe error, and never
      // fail the request just because the refresh attempt didn't work.
      console.error("Invoice URL refresh failed:", e instanceof Error ? e.message : e);
    }
  }

  return json({ ok: true, invoice: serializeBillingRecord(record) });
}
