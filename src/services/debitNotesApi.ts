/** Debit notes — /account/debit-notes/* */
import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "./paginatedList";
import type { TPartyPagination } from "./customerTypes";

export type DebitNoteListRow = {
  _id: string;
  number: string;
  vendorName: string;
  vendorId: string;
  note: string;
  amount: number;
  appliedAmount: number;
  balanceAmount: number;
  dateLabel: string;
  status: string;
  currency: string;
  signature?: string;
};

export type BackendDebitNoteDoc = {
  _id: string;
  vendor_id?: string | { _id?: string; name?: string; businessProfile?: { companyName?: string } } | null;
  vendor_name?: string;
  invoice_number?: string;
  currency?: string;
  date?: string;
  due_date?: string;
  status?: string;
  terms_and_conditions?: string;
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  attachments?: string;
  signature?: string;
  product?: any[];
  service?: any[];
  sub_total?: number;
  tax?: number;
  total?: number;
  inline_discount?: number;
  applied_amount?: number;
  balance_amount?: number;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const vendorIdOf = (doc: any): string => {
  const v = doc?.vendor_id;
  if (v && typeof v === "object") return text(v._id);
  return text(v);
};

const mapDebitNote = (doc: any): DebitNoteListRow => {
  const total = num(doc.total ?? doc.grand_total);
  const applied = num(doc.applied_amount);
  const balance =
    doc.balance_amount != null && doc.balance_amount !== ""
      ? num(doc.balance_amount)
      : Math.max(0, total - applied);
  return {
    _id: String(doc._id),
    number: text(doc.invoice_number || doc.debit_note_number || doc.number) || "—",
    vendorName:
      text(doc?.vendor_id?.businessProfile?.companyName) ||
      text(doc?.vendor_id?.name) ||
      text(doc?.vendor_name) ||
      "—",
    vendorId: vendorIdOf(doc),
    note: text(doc.notes) || "No Notes",
    amount: total,
    appliedAmount: applied,
    balanceAmount: balance,
    dateLabel: formatDate(doc.date || doc.createdAt),
    status: text(doc.status) || "Draft",
    currency: text(doc.currency) || "USD",
    signature: text(doc.signature) || undefined,
  };
};

export async function fetchDebitNotes(params: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  vendor_id?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: string;
  isDeleted?: boolean;
}): Promise<{ rows: DebitNoteListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/account/debit-notes/all", {
    page: params.page,
    limit: params.limit,
    searchTerm: params.searchTerm,
    sort: params.sort,
    status: params.status && params.status !== "All" ? params.status : undefined,
    vendor_id: params.vendor_id || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    dateField: params.dateField || undefined,
    isDeleted: params.isDeleted ? "true" : undefined,
  });
  return { rows: rows.map(mapDebitNote), pagination };
}

export async function fetchDebitNote(id: string): Promise<BackendDebitNoteDoc | null> {
  try {
    const res = await api.raw.get(`/account/debit-notes/single/${id}`);
    return (res.data?.data ?? res.data ?? null) as BackendDebitNoteDoc | null;
  } catch {
    return null;
  }
}

export async function updateDebitNote(
  id: string,
  payload: Record<string, unknown>,
): Promise<any> {
  const res = await api.raw.patch(`/account/debit-notes/update/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function updateDebitNoteSignature(id: string, signature: string): Promise<any> {
  const res = await api.raw.patch(`/account/debit-notes/signature/${id}`, { signature });
  return res.data?.data ?? res.data;
}

export async function deleteDebitNote(id: string): Promise<void> {
  await api.raw.delete(`/account/debit-notes/delete/${id}`);
}

export async function deleteDebitNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => deleteDebitNote(id)));
}
