/**
 * File: src/main.tsx
 * Vite entry point. Boots the demo datastore (seed/reset) before first paint
 * so every page has real, persisted, interconnected data to read.
 */

import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import App from "./App";
import { bootDemoData } from "./lib/db";
import { applyCachedTheme, initTheme } from "./lib/theme";
import { captureImpersonation, mountImpersonationBanner } from "./lib/impersonation";

// Super-admin "view as tenant": adopt the token from the URL before anything reads it.
captureImpersonation();

// Apply the cached Appearance synchronously (before first paint) to avoid a flash,
// then reconcile from the persisted setting once the datastore is booted.
applyCachedTheme();

const root = ReactDOM.createRoot(document.getElementById("root")!);

bootDemoData().then((res) => {
  void initTheme();
  if (!res.ok) {
    // Visible diagnostic (temporary) — the datastore failed to seed.
    root.render(
      <div style={{ padding: 24, fontFamily: "monospace", color: "#111", background: "#fff", minHeight: "100vh" }}>
        <h2 style={{ color: "#b00" }}>Demo data failed to load</h2>
        <p>customers in DB: <b>{res.count}</b> · stage: <b>{res.stage || "?"}</b></p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12 }}>
          {res.error || "(no error captured)"}
        </pre>
        <p style={{ fontSize: 13, color: "#444" }}>
          Try in the browser console: <code>await window.__nukeDemo()</code> (deletes &amp; reloads), then hard-reload.
          Also restart the dev server (stop &amp; <code>npm run dev</code>).
        </p>
      </div>,
    );
    return;
  }
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  mountImpersonationBanner();
});
