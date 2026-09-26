/**
 * Company Notes defaults — GET/PATCH `/setting/notes`
 * One config per company; fields are default note text per document type.
 */
import { api } from "@/lib/api/client";

export const NOTES_DOC_TYPES = [
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

export type NotesDocKey = (typeof NOTES_DOC_TYPES)[number]["key"];

export type NotesSettings = Record<NotesDocKey, string>;

export const EMPTY_NOTES: NotesSettings = {
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

export function mapNotes(doc: any): NotesSettings {
  const out = { ...EMPTY_NOTES };
  if (!doc || typeof doc !== "object") return out;
  for (const { key } of NOTES_DOC_TYPES) {
    out[key] = text(doc[key]);
  }
  return out;
}

export async function fetchNotesSettings(): Promise<NotesSettings> {
  const data = await api.get<any>("/setting/notes");
  return mapNotes(data);
}

export async function saveNotesSettings(payload: NotesSettings): Promise<NotesSettings> {
  const data = await api.patch<any>("/setting/notes", payload);
  return mapNotes(data);
}
