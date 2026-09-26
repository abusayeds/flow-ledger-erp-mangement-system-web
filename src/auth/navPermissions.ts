/**
 * File: src/auth/navPermissions.ts
 * Derives which permission key(s) gate a given sidebar path, from the
 * backend's permission catalog (GET /permission/all-permissions), so the
 * Sidebar can hide menu items the current user's role doesn't have access to.
 *
 * Most sidebar paths already match a catalog `module` value directly (paths
 * and modules are both kebab-case, and permission values follow
 * manage_<module> / view_<module> / manage_any_<module> / manage_own_<module>
 * — see backend utils/permissionModule.ts). Only a handful of paths differ
 * from their catalog module name (plural/singular, renamed, nested) — those
 * are listed in PATH_MODULE_OVERRIDES below.
 *
 * A path with NO matching permission anywhere in the catalog is considered
 * "unmapped" and stays visible to everyone (fail-open) — the catalog doesn't
 * cover every sidebar item yet (e.g. Rewards, Team, Time Logs*), and hiding
 * those for roles that were never given an explicit permission for them
 * would be a regression, not a fix.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

type ApiPermission = { value: string; label: string; module: string };
type ApiModule = { module: string; moduleLabel: string; permissions: ApiPermission[] };
type ApiAddOn = { addOn: string; label: string; packageName: string; modules: ApiModule[] };

/** Sidebar path -> catalog module key, for the paths that don't already match 1:1. */
const PATH_MODULE_OVERRIDES: Record<string, string> = {
  // Sales
  "/sales/sales-invoice": "sales-invoices",
  "/sales/sales-invoice-returns": "sales-return-invoices",
  // Purchases
  "/purchase/expense": "expenses",
  "/purchase/purchase-returns": "purchase-return-invoices",
  // Items
  "/items/product": "product-service-item",
  // HRM
  "/hrm/payslip/payroll": "payrolls",
  "/hrm/documents": "hrm-documents",
  "/hrm/acknowledgements": "acknowledgments",
  // POS
  "/pos/create": "pos",
  "/pos/orders": "pos-orders",
  "/pos/barcode": "pos-barcodes",
  "/pos/reports/sales": "pos-reports",
  "/pos/reports/products": "pos-reports",
  "/pos/reports/customers": "pos-reports",
  // Goal
  "/goal/milestones": "goal-milestones",
  "/goal/contributions": "goal-contributions",
  "/goal/tracking": "goal-tracking",
  "/goal/category": "goal-type",
  // Projects
  "/project/projects": "project",
  "/project/projects-report": "project-report",
  // Budget Planner
  "/budget-planner/budget": "budgets",
  // Double Entry
  "/double-entry/balance-sheet": "balance-sheets",
  // Time Logs
  "/time-logs": "timesheet",
  // Accounting
  "/accounting/revenue": "revenues",
  "/accounting/reports": "account-reports",
  // Support Ticket
  "/support-ticket/tickets": "support-tickets",
  // Performance
  "/performance/performance-indicators": "performance-indicator",
  "/performance/employee-goals": "employee-goal",
  "/performance/employee-reviews": "employee-review",
  "/performance/review-cycles": "review-cycle",
  // Recruitment
  "/recruitment/interview": "interviews",
  "/recruitment/interview-feedback": "interview-feedbacks",
  "/recruitment/candidate-onboarding": "candidate-onboardings",
  // User Management
  "/user-management/user-roles": "roles",
  // Tools & extras
  "/proposal": "sales-proposals",
  "/media-library": "media",
  "/form-builder": "form",
  "/plan": "plans",
};

const snake = (s: string) => s.replace(/-/g, "_");

function lastPathSegment(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** All permission values that exist anywhere in the catalog, flattened. */
function flattenPermissionValues(addOns: ApiAddOn[]): Set<string> {
  const set = new Set<string>();
  for (const addOn of addOns) {
    for (const mod of addOn.modules) {
      for (const perm of mod.permissions) {
        set.add(perm.value);
      }
    }
  }
  return set;
}

/**
 * Candidate permission keys for a sidebar path, filtered to only those that
 * actually exist in the catalog. Empty array = unmapped (always visible).
 */
export function requiredPermissionsForPath(
  path: string | undefined,
  catalogSet: Set<string>,
): string[] {
  if (!path) return [];
  const moduleKey = PATH_MODULE_OVERRIDES[path] ?? lastPathSegment(path);
  const mod = snake(moduleKey);
  const candidates = [
    `manage_${mod}`,
    `view_${mod}`,
    `manage_any_${mod}`,
    `manage_own_${mod}`,
  ];
  return candidates.filter((key) => catalogSet.has(key));
}

/** Fetches + caches the permission catalog as a flat Set of valid permission values. */
export function usePermissionCatalogSet() {
  const query = useQuery({
    queryKey: ["permission", "all-permissions"],
    queryFn: async () => {
      const addOns = await api.get<ApiAddOn[]>("/permission/all-permissions/");
      return flattenPermissionValues(Array.isArray(addOns) ? addOns : []);
    },
    staleTime: 30 * 60_000, // catalog is effectively static
    gcTime: 60 * 60_000,
  });
  return query.data ?? new Set<string>();
}
