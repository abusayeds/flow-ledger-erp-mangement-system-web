/**
 * Navbar global search — UI matches product screenshots.
 * Uses remapped gray scale: gray-900 = light text, gray-100/200 = dark surfaces.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ChevronDown,
  Check,
  Loader2,
  Calendar,
  Users,
  FileText,
  Receipt,
  FileSpreadsheet,
  Truck,
  CreditCard,
  DollarSign,
  Building2,
  ShoppingCart,
  Package,
  Wrench,
  Clock,
  FolderOpen,
  BarChart3,
  UserCog,
  CircleDollarSign,
} from "lucide-react";
import {
  GLOBAL_SEARCH_MODULES,
  runGlobalSearch,
  type GlobalSearchHit,
  type GlobalSearchModule,
} from "@/services/globalSearchApi";
import { dateBounds } from "@/services/dashboardSummaryApi";
import { FOCUS_GLOBAL_SEARCH_EVENT } from "@/lib/listToolbarEvents";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const MODULE_ICON: Record<Exclude<GlobalSearchModule, "All">, React.ElementType> = {
  Customers: Users,
  Invoices: FileText,
  "Proforma Invoices": FileSpreadsheet,
  "Sales Receipts": Receipt,
  Estimates: FileSpreadsheet,
  "Delivery Challans": Truck,
  "Credit Notes": CreditCard,
  "Payment Received": DollarSign,
  Vendors: Building2,
  "Purchase Orders": ShoppingCart,
  Bills: FileText,
  Expenses: Receipt,
  "Payment Made": CircleDollarSign,
  "Debit Notes": CreditCard,
  Products: Package,
  Services: Wrench,
  "Time Logs": Clock,
  Projects: FolderOpen,
  Reports: BarChart3,
  Team: UserCog,
  Companies: Building2,
};

const PERIOD_OPTIONS = [
  "All",
  "Today",
  "This Week",
  "Last Week",
  "This Month",
  "Last 30 Days",
  "Last Month",
  "Last 90 Days",
  "This Quarter",
  "Last Quarter",
  "Last 6 Months",
  "This Year",
  "Last 12 Months",
  "Last Year",
  "This Financial Year",
  "Last Financial Year",
] as const;

type PeriodOption = (typeof PERIOD_OPTIONS)[number];

const moduleLabel = (m: GlobalSearchModule) => (m === "All" ? "All Modules" : m);

const inPeriod = (dateLabel: string, period: PeriodOption): boolean => {
  if (period === "All" || !dateLabel || dateLabel === "—") return true;
  const d = new Date(dateLabel);
  if (Number.isNaN(d.getTime())) return true;
  try {
    const { from, to } = dateBounds(period);
    const t = d.getTime();
    return t >= new Date(from).setHours(0, 0, 0, 0) && t <= new Date(to).setHours(23, 59, 59, 999);
  } catch {
    return true;
  }
};

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Skip opening the filter panel on the programmatic focus from list Search icons. */
  const skipOpenOnFocusRef = useRef(false);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<GlobalSearchModule>("All");
  const [period, setPeriod] = useState<PeriodOption>("All");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [open, setOpen] = useState(false);
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setModuleMenuOpen(false);
        setPeriodMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /**
   * List sidebar Search icon → pin that module + focus navbar input.
   * Dropdown only opens when there is no specific module (All / unknown).
   */
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail as { module?: GlobalSearchModule } | undefined;
      const next = detail?.module;
      const known =
        next && next !== "All" && GLOBAL_SEARCH_MODULES.includes(next) ? next : null;
      if (known) setModule(known);
      else if (next && GLOBAL_SEARCH_MODULES.includes(next)) setModule(next);

      setModuleMenuOpen(false);
      setPeriodMenuOpen(false);

      if (known) {
        // Already on a concrete module (e.g. Proforma Invoices) — focus only.
        setOpen(false);
        skipOpenOnFocusRef.current = true;
      } else {
        setOpen(true);
        skipOpenOnFocusRef.current = false;
      }

      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
        window.setTimeout(() => {
          skipOpenOnFocusRef.current = false;
        }, 0);
      }, 0);
    };
    window.addEventListener(FOCUS_GLOBAL_SEARCH_EVENT, h);
    return () => window.removeEventListener(FOCUS_GLOBAL_SEARCH_EVENT, h);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await runGlobalSearch({
          query: q,
          module,
          limit: Math.max(visibleCount, 24),
        });
        if (!cancelled) setHits(rows);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, module, visibleCount]);

  const filteredHits = useMemo(() => {
    if (period === "All" && !customFrom && !customTo) return hits;
    return hits.filter((h) => {
      if (customFrom || customTo) {
        const d = new Date(h.date);
        if (Number.isNaN(d.getTime())) return true;
        const t = d.getTime();
        if (customFrom && t < new Date(customFrom).setHours(0, 0, 0, 0)) return false;
        if (customTo && t > new Date(customTo).setHours(23, 59, 59, 999)) return false;
        return true;
      }
      return inPeriod(h.date, period);
    });
  }, [hits, period, customFrom, customTo]);

  const reset = () => {
    setQuery("");
    setHits([]);
    setOpen(false);
    setModuleMenuOpen(false);
    setPeriodMenuOpen(false);
    setVisibleCount(12);
    setModule("All");
    setPeriod("All");
    setCustomFrom("");
    setCustomTo("");
  };

  const openPanel = () => {
    if (skipOpenOnFocusRef.current) return;
    setOpen(true);
    setPeriodMenuOpen(false);
    setModuleMenuOpen(false);
  };

  const go = (hit: GlobalSearchHit) => {
    setOpen(false);
    setModuleMenuOpen(false);
    setPeriodMenuOpen(false);
    setQuery("");
    if (hit.selectedId) navigate(hit.path, { state: { selectedId: hit.selectedId } });
    else navigate(hit.path);
  };

  const shown = filteredHits.slice(0, visibleCount);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="relative flex-1 min-w-0" ref={rootRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-500 pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setModuleMenuOpen(false);
          setPeriodMenuOpen(false);
          setVisibleCount(12);
        }}
        onFocus={openPanel}
        onClick={openPanel}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setModuleMenuOpen(false);
            setPeriodMenuOpen(false);
            return;
          }
          if (e.key === "Enter" && shown[0]) go(shown[0]);
        }}
        className="keep-box ua-field w-full h-12 pl-10 pr-14 text-[15px] rounded-md border border-gray-300 placeholder:text-gray-500 focus:outline-none focus:border-blue-600"
        style={{ backgroundColor: "var(--surface-2)", color: "var(--color-base-900)" }}
      />
      {query.trim() ? (
        <button
          type="button"
          onClick={reset}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-medium rounded hover:opacity-80"
          style={{ color: "var(--color-base-900)" }}
          title="Reset"
        >
          Reset
        </button>
      ) : null}

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] w-[min(92vw,460px)] rounded-md shadow-2xl border border-gray-300 z-50 overflow-visible"
          style={{ backgroundColor: "var(--surface)", color: "var(--color-base-900)" }}
        >
          <div className="flex items-stretch gap-3 p-3">
            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setModuleMenuOpen((o) => !o);
                  setPeriodMenuOpen(false);
                }}
                className="w-full h-12 inline-flex items-center justify-between gap-2 px-3 text-[15px] border border-gray-300 rounded-md hover:border-gray-400"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--color-base-900)" }}
              >
                <span className="truncate">{moduleLabel(module)}</span>
                <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
              </button>
              {moduleMenuOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+4px)] z-[70] w-full min-w-[260px] max-h-[min(80vh,520px)] overflow-y-auto custom-scrollbar border border-gray-300 rounded-md shadow-2xl py-1"
                  style={{ backgroundColor: "var(--surface)", color: "var(--color-base-900)" }}
                >
                  {GLOBAL_SEARCH_MODULES.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setModule(opt);
                        setModuleMenuOpen(false);
                        setVisibleCount(12);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-3.5 text-[15px] hover:bg-gray-100 text-left"
                      style={{ color: "var(--color-base-900)" }}
                    >
                      <span className="truncate">{opt === "All" ? "All" : opt}</span>
                      {opt === module && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setPeriodMenuOpen((o) => !o);
                  setModuleMenuOpen(false);
                }}
                className="w-full h-12 inline-flex items-center justify-between gap-2 px-3 text-[15px] border border-gray-300 rounded-md hover:border-gray-400"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--color-base-900)" }}
              >
                <span className="truncate">{period}</span>
                <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
              </button>
              {periodMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+4px)] z-[70] w-[min(92vw,300px)] max-h-[min(80vh,520px)] overflow-y-auto custom-scrollbar border border-gray-300 rounded-md shadow-2xl py-1"
                  style={{ backgroundColor: "var(--surface)", color: "var(--color-base-900)" }}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setPeriod(opt);
                        setCustomFrom("");
                        setCustomTo("");
                        setPeriodMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-3.5 text-[15px] hover:bg-gray-100 text-left"
                      style={{ color: "var(--color-base-900)" }}
                    >
                      <span>{opt}</span>
                      {opt === period && !customFrom && !customTo && (
                        <Check className="w-4 h-4 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-gray-300 mt-1 px-3 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm flex-1" style={{ color: "var(--color-base-900)" }}>
                        Date Range
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (customFrom && customTo) {
                            setPeriod("All");
                            setPeriodMenuOpen(false);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100"
                        style={{ backgroundColor: "var(--surface-2)", color: "var(--color-base-900)" }}
                      >
                        Go
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-6">
                      <AppDatePicker
                        value={customFrom}
                        onChange={(e) => {
                          setCustomFrom(e.target.value);
                          setPeriod("All");
                        }}
                        className="keep-box ua-field flex-1 min-w-0 px-2 py-1.5 text-xs rounded"
                      />
                      <span className="text-gray-500 text-xs">–</span>
                      <AppDatePicker
                        value={customTo}
                        onChange={(e) => {
                          setCustomTo(e.target.value);
                          setPeriod("All");
                        }}
                        className="keep-box ua-field flex-1 min-w-0 px-2 py-1.5 text-xs rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasQuery && (
            <div className="border-t border-gray-300">
              <div className="max-h-[min(55vh,360px)] overflow-y-auto custom-scrollbar">
                {loading && filteredHits.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching…
                  </div>
                ) : shown.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-gray-500 text-center">Search result not found.</div>
                ) : (
                  <ul>
                    {shown.map((hit) => {
                      const Icon = MODULE_ICON[hit.module] || FileText;
                      return (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => go(hit)}
                            className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-100 border-b border-gray-300 last:border-b-0 transition-colors"
                          >
                            <span className="w-9 h-9 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Icon className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[15px] truncate" style={{ color: "var(--color-base-900)" }}>
                                <span className="font-medium">{hit.module}</span>
                                <span className="text-gray-500"> • </span>
                                <span>{hit.title}</span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                                <span className="truncate">{hit.number}</span>
                                {hit.date !== "—" && (
                                  <>
                                    <span className="text-gray-400">·</span>
                                    <span className="whitespace-nowrap">{hit.date}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {hit.amount !== "—" && (
                              <span
                                className="text-[15px] font-medium whitespace-nowrap flex-shrink-0"
                                style={{ color: "var(--color-base-900)" }}
                              >
                                {hit.amount}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {shown.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + 12)}
                  className="w-full px-4 py-2.5 text-sm text-blue-500 hover:bg-gray-100 border-t border-gray-300 text-center"
                >
                  Show more results...
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
