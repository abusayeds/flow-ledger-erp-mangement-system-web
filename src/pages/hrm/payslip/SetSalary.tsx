/**
 * File: src/pages/hrm/payslip/SetSalary.tsx
 * Set Salary — employee salary list matching the ERPGO reference
 * (references/hrm/set salary/set salary page.png) in the Qayd blue theme.
 * Eye action opens the Employee Salary Details page (SetSalaryDetail.tsx).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { money } from "@/lib/db";
import { employeeBackendId, fetchEmployeeListPage, type HrmEmployee } from "@/lib/db/hrm";
import { getList } from "@/services/_http";
import { HrmBreadcrumb, useDebouncedValue } from "../hrmShared";
import { Search, Filter, ChevronDown, ArrowUpDown, Eye } from "lucide-react";

type SortField = "employeeId" | "name" | "branch" | "department" | "designation" | "basicSalary";

export const SetSalary: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("employeeId");
  const [sortAsc, setSortAsc] = useState(true);

  const [list, setList] = useState<HrmEmployee[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getList("/hrm/setup/departments", { page: 1, limit: 200 }).then((rows) => {
      if (cancelled) return;
      const names = rows
        .map((d: any) => String(d.department_name ?? d.name ?? ""))
        .filter(Boolean);
      setDepartments(Array.from(new Set(names)).sort());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentFilter, perPage]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, total, totalPages: tp } = await fetchEmployeeListPage({
        page,
        limit: perPage,
        searchTerm: debouncedSearch || undefined,
      });
      setList(rows);
      setTotalResults(total);
      setTotalPages(Math.max(1, tp));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't load employees";
      showToast(msg, "error");
      setList([]);
      setTotalResults(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedSearch]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const filtered = useMemo(() => {
    const rows =
      departmentFilter === "All"
        ? [...list]
        : list.filter((e) => e.department === departmentFilter);
    rows.sort((a, b) => {
      if (sortField === "basicSalary")
        return sortAsc ? a.basicSalary - b.basicSalary : b.basicSalary - a.basicSalary;
      const va = String(a[sortField] ?? "");
      const vb = String(b[sortField] ?? "");
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return rows;
  }, [list, departmentFilter, sortField, sortAsc]);

  const paginated = filtered;

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortAsc(!sortAsc);
    else {
      setSortField(f);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-gray-900">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Set Salary" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Set Salary</h2>
      </div>

      {/* toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                <Filter className="w-4 h-4 text-gray-500" />
                <span>Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Department</div>
                  {["All", ...departments].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDepartmentFilter(d);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${departmentFilter === d ? "text-blue-600 font-medium" : "text-gray-700"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <SortHeader field="employeeId" label="Employee Id" />
                  <SortHeader field="name" label="Employee Name" />
                  <SortHeader field="branch" label="Branch" />
                  <SortHeader field="department" label="Department" />
                  <SortHeader field="designation" label="Designation" />
                  <SortHeader field="basicSalary" label="Basic Salary" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{emp.employeeId}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.branch}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.designation}</td>
                    <td className="px-4 py-3 text-gray-900">{money(emp.basicSalary)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          const bid = employeeBackendId(emp.id);
                          if (!bid) {
                            showToast("Employee profile not found", "error");
                            return;
                          }
                          navigate(`/hrm/payroll/set-salary/${bid}`);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="View salary details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Showing {totalResults === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, totalResults)} of {totalResults} results
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            ‹ Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-md ${p === page ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50 border border-gray-300"}`}
            >
              {p}
            </button>
          ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
};
