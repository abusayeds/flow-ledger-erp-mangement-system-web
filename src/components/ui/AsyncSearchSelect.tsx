/**
 * Async searchable select — type to search, results from backend (searchTerm).
 * Stores option `id`, shows `name` as readable text.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";

export type AsyncOption = { id: string; name: string };

type AsyncSearchSelectProps = {
  value: string;
  displayName?: string;
  onChange: (id: string, option?: AsyncOption) => void;
  /** Called with the typed query (debounced). Return options from API. */
  onSearch: (query: string) => Promise<AsyncOption[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Initial / empty-query load */
  loadOnOpen?: boolean;
};

export function AsyncSearchSelect({
  value,
  displayName,
  onChange,
  onSearch,
  placeholder = "Search...",
  disabled,
  className = "",
  loadOnOpen = true,
}: AsyncSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AsyncOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState(displayName || "");
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (displayName) setLabel(displayName);
  }, [displayName]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const rows = await onSearch(q.trim());
        if (id === reqId.current) setOptions(rows.filter((r) => String(r.name || "").trim() !== ""));
      } catch {
        if (id === reqId.current) setOptions([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [onSearch],
  );

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSearch(query), 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open, runSearch]);

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    if (loadOnOpen) void runSearch("");
  };

  const shown = label || options.find((o) => o.id === value)?.name || "";

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`keep-box ua-field w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-md text-sm text-left ${
          disabled
            ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
            : open
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-white"
              : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <span className={`truncate ${shown ? "text-gray-900" : "text-gray-400"}`}>
          {shown || placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                setLabel("");
                onChange("");
              }}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </span>
      </button>

      {open && !disabled && (
        <div className="ua-dropdown-panel absolute left-0 right-0 top-full mt-1 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="relative border-b border-gray-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="keep-box ua-field w-full pl-9 pr-9 py-2 text-sm focus:outline-none"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setLabel(o.name);
                  onChange(o.id, o);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  o.id === value ? "bg-blue-50 text-blue-700" : "text-gray-900"
                }`}
              >
                {o.name}
              </button>
            ))}
            {!loading && options.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AsyncSearchSelect;
