/**
 * Performance API — /api/v1/performance/*
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type PerfListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
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

const nameOf = (v: unknown, fields = ["name", "title"]): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    for (const f of fields) {
      if (typeof o[f] === "string" && o[f]) return String(o[f]);
    }
  }
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

async function listGet<T>(
  path: string,
  params: PerfListParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status;

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

export const ACTIVE_STATUSES = ["active", "inactive"] as const;
export const GOAL_STATUSES = ["not_started", "in_progress", "completed", "overdue"] as const;
export const REVIEW_FREQUENCIES = ["monthly", "quarterly", "semi-annual", "annual"] as const;
export const REVIEW_STATUSES = ["pending", "in_progress", "completed"] as const;

/* ── Indicator categories ─────────────────────────────────────── */

export type IndicatorCategoryRow = {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
};

export const mapIndicatorCategory = (d: any): IndicatorCategoryRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  status: text(d.status) || "active",
  createdAt: day(d.createdAt),
});

export async function fetchIndicatorCategories(params?: PerfListParams) {
  const { rows, pagination } = await listGet<any>("/performance/indicator-categories/all", params);
  return { rows: rows.map(mapIndicatorCategory), pagination };
}

export async function createIndicatorCategory(body: { name: string; description?: string; status?: string }) {
  return api.post("/performance/indicator-categories/create", body);
}

export async function updateIndicatorCategory(id: string, body: Record<string, unknown>) {
  return api.patch(`/performance/indicator-categories/edit/${id}`, body);
}

export async function deleteIndicatorCategory(id: string) {
  return api.delete(`/performance/indicator-categories/delete/${id}`);
}

export async function searchIndicatorCategories(q: string) {
  const { rows } = await fetchIndicatorCategories({ page: 1, limit: 30, searchTerm: q || undefined, sort: "name,_id" });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Indicators ───────────────────────────────────────────────── */

export type IndicatorRow = {
  id: string;
  name: string;
  description: string;
  measurementUnit: string;
  targetValue: string;
  status: string;
  categoryId: string;
  categoryName: string;
  createdAt: string;
};

export const mapIndicator = (d: any): IndicatorRow => {
  const cat = d.category ?? d.category_id;
  return {
    id: idOf(d),
    name: text(d.name),
    description: text(d.description),
    measurementUnit: text(d.measurement_unit),
    targetValue: text(d.target_value),
    status: text(d.status) || "active",
    categoryId: idOf(cat),
    categoryName: nameOf(cat),
    createdAt: day(d.createdAt),
  };
};

export async function fetchIndicators(params?: PerfListParams) {
  const { rows, pagination } = await listGet<any>("/performance/indicators/all", params);
  return { rows: rows.map(mapIndicator), pagination };
}

export async function createIndicator(body: Record<string, unknown>) {
  return api.post("/performance/indicators/create", body);
}

export async function updateIndicator(id: string, body: Record<string, unknown>) {
  return api.patch(`/performance/indicators/edit/${id}`, body);
}

export async function deleteIndicator(id: string) {
  return api.delete(`/performance/indicators/delete/${id}`);
}

/* ── Goal types ───────────────────────────────────────────────── */

export type GoalTypeRow = {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
};

export const mapGoalType = (d: any): GoalTypeRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  status: text(d.status) || "active",
  createdAt: day(d.createdAt),
});

export async function fetchGoalTypes(params?: PerfListParams) {
  const { rows, pagination } = await listGet<any>("/performance/goal-types/all", params);
  return { rows: rows.map(mapGoalType), pagination };
}

export async function createGoalType(body: { name: string; description?: string; status?: string }) {
  return api.post("/performance/goal-types/create", body);
}

export async function updateGoalType(id: string, body: Record<string, unknown>) {
  return api.patch(`/performance/goal-types/edit/${id}`, body);
}

export async function deleteGoalType(id: string) {
  return api.delete(`/performance/goal-types/delete/${id}`);
}

export async function searchGoalTypes(q: string) {
  const { rows } = await fetchGoalTypes({ page: 1, limit: 30, searchTerm: q || undefined, sort: "name,_id" });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Review cycles ────────────────────────────────────────────── */

export type ReviewCycleRow = {
  id: string;
  name: string;
  frequency: string;
  description: string;
  status: string;
  createdAt: string;
};

export const mapReviewCycle = (d: any): ReviewCycleRow => ({
  id: idOf(d),
  name: text(d.name),
  frequency: text(d.frequency) || "quarterly",
  description: text(d.description),
  status: text(d.status) || "active",
  createdAt: day(d.createdAt),
});

export async function fetchReviewCycles(params?: PerfListParams) {
  const { rows, pagination } = await listGet<any>("/performance/review-cycles/all", params);
  return { rows: rows.map(mapReviewCycle), pagination };
}

export async function createReviewCycle(body: Record<string, unknown>) {
  return api.post("/performance/review-cycles/create", body);
}

export async function updateReviewCycle(id: string, body: Record<string, unknown>) {
  return api.patch(`/performance/review-cycles/edit/${id}`, body);
}

export async function deleteReviewCycle(id: string) {
  return api.delete(`/performance/review-cycles/delete/${id}`);
}

export async function searchReviewCycles(q: string) {
  const { rows } = await fetchReviewCycles({ page: 1, limit: 30, searchTerm: q || undefined, sort: "name,_id" });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Employee goals ───────────────────────────────────────────── */

export type EmployeeGoalRow = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  target: string;
  progress: number;
  status: string;
  employeeId: string;
  employeeName: string;
  goalTypeId: string;
  goalTypeName: string;
  createdAt: string;
};

export const mapEmployeeGoal = (d: any): EmployeeGoalRow => {
  const emp = d.employee ?? d.employee_id;
  const gt = d.goal_type ?? d.goal_type_id;
  return {
    id: idOf(d),
    title: text(d.title),
    description: text(d.description),
    startDate: day(d.start_date),
    endDate: day(d.end_date),
    target: text(d.target),
    progress: Number(d.progress) || 0,
    status: text(d.status) || "not_started",
    employeeId: idOf(emp),
    employeeName: nameOf(emp),
    goalTypeId: idOf(gt),
    goalTypeName: nameOf(gt),
    createdAt: day(d.createdAt),
  };
};

export async function fetchEmployeeGoals(params?: PerfListParams) {
  const { rows, pagination } = await listGet<any>("/performance/employee-goals/all", params);
  return { rows: rows.map(mapEmployeeGoal), pagination };
}

export async function createEmployeeGoal(body: Record<string, unknown>) {
  return api.post("/performance/employee-goals/create", body);
}

export async function updateEmployeeGoal(id: string, body: Record<string, unknown>) {
  return api.patch(`/performance/employee-goals/edit/${id}`, body);
}

export async function deleteEmployeeGoal(id: string) {
  return api.delete(`/performance/employee-goals/delete/${id}`);
}

/* ── Employee reviews ─────────────────────────────────────────── */

export type EmployeeReviewRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerId: string;
  reviewerName: string;
  cycleId: string;
  cycleName: string;
  reviewDate: string;
  status: string;
  averageRating: number;
  pros: string;
  cons: string;
  createdAt: string;
};

export const mapEmployeeReview = (d: any): EmployeeReviewRow => {
  const user = d.user ?? d.employee_user_id;
  const reviewer = d.reviewer ?? d.reviewer_id;
  const cycle = d.review_cycle ?? d.review_cycle_id;
  return {
    id: idOf(d),
    employeeId: idOf(user),
    employeeName: nameOf(user),
    reviewerId: idOf(reviewer),
    reviewerName: nameOf(reviewer),
    cycleId: idOf(cycle),
    cycleName: nameOf(cycle),
    reviewDate: day(d.review_date),
    status: text(d.status) || "pending",
    averageRating: Number(d.average_rating ?? d.averageRating) || 0,
    pros: text(d.pros),
    cons: text(d.cons),
    createdAt: day(d.createdAt),
  };
};

export async function fetchEmployeeReviews(params?: PerfListParams) {
  const { rows, pagination } = await listGet<any>("/performance/employee-reviews/all", params);
  return { rows: rows.map(mapEmployeeReview), pagination };
}

export async function createEmployeeReview(body: Record<string, unknown>) {
  return api.post("/performance/employee-reviews/create", body);
}

export async function updateEmployeeReview(id: string, body: Record<string, unknown>) {
  return api.patch(`/performance/employee-reviews/edit/${id}`, body);
}

export async function deleteEmployeeReview(id: string) {
  return api.delete(`/performance/employee-reviews/delete/${id}`);
}

export async function fetchReviewConduct(id: string) {
  return api.get<any>(`/performance/employee-reviews/conduct/${id}`);
}

export async function submitReviewConduct(
  id: string,
  body: { ratings: Record<string, number>; pros?: string; cons?: string },
) {
  return api.post(`/performance/employee-reviews/conduct/${id}`, body);
}

/** Search company users via HRM employees — returns User `_id` (required by performance BE). */
export async function searchPerformanceUsers(q: string) {
  const { rows } = await listGet<any>("/hrm/employees", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
  });
  return rows
    .map((e) => {
      const userId =
        idOf(e.employee_user_id) ||
        idOf(e.user_id) ||
        (typeof e.employee_user_id === "string" ? e.employee_user_id : "");
      const name =
        nameOf(e.employee_user_id) ||
        nameOf(e.user_id) ||
        text(e.name) ||
        text(e.employee_name) ||
        text(e.email);
      return { id: userId, name: name || "Employee" };
    })
    .filter((r) => r.id);
}
