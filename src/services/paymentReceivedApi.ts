import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export interface BackendPaymentReceivedDoc {
  _id: string;
  customer_id?: string | { _id?: string; name?: string; businessProfile?: { companyName?: string } } | null;
  customer_name?: string;
  invoice_id?: string | { _id?: string; invoice_number?: string } | null;
  invoice_number?: string;
  payment_number?: string;
  currency?: string;
  date?: string;
  payment_method?: string[];
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  total?: number;
  sub_total?: number;
  status?: string;
  createdAt?: string;
}

export interface PaymentReceivedListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  invoice_id?: string;
  customer_id?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: string;
  isDeleted?: boolean;
}

export interface PaymentReceivedListResult {
  rows: BackendPaymentReceivedDoc[];
  pagination: TPartyPagination;
}

const FALLBACK_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

export async function fetchPaymentReceived(
  params: PaymentReceivedListParams,
): Promise<PaymentReceivedListResult> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.isDeleted) query.isDeleted = "true";
  if (params.invoice_id) query.invoice_id = params.invoice_id;
  if (params.customer_id) query.customer_id = params.customer_id;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.dateField) query.dateField = params.dateField;

  const res = await api.raw.get("/payment-received/all", { params: query });
  const body = res.data ?? {};
  const rows: BackendPaymentReceivedDoc[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

export interface CreatePaymentReceivedPayload {
  customer_id?: string;
  customer_name?: string;
  invoice_id?: string;
  invoice_number?: string;
  payment_number?: string;
  currency?: string;
  date?: string;
  payment_method?: string[];
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  product: [];
  service: [];
  sub_total: number;
  total: number;
  status?: string;
}

export async function createPaymentReceived(
  payload: CreatePaymentReceivedPayload,
): Promise<BackendPaymentReceivedDoc> {
  const res = await api.raw.post("/payment-received/create", payload);
  return (res.data?.data ?? res.data) as BackendPaymentReceivedDoc;
}

export interface UpdatePaymentReceivedPayload {
  customer_id?: string;
  invoice_id?: string;
  invoice_number?: string;
  payment_number?: string;
  currency?: string;
  date?: string;
  payment_method?: string[];
  notes?: string;
  internal_notes?: string;
  Attachment?: string;
  product?: [];
  service?: [];
  sub_total?: number;
  total?: number;
  status?: string;
}

export async function updatePaymentReceived(
  id: string,
  payload: UpdatePaymentReceivedPayload,
): Promise<BackendPaymentReceivedDoc> {
  const res = await api.raw.post(`/payment-received/edit/${id}`, payload);
  return (res.data?.data ?? res.data) as BackendPaymentReceivedDoc;
}

export async function deletePaymentReceived(id: string): Promise<void> {
  await api.raw.delete(`/payment-received/delete/${id}`);
}

export async function hardDeletePaymentReceivedMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/payment-received/hard-delete/${ids.join(",")}`);
}

export async function hardDeletePaymentReceived(id: string): Promise<void> {
  await hardDeletePaymentReceivedMany([id]);
}

export async function restorePaymentReceived(id: string): Promise<void> {
  await api.raw.post(`/payment-received/restore/${id}`);
}

export async function restorePaymentReceivedMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => restorePaymentReceived(id)));
}

export interface BackendInvoicePaymentDoc {
  _id: string;
  customer_id?: string;
  invoice_id?: string;
  payment_number?: string;
  payment_date?: string;
  payment_type?: string;
  amount?: number;
  notes?: string;
  internal_notes?: string;
  attachments?: string;
  createdAt?: string;
}

export interface CreateInvoicePaymentPayload {
  customer_id: string;
  invoice_id: string;
  payment_number?: string;
  payment_date: string;
  payment_type: string;
  amount: number;
  notes?: string;
  internal_notes?: string;
  attachments?: string;
  type: "invoice";
}

export async function fetchInvoiceDirectPayments(invoice_id: string): Promise<BackendInvoicePaymentDoc[]> {
  const res = await api.raw.get("/payment/all", {
    params: { invoice_id, limit: 100, sort: "-payment_date" },
  });
  const body = res.data ?? {};
  return Array.isArray(body.data) ? body.data : [];
}

export async function createInvoicePayment(
  payload: CreateInvoicePaymentPayload,
): Promise<BackendInvoicePaymentDoc> {
  const res = await api.raw.post("/payment/create", payload);
  return (res.data?.data ?? res.data) as BackendInvoicePaymentDoc;
}

export interface UpdateInvoicePaymentPayload {
  customer_id?: string;
  invoice_id?: string;
  payment_number?: string;
  payment_date?: string;
  payment_type?: string;
  amount?: number;
  notes?: string;
  internal_notes?: string;
  attachments?: string;
  type?: "invoice";
}

export async function updateInvoicePayment(
  id: string,
  payload: UpdateInvoicePaymentPayload,
): Promise<BackendInvoicePaymentDoc> {
  const res = await api.raw.patch(`/payment/${id}`, payload);
  return (res.data?.data ?? res.data) as BackendInvoicePaymentDoc;
}

export async function deleteInvoicePayment(id: string): Promise<void> {
  await api.raw.delete(`/payment/${id}`);
}
