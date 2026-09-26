/** Purchase Orders list — backend pagination via /purchase/invoices/all */
import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "@/services/paginatedList";
import type { TPartyPagination } from "@/services/customerTypes";

export type PurchaseOrderListRow = {
  _id: string;
  number: string;
  vendorName: string;
  dateLabel: string;
  amount: number;
  currency: string;
  status: string;
};

const mapPoListStatus = (raw: unknown): string => {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
  const compact = key.replace(/\s+/g, "");
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    approved: "Approved",
    received: "Received",
    onhold: "On Hold",
    "on hold": "On Hold",
    declined: "Declined",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    closed: "Closed",
    posted: "Closed",
    disputed: "Disputed",
  };
  return map[key] || map[compact] || "Draft";
};

const mapRow = (doc: any): PurchaseOrderListRow => ({
  _id: String(doc._id ?? ""),
  number: String(doc.invoice_number ?? doc.number ?? ""),
  vendorName:
    doc.vendor_id?.businessProfile?.companyName ||
    doc.vendor_id?.name ||
    doc.vendor_name ||
    "(No vendor)",
  dateLabel: doc.date
    ? new Date(doc.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—",
  amount: typeof doc.total === "number" ? doc.total : Number(doc.total) || 0,
  currency: String(doc.currency || "USD"),
  status: mapPoListStatus(doc.status),
});

export async function fetchPurchaseOrders(params: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  isDeleted?: boolean;
  vendor_id?: string;
  dateField?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ rows: PurchaseOrderListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/purchase/invoices/all", {
    page: params.page,
    limit: params.limit,
    searchTerm: params.searchTerm,
    sort: params.sort,
    status: params.status,
    isDeleted: params.isDeleted,
    vendor_id: params.vendor_id,
    dateField: params.dateField,
    startDate: params.startDate,
    endDate: params.endDate,
  });
  return {
    rows: rows.map(mapRow),
    pagination,
  };
}

export async function updatePurchaseOrder(
  id: string,
  payload: Record<string, unknown>,
): Promise<any> {
  const res = await api.raw.patch(`/purchase/invoices/edit/${id}`, payload);
  return res.data?.data ?? res.data;
}
