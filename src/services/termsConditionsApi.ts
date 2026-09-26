/**
 * Company Terms & Conditions — GET/PATCH `/setting/terms-conditions`
 * One config per company; fields are default T&C text per document type.
 */
import { api } from "@/lib/api/client";

export const TERMS_DOC_TYPES = [
  { key: "invoice", label: "Invoice" },
  { key: "sales_receipt", label: "Sales Receipt" },
  { key: "proforma_invoice", label: "Proforma Invoice" },
  { key: "estimate", label: "Estimate" },
  { key: "delivery_challan", label: "Delivery Challan" },
  { key: "purchase_order", label: "Purchase Order" },
  { key: "credit_note", label: "Credit Note" },
  { key: "bill", label: "Bill" },
  { key: "debit_note", label: "Debit Note" },
] as const;

export type TermsDocKey = (typeof TERMS_DOC_TYPES)[number]["key"];

export type TermsConditionsSettings = Record<TermsDocKey, string>;

export const EMPTY_TERMS: TermsConditionsSettings = {
  invoice: "",
  sales_receipt: "",
  proforma_invoice: "",
  estimate: "",
  delivery_challan: "",
  purchase_order: "",
  credit_note: "",
  bill: "",
  debit_note: "",
};

const text = (v: unknown) => (typeof v === "string" ? v : "");

export function mapTerms(doc: any): TermsConditionsSettings {
  const out = { ...EMPTY_TERMS };
  if (!doc || typeof doc !== "object") return out;
  for (const { key } of TERMS_DOC_TYPES) {
    out[key] = text(doc[key]);
  }
  return out;
}

export async function fetchTermsConditions(): Promise<TermsConditionsSettings> {
  const data = await api.get<any>("/setting/terms-conditions");
  return mapTerms(data);
}

export async function saveTermsConditions(
  payload: TermsConditionsSettings,
): Promise<TermsConditionsSettings> {
  const data = await api.patch<any>("/setting/terms-conditions", payload);
  return mapTerms(data);
}
