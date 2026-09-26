import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check } from "lucide-react";
import { fetchPublicCurrencies, type CurrencyOption } from "@/services/publicCurrencyApi";

const inputClassName =
  "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";

export const CurrencyCombobox: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currenciesQuery = useQuery({
    queryKey: ["public-currencies"],
    queryFn: fetchPublicCurrencies,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = currenciesQuery.data ?? [];
    if (!term) return rows.slice(0, 120);
    return rows
      .filter((item: CurrencyOption) =>
        [item.code, item.name, item.symbol, item.label].some((part) => part.toLowerCase().includes(term)),
      )
      .slice(0, 120);
  }, [currenciesQuery.data, query]);

  return (
    <div className="relative fl-wrap" ref={ref}>
      <label className="fl-label">Currency</label>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type or select currency"
          className={`${inputClassName} pr-10`}
        />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {options.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  onChange(item.code);
                  setQuery(item.code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="truncate">{item.label}</span>
                {value.toUpperCase() === item.code && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">
                {currenciesQuery.isLoading ? "Loading currencies..." : "No currency found. Keep typing to use a custom code."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrencyCombobox;
