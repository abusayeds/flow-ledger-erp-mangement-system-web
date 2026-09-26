/**
 * File: src/pages/hrm/Holidays.tsx
 * Manage Holidays — matches the ERPGO reference
 * (references/hrm/holidays/*.png) in the Qayd blue theme.
 * Holidays persist in meta row `hrm:holidays`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { useHolidayTypes, type Holiday } from "@/lib/db/hrm";
import { useResourceData } from "@/hooks/useResourceData";
import { holidayHooks } from "@/services/hrm";
import { Field, inputCls, HrmBreadcrumb, CreatePlusButton, useHrmSearchListParams } from "./hrmShared";
import {
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Eye,
  Edit,
  Trash2,
  X,
  Sparkles,
  Calendar,
  Tag,
  Globe,
  FileText,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

function hday(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function mapHolidayFromApi(d: any): Holiday {
  return {
    id: String(d._id ?? d.id ?? ""),
    name: d.name || "",
    start: hday(d.start_date),
    end: hday(d.end_date),
    type: d.holiday_type_id?.holiday_type || "",
    description: d.description || "",
    paid: d.is_paid !== false,
    syncGoogle: !!d.is_sync_google_calendar,
    syncOutlook: !!d.is_sync_outlook_calendar,
  };
}

const emptyDraft = () => ({
  id: "",
  name: "",
  start: "",
  end: "",
  type: "",
  description: "",
  paid: false,
  syncGoogle: false,
  syncOutlook: false,
});

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

const yesNo = (v: boolean) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${v ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
    {v ? "Yes" : "No"}
  </span>
);

function holidayToApi(
  h: ReturnType<typeof emptyDraft>,
  holidayTypes: { id: string; name: string }[],
) {
  const typeId = holidayTypes.find((t) => t.name === h.type)?.id;
  return {
    name: h.name,
    start_date: h.start ? new Date(h.start).toISOString() : undefined,
    end_date: h.end ? new Date(h.end).toISOString() : undefined,
    holiday_type_id: typeId,
    description: h.description,
    is_paid: !!h.paid,
    is_sync_google_calendar: !!h.syncGoogle,
    is_sync_outlook_calendar: !!h.syncOutlook,
  };
}

export const Holidays: React.FC = () => {
  const navigate = useNavigate();
  const holidayTypes = useHolidayTypes();
  const typeNames = (holidayTypes || []).map((t) => t.name).filter(Boolean);

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove } = useResourceData(holidayHooks, {
    seed: [],
    params: listParams,
  });
  const list = useMemo(() => raw.map(mapHolidayFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewHoliday, setViewHoliday] = useState<Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  useEffect(() => {
    setPage(1);
  }, [listParams.searchTerm]);

  const filtered = useMemo(() => {
    const rows = list.filter((h) => typeFilter === "All" || h.type === typeFilter);
    rows.sort((a, b) => (sortAsc ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)));
    return rows;
  }, [list, typeFilter, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const submit = async () => {
    if (!draft.name || !draft.start || !draft.end || !draft.type || !draft.description) {
      showToast("Please fill all required fields", "error");
      return;
    }
    const types = holidayTypes || [];
    if (modal === "edit") {
      await update(draft.id, holidayToApi(draft, types));
      showToast("Holiday updated successfully", "success");
    } else {
      await create(holidayToApi(draft, types));
      showToast("Holiday created successfully", "success");
    }
    setModal(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    showToast("Holiday deleted successfully", "success");
    setDeleteTarget(null);
  };

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Holidays" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Holidays</h2>
          <CreatePlusButton
            title="Create holiday"
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
                placeholder="Search by holiday name or type..."
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
                <div className="absolute right-0 top-10 w-60 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 max-h-72 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Holiday Type</div>
                  {["All", ...typeNames].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTypeFilter(t);
                        setPage(1);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${typeFilter === t ? "text-blue-600 font-medium" : "text-gray-700"}`}
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

      {/* table */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 hover:text-gray-900">
                    Name <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Holiday Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Paid</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewHoliday(h)}>
                  <td className="px-4 py-3.5 font-medium text-gray-900">{h.name}</td>
                  <td className="px-4 py-3.5 text-gray-600">{h.start}</td>
                  <td className="px-4 py-3.5 text-gray-600">{h.end}</td>
                  <td className="px-4 py-3.5 text-gray-600">{h.type}</td>
                  <td className="px-4 py-3.5">{yesNo(h.paid)}</td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setViewHoliday(h)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDraft({ ...h });
                          setModal("edit");
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(h)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No holidays found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              <h3 className="text-lg font-semibold text-gray-900">{modal === "edit" ? "Edit Holiday" : "Create Holiday"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Name" required>
                <div className="flex gap-2">
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Name" className={`flex-1 ${inputCls}`} />
                  <button
                    type="button"
                    title="AI assist"
                    onClick={() => showToast("AI suggestions coming soon", "info")}
                    className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-md text-blue-600 hover:bg-blue-50 shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </Field>
              <Field label="Start Date" required>
                <AppDatePicker value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={inputCls} />
              </Field>
              <Field label="End Date" required>
                <AppDatePicker value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Holiday Type" required>
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={`keep-box ua-field ${inputCls}`}>
                  <option value="">Select Holiday Type</option>
                  {typeNames.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" required>
                <div className="flex gap-2">
                  <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Enter Description" rows={3} className={`flex-1 ${inputCls}`} />
                  <button
                    type="button"
                    title="AI assist"
                    onClick={() => showToast("AI suggestions coming soon", "info")}
                    className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-md text-blue-600 hover:bg-blue-50 shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </Field>
              {(
                [
                  ["Is Paid", "paid"],
                  ["Is Sync Google Calendar", "syncGoogle"],
                  ["Is Sync Outlook Calendar", "syncOutlook"],
                ] as [string, "paid" | "syncGoogle" | "syncOutlook"][]
              ).map(([label, key]) => (
                <div key={key} className="flex items-center gap-3">
                  <Toggle on={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v })} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
              ))}
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
      {viewHoliday && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Holiday Details</h3>
              </div>
              <button onClick={() => setViewHoliday(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Calendar className="w-4 h-4" /> Holiday Name</div>
                  <p className="font-semibold text-gray-900">{viewHoliday.name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Tag className="w-4 h-4" /> Holiday Type</div>
                  <p className="font-semibold text-gray-900">{viewHoliday.type}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Calendar className="w-4 h-4" /> Start Date</div>
                  <p className="font-semibold text-gray-900">{viewHoliday.start}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Calendar className="w-4 h-4" /> End Date</div>
                  <p className="font-semibold text-gray-900">{viewHoliday.end}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Tag className="w-4 h-4" /> Paid</div>
                  {yesNo(viewHoliday.paid)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Globe className="w-4 h-4" /> Google Calendar Sync</div>
                  {yesNo(viewHoliday.syncGoogle)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Globe className="w-4 h-4" /> Outlook Calendar Sync</div>
                  {yesNo(viewHoliday.syncOutlook)}
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1.5 text-sm"><FileText className="w-4 h-4" /> Description</div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700">
                  {viewHoliday.description}
                </div>
              </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Holiday?</h3>
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
