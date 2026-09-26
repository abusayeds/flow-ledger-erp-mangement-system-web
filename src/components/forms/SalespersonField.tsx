/**
 * Salesperson select field for document create forms.
 * Larger searchable input — debounced backend search (name/email) + Manage link.
 */
import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { ManageSalespersonModal } from "@/components/modals/ManageSalespersonModal";
import { fetchSalespersons, type Salesperson } from "@/services/salespersonApi";

export type SalespersonValue = {
  id: string;
  name: string;
  email?: string;
};

type Props = {
  valueId?: string;
  valueName?: string;
  onChange: (next: SalespersonValue | null) => void;
  className?: string;
  placeholder?: string;
};

const FIELD =
  "w-full min-h-[48px] rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-600";

export const SalespersonField: React.FC<Props> = ({
  valueId = "",
  valueName = "",
  onChange,
  className = "",
  placeholder = "Salesperson",
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [query, setQuery] = useState(valueName || "");
  const [debounced, setDebounced] = useState(valueName || "");

  useEffect(() => {
    if (!open) setQuery(valueName || "");
  }, [valueName, open]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["salespersons", "search", debounced],
    queryFn: () =>
      fetchSalespersons({
        searchTerm: debounced.trim() || undefined,
        status: "Active",
      }),
    staleTime: 15_000,
    enabled: open || manageOpen,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (sp: Salesperson) => {
    onChange({ id: sp._id, name: sp.name, email: sp.email });
    setQuery(sp.name);
    setOpen(false);
  };

  const clearIfTypedAway = (next: string) => {
    setQuery(next);
    setOpen(true);
    if (valueId && next.trim() !== (valueName || "").trim()) {
      onChange(null);
    }
  };

  return (
    <>
      <div ref={wrapRef} className={`relative ${className}`}>
        <label className="absolute -top-2 left-2 z-10 bg-white px-1 text-[11px] text-gray-500">
          {placeholder}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => clearIfTypedAway(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search salesperson"
            className={`${FIELD} pl-9 pr-9`}
            autoComplete="off"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {isFetching && open ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            )}
          </span>
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl">
            <div className="max-h-56 overflow-y-auto py-1">
              {isFetching && rows.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-400">Searching…</div>
              )}
              {!isFetching && rows.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-400">No matching salesperson</div>
              )}
              {rows.map((sp) => (
                <button
                  key={sp._id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(sp)}
                  className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 ${
                    valueId === sp._id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="truncate text-sm font-semibold text-gray-900">{sp.name}</div>
                  {sp.email ? (
                    <div className="truncate text-xs text-gray-500">{sp.email}</div>
                  ) : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                setManageOpen(true);
              }}
              className="w-full border-t border-gray-200 px-3 py-2.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              Manage Salesperson
            </button>
          </div>
        )}
      </div>

      {manageOpen && (
        <ManageSalespersonModal
          onClose={() => setManageOpen(false)}
          onPicked={(sp) => {
            onChange({ id: sp._id, name: sp.name, email: sp.email });
            setQuery(sp.name);
            setManageOpen(false);
          }}
        />
      )}
    </>
  );
};

export default SalespersonField;
