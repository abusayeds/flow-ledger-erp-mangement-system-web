/**
 * Searchable tax picker for line-item tables.
 * Options come from `/tax/all` (backend); menu is portaled so table overflow never clips it.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { fetchTaxes, filterTaxesForKind, type TaxOption } from "@/services/taxesApi";

type Props = {
  valueId?: number;
  valueRate?: number;
  kind?: "product" | "service";
  onChange: (next: { taxId: number; taxRate: number; name: string; _id: string } | null) => void;
  className?: string;
};

export const LineTaxSelect: React.FC<Props> = ({
  valueId = 0,
  valueRate,
  kind,
  onChange,
  className = "",
}) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["taxes-options", debounced],
    queryFn: () => fetchTaxes({ searchTerm: debounced || undefined }),
    staleTime: 30_000,
    enabled: open,
    placeholderData: (prev) => prev,
  });

  // Keep a light cache of the selected label even when menu is closed.
  const { data: allCached = [] } = useQuery({
    queryKey: ["taxes-options", ""],
    queryFn: () => fetchTaxes(),
    staleTime: 60_000,
  });

  const options = useMemo(() => filterTaxesForKind(rows, kind), [rows, kind]);
  const selected =
    allCached.find((t) => t.localId === valueId) ||
    options.find((t) => t.localId === valueId) ||
    null;

  const label = selected
    ? `${selected.name} (${selected.rate}%)`
    : valueId
      ? valueRate != null
        ? `Tax ${valueRate}%`
        : "Tax"
      : "Select tax";

  const place = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, 200);
    let left = r.left;
    let top = r.bottom + 2;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    const panelH = panelRef.current?.offsetHeight || 220;
    if (top + panelH > window.innerHeight - 8 && r.top - panelH - 2 > 8) {
      top = r.top - panelH - 2;
    }
    setPos({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const sync = () => place();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  const pick = (t: TaxOption) => {
    onChange({ taxId: t.localId, taxRate: t.rate, name: t.name, _id: t._id });
    setQuery("");
    setOpen(false);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex max-w-[160px] items-center gap-1 rounded border border-transparent px-1.5 py-1 text-left text-xs text-gray-700 hover:border-gray-300 hover:bg-white ${className}`}
        title={label}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            data-line-tax-select=""
            className="fixed z-[110] overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl"
            style={
              pos
                ? { top: pos.top, left: pos.left, width: pos.width }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-gray-200 p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tax"
                className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-blue-600"
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
              >
                No tax
              </button>
              {isFetching && options.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </div>
              )}
              {!isFetching && options.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No taxes found</div>
              )}
              {options.map((t) => (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => pick(t)}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 ${
                    valueId === t.localId ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="truncate text-xs font-medium text-gray-900">{t.name}</div>
                  <div className="text-[10px] text-gray-500">{t.rate}%</div>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default LineTaxSelect;
