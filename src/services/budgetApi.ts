/**
 * Budget Planner API — /api/v1/budget-planner/*
 * Periods, budgets, allocations, monitoring (Goal-style list helpers).
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type BudgetListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  period_id?: string;
  budget_id?: string;
  account_id?: string;
  budget_type?: string;
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

const TYPE_TO_BE: Record<string, string> = {
  capital: "capital",
  operational: "operational",
  cash_flow: "cash_flow",
  Capital: "capital",
  Operational: "operational",
  "Cash Flow": "cash_flow",
  "cash flow": "cash_flow",
};
const TYPE_TO_FE: Record<string, string> = {
  capital: "Capital",
  operational: "Operational",
  cash_flow: "Cash Flow",
};

async function listGet<T>(
  path: string,
  params: BudgetListParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status.toLowerCase();
  if (params.period_id) query.period_id = params.period_id;
  if (params.budget_id) query.budget_id = params.budget_id;
  if (params.account_id) query.account_id = params.account_id;
  if (params.budget_type) query.budget_type = params.budget_type;

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

/* ── Periods ──────────────────────────────────────────────────── */

export type BudgetPeriodRow = {
  id: string;
  name: string;
  financialYear: string;
  startDate: string;
  endDate: string;
  status: string;
  approvedBy: string;
};

export const mapPeriod = (d: any): BudgetPeriodRow => ({
  id: idOf(d),
  name: text(d.period_name),
  financialYear: text(d.financial_year),
  startDate: day(d.start_date),
  endDate: day(d.end_date),
  status: titleCase(text(d.status) || "draft"),
  approvedBy: text(d.approved_by?.name) || text(d.approved_by) || "",
});

export async function fetchBudgetPeriods(params?: BudgetListParams) {
  const { rows, pagination } = await listGet<any>("/budget-planner/budget-periods", params);
  return { rows: rows.map(mapPeriod), pagination };
}

export async function createBudgetPeriod(body: {
  period_name: string;
  financial_year: string;
  start_date: string;
  end_date: string;
}) {
  return api.post("/budget-planner/budget-periods", body);
}

export async function updateBudgetPeriod(
  id: string,
  body: Partial<{ period_name: string; financial_year: string; start_date: string; end_date: string }>,
) {
  return api.put(`/budget-planner/budget-periods/${id}`, body);
}

export async function deleteBudgetPeriod(id: string) {
  return api.delete(`/budget-planner/budget-periods/${id}`);
}

export async function approveBudgetPeriod(id: string) {
  return api.post(`/budget-planner/budget-periods/approve/${id}`);
}

export async function activateBudgetPeriod(id: string) {
  return api.post(`/budget-planner/budget-periods/active/${id}`);
}

export async function closeBudgetPeriod(id: string) {
  return api.post(`/budget-planner/budget-periods/close/${id}`);
}

export async function searchBudgetPeriods(q: string, status?: string) {
  const { rows } = await fetchBudgetPeriods({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    status,
    sort: "period_name,_id",
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.financialYear ? `${r.name} (${r.financialYear})` : r.name,
  }));
}

export async function searchActiveBudgetPeriods(q: string) {
  return searchBudgetPeriods(q, "active");
}

/* ── Budgets ──────────────────────────────────────────────────── */

export type BudgetRow = {
  id: string;
  name: string;
  periodId: string;
  periodName: string;
  type: string;
  typeBe: string;
  amount: number;
  status: string;
  approvedBy: string;
};

export const mapBudget = (d: any): BudgetRow => {
  const typeBe = text(d.budget_type) || "operational";
  return {
    id: idOf(d),
    name: text(d.budget_name),
    periodId: idOf(d.period_id),
    periodName: text(d.period_id?.period_name) || text(d.period_name),
    type: TYPE_TO_FE[typeBe] || titleCase(typeBe.replace(/_/g, " ")),
    typeBe,
    amount: num(d.total_budget_amount),
    status: titleCase(text(d.status) || "draft"),
    approvedBy: text(d.approved_by?.name) || text(d.approved_by) || "",
  };
};

export async function fetchBudgets(params?: BudgetListParams) {
  const { rows, pagination } = await listGet<any>("/budget-planner/budgets", params);
  return { rows: rows.map(mapBudget), pagination };
}

export async function createBudget(body: {
  budget_name: string;
  period_id: string;
  budget_type: string;
}) {
  return api.post("/budget-planner/budgets", {
    ...body,
    budget_type: TYPE_TO_BE[body.budget_type] || body.budget_type,
  });
}

export async function updateBudget(
  id: string,
  body: Partial<{ budget_name: string; period_id: string; budget_type: string }>,
) {
  const payload: Record<string, unknown> = { ...body };
  if (body.budget_type) payload.budget_type = TYPE_TO_BE[body.budget_type] || body.budget_type;
  return api.put(`/budget-planner/budgets/${id}`, payload);
}

export async function deleteBudget(id: string) {
  return api.delete(`/budget-planner/budgets/${id}`);
}

export async function approveBudget(id: string) {
  return api.post(`/budget-planner/budgets/approve/${id}`);
}

export async function activateBudget(id: string) {
  return api.post(`/budget-planner/budgets/active/${id}`);
}

export async function closeBudget(id: string) {
  return api.post(`/budget-planner/budgets/close/${id}`);
}

export async function searchBudgets(q: string, extra?: { status?: string }) {
  const { rows } = await fetchBudgets({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    status: extra?.status,
    sort: "budget_name,_id",
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Allocations ──────────────────────────────────────────────── */

export type AllocationRow = {
  id: string;
  budgetId: string;
  budgetName: string;
  accountId: string;
  accountName: string;
  allocated: number;
  spent: number;
  remaining: number;
};

export const mapAllocation = (d: any): AllocationRow => {
  const allocated = num(d.allocated_amount);
  const spent = num(d.spent_amount);
  const remaining = d.remaining_amount !== undefined ? num(d.remaining_amount) : allocated - spent;
  const account = d.account_id;
  const code = text(account?.account_code);
  const aname = text(account?.account_name);
  return {
    id: idOf(d),
    budgetId: idOf(d.budget_id),
    budgetName: text(d.budget_id?.budget_name) || text(d.budget_name),
    accountId: idOf(d.account_id),
    accountName: code && aname ? `${code} - ${aname}` : aname || code || text(d.account_name),
    allocated,
    spent,
    remaining,
  };
};

export async function fetchAllocations(params?: BudgetListParams) {
  const { rows, pagination } = await listGet<any>("/budget-planner/budget-allocations", params);
  return { rows: rows.map(mapAllocation), pagination };
}

export async function createAllocation(body: {
  budget_id: string;
  account_id: string;
  allocated_amount: number;
}) {
  return api.post("/budget-planner/budget-allocations", body);
}

export async function updateAllocation(
  id: string,
  body: Partial<{ budget_id: string; account_id: string; allocated_amount: number }>,
) {
  return api.put(`/budget-planner/budget-allocations/${id}`, body);
}

export async function deleteAllocation(id: string) {
  return api.delete(`/budget-planner/budget-allocations/${id}`);
}

export async function searchBudgetAccounts(q: string) {
  const { fetchChartOfAccounts } = await import("./doubleEntry");
  const list = await fetchChartOfAccounts({ page: 1, limit: 30, searchTerm: q || undefined });
  return list.map((a: any) => ({
    id: String(a._id ?? a.id ?? ""),
    name:
      `${text(a.account_code)}${a.account_name ? " - " + text(a.account_name) : ""}`.trim() ||
      text(a.account_name) ||
      text(a.name),
  }));
}

/* ── Monitoring ───────────────────────────────────────────────── */

export type MonitoringRow = {
  id: string;
  budgetId: string;
  budgetName: string;
  date: string;
  allocated: number;
  spent: number;
  remaining: number;
  varianceAmount: number;
  variancePct: number;
};

export const mapMonitoring = (d: any): MonitoringRow => ({
  id: idOf(d),
  budgetId: idOf(d.budget_id),
  budgetName: text(d.budget_id?.budget_name) || text(d.budget_name),
  date: day(d.monitoring_date),
  allocated: num(d.total_allocated),
  spent: num(d.total_spent),
  remaining: num(d.total_remaining),
  varianceAmount: num(d.variance_amount),
  variancePct: num(d.variance_percentage),
});

export async function fetchMonitoring(params?: BudgetListParams) {
  const { rows, pagination } = await listGet<any>("/budget-planner/budget-monitoring", params);
  return { rows: rows.map(mapMonitoring), pagination };
}

export const BUDGET_STATUS_FILTERS = ["Draft", "Approved", "Active", "Closed"];
export const BUDGET_TYPES = ["Capital", "Operational", "Cash Flow"] as const;
