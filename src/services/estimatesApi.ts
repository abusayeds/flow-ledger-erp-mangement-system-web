import { api } from "@/lib/api/client";
import type { TBackendParty, TPartyPagination } from "./customerTypes";

export interface BackendEstimateLine {
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

export interface BackendEstimateDoc {
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
  product?: BackendEstimateLine[];
  service?: BackendEstimateLine[];
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

export interface EstimateListRow {
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

export interface EstimateListResult {
  rows: EstimateListRow[];
  pagination: TPartyPagination;
}

export interface EstimateListParams {
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

export const formatEstimateDateLabel = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value) || "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

export const estimateCustomerName = (doc?: BackendEstimateDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") {
    return customer.businessProfile?.companyName?.trim() || customer.name?.trim() || text(doc?.customer_name) || "No Customer";
  }
  return text(doc?.customer_name) || "No Customer";
};

export const estimateCustomerSubtitle = (doc?: BackendEstimateDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return [customer.name, customer.email].filter(Boolean).join(" · ");
  return "";
};

export const estimateCustomerId = (doc?: BackendEstimateDoc | null): string => {
  const customer = doc?.customer_id;
  if (customer && typeof customer === "object") return text(customer._id);
  return typeof customer === "string" ? customer : "";
};

export const mapEstimateRow = (doc: BackendEstimateDoc): EstimateListRow => ({
  _id: doc._id,
  number: text(doc.invoice_number) || "—",
  customerName: estimateCustomerName(doc),
  customerSubtitle: estimateCustomerSubtitle(doc),
  amount: numberValue(doc.total),
  dateLabel: formatEstimateDateLabel(doc.date ?? doc.createdAt),
  status: text(doc.status) || "Draft",
  currency: text(doc.currency) || "USD",
  customerId: estimateCustomerId(doc),
});

export async function fetchEstimates(params: EstimateListParams): Promise<EstimateListResult> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  // Trash uses isDeleted — never send status=Trash as a document status.
  if (params.isDeleted) query.isDeleted = "true";
  else if (params.status && params.status !== "All" && params.status !== "Trash") query.status = params.status;
  if (params.customer_id) query.customer_id = params.customer_id;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.dateField) query.dateField = params.dateField;

  const res = await api.raw.get("/estimate/all", { params: query });
  const body = res.data ?? {};
  const items: BackendEstimateDoc[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows: items.map(mapEstimateRow),
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: items.length },
  };
}

export async function fetchEstimate(id: string): Promise<BackendEstimateDoc | null> {
  try {
    const res = await api.raw.get(`/estimate/single/${id}`, { skipGlobalLoading: true } as any);
    return (res.data?.data ?? res.data ?? null) as BackendEstimateDoc | null;
  } catch {
    return null;
  }
}

export async function updateEstimate(id: string, payload: Record<string, unknown>): Promise<BackendEstimateDoc> {
  const res = await api.raw.post(`/estimate/edit/${id}`, payload);
  return (res.data?.data ?? res.data) as BackendEstimateDoc;
}

export async function deleteEstimate(id: string): Promise<void> {
  await api.raw.delete(`/estimate/delete/${id}`);
}

/** Permanent delete from Trash (comma-separated ids OK). */
export async function hardDeleteEstimates(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/estimate/hard-delete/${ids.join(",")}`);
}

export async function hardDeleteEstimate(id: string): Promise<void> {
  await hardDeleteEstimates([id]);
}

export async function restoreEstimate(id: string): Promise<void> {
  await api.raw.post(`/estimate/restore/${id}`);
}

export async function restoreEstimates(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => restoreEstimate(id)));
}
