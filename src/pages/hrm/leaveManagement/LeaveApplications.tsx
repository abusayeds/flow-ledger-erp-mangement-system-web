/**
 * Manage Leave Applications — API-backed via /hrm/leave.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { useLeaveTypes, type LeaveApplication } from "@/lib/db/hrm";
import {
  Field,
  inputCls,
  Chip,
  HrmBreadcrumb,
  CreatePlusButton,
  AsyncSearchSelect,
  employeeOption,
  useHrmSearchListParams,
  HrmDocumentLink,
  HrmFileUploadButton,
  hrmFileLabel,
} from "../hrmShared";
import { useResourceData } from "@/hooks/useResourceData";
import {
  leaveHooks,
  leaveApi,
  employeesService,
  leaveTypesService,
} from "@/services/hrm";
import { toArray } from "@/services/_http";
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
  FileText,
  User,
  Clock,
  Tag,
  Calendar,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

type LeaveRow = LeaveApplication & {
  leaveTypeColor?: string;
  leaveTypePaid?: boolean;
};

const capStatus = (s?: string): LeaveApplication["status"] => {
  const v = (s || "pending").toLowerCase();
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  return "Pending";
};

function mapFromApi(row: Record<string, unknown>): LeaveRow {
  const emp = row.employee_id as Record<string, unknown> | string | undefined;
  const lt = row.leave_type_id as Record<string, unknown> | string | undefined;
  const approved = row.approved_by as Record<string, unknown> | undefined;
  return {
    id: String(row.id ?? row._id ?? ""),
    employee:
      typeof emp === "object" && emp
        ? String(emp.name ?? "")
        : "",
    employeeUserId:
      typeof emp === "object" && emp
        ? String(emp._id ?? emp.id ?? "")
        : emp
          ? String(emp)
          : "",
    leaveType: typeof lt === "object" && lt ? String(lt.name ?? "") : "",
    leaveTypeId:
      typeof lt === "object" && lt ? String(lt._id ?? lt.id ?? "") : lt ? String(lt) : "",
    leaveTypeColor: typeof lt === "object" && lt ? String(lt.color ?? "") : undefined,
    leaveTypePaid: typeof lt === "object" && lt ? lt.is_paid !== false : undefined,
    start: String(row.start_date ?? "").slice(0, 10),
    end: String(row.end_date ?? "").slice(0, 10),
    days: Number(row.total_days ?? 0),
    status: capStatus(row.status as string | undefined),
    appliedOn: String(row.createdAt ?? "").slice(0, 10),
    reason: String(row.reason ?? ""),
    document: row.attachment ? String(row.attachment) : "",
    approvedBy: approved?.name ? String(approved.name) : undefined,
    approvedAt: row.approved_at ? String(row.approved_at).slice(0, 10) : undefined,
    comment: String(row.approver_comment ?? row.comment ?? ""),
  };
}

const emptyDraft = () => ({
  id: "",
  employeeUserId: "",
  employeeName: "",
  leaveTypeId: "",
  leaveTypeName: "",
  start: "",
  end: "",
  reason: "",
  document: "",
  documentName: "",
});

export const LeaveApplications: React.FC = () => {
  const navigate = useNavigate();
  const leaveTypes = useLeaveTypes();
  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery, 200);
  const { items: raw, create, update, remove, refetch } = useResourceData(leaveHooks, {
    seed: [],
    params: listParams,
  });
  const list = useMemo(() => raw.map((r) => mapFromApi(r as Record<string, unknown>)), [raw]);
  const types = leaveTypes || [];

  const searchEmployees = useCallback(async (q: string) => {
    const res = await employeesService.list({ page: 1, limit: 50, searchTerm: q });
    return toArray(res)
      .map(employeeOption)
      .filter((o) => o.id && o.name);
  }, []);

  const searchLeaveTypes = useCallback(async (q: string) => {
    const res = await leaveTypesService.list({ page: 1, limit: 50, searchTerm: q });
    return toArray(res)
      .map((t: Record<string, unknown>) => ({
        id: String(t.id ?? t._id ?? ""),
        name: String(t.name ?? ""),
      }))
      .filter((o) => o.id && o.name);
  }, []);

  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewApp, setViewApp] = useState<LeaveRow | null>(null);
  const [actionApp, setActionApp] = useState<LeaveRow | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LeaveRow | null>(null);
  const [saving, setSaving] = useState(false);
  const typeOf = (a: LeaveRow) => {
    const fromRow =
      a.leaveTypeColor != null
        ? { color: a.leaveTypeColor, paid: a.leaveTypePaid ?? true, name: a.leaveType }
        : undefined;
    return fromRow || types.find((t) => t.id === a.leaveTypeId || t.name === a.leaveType);
  };

  useEffect(() => {
    setPage(1);
  }, [listParams.searchTerm]);

  const filtered = useMemo(
    () => list.filter((a) => statusFilter === "All" || a.status === statusFilter),
    [list, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const submit = async () => {
    if (!draft.employeeUserId || !draft.leaveTypeId || !draft.start || !draft.end || !draft.reason) {
      showToast("Please fill all required fields", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        employee_id: draft.employeeUserId,
        leave_type_id: draft.leaveTypeId,
        start_date: draft.start,
        end_date: draft.end,
        reason: draft.reason,
      };
      if (draft.document) payload.attachment = draft.document;
      if (modal === "edit" && draft.id) {
        await update(draft.id, payload);
        showToast("Leave application updated successfully", "success");
      } else {
        await create(payload);
        showToast("Leave application created successfully", "success");
      }
      setModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't save leave application";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const takeAction = async (status: "Approved" | "Rejected") => {
    if (!actionApp) return;
    try {
      await leaveApi.setStatus(actionApp.id, status.toLowerCase(), actionComment || undefined);
      await refetch();
      showToast(`Leave application ${status.toLowerCase()}`, "success");
      setActionApp(null);
      setActionComment("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't update status";
      showToast(msg, "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      showToast("Leave application deleted successfully", "success");
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't delete leave application";
      showToast(msg, "error");
    }
  };

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }]} current="Leave Applications" onNavigate={navigate} />

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Leave Applications</h2>
          <CreatePlusButton
            title="Create leave application"
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
                placeholder="Search LeaveApplications..."
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
              <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50">
                <Filter className="w-4 h-4 text-gray-500" />
                <span>Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">Status</div>
                  {["All", "Pending", "Approved", "Rejected"].map((s) => (
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
                {["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status", "Applied On", "Document", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((a) => {
                const t = typeOf(a);
                return (
                  <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewApp(a)}>
                    <td className="px-4 py-3.5 font-medium text-gray-900">{a.employee}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t?.color || "#9CA3AF" }} />
                        <div>
                          <div className="text-gray-900">{a.leaveType}</div>
                          <span className={`inline-flex px-1.5 py-0 rounded text-[10px] font-medium ${t?.paid !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {t?.paid !== false ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{a.start}</td>
                    <td className="px-4 py-3.5 text-gray-600">{a.end}</td>
                    <td className="px-4 py-3.5 text-gray-600">{a.days}</td>
                    <td className="px-4 py-3.5"><Chip label={a.status} /></td>
                    <td className="px-4 py-3.5 text-gray-600">{a.appliedOn}</td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <HrmDocumentLink path={a.document} className="max-w-[160px]" />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {a.status === "Pending" ? (
                          <>
                            <button
                              onClick={() => {
                                setActionApp(a);
                                setActionComment("");
                              }}
                              className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                              title="Take action"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDraft({
                                  id: a.id,
                                  employeeUserId: a.employeeUserId || "",
                                  employeeName: a.employee,
                                  leaveTypeId: a.leaveTypeId || "",
                                  leaveTypeName: a.leaveType,
                                  start: a.start,
                                  end: a.end,
                                  reason: a.reason,
                                  document: a.document || "",
                                  documentName: hrmFileLabel(a.document || ""),
                                });
                                setModal("edit");
                              }}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="w-7 h-7" />
                            <span className="w-7 h-7" />
                          </>
                        )}
                        <button onClick={() => setViewApp(a)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(a)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">No leave applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{modal === "edit" ? "Edit Leave Application" : "Create Leave Application"}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Employee" required>
                <AsyncSearchSelect
                  value={draft.employeeUserId}
                  displayName={draft.employeeName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, employeeUserId: id, employeeName: opt?.name || draft.employeeName })
                  }
                  onSearch={searchEmployees}
                  placeholder="Select Employee"
                  disabled={modal === "edit"}
                />
              </Field>
              <Field label="Leave Type" required>
                <AsyncSearchSelect
                  value={draft.leaveTypeId}
                  displayName={draft.leaveTypeName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, leaveTypeId: id, leaveTypeName: opt?.name || draft.leaveTypeName })
                  }
                  onSearch={searchLeaveTypes}
                  placeholder="Select Leave Type"
                />
              </Field>
              <Field label="Start Date" required>
                <AppDatePicker value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={inputCls} />
              </Field>
              <Field label="End Date" required>
                <AppDatePicker value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Reason" required>
                <div className="flex gap-2">
                  <textarea value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="Enter Reason" rows={3} className={`flex-1 ${inputCls}`} />
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
              <Field label="Attachment">
                <HrmFileUploadButton
                  inputId="leave-attachment-upload"
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
              <button disabled={saving} onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-60">
                {modal === "edit" ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Leave Application Details</h3>
                  <p className="text-sm text-gray-500">{viewApp.employee}</p>
                </div>
              </div>
              <button onClick={() => setViewApp(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><User className="w-4 h-4" /> Employee</div>
                  <p className="font-semibold text-gray-900">{viewApp.employee}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Clock className="w-4 h-4" /> Total Days</div>
                  <p className="font-semibold text-gray-900">{viewApp.days}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Tag className="w-4 h-4" /> Leave Type</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: typeOf(viewApp)?.color || "#9CA3AF" }} />
                    <span className="font-semibold text-gray-900">{viewApp.leaveType}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><CheckCircle className="w-4 h-4" /> Status</div>
                  <Chip label={viewApp.status} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Calendar className="w-4 h-4" /> Start Date</div>
                  <p className="font-semibold text-gray-900">{viewApp.start}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><User className="w-4 h-4" /> Approved By</div>
                  <p className="font-semibold text-gray-900">{viewApp.approvedBy || "-"}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Calendar className="w-4 h-4" /> End Date</div>
                  <p className="font-semibold text-gray-900">{viewApp.end}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1"><Calendar className="w-4 h-4" /> Approved At</div>
                  <p className="font-semibold text-gray-900">{viewApp.approvedAt || "-"}</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1.5 text-sm"><FileText className="w-4 h-4" /> Reason</div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700">{viewApp.reason}</div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1.5 text-sm"><MessageSquare className="w-4 h-4" /> Approver Comment</div>
                <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-3 text-sm text-gray-700">{viewApp.comment || "-"}</div>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1.5 text-sm"><FileText className="w-4 h-4" /> Attachment</div>
                <HrmDocumentLink path={viewApp.document} />
              </div>
            </div>
          </div>
        </div>
      )}

      {actionApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Leave Action</h3>
              <button onClick={() => setActionApp(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-gray-900">{actionApp.employee}</p>
                <p className="text-gray-500 mt-0.5">
                  {actionApp.leaveType} · {actionApp.start} → {actionApp.end} ({actionApp.days} {actionApp.days === 1 ? "day" : "days"})
                </p>
              </div>
              <Field label="Approver Comment">
                <textarea value={actionComment} onChange={(e) => setActionComment(e.target.value)} placeholder="Enter comment (optional)" rows={3} className={inputCls} />
              </Field>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => takeAction("Rejected")} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium">
                Reject
              </button>
              <button onClick={() => takeAction("Approved")} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
                Approve
              </button>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Leave Application?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This will permanently remove the {deleteTarget.leaveType.toLowerCase()} application by <span className="font-medium text-gray-700">{deleteTarget.employee}</span>.
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
