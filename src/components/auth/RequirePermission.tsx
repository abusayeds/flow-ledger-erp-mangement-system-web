/**
 * File: src/components/auth/RequirePermission.tsx
 * Fine-grained guard for permission/role-gated UI.
 *
 * Use it to wrap a route element or any block of UI that should only render for
 * users holding a given permission (or one of a set) and/or role. For now the
 * whole dashboard is open to every authenticated user — this component is the
 * hook we'll use to differentiate access later, per the permissions list that
 * comes back in the login response.
 *
 * Examples:
 *   <RequirePermission permission="manage_users"><UsersPage /></RequirePermission>
 *   <RequirePermission anyOf={["view_reports", "manage_reports"]} fallback={<NoAccess />}>
 *     <Reports />
 *   </RequirePermission>
 */

import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import type { Role } from "../../auth/roles";

interface RequirePermissionProps {
  children: React.ReactNode;
  /** Single permission key the user must have. */
  permission?: string;
  /** User must hold at least one of these permission keys. */
  anyOf?: string[];
  /** Restrict to specific roles (in addition to / instead of permissions). */
  roles?: Array<Role | string>;
  /** What to render when access is denied. Defaults to redirecting home. */
  fallback?: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  children,
  permission,
  anyOf,
  roles,
  fallback,
}) => {
  const { hasPermission, hasAnyPermission, hasRole } = useAuth();

  const passesPermission =
    (!permission || hasPermission(permission)) &&
    (!anyOf || hasAnyPermission(anyOf));
  const passesRole = !roles || hasRole(...roles);

  if (passesPermission && passesRole) {
    return <>{children}</>;
  }

  return <>{fallback ?? <Navigate to="/dashboard" replace />}</>;
};

export default RequirePermission;
