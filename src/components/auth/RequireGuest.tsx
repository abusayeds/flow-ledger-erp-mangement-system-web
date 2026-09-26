/**
 * File: src/components/auth/RequireGuest.tsx
 * Route guard for auth pages (login, signup, …): if the user is already
 * authenticated, send them to the dashboard instead of showing the form.
 *
 * Counterpart to PrivateRoute, which guards the dashboard.
 */

import { Navigate } from "react-router";
import type { ReactNode } from "react";
import useAuth from "../../hooks/useAuth";
import Loading from "../utils/Loading";

export const RequireGuest = ({ children }: { children?: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Loading />;

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default RequireGuest;
