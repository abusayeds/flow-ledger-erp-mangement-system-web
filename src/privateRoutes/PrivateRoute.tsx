/**
 * File: src/privateRoutes/PrivateRoute.tsx
 * Route guard. Redirects to the login page when there is no authenticated user.
 *
 * To protect routes, wrap an element with it in the router, e.g.
 *   { element: <PrivateRoute><MainLayout /></PrivateRoute>, children: [...] }
 * or use it per-route. It is intentionally opt-in so the app runs unguarded
 * during development.
 */

import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import useAuth from "../hooks/useAuth";
import Loading from "../components/utils/Loading";

export const PrivateRoute = ({ children }: { children?: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
