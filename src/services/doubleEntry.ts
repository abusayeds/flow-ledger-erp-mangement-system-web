/**
 * Double-Entry API helpers — follow /api/v1/double-entry/* backend contracts.
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";
import { getList, getOne, postJson, deleteJson, buildQuery } from "./_http";

const BASE = "/double-entry";

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
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;

export type DateRange = {
  from_date?: string;
  to_date?: string;
  as_of_date?: string;
  status?: string;
  account_id?: string;
  searchTerm?: string;
  page?: number;
  limit?: number;
  sort?: string;
  [key: string]: unknown;
};

/* ── Chart of accounts (searchable) ───────────────────────────── */

export async function searchChartAccounts(q: string) {
  const rows = await getList<any>("/account/chart-of-accounts/all", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
  });
  return rows.map((a) => ({
    id: idOf(a),
    name:
      `${text(a.account_code)}${a.account_name ? " - " + text(a.account_name) : ""}`.trim() ||
      text(a.account_name),
  }));
}

export const fetchChartOfAccounts = (params?: { limit?: number; page?: number; searchTerm?: string }) =>
  getList<any>(`/account/chart-of-accounts/all`, { limit: 100, ...params });

/* ── Ledger Summary ───────────────────────────────────────────── */

export type LedgerEntryRow = {
  id: string;
  date: string;
  code: string;
  name: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
};

export async function fetchLedgerSummary(params: DateRange = {}) {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.from_date) query.from_date = params.from_date;
  if (params.to_date) query.to_date = params.to_date;
  if (params.account_id) query.account_id = params.account_id;
  if (params.sort) query.sort = params.sort;

  const res = await api.raw.get(`${BASE}/ledger-summary`, { params: query });
  const body = res.data ?? {};
  const payload = body.data ?? {};
  const entriesRaw = Array.isArray(payload.entries) ? payload.entries : [];
  const rows: LedgerEntryRow[] = entriesRaw.map((e: any) => ({
    id: idOf(e),
    date: day(e.journal_date),
    code: text(e.account_code),
    name: text(e.account_name),
    reference: text(e.reference_type),
    description: text(e.description) || text(e.journal_description),
    debit: num(e.debit_amount),
    credit: num(e.credit_amount),
  }));
  return {
    rows,
    pagination: (body.pagination as TPartyPagination) ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

/* ── Trial Balance ────────────────────────────────────────────── */

export type TrialBalanceRow = { id: string; code: string; name: string; debit: number; credit: number };

export type TrialBalanceData = {
  accounts: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  from: string;
  to: string;
};

export async function fetchTrialBalance(params: { from_date?: string; to_date?: string }): Promise<TrialBalanceData> {
  const data = await getOne<any>(`${BASE}/trial-balance`, params);
  return {
    accounts: (Array.isArray(data?.accounts) ? data.accounts : []).map((a: any) => ({
      id: idOf(a),
      code: text(a.account_code),
      name: text(a.account_name),
      debit: num(a.debit),
      credit: num(a.credit),
    })),
    totalDebit: num(data?.total_debit),
    totalCredit: num(data?.total_credit),
    balanced: !!data?.is_balanced,
    from: text(data?.from_date),
    to: text(data?.to_date),
  };
}

/* ── Profit & Loss ────────────────────────────────────────────── */

export type PLRow = { id: string; code: string; name: string; amount: number };

export type ProfitLossData = {
  revenue: PLRow[];
  expenses: PLRow[];
  totalRevenue: number;
  totalExpenses: number;
  net: number;
  from: string;
  to: string;
};

export async function fetchProfitLoss(params: { from_date?: string; to_date?: string }): Promise<ProfitLossData> {
  const data = await getOne<any>(`${BASE}/profit-loss`, params);
  const mapRows = (arr: any[]): PLRow[] =>
    (Array.isArray(arr) ? arr : []).map((r) => ({
      id: idOf(r),
      code: text(r.account_code),
      name: text(r.account_name),
      amount: Math.abs(num(r.balance ?? r.amount)),
    }));
  return {
    revenue: mapRows(data?.revenue),
    expenses: mapRows(data?.expenses),
    totalRevenue: num(data?.total_revenue),
    totalExpenses: Math.abs(num(data?.total_expenses)),
    net: num(data?.net_profit),
    from: text(data?.from_date),
    to: text(data?.to_date),
  };
}

/* ── Balance Sheets ───────────────────────────────────────────── */

export type BalanceSheetListItem = {
  id: string;
  date: string;
  year: string;
  status: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
};

export type BsLine = { id: string; code: string; name: string; amount: number };
export type BsSubSection = { key: string; label: string; lines: BsLine[]; subtotal: number };
export type BsSectionBlock = { key: string; label: string; sub_sections: BsSubSection[]; total: number };

export type BalanceSheetView = {
  id: string;
  date: string;
  year: string;
  status: string;
  balanced: boolean;
  asOfLabel: string;
  summary: { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number };
  assets: { title: string; sections: BsSectionBlock[]; grand_total: number };
  liabilitiesAndEquity: { title: string; sections: BsSectionBlock[]; grand_total: number };
  notes: Array<{ id: string; title: string; content: string }>;
  allSheets: BalanceSheetListItem[];
};

const mapBsLine = (l: any): BsLine => ({
  id: idOf(l),
  code: text(l.account_code),
  name: text(l.account_name),
  amount: num(l.amount),
});

const mapSide = (side: any) => ({
  title: text(side?.title),
  sections: (Array.isArray(side?.sections) ? side.sections : []).map((s: any) => ({
    key: text(s.key),
    label: text(s.label),
    total: num(s.total),
    sub_sections: (Array.isArray(s.sub_sections) ? s.sub_sections : []).map((sub: any) => ({
      key: text(sub.key),
      label: text(sub.label),
      subtotal: num(sub.subtotal),
      lines: (Array.isArray(sub.lines) ? sub.lines : []).map(mapBsLine),
    })),
  })),
  grand_total: num(side?.grand_total),
});

export function mapBalanceSheetView(data: any): BalanceSheetView {
  const bs = data?.balance_sheet ?? {};
  const summary = data?.summary ?? {};
  return {
    id: idOf(bs) || idOf(data),
    date: text(bs.balance_sheet_date),
    year: text(bs.financial_year),
    status: text(bs.status) === "finalized" ? "Finalized" : "Draft",
    balanced: !!(data?.badges?.balanced ?? bs.is_balanced),
    asOfLabel: text(bs.as_of_label),
    summary: {
      assets: num(summary.total_assets),
      liabilities: num(summary.total_liabilities),
      equity: num(summary.total_equity),
      liabilitiesAndEquity: num(summary.total_liabilities_and_equity),
    },
    assets: mapSide(data?.assets),
    liabilitiesAndEquity: mapSide(data?.liabilities_and_equity),
    notes: (Array.isArray(data?.notes) ? data.notes : []).map((n: any) => ({
      id: idOf(n),
      title: text(n.note_title),
      content: text(n.note_content),
    })),
    allSheets: (Array.isArray(data?.all_balance_sheets) ? data.all_balance_sheets : []).map((s: any) => ({
      id: idOf(s),
      date: text(s.balance_sheet_date),
      year: text(s.financial_year),
      status: text(s.status) === "finalized" ? "Finalized" : "Draft",
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      balanced: false,
    })),
  };
}

export async function fetchBalanceSheetList(params?: { page?: number; limit?: number; searchTerm?: string; sort?: string; status?: string }) {
  const res = await api.raw.get(`${BASE}/balance-sheets/list`, {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      ...(params?.sort ? { sort: params.sort } : { sort: "-balance_sheet_date,_id" }),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.searchTerm ? { searchTerm: params.searchTerm } : {}),
    },
  });
  const body = res.data ?? {};
  const rows = (Array.isArray(body.data) ? body.data : []).map((s: any) => ({
    id: idOf(s),
    date: day(s.balance_sheet_date),
    year: text(s.financial_year),
    status: text(s.status) === "finalized" ? "Finalized" : "Draft",
    totalAssets: num(s.total_assets),
    totalLiabilities: num(s.total_liabilities),
    totalEquity: num(s.total_equity),
    balanced: !!s.is_balanced,
  })) as BalanceSheetListItem[];
  return {
    rows,
    pagination: (body.pagination as TPartyPagination) ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

export async function fetchBalanceSheet(id: string) {
  const data = await getOne<any>(`${BASE}/balance-sheets/${id}`);
  return mapBalanceSheetView(data);
}

export async function fetchLatestBalanceSheet() {
  const data = await getOne<any>(`${BASE}/balance-sheets/latest`);
  if (!data || !data.balance_sheet) return null;
  return mapBalanceSheetView(data);
}

export async function createBalanceSheet(body: { balance_sheet_date: string; financial_year: string }) {
  const data = await postJson<any>(`${BASE}/balance-sheets`, body);
  return mapBalanceSheetView(data);
}

export async function finalizeBalanceSheet(id: string) {
  return postJson(`${BASE}/balance-sheets/${id}/finalize`);
}

export async function addBalanceSheetNote(id: string, body: { note_title: string; note_content: string }) {
  return postJson(`${BASE}/balance-sheets/${id}/notes`, body);
}

export async function deleteBalanceSheetNote(sheetId: string, noteId: string) {
  return deleteJson(`${BASE}/balance-sheets/${sheetId}/notes/${noteId}`);
}

export async function compareBalanceSheets(currentId: string, previousId: string) {
  return postJson(`${BASE}/balance-sheets/compare`, {
    current_period_id: currentId,
    previous_period_id: previousId,
  });
}

/* ── Reports ──────────────────────────────────────────────────── */

export const doubleEntryReports = {
  trialBalance: (p: DateRange) => getOne<any>(`${BASE}/trial-balance`, p),
  profitLoss: (p: DateRange) => getOne<any>(`${BASE}/profit-loss`, p),
  ledgerSummary: (p: DateRange) => getOne<any>(`${BASE}/ledger-summary`, p),
  journalEntry: (p: DateRange) => getOne<any>(`${BASE}/reports/journal-entry`, p),
  generalLedger: (p: DateRange) => getOne<any>(`${BASE}/reports/general-ledger`, p),
  accountStatement: (p: DateRange) => getOne<any>(`${BASE}/reports/account-statement`, p),
  accountBalance: (p: DateRange) => getOne<any>(`${BASE}/reports/account-balance`, p),
  cashFlow: (p: DateRange) => getOne<any>(`${BASE}/reports/cash-flow`, p),
  expenseReport: (p: DateRange) => getOne<any>(`${BASE}/reports/expense-report`, p),
};

export const printUrls = {
  trialBalance: (p: DateRange) => `${BASE}/trial-balance/print${buildQuery({ from_date: p.from_date, to_date: p.to_date })}`,
  profitLoss: (p: DateRange) => `${BASE}/profit-loss/print${buildQuery({ from_date: p.from_date, to_date: p.to_date })}`,
  ledgerSummary: (p: DateRange) =>
    `${BASE}/ledger-summary/print${buildQuery({ from_date: p.from_date, to_date: p.to_date, account_id: p.account_id })}`,
};

/** @deprecated prefer named helpers above — kept for older imports */
export const balanceSheetActions = {
  latest: fetchLatestBalanceSheet,
  show: fetchBalanceSheet,
  finalize: finalizeBalanceSheet,
  addNote: addBalanceSheetNote,
  deleteNote: deleteBalanceSheetNote,
  compare: (body: { current_period_id: string; previous_period_id: string }) =>
    postJson(`${BASE}/balance-sheets/compare`, body),
};
