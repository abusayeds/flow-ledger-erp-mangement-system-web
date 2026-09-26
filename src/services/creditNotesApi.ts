import { api } from "@/lib/api/client";
import type { TBackendParty, TPartyPagination } from "./customerTypes";

export interface BackendCreditNoteLine {
  product_id?: string | { _id?: string; productName?: string; description?: string };
  product_name?: string;
  service_id?: string | { _id?: string; serviceName?: string; description?: string };
  service_name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  tax?: number;
  discount?: number;
  amount?: number;
}

export interface BackendCreditNoteDoc {
  _id: string;
  customer_id?: string | TBackendParty | null;
  customer_name?: string;
  invoice_number?: string;
  currency?: string;
  date?: string;
  due_date?: string;
  sub_title?: string;
  shipping_method?: string;
  billing_address?: {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  shipping_address?: {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  product?: BackendCreditNoteLine[];
  service?: BackendCreditNoteLine[];
  status?: string;
  terms_and_conditions?: string;
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  signature?: string;
  sub_total?: number;
  inline_discount?: number;
  shipping_cost?: number;
  tax?: number;
  total?: number;
  applied_amount?: number;
  balance_amount?: number;
  createdAt?: string;
}

export interface CreditNoteListRow {
  _id: string;
  number: string;
  customerName: string;
  customerSubtitle: string;
  amount: number;
  dateLabel: string;
  status: string;
  currency: string;
  customerId: string;
  appliedAmount: number;
  balanceAmount: number;
}

export interface CreditNoteListResult {
  rows: CreditNoteListRow[];
  pagination: TPartyPagination;
}

export interface CreditNoteListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  customer_id?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: string;
  isDeleted?: boolean;
}

const FALLBACK_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const numberValue = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);

export const formatCreditNoteDateLabel = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value) || "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

export const creditNoteCustomerName = (doc?: BackendCreditNoteDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return customer.businessProfile?.companyName?.trim() || customer.name?.trim() || text(doc?.customer_name) || "No Customer";
  }
  return text(doc?.customer_name) || "No Customer";
};

export const creditNoteCustomerSubtitle = (doc?: BackendCreditNoteDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return [customer.name, customer.email].filter(Boolean).join(" · ");
  return "";
};

export const creditNoteCustomerId = (doc?: BackendCreditNoteDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return text(customer._id);
  return typeof customer === "string" ? customer : "";
};

export const mapCreditNoteRow = (doc: BackendCreditNoteDoc): CreditNoteListRow => ({
  _id: doc._id,
  number: text(doc.invoice_number) || "—",
  customerName: creditNoteCustomerName(doc),
  customerSubtitle: creditNoteCustomerSubtitle(doc),
  amount: numberValue(doc.total),
  dateLabel: formatCreditNoteDateLabel(doc.date ?? doc.createdAt),
  status: text(doc.status) || "Draft",
  currency: text(doc.currency) || "USD",
  customerId: creditNoteCustomerId(doc),
  appliedAmount: numberValue(doc.applied_amount),
  balanceAmount: numberValue(doc.balance_amount),
});

export async function fetchCreditNotes(params: CreditNoteListParams): Promise<CreditNoteListResult> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.isDeleted) query.isDeleted = "true";
  else if (params.status && params.status !== "All" && params.status !== "Trash") query.status = params.status;
  if (params.customer_id) query.customer_id = params.customer_id;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.dateField) query.dateField = params.dateField;

  const res = await api.raw.get("/account/credit-notes/all", { params: query });
  const body = res.data ?? {};
  const items: BackendCreditNoteDoc[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows: items.map(mapCreditNoteRow),
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: items.length },
  };
}

export async function fetchCreditNote(id: string): Promise<BackendCreditNoteDoc | null> {
  try {
    const res = await api.raw.get(`/account/credit-notes/single/${id}`);
    return (res.data?.data ?? res.data ?? null) as BackendCreditNoteDoc | null;
  } catch {
    return null;
  }
}

export async function updateCreditNote(
  id: string,
  payload: Record<string, unknown>,
): Promise<any> {
  const res = await api.raw.post(`/account/credit-notes/edit/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteCreditNote(id: string): Promise<void> {
  await api.raw.delete(`/account/credit-notes/delete/${id}`);
}

export async function hardDeleteCreditNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/account/credit-notes/hard-delete/${ids.join(",")}`);
}

export async function hardDeleteCreditNote(id: string): Promise<void> {
  await hardDeleteCreditNotes([id]);
}

export async function restoreCreditNote(id: string): Promise<void> {
  await api.raw.post(`/account/credit-notes/restore/${id}`);
}

export async function restoreCreditNotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => restoreCreditNote(id)));
}
