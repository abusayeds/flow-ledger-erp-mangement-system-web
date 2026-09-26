/**
 * File: src/context/AuthContext.tsx
 * Auth context shape. The provider lives in AuthProvider.tsx.
 */

import { createContext } from "react";
import type { Role } from "../auth/roles";

export interface AuthUser {
  /** Mongo id from the backend (`_id`), exposed as `id` for convenience. */
  id: string;
  _id?: string;
  name?: string;
  email?: string;
  avatar?: string;
  role?: Role | string;
  companyId?: string | null;
  /** Flat list of permission keys granted to this user by the backend. */
  permissions?: string[];
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** `remember`: true persists the session past closing the tab; false (default) signs the user out when the tab closes. */
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  /** Google Identity Services ID token → backend session, same shape as `login`. */
  loginWithGoogle: (credential: string) => Promise<AuthUser>;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
  refreshProfile: () => Promise<void>;
  /** True if the current user holds the given permission key. */
  hasPermission: (permission: string) => boolean;
  /** True if the current user holds at least one of the given permission keys. */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** True if the current user's role matches one of the given roles. */
  hasRole: (...roles: Array<Role | string>) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export default AuthContext;
