/**
 * File: src/lib/db/budget.ts
 * Budget Planner data — periods, budgets, allocations and monitoring
 * snapshots persisted in the Dexie `meta` table (keys `budget:*`), same
 * liveQuery pattern as lib/db/goal.ts.
 */


export interface BudgetPeriod {
  id: string;
  name: string;
  financialYear: string;
  startDate: string;
  endDate: string;
  status: "Draft" | "Active" | "Closed";
  approvedBy: string;
}

export interface BudgetRec {
  id: string;
  name: string;
  period: string; // period name
  type: "Capital" | "Operational";
  amount: number;
  status: "Draft" | "Active" | "Closed";
  approvedBy: string;
}

export interface BudgetAllocation {
  id: string;
  budget: string; // budget name
  account: string;
  allocated: number;
  spent: number;
}

export interface BudgetMonitorRow {
  id: string;
  budget: string;
  date: string;
  allocated: number;
  spent: number;
  variance: number; // percent
}

export const BUDGET_ACCOUNTS = [
  "Cash",
  "Petty Cash",
  "Bank Account - Main",
  "Bank Account - Savings",
  "Bank Account - Payroll",
  "Credit Card - Corporate",
  "Undeposited Funds",
];

export const SEED_BUDGET_PERIODS: BudgetPeriod[] = ([
  ["Q1 2025 Budget", "2025", "2025-01-01", "2025-03-31", "Draft", ""],
  ["Q1 2024 Budget", "2024", "2024-01-01", "2024-03-31", "Closed", "Express Suppliers"],
  ["Q2 2024 Budget", "2024", "2024-04-01", "2024-06-30", "Active", "ABC Corporation"],
  ["Q3 2024 Budget", "2024", "2024-07-01", "2024-09-30", "Active", "Robert Taylor"],
  ["Q4 2024 Budget", "2024", "2024-10-01", "2024-12-31", "Active", "ABC Corporation"],
  ["Annual Budget 2024", "2024", "2024-01-01", "2024-12-31", "Active", "Anthony Walker"],
] as [string, string, string, string, BudgetPeriod["status"], string][]).map(
  ([name, financialYear, startDate, endDate, status, approvedBy], i) => ({
    id: `bp${i + 1}`,
    name, financialYear, startDate, endDate, status, approvedBy,
  }),
);

export const SEED_BUDGETS: BudgetRec[] = ([
  ["Facilities Upgrade", "Q2 2024 Budget", "Capital", 0, "Closed", ""],
  ["Cloud Migration", "Q3 2024 Budget", "Operational", 0, "Draft", ""],
  ["Marketing Budget", "Q1 2024 Budget", "Operational", 50000, "Closed", "Matthew Clark"],
  ["IT Infrastructure", "Q1 2024 Budget", "Capital", 75000, "Closed", "Christopher Lee"],
  ["HR Operations", "Q1 2024 Budget", "Operational", 30000, "Closed", "ABC Corporation"],
  ["Office Supplies", "Q1 2024 Budget", "Operational", 15000, "Closed", "Advanced Materials"],
  ["Research & Development", "Q1 2024 Budget", "Capital", 100000, "Closed", "Emily Davis"],
] as [string, string, BudgetRec["type"], number, BudgetRec["status"], string][]).map(
  ([name, period, type, amount, status, approvedBy], i) => ({
    id: `b${i + 1}`,
    name, period, type, amount, status, approvedBy,
  }),
);

export const SEED_BUDGET_ALLOCATIONS: BudgetAllocation[] = ([
  ["Marketing Budget", "Cash", 20000, 5000],
  ["Marketing Budget", "Petty Cash", 15000, 2500],
  ["Marketing Budget", "Bank Account - Main", 10000, 0],
  ["Marketing Budget", "Bank Account - Savings", 8000, 1200],
  ["Marketing Budget", "Bank Account - Payroll", 12000, 3500],
] as [string, string, number, number][]).map(([budget, account, allocated, spent], i) => ({
  id: `ba${i + 1}`,
  budget, account, allocated, spent,
}));

export const SEED_BUDGET_MONITORING: BudgetMonitorRow[] = ([
  ["Marketing Budget", "2024-05-31", 50000, 50000, 0],
  ["Marketing Budget", "2024-04-30", 50000, 48500, 3],
  ["Marketing Budget", "2024-03-31", 50000, 42000, 10],
  ["Marketing Budget", "2024-02-29", 50000, 25000, 0],
  ["Marketing Budget", "2024-01-31", 50000, 12000, -4],
] as [string, string, number, number, number][]).map(([budget, date, allocated, spent, variance], i) => ({
  id: `bm${i + 1}`,
  budget, date, allocated, spent, variance,
}));

/* ── backend wiring ─────────────────────────────────────────────
 * Mirrors the company-scoped /budget-planner/* backend collections. Monitoring
 * is read-only. Accounts (chart of accounts) back the allocation picker.
 */
import { makeBackendStore } from "./backendStore";

const periodNameToId = new Map<string, string>();
const budgetNameToId = new Map<string, string>();
const accountNameToId = new Map<string, string>();

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const iso = (d?: string) => (d ? new Date(d).toISOString() : undefined);
const day = (d?: string) => (d ? String(d).slice(0, 10) : "");

export const budgetPeriodStore = makeBackendStore<BudgetPeriod>({
  base: "/budget-planner/budget-periods",
  onFetch: (docs) => {
    periodNameToId.clear();
    for (const d of docs) if (d?.period_name) periodNameToId.set(d.period_name, String(d._id));
  },
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.period_name || "",
    financialYear: d.financial_year || "",
    startDate: day(d.start_date),
    endDate: day(d.end_date),
    status: cap(d.status) as BudgetPeriod["status"],
    approvedBy: d.status && d.status !== "draft" ? "Company" : "",
  }),
  toBackend: (p) => ({
    period_name: p.name,
    financial_year: p.financialYear,
    start_date: iso(p.startDate),
    end_date: iso(p.endDate),
    status: (p.status || "Draft").toLowerCase(),
  }),
});

export const budgetStore = makeBackendStore<BudgetRec>({
  base: "/budget-planner/budgets",
  onFetch: (docs) => {
    budgetNameToId.clear();
    for (const d of docs) if (d?.budget_name) budgetNameToId.set(d.budget_name, String(d._id));
  },
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.budget_name || "",
    period: d.period_id?.period_name || "",
    type: cap(d.budget_type) as BudgetRec["type"],
    amount: d.total_budget_amount ?? 0,
    status: cap(d.status) as BudgetRec["status"],
    approvedBy: d.status && d.status !== "draft" ? "Company" : "",
  }),
  toBackend: (b) => ({
    budget_name: b.name,
    period_id: periodNameToId.get(b.period),
    budget_type: (b.type || "Operational").toLowerCase(),
    status: (b.status || "Draft").toLowerCase(),
    // total_budget_amount is computed from allocations on the backend.
  }),
});

export const budgetAllocationStore = makeBackendStore<BudgetAllocation>({
  base: "/budget-planner/budget-allocations",
  onFetch: (docs) => {
    for (const d of docs) {
      if (d?.budget_id?.budget_name) budgetNameToId.set(d.budget_id.budget_name, String(d.budget_id._id));
      if (d?.account_id?.account_name) accountNameToId.set(d.account_id.account_name, String(d.account_id._id));
    }
  },
  toFrontend: (d) => ({
    id: String(d._id),
    budget: d.budget_id?.budget_name || "",
    account: d.account_id?.account_name || "",
    allocated: d.allocated_amount ?? 0,
    spent: d.spent_amount ?? 0,
  }),
  toBackend: (a) => ({
    budget_id: budgetNameToId.get(a.budget),
    account_id: accountNameToId.get(a.account),
    allocated_amount: Number(a.allocated) || 0,
    spent_amount: Number(a.spent) || 0,
  }),
});

export const budgetMonitorStore = makeBackendStore<BudgetMonitorRow>({
  base: "/budget-planner/budget-monitoring",
  toFrontend: (d) => ({
    id: String(d._id),
    budget: d.budget_id?.budget_name || "",
    date: day(d.monitoring_date),
    allocated: d.total_allocated ?? 0,
    spent: d.total_spent ?? 0,
    variance: d.variance_percentage ?? 0,
  }),
  toBackend: () => ({}), // read-only
});

/** Chart-of-accounts names for the allocation picker (also fills accountNameToId). */
export const budgetAccountStore = makeBackendStore<{ id: string; name: string }>({
  base: "/account/chart-of-accounts/all",
  onFetch: (docs) => {
    for (const d of docs) if (d?.account_name) accountNameToId.set(d.account_name, String(d._id));
  },
  toFrontend: (d) => ({ id: String(d._id), name: d.account_name || "" }),
  toBackend: () => ({}), // read-only
});

export const budgetUid = () => Math.random().toString(36).slice(2, 9);
