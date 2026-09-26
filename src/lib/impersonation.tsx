/**
 * File: src/lib/impersonation.tsx
 * Super-admin "view as tenant" support. When the app is opened with an
 * `?impersonate_token=<jwt>` query param (from the Super Admin panel), we store
 * that token as the auth token and remember we're in a read-only impersonation
 * session, then show a floating banner with an Exit control. Writes are blocked
 * server-side (the token is read-only), so this is purely a viewing session.
 */
import { createRoot } from "react-dom/client";
import { AUTH_TOKEN_KEY } from "./env";

const FLAG_KEY = "qayd_impersonation";

interface ImpersonationInfo {
  company: string;
  active: boolean;
}

/** Run BEFORE React renders: if a token is in the URL, adopt it + strip the param. */
export function captureImpersonation(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("impersonate_token");
    if (!token) return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(
      FLAG_KEY,
      JSON.stringify({ company: params.get("impersonate_company") || "Tenant", active: true }),
    );
    params.delete("impersonate_token");
    params.delete("impersonate_company");
    const q = params.toString();
    // Hard-reload to the clean URL so the app boots with the token already in
    // place (avoids a first-load auth race). This load stops here; the reload
    // re-runs with no param → falls through and boots authenticated.
    window.location.replace(window.location.pathname + (q ? `?${q}` : ""));
  } catch {
    /* ignore */
  }
}

function getInfo(): ImpersonationInfo | null {
  try {
    const raw = sessionStorage.getItem(FLAG_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw) as ImpersonationInfo;
    return info?.active ? info : null;
  } catch {
    return null;
  }
}

function exitImpersonation(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* ignore */
  }
  // Try to close the tab (it was opened by the admin panel); fall back to a reload.
  window.close();
  window.location.replace("/");
}

function Banner() {
  const info = getInfo();
  if (!info) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        borderRadius: 9999,
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid #f59e0b",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        fontSize: 13,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <span style={{ color: "#f59e0b" }}>👁</span>
      <span>
        Viewing as <strong style={{ color: "#fff" }}>{info.company}</strong>
        <span style={{ color: "#94a3b8" }}> · read-only</span>
      </span>
      <button
        onClick={exitImpersonation}
        style={{
          marginLeft: 4,
          padding: "3px 12px",
          borderRadius: 9999,
          background: "#f59e0b",
          color: "#1e293b",
          border: "none",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Exit
      </button>
    </div>
  );
}

/** Mount the floating banner into its own root so it never touches the app tree. */
export function mountImpersonationBanner(): void {
  if (!getInfo()) return;
  const host = document.createElement("div");
  host.id = "impersonation-banner";
  document.body.appendChild(host);
  createRoot(host).render(<Banner />);
}
