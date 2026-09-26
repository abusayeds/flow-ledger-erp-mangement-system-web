/**
 * File: src/lib/theme.ts
 * Applies the App Settings → General "Appearance" value (Auto / Light / Dark)
 * to the document. Dark is the default look; "light" is opt-in via
 * data-qayd-theme="light" on <html> (see index.css). "Auto" follows the OS
 * and re-applies when the system scheme changes.
 *
 * Uses `data-qayd-theme` (not daisyUI's `data-theme`) so Appearance never
 * fights daisyUI theme variables.
 */

import { getAppSettings } from "./db/appSettings";

export type Appearance = "Auto" | "Light" | "Dark";
const CACHE_KEY = "qayd_appearance";
const ATTR = "data-qayd-theme";

const systemDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

export function resolveTheme(appearance: string): "light" | "dark" {
  if (appearance === "Light") return "light";
  if (appearance === "Dark") return "dark";
  return systemDark() ? "dark" : "light";
}

/** Apply an Appearance value now, and remember it for the next cold start. */
export function applyTheme(appearance: string): void {
  const theme = resolveTheme(appearance);
  const root = document.documentElement;
  root.setAttribute(ATTR, theme);
  // Keep daisyUI on a stable theme so it does not override our gray/blue ramps.
  root.setAttribute("data-theme", "light");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(CACHE_KEY, appearance);
  } catch {
    /* private mode — cache is best-effort */
  }
}

/** Synchronous pre-paint apply from the cached value (avoids a theme flash). */
export function applyCachedTheme(): void {
  let cached = "Dark";
  try {
    cached = localStorage.getItem(CACHE_KEY) || "Dark";
  } catch {
    /* ignore */
  }
  applyTheme(cached);
}

let mqBound = false;
/** Read the persisted Appearance from the datastore, apply it, and keep "Auto"
 *  in sync with the OS scheme. Call once after the datastore is ready. */
export async function initTheme(): Promise<void> {
  try {
    const g = await getAppSettings("general");
    applyTheme(g?.appearance || "Dark");
  } catch {
    applyCachedTheme();
  }
  if (!mqBound && typeof window !== "undefined") {
    mqBound = true;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      let cached = "Dark";
      try {
        cached = localStorage.getItem(CACHE_KEY) || "Dark";
      } catch {
        /* ignore */
      }
      if (cached === "Auto") applyTheme("Auto");
    });
  }
}
