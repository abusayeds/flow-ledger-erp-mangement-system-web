/**
 * File: src/pages/hrm/leaveManagement/LeaveTypes.tsx
 * Manage Leave Types — matches the ERPGO reference
 * (references/hrm/leave types/*.png) in the Qayd blue theme.
 * Leave types persist in meta row `hrm:leaveTypes`.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { type LeaveType } from "@/lib/db/hrm";
import { useResourceData } from "@/hooks/useResourceData";
import { leaveTypeHooks } from "@/services/hrm";
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
  Calendar,
  FileText,
  Hash,
  DollarSign,
  Palette,
} from "lucide-react";

function mapLeaveTypeFromApi(d: any): LeaveType {
  return {
    id: String(d._id ?? d.id ?? ""),
    name: d.name || "",
    maxDays: d.max_days_per_year ?? 0,
    paid: d.is_paid !== false,
    color: d.color || "#3B82F6",
    description: d.description || "",
  };
}

function leaveTypeToApi(t: ReturnType<typeof emptyDraft>) {
  return {
    name: t.name,
    max_days_per_year: Number(t.maxDays) || 0,
    is_paid: !!t.paid,
    color: t.color,
    description: t.description,
  };
}

const emptyDraft = () => ({
  id: "",
  name: "",
  maxDays: 0,
  paid: false,
  color: "#FF6B6B",
  description: "",
});

const paidChip = (paid: boolean) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
    {paid ? "Paid" : "Unpaid"}
  </span>
);

export const LeaveTypes: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove } = useResourceData(leaveTypeHooks, {
    seed: [],
    params: listParams,
  });
  const list = useMemo(() => raw.map(mapLeaveTypeFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [paidFilter, setPaidFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewType, setViewType] = useState<LeaveType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);

  useEffect(() => {
    setPage(1);
  }, [listParams.searchTerm]);

  const filtered = useMemo(() => {
    const rows = list.filter(
      (t) => paidFilter === "All" || (paidFilter === "Paid" ? t.paid : !t.paid),
    );
    rows.sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
    return rows;
  }, [list, paidFilter, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const submit = async () => {
    if (!draft.name || !(Number(draft.maxDays) > 0) || !draft.color) {
      showToast("Please fill all required fields", "error");
      return;
    }
    if (modal === "edit") {
      await update(draft.id, leaveTypeToApi({ ...draft, maxDays: Number(draft.maxDays) }));
      showToast("Leave type updated successfully", "success");
    } else {
      await create(leaveTypeToApi({ ...draft, maxDays: Number(draft.maxDays) }));
      showToast("Leave type created successfully", "success");
    }
    setModal(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    showToast("Leave type deleted successfully", "success");
    setDeleteTarget(null);
  };

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Leave Types" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Leave Types</h2>
          <CreatePlusButton
            title="Create leave type"
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
                placeholder="Search Leave Types..."
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
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Is Paid</div>
                  {["All", "Paid", "Unpaid"].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPaidFilter(p);
                        setPage(1);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${paidFilter === p ? "text-blue-600 font-medium" : "text-gray-700"}`}
                    >
                      {p}
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
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 hover:text-gray-900">
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Max Days Per Year</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Is Paid</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewType(t)}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                    <span className="font-medium text-gray-900">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-gray-600">{t.maxDays}</td>
                <td className="px-4 py-3.5">{paidChip(t.paid)}</td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setViewType(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDraft({ ...t });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">No leave types found.</td>
              </tr>
            )}
          </tbody>
        </table>
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
              <h3 className="text-lg font-semibold text-gray-900">{modal === "edit" ? "Edit Leave Type" : "Create Leave Type"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Name" required>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Name" className={inputCls} />
              </Field>
              <Field label="Max Days Per Year" required>
                <input
                  type="number"
                  min={0}
                  value={draft.maxDays || ""}
                  onChange={(e) => setDraft({ ...draft, maxDays: Number(e.target.value) })}
                  placeholder="0"
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, paid: !draft.paid })}
                  className={`relative w-10 h-6 rounded-full transition-colors ${draft.paid ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${draft.paid ? "left-[18px]" : "left-0.5"}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">Is Paid</span>
              </label>
              <Field label="Color" required>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="w-14 h-9 border border-gray-300 rounded-md cursor-pointer bg-white p-1"
                  />
                  <input
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className={`flex-1 ${inputCls} uppercase`}
                  />
                </div>
              </Field>
              <Field label="Description">
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Enter Description" rows={3} className={inputCls} />
              </Field>
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
      {viewType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Leave Type Details</h3>
                  <p className="text-sm text-gray-500">{viewType.name}</p>
                </div>
              </div>
              <button onClick={() => setViewType(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><FileText className="w-4 h-4" /> Name</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: viewType.color }} />
                    <span className="font-semibold text-gray-900">{viewType.name}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><DollarSign className="w-4 h-4" /> Is Paid</div>
                  {paidChip(viewType.paid)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Hash className="w-4 h-4" /> Max Days Per Year</div>
                  <p className="font-semibold text-gray-900">{viewType.maxDays}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Palette className="w-4 h-4" /> Color</div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded" style={{ background: viewType.color }} />
                    <span className="font-semibold text-gray-900">{viewType.color}</span>
                  </div>
                </div>
              </div>
              {viewType.description && (
                <div className="mt-5">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1.5 text-sm"><FileText className="w-4 h-4" /> Description</div>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700">{viewType.description}</div>
                </div>
              )}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Leave Type?</h3>
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
