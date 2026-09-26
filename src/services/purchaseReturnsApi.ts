/** Purchase returns list — backend pagination via /purchase/returns/all */
import { fetchPaginatedList } from "./paginatedList";
import type { TPartyPagination } from "./customerTypes";

export type PurchaseReturnListRow = {
  _id: string;
  number: string;
  vendorName: string;
  vendorId: string;
  invoice: string;
  note: string;
  reason: string;
  amount: number;
  dateLabel: string;
  status: string;
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

const mapPurchaseReturn = (doc: any): PurchaseReturnListRow => {
  const inv =
    text(doc?.purchase_invoice_id?.invoice_number) ||
    text(doc?.invoice_id?.invoice_number) ||
    text(doc?.invoice_number) ||
    text(doc?.source_invoice_number) ||
    "";
  return {
    _id: String(doc._id),
    number: text(doc.return_number || doc.invoice_number || doc.number) || "—",
    vendorName:
      text(doc?.vendor_id?.businessProfile?.companyName) ||
      text(doc?.vendor_id?.name) ||
      text(doc?.vendor_name) ||
      "—",
    vendorId: vendorIdOf(doc),
    invoice: inv ? (inv.startsWith("#") ? inv : `#${inv}`) : "—",
    note: text(doc.notes) || "No Notes",
    reason: text(doc.return_reason || doc.reason) || "",
    amount: num(doc.total_amount ?? doc.total ?? doc.grand_total),
    dateLabel: formatDate(doc.return_date || doc.date || doc.createdAt),
    status: text(doc.status) || "draft",
  };
};

export async function fetchPurchaseReturns(params: {
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
}): Promise<{ rows: PurchaseReturnListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/purchase/returns/all", {
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
  return { rows: rows.map(mapPurchaseReturn), pagination };
}
