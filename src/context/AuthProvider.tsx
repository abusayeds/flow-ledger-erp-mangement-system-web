/**
 * File: src/context/AuthProvider.tsx
 * Provides auth state to the app. Token persistence is delegated to tokenStore
 * so the axios client and this provider always agree on the current token.
 *
 * Backend contract (see Postman "Common > auth"):
 *   POST /user/login       -> { data: { user, token } }
 *   GET  /user/my-profile  -> { data: user }
 *
 * The login response already embeds the user's role + permissions, so we use it
 * directly. On a page reload we only have the token, so we re-fetch the profile
 * to restore the full user (including permissions, which aren't in the JWT).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AuthContext, { type AuthUser } from "./AuthContext";
import type { Role } from "../auth/roles";
import { api, onUnauthorized } from "../lib/api/client";
import { getToken, setToken as persistToken } from "../lib/api/tokenStore";
import { syncAll } from "../lib/db/sync";
import { posOrderStore } from "../lib/db/pos";

const PROFILE_ENDPOINT = "/user/my-profile";
const LOGIN_ENDPOINT = "/user/login";
const GOOGLE_LOGIN_ENDPOINT = "/user/google-login";

/** Normalize the backend user (`_id`) into our AuthUser shape (`id`). */
function normalizeUser(raw: AuthUser): AuthUser {
  return {
    ...raw,
    id: (raw._id as string) ?? raw.id,
    permissions: raw.permissions ?? [],
  };
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState<boolean>(!!getToken());

  const logout = useCallback(() => {
    persistToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getToken()) return;
    try {
      const profile = await api.get<AuthUser>(PROFILE_ENDPOINT);
      setUser(normalizeUser(profile));
    } catch {
      logout();
    }
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string, remember = false): Promise<AuthUser> => {
      const res = await api.post<{ token: string; user: AuthUser }>(
        LOGIN_ENDPOINT,
        { email, password },
      );
      persistToken(res.token, remember);
      setTokenState(res.token);
      const profile = normalizeUser(res.user);
      setUser(profile);
      return profile;
    },
    [],
  );

  const loginWithGoogle = useCallback(
    async (credential: string): Promise<AuthUser> => {
      const res = await api.post<{ token: string; user: AuthUser }>(
        GOOGLE_LOGIN_ENDPOINT,
        { authProvider: "google", credential },
      );
      persistToken(res.token);
      setTokenState(res.token);
      const profile = normalizeUser(res.user);
      setUser(profile);
      return profile;
    },
    [],
  );

  // React to 401s coming from anywhere in the app.
  useEffect(() => {
    onUnauthorized(() => {
      setTokenState(null);
      setUser(null);
    });
  }, []);

  // Background: mirror backend collections into the local datastore whenever a
  // token is present. Purely a data-layer refresh — no UI/flow impact.
  useEffect(() => {
    if (token) {
      void syncAll();
      void posOrderStore.hydrate();
    }
  }, [token]);

  // Restore session on first load.
  useEffect(() => {
    let active = true;
    if (getToken()) {
      refreshProfile().finally(() => active && setLoading(false));
    } else {
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [refreshProfile]);

  const hasPermission = useCallback(
    (permission: string) => !!user?.permissions?.includes(permission),
    [user],
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]) =>
      permissions.some((p) => user?.permissions?.includes(p)),
    [user],
  );

  const hasRole = useCallback(
    (...roles: Array<Role | string>) =>
      !!user?.role && roles.includes(user.role),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user,
      login,
      loginWithGoogle,
      logout,
      setUser,
      refreshProfile,
      hasPermission,
      hasAnyPermission,
      hasRole,
    }),
    [
      user,
      token,
      loading,
      login,
      loginWithGoogle,
      logout,
      refreshProfile,
      hasPermission,
      hasAnyPermission,
      hasRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
