/**
 * File: src/pages/hrm/Promotions.tsx
 * Manage Promotions — fully API-backed (no local/Dexie / hardcoded masters).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { useResourceData } from "@/hooks/useResourceData";
import {
  promotionHooks,
  hrmStatusActions,
} from "@/services/hrm";
import {
  Field,
  inputCls,
  AsyncSearchSelect,
  Chip,
  HrmBreadcrumb,
  CreatePlusButton,
  apiLabel,
  searchEmployees,
  searchBranches,
  searchDepartments,
  searchDesignations,
  useHrmSearchListParams,
  HrmDocumentLink,
  HrmFileUploadButton,
  hrmFileLabel,
} from "./hrmShared";
import {
  Search,
  Filter,
  ChevronDown,
  Eye,
  Edit,
  Trash2,
  X,
  Play,
  Sparkles,
  UserRound,
  Calendar,
  Briefcase,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

interface PromotionRow {
  id: string;
  employee: string;
  employeeId: string;
  prevBranch: string;
  prevDepartment: string;
  prevDesignation: string;
  branch: string;
  branchId: string;
  department: string;
  departmentId: string;
  designation: string;
  designationId: string;
  effectiveDate: string;
  status: string;
  approvedBy: string;
  reason: string;
  document: string;
}

const emptyDraft = () => ({
  id: "",
  employeeId: "",
  employeeName: "",
  branchId: "",
  branchName: "",
  departmentId: "",
  departmentName: "",
  designationId: "",
  designationName: "",
  effectiveDate: "",
  reason: "",
  document: "",
  documentName: "",
});

function refName(v: any, keys: string[]): string {
  if (!v) return "";
  if (typeof v === "object") return apiLabel(v, keys) || "";
  return "";
}

function mapFromApi(p: any): PromotionRow {
  return {
    id: String(p.id ?? p._id ?? ""),
    employee: refName(p.employee_id, ["name"]) || apiLabel(p, ["employee"]) || "—",
    employeeId:
      typeof p.employee_id === "object"
        ? String(p.employee_id?._id ?? p.employee_id?.id ?? "")
        : String(p.employee_id ?? ""),
    prevBranch: refName(p.previous_branch_id, ["branch_name", "name"]) || "—",
    prevDepartment: refName(p.previous_department_id, ["department_name", "name"]) || "—",
    prevDesignation: refName(p.previous_designation_id, ["designation_name", "name"]) || "—",
    branch: refName(p.current_branch_id, ["branch_name", "name"]) || "—",
    branchId:
      typeof p.current_branch_id === "object"
        ? String(p.current_branch_id?._id ?? "")
        : String(p.current_branch_id ?? ""),
    department: refName(p.current_department_id, ["department_name", "name"]) || "—",
    departmentId:
      typeof p.current_department_id === "object"
        ? String(p.current_department_id?._id ?? "")
        : String(p.current_department_id ?? ""),
    designation: refName(p.current_designation_id, ["designation_name", "name"]) || "—",
    designationId:
      typeof p.current_designation_id === "object"
        ? String(p.current_designation_id?._id ?? "")
        : String(p.current_designation_id ?? ""),
    effectiveDate: String(p.effective_date ?? "").slice(0, 10),
    status: p.status || "Pending",
    approvedBy: refName(p.approved_by, ["name"]) || p.approved_by || "",
    reason: p.reason || "",
    document: p.document || "",
  };
}

export const Promotions: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove } = useResourceData(promotionHooks, {
    seed: [],
    params: listParams,
  });
  const items = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewPromotion, setViewPromotion] = useState<PromotionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromotionRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [listParams.searchTerm]);

  const filtered = useMemo(
    () => items.filter((p) => statusFilter === "All" || p.status === statusFilter),
    [items, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const submit = async () => {
    if (!draft.employeeId || !draft.branchId || !draft.departmentId || !draft.designationId || !draft.effectiveDate) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        employee_id: draft.employeeId,
        current_branch_id: draft.branchId,
        current_department_id: draft.departmentId,
        current_designation_id: draft.designationId,
        effective_date: draft.effectiveDate,
        reason: draft.reason || "Promotion request",
      };
      if (draft.document) payload.document = draft.document;
      if (modal === "edit" && draft.id) {
        await update(draft.id, payload);
        showToast("Promotion updated successfully", "success");
      } else {
        await create(payload);
        showToast("Promotion created successfully", "success");
      }
      setModal(null);
    } catch (err: any) {
      showToast(err?.message || "Couldn't save promotion", "error");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (p: PromotionRow) => {
    if (p.status === "Approved") {
      showToast("Promotion already approved", "info");
      return;
    }
    try {
      await hrmStatusActions.promotion(p.id, "Approved");
      showToast("Promotion approved", "success");
    } catch (err: any) {
      showToast(err?.message || "Couldn't approve promotion", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      showToast("Promotion deleted successfully", "success");
      setDeleteTarget(null);
    } catch (err: any) {
      showToast(err?.message || "Couldn't delete promotion", "error");
    }
  };

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Promotions" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Promotions</h2>
          <CreatePlusButton
            title="Create promotion"
            onClick={() => {
              setDraft(emptyDraft());
              setModal("create");
            }}
          />
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Promotions..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <button onClick={() => setPage(1)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
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
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                <Filter className="w-4 h-4 text-gray-500" />
                <span>Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Status</div>
                  {["All", "Approved", "Pending"].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setPage(1);
                        setShowFilters(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${statusFilter === s ? "text-blue-600 font-medium" : "text-gray-700"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1050px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                {["Employee", "Previous Branch", "Current Branch", "Current Designation", "Effective Date", "Status", "Approved By", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewPromotion(p)}>
                  <td className="px-4 py-3.5 font-medium text-gray-900">{p.employee}</td>
                  <td className="px-4 py-3.5 text-gray-600">{p.prevBranch}</td>
                  <td className="px-4 py-3.5 text-gray-600">{p.branch}</td>
                  <td className="px-4 py-3.5 text-gray-600">{p.designation}</td>
                  <td className="px-4 py-3.5 text-gray-600">{p.effectiveDate}</td>
                  <td className="px-4 py-3.5">
                    <Chip label={p.status} />
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{p.approvedBy || "-"}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {p.status === "Pending" ? (
                        <button
                          onClick={() => void approve(p)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                          title="Approve"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="w-7 h-7" />
                      )}
                      <button onClick={() => setViewPromotion(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDraft({
                            id: p.id,
                            employeeId: p.employeeId,
                            employeeName: p.employee,
                            branchId: p.branchId,
                            branchName: p.branch,
                            departmentId: p.departmentId,
                            departmentName: p.department,
                            designationId: p.designationId,
                            designationName: p.designation,
                            effectiveDate: p.effectiveDate,
                            reason: p.reason,
                            document: p.document || "",
                            documentName: hrmFileLabel(p.document || ""),
                          });
                          setModal("edit");
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No promotions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of{" "}
          {filtered.length} results
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            ‹ Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(0, 8)
            .map((p) => (
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

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{modal === "edit" ? "Edit Promotion" : "Create Promotion"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Employee" required>
                <AsyncSearchSelect
                  value={draft.employeeId}
                  displayName={draft.employeeName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, employeeId: id, employeeName: opt?.name || "" })
                  }
                  onSearch={searchEmployees}
                  placeholder="Search Employee"
                />
              </Field>
              <Field label="Current Branch" required>
                <AsyncSearchSelect
                  value={draft.branchId}
                  displayName={draft.branchName}
                  onChange={(id, opt) =>
                    setDraft({
                      ...draft,
                      branchId: id,
                      branchName: opt?.name || "",
                      departmentId: "",
                      departmentName: "",
                      designationId: "",
                      designationName: "",
                    })
                  }
                  onSearch={searchBranches}
                  placeholder="Search Branch"
                />
              </Field>
              <Field label="Current Department" required>
                <AsyncSearchSelect
                  value={draft.departmentId}
                  displayName={draft.departmentName}
                  onChange={(id, opt) =>
                    setDraft({
                      ...draft,
                      departmentId: id,
                      departmentName: opt?.name || "",
                      designationId: "",
                      designationName: "",
                    })
                  }
                  onSearch={(q) => searchDepartments(q, draft.branchId)}
                  placeholder="Search Department"
                  disabled={!draft.branchId}
                />
              </Field>
              <Field label="Current Designation" required>
                <AsyncSearchSelect
                  value={draft.designationId}
                  displayName={draft.designationName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, designationId: id, designationName: opt?.name || "" })
                  }
                  onSearch={(q) => searchDesignations(q, draft.departmentId)}
                  placeholder="Search Designation"
                  disabled={!draft.departmentId}
                />
              </Field>
              <Field label="Effective Date" required>
                <AppDatePicker
                  value={draft.effectiveDate}
                  onChange={(e) => setDraft({ ...draft, effectiveDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Reason">
                <div className="flex gap-2">
                  <textarea
                    value={draft.reason}
                    onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                    placeholder="Enter Reason"
                    rows={3}
                    className={`flex-1 ${inputCls}`}
                  />
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
              <Field label="Document">
                <HrmFileUploadButton
                  inputId="promotion-document-upload"
                  path={draft.document}
                  displayName={draft.documentName}
                  onUploaded={({ path, name }) =>
                    setDraft({ ...draft, document: path, documentName: name })
                  }
                />
              </Field>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : modal === "edit" ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewPromotion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <UserRound className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Promotion Details</h3>
              </div>
              <div className="flex items-center gap-3">
                <Chip label={viewPromotion.status} />
                <button onClick={() => setViewPromotion(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-5 py-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
                  <UserRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{viewPromotion.employee}</p>
                  <p className="text-sm text-gray-500">Employee</p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-6">
                <h4 className="text-center text-base font-bold text-gray-900 mb-6">Career Progression</h4>
                <div className="relative">
                  <div className="absolute left-1/2 top-2 bottom-2 w-px bg-blue-200 -translate-x-1/2" />
                  <div className="relative flex items-center mb-8">
                    <div className="w-1/2 pr-8">
                      <div className="bg-white rounded-lg shadow-sm border-l-4 border-red-400 px-4 py-3 text-right">
                        <p className="text-sm font-bold text-red-500 mb-1">Previous Position</p>
                        <p className="text-sm text-gray-700">{viewPromotion.prevDesignation}</p>
                        <p className="text-sm text-gray-500">{viewPromotion.prevDepartment}</p>
                        <p className="text-sm text-gray-500">{viewPromotion.prevBranch}</p>
                      </div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-red-400 rounded-full flex items-center justify-center ring-4 ring-white">
                      <Briefcase className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="relative flex items-center justify-end">
                    <div className="w-1/2 pl-8">
                      <div className="bg-white rounded-lg shadow-sm border-l-4 border-green-500 px-4 py-3">
                        <p className="text-sm font-bold text-green-600 mb-1">Current Position</p>
                        <p className="text-sm text-gray-700">{viewPromotion.designation}</p>
                        <p className="text-sm text-gray-500">{viewPromotion.department}</p>
                        <p className="text-sm text-gray-500">{viewPromotion.branch}</p>
                      </div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center ring-4 ring-white">
                      <Briefcase className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl px-5 py-4">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Promotion Details</h4>
                <div className="bg-blue-50/70 border border-blue-100 rounded-lg px-4 py-3 flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Effective Date</p>
                    <p className="font-semibold text-gray-900">{viewPromotion.effectiveDate}</p>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-gray-500 mb-1">Reason for Promotion</p>
                  <p className="text-sm text-gray-700">{viewPromotion.reason}</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500 mb-1">Document</p>
                  <HrmDocumentLink path={viewPromotion.document} />
                </div>
                {viewPromotion.approvedBy && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                    <UserRound className="w-4 h-4 text-gray-400" />
                    Approved By: <span className="font-medium text-gray-900">{viewPromotion.approvedBy}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Promotion?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This will permanently remove the promotion of <span className="font-medium text-gray-700">{deleteTarget.employee}</span>.
              </p>
              <div className="flex gap-3">
                <button onClick={() => void confirmDelete()} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  Delete
                </button>
                <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
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

export default Promotions;
