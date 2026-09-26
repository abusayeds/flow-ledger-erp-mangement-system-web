import { api } from "@/lib/api/client";
import type { TBackendParty, TPartyPagination } from "./customerTypes";

export interface BackendSalesReceiptLine {
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

export interface BackendSalesReceiptDoc {
  _id: string;
  customer_id?: string | TBackendParty | null;
  customer_name?: string;
  invoice_number?: string;
  currency?: string;
  date?: string;
  due_date?: string;
  sub_title?: string;
  shipping_method?: string;
  payment_method?: string[];
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
  product?: BackendSalesReceiptLine[];
  service?: BackendSalesReceiptLine[];
  terms_and_conditions?: string;
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  sub_total?: number;
  tax?: number;
  total?: number;
  status?: string;
  createdAt?: string;
  signature?: string;
}

export interface SalesReceiptListRow {
  _id: string;
  number: string;
  customerName: string;
  customerSubtitle: string;
  amount: number;
  dateLabel: string;
  currency: string;
  customerId: string;
  paymentType: string;
}

export interface SalesReceiptListResult {
  rows: SalesReceiptListRow[];
  pagination: TPartyPagination;
}

export interface SalesReceiptListParams {
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

const text = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const numberValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;

const formatDateLabel = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value) || "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const customerName = (doc?: BackendSalesReceiptDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return customer.businessProfile?.companyName?.trim() || customer.name?.trim() || text(doc?.customer_name) || "No Customer";
  }
  return text(doc?.customer_name) || "No Customer";
};

const customerSubtitle = (doc?: BackendSalesReceiptDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return [customer.name, customer.email].filter(Boolean).join(" · ");
  }
  return "";
};

const customerId = (doc?: BackendSalesReceiptDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return text(customer._id);
  return typeof customer === "string" ? customer : "";
};

export const mapSalesReceiptRow = (doc: BackendSalesReceiptDoc): SalesReceiptListRow => ({
  _id: doc._id,
  number: text(doc.invoice_number) || "—",
  customerName: customerName(doc),
  customerSubtitle: customerSubtitle(doc),
  amount: numberValue(doc.total),
  dateLabel: formatDateLabel(doc.date ?? doc.createdAt),
  currency: text(doc.currency) || "USD",
  customerId: customerId(doc),
  paymentType: Array.isArray(doc.payment_method) ? text(doc.payment_method[0]) : "",
});

export async function fetchSalesReceipts(params: SalesReceiptListParams): Promise<SalesReceiptListResult> {
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

  const res = await api.raw.get("/sales-receipt/all", { params: query });
  const body = res.data ?? {};
  const items: BackendSalesReceiptDoc[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows: items.map(mapSalesReceiptRow),
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: items.length },
  };
}

export async function fetchSalesReceipt(id: string): Promise<BackendSalesReceiptDoc | null> {
  try {
    const res = await api.raw.get(`/sales-receipt/single/${id}`, { skipGlobalLoading: true } as any);
    return (res.data?.data ?? res.data ?? null) as BackendSalesReceiptDoc | null;
  } catch {
    return null;
  }
}

export async function deleteSalesReceipt(id: string): Promise<void> {
  await api.raw.delete(`/sales-receipt/delete/${id}`);
}

export async function hardDeleteSalesReceipts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/sales-receipt/hard-delete/${ids.join(",")}`);
}

export async function hardDeleteSalesReceipt(id: string): Promise<void> {
  await hardDeleteSalesReceipts([id]);
}

export async function restoreSalesReceipt(id: string): Promise<void> {
  await api.raw.post(`/sales-receipt/restore/${id}`);
}

export async function restoreSalesReceipts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => restoreSalesReceipt(id)));
}
