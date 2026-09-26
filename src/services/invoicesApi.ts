import { api } from "@/lib/api/client";
import type { TBackendParty, TPartyPagination } from "./customerTypes";

export interface BackendInvoiceLine {
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

export interface BackendInvoiceDoc {
  _id: string;
  customer_id?: string | TBackendParty | null;
  customer_name?: string;
  invoice_number?: string;
  currency?: string;
  date?: string;
  due_date?: string;
  sub_title?: string;
  po?: string | number;
  recipient_name?: string;
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
  product?: BackendInvoiceLine[];
  service?: BackendInvoiceLine[];
  status?: string;
  terms_and_conditions?: string;
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  sub_total?: number;
  shipping_cost?: number;
  tax?: number;
  total?: number;
  paid_amount?: number;
  balance_amount?: number;
  signature?: string;
  createdAt?: string;
}

export interface InvoiceListRow {
  _id: string;
  number: string;
  customerName: string;
  customerSubtitle: string;
  amount: number;
  dateLabel: string;
  status: string;
  currency: string;
  dueAmount: number;
  paidAmount: number;
  customerId: string;
}

export interface InvoiceListResult {
  rows: InvoiceListRow[];
  pagination: TPartyPagination;
}

export interface InvoiceListParams {
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

export const formatDateLabel = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value) || "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export const invoiceCustomerName = (doc?: BackendInvoiceDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return (
      customer.businessProfile?.companyName?.trim() ||
      customer.name?.trim() ||
      text(doc?.customer_name) ||
      "No Customer"
    );
  }
  return text(doc?.customer_name) || "No Customer";
};

export const invoiceCustomerSubtitle = (doc?: BackendInvoiceDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return [customer.name, customer.email].filter(Boolean).join(" · ");
  }
  return "";
};

export const invoiceCustomerId = (doc?: BackendInvoiceDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return text(customer._id);
  return typeof customer === "string" ? customer : "";
};

export const mapInvoiceRow = (doc: BackendInvoiceDoc): InvoiceListRow => ({
  _id: doc._id,
  number: text(doc.invoice_number) || "—",
  customerName: invoiceCustomerName(doc),
  customerSubtitle: invoiceCustomerSubtitle(doc),
  amount: numberValue(doc.total),
  dateLabel: formatDateLabel(doc.date ?? doc.createdAt),
  status: text(doc.status) || "Draft",
  currency: text(doc.currency) || "USD",
  dueAmount: numberValue(doc.balance_amount ?? doc.total),
  paidAmount: numberValue(doc.paid_amount),
  customerId: invoiceCustomerId(doc),
});

export async function fetchInvoices(params: InvoiceListParams): Promise<InvoiceListResult> {
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

  const res = await api.raw.get("/invoices", { params: query });
  const body = res.data ?? {};
  const items: BackendInvoiceDoc[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows: items.map(mapInvoiceRow),
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: items.length },
  };
}

export async function fetchInvoice(id: string): Promise<BackendInvoiceDoc | null> {
  try {
    // Silent: list→detail clicks must not flash the global loading bar (feels like a full reload).
    const res = await api.raw.get(`/invoices/${id}`, { skipGlobalLoading: true } as Parameters<typeof api.raw.get>[1]);
    return (res.data?.data ?? res.data ?? null) as BackendInvoiceDoc | null;
  } catch {
    return null;
  }
}

export async function updateInvoice(id: string, payload: Record<string, unknown>): Promise<BackendInvoiceDoc> {
  const res = await api.raw.patch(`/invoices/${id}`, payload);
  return (res.data?.data ?? res.data) as BackendInvoiceDoc;
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.raw.delete(`/invoices/${id}`);
}

export async function hardDeleteInvoices(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/invoices/permanent/${ids.join(",")}`);
}

export async function hardDeleteInvoice(id: string): Promise<void> {
  await hardDeleteInvoices([id]);
}

export async function restoreInvoice(id: string): Promise<void> {
  await api.raw.post(`/invoices/restore/${id}`);
}

export async function restoreInvoices(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => restoreInvoice(id)));
}
