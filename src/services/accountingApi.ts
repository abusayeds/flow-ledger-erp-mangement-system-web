/**
 * Accounting API — /api/v1/account/*
 * Goal-style list helpers (searchTerm / sort / page / limit) via api.raw
 * so pagination is preserved.
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type AccountListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  is_active?: string | boolean;
  bank_account_id?: string;
  reconciliation_status?: string;
  from_date?: string;
  to_date?: string;
  as_of_date?: string;
  show_zero_balances?: string | boolean;
};

const FALLBACK_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

const text = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
};

const idOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "_id" in v) return String((v as { _id: unknown })._id);
  if (typeof v === "object" && v !== null && "id" in v) return String((v as { id: unknown }).id);
  return "";
};

const nameOf = (
  v: unknown,
  fields: string[] = ["name", "account_name", "category_name", "bank_name", "companyName"],
): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    for (const f of fields) {
      if (typeof o[f] === "string" && o[f]) return String(o[f]);
    }
    const bp = o.businessProfile as Record<string, unknown> | undefined;
    if (bp && typeof bp.companyName === "string") return bp.companyName;
  }
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");

async function listGet<T>(
  path: string,
  params: AccountListParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status.toLowerCase();
  if (params.is_active !== undefined && params.is_active !== "") query.is_active = params.is_active;
  if (params.bank_account_id) query.bank_account_id = params.bank_account_id;
  if (params.reconciliation_status) query.reconciliation_status = params.reconciliation_status;
  if (params.from_date) query.from_date = params.from_date;
  if (params.to_date) query.to_date = params.to_date;
  if (params.as_of_date) query.as_of_date = params.as_of_date;
  if (params.show_zero_balances !== undefined) query.show_zero_balances = params.show_zero_balances;

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

/* ── Search helpers (dropdowns) ───────────────────────────────── */

export async function searchBankAccounts(q: string) {
  const { rows } = await listGet<any>("/account/bank-accounts/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "account_name,_id",
  });
  return rows.map((b) => ({
    id: idOf(b),
    name: text(b.account_name) || text(b.bank_name) || text(b.account_number) || "Bank account",
  }));
}

export async function searchChartAccounts(q: string) {
  const { rows } = await listGet<any>("/account/chart-of-accounts/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "account_code,_id",
  });
  return rows.map((a) => ({
    id: idOf(a),
    name: [text(a.account_code), text(a.account_name)].filter(Boolean).join(" · ") || "Account",
  }));
}

export async function searchAccountTypes(q: string) {
  const { rows } = await listGet<any>("/account/account-types/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
  });
  return rows.map((t) => ({
    id: idOf(t),
    name: text(t.name) || text(t.code) || "Type",
  }));
}

export async function searchAccountCategories(q: string) {
  const { rows } = await listGet<any>("/account/account-categories/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
  });
  return rows.map((c) => ({
    id: idOf(c),
    name: text(c.name) || text(c.code) || "Category",
  }));
}

export async function searchRevenueCategories(q: string) {
  const { rows } = await listGet<any>("/account/revenue-categories/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "category_name,_id",
  });
  return rows.map((c) => ({
    id: idOf(c),
    name: text(c.category_name) || text(c.category_code) || "Category",
  }));
}

export async function searchExpenseCategories(q: string) {
  const { rows } = await listGet<any>("/account/expense-categories/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "category_name,_id",
  });
  return rows.map((c) => ({
    id: idOf(c),
    name: text(c.category_name) || text(c.category_code) || "Category",
  }));
}

export async function searchCustomers(q: string) {
  const { rows } = await listGet<any>("/customer/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
  });
  return rows.map((c) => ({
    id: idOf(c),
    name: nameOf(c) || text(c.email) || "Customer",
  }));
}

export async function searchVendors(q: string) {
  const { rows } = await listGet<any>("/vendor/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
  });
  return rows.map((v) => ({
    id: idOf(v),
    name: nameOf(v) || text(v.email) || "Vendor",
  }));
}

/* ── Bank Accounts ────────────────────────────────────────────── */

export type BankAccountRow = {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  branchName: string;
  accountType: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  glAccountId: string;
  glAccountName: string;
};

export const mapBankAccount = (a: any): BankAccountRow => ({
  id: idOf(a),
  accountNumber: text(a.account_number),
  accountName: text(a.account_name),
  bankName: text(a.bank_name),
  branchName: text(a.branch_name),
  accountType: text(a.account_type),
  openingBalance: num(a.opening_balance),
  currentBalance: num(a.current_balance),
  isActive: a.is_active !== false,
  glAccountId: idOf(a.gl_account_id),
  glAccountName: [nameOf(a.gl_account_id, ["account_code"]), nameOf(a.gl_account_id, ["account_name"])]
    .filter(Boolean)
    .join(" · "),
});

export async function fetchBankAccounts(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/bank-accounts/all", params);
  return { rows: rows.map(mapBankAccount), pagination };
}

export async function createBankAccount(body: Record<string, unknown>) {
  return api.post("/account/bank-accounts/create", body);
}

export async function updateBankAccount(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/bank-accounts/edit/${id}`, body);
}

export async function deleteBankAccount(id: string) {
  return api.delete(`/account/bank-accounts/delete/${id}`);
}

export const BANK_ACCOUNT_TYPES = ["checking", "savings", "credit_card", "cash", "other"] as const;

/* ── Chart of Accounts ────────────────────────────────────────── */

export type CoaRow = {
  id: string;
  accountCode: string;
  accountName: string;
  accountTypeId: string;
  accountTypeName: string;
  normalBalance: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  description: string;
};

export const mapCoa = (a: any): CoaRow => ({
  id: idOf(a),
  accountCode: text(a.account_code),
  accountName: text(a.account_name),
  accountTypeId: idOf(a.account_type_id),
  accountTypeName: nameOf(a.account_type_id),
  normalBalance: text(a.normal_balance),
  openingBalance: num(a.opening_balance),
  currentBalance: num(a.current_balance),
  isActive: a.is_active !== false,
  description: text(a.description),
});

export async function fetchChartOfAccounts(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/chart-of-accounts/all", params);
  return { rows: rows.map(mapCoa), pagination };
}

export async function fetchChartOfAccount(id: string) {
  return api.get<any>(`/account/chart-of-accounts/single/${id}`);
}

export async function createChartOfAccount(body: Record<string, unknown>) {
  return api.post("/account/chart-of-accounts/create", body);
}

export async function updateChartOfAccount(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/chart-of-accounts/edit/${id}`, body);
}

export async function deleteChartOfAccount(id: string) {
  return api.delete(`/account/chart-of-accounts/delete/${id}`);
}

/* ── Bank Transactions ────────────────────────────────────────── */

export type BankTxnRow = {
  id: string;
  date: string;
  bankAccountId: string;
  bankAccountName: string;
  type: string;
  amount: number;
  reference: string;
  description: string;
  reconciled: boolean;
};

export const mapBankTxn = (t: any): BankTxnRow => ({
  id: idOf(t),
  date: day(t.transaction_date || t.date),
  bankAccountId: idOf(t.bank_account_id),
  bankAccountName: nameOf(t.bank_account_id, ["account_name", "bank_name"]),
  type: text(t.transaction_type || t.type),
  amount: num(t.amount),
  reference: text(t.reference_number),
  description: text(t.description),
  reconciled:
    text(t.reconciliation_status).toLowerCase() === "reconciled" ||
    !!(t.is_reconciled ?? t.reconciled),
});

export async function fetchBankTransactions(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/bank-transactions/all", params);
  return { rows: rows.map(mapBankTxn), pagination };
}

export async function markBankTxnReconciled(id: string) {
  return api.post(`/account/bank-transactions/mark-reconciled/${id}`);
}

/* ── Bank Transfers ───────────────────────────────────────────── */

export type BankTransferRow = {
  id: string;
  transferNumber: string;
  transferDate: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  transferAmount: number;
  transferCharges: number;
  referenceNumber: string;
  description: string;
  status: string;
};

export const mapBankTransfer = (t: any): BankTransferRow => ({
  id: idOf(t),
  transferNumber: text(t.transfer_number),
  transferDate: day(t.transfer_date),
  fromAccountId: idOf(t.from_account_id),
  fromAccountName: nameOf(t.from_account_id, ["account_name", "bank_name"]),
  toAccountId: idOf(t.to_account_id),
  toAccountName: nameOf(t.to_account_id, ["account_name", "bank_name"]),
  transferAmount: num(t.transfer_amount),
  transferCharges: num(t.transfer_charges),
  referenceNumber: text(t.reference_number),
  description: text(t.description),
  status: titleCase(text(t.status) || "pending"),
});

export async function fetchBankTransfers(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/bank-transfers/all", params);
  return { rows: rows.map(mapBankTransfer), pagination };
}

export async function createBankTransfer(body: Record<string, unknown>) {
  return api.post("/account/bank-transfers/create", body);
}

export async function updateBankTransfer(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/bank-transfers/edit/${id}`, body);
}

export async function deleteBankTransfer(id: string) {
  return api.delete(`/account/bank-transfers/delete/${id}`);
}

export async function processBankTransfer(id: string) {
  return api.post(`/account/bank-transfers/process/${id}`);
}

export const TRANSFER_STATUSES = ["Pending", "Completed", "Failed"] as const;

/* ── Revenues ─────────────────────────────────────────────────── */

export type RevenueRow = {
  id: string;
  number: string;
  date: string;
  categoryId: string;
  categoryName: string;
  bankAccountId: string;
  bankAccountName: string;
  chartAccountId: string;
  chartAccountName: string;
  amount: number;
  description: string;
  reference: string;
  status: string;
};

export const mapRevenue = (r: any): RevenueRow => ({
  id: idOf(r),
  number: text(r.revenue_number),
  date: day(r.revenue_date),
  categoryId: idOf(r.category_id),
  categoryName: nameOf(r.category_id, ["category_name", "name"]),
  bankAccountId: idOf(r.bank_account_id),
  bankAccountName: nameOf(r.bank_account_id, ["account_name", "bank_name"]),
  chartAccountId: idOf(r.chart_of_account_id),
  chartAccountName: [nameOf(r.chart_of_account_id, ["account_code"]), nameOf(r.chart_of_account_id, ["account_name"])]
    .filter(Boolean)
    .join(" · "),
  amount: num(r.amount),
  description: text(r.description),
  reference: text(r.reference_number),
  status: titleCase(text(r.status) || "draft"),
});

export async function fetchRevenues(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/revenues/all", params);
  return { rows: rows.map(mapRevenue), pagination };
}

export async function createRevenue(body: Record<string, unknown>) {
  return api.post("/account/revenues/create", body);
}

export async function updateRevenue(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/revenues/edit/${id}`, body);
}

export async function deleteRevenue(id: string) {
  return api.delete(`/account/revenues/delete/${id}`);
}

export async function approveRevenue(id: string) {
  return api.patch(`/account/revenues/approve/${id}`);
}

export async function postRevenue(id: string) {
  return api.patch(`/account/revenues/post/${id}`);
}

export const REVENUE_STATUSES = ["Draft", "Approved", "Posted"] as const;

/* ── Expenses ─────────────────────────────────────────────────── */

export type ExpenseRow = {
  id: string;
  number: string;
  date: string;
  categoryId: string;
  categoryName: string;
  bankAccountId: string;
  bankAccountName: string;
  chartAccountId: string;
  chartAccountName: string;
  amount: number;
  description: string;
  reference: string;
  status: string;
};

export const mapExpense = (r: any): ExpenseRow => ({
  id: idOf(r),
  number: text(r.expense_number),
  date: day(r.expense_date),
  categoryId: idOf(r.category_id),
  categoryName: nameOf(r.category_id, ["category_name", "name"]),
  bankAccountId: idOf(r.bank_account_id),
  bankAccountName: nameOf(r.bank_account_id, ["account_name", "bank_name"]),
  chartAccountId: idOf(r.chart_of_account_id),
  chartAccountName: [nameOf(r.chart_of_account_id, ["account_code"]), nameOf(r.chart_of_account_id, ["account_name"])]
    .filter(Boolean)
    .join(" · "),
  amount: num(r.amount),
  description: text(r.description),
  reference: text(r.reference_number),
  status: titleCase(text(r.status) || "draft"),
});

export async function fetchExpenses(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/expenses/all", params);
  return { rows: rows.map(mapExpense), pagination };
}

export async function createExpense(body: Record<string, unknown>) {
  return api.post("/account/expenses/create", body);
}

export async function updateExpense(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/expenses/edit/${id}`, body);
}

export async function deleteExpense(id: string) {
  return api.delete(`/account/expenses/delete/${id}`);
}

export async function approveExpense(id: string) {
  return api.patch(`/account/expenses/approve/${id}`);
}

export async function postExpense(id: string) {
  return api.patch(`/account/expenses/post/${id}`);
}

export const EXPENSE_STATUSES = ["Draft", "Approved", "Posted"] as const;

/* ── Customer Payments ────────────────────────────────────────── */

export type CustomerPaymentRow = {
  id: string;
  number: string;
  date: string;
  customerId: string;
  customerName: string;
  bankAccountId: string;
  bankAccountName: string;
  reference: string;
  amount: number;
  status: string;
  notes: string;
};

export const mapCustomerPayment = (p: any): CustomerPaymentRow => ({
  id: idOf(p),
  number: text(p.payment_number),
  date: day(p.payment_date),
  customerId: idOf(p.customer_id),
  customerName: nameOf(p.customer_id),
  bankAccountId: idOf(p.bank_account_id),
  bankAccountName: nameOf(p.bank_account_id, ["account_name", "bank_name"]),
  reference: text(p.reference_number),
  amount: num(p.payment_amount),
  status: titleCase(text(p.status) || "pending"),
  notes: text(p.notes),
});

export async function fetchCustomerPayments(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/customer-payments/all", params);
  return { rows: rows.map(mapCustomerPayment), pagination };
}

export async function fetchCustomerOutstanding(customerId: string) {
  // Backend returns `{ invoices[], creditNotes[] }` (not a bare array).
  const data = await api.get<any>(`/account/customer-payments/customers/${customerId}/outstanding`);
  const invoices = Array.isArray(data?.invoices)
    ? data.invoices
    : Array.isArray(data)
      ? data
      : [];
  return invoices.map((o: any) => ({
    invoiceId: idOf(o) || idOf(o.invoice_id),
    invoiceNumber: text(o.invoice_number),
    outstanding: num(o.balance_amount ?? o.outstanding ?? o.total),
  }));
}

export async function createCustomerPayment(body: Record<string, unknown>) {
  return api.post("/account/customer-payments/create", body);
}

export async function updateCustomerPaymentStatus(id: string, status: string) {
  return api.patch(`/account/customer-payments/update-status/${id}`, { status });
}

export async function deleteCustomerPayment(id: string) {
  return api.delete(`/account/customer-payments/delete/${id}`);
}

export const PAYMENT_STATUSES = ["Pending", "Cleared", "Cancelled"] as const;

/* ── Vendor Payments ──────────────────────────────────────────── */

export type VendorPaymentRow = {
  id: string;
  number: string;
  date: string;
  vendorId: string;
  vendorName: string;
  bankAccountId: string;
  bankAccountName: string;
  reference: string;
  amount: number;
  status: string;
  notes: string;
};

export const mapVendorPayment = (p: any): VendorPaymentRow => ({
  id: idOf(p),
  number: text(p.payment_number),
  date: day(p.payment_date),
  vendorId: idOf(p.vendor_id),
  vendorName: nameOf(p.vendor_id),
  bankAccountId: idOf(p.bank_account_id),
  bankAccountName: nameOf(p.bank_account_id, ["account_name", "bank_name"]),
  reference: text(p.reference_number),
  amount: num(p.payment_amount),
  status: titleCase(text(p.status) || "pending"),
  notes: text(p.notes),
});

export async function fetchVendorPayments(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/vendor-payments/all", params);
  return { rows: rows.map(mapVendorPayment), pagination };
}

export async function fetchVendorOutstanding(vendorId: string) {
  // Backend returns `{ invoices[], debitNotes[] }` (not a bare array).
  const data = await api.get<any>(`/account/vendor-payments/vendors/${vendorId}/outstanding`);
  const invoices = Array.isArray(data?.invoices)
    ? data.invoices
    : Array.isArray(data)
      ? data
      : [];
  return invoices.map((o: any) => ({
    invoiceId: idOf(o) || idOf(o.invoice_id),
    invoiceNumber: text(o.invoice_number || o.purchase_invoice_number || o.bill_number),
    outstanding: num(o.balance_amount ?? o.outstanding ?? o.total),
  }));
}

export async function createVendorPayment(body: Record<string, unknown>) {
  return api.post("/account/vendor-payments/create", body);
}

export async function updateVendorPaymentStatus(id: string, status: string) {
  return api.patch(`/account/vendor-payments/update-status/${id}`, { status });
}

export async function deleteVendorPayment(id: string) {
  return api.delete(`/account/vendor-payments/delete/${id}`);
}

/* ── Credit / Debit Notes ─────────────────────────────────────── */

export type NoteRow = {
  id: string;
  number: string;
  date: string;
  partyId: string;
  partyName: string;
  amount: number;
  status: string;
};

export const mapCreditNote = (n: any): NoteRow => ({
  id: idOf(n),
  number: text(n.credit_note_number || n.note_number || n.number),
  date: day(n.credit_note_date || n.date),
  partyId: idOf(n.customer_id),
  partyName: nameOf(n.customer_id),
  amount: num(n.total ?? n.amount),
  status: titleCase(text(n.status) || "draft"),
});

export const mapDebitNote = (n: any): NoteRow => ({
  id: idOf(n),
  number: text(n.debit_note_number || n.note_number || n.number),
  date: day(n.debit_note_date || n.date),
  partyId: idOf(n.vendor_id),
  partyName: nameOf(n.vendor_id),
  amount: num(n.total ?? n.amount),
  status: titleCase(text(n.status) || "draft"),
});

export async function fetchCreditNotes(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/credit-notes/all", params);
  return { rows: rows.map(mapCreditNote), pagination };
}

export async function fetchCreditNote(id: string) {
  return api.get<any>(`/account/credit-notes/single/${id}`);
}

export async function approveCreditNote(id: string) {
  return api.post(`/account/credit-notes/approve/${id}`);
}

export async function deleteCreditNote(id: string) {
  return api.delete(`/account/credit-notes/delete/${id}`);
}

export async function fetchDebitNotes(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/debit-notes/all", params);
  return { rows: rows.map(mapDebitNote), pagination };
}

export async function fetchDebitNote(id: string) {
  return api.get<any>(`/account/debit-notes/single/${id}`);
}

export async function approveDebitNote(id: string) {
  return api.post(`/account/debit-notes/approve/${id}`);
}

export async function deleteDebitNote(id: string) {
  return api.delete(`/account/debit-notes/delete/${id}`);
}

/* ── System masters ───────────────────────────────────────────── */

export type AccountCategoryRow = {
  id: string;
  name: string;
  code: string;
  type: string;
  description: string;
  isActive: boolean;
};

export const mapAccountCategory = (c: any): AccountCategoryRow => ({
  id: idOf(c),
  name: text(c.name),
  code: text(c.code),
  type: text(c.type),
  description: text(c.description),
  isActive: c.is_active !== false,
});

export async function fetchAccountCategories(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/account-categories/all", params);
  return { rows: rows.map(mapAccountCategory), pagination };
}

export async function createAccountCategory(body: Record<string, unknown>) {
  return api.post("/account/account-categories/create", body);
}

export async function updateAccountCategory(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/account-categories/edit/${id}`, body);
}

export async function deleteAccountCategory(id: string) {
  return api.delete(`/account/account-categories/delete/${id}`);
}

export type AccountTypeRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  code: string;
  normalBalance: string;
  description: string;
  isActive: boolean;
};

export const mapAccountType = (t: any): AccountTypeRow => ({
  id: idOf(t),
  categoryId: idOf(t.category_id),
  categoryName: nameOf(t.category_id),
  name: text(t.name),
  code: text(t.code),
  normalBalance: text(t.normal_balance),
  description: text(t.description),
  isActive: t.is_active !== false,
});

export async function fetchAccountTypes(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/account-types/all", params);
  return { rows: rows.map(mapAccountType), pagination };
}

export async function createAccountType(body: Record<string, unknown>) {
  return api.post("/account/account-types/create", body);
}

export async function updateAccountType(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/account-types/edit/${id}`, body);
}

export async function deleteAccountType(id: string) {
  return api.delete(`/account/account-types/delete/${id}`);
}

export type RevExpCategoryRow = {
  id: string;
  name: string;
  code: string;
  glAccountId: string;
  glAccountName: string;
  description: string;
  isActive: boolean;
};

export const mapRevExpCategory = (c: any): RevExpCategoryRow => ({
  id: idOf(c),
  name: text(c.category_name || c.name),
  code: text(c.category_code || c.code),
  glAccountId: idOf(c.gl_account_id),
  glAccountName: [nameOf(c.gl_account_id, ["account_code"]), nameOf(c.gl_account_id, ["account_name"])]
    .filter(Boolean)
    .join(" · "),
  description: text(c.description),
  isActive: c.is_active !== false,
});

export async function fetchRevenueCategories(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/revenue-categories/all", params);
  return { rows: rows.map(mapRevExpCategory), pagination };
}

export async function createRevenueCategory(body: Record<string, unknown>) {
  return api.post("/account/revenue-categories/create", body);
}

export async function updateRevenueCategory(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/revenue-categories/edit/${id}`, body);
}

export async function deleteRevenueCategory(id: string) {
  return api.delete(`/account/revenue-categories/delete/${id}`);
}

export async function fetchExpenseCategories(params?: AccountListParams) {
  const { rows, pagination } = await listGet<any>("/account/expense-categories/all", params);
  return { rows: rows.map(mapRevExpCategory), pagination };
}

export async function createExpenseCategory(body: Record<string, unknown>) {
  return api.post("/account/expense-categories/create", body);
}

export async function updateExpenseCategory(id: string, body: Record<string, unknown>) {
  return api.patch(`/account/expense-categories/edit/${id}`, body);
}

export async function deleteExpenseCategory(id: string) {
  return api.delete(`/account/expense-categories/delete/${id}`);
}

/* ── Reports ──────────────────────────────────────────────────── */

export async function fetchAccountReport(path: string, params?: Record<string, unknown>) {
  return api.get<any>(path, { params });
}

/** Account dashboard hub — company / staff / customer / vendor. */
export type AccountDashboardPayload = {
  stats?: Record<string, number>;
  monthlyCustomerPayments?: { month: string; customer_payments?: number; payments?: number }[];
  monthlyVendorPayments?: { month: string; vendor_payments?: number; payments?: number }[];
  monthlyPayments?: { month: string; payments?: number }[];
  recentRevenues?: Record<string, unknown>[];
  recentExpenses?: Record<string, unknown>[];
  recentActivities?: Record<string, unknown>[];
  recentReturnInvoices?: Record<string, unknown>[];
  recentCreditNotes?: Record<string, unknown>[];
  recentDebitNotes?: Record<string, unknown>[];
};

export async function fetchAccountDashboard(): Promise<AccountDashboardPayload> {
  try {
    const data = await api.get<AccountDashboardPayload>("/dashboard/account");
    return (data && typeof data === "object" ? data : {}) as AccountDashboardPayload;
  } catch {
    const data = await api.get<AccountDashboardPayload>("/account/dashboard");
    return (data && typeof data === "object" ? data : {}) as AccountDashboardPayload;
  }
}

export const ACCOUNT_TYPE_KINDS = ["asset", "liability", "equity", "revenue", "expense"] as const;
export const NORMAL_BALANCES = ["debit", "credit"] as const;
