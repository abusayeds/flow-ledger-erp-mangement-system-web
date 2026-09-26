/**
 * File: src/pages/hrm/EmployeeTransfers.tsx
 * Complete Employee Transfers Management page with list view, create/edit modal, and details modal
 * Based on provided screenshots design
 */

import React, { useEffect, useState, useMemo } from "react";
import { refLabel } from "@/services/_http";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  employeeUserId,
  apiLabel as empApiLabel,
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
  Edit,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  X,
  Eye,
  User,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Building2,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import { employeeTransferHooks, hrmStatusActions } from "@/services/hrm";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeTransfer {
  id: string;
  employeeId: string;
  employee: string;
  fromBranch: string;
  fromDepartment: string;
  fromDesignation: string;
  toBranchId: string;
  toBranch: string;
  toDepartmentId: string;
  toDepartment: string;
  toDesignationId: string;
  toDesignation: string;
  effectiveDate: string;
  reason: string;
  document: string;
  status: "Pending" | "Approved" | "In progress" | "Cancelled" | "Completed";
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const refId = (ref: any) =>
  ref && typeof ref === "object" ? String(ref._id ?? ref.id ?? "") : String(ref ?? "");

const employeeRefValue = (ref: any) =>
  ref && typeof ref === "object" ? employeeUserId(ref) : String(ref ?? "");

const employeeRefLabel = (ref: any, fallback: any = "") =>
  typeof ref === "object"
    ? empApiLabel(ref, ["employee_user_id", "user_id", "name", "employee_name"]) || String(fallback || "")
    : String(fallback || ref || "");

function mapFromApi(p: any): EmployeeTransfer {
  const empRef = p.employee_id;
  const toBranchRef = p.to_branch_id;
  const toDeptRef = p.to_department_id;
  const toDesigRef = p.to_designation_id;
  const fromBranchRef = p.from_branch_id ?? p.fromBranch;
  const fromDeptRef = p.from_department_id ?? p.fromDepartment;
  const fromDesigRef = p.from_designation_id ?? p.fromDesignation;
  return {
    id: String(p.id ?? p._id ?? ""),
    employeeId: employeeRefValue(empRef),
    employee: employeeRefLabel(empRef, p.employee),
    fromBranch:
      typeof fromBranchRef === "object"
        ? fromBranchRef?.branch_name ?? String(fromBranchRef?._id ?? "")
        : String(fromBranchRef ?? ""),
    fromDepartment:
      typeof fromDeptRef === "object"
        ? fromDeptRef?.department_name ?? String(fromDeptRef?._id ?? "")
        : String(fromDeptRef ?? ""),
    fromDesignation:
      typeof fromDesigRef === "object"
        ? fromDesigRef?.designation_name ?? String(fromDesigRef?._id ?? "")
        : String(fromDesigRef ?? ""),
    toBranchId: refId(toBranchRef),
    toBranch:
      typeof toBranchRef === "object"
        ? toBranchRef?.branch_name ?? empApiLabel(toBranchRef, ["branch_name", "name"])
        : String(p.toBranch ?? toBranchRef ?? ""),
    toDepartmentId: refId(toDeptRef),
    toDepartment:
      typeof toDeptRef === "object"
        ? toDeptRef?.department_name ?? empApiLabel(toDeptRef, ["department_name", "name"])
        : String(p.toDepartment ?? toDeptRef ?? ""),
    toDesignationId: refId(toDesigRef),
    toDesignation:
      typeof toDesigRef === "object"
        ? toDesigRef?.designation_name ?? empApiLabel(toDesigRef, ["designation_name", "name"])
        : String(p.toDesignation ?? toDesigRef ?? ""),
    effectiveDate: (p.effective_date ?? p.effectiveDate ?? "").slice(0, 10),
    reason: p.reason ?? "",
    document: p.document ?? "",
    status: p.status ?? "Pending",
    approvedBy: refLabel(p.approved_by ?? p.approvedBy),
    approvedAt: (p.approved_at ?? p.approvedAt ?? "").slice(0, 10),
    createdAt: (p.created_at ?? p.createdAt ?? "").slice(0, 10),
  };
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

type SortField =
  | "employee"
  | "transferPath"
  | "status"
  | "effectiveDate"
  | "approvedBy";
type SortDir = "asc" | "desc";

const transferStatuses = ["Pending", "Approved", "In progress", "Cancelled", "Completed"];

// ─── Main Component ──────────────────────────────────────────────────────────

export const EmployeeTransfers: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove, refetch } = useResourceData(
    employeeTransferHooks,
    { seed: [], params: listParams },
  );
  const transfers = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("effectiveDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] =
    useState<EmployeeTransfer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  // Form state
  const [transferFormData, setTransferFormData] = useState({
    employee: "",
    employeeLabel: "",
    toBranch: "",
    toBranchLabel: "",
    toDepartment: "",
    toDepartmentLabel: "",
    toDesignation: "",
    toDesignationLabel: "",
    effectiveDate: "",
    reason: "",
    documentPath: "",
    documentName: "",
  });

  // ─── Sorting ────────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // ─── Filtered & Sorted ─────────────────────────────────────────────────────

  useEffect(() => {
    setCurrentPage(1);
  }, [listParams.searchTerm]);

  const filteredTransfers = useMemo(() => {
    let result =
      statusFilter === "All" ? [...transfers] : transfers.filter((t) => t.status === statusFilter);

    result.sort((a, b) => {
      let aVal = (a as any)[sortField];
      let bVal = (b as any)[sortField];

      if (sortField === "transferPath") {
        aVal = `${a.fromBranch} to ${a.toBranch}`;
        bVal = `${b.fromBranch} to ${b.toBranch}`;
      }

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [transfers, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredTransfers.length / perPage);
  const paginatedTransfers = filteredTransfers.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetTransferForm = () => {
    setTransferFormData({
      employee: "",
      employeeLabel: "",
      toBranch: "",
      toBranchLabel: "",
      toDepartment: "",
      toDepartmentLabel: "",
      toDesignation: "",
      toDesignationLabel: "",
      effectiveDate: "",
      reason: "",
      documentPath: "",
      documentName: "",
    });
  };

  const openCreateModal = () => {
    resetTransferForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (transfer: EmployeeTransfer) => {
    setSelectedTransfer(transfer);
    setTransferFormData({
      employee: transfer.employeeId || "",
      employeeLabel: transfer.employee,
      toBranch: transfer.toBranchId || "",
      toBranchLabel: transfer.toBranch,
      toDepartment: transfer.toDepartmentId || "",
      toDepartmentLabel: transfer.toDepartment,
      toDesignation: transfer.toDesignationId || "",
      toDesignationLabel: transfer.toDesignation,
      effectiveDate: transfer.effectiveDate,
      reason: transfer.reason,
      documentPath: transfer.document,
      documentName: hrmFileLabel(transfer.document),
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (transfer: EmployeeTransfer) => {
    setSelectedTransfer(transfer);
    setShowViewModal(true);
  };

  const openStatusModal = (transfer: EmployeeTransfer) => {
    setSelectedTransfer(transfer);
    setNewStatus(transfer.status);
    setShowStatusModal(true);
  };

  const openDeleteModal = (transfer: EmployeeTransfer) => {
    setSelectedTransfer(transfer);
    setShowDeleteModal(true);
  };

  const handleStatusUpdate = async () => {
    if (selectedTransfer && newStatus) {
      try {
        await hrmStatusActions.employeeTransfer(selectedTransfer.id, newStatus);
        await refetch();
        showToast(`Transfer status updated to ${newStatus}!`, "success");
        setShowStatusModal(false);
      } catch {
        showToast("Failed to update status", "error");
      }
    }
  };

  const handleSaveTransfer = async () => {
    if (!transferFormData.employee) {
      showToast("Please select an employee", "info");
      return;
    }
    if (!transferFormData.toBranch) {
      showToast("Please select to branch", "info");
      return;
    }
    if (!transferFormData.toDepartment) {
      showToast("Please select to department", "info");
      return;
    }
    if (!transferFormData.toDesignation) {
      showToast("Please select to designation", "info");
      return;
    }
    if (!transferFormData.effectiveDate) {
      showToast("Please select effective date", "info");
      return;
    }

    const toApi: Record<string, any> = {
      employee_id: transferFormData.employee,
      to_branch_id: transferFormData.toBranch,
      to_department_id: transferFormData.toDepartment,
      to_designation_id: transferFormData.toDesignation,
      effective_date: transferFormData.effectiveDate,
      reason: transferFormData.reason,
    };
    if (transferFormData.documentPath) {
      toApi.document = transferFormData.documentPath;
    }

    try {
      if (isEditing && selectedTransfer) {
        await update(selectedTransfer.id, toApi);
        showToast("Transfer updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(toApi);
        showToast("Transfer created successfully!", "success");
        setShowCreateModal(false);
      }
      resetTransferForm();
    } catch {
      showToast("Failed to save transfer", "error");
    }
  };

  const handleDeleteTransfer = async () => {
    if (selectedTransfer) {
      try {
        await remove(selectedTransfer.id);
        showToast("Transfer deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedTransfer(null);
      } catch {
        showToast("Failed to delete transfer", "error");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-700";
      case "Completed":
        return "bg-blue-100 text-blue-700";
      case "In progress":
        return "bg-yellow-100 text-yellow-700";
      case "Pending":
        return "bg-orange-100 text-orange-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="w-3 h-3" />;
      case "Completed":
        return <CheckCircle className="w-3 h-3" />;
      case "In progress":
        return <Clock className="w-3 h-3" />;
      case "Pending":
        return <AlertCircle className="w-3 h-3" />;
      case "Cancelled":
        return <X className="w-3 h-3" />;
      default:
        return null;
    }
  };

  // ─── Sort Header ────────────────────────────────────────────────────────────

  const SortHeader: React.FC<{ field: SortField; label: string }> = ({
    field,
    label,
  }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-50 whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${sortField === field ? "text-gray-900" : "text-gray-400"}`}
        />
      </div>
    </th>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════

  const CreateEditModal = () => {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
      >
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing
                  ? "Edit Employee Transfer"
                  : "Create Employee Transfer"}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isEditing
                  ? "Update transfer information"
                  : "Add a new employee transfer"}
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                resetTransferForm();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee *
              </label>
              <AsyncSearchSelect
                value={transferFormData.employee}
                displayName={transferFormData.employeeLabel}
                onChange={(id, opt) =>
                  setTransferFormData({
                    ...transferFormData,
                    employee: id,
                    employeeLabel: opt?.name ?? "",
                  })
                }
                onSearch={searchEmployees}
                placeholder="Search employee..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Branch *
              </label>
              <AsyncSearchSelect
                value={transferFormData.toBranch}
                displayName={transferFormData.toBranchLabel}
                onChange={(id, opt) =>
                  setTransferFormData({
                    ...transferFormData,
                    toBranch: id,
                    toBranchLabel: opt?.name ?? "",
                    toDepartment: "",
                    toDepartmentLabel: "",
                    toDesignation: "",
                    toDesignationLabel: "",
                  })
                }
                onSearch={searchBranches}
                placeholder="Search branch..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Department *
              </label>
              <AsyncSearchSelect
                value={transferFormData.toDepartment}
                displayName={transferFormData.toDepartmentLabel}
                onChange={(id, opt) =>
                  setTransferFormData({
                    ...transferFormData,
                    toDepartment: id,
                    toDepartmentLabel: opt?.name ?? "",
                    toDesignation: "",
                    toDesignationLabel: "",
                  })
                }
                onSearch={(q) => searchDepartments(q, transferFormData.toBranch || undefined)}
                placeholder={transferFormData.toBranch ? "Search department..." : "Select branch first"}
                disabled={!transferFormData.toBranch}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Designation *
              </label>
              <AsyncSearchSelect
                value={transferFormData.toDesignation}
                displayName={transferFormData.toDesignationLabel}
                onChange={(id, opt) =>
                  setTransferFormData({
                    ...transferFormData,
                    toDesignation: id,
                    toDesignationLabel: opt?.name ?? "",
                  })
                }
                onSearch={(q) => searchDesignations(q, transferFormData.toDepartment || undefined)}
                placeholder={transferFormData.toDepartment ? "Search designation..." : "Select department first"}
                disabled={!transferFormData.toDepartment}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Date *
              </label>
              <AppDatePicker
                value={transferFormData.effectiveDate}
                onChange={(e) =>
                  setTransferFormData({
                    ...transferFormData,
                    effectiveDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason
              </label>
              <textarea
                value={transferFormData.reason}
                onChange={(e) =>
                  setTransferFormData({
                    ...transferFormData,
                    reason: e.target.value,
                  })
                }
                rows={3}
                placeholder="Enter Reason"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document
              </label>
              <HrmFileUploadButton
                inputId="transfer-document-upload"
                path={transferFormData.documentPath}
                displayName={transferFormData.documentName}
                onUploaded={({ path, name }) =>
                  setTransferFormData({
                    ...transferFormData,
                    documentPath: path,
                    documentName: name,
                  })
                }
              />
            </div>
          </div>
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                resetTransferForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveTransfer}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {isEditing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const StatusModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Update Transfer Status
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedTransfer?.employee}
            </p>
          </div>
          <button
            onClick={() => setShowStatusModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {transferStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
          <button
            onClick={() => setShowStatusModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStatusUpdate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Update Status
          </button>
        </div>
      </div>
    </div>
  );

  const ViewModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Transfer Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedTransfer?.employee}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedTransfer && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedTransfer.employee}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTransfer.status)}`}
              >
                {getStatusIcon(selectedTransfer.status)}
                {selectedTransfer.status}
              </span>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Transfer Path</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">
                  {selectedTransfer.fromBranch}
                </span>
                <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-blue-600">
                  {selectedTransfer.toBranch}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                From: {selectedTransfer.fromDepartment} -{" "}
                {selectedTransfer.fromDesignation}
                <br />
                To: {selectedTransfer.toDepartment} -{" "}
                {selectedTransfer.toDesignation}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Effective Date</p>
              <p className="text-sm text-gray-600">
                {formatDate(selectedTransfer.effectiveDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reason</p>
              <p className="text-sm text-gray-600">{selectedTransfer.reason}</p>
            </div>
            {selectedTransfer.approvedBy && (
              <div>
                <p className="text-xs text-gray-500">Approved By</p>
                <p className="text-sm text-gray-600">
                  {selectedTransfer.approvedBy}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Document</p>
              <HrmDocumentLink path={selectedTransfer.document} />
            </div>
          </div>
        )}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={() => setShowViewModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => {
              setShowViewModal(false);
              if (selectedTransfer) openEditModal(selectedTransfer);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );

  const DeleteModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Delete Transfer
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete this transfer for{" "}
            <span className="font-semibold">{selectedTransfer?.employee}</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteTransfer}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Breadcrumb */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => navigate("/")}
            className="hover:text-gray-700"
          >
            Dashboard
          </button>
          <span>›</span>
          <button
            onClick={() => navigate("/hrm")}
            className="hover:text-gray-700"
          >
            HRM
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">Employee Transfers</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Employee Transfers
          </h2>
          <CreatePlusButton onClick={openCreateModal} title="Create" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name or reason..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              onClick={() => showToast("Search applied", "info")}
              className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600"
            >
              Search
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
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
                <span className="text-gray-700">Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 pb-1.5 mb-1 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      Status
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setStatusFilter("All");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter("Pending");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter("Approved");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter("In progress");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    In progress
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter("Cancelled");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Cancelled
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="employee" label="Employee Name" />
                <SortHeader field="transferPath" label="Transfer Path" />
                <SortHeader field="status" label="Status" />
                <SortHeader field="effectiveDate" label="Effective Date" />
                <SortHeader field="approvedBy" label="Approved By" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Document
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedTransfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(transfer)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {transfer.employee}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {transfer.fromBranch} → {transfer.toBranch}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transfer.status)}`}
                    >
                      {getStatusIcon(transfer.status)}
                      {transfer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(transfer.effectiveDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {transfer.approvedBy || "-"}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <HrmDocumentLink path={transfer.document} className="max-w-[180px]" />
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(transfer)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(transfer)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openStatusModal(transfer)}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                        title="Update Status"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(transfer)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedTransfers.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No transfers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-sm text-gray-500">
            Showing{" "}
            {filteredTransfers.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredTransfers.length)} of{" "}
            {filteredTransfers.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`w-8 h-8 text-sm rounded-md flex items-center justify-center ${currentPage === pageNumber ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(showCreateModal || showEditModal) && CreateEditModal()}
      {showStatusModal && StatusModal()}
      {showViewModal && ViewModal()}
      {showDeleteModal && DeleteModal()}
    </div>
  );
};
