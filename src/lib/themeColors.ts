/**
 * File: src/lib/themeColors.ts
 * App Settings → Theme: custom colors for the app buttons, navbar, main module
 * menu (left sidebar), list sidebar and layout background.
 *
 * Each color is "#rrggbb" or "" (= keep the Appearance light/dark default).
 * Colors are applied as one generated <style> element that re-points the same
 * CSS variables index.css uses (blue ramp, --app-bg, gray ramp …), so no
 * component needs per-color logic. Text on a custom background automatically
 * switches to dark or light ink for contrast.
 *
 * Hook classes: `.app-navbar` (Header), `.top-nav-item` / `.top-nav-dropdown`
 * (main module menu in the navbar and its submenus), `.app-list-panel`
 * (ResizableListPanel), `.navbar-keep` (navbar children on their own surface,
 * e.g. the search box), `.is-open` (navbar button whose dropdown is open).
 */

export type ThemeColors = {
  buttonColor: string;
  navbarBg: string;
  sidebarBg: string;
  sidebarActive: string;
  listSidebarBg: string;
  layoutBg: string;
};

export const THEME_COLOR_DEFAULTS: ThemeColors = {
  buttonColor: "",
  navbarBg: "",
  sidebarBg: "",
  sidebarActive: "",
  listSidebarBg: "",
  layoutBg: "",
};

/** UI key ↔ backend `theme.<key>` */
export const THEME_UI_TO_API: Record<keyof ThemeColors, string> = {
  buttonColor: "button_color",
  navbarBg: "navbar_bg",
  sidebarBg: "sidebar_bg",
  sidebarActive: "sidebar_active",
  listSidebarBg: "list_sidebar_bg",
  layoutBg: "layout_bg",
};

/** The built-in color each area uses when no custom color is set (per Appearance). */
export const THEME_COLOR_FALLBACKS: Record<keyof ThemeColors, { dark: string; light: string }> = {
  buttonColor: { dark: "#007aff", light: "#007aff" },
  navbarBg: { dark: "#1a212a", light: "#ffffff" },
  sidebarBg: { dark: "#1a212a", light: "#ffffff" },
  sidebarActive: { dark: "#007aff", light: "#007aff" },
  listSidebarBg: { dark: "#1a212a", light: "#ffffff" },
  layoutBg: { dark: "#12171d", light: "#f4f6f8" },
};

export const THEME_PRESETS: { name: string; colors: ThemeColors }[] = [
  { name: "Default", colors: { ...THEME_COLOR_DEFAULTS } },
  { name: "Ocean", colors: { ...THEME_COLOR_DEFAULTS, buttonColor: "#0ea5e9", navbarBg: "#0c4a6e", sidebarBg: "#082f49", sidebarActive: "#0ea5e9" } },
  { name: "Forest", colors: { ...THEME_COLOR_DEFAULTS, buttonColor: "#16a34a", navbarBg: "#14532d", sidebarBg: "#052e16", sidebarActive: "#16a34a" } },
  { name: "Sunset", colors: { ...THEME_COLOR_DEFAULTS, buttonColor: "#f97316", navbarBg: "#7c2d12", sidebarBg: "#431407", sidebarActive: "#f97316" } },
  { name: "Royal", colors: { ...THEME_COLOR_DEFAULTS, buttonColor: "#7c3aed", navbarBg: "#4c1d95", sidebarBg: "#2e1065", sidebarActive: "#7c3aed" } },
  { name: "Rose", colors: { ...THEME_COLOR_DEFAULTS, buttonColor: "#e11d48", navbarBg: "#881337", sidebarBg: "#4c0519", sidebarActive: "#e11d48" } },
  { name: "Slate", colors: { ...THEME_COLOR_DEFAULTS, buttonColor: "#475569", navbarBg: "#1e293b", sidebarBg: "#0f172a", sidebarActive: "#475569" } },
];

const CACHE_KEY = "qayd_theme_colors";
const STYLE_ID = "qayd-theme-colors";
const HEX = /^#[0-9a-f]{6}$/i;

export const isHexColor = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** Keep only valid keys/values; anything else falls back to "" (default). */
export function normalizeThemeColors(v: any): ThemeColors {
  const out = { ...THEME_COLOR_DEFAULTS };
  if (!v || typeof v !== "object") return out;
  for (const k of Object.keys(out) as (keyof ThemeColors)[]) {
    if (isHexColor(v[k])) out[k] = v[k].toLowerCase();
  }
  return out;
}

/* ── color math ─────────────────────────────────────────────────── */
const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) =>
  "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");

/** Blend `a` toward `b` by `t` (0 = a, 1 = b). */
export const mix = (a: string, b: string, t: number) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((c, i) => c + (y[i] - c) * t));
};

const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const isLightColor = (hex: string) => luminance(hex) > 0.4;

/** Readable text color on top of `bg`. */
export const inkFor = (bg: string) => (isLightColor(bg) ? "#111827" : "#ffffff");

/* ── CSS generation ─────────────────────────────────────────────── */
// `html:root[...]` out-ranks index.css's `:root[data-qayd-theme="light"]` blocks.
const ROOT = "html:root[data-qayd-theme]";
const DARK = 'html:root[data-qayd-theme="dark"]';
const LIGHT = 'html:root[data-qayd-theme="light"]';
const RAMP_STEPS: [number, number][] = [
  [50, 0.04], [100, 0.07], [200, 0.12], [300, 0.2], [400, 0.45],
  [500, 0.55], [600, 0.68], [700, 0.78], [800, 0.88], [900, 0.95],
];

/** Gray / base / slate ramps for a surface of color `bg`, so every
 *  `text-gray-* / bg-gray-* / border-*` utility inside stays readable. */
const surfaceVars = (bg: string, accent: string) => {
  const ink = isLightColor(bg) ? "#111827" : "#f2f4f6";
  const v: string[] = [
    `--surface: ${bg}`,
    `--surface-2: ${mix(bg, ink, 0.05)}`,
    `color-scheme: ${isLightColor(bg) ? "light" : "dark"}`,
    `--color-blue-50: ${mix(bg, accent, 0.12)}`,
    `--color-blue-100: ${mix(bg, accent, 0.2)}`,
  ];
  for (const [step, t] of RAMP_STEPS) {
    v.push(`--color-gray-${step}: ${mix(bg, ink, t)}`);
    v.push(`--color-slate-${step}: ${mix(bg, ink, t)}`);
    v.push(`--color-base-${step}: ${step === 100 ? bg : mix(bg, ink, t)}`);
  }
  return v.join("; ");
};

export function buildThemeColorsCss(c: ThemeColors): string {
  const css: string[] = [];
  const accent = c.buttonColor || "#007aff";

  if (c.buttonColor) {
    const b = c.buttonColor;
    const fg = inkFor(b);
    css.push(`${ROOT} {
  --color-blue-400: ${mix(b, "#ffffff", 0.2)}; --color-blue-500: ${b}; --color-blue-600: ${b};
  --color-primary: ${b}; --color-primary-dark: ${mix(b, "#000000", 0.2)}; --color-info: ${b};
  --themeColor: ${b}; --themeText: ${b}; --brandColor: ${b}; --bgBlue: ${b}; --linkColor: ${b};
  --iconColorPrimary: ${b}; --themeButton: ${b}; --themeActiveBorder: ${b}; --tabActiveBlue: ${b};
  --sidebarActiveBG: ${b};
}
${DARK} {
  --color-blue-50: ${mix("#1a212a", b, 0.18)}; --color-blue-100: ${mix("#1a212a", b, 0.28)};
  --color-blue-200: ${mix("#1a212a", b, 0.45)}; --color-blue-300: ${mix("#1a212a", b, 0.7)};
  --color-blue-700: ${mix(b, "#ffffff", 0.2)}; --color-blue-800: ${mix(b, "#ffffff", 0.4)};
  --color-blue-900: ${mix(b, "#ffffff", 0.6)};
}
${LIGHT} {
  --color-blue-50: ${mix("#ffffff", b, 0.08)}; --color-blue-100: ${mix("#ffffff", b, 0.16)};
  --color-blue-200: ${mix("#ffffff", b, 0.3)}; --color-blue-300: ${mix("#ffffff", b, 0.45)};
  --color-blue-700: ${mix(b, "#000000", 0.15)}; --color-blue-800: ${mix(b, "#000000", 0.3)};
  --color-blue-900: ${mix(b, "#000000", 0.45)};
}
${ROOT} .bg-blue-600.text-white, ${ROOT} .bg-blue-600 .text-white { color: ${fg} !important; }`);
  }

  if (c.navbarBg) {
    const n = c.navbarBg;
    const fg = inkFor(n);
    // Skip children that sit on their own surface: dropdowns, pills, the search box.
    const own = ":not(:is(.shadow-lg, .shadow-xl, .shadow-2xl, .bg-gray-100, .keep-box, .navbar-keep) *)";
    css.push(`${ROOT} .app-navbar.app-navbar { background-color: ${n} !important; border-color: ${mix(n, fg, 0.15)} !important; }
${ROOT} .app-navbar :is(.text-gray-400, .text-gray-500, .text-gray-600, .text-gray-700, .text-gray-800, .text-gray-900)${own} { color: ${fg} !important; }
${ROOT} .app-navbar .hover\\:bg-gray-100${own}:hover,
${ROOT} .app-navbar .is-open${own} { background-color: ${mix(n, fg, 0.12)} !important; }`);
  }

  // Main module menu (navbar TopNav): `sidebarBg` = submenu dropdown surface.
  if (c.sidebarBg) {
    css.push(`${ROOT} .top-nav-dropdown { ${surfaceVars(c.sidebarBg, accent)}; border-color: ${mix(c.sidebarBg, inkFor(c.sidebarBg), 0.15)} !important; }`);
  }

  const active = c.sidebarActive || c.buttonColor;
  if (active) {
    const fg = inkFor(active);
    css.push(`${ROOT} .top-nav-item.is-active,
${ROOT} .top-nav-item.is-active:hover { background-color: ${active} !important; color: ${fg} !important; }`);
  }

  if (c.listSidebarBg) {
    css.push(`${ROOT} .app-list-panel { ${surfaceVars(c.listSidebarBg, accent)}; }`);
  }

  if (c.layoutBg) {
    css.push(`${ROOT} { --app-bg: ${c.layoutBg}; }`);
  }

  return css.join("\n");
}

/** Apply colors now and remember them for the next cold start (pre-paint). */
export function applyThemeColors(value: Partial<ThemeColors> | null | undefined): void {
  if (typeof document === "undefined") return;
  const colors = normalizeThemeColors(value);
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
  }
  el.textContent = buildThemeColorsCss(colors);
  // (Re-)append so it comes after every stylesheet injected so far.
  document.head.appendChild(el);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(colors));
  } catch {
    /* private mode — cache is best-effort */
  }
}

export function applyCachedThemeColors(): void {
  let cached: unknown = null;
  try {
    cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    /* ignore */
  }
  applyThemeColors(cached as Partial<ThemeColors> | null);
}
