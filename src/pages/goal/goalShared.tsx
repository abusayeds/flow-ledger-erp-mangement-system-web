/**
 * File: src/pages/goal/goalShared.tsx
 * Shared list-page scaffold for the Goal module (and reusable by other
 * reference redesigns): breadcrumb + title row + search/per-page/filters
 * toolbar + pagination footer + delete-confirm modal, in the Qayd blue theme.
 */

import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HrmBreadcrumb, selectCls } from "../hrm/hrmShared";
import { Search, Plus, Trash2, List, LayoutGrid } from "lucide-react";

function compactPageList(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, totalPages, current]);
  for (let d = -2; d <= 2; d++) {
    const p = current + d;
    if (p >= 1 && p <= totalPages) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

export function ListShell({
  module,
  current,
  title,
  onCreate,
  search,
  setSearch,
  searchPlaceholder,
  perPage,
  setPerPage,
  page,
  setPage,
  total,
  filterOptions,
  filterValue,
  setFilterValue,
  filterLabel = "Status",
  view,
  setView,
  children,
}: {
  module: string;
  current: string;
  title: string;
  onCreate?: () => void;
  search: string;
  setSearch: (v: string) => void;
  searchPlaceholder: string;
  perPage: number;
  setPerPage: (v: number) => void;
  page: number;
  setPage: (v: number) => void;
  total: number;
  filterOptions?: string[];
  filterValue?: string;
  setFilterValue?: (v: string) => void;
  filterLabel?: string;
  view?: "list" | "grid";
  setView?: (v: "list" | "grid") => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageItems = useMemo(() => compactPageList(page, totalPages), [page, totalPages]);

  return (
    <div className="module-page-shell flex flex-col overflow-hidden p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: module }]} current={current} onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {onCreate && (
            <button onClick={onCreate} title={`Create ${current.toLowerCase()}`} className="w-9 h-9 flex-shrink-0 mr-2 sm:mr-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm">
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* toolbar — single row */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 flex-nowrap">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-56 sm:w-72 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {view && setView && (
              <div className="flex border border-gray-300 rounded-md overflow-hidden">
                <button type="button" onClick={() => setView("list")} title="List view" className={`px-2.5 py-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  <List className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setView("grid")} title="Grid view" className={`px-2.5 py-1.5 border-l border-gray-300 ${view === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            )}
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className={`${selectCls} px-3 py-1.5 text-sm`}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
            </select>
            {filterOptions && setFilterValue && (
              <select
                value={filterValue || "All"}
                onChange={(e) => {
                  setFilterValue(e.target.value);
                  setPage(1);
                }}
                className={`${selectCls} px-3 py-1.5 text-sm min-w-[8.5rem]`}
                title={filterLabel}
              >
                <option value="All">All {filterLabel}</option>
                {filterOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-auto">{children}</div>

      {/* footer */}
      <div className="bg-white border-t border-gray-300 px-4 sm:px-6 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Showing {total === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} results
        </span>
        <div className="flex items-center gap-1">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50">
            ‹ Previous
          </button>
          {pageItems.map((p, i) =>
            p === "…" ? (
              <span key={`e-${i}`} className="px-1 text-gray-400">
                …
              </span>
            ) : (
              <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-md ${p === page ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50 border border-gray-300"}`}>
                {p}
              </button>
            ),
          )}
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50">
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── delete confirm modal ──────────────────────────────────────── */

export function DeleteConfirm({
  what,
  name,
  onConfirm,
  onCancel,
}: {
  what: string;
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete {what}?</h3>
          <p className="text-sm text-gray-500 mb-5">
            This will permanently remove <span className="font-medium text-gray-700">{name}</span>.
          </p>
          <div className="flex gap-3">
            <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
            <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── generic modal shell ───────────────────────────────────────── */

export function ModalShell({
  title,
  onClose,
  children,
  onSubmit,
  submitLabel,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={onSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── chips ─────────────────────────────────────────────────────── */

export function chip(label: string, cls: string) {
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export const PRIORITY_CHIP: Record<string, string> = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  High: "bg-orange-100 text-orange-600",
  Critical: "bg-red-100 text-red-600",
};

export const STATUS_CHIP: Record<string, string> = {
  Active: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-600 text-white",
  Completed: "bg-green-100 text-green-700",
  Achieved: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Manual: "bg-blue-100 text-blue-700",
  Automatic: "bg-green-100 text-green-700",
  "On track": "bg-blue-100 text-blue-700",
  Behind: "bg-yellow-100 text-yellow-700",
  Ahead: "bg-green-100 text-green-700",
  "Is Active": "bg-green-100 text-green-700",
  Inactive: "bg-red-100 text-red-600",
};
