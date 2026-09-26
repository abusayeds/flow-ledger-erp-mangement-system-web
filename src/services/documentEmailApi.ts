/** Document email prepare/send — `/api/v1/document-email` */
import { api } from "@/lib/api/client";

export type DocumentEmailType =
  | "invoice"
  | "proforma_invoice"
  | "estimate"
  | "sales_receipt"
  | "delivery_challan"
  | "credit_note"
  | "payment_received"
  | "purchase_order"
  | "bill"
  | "debit_note"
  | "expense";

export type PreparedDocumentEmail = {
  type: DocumentEmailType;
  pdf_type?: string;
  document?: {
    _id?: string;
    number?: string | null;
    party_name?: string | null;
    party_email?: string | null;
    company_name?: string | null;
  };
  email: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    from?: string;
    subject: string;
    body: string;
    pdf_file_name?: string;
  };
};

export async function prepareDocumentEmail(
  type: DocumentEmailType,
  id: string,
): Promise<PreparedDocumentEmail> {
  const res = await api.raw.get("/document-email/prepare", { params: { type, id } });
  return (res.data?.data ?? res.data) as PreparedDocumentEmail;
}

export async function sendDocumentEmail(payload: {
  type: DocumentEmailType;
  id: string;
  email: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    from?: string;
    subject: string;
    body: string;
  };
  attach_pdf?: boolean;
  document_update: Record<string, unknown>;
}): Promise<any> {
  const res = await api.raw.post("/document-email/send", payload);
  return res.data?.data ?? res.data;
}
