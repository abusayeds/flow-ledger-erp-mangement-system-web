/**
 * Email Templates — GET/PATCH `/setting/email-templates`
 * One config per company: settings + per-doc templates + signature.
 */
import { api } from "@/lib/api/client";

export const EMAIL_DOC_TYPES = [
  "invoice",
  "proforma_invoice",
  "estimate",
  "sales_receipt",
  "delivery_challan",
  "credit_note",
  "payment_received",
  "purchase_order",
  "bill",
  "debit_note",
  "expense",
  "payment_made",
  "statement",
  "payment_reminder",
] as const;

export type EmailDocType = (typeof EMAIL_DOC_TYPES)[number];
export type EmailNavKey = "settings" | EmailDocType | "signature";

export type EmailTemplateItem = {
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  pdf_file_name: string;
};

export type EmailTemplateSettings = {
  from: string;
  font_style: string;
  font_size: string;
  send_copy_to_salesperson: string;
};

export type EmailTemplateDoc = {
  _id?: string;
  settings?: Partial<EmailTemplateSettings>;
  templates?: Partial<Record<EmailDocType, Partial<EmailTemplateItem>>>;
  signature?: string;
};

export type EmailParam = { tag: string; label: string };

const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export const DOC_TYPE_LABELS: Record<EmailDocType, string> = {
  invoice: "Invoice",
  proforma_invoice: "Proforma Invoice",
  estimate: "Estimate",
  sales_receipt: "Sales Receipt",
  delivery_challan: "Delivery Challan",
  credit_note: "Credit Note",
  payment_received: "Payment Received",
  purchase_order: "Purchase Order",
  bill: "Bill",
  debit_note: "Debit Note",
  expense: "Expense",
  payment_made: "Payment Made",
  statement: "Statement",
  payment_reminder: "Payment Reminder",
};

export const NAV_ITEMS: { key: EmailNavKey; label: string }[] = [
  { key: "settings", label: "Settings" },
  ...EMAIL_DOC_TYPES.map((key) => ({ key, label: DOC_TYPE_LABELS[key] })),
  { key: "signature", label: "Signature" },
];

export const DEFAULT_SETTINGS: EmailTemplateSettings = {
  from: "",
  font_style: "Arial",
  font_size: "14",
  send_copy_to_salesperson: "Do not send",
};

export const emptyItem = (): EmailTemplateItem => ({
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  pdf_file_name: "",
});

/** Defaults matching the Moon Invoice-style screenshot for Invoice. */
export const DEFAULT_ITEMS: Record<EmailDocType, EmailTemplateItem> = {
  invoice: {
    cc: "",
    bcc: "",
    subject: "Invoice #: <invoice#> from <company>",
    body: `Dear <customer>

<notes>

Invoice #: <invoice#>
Invoice Total Amount: <total>

<paynow>
<terms>
<pdf_file>
<attachment>`,
    pdf_file_name: "Invoice # <invoice#>",
  },
  proforma_invoice: {
    cc: "",
    bcc: "",
    subject: "Proforma Invoice #: <invoice#> from <company>",
    body: `Dear <customer>

Proforma Invoice #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Proforma Invoice # <invoice#>",
  },
  estimate: {
    cc: "",
    bcc: "",
    subject: "Estimate #: <invoice#> from <company>",
    body: `Dear <customer>

Estimate #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Estimate # <invoice#>",
  },
  sales_receipt: {
    cc: "",
    bcc: "",
    subject: "Sales Receipt #: <invoice#> from <company>",
    body: `Dear <customer>

Sales Receipt #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Sales Receipt # <invoice#>",
  },
  delivery_challan: {
    cc: "",
    bcc: "",
    subject: "Delivery Challan #: <invoice#> from <company>",
    body: `Dear <customer>

Delivery Challan #: <invoice#>

<pdf_file>
<attachment>`,
    pdf_file_name: "Delivery Challan # <invoice#>",
  },
  credit_note: {
    cc: "",
    bcc: "",
    subject: "Credit Note #: <invoice#> from <company>",
    body: `Dear <customer>

Credit Note #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Credit Note # <invoice#>",
  },
  payment_received: {
    cc: "",
    bcc: "",
    subject: "Payment Received #: <invoice#> from <company>",
    body: `Dear <customer>

Payment #: <invoice#>
Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Payment Received # <invoice#>",
  },
  purchase_order: {
    cc: "",
    bcc: "",
    subject: "Purchase Order #: <invoice#> from <company>",
    body: `Dear <customer>

Purchase Order #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Purchase Order # <invoice#>",
  },
  bill: {
    cc: "",
    bcc: "",
    subject: "Bill #: <invoice#> from <company>",
    body: `Dear <customer>

Bill #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Bill # <invoice#>",
  },
  debit_note: {
    cc: "",
    bcc: "",
    subject: "Debit Note #: <invoice#> from <company>",
    body: `Dear <customer>

Debit Note #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Debit Note # <invoice#>",
  },
  expense: {
    cc: "",
    bcc: "",
    subject: "Expense #: <invoice#> from <company>",
    body: `Dear <customer>

Expense #: <invoice#>
Total Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Expense # <invoice#>",
  },
  payment_made: {
    cc: "",
    bcc: "",
    subject: "Payment Made #: <invoice#> from <company>",
    body: `Dear <customer>

Payment #: <invoice#>
Amount: <total>

<pdf_file>
<attachment>`,
    pdf_file_name: "Payment Made # <invoice#>",
  },
  statement: {
    cc: "",
    bcc: "",
    subject: "Statement from <company>",
    body: `Dear <customer>

Please find your statement attached.

<pdf_file>
<attachment>`,
    pdf_file_name: "Statement <customer>",
  },
  payment_reminder: {
    cc: "",
    bcc: "",
    subject: "Payment Reminder: Invoice #: <invoice#> from <company>",
    body: `Dear <customer>

This is a friendly reminder that Invoice #: <invoice#> for <due_amount> is due.

<paynow>
<pdf_file>
<attachment>`,
    pdf_file_name: "Payment Reminder # <invoice#>",
  },
};

export const DEFAULT_SIGNATURE =
  "Best regards,\n<company>";

/** Parameters shown for document templates (screenshot list for Invoice). */
export function paramsForDoc(type: EmailDocType): EmailParam[] {
  const doc = DOC_TYPE_LABELS[type];
  return [
    { tag: "<customer>", label: "Customer Name" },
    { tag: "<fname>", label: "Customer/Vendor first name" },
    { tag: "<lname>", label: "Customer/Vendor last name" },
    { tag: "<org>", label: "Organization Name" },
    { tag: "<pdf_file>", label: `${doc} PDF file` },
    { tag: "<invoice#>", label: `${doc} number` },
    { tag: "<date>", label: `${doc} date` },
    { tag: "<due_date>", label: `${doc} due date` },
    { tag: "<total>", label: `${doc} total` },
    { tag: "<due_amount>", label: `${doc} Due amount` },
    { tag: "<terms>", label: `${doc} Terms & Conditions` },
    { tag: "<notes>", label: `${doc} notes` },
    { tag: "<sign1>", label: "First signature name" },
    { tag: "<sign2>", label: "Second signature name" },
    { tag: "<company>", label: "Current company name" },
    { tag: "<paynow>", label: "PayPal or Online payment link" },
    { tag: "<shipping_cost>", label: `${doc} shipping cost` },
    { tag: "<shipping_method>", label: `${doc} shipping method` },
    { tag: "<deposit_due_amount>", label: `${doc} Deposit Due Amount.` },
    { tag: "<attachment>", label: `${doc} Attachment File.` },
    { tag: "<status>", label: `${doc} Status` },
  ];
}

export function mapItem(raw: Partial<EmailTemplateItem> | undefined | null, fallback: EmailTemplateItem): EmailTemplateItem {
  return {
    cc: text(raw?.cc) || fallback.cc,
    bcc: text(raw?.bcc) || fallback.bcc,
    subject: text(raw?.subject) || fallback.subject,
    body: text(raw?.body) || fallback.body,
    pdf_file_name: text(raw?.pdf_file_name) || fallback.pdf_file_name,
  };
}

export function mapSettings(raw: Partial<EmailTemplateSettings> | undefined | null): EmailTemplateSettings {
  return {
    from: text(raw?.from) || DEFAULT_SETTINGS.from,
    font_style: text(raw?.font_style) || DEFAULT_SETTINGS.font_style,
    font_size: text(raw?.font_size) || DEFAULT_SETTINGS.font_size,
    send_copy_to_salesperson:
      text(raw?.send_copy_to_salesperson) || DEFAULT_SETTINGS.send_copy_to_salesperson,
  };
}

export async function fetchEmailTemplates(): Promise<EmailTemplateDoc | null> {
  try {
    const data = await api.get<EmailTemplateDoc | null>("/setting/email-templates");
    return data || null;
  } catch {
    return null;
  }
}

export async function patchEmailTemplateSection(
  type: EmailNavKey,
  data: EmailTemplateSettings | EmailTemplateItem | string,
): Promise<EmailTemplateDoc> {
  return api.patch<EmailTemplateDoc>("/setting/email-templates", { type, data });
}
