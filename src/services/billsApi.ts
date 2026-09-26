/** Bills list — backend pagination via /bill/all */
import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "./paginatedList";
import type { TPartyPagination } from "./customerTypes";

export type BillListRow = {
  _id: string;
  number: string;
  vendorName: string;
  vendorId: string;
  amount: number;
  dueAmount: number;
  paidAmount: number;
  dateLabel: string;
  status: string;
  currency: string;
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

export const mapBill = (doc: any): BillListRow => {
  const total = num(doc.total ?? doc.grand_total);
  const paid = num(doc.paid_amount);
  const due =
    doc.balance_amount != null && doc.balance_amount !== ""
      ? num(doc.balance_amount)
      : Math.max(0, total - paid);
  return {
    _id: String(doc._id),
    number: text(doc.invoice_number || doc.bill_number || doc.number) || "—",
    vendorName: text(doc?.vendor_id?.businessProfile?.companyName) || text(doc?.vendor_id?.name) || text(doc?.vendor_name) || "—",
    vendorId: vendorIdOf(doc),
    amount: total,
    dueAmount: due,
    paidAmount: paid,
    dateLabel: formatDate(doc.date || doc.bill_date || doc.createdAt),
    status: text(doc.status) || "Draft",
    currency: text(doc.currency) || "USD",
  };
};

export async function fetchBills(params: {
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
}): Promise<{ rows: BillListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/bill/all", {
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
  return { rows: rows.map(mapBill), pagination };
}

export async function fetchBill(id: string): Promise<any | null> {
  try {
    const res = await api.raw.get(`/bill/single/${id}`);
    return res.data?.data ?? res.data ?? null;
  } catch {
    return null;
  }
}

export async function updateBill(
  id: string,
  payload: Record<string, unknown>,
): Promise<any> {
  const res = await api.raw.post(`/bill/edit/${id}`, payload);
  return res.data?.data ?? res.data;
}
