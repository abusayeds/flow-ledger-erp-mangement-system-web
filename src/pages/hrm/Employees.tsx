/**
 * File: src/pages/hrm/Employees.tsx
 * Manage Employees — list/grid view matching the ERPGO reference
 * (references/hrm/employee/employee tab.png) in the Qayd blue theme.
 * List is loaded from GET /hrm/employees with server-side search & pagination;
 * create/edit happens on the dedicated wizard page (EmployeeCreate.tsx).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import {
  employeeBackendId,
  fetchEmployeeListPage,
  type HrmEmployee,
} from "@/lib/db/hrm";
import { api } from "@/lib/api/client";
import { getList } from "@/services/_http";
import { Avatar, HrmBreadcrumb, CreatePlusButton, useDebouncedValue } from "./hrmShared";
import {
  Search,
  Edit,
  Trash2,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Eye,
  List,
  LayoutGrid,
  X,
} from "lucide-react";

type SortField = "employeeId" | "name" | "branch" | "department" | "designation" | "employmentType" | "dateOfJoining";

export const Employees: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [branchFilter, setBranchFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("employeeId");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewEmployee, setViewEmployee] = useState<HrmEmployee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<HrmEmployee | null>(null);

  const [list, setList] = useState<HrmEmployee[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [branchOptions, setBranchOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getList("/hrm/setup/branches", { page: 1, limit: 200 }).then((rows) => {
      if (cancelled) return;
      setBranchOptions(
        rows.map((b: any) => ({
          id: String(b._id ?? b.id ?? ""),
          name: String(b.branch_name ?? b.name ?? ""),
        })).filter((b) => b.id && b.name),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const branchId = useMemo(() => {
    if (branchFilter === "All") return undefined;
    return branchOptions.find((b) => b.name === branchFilter)?.id;
  }, [branchFilter, branchOptions]);

  const branches = useMemo(
    () => branchOptions.map((b) => b.name).sort(),
    [branchOptions],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchFilter, perPage]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, total, totalPages: tp } = await fetchEmployeeListPage({
        page,
        limit: perPage,
        searchTerm: debouncedSearch || undefined,
        branch_id: branchId,
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
  }, [page, perPage, debouncedSearch, branchId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const paginated = useMemo(() => {
    const rows = [...list];
    rows.sort((a, b) => {
      const va = String(a[sortField] ?? "");
      const vb = String(b[sortField] ?? "");
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return rows;
  }, [list, sortField, sortAsc]);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortAsc(!sortAsc);
    else {
      setSortField(f);
      setSortAsc(true);
    }
  };

  const confirmDelete = async () => {
    if (!deleteEmployee) return;
    const bid = employeeBackendId(deleteEmployee.id);
    if (!bid) {
      showToast("Missing employee id for delete", "error");
      return;
    }
    try {
      await api.raw.delete(`/hrm/employees/${bid}`);
      showToast("Employee deleted successfully", "success");
      setDeleteEmployee(null);
      await loadEmployees();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't delete employee";
      showToast(msg, "error");
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
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Employees" onNavigate={navigate} />

      {/* title row */}
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Employees</h2>
          <CreatePlusButton
            onClick={() => navigate("/hrm/employees/create")}
            title="Create employee"
          />
        </div>
      </div>

      {/* toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setView("list")}
                title="List view"
                className={`px-2.5 py-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView("grid")}
                title="Grid view"
                className={`px-2.5 py-1.5 border-l border-gray-300 ${view === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
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
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Branch</div>
                  {["All", ...branches].map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        setBranchFilter(b);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${branchFilter === b ? "text-blue-600 font-medium" : "text-gray-700"}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">Loading employees…</div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <SortHeader field="employeeId" label="Employee Id" />
                  <SortHeader field="name" label="Employee Name" />
                  <SortHeader field="branch" label="Branch" />
                  <SortHeader field="department" label="Department" />
                  <SortHeader field="designation" label="Designation" />
                  <SortHeader field="employmentType" label="Employment Type" />
                  <SortHeader field="dateOfJoining" label="Date Of Joining" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => setViewEmployee(emp)} className="text-blue-600 hover:underline font-medium">
                        {emp.employeeId}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} />
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.branch}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.designation}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.employmentType}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.dateOfJoining}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setViewEmployee(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => navigate(`/hrm/employees/${emp.id}/edit`)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteEmployee(emp)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map((emp) => (
              <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={emp.name} size={11} />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{emp.name}</div>
                    <div className="text-xs text-blue-600">{emp.employeeId}</div>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-400">Branch</span><span>{emp.branch}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Department</span><span>{emp.department}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Designation</span><span>{emp.designation}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Joined</span><span>{emp.dateOfJoining}</span></div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => setViewEmployee(emp)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => navigate(`/hrm/employees/${emp.id}/edit`)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteEmployee(emp)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {paginated.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">No employees found.</div>
            )}
          </div>
        )}
      </div>

      {/* footer / pagination */}
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

      {/* view modal */}
      {viewEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={viewEmployee.name} size={10} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{viewEmployee.name}</h3>
                  <p className="text-xs text-blue-600">{viewEmployee.employeeId}</p>
                </div>
              </div>
              <button onClick={() => setViewEmployee(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-5 text-sm">
              {(
                [
                  ["Employment", [
                    ["Branch", viewEmployee.branch],
                    ["Department", viewEmployee.department],
                    ["Designation", viewEmployee.designation],
                    ["Employment Type", viewEmployee.employmentType],
                    ["Date Of Joining", viewEmployee.dateOfJoining],
                    ["Shift", viewEmployee.shift],
                  ]],
                  ["Personal", [
                    ["Date Of Birth", viewEmployee.dob],
                    ["Gender", viewEmployee.gender],
                  ]],
                  ["Contact", [
                    ["Address", [viewEmployee.address1, viewEmployee.address2, viewEmployee.city, viewEmployee.state, viewEmployee.country, viewEmployee.postalCode].filter(Boolean).join(", ")],
                    ["Emergency Contact", `${viewEmployee.emergencyName} (${viewEmployee.emergencyRelation}) ${viewEmployee.emergencyNumber}`],
                  ]],
                  ["Banking", [
                    ["Bank Name", viewEmployee.bankName],
                    ["Account Holder", viewEmployee.accountHolder],
                    ["Account Number", viewEmployee.accountNumber],
                    ["Bank Identifier Code", viewEmployee.bankCode],
                    ["Bank Branch", viewEmployee.bankBranch],
                  ]],
                  ["Hours & Rates", [
                    ["Basic Salary", money(viewEmployee.basicSalary)],
                    ["Hours Per Day", String(viewEmployee.hoursPerDay)],
                    ["Days Per Week", String(viewEmployee.daysPerWeek)],
                    ["Rate Per Hour", money(viewEmployee.ratePerHour)],
                  ]],
                ] as [string, [string, string][]][]
              ).map(([section, rows]) => (
                <div key={section}>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{section}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-gray-50 pb-1.5">
                        <span className="text-gray-500">{k}</span>
                        <span className="text-gray-900 text-right">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {viewEmployee.documents.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Documents</h4>
                  {viewEmployee.documents.map((d) => (
                    <div key={d.id} className="flex justify-between border-b border-gray-50 pb-1.5">
                      <span className="text-gray-500">{d.type}</span>
                      <span className="text-gray-900">{d.fileName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setViewEmployee(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Close
              </button>
              <button
                onClick={() => {
                  navigate(`/hrm/employees/${viewEmployee.id}/edit`);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete confirm */}
      {deleteEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Employee?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This will permanently remove <span className="font-medium text-gray-700">{deleteEmployee.name}</span> ({deleteEmployee.employeeId}).
              </p>
              <div className="flex gap-3">
                <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  Delete
                </button>
                <button onClick={() => setDeleteEmployee(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
