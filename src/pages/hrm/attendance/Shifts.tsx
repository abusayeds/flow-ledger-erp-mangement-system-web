/**
 * File: src/pages/hrm/attendance/Shifts.tsx
 * Manage Shifts — matches the ERPGO reference
 * (references/hrm/attendence/{shifts,create shift,edit shift,shift details}.png)
 * in the Qayd blue theme. Shifts persist in meta row `hrm:shifts`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { type Shift } from "@/lib/db/hrm";
import { useResourceData } from "@/hooks/useResourceData";
import { shiftHooks } from "@/services/hrm";
import { Field, inputCls, HrmBreadcrumb, CreatePlusButton, useHrmSearchListParams } from "../hrmShared";
import {
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Eye,
  Edit,
  Trash2,
  X,
  List,
  LayoutGrid,
  Clock,
  FileText,
  User,
  Calendar,
  Sun,
} from "lucide-react";

function mapShiftFromApi(d: any): Shift {
  return {
    id: String(d._id ?? d.id ?? ""),
    name: d.shift_name || d.name || "",
    start: d.start_time || "",
    end: d.end_time || "",
    breakStart: d.break_start_time || d.break_start || "",
    breakEnd: d.break_end_time || d.break_end || "",
    night: !!d.is_night_shift,
    createdBy: "Company",
    createdAt: String(d.createdAt ?? "").slice(0, 10),
  };
}

function shiftToApi(s: Partial<Shift>) {
  return {
    shift_name: s.name,
    start_time: s.start,
    end_time: s.end,
    break_start_time: s.breakStart,
    break_end_time: s.breakEnd,
    is_night_shift: !!s.night,
  };
}

const emptyDraft = () => ({
  id: "",
  name: "",
  start: "",
  end: "",
  breakStart: "",
  breakEnd: "",
  night: false,
});

export const Shifts: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove } = useResourceData(shiftHooks, {
    seed: [],
    params: listParams,
  });
  const list = useMemo(() => raw.map(mapShiftFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [nightFilter, setNightFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewShift, setViewShift] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

  useEffect(() => {
    setPage(1);
  }, [listParams.searchTerm]);

  const filtered = useMemo(() => {
    const rows = list.filter(
      (s) => nightFilter === "All" || (nightFilter === "Night" ? s.night : !s.night),
    );
    rows.sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
    return rows;
  }, [list, nightFilter, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const submit = async () => {
    if (!draft.name || !draft.start || !draft.end || !draft.breakStart || !draft.breakEnd) {
      showToast("Please fill all required fields", "error");
      return;
    }
    if (modal === "edit") {
      await update(draft.id, shiftToApi(draft));
      showToast("Shift updated successfully", "success");
    } else {
      await create(shiftToApi(draft));
      showToast("Shift created successfully", "success");
    }
    setModal(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    showToast("Shift deleted successfully", "success");
    setDeleteTarget(null);
  };

  const nightChip = (night: boolean) => (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${night ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
      {night ? "Yes" : "No"}
    </span>
  );

  const actions = (s: Shift) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setViewShift(s)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          setDraft({ id: s.id, name: s.name, start: s.start, end: s.end, breakStart: s.breakStart, breakEnd: s.breakEnd, night: s.night });
          setModal("edit");
        }}
        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
        title="Edit"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Shifts" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Shifts</h2>
          <CreatePlusButton
            title="Create shift"
            onClick={() => {
              setDraft(emptyDraft());
              setModal("create");
            }}
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
                placeholder="Search Shifts..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <button onClick={() => showToast("Search applied", "info")} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
              Search
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button onClick={() => setView("list")} title="List view" className={`px-2.5 py-1.5 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setView("grid")} title="Grid view" className={`px-2.5 py-1.5 border-l border-gray-300 ${view === "grid" ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
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
            <div className="relative">
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
                <Filter className="w-4 h-4 text-gray-500" />
                <span>Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Shift Type</div>
                  {["All", "Day", "Night"].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setNightFilter(t);
                        setPage(1);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${nightFilter === t ? "text-blue-600 font-medium" : "text-gray-700"}`}
                    >
                      {t}
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
        {view === "list" ? (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 hover:text-gray-900">
                    Shift Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Start Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">End Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Night Shift</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Created By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewShift(s)}>
                  <td className="px-4 py-3.5 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3.5 text-gray-600">{s.start}</td>
                  <td className="px-4 py-3.5 text-gray-600">{s.end}</td>
                  <td className="px-4 py-3.5">{nightChip(s.night)}</td>
                  <td className="px-4 py-3.5 text-gray-600">{s.createdBy}</td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {actions(s)}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No shifts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-semibold text-gray-900">{s.name}</span>
                  </div>
                  {nightChip(s.night)}
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-400">Time</span><span>{s.start} – {s.end}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Break</span><span>{s.breakStart} – {s.breakEnd}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Created By</span><span>{s.createdBy}</span></div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">{actions(s)}</div>
              </div>
            ))}
            {paginated.length === 0 && <div className="col-span-full py-12 text-center text-gray-500">No shifts found.</div>}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} results
        </span>
        <div className="flex items-center gap-1">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50">
            ‹ Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-md ${p === page ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50 border border-gray-300"}`}>
              {p}
            </button>
          ))}
          <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50">
            Next ›
          </button>
        </div>
      </div>

      {/* create / edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{modal === "edit" ? "Edit Shift" : "Create Shift"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Shift Name" required>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Shift Name" className={inputCls} />
              </Field>
              <Field label="Start Time" required>
                <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={inputCls} />
              </Field>
              <Field label="End Time" required>
                <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Break Start Time" required>
                <input type="time" value={draft.breakStart} onChange={(e) => setDraft({ ...draft, breakStart: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Break End Time" required>
                <input type="time" value={draft.breakEnd} onChange={(e) => setDraft({ ...draft, breakEnd: e.target.value })} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input type="checkbox" checked={draft.night} onChange={(e) => setDraft({ ...draft, night: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                Is Night Shift
              </label>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
                {modal === "edit" ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* details modal */}
      {viewShift && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Shift Details</h3>
                  <p className="text-sm text-gray-500">{viewShift.name}</p>
                </div>
              </div>
              <button onClick={() => setViewShift(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {(
                [
                  [FileText, "Shift Name", viewShift.name, false],
                  [Clock, "Break Start Time", viewShift.breakStart, false],
                  [Clock, "Start Time", viewShift.start, false],
                  [Clock, "Break End Time", viewShift.breakEnd, false],
                  [Clock, "End Time", viewShift.end, false],
                  [User, "Created By", viewShift.createdBy, false],
                  [Sun, "Night Shift", viewShift.night ? "Yes" : "No", true],
                  [Calendar, "Created At", viewShift.createdAt, false],
                ] as [React.ElementType, string, string, boolean][]
              ).map(([Icon, label, value, chip]) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <Icon className="w-4 h-4" /> {label}
                  </div>
                  {chip ? (
                    nightChip(viewShift.night)
                  ) : (
                    <p className="font-semibold text-gray-900">{value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Shift?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This will permanently remove <span className="font-medium text-gray-700">{deleteTarget.name}</span>.
              </p>
              <div className="flex gap-3">
                <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
                <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
