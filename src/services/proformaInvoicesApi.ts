import { api } from "@/lib/api/client";
import type { TBackendParty, TPartyPagination } from "./customerTypes";

export interface BackendProformaInvoiceLine {
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

export interface BackendProformaInvoiceDoc {
  _id: string;
  customer_id?: string | TBackendParty | null;
  customer_name?: string;
  vendor_id?: string | TBackendParty | null;
  invoice_number?: string;
  currency?: string;
  date?: string;
  due_date?: string;
  sub_title?: string;
  po?: string | number;
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
  product?: BackendProformaInvoiceLine[];
  service?: BackendProformaInvoiceLine[];
  status?: string;
  terms_and_conditions?: string;
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  signature?: string;
  sub_total?: number;
  shipping_cost?: number;
  tax?: number;
  total?: number;
  createdAt?: string;
}

export interface ProformaInvoiceListRow {
  _id: string;
  number: string;
  customerName: string;
  customerSubtitle: string;
  amount: number;
  dateLabel: string;
  status: string;
  currency: string;
  customerId: string;
}

export interface ProformaInvoiceListResult {
  rows: ProformaInvoiceListRow[];
  pagination: TPartyPagination;
}

export interface ProformaInvoiceListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  customer_id?: string;
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

export const proformaCustomerName = (doc?: BackendProformaInvoiceDoc | null): string => {
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

export const proformaCustomerSubtitle = (doc?: BackendProformaInvoiceDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return [customer.name, customer.email].filter(Boolean).join(" · ");
  }
  return "";
};

export const proformaCustomerId = (doc?: BackendProformaInvoiceDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return text(customer._id);
  return typeof customer === "string" ? customer : "";
};

export const mapProformaInvoiceRow = (doc: BackendProformaInvoiceDoc): ProformaInvoiceListRow => ({
  _id: doc._id,
  number: text(doc.invoice_number) || "—",
  customerName: proformaCustomerName(doc),
  customerSubtitle: proformaCustomerSubtitle(doc),
  amount: numberValue(doc.total),
  dateLabel: formatDateLabel(doc.date ?? doc.createdAt),
  status: text(doc.status) || "Draft",
  currency: text(doc.currency) || "USD",
  customerId: proformaCustomerId(doc),
});

export async function fetchProformaInvoices(
  params: ProformaInvoiceListParams,
): Promise<ProformaInvoiceListResult> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.isDeleted) query.isDeleted = "true";
  else if (params.status && params.status !== "All" && params.status !== "Trash") query.status = params.status;
  if (params.customer_id) query.customer_id = params.customer_id;

  const res = await api.raw.get("/proforma-invoice/all", { params: query });
  const body = res.data ?? {};
  const items: BackendProformaInvoiceDoc[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows: items.map(mapProformaInvoiceRow),
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: items.length },
  };
}

export async function fetchProformaInvoice(id: string): Promise<BackendProformaInvoiceDoc | null> {
  try {
    const res = await api.raw.get(`/proforma-invoice/single/${id}`, { skipGlobalLoading: true } as any);
    return (res.data?.data ?? res.data ?? null) as BackendProformaInvoiceDoc | null;
  } catch {
    return null;
  }
}

export async function updateProformaInvoice(
  id: string,
  payload: Record<string, unknown>,
): Promise<BackendProformaInvoiceDoc> {
  const res = await api.raw.post(`/proforma-invoice/edit/${id}`, payload);
  return (res.data?.data ?? res.data) as BackendProformaInvoiceDoc;
}

export async function deleteProformaInvoice(id: string): Promise<void> {
  await api.raw.delete(`/proforma-invoice/delete/${id}`);
}

export async function hardDeleteProformaInvoices(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/proforma-invoice/hard-delete/${ids.join(",")}`);
}

export async function hardDeleteProformaInvoice(id: string): Promise<void> {
  await hardDeleteProformaInvoices([id]);
}

export async function restoreProformaInvoice(id: string): Promise<void> {
  await api.raw.post(`/proforma-invoice/restore/${id}`);
}

export async function restoreProformaInvoices(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => restoreProformaInvoice(id)));
}
