/**
 * File: src/services/budgetPlanner.ts
 * Budget Planner module: budget periods, budgets, allocations, monitoring.
 * Routes are non-conventional (PUT updates + approve/active/close actions).
 */

import { createResourceHooks } from "@/hooks/useResource";
import type { Entity } from "@/lib/api/types";
import { makeResource, postJson, getList } from "./_http";

const BASE = "/budget-planner";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BudgetStatus = "draft" | "approved" | "active" | "closed";

export interface BudgetPeriod extends Entity {
  period_name: string;
  financial_year: string;
  start_date: string;
  end_date: string;
  status: BudgetStatus;
  approved_by?: string | { name?: string } | null;
  createdAt?: string;
}

export type BudgetType = "operational" | "capital" | "cash_flow";

export interface Budget extends Entity {
  budget_name: string;
  period_id: string | { _id?: string; period_name?: string };
  budget_type: BudgetType;
  status?: BudgetStatus;
  createdAt?: string;
}

export interface BudgetAllocation extends Entity {
  budget_id: string | { _id?: string; budget_name?: string };
  account_id: string | { _id?: string; name?: string; account_name?: string };
  allocated_amount: number;
  spent_amount?: number;
  createdAt?: string;
}

export interface BudgetMonitoringRow extends Entity {
  budget_id?: string | { _id?: string; budget_name?: string };
  account_id?: string | { _id?: string; name?: string };
  allocated_amount?: number;
  spent_amount?: number;
  remaining_amount?: number;
  utilization_percentage?: number;
}

// ─── Services ───────────────────────────────────────────────────────────────

export const budgetPeriodsService = makeResource<BudgetPeriod>({
  list: `${BASE}/budget-periods`,
  updateMethod: "put",
});

export const budgetsService = makeResource<Budget>({
  list: `${BASE}/budgets`,
  updateMethod: "put",
});

export const budgetAllocationsService = makeResource<BudgetAllocation>({
  list: `${BASE}/budget-allocations`,
  updateMethod: "put",
});

export const budgetMonitoringService = makeResource<BudgetMonitoringRow>({
  list: `${BASE}/budget-monitoring`,
});

// ─── Hooks ──────────────────────────────────────────────────────────────────

export const budgetPeriodHooks = createResourceHooks("budget-periods", budgetPeriodsService);
export const budgetHooks = createResourceHooks("budgets", budgetsService);
export const budgetAllocationHooks = createResourceHooks("budget-allocations", budgetAllocationsService);
export const budgetMonitoringHooks = createResourceHooks("budget-monitoring", budgetMonitoringService);

// ─── Lifecycle actions (approve / activate / close) ─────────────────────────

export const budgetPeriodActions = {
  approve: (id: string) => postJson(`${BASE}/budget-periods/approve/${id}`),
  active: (id: string) => postJson(`${BASE}/budget-periods/active/${id}`),
  close: (id: string) => postJson(`${BASE}/budget-periods/close/${id}`),
};

export const budgetActions = {
  approve: (id: string) => postJson(`${BASE}/budgets/approve/${id}`),
  active: (id: string) => postJson(`${BASE}/budgets/active/${id}`),
  close: (id: string) => postJson(`${BASE}/budgets/close/${id}`),
};

/** Allocations filtered by budget/account (used by the monitoring & detail views). */
export const fetchAllocations = (params?: { budget_id?: string; account_id?: string; page?: number; limit?: number }) =>
  getList<BudgetAllocation>(`${BASE}/budget-allocations`, params);
