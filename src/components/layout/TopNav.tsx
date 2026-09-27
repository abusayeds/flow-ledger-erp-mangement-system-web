/**
 * File: src/components/layout/TopNav.tsx
 * Main modules in the navbar (replaces the left sidebar):
 *
 *   [Dashboard ▾] [Sales ▾] [Purchases ▾] … as many as fit … [Others ▾]
 *
 *  - Each module that fits gets its own button + dropdown of its pages.
 *  - Modules that don't fit go into one "Others" panel: a column per module,
 *    single-page modules under "More", and a "Search a module or page…" filter
 *    (Enter opens the first match).
 *  - Fit is measured from a hidden copy of the buttons and recalculated on
 *    resize (ResizeObserver), so wider screens show more modules directly.
 *  - Panels are `position: fixed` under their button; long content scrolls
 *    with a scrollbar that stays hidden until hover.
 *  - While one panel is open, hovering another button switches to it.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LayoutGrid, Search } from "lucide-react";
import {
  filterModuleGroups,
  groupModules,
  hasPages,
  helpNavItem,
  useVisibleNavItems,
  type NavItem,
} from "./navItems";

const OTHERS = "__others";
const OTHERS_LABEL = "Others";
const GAP = 4; // px, matches gap-1
const MENU_WIDTH = 240;
const OTHERS_MAX_WIDTH = 900;

export const TopNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const visible = useVisibleNavItems();
  const items = useMemo(() => [...visible, helpNavItem], [visible]);

  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const buttonRefs = useRef<Record<string, HTMLElement | null>>({});

  const [fitCount, setFitCount] = useState(items.length);
  const [open, setOpen] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const [filter, setFilter] = useState("");

  /* ── how many modules fit (leaving room for "Others" when needed) ── */
  const recalc = useCallback(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const nodes = Array.from(measure.children) as HTMLElement[];
    const widths = nodes.slice(0, items.length).map((n) => n.offsetWidth);
    const othersWidth = nodes[items.length]?.offsetWidth ?? 0;
    const available = row.clientWidth;

    const total = widths.reduce((s, w) => s + w, 0) + GAP * Math.max(0, widths.length - 1);
    if (total <= available) {
      setFitCount(items.length);
      return;
    }
    let used = othersWidth;
    let n = 0;
    while (n < widths.length && used + GAP + widths[n] <= available) {
      used += GAP + widths[n];
      n++;
    }
    setFitCount(n);
  }, [items.length]);

  useLayoutEffect(recalc, [recalc, items]);
  useEffect(() => {
    const ro = new ResizeObserver(recalc);
    if (rowRef.current) ro.observe(rowRef.current);
    if (measureRef.current) ro.observe(measureRef.current); // font load changes widths
    return () => ro.disconnect();
  }, [recalc]);

  const shown = items.slice(0, fitCount);
  const overflow = useMemo(() => items.slice(fitCount), [items, fitCount]);
  const otherGroups = useMemo(() => groupModules(overflow), [overflow]);
  const filteredGroups = useMemo(() => filterModuleGroups(otherGroups, filter), [otherGroups, filter]);

  /* ── active state ─────────────────────────────────────────────── */
  const isActive = (path?: string) => !!path && location.pathname === path;
  const itemActive = (i: NavItem) => isActive(i.path) || !!i.children?.some((c) => isActive(c.path));
  const othersActive = overflow.some(itemActive);

  /* ── open / close ─────────────────────────────────────────────── */
  const openMenu = useCallback((id: string) => {
    const btn = buttonRefs.current[id];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = id === OTHERS ? Math.min(OTHERS_MAX_WIDTH, window.innerWidth - 16) : MENU_WIDTH;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ left, top: r.bottom + 6, width });
    setFilter("");
    setOpen(id);
  }, []);
  const close = useCallback(() => setOpen(null), []);

  useEffect(close, [location.pathname, close]); // navigating closes
  useEffect(close, [fitCount, close]); // layout changed → anchor moved

  useEffect(() => {
    if (open === OTHERS) filterRef.current?.focus();
  }, [open]);

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

  /* ── rendering helpers ────────────────────────────────────────── */
  const buttonCls = (active: boolean, isOpen: boolean) =>
    `top-nav-item shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-md text-sm whitespace-nowrap transition-colors ${
      active
        ? "is-active bg-blue-600 text-white font-medium shadow-sm"
        : `text-gray-700 hover:bg-gray-100 ${isOpen ? "is-open bg-gray-100" : ""}`
    }`;
  const linkCls = (active: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm ${
      active ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-100"
    }`;
  const menuButton = (id: string, label: string, Icon: React.ElementType, active: boolean) => (
    <button
      key={id}
      ref={(el) => {
        buttonRefs.current[id] = el;
      }}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open === id}
      onClick={() => (open === id ? close() : openMenu(id))}
      onMouseEnter={() => {
        if (open && open !== id) openMenu(id);
      }}
      className={buttonCls(active, open === id)}
    >
      <Icon className="w-4 h-4" strokeWidth={1.8} />
      <span className="tracking-tight">{label}</span>
      <ChevronDown
        className={`w-3.5 h-3.5 opacity-70 transition-transform ${open === id ? "rotate-180" : ""}`}
        strokeWidth={2}
      />
    </button>
  );

  const openItem = open && open !== OTHERS ? shown.find((i) => i.label === open) : null;
  const dropdownLinks = openItem
    ? [...(openItem.path ? [{ ...openItem, children: undefined }] : []), ...(openItem.children || [])]
    : [];

  return (
    <nav className="top-nav relative min-w-0 flex-1 overflow-hidden" aria-label="Main modules">
      {/* Hidden copy of every button (+ Others) — only used to measure widths. */}
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
        <span className={`${buttonCls(false, false)} font-medium`}>
          <LayoutGrid className="w-4 h-4" />
          <span>{OTHERS_LABEL}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>

      <div ref={rowRef} className="flex items-center gap-1 overflow-hidden">
        {shown.map((item) =>
          hasPages(item) ? (
            menuButton(item.label, item.label, item.icon, itemActive(item))
          ) : (
            <Link key={item.label} to={item.path || "#"} className={buttonCls(itemActive(item), false)}>
              <item.icon className="w-4 h-4" strokeWidth={1.8} />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          ),
        )}
        {overflow.length > 0 && menuButton(OTHERS, OTHERS_LABEL, LayoutGrid, othersActive)}
      </div>

      {open && pos && (openItem || open === OTHERS) && (
        <div
          ref={panelRef}
          role="menu"
          className="top-nav-dropdown fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 max-h-[calc(100vh-6rem)] overflow-y-auto hover-scrollbar"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        >
          {open === OTHERS ? (
            <div className="p-4">
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={filterRef}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  onKeyDown={(e) => {
                    const first = filteredGroups[0]?.children?.[0];
                    if (e.key === "Enter" && first?.path) navigate(first.path);
                  }}
                  placeholder="Search a module or page…"
                  className="keep-box ua-field w-full h-9 pl-9 pr-3 text-sm rounded-md border border-gray-300 focus:outline-none"
                />
              </div>
              {filteredGroups.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No matching pages</p>
              ) : (
                <div className="columns-[210px] gap-x-6">
                  {filteredGroups.map((g) => (
                    <section key={g.label} className="break-inside-avoid mb-4">
                      <h4
                        className={`flex items-center gap-2 px-2.5 pb-1.5 mb-1 text-xs font-semibold uppercase tracking-wide border-b border-gray-200 ${
                          itemActive(g) ? "text-blue-600" : "text-gray-500"
                        }`}
                      >
                        <g.icon className="w-3.5 h-3.5" strokeWidth={2} />
                        {g.label}
                      </h4>
                      {g.children?.map((c) => (
                        <Link key={`${g.label}-${c.label}`} to={c.path || "#"} role="menuitem" className={linkCls(isActive(c.path))}>
                          <c.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                          <span className="truncate">{c.label}</span>
                        </Link>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-1.5">
              {dropdownLinks.map((item) => (
                <Link key={item.label} to={item.path || "#"} role="menuitem" className={linkCls(isActive(item.path))}>
                  <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default TopNav;
