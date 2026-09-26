/**
 * File: src/lib/env.ts
 * Centralized, typed access to environment variables.
 *
 * Vite bakes `VITE_*` at BUILD time — change env → rebuild → redeploy dist.
 */

const stripSlash = (s: string) => s.replace(/\/$/, "");

/** If API URL is absolute, derive the backend origin (for /files images). */
const originFromApiUrl = (api?: string): string => {
  const raw = String(api || "").trim();
  if (!raw || raw.startsWith("/")) return "";
  try {
    const u = new URL(raw);
    return stripSlash(`${u.protocol}//${u.host}`);
  } catch {
    return "";
  }
};

const isLocalHost = (host: string) =>
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host) ||
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host);

/**
 * Backend origin for static uploads (`/files/...`).
 * Priority: VITE_BACKEND_BASE → absolute VITE_API_BASE_URL origin →
 * (dev) localhost → (prod) same page origin (nginx /files proxy) — never localhost in prod.
 */
const resolveBackendBase = (): string => {
  const fromEnv = stripSlash(import.meta.env.VITE_BACKEND_BASE || "");
  if (fromEnv && !isLocalHost(fromEnv)) return fromEnv;
  if (fromEnv && import.meta.env.DEV) return fromEnv;

  const fromApi = originFromApiUrl(import.meta.env.VITE_API_BASE_URL);
  if (fromApi && !isLocalHost(fromApi)) return fromApi;

  if (import.meta.env.DEV) return fromEnv || "http://localhost:5500";

  // Prod without env: use current site origin (expects /files proxied), not a hardcoded host.
  if (typeof window !== "undefined" && window.location?.origin) {
    return stripSlash(window.location.origin);
  }
  return "";
};

export const BACKEND_BASE_URL: string = resolveBackendBase();

/** Fully-qualified REST API base URL, e.g. http://localhost:5500/api/v1 */
export const API_BASE_URL: string =
  stripSlash(import.meta.env.VITE_API_BASE_URL || "") ||
  `${BACKEND_BASE_URL || "http://localhost:5500"}/api/v1`;

/** localStorage key used to persist the auth token. */
export const AUTH_TOKEN_KEY: string =
  import.meta.env.VITE_AUTH_TOKEN_KEY || "qayd_token";

/** Whether we are running a production build. */
export const IS_PROD: boolean = import.meta.env.PROD;

/**
 * Turn a stored upload path into a browser-loadable URL.
 * - data:/blob: → as-is
 * - http(s) → rewrite localhost → BACKEND_BASE_URL; else as-is
 * - Dev: root-relative `/files/...` (Vite proxies /files)
 * - Prod: absolute `${BACKEND_BASE_URL}/files/...`, or same-origin `/files` if base empty
 */
export function resolveMediaUrl(value: unknown): string {
  const src = String(value ?? "").trim();
  if (!src) return "";
  if (/^(data:|blob:)/i.test(src)) return src;

  const base = resolveBackendBase();

  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      if (isLocalHost(u.hostname) && base) {
        return `${base}${u.pathname}${u.search}`;
      }
      // Upload sometimes stores backend-relative absolute URL with wrong tunnel host —
      // if path is /files/..., prefer configured backend origin in prod.
      if (
        import.meta.env.PROD &&
        base &&
        u.pathname.startsWith("/files/") &&
        stripSlash(`${u.protocol}//${u.host}`) !== base
      ) {
        // Keep cross-backend URLs that are already on the configured host; rewrite others only when env base is set via VITE_BACKEND_BASE
        const envBase = stripSlash(import.meta.env.VITE_BACKEND_BASE || "");
        if (envBase && !isLocalHost(envBase)) {
          return `${envBase}${u.pathname}${u.search}`;
        }
      }
      return src;
    } catch {
      return src;
    }
  }

  const pathPart = src.startsWith("/") ? src : `/${src.replace(/^\/+/, "")}`;
  if (import.meta.env.DEV || !base) return pathPart;
  return `${base}${pathPart}`;
}

export const env = {
  BACKEND_BASE_URL,
  API_BASE_URL,
  AUTH_TOKEN_KEY,
  IS_PROD,
  resolveMediaUrl,
};

export default env;
