/**
 * File: src/components/layout/TopNav.tsx
 * Main modules in the navbar (replaces the left sidebar):
 *
 *   [Dashboard ▾] [Sales ▾] [Purchases ▾] … as many as fit
 *
 *  - Each module that fits gets its own button + dropdown of its pages.
 *  - Modules that don't fit are reported via `onOverflowChange`; the Header
 *    shows them inside the orange (+) menu (see `ModuleColumns`).
 *  - Fit is measured from a hidden copy of the buttons and recalculated on
 *    resize (ResizeObserver), so wider screens show more modules directly.
 *  - Dropdowns are `position: fixed` under their button; long ones scroll with
 *    a scrollbar that stays hidden until hover.
 *  - While one dropdown is open, hovering another module switches to it.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { hasPages, helpNavItem, useVisibleNavItems, type NavItem } from "./navItems";

const GAP = 4; // px, matches gap-1
const MENU_WIDTH = 240;

/** Column layout of modules + their pages (used by the (+) menu). */
export const ModuleColumns: React.FC<{ groups: NavItem[]; onNavigate?: () => void }> = ({ groups, onNavigate }) => {
  const { pathname } = useLocation();
  return (
    <div className="columns-[210px] gap-x-6">
      {groups.map((g) => {
        const groupActive = !!g.children?.some((c) => c.path === pathname);
        return (
          <section key={g.label} className="break-inside-avoid mb-4">
            <h4
              className={`flex items-center gap-2 px-2.5 pb-1.5 mb-1 text-xs font-semibold uppercase tracking-wide border-b border-gray-200 ${
                groupActive ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <g.icon className="w-3.5 h-3.5" strokeWidth={2} />
              {g.label}
            </h4>
            {g.children?.map((c) => (
              <Link
                key={`${g.label}-${c.label}`}
                to={c.path || "#"}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm ${
                  c.path === pathname ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <c.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{c.label}</span>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
};

export const TopNav: React.FC<{ onOverflowChange?: (items: NavItem[]) => void }> = ({ onOverflowChange }) => {
  const location = useLocation();
  const visible = useVisibleNavItems();
  const items = useMemo(() => [...visible, helpNavItem], [visible]);

  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLElement | null>>({});

  const [fitCount, setFitCount] = useState(items.length);
  const [open, setOpen] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  /* ── how many modules fit ─────────────────────────────────────── */
  const recalc = useCallback(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const widths = (Array.from(measure.children) as HTMLElement[]).map((n) => n.offsetWidth);
    const available = row.clientWidth;
    let used = 0;
    let n = 0;
    while (n < widths.length && used + (n ? GAP : 0) + widths[n] <= available) {
      used += (n ? GAP : 0) + widths[n];
      n++;
    }
    setFitCount(n);
  }, []);

  useLayoutEffect(recalc, [recalc, items]);
  useEffect(() => {
    const ro = new ResizeObserver(recalc);
    if (rowRef.current) ro.observe(rowRef.current);
    if (measureRef.current) ro.observe(measureRef.current); // font load changes widths
    return () => ro.disconnect();
  }, [recalc]);

  const shown = items.slice(0, fitCount);
  const overflow = useMemo(() => items.slice(fitCount), [items, fitCount]);
  const overflowKey = overflow.map((i) => i.label).join("|");
  useEffect(() => {
    onOverflowChange?.(overflow);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report only when the set changes
  }, [overflowKey, onOverflowChange]);

  /* ── active state ─────────────────────────────────────────────── */
  const isActive = (path?: string) => !!path && location.pathname === path;
  const itemActive = (i: NavItem) => isActive(i.path) || !!i.children?.some((c) => isActive(c.path));

  /* ── open / close ─────────────────────────────────────────────── */
  const openMenu = useCallback((id: string) => {
    const btn = buttonRefs.current[id];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8));
    setPos({ left, top: r.bottom + 6 });
    setOpen(id);
  }, []);
  const close = useCallback(() => setOpen(null), []);

  useEffect(close, [location.pathname, close]); // navigating closes
  useEffect(close, [fitCount, close]); // layout changed → anchor moved

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRefs.current[open]?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  /* ── rendering ────────────────────────────────────────────────── */
  const buttonCls = (active: boolean, isOpen: boolean) =>
    `top-nav-item shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-md text-sm whitespace-nowrap transition-colors ${
      active
        ? "is-active bg-blue-600 text-white font-medium shadow-sm"
        : `text-gray-700 hover:bg-gray-100 ${isOpen ? "is-open bg-gray-100" : ""}`
    }`;

  const openItem = open ? shown.find((i) => i.label === open) : null;
  const dropdownLinks = openItem
    ? [...(openItem.path ? [{ ...openItem, children: undefined }] : []), ...(openItem.children || [])]
    : [];

  return (
    <nav className="top-nav relative min-w-0 flex-1 overflow-hidden" aria-label="Main modules">
      {/* Hidden copy of every button — only used to measure widths. */}
      <div
        ref={measureRef}
        aria-hidden
        className="absolute left-0 top-0 w-max flex gap-1 invisible pointer-events-none whitespace-nowrap"
      >
        {items.map((item) => (
          <span key={item.label} className={`${buttonCls(false, false)} font-medium`}>
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
            {hasPages(item) && <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        ))}
      </div>

      <div ref={rowRef} className="flex items-center gap-1 overflow-hidden">
        {shown.map((item) =>
          hasPages(item) ? (
            <button
              key={item.label}
              ref={(el) => {
                buttonRefs.current[item.label] = el;
              }}
              type="button"
              aria-haspopup="menu"
              aria-expanded={open === item.label}
              onClick={() => (open === item.label ? close() : openMenu(item.label))}
              onMouseEnter={() => {
                if (open && open !== item.label) openMenu(item.label);
              }}
              className={buttonCls(itemActive(item), open === item.label)}
            >
              <item.icon className="w-4 h-4" strokeWidth={1.8} />
              <span className="tracking-tight">{item.label}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 opacity-70 transition-transform ${open === item.label ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            </button>
          ) : (
            <Link key={item.label} to={item.path || "#"} className={buttonCls(itemActive(item), false)}>
              <item.icon className="w-4 h-4" strokeWidth={1.8} />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          ),
        )}
      </div>

      {openItem && pos && (
        <div
          ref={panelRef}
          role="menu"
          className="top-nav-dropdown fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5 max-h-[calc(100vh-6rem)] overflow-y-auto hover-scrollbar"
          style={{ left: pos.left, top: pos.top, width: MENU_WIDTH }}
        >
          {dropdownLinks.map((item) => (
            <Link
              key={item.label}
              to={item.path || "#"}
              role="menuitem"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm ${
                isActive(item.path) ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default TopNav;
