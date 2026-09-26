/**
 * Budget Monitoring — /api/v1/budget-planner/budget-monitoring (read-only)
 */
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import { fetchMonitoring, searchBudgets } from "@/services/budgetApi";
import { AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell } from "../goal/goalShared";
import { ArrowUpDown } from "lucide-react";

export const BudgetMonitoring: React.FC = () => {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [budgetFilterId, setBudgetFilterId] = useState("");
  const [budgetFilterName, setBudgetFilterName] = useState("");
  const [sortField, setSortField] = useState<"monitoring_date" | "total_allocated">("monitoring_date");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["budget-monitoring", page, perPage, search, budgetFilterId, sortField, sortAsc],
    queryFn: () =>
      fetchMonitoring({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        budget_id: budgetFilterId || undefined,
        sort: buildListSortParam(sortField, sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const toggleSort = (f: "monitoring_date" | "total_allocated") => {
    if (sortField === f) setSortAsc(!sortAsc);
    else {
      setSortField(f);
      setSortAsc(f === "monitoring_date" ? false : true);
    }
    setPage(1);
  };

  return (
    <ListShell
      module="Budget Planner"
      current="Budget Monitoring"
      title="Budget Monitoring"
      search={searchInput}
      setSearch={setSearchInput}
      searchPlaceholder="Search by budget name..."
      perPage={perPage}
      setPerPage={setPerPage}
      page={page}
      setPage={setPage}
      total={total}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter by Budget</span>
        <div className="w-full sm:w-72">
          <AsyncSearchSelect
            value={budgetFilterId}
            displayName={budgetFilterName}
            onChange={(id, opt) => {
              setBudgetFilterId(id);
              setBudgetFilterName(opt?.name || "");
              setPage(1);
            }}
            onSearch={searchBudgets}
            placeholder="All budgets…"
          />
        </div>
      </div>
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Budget</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
              <button type="button" onClick={() => toggleSort("monitoring_date")} className="flex items-center gap-1 hover:text-gray-900">
                Date <ArrowUpDown className="w-3 h-3" />
              </button>
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
              <button type="button" onClick={() => toggleSort("total_allocated")} className="flex items-center gap-1 hover:text-gray-900">
                Allocated <ArrowUpDown className="w-3 h-3" />
              </button>
            </th>
            {["Spent", "Remaining", "Variance %"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3.5 font-medium text-gray-900">{r.budgetName}</td>
              <td className="px-4 py-3.5 text-gray-600">{r.date}</td>
              <td className="px-4 py-3.5 text-gray-900">{money(r.allocated)}</td>
              <td className="px-4 py-3.5 text-gray-600">{money(r.spent)}</td>
              <td className="px-4 py-3.5 text-gray-900">{money(r.remaining)}</td>
              <td
                className={`px-4 py-3.5 font-medium ${
                  r.variancePct < 0 ? "text-red-500" : r.variancePct > 0 ? "text-green-600" : "text-gray-600"
                }`}
              >
                {r.variancePct.toFixed(2)}%
              </td>
            </tr>
          ))}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                No monitoring entries found.
              </td>
            </tr>
          )}
          {isLoading && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ListShell>
  );
};

export default BudgetMonitoring;
