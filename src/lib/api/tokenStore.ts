/**
 * File: src/lib/api/tokenStore.ts
 * Single source of truth for the auth token.
 *
 * Persists to either localStorage ("Remember me" — survives closing the tab
 * and reopening the browser) or sessionStorage (default — cleared as soon as
 * the tab is closed, so the user is signed out automatically), and notifies
 * subscribers (e.g. the AuthProvider and the axios interceptor) when the
 * token changes. Keeping this separate from the API client avoids a circular
 * dependency between the client and auth context.
 */

import { AUTH_TOKEN_KEY } from "../env";

type Listener = (token: string | null) => void;

let currentToken: string | null = readInitial();
const listeners = new Set<Listener>();

function readInitial(): string | null {
  try {
    // sessionStorage wins if both happen to be set (shouldn't normally happen —
    // setToken always clears the other one first).
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return currentToken;
}

/**
 * @param remember When true, persist across tab/browser close (localStorage).
 *   When false (default), the session ends — and the user is logged out —
 *   as soon as the tab is closed (sessionStorage). Ignored when clearing the
 *   token (`token === null`), which always clears both.
 */
export function setToken(token: string | null, remember = false): void {
  currentToken = token;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    if (token) {
      (remember ? localStorage : sessionStorage).setItem(AUTH_TOKEN_KEY, token);
    }
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
  listeners.forEach((l) => l(token));
}

export function clearToken(): void {
  setToken(null);
}

/** Subscribe to token changes. Returns an unsubscribe function. */
export function onTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
