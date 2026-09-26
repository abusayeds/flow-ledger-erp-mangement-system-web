/**
 * Financial Goal module API — categories, goals, milestones, contributions, tracking.
 * Base: /api/v1/goal/*
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type GoalListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  priority?: string;
  goal_type?: string;
  category_id?: string;
  goal_id?: string;
  is_active?: boolean | string;
  contribution_type?: string;
  on_track_status?: string;
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

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const TYPE_TO_BE: Record<string, string> = {
  savings: "savings",
  "expense reduction": "expense_reduction",
  "debt reduction": "debt_reduction",
  expense_reduction: "expense_reduction",
  debt_reduction: "debt_reduction",
};
const TYPE_TO_FE: Record<string, string> = {
  savings: "savings",
  expense_reduction: "expense reduction",
  debt_reduction: "debt reduction",
};

const TRACK_TO_FE: Record<string, string> = {
  on_track: "On track",
  behind: "Behind",
  ahead: "Ahead",
  critical: "Critical",
};
const TRACK_TO_BE: Record<string, string> = {
  "On track": "on_track",
  Behind: "behind",
  Ahead: "ahead",
  Critical: "critical",
};

async function listGet<T>(path: string, params: GoalListParams = {}): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status;
  if (params.priority) query.priority = params.priority;
  if (params.goal_type) query.goal_type = params.goal_type;
  if (params.category_id) query.category_id = params.category_id;
  if (params.goal_id) query.goal_id = params.goal_id;
  if (params.contribution_type) query.contribution_type = params.contribution_type;
  if (params.on_track_status) query.on_track_status = params.on_track_status;
  if (params.is_active !== undefined && params.is_active !== "") {
    query.is_active = String(params.is_active);
  }

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

/* ── Categories ───────────────────────────────────────────────── */

export type GoalCategoryRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
};

export const mapCategory = (d: any): GoalCategoryRow => ({
  id: String(d._id),
  name: text(d.category_name),
  code: text(d.category_code),
  description: text(d.description),
  active: d.is_active !== false,
});

export async function fetchGoalCategories(params?: GoalListParams) {
  const { rows, pagination } = await listGet<any>("/goal/categories", params);
  return { rows: rows.map(mapCategory), pagination };
}

export async function createGoalCategory(payload: {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
}) {
  const res = await api.raw.post("/goal/categories", {
    category_name: payload.name,
    category_code: payload.code,
    description: payload.description || "",
    is_active: payload.active !== false,
  });
  return mapCategory(res.data?.data ?? res.data);
}

export async function updateGoalCategory(
  id: string,
  payload: Partial<{ name: string; code: string; description: string; active: boolean }>,
) {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.category_name = payload.name;
  if (payload.code !== undefined) body.category_code = payload.code;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.active !== undefined) body.is_active = payload.active;
  const res = await api.raw.put(`/goal/categories/${id}`, body);
  return mapCategory(res.data?.data ?? res.data);
}

export async function deleteGoalCategory(id: string) {
  await api.raw.delete(`/goal/categories/${id}`);
}

export async function searchGoalCategories(q: string) {
  const { rows } = await fetchGoalCategories({ page: 1, limit: 30, searchTerm: q || undefined });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Goals ────────────────────────────────────────────────────── */

export type GoalRow = {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  type: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  targetDate: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Active" | "Draft" | "Completed" | "Paused" | "Cancelled";
  chartOfAccount: string;
  accountId: string;
  description: string;
};

const PRIORITY_TO_FE: Record<string, GoalRow["priority"]> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
const STATUS_TO_FE: Record<string, GoalRow["status"]> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const mapGoal = (d: any): GoalRow => {
  const cat = d.category_id;
  const acc = d.account_id;
  const statusRaw = text(d.status) || "draft";
  const priorityRaw = text(d.priority) || "medium";
  return {
    id: String(d._id),
    name: text(d.goal_name),
    category: typeof cat === "object" ? text(cat?.category_name) : "",
    categoryId: typeof cat === "object" ? text(cat?._id) : text(cat),
    type: TYPE_TO_FE[d.goal_type] || text(d.goal_type) || "savings",
    targetAmount: num(d.target_amount),
    currentAmount: num(d.current_amount),
    startDate: day(d.start_date),
    targetDate: day(d.target_date),
    priority: PRIORITY_TO_FE[priorityRaw.toLowerCase()] || "Medium",
    status: STATUS_TO_FE[statusRaw.toLowerCase()] || "Draft",
    chartOfAccount:
      typeof acc === "object" && acc
        ? `${text(acc.account_code)}${acc.account_name ? " - " + text(acc.account_name) : ""}`.trim()
        : "",
    accountId: typeof acc === "object" ? text(acc?._id) : text(acc),
    description: text(d.goal_description),
  };
};

export async function fetchGoals(params?: GoalListParams) {
  const { rows, pagination } = await listGet<any>("/goal/goals", params);
  return { rows: rows.map(mapGoal), pagination };
}

export async function createGoal(payload: {
  name: string;
  categoryId: string;
  type: string;
  targetAmount: number;
  startDate: string;
  targetDate: string;
  priority: string;
  accountId?: string;
  description?: string;
}) {
  const res = await api.raw.post("/goal/goals", {
    goal_name: payload.name,
    category_id: payload.categoryId,
    goal_type: TYPE_TO_BE[payload.type] || "savings",
    target_amount: Number(payload.targetAmount) || 0,
    start_date: payload.startDate,
    target_date: payload.targetDate,
    priority: (payload.priority || "Medium").toLowerCase(),
    goal_description: payload.description || "",
    ...(payload.accountId ? { account_id: payload.accountId } : {}),
  });
  return mapGoal(res.data?.data ?? res.data);
}

export async function updateGoal(
  id: string,
  payload: Partial<{
    name: string;
    categoryId: string;
    type: string;
    targetAmount: number;
    currentAmount: number;
    startDate: string;
    targetDate: string;
    priority: string;
    accountId: string;
    description: string;
  }>,
) {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.goal_name = payload.name;
  if (payload.categoryId !== undefined) body.category_id = payload.categoryId;
  if (payload.type !== undefined) body.goal_type = TYPE_TO_BE[payload.type] || payload.type;
  if (payload.targetAmount !== undefined) body.target_amount = Number(payload.targetAmount) || 0;
  if (payload.currentAmount !== undefined) body.current_amount = Number(payload.currentAmount) || 0;
  if (payload.startDate !== undefined) body.start_date = payload.startDate;
  if (payload.targetDate !== undefined) body.target_date = payload.targetDate;
  if (payload.priority !== undefined) body.priority = payload.priority.toLowerCase();
  if (payload.description !== undefined) body.goal_description = payload.description;
  if (payload.accountId !== undefined) body.account_id = payload.accountId || undefined;
  const res = await api.raw.put(`/goal/goals/${id}`, body);
  return mapGoal(res.data?.data ?? res.data);
}

export async function activateGoal(id: string) {
  const res = await api.raw.post(`/goal/goals/activate/${id}`);
  return mapGoal(res.data?.data ?? res.data);
}

export async function deleteGoal(id: string) {
  await api.raw.delete(`/goal/goals/${id}`);
}

export async function searchGoals(q: string) {
  const { rows } = await fetchGoals({ page: 1, limit: 30, searchTerm: q || undefined });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Milestones ───────────────────────────────────────────────── */

export type MilestoneRow = {
  id: string;
  goal: string;
  goalId: string;
  name: string;
  targetAmount: number;
  achievedAmount: number;
  achievedDate: string;
  targetDate: string;
  status: "Achieved" | "Pending" | "Overdue";
  description: string;
};

export const mapMilestone = (d: any): MilestoneRow => {
  const g = d.goal_id;
  const st = text(d.status) || "pending";
  return {
    id: String(d._id),
    goal: typeof g === "object" ? text(g?.goal_name) : "",
    goalId: typeof g === "object" ? text(g?._id) : text(g),
    name: text(d.milestone_name),
    targetAmount: num(d.target_amount),
    achievedAmount: num(d.achieved_amount),
    achievedDate: day(d.achieved_date),
    targetDate: day(d.target_date),
    status: st === "achieved" ? "Achieved" : st === "overdue" ? "Overdue" : "Pending",
    description: text(d.milestone_description ?? d.description),
  };
};

export async function fetchMilestones(params?: GoalListParams) {
  const { rows, pagination } = await listGet<any>("/goal/milestones", params);
  return { rows: rows.map(mapMilestone), pagination };
}

export async function createMilestone(payload: {
  goalId: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  description?: string;
}) {
  const res = await api.raw.post("/goal/milestones", {
    goal_id: payload.goalId,
    milestone_name: payload.name,
    target_amount: Number(payload.targetAmount) || 0,
    target_date: payload.targetDate,
    milestone_description: payload.description || "",
  });
  return mapMilestone(res.data?.data ?? res.data);
}

export async function updateMilestone(
  id: string,
  payload: Partial<{
    goalId: string;
    name: string;
    targetAmount: number;
    achievedAmount: number;
    achievedDate: string;
    targetDate: string;
    status: string;
    description: string;
  }>,
) {
  const body: Record<string, unknown> = {};
  if (payload.goalId !== undefined) body.goal_id = payload.goalId;
  if (payload.name !== undefined) body.milestone_name = payload.name;
  if (payload.targetAmount !== undefined) body.target_amount = Number(payload.targetAmount) || 0;
  if (payload.achievedAmount !== undefined) body.achieved_amount = Number(payload.achievedAmount) || 0;
  if (payload.achievedDate !== undefined) body.achieved_date = payload.achievedDate || null;
  if (payload.targetDate !== undefined) body.target_date = payload.targetDate;
  if (payload.status !== undefined) body.status = payload.status.toLowerCase();
  if (payload.description !== undefined) body.milestone_description = payload.description;
  const res = await api.raw.put(`/goal/milestones/${id}`, body);
  return mapMilestone(res.data?.data ?? res.data);
}

export async function deleteMilestone(id: string) {
  await api.raw.delete(`/goal/milestones/${id}`);
}

/* ── Contributions ────────────────────────────────────────────── */

export type ContributionRow = {
  id: string;
  goal: string;
  goalId: string;
  date: string;
  amount: number;
  type: "Manual" | "Automatic";
  notes: string;
};

export const mapContribution = (d: any): ContributionRow => {
  const g = d.goal_id;
  return {
    id: String(d._id),
    goal: typeof g === "object" ? text(g?.goal_name) : "",
    goalId: typeof g === "object" ? text(g?._id) : text(g),
    date: day(d.contribution_date),
    amount: num(d.contribution_amount),
    type: text(d.contribution_type) === "automatic" ? "Automatic" : "Manual",
    notes: text(d.notes),
  };
};

export async function fetchContributions(params?: GoalListParams) {
  const { rows, pagination } = await listGet<any>("/goal/contributions", params);
  return { rows: rows.map(mapContribution), pagination };
}

export async function createContribution(payload: {
  goalId: string;
  date: string;
  amount: number;
  type?: string;
  notes?: string;
}) {
  const res = await api.raw.post("/goal/contributions", {
    goal_id: payload.goalId,
    contribution_date: payload.date,
    contribution_amount: Number(payload.amount) || 0,
    contribution_type: (payload.type || "Manual").toLowerCase() === "automatic" ? "automatic" : "manual",
    notes: payload.notes || "",
  });
  return mapContribution(res.data?.data ?? res.data);
}

export async function updateContribution(
  id: string,
  payload: Partial<{ goalId: string; date: string; amount: number; type: string; notes: string }>,
) {
  const body: Record<string, unknown> = {};
  if (payload.goalId !== undefined) body.goal_id = payload.goalId;
  if (payload.date !== undefined) body.contribution_date = payload.date;
  if (payload.amount !== undefined) body.contribution_amount = Number(payload.amount) || 0;
  if (payload.type !== undefined) {
    body.contribution_type = payload.type.toLowerCase() === "automatic" ? "automatic" : "manual";
  }
  if (payload.notes !== undefined) body.notes = payload.notes;
  const res = await api.raw.put(`/goal/contributions/${id}`, body);
  return mapContribution(res.data?.data ?? res.data);
}

export async function deleteContribution(id: string) {
  await api.raw.delete(`/goal/contributions/${id}`);
}

/* ── Tracking ─────────────────────────────────────────────────── */

export type TrackingRow = {
  id: string;
  goal: string;
  goalId: string;
  date: string;
  contribution: number;
  currentAmount: number;
  progress: number;
  daysLeft: number;
  projectedDate: string;
  status: "On track" | "Behind" | "Ahead" | "Critical";
};

export const mapTracking = (d: any): TrackingRow => {
  const g = d.goal_id;
  const st = text(d.on_track_status) || "on_track";
  return {
    id: String(d._id),
    goal: typeof g === "object" ? text(g?.goal_name) : "",
    goalId: typeof g === "object" ? text(g?._id) : text(g),
    date: day(d.tracking_date),
    contribution: num(d.contribution_amount),
    currentAmount: num(d.current_amount),
    progress: num(d.progress_percentage),
    daysLeft: num(d.days_remaining),
    projectedDate: day(d.projected_completion_date),
    status: (TRACK_TO_FE[st] as TrackingRow["status"]) || "On track",
  };
};

export async function fetchTracking(params?: GoalListParams) {
  const { rows, pagination } = await listGet<any>("/goal/tracking", params);
  return { rows: rows.map(mapTracking), pagination };
}

export async function createTracking(payload: {
  goalId: string;
  date: string;
  contribution?: number;
  currentAmount?: number;
  progress?: number;
  daysLeft?: number;
  projectedDate?: string;
  status?: string;
}) {
  const res = await api.raw.post("/goal/tracking", {
    goal_id: payload.goalId,
    tracking_date: payload.date,
    contribution_amount: Number(payload.contribution) || 0,
    current_amount: Number(payload.currentAmount) || 0,
    progress_percentage: Number(payload.progress) || 0,
    days_remaining: Number(payload.daysLeft) || 0,
    projected_completion_date: payload.projectedDate || undefined,
    on_track_status: TRACK_TO_BE[payload.status || "On track"] || "on_track",
  });
  return mapTracking(res.data?.data ?? res.data);
}

export async function updateTracking(
  id: string,
  payload: Partial<{
    goalId: string;
    date: string;
    contribution: number;
    currentAmount: number;
    progress: number;
    daysLeft: number;
    projectedDate: string;
    status: string;
  }>,
) {
  const body: Record<string, unknown> = {};
  if (payload.goalId !== undefined) body.goal_id = payload.goalId;
  if (payload.date !== undefined) body.tracking_date = payload.date;
  if (payload.contribution !== undefined) body.contribution_amount = Number(payload.contribution) || 0;
  if (payload.currentAmount !== undefined) body.current_amount = Number(payload.currentAmount) || 0;
  if (payload.progress !== undefined) body.progress_percentage = Number(payload.progress) || 0;
  if (payload.daysLeft !== undefined) body.days_remaining = Number(payload.daysLeft) || 0;
  if (payload.projectedDate !== undefined) body.projected_completion_date = payload.projectedDate || null;
  if (payload.status !== undefined) body.on_track_status = TRACK_TO_BE[payload.status] || payload.status;
  const res = await api.raw.put(`/goal/tracking/${id}`, body);
  return mapTracking(res.data?.data ?? res.data);
}

export async function deleteTracking(id: string) {
  await api.raw.delete(`/goal/tracking/${id}`);
}

/* ── Chart of accounts search helper ──────────────────────────── */

export async function searchGoalAccounts(q: string) {
  const { fetchChartOfAccounts } = await import("./doubleEntry");
  const list = await fetchChartOfAccounts({ page: 1, limit: 30, searchTerm: q || undefined });
  return list.map((a) => ({
    id: String(a._id ?? a.id ?? ""),
    name:
      `${text(a.account_code)}${a.account_name ? " - " + text(a.account_name) : ""}`.trim() ||
      text(a.account_name) ||
      text(a.name),
  }));
}
