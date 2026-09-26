/**
 * File: src/lib/db/goal.ts
 * Goal module data — goals, categories, milestones, contributions and
 * tracking entries persisted in the Dexie `meta` table (no schema bump),
 * same liveQuery pattern as lib/db/hrm.ts. Keys:
 *   goal:goals / goal:categories / goal:milestones /
 *   goal:contributions / goal:tracking
 */

/* ── types ─────────────────────────────────────────────────────── */

export interface GoalCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
}

export interface GoalRec {
  id: string;
  name: string;
  category: string;
  type: string; // savings | expense reduction | debt reduction
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  targetDate: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Active" | "Draft" | "Completed";
  chartOfAccount: string;
  description: string;
}

export interface GoalMilestone {
  id: string;
  goal: string; // goal name
  name: string;
  targetAmount: number;
  achievedAmount: number;
  achievedDate: string; // "" when pending
  targetDate: string;
  status: "Achieved" | "Pending";
  description?: string;
}

export interface GoalContribution {
  id: string;
  goal: string;
  date: string;
  amount: number;
  type: "Manual" | "Automatic";
  notes: string;
}

export interface GoalTracking {
  id: string;
  goal: string;
  date: string;
  contribution: number;
  currentAmount: number;
  progress: number; // percent
  daysLeft: number;
  projectedDate?: string;
  status: "On track" | "Behind" | "Ahead";
}

/* ── option catalogs ───────────────────────────────────────────── */

export const GOAL_TYPES = ["savings", "expense reduction", "debt reduction"];
export const GOAL_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const CHART_OF_ACCOUNTS = [
  "1000 - Cash",
  "1050 - Bank Account - Savings",
  "1100 - Bank Account - Checking",
  "1200 - Accounts Receivable",
  "2300 - Short-term Loans",
  "2350 - Customer Deposits",
  "2400 - Payroll Liabilities",
  "2500 - Long-term Debt",
  "3100 - Share Capital",
  "3200 - Retained Earnings",
  "4010 - Product Sales",
  "4030 - Consulting Revenue",
  "4040 - Subscription Revenue",
  "4100 - Sales Revenue",
  "4110 - Commission Income",
  "4120 - Rental Income",
  "4130 - Maintenance Income",
  "4140 - Training Income",
  "4200 - Service Revenue",
  "4300 - Other Income",
  "4400 - Project Revenue",
];

/* ── seeds (mirror the ERPGO reference data) ───────────────────── */

export const SEED_GOAL_CATEGORIES: GoalCategory[] = ([
  ["Personal Development", "PERSONAL_DEV", "Goals focused on self-improvement and skill development", true],
  ["Career Growth", "CAREER", "Professional advancement and career-related objectives", true],
  ["Health & Fitness", "HEALTH", "Physical and mental wellness goals", true],
  ["Financial", "FINANCE", "Money management and financial planning goals", true],
  ["Education", "EDUCATION", "Learning and educational achievement goals", true],
  ["Business", "BUSINESS", "Business development and entrepreneurial goals", true],
  ["Relationships", "RELATIONSHIPS", "Social connections and relationship building goals", false],
  ["Creative", "CREATIVE", "Artistic and creative expression goals", false],
  ["Travel", "TRAVEL", "Travel and exploration objectives", true],
  ["Community", "COMMUNITY", "Community service and social impact goals", true],
  ["Technology", "TECH", "Technology adoption and digital transformation goals", true],
] as [string, string, string, boolean][]).map(([name, code, description, active], i) => ({
  id: `gc${i + 1}`,
  name, code, description, active,
}));

export const SEED_GOALS: GoalRec[] = ([
  ["Emergency Fund", "Financial", "savings", 50000, 15000, "2024-01-01", "2024-12-31", "High", "Active", "1050 - Bank Account - Savings", "Build a six-month emergency fund."],
  ["Investment Portfolio", "Financial", "expense reduction", 100000, 25000, "2024-02-01", "2025-02-01", "Medium", "Active", "1100 - Bank Account - Checking", "Grow the long-term investment portfolio."],
  ["Credit Card Debt", "Financial", "debt reduction", 8000, 3000, "2024-01-15", "2024-08-15", "Critical", "Active", "2300 - Short-term Loans", "Pay off outstanding credit card balances."],
  ["Annual Revenue Target", "Financial", "expense reduction", 500000, 125000, "2024-01-01", "2024-12-31", "High", "Draft", "4100 - Sales Revenue", "Hit the annual company revenue target."],
  ["Operational Cost Reduction", "Financial", "savings", 12000, 4000, "2024-03-01", "2024-09-01", "Medium", "Active", "4300 - Other Income", "Reduce recurring operational costs."],
  ["Vacation Fund", "Financial", "savings", 15000, 8000, "2024-01-01", "2024-06-30", "Low", "Draft", "", "Save money for a family vacation to Europe"],
  ["Retirement Savings", "Financial", "savings", 200000, 45000, "2024-01-01", "2026-12-31", "High", "Active", "1050 - Bank Account - Savings", "Long-term retirement savings plan."],
  ["Home Down Payment", "Financial", "savings", 80000, 20000, "2024-06-01", "2025-06-30", "High", "Draft", "1050 - Bank Account - Savings", "Save for a house down payment."],
  ["Student Loan Payoff", "Financial", "debt reduction", 25000, 10000, "2024-01-01", "2025-12-31", "Medium", "Active", "2500 - Long-term Debt", "Pay off the remaining student loan."],
  ["Business Expansion", "Business", "savings", 150000, 30000, "2025-01-01", "2026-06-30", "Medium", "Active", "4400 - Project Revenue", "Fund the new branch opening."],
  ["Health & Wellness Fund", "Health & Fitness", "savings", 6000, 1200, "2025-05-01", "2026-05-01", "Low", "Active", "1000 - Cash", "Gym, checkups and wellness budget."],
] as [string, string, string, number, number, string, string, GoalRec["priority"], GoalRec["status"], string, string][]).map(
  ([name, category, type, targetAmount, currentAmount, startDate, targetDate, priority, status, chartOfAccount, description], i) => ({
    id: `g${i + 1}`,
    name, category, type, targetAmount, currentAmount, startDate, targetDate, priority, status, chartOfAccount, description,
  }),
);

export const SEED_GOAL_MILESTONES: GoalMilestone[] = ([
  ["Investment Portfolio", "First Quarter Target", 25000, 22000, "2026-01-14", "2026-04-19", "Achieved"],
  ["Credit Card Debt", "Mid-Year Milestone", 50000, 0, "", "2026-07-19", "Pending"],
  ["Operational Cost Reduction", "Third Quarter Goal", 75000, 0, "", "2026-10-19", "Pending"],
  ["Retirement Savings", "Year-End Target", 100000, 0, "", "2027-01-19", "Pending"],
  ["Student Loan Payoff", "Emergency Fund Setup", 5000, 5000, "2025-12-19", "2025-11-19", "Achieved"],
  ["Investment Portfolio", "Investment Portfolio", 15000, 15000, "2025-12-25", "2025-12-20", "Achieved"],
] as [string, string, number, number, string, string, GoalMilestone["status"]][]).map(
  ([goal, name, targetAmount, achievedAmount, achievedDate, targetDate, status], i) => ({
    id: `gm${i + 1}`,
    goal, name, targetAmount, achievedAmount, achievedDate, targetDate, status,
    description: "",
  }),
);

export const SEED_GOAL_CONTRIBUTIONS: GoalContribution[] = ([
  ["Investment Portfolio", "2025-12-20", 5000, "Manual", "Initial contribution to start the goal"],
  ["Credit Card Debt", "2025-12-25", 2500, "Automatic", "Monthly automatic transfer"],
  ["Operational Cost Reduction", "2025-12-30", 1000, "Automatic", "Bonus allocation from quarterly performance"],
  ["Retirement Savings", "2026-01-04", 3000, "Manual", "Additional contribution from savings"],
  ["Student Loan Payoff", "2026-01-09", 1500, "Automatic", "Scheduled monthly contribution"],
  ["Investment Portfolio", "2026-01-14", 750, "Manual", "Weekend side income contribution"],
  ["Credit Card Debt", "2026-01-17", 2000, "Automatic", "Investment return allocation"],
  ["Operational Cost Reduction", "2026-01-19", 500, "Automatic", "Daily savings plan contribution"],
] as [string, string, number, GoalContribution["type"], string][]).map(
  ([goal, date, amount, type, notes], i) => ({ id: `gco${i + 1}`, goal, date, amount, type, notes }),
);

export const SEED_GOAL_TRACKING: GoalTracking[] = ([
  ["Investment Portfolio", "2025-12-20", 5000, 5000, 5, 335, "Behind"],
  ["Credit Card Debt", "2025-12-25", 2500, 7500, 7.5, 330, "Behind"],
  ["Operational Cost Reduction", "2025-12-30", 1000, 8500, 8.5, 325, "On track"],
  ["Retirement Savings", "2026-01-04", 3000, 11500, 11.5, 320, "On track"],
  ["Student Loan Payoff", "2026-01-09", 1500, 13000, 13, 315, "On track"],
  ["Investment Portfolio", "2026-01-14", 750, 13750, 13.75, 310, "Ahead"],
  ["Credit Card Debt", "2026-01-17", 2000, 15750, 15.75, 307, "Ahead"],
  ["Operational Cost Reduction", "2026-01-19", 500, 16250, 16.25, 305, "Ahead"],
  ["Emergency Fund", "2026-02-01", 1000, 17250, 17.25, 300, "On track"],
] as [string, string, number, number, number, number, GoalTracking["status"]][]).map(
  ([goal, date, contribution, currentAmount, progress, daysLeft, status], i) => ({
    id: `gt${i + 1}`,
    goal, date, contribution, currentAmount, progress, daysLeft, status,
    projectedDate: "",
  }),
);

/* ── backend wiring ─────────────────────────────────────────────
 * The five stores now mirror the company-scoped /goal/* backend collections
 * instead of a local seed. Field mapping + enum translation live here; the
 * pages keep calling `store.use()` / `store.save(list)` unchanged.
 */

import { makeBackendStore } from "./backendStore";

/* Reference lookups populated on each fetch, so writes can resolve a
 * category / goal NAME (what the pages hold) back to its backend `_id`. */
const catNameToId = new Map<string, string>();
const goalNameToId = new Map<string, string>();

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const iso = (d?: string) => (d ? new Date(d).toISOString() : undefined);
const day = (d?: string) => (d ? String(d).slice(0, 10) : "");

const TYPE_TO_BE: Record<string, string> = {
  savings: "savings",
  "expense reduction": "expense_reduction",
  "debt reduction": "debt_reduction",
};
const TYPE_TO_FE: Record<string, string> = {
  savings: "savings",
  expense_reduction: "expense reduction",
  debt_reduction: "debt reduction",
};

export const goalCategoryStore = makeBackendStore<GoalCategory>({
  base: "/goal/categories",
  onFetch: (docs) => {
    catNameToId.clear();
    for (const d of docs) if (d?.category_name) catNameToId.set(d.category_name, String(d._id));
  },
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.category_name || "",
    code: d.category_code || "",
    description: d.description || "",
    active: d.is_active !== false,
  }),
  toBackend: (c) => ({
    category_name: c.name,
    category_code: c.code,
    description: c.description,
    is_active: c.active,
  }),
});

export const goalStore = makeBackendStore<GoalRec>({
  base: "/goal/goals",
  onFetch: (docs) => {
    goalNameToId.clear();
    for (const d of docs) if (d?.goal_name) goalNameToId.set(d.goal_name, String(d._id));
  },
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.goal_name || "",
    category: d.category_id?.category_name || "",
    type: TYPE_TO_FE[d.goal_type] || d.goal_type || "savings",
    targetAmount: d.target_amount ?? 0,
    currentAmount: d.current_amount ?? 0,
    startDate: day(d.start_date),
    targetDate: day(d.target_date),
    priority: cap(d.priority) as GoalRec["priority"],
    status: cap(d.status) as GoalRec["status"],
    chartOfAccount: d.account_id
      ? `${d.account_id.account_code || ""}${d.account_id.account_name ? " - " + d.account_id.account_name : ""}`.trim()
      : "",
    description: d.goal_description || "",
  }),
  toBackend: (g) => ({
    goal_name: g.name,
    category_id: catNameToId.get(g.category),
    goal_type: TYPE_TO_BE[g.type] || "savings",
    target_amount: Number(g.targetAmount) || 0,
    current_amount: Number(g.currentAmount) || 0,
    start_date: iso(g.startDate),
    target_date: iso(g.targetDate),
    priority: (g.priority || "Medium").toLowerCase(),
    status: (g.status || "Draft").toLowerCase(),
    goal_description: g.description || "",
    // account_id (chart of accounts) is optional on the backend — left unset.
  }),
});

export const goalMilestoneStore = makeBackendStore<GoalMilestone>({
  base: "/goal/milestones",
  toFrontend: (d) => ({
    id: String(d._id),
    goal: d.goal_id?.goal_name || "",
    name: d.milestone_name || "",
    targetAmount: d.target_amount ?? 0,
    achievedAmount: d.achieved_amount ?? 0,
    achievedDate: day(d.achieved_date),
    targetDate: day(d.target_date),
    status: d.status === "achieved" ? "Achieved" : "Pending",
    description: d.description || "",
  }),
  toBackend: (m) => ({
    goal_id: goalNameToId.get(m.goal),
    milestone_name: m.name,
    target_amount: Number(m.targetAmount) || 0,
    achieved_amount: Number(m.achievedAmount) || 0,
    achieved_date: iso(m.achievedDate),
    target_date: iso(m.targetDate),
    status: (m.status || "Pending").toLowerCase(),
    description: m.description || "",
  }),
});

export const goalContributionStore = makeBackendStore<GoalContribution>({
  base: "/goal/contributions",
  toFrontend: (d) => ({
    id: String(d._id),
    goal: d.goal_id?.goal_name || "",
    date: day(d.contribution_date),
    amount: d.contribution_amount ?? 0,
    type: d.contribution_type === "automatic" ? "Automatic" : "Manual",
    notes: d.notes || "",
  }),
  toBackend: (c) => ({
    goal_id: goalNameToId.get(c.goal),
    contribution_date: iso(c.date),
    contribution_amount: Number(c.amount) || 0,
    contribution_type: (c.type || "Manual").toLowerCase(),
    notes: c.notes || "",
  }),
});

export const goalTrackingStore = makeBackendStore<GoalTracking>({
  base: "/goal/tracking",
  toFrontend: (d) => ({
    id: String(d._id),
    goal: d.goal_id?.goal_name || "",
    date: day(d.tracking_date),
    contribution: d.contribution_amount ?? 0,
    currentAmount: d.current_amount ?? 0,
    progress: d.progress_percentage ?? 0,
    daysLeft: d.days_remaining ?? 0,
    projectedDate: day(d.projected_completion_date),
    status:
      d.status === "ahead" ? "Ahead" : d.status === "behind" ? "Behind" : "On track",
  }),
  toBackend: (t) => ({
    goal_id: goalNameToId.get(t.goal),
    tracking_date: iso(t.date),
    contribution_amount: Number(t.contribution) || 0,
    current_amount: Number(t.currentAmount) || 0,
    progress_percentage: Number(t.progress) || 0,
    days_remaining: Number(t.daysLeft) || 0,
    status: (t.status || "On track").toLowerCase().replace(" ", "_"),
  }),
});

export const goalUid = () => Math.random().toString(36).slice(2, 9);
