/**
 * Customer / Vendor filter chip — multi-select with All checkbox + Cancel/Apply.
 * Panel is portaled to document.body so list-panel overflow cannot clip it.
 * Theme-safe via app surface/gray CSS variables (dark + light).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus } from "lucide-react";
import { fetchCustomers } from "@/services/customersApi";
import { fetchVendors } from "@/services/vendorsApi";

type PartyKind = "customer" | "vendor";

export type PartyFilterApply = (ids: string[], labels: string[]) => void;

/** Comma-join for backend `customer_id` / `vendor_id` multi filters. */
export function partyFilterParam(ids: string[] | null | undefined): string | undefined {
  if (!ids?.length) return undefined;
  return ids.join(",");
}

export const PartyFilterPopover: React.FC<{
  kind: PartyKind;
  /** Applied party `_id`s. Empty = All (no filter). */
  appliedIds?: string[];
  /** Optional labels aligned with appliedIds (for chip text). */
  appliedLabels?: string[];
  onApply: PartyFilterApply;
  /** @deprecated Use appliedIds — kept so old single-id call sites keep typing during migrate. */
  applied?: string | null;
  appliedLabel?: string;
}> = ({ kind, appliedIds: appliedIdsProp, appliedLabels: appliedLabelsProp, onApply, applied, appliedLabel }) => {
  const appliedIds = useMemo(() => {
    if (appliedIdsProp) return appliedIdsProp;
    if (applied) return [applied];
    return [];
  }, [appliedIdsProp, applied]);
  const appliedLabels = useMemo(() => {
    if (appliedLabelsProp?.length) return appliedLabelsProp;
    if (applied && appliedLabel) return [appliedLabel];
    return [];
  }, [appliedLabelsProp, applied, appliedLabel]);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const label = kind === "customer" ? "Customer" : "Vendor";
  const allLabel = kind === "customer" ? "All Customers" : "All Vendors";

  const partyQuery = useQuery({
    queryKey: [`${kind}-filter-popover`, q],
    queryFn: async () => {
      const params = { page: 1, limit: 100, searchTerm: q.trim() || undefined };
      return kind === "customer" ? fetchCustomers(params) : fetchVendors(params);
    },
    staleTime: 30_000,
    enabled: open,
  });
  const rows: { _id: string; name: string }[] = partyQuery.data?.rows ?? [];

  const updatePosition = () => {
    if (!ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    setRect({
      top: bounds.bottom + 8,
      left: bounds.left,
      width: Math.max(bounds.width, 280),
    });
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const sync = () => updatePosition();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open]);

  const openPanel = () => {
    const next = new Set(appliedIds);
    const labels: Record<string, string> = {};
    appliedIds.forEach((id, i) => {
      if (appliedLabels[i]) labels[id] = appliedLabels[i];
    });
    setDraft(next);
    setDraftLabels(labels);
    setQ("");
    setOpen(true);
  };

  const visibleIds = rows.map((r) => r._id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => draft.has(id));
  const someVisibleSelected = visibleIds.some((id) => draft.has(id));

  const toggleAll = () => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
        setDraftLabels((labs) => {
          const copy = { ...labs };
          rows.forEach((r) => {
            copy[r._id] = r.name;
          });
          return copy;
        });
      }
      return next;
    });
  };

  const toggleOne = (id: string, name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDraftLabels((labs) => ({ ...labs, [id]: name }));
  };

  const handleCancel = () => {
    setOpen(false);
    setQ("");
  };

  const handleApply = () => {
    const ids = [...draft];
    const labels = ids.map((id) => draftLabels[id] || rows.find((r) => r._id === id)?.name || "Selected");
    onApply(ids, labels);
    setOpen(false);
    setQ("");
  };

  const chipText = (() => {
    if (!appliedIds.length) return "All";
    if (appliedIds.length === 1) {
      return appliedLabels[0] || rows.find((r) => r._id === appliedIds[0])?.name || "1 selected";
    }
    return `${appliedIds.length} selected`;
  })();

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[80] flex w-72 max-h-[70vh] flex-col overflow-hidden rounded-md border border-gray-300 bg-white shadow-xl"
            style={{ top: rect.top, left: rect.left, width: Math.max(rect.width, 288) }}
          >
            <div className="p-2 border-b border-gray-300 shrink-0">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${label}`}
                className="w-full px-2.5 py-1.5 text-sm bg-gray-100 text-gray-900 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder:text-gray-400"
              />
            </div>

            <div className="border-b border-gray-200 shrink-0">
              <label className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-600"
                />
                <span className="font-medium">{allLabel}</span>
              </label>
            </div>

            <div className="hover-scrollbar flex-1 overflow-y-auto py-1 min-h-[8rem]">
              {partyQuery.isLoading ? (
                <div className="px-3 py-3 text-sm text-gray-400">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-400">No {label.toLowerCase()}s</div>
              ) : (
                rows.map((row) => (
                  <label
                    key={row._id}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={draft.has(row._id)}
                      onChange={() => toggleOne(row._id, row.name)}
                      className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="truncate">{row.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-300 bg-gray-50 px-3 py-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"
      >
        <Plus className="w-3 h-3" />
        {label} | {chipText}
        <ChevronDown className="w-3 h-3" />
      </button>
      {panel}
    </div>
  );
};

export default PartyFilterPopover;
