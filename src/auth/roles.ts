/**
 * File: src/auth/roles.ts
 * Central definition of the application roles.
 *
 * The backend is the source of truth for a user's role and permissions (both
 * arrive in the login / my-profile response). These constants exist so the UI
 * can reference roles type-safely and render role-based guards consistently.
 */

export const ROLES = {
  SUPERADMIN: "superadmin",
  COMPANY: "company",
  /** Backend role value is `customer` (legacy `client` still accepted server-side). */
  CUSTOMER: "customer",
  STAFF: "staff",
  VENDOR: "vendor",
  HR: "hr",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Human-friendly labels for each role. */
export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPERADMIN]: "Super Admin",
  [ROLES.COMPANY]: "Company",
  [ROLES.CUSTOMER]: "Customer",
  [ROLES.STAFF]: "Staff",
  [ROLES.VENDOR]: "Vendor",
  [ROLES.HR]: "HR",
};

/** Where a user lands right after login, based on role. */
export function getPostLoginRedirect(role?: Role | string | null): string {
  if (role === ROLES.SUPERADMIN) return "/superadmin/companies";
  return "/dashboard";
}
