/** Expenses list — backend pagination via /expenses/all */
import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "./paginatedList";
import type { TPartyPagination } from "./customerTypes";

export type ExpenseListRow = {
  _id: string;
  number: string;
  vendorName: string;
  category: string;
  note: string;
  amount: number;
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

const mapExpense = (doc: any): ExpenseListRow => ({
  _id: String(doc._id),
  number: text(doc.invoice_number || doc.expense_number || doc.number) || "—",
  vendorName:
    text(doc?.vendor_id?.businessProfile?.companyName) ||
    text(doc?.vendor_id?.name) ||
    text(doc?.vendor_name) ||
    "—",
  category: text(doc.category) || "—",
  note: text(doc.notes) || "No Notes",
  amount: num(doc.total ?? doc.grand_total ?? doc.amount),
  dateLabel: formatDate(doc.date || doc.createdAt),
  status: text(doc.status) || "Draft",
  currency: text(doc.currency) || "USD",
});

export async function fetchExpenses(params: {
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
}): Promise<{ rows: ExpenseListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/expenses/all", {
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
  return { rows: rows.map(mapExpense), pagination };
}

export async function deleteExpense(id: string): Promise<void> {
  await api.raw.delete(`/expenses/delete/${id}`);
}

export async function deleteExpenses(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(ids.map((id) => deleteExpense(id)));
}
