/**
 * File: src/pages/hrm/attendance/Attendances.tsx
 * Attendance Report — employees × calendar-day grid from GET /hrm/attendances/grid.
 * Create/edit persist via POST/PUT /hrm/attendances (no local/Dexie data).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { attendanceApi } from "@/services/hrm";
import {
  Avatar,
  Field,
  inputCls,
  HrmBreadcrumb,
  IdSearchSelect,
  CreatePlusButton,
  useDebouncedValue,
} from "../hrmShared";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Flag,
  Star,
  Ban,
  Minus,
  Loader,
  AlarmClock,
  ArrowLeftToLine,
  Clock,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type GridEmp = {
  _id: string;
  employee_user_id: string;
  name: string;
  email: string;
  employee_code: string;
};

type GridCell = {
  _id: string;
  clock_in: string;
  clock_out: string;
  status: string;
  notes: string;
  total_hour: number;
};

type CellView = {
  status: "present" | "absent" | "half" | "leave" | "dayoff" | "future" | "holiday";
  late?: boolean;
  early?: boolean;
  overtime?: boolean;
  record?: GridCell;
};

function CellIcon({ cell }: { cell: CellView }) {
  switch (cell.status) {
    case "present":
      return (
        <span className="flex flex-col items-center">
          <Check className="w-4 h-4 text-green-500" strokeWidth={3} />
          <span className="flex items-center justify-center gap-0.5 mt-0.5">
            {cell.late && <AlarmClock className="w-2.5 h-2.5 text-orange-500" />}
            {cell.early && <ArrowLeftToLine className="w-2.5 h-2.5 text-red-400" />}
            {cell.overtime && <Clock className="w-2.5 h-2.5 text-blue-500" />}
          </span>
        </span>
      );
    case "absent":
      return <X className="w-4 h-4 text-red-500 mx-auto" strokeWidth={3} />;
    case "half":
      return <span className="text-[11px] font-bold text-yellow-500 leading-4">½</span>;
    case "leave":
      return <Flag className="w-4 h-4 text-red-500 mx-auto" fill="currentColor" />;
    case "holiday":
      return <Star className="w-4 h-4 text-yellow-500 mx-auto" fill="currentColor" />;
    case "dayoff":
      return <Ban className="w-4 h-4 text-gray-500 mx-auto" />;
    case "future":
      return <Minus className="w-4 h-4 text-gray-300 mx-auto" />;
    default:
      return <Loader className="w-4 h-4 text-gray-300 mx-auto" />;
  }
}

function resolveCell(
  emp: GridEmp,
  year: number,
  month: number,
  day: number,
  cells: Record<string, GridCell>,
): CellView {
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const key = `${emp.employee_user_id}:${dateStr}`;
  const rec = cells[key];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cellDate = new Date(year, month - 1, day);
  const dow = cellDate.getDay();

  if (cellDate > today) return { status: "future" };

  // Explicit saved status wins (so "Off Day" / "On Leave" icons show on weekdays).
  if (rec) {
    const s = String(rec.status || "present").toLowerCase();
    if (s.includes("half")) return { status: "half", record: rec };
    if (s.includes("leave")) return { status: "leave", record: rec };
    if (s.includes("absent")) return { status: "absent", record: rec };
    if (s.includes("holiday")) return { status: "holiday", record: rec };
    if (s.includes("off") || s.includes("dayoff") || s.includes("day off")) {
      return { status: "dayoff", record: rec };
    }
    return { status: "present", record: rec };
  }

  if (dow === 0 || dow === 6) return { status: "dayoff" };
  return { status: "absent" };
}

const NON_CLOCK_STATUSES = new Set(["on leave", "off day", "absent"]);

function normalizeEditStatus(raw?: string) {
  const s = String(raw || "present").trim().toLowerCase();
  if (s === "leave" || s === "onleave") return "on leave";
  if (s.includes("half")) return "half day";
  if (s.includes("off") || s.includes("dayoff")) return "off day";
  if (s === "pending") return "present";
  return s || "present";
}

export const Attendances: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [applied, setApplied] = useState({ employee: "", month: now.getMonth() + 1, year: now.getFullYear() });
  const [employees, setEmployees] = useState<GridEmp[]>([]);
  const [cells, setCells] = useState<Record<string, GridCell>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editCell, setEditCell] = useState<{ emp: GridEmp; date: string; record?: GridCell } | null>(null);
  const [draft, setDraft] = useState({ clockIn: "", clockOut: "", notes: "", status: "present" });
  const [createDraft, setCreateDraft] = useState({
    employeeId: "",
    date: "",
    clockIn: "",
    clockOut: "",
    notes: "",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await attendanceApi.grid({
        year: applied.year,
        month: applied.month,
        employee_id: applied.employee || undefined,
        searchTerm: debouncedSearch || undefined,
      });
      setEmployees(data.employees || []);
      setCells((data.cells as Record<string, GridCell>) || {});
    } catch (err: any) {
      showToast(err?.message || "Couldn't load attendance grid", "error");
      setEmployees([]);
      setCells({});
    } finally {
      setLoading(false);
    }
  }, [applied, debouncedSearch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const daysInMonth = new Date(applied.year, applied.month, 0).getDate();
  const workDays = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(applied.year, applied.month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) n += 1;
    }
    return n;
  }, [applied.year, applied.month, daysInMonth]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const filtered = useMemo(() => {
    return employees.filter(
      (e) => !applied.employee || e.employee_user_id === applied.employee,
    );
  }, [employees, applied.employee]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);

  const totalFor = (emp: GridEmp) => {
    let t = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const c = resolveCell(emp, applied.year, applied.month, d, cells);
      if (c.status === "present") t += 1;
      else if (c.status === "half") t += 0.5;
    }
    return t;
  };

  const empOptions = useMemo(
    () => employees.map((e) => ({ id: e.employee_user_id, name: e.name || e.email || "Employee" })),
    [employees],
  );

  const openEdit = (emp: GridEmp, day: number) => {
    const date = `${applied.year}-${String(applied.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const view = resolveCell(emp, applied.year, applied.month, day, cells);
    // Weekends without a saved record stay non-editable; saved Off Day rows stay editable.
    if (view.status === "future") return;
    if (view.status === "dayoff" && !view.record) return;
    const status = normalizeEditStatus(view.record?.status || (view.status === "leave" ? "on leave" : view.status === "dayoff" ? "off day" : view.status === "half" ? "half day" : view.status === "absent" ? "absent" : "present"));
    setDraft({
      clockIn: view.record?.clock_in || (NON_CLOCK_STATUSES.has(status) ? "" : "09:00"),
      clockOut: view.record?.clock_out || (NON_CLOCK_STATUSES.has(status) ? "" : "17:00"),
      notes: view.record?.notes || "",
      status,
    });
    setEditCell({ emp, date, record: view.record });
  };

  const submitEdit = async () => {
    if (!editCell) return;
    const status = normalizeEditStatus(draft.status);
    const needsClock = !NON_CLOCK_STATUSES.has(status);
    if (needsClock && !draft.clockIn) {
      showToast("Clock in time is required", "error");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        employee_id: editCell.emp.employee_user_id,
        date: editCell.date,
        notes: draft.notes,
        status,
      };
      if (needsClock) {
        body.clock_in = draft.clockIn;
        if (draft.clockOut) body.clock_out = draft.clockOut;
      }
      if (editCell.record?._id) {
        await attendanceApi.updateManual(editCell.record._id, body);
      } else {
        await attendanceApi.createManual(body);
      }
      showToast("Attendance updated successfully", "success");
      setEditCell(null);
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't save attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  const submitCreate = async () => {
    if (!createDraft.employeeId) {
      showToast("Please select an employee", "error");
      return;
    }
    if (!createDraft.date) {
      showToast("Please select a date", "error");
      return;
    }
    if (!createDraft.clockIn) {
      showToast("Clock in time is required", "error");
      return;
    }
    setSaving(true);
    try {
      await attendanceApi.createManual({
        employee_id: createDraft.employeeId,
        date: createDraft.date,
        clock_in: createDraft.clockIn,
        clock_out: createDraft.clockOut || undefined,
        notes: createDraft.notes,
        status: "present",
      });
      showToast("Attendance created successfully", "success");
      setCreateOpen(false);
      setCreateDraft({ employeeId: "", date: "", clockIn: "", clockOut: "", notes: "" });
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't create attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  const legend: [React.ReactNode, string][] = [
    [<Check key="p" className="w-3.5 h-3.5 text-green-500" strokeWidth={3} />, "Present"],
    [<X key="a" className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />, "Absent"],
    [<span key="h" className="text-xs font-bold text-yellow-500">½</span>, "Half Day"],
    [<Flag key="l" className="w-3.5 h-3.5 text-red-500" fill="currentColor" />, "On Leave"],
    [<Star key="ho" className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />, "Holiday"],
    [<Ban key="d" className="w-3.5 h-3.5 text-gray-500" />, "Day Off"],
    [<Minus key="f" className="w-3.5 h-3.5 text-gray-400" />, "Future"],
  ];

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Attendances" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Attendances</h2>
          <CreatePlusButton title="Create Attendance" onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={() => setPage(1)}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Search
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
            </select>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 text-gray-500" />
              <span>Filters</span>
              {filtersOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Employee</label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className={`keep-box ua-field ${inputCls}`}
              >
                <option value="">All Employees</option>
                {empOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`keep-box ua-field ${inputCls}`}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-36">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`keep-box ua-field ${inputCls}`}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setApplied({ employee: employeeFilter, month, year });
                setPage(1);
              }}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setEmployeeFilter("");
                setMonth(now.getMonth() + 1);
                setYear(now.getFullYear());
                setApplied({ employee: "", month: now.getMonth() + 1, year: now.getFullYear() });
                setPage(1);
              }}
              className="px-5 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 text-gray-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50/70 border-b border-blue-100 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-blue-700 tracking-wide uppercase">
          Attendance Report: {MONTHS[applied.month - 1]} {applied.year}
          {loading ? " · Loading…" : ""}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {legend.map(([icon, label]) => (
            <span key={label} className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
              {icon} {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="text-sm border-collapse w-full">
          <thead className="sticky top-0 z-20">
            <tr className="bg-white border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide min-w-[190px] border-r border-gray-100">
                Employee
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const dow = new Date(applied.year, applied.month - 1, d).getDay();
                const weekend = dow === 0 || dow === 6;
                return (
                  <th key={d} className={`px-1.5 py-2 text-center min-w-[38px] ${weekend ? "bg-gray-50" : "bg-white"}`}>
                    <div className="text-xs font-bold text-gray-900">{d}</div>
                    <div className="text-[9px] font-medium text-gray-400">{DOW[dow]}</div>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase bg-white min-w-[64px]">Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {visible.map((emp) => (
              <tr key={emp.employee_user_id} className="hover:bg-gray-50/60">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5 border-r border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={emp.name || "?"} size={8} />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-[13px] truncate">{emp.name}</div>
                      <div className="text-[11px] text-gray-400 truncate">{emp.employee_code || emp.email}</div>
                    </div>
                  </div>
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                  const cell = resolveCell(emp, applied.year, applied.month, d, cells);
                  const dow = new Date(applied.year, applied.month - 1, d).getDay();
                  const weekend = dow === 0 || dow === 6;
                  const clickable = cell.status !== "future" && !(cell.status === "dayoff" && !cell.record);
                  return (
                    <td
                      key={d}
                      onClick={() => clickable && openEdit(emp, d)}
                      className={`px-1 py-2 text-center align-middle ${weekend ? "bg-orange-50/40" : ""} ${clickable ? "cursor-pointer hover:bg-blue-50" : ""}`}
                      title={clickable ? "Edit attendance" : undefined}
                    >
                      <CellIcon cell={cell} />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center">
                  <div className="text-sm font-bold text-blue-600">{totalFor(emp)}</div>
                  <div className="text-[10px] text-gray-400">/{workDays}</div>
                </td>
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={daysInMonth + 2} className="px-4 py-12 text-center text-gray-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of{" "}
          {filtered.length} results
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40"
          >
            ‹ Previous
          </button>
          <span className="px-2 text-gray-600">
            {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40"
          >
            Next ›
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" onMouseDown={() => setCreateOpen(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Attendance</h3>
              <button onClick={() => setCreateOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Employee" required>
                <IdSearchSelect
                  value={createDraft.employeeId}
                  onChange={(id) => setCreateDraft({ ...createDraft, employeeId: id })}
                  options={empOptions}
                  placeholder="Select Employee"
                />
              </Field>
              <Field label="Date" required>
                <AppDatePicker
                  value={createDraft.date}
                  onChange={(e) => setCreateDraft({ ...createDraft, date: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Clock In Time" required>
                <input
                  type="time"
                  value={createDraft.clockIn}
                  onChange={(e) => setCreateDraft({ ...createDraft, clockIn: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Clock Out Time">
                <input
                  type="time"
                  value={createDraft.clockOut}
                  onChange={(e) => setCreateDraft({ ...createDraft, clockOut: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Notes" className="md:col-span-2">
                <textarea
                  value={createDraft.notes}
                  onChange={(e) => setCreateDraft({ ...createDraft, notes: e.target.value })}
                  rows={3}
                  placeholder="Enter Notes"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void submitCreate()}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCell && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Attendance</h3>
              <button onClick={() => setEditCell(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Employee" required>
                <input value={editCell.emp.name} readOnly className={`${inputCls} bg-gray-50 text-gray-500`} />
              </Field>
              <Field label="Date" required>
                <AppDatePicker value={editCell.date} readOnly className={`${inputCls} bg-gray-50 text-gray-500`} />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      status,
                      clockIn: NON_CLOCK_STATUSES.has(status)
                        ? ""
                        : prev.clockIn || "09:00",
                      clockOut: NON_CLOCK_STATUSES.has(status)
                        ? ""
                        : prev.clockOut || "17:00",
                    }));
                  }}
                  className={`keep-box ua-field ${inputCls}`}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half day">Half Day</option>
                  <option value="on leave">On Leave</option>
                  <option value="off day">Off Day</option>
                </select>
              </Field>
              {!NON_CLOCK_STATUSES.has(normalizeEditStatus(draft.status)) ? (
                <>
                  <Field label="Clock In Time" required>
                    <input type="time" value={draft.clockIn} onChange={(e) => setDraft({ ...draft, clockIn: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Clock Out Time">
                    <input type="time" value={draft.clockOut} onChange={(e) => setDraft({ ...draft, clockOut: e.target.value })} className={inputCls} />
                  </Field>
                </>
              ) : (
                <div className="md:col-span-1 flex items-end pb-2 text-xs text-gray-500">
                  Clock in/out not required for this status.
                </div>
              )}
              <Field label="Notes" className="md:col-span-2">
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} className={inputCls} />
              </Field>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => setEditCell(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void submitEdit()}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendances;
