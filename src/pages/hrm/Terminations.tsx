/**
 * File: src/pages/hrm/Terminations.tsx
 * Complete Terminations Management page with list view, create/edit modal, and details modal
 * Based on provided screenshots design
 */

import React, { useEffect, useState, useMemo } from "react";
import { refLabel } from "@/services/_http";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
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
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  UserX,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import { terminationHooks, hrmStatusActions } from "@/services/hrm";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  employeeUserId,
  apiLabel as empApiLabel,
  searchEmployees,
  searchTerminationTypes,
  useHrmSearchListParams,
  HrmDocumentLink,
  HrmFileUploadButton,
  hrmFileLabel,
} from "./hrmShared";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Termination {
  id: string;
  employeeId?: string;
  employee: string;
  terminationTypeId?: string;
  terminationType: string;
  noticeDate: string;
  terminationDate: string;
  reason: string;
  description: string;
  document: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
}

// ─── mapFromApi ───────────────────────────────────────────────────────────────

const employeeRefValue = (ref: any) =>
  ref && typeof ref === "object" ? employeeUserId(ref) : String(ref ?? "");

const employeeRefLabel = (ref: any, fallback: any = "") =>
  typeof ref === "object"
    ? empApiLabel(ref, ["employee_user_id", "user_id", "name", "employee_name"]) || String(fallback || "")
    : String(fallback || ref || "");

function mapFromApi(p: any): Termination {
  const empField = p.employee_id ?? p.employeeId;
  const ttField = p.termination_type_id ?? p.terminationTypeId;
  return {
    id: String(p.id ?? p._id ?? ""),
    employeeId: employeeRefValue(empField),
    employee: employeeRefLabel(empField, p.employee),
    terminationTypeId:
      typeof ttField === "object"
        ? String(ttField?._id ?? ttField?.id ?? "")
        : String(ttField ?? ""),
    terminationType:
      typeof ttField === "object"
        ? ttField?.name ?? ttField?.termination_type ?? ""
        : String(p.terminationType ?? ttField ?? ""),
    noticeDate: (p.notice_date ?? p.noticeDate ?? "").slice(0, 10),
    terminationDate: (p.termination_date ?? p.terminationDate ?? "").slice(0, 10),
    reason: p.reason ?? "",
    description: p.description ?? "",
    document: p.document ?? "",
    status: (() => {
      const s = (p.status ?? "pending").toLowerCase();
      if (s === "approved") return "Approved";
      if (s === "rejected") return "Rejected";
      if (s === "cancelled") return "Cancelled";
      return "Pending";
    })() as Termination["status"],
    approvedBy: refLabel(p.approved_by ?? p.approvedBy),
    approvedAt: (p.approved_at ?? p.approvedAt ?? "").slice(0, 10),
    createdAt: (p.createdAt ?? p.created_at ?? "").slice(0, 10),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  | "terminationType"
  | "noticeDate"
  | "terminationDate"
  | "status";
type SortDir = "asc" | "desc";

// ─── Main Component ──────────────────────────────────────────────────────────

export const Terminations: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove, refetch } = useResourceData(
    terminationHooks,
    { seed: [], params: listParams },
  );
  const terminations = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("terminationDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTermination, setSelectedTermination] =
    useState<Termination | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [terminationFormData, setTerminationFormData] = useState({
    employee: "",
    employeeLabel: "",
    terminationType: "",
    terminationTypeLabel: "",
    noticeDate: "",
    terminationDate: "",
    reason: "",
    description: "",
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

  const filteredTerminations = useMemo(() => {
    let result =
      statusFilter === "All"
        ? [...terminations]
        : terminations.filter((t) => t.status === statusFilter);

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [terminations, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredTerminations.length / perPage);
  const paginatedTerminations = filteredTerminations.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetTerminationForm = () => {
    setTerminationFormData({
      employee: "",
      employeeLabel: "",
      terminationType: "",
      terminationTypeLabel: "",
      noticeDate: "",
      terminationDate: "",
      reason: "",
      description: "",
      documentPath: "",
      documentName: "",
    });
  };

  const openCreateModal = () => {
    resetTerminationForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (termination: Termination) => {
    setSelectedTermination(termination);
    setTerminationFormData({
      employee: termination.employeeId || "",
      employeeLabel: termination.employee,
      terminationType: termination.terminationTypeId || "",
      terminationTypeLabel: termination.terminationType,
      noticeDate: termination.noticeDate,
      terminationDate: termination.terminationDate,
      reason: termination.reason,
      description: termination.description,
      documentPath: termination.document,
      documentName: hrmFileLabel(termination.document),
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (termination: Termination) => {
    setSelectedTermination(termination);
    setShowViewModal(true);
  };

  const openDeleteModal = (termination: Termination) => {
    setSelectedTermination(termination);
    setShowDeleteModal(true);
  };

  const handleStatusUpdate = async (
    id: string,
    newStatus: "Approved" | "Rejected",
  ) => {
    try {
      await hrmStatusActions.termination(id, newStatus.toLowerCase());
      refetch();
      showToast(`Termination ${newStatus.toLowerCase()} successfully!`, "success");
    } catch {
      showToast("Action failed.", "error");
    }
  };

  const handleSaveTermination = async () => {
    if (!terminationFormData.employee) {
      showToast("Please select an employee", "info");
      return;
    }
    if (!terminationFormData.terminationType) {
      showToast("Please select termination type", "info");
      return;
    }
    if (!terminationFormData.noticeDate) {
      showToast("Please select notice date", "info");
      return;
    }
    if (!terminationFormData.terminationDate) {
      showToast("Please select termination date", "info");
      return;
    }
    if (!terminationFormData.reason) {
      showToast("Please enter a reason", "info");
      return;
    }
    if (terminationFormData.noticeDate > terminationFormData.terminationDate) {
      showToast("Notice date cannot be after termination date", "error");
      return;
    }

    const payload: Record<string, string> = {
      employee_id: terminationFormData.employee,
      termination_type_id: terminationFormData.terminationType,
      notice_date: terminationFormData.noticeDate,
      termination_date: terminationFormData.terminationDate,
      reason: terminationFormData.reason,
      description: terminationFormData.description,
    };
    if (terminationFormData.documentPath) {
      payload.document = terminationFormData.documentPath;
    }

    try {
      if (isEditing && selectedTermination) {
        await update(selectedTermination.id, payload);
        showToast("Termination updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(payload);
        showToast("Termination created successfully!", "success");
        setShowCreateModal(false);
      }
      resetTerminationForm();
    } catch {
      showToast("Operation failed.", "error");
    }
  };

  const handleDeleteTermination = async () => {
    if (selectedTermination) {
      try {
        await remove(selectedTermination.id);
        showToast("Termination deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedTermination(null);
      } catch {
        showToast("Delete failed.", "error");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Rejected":
        return "bg-red-100 text-red-700";
      case "Cancelled":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="w-3 h-3" />;
      case "Pending":
        return <Clock className="w-3 h-3" />;
      case "Rejected":
        return <X className="w-3 h-3" />;
      case "Cancelled":
        return <AlertCircle className="w-3 h-3" />;
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

  const CreateEditModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Termination" : "Create Termination"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditing
                ? "Update termination information"
                : "Add a new termination"}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetTerminationForm();
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
              value={terminationFormData.employee}
              displayName={terminationFormData.employeeLabel}
              onChange={(id, opt) =>
                setTerminationFormData({
                  ...terminationFormData,
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
              Termination Type *
            </label>
            <AsyncSearchSelect
              value={terminationFormData.terminationType}
              displayName={terminationFormData.terminationTypeLabel}
              onChange={(id, opt) =>
                setTerminationFormData({
                  ...terminationFormData,
                  terminationType: id,
                  terminationTypeLabel: opt?.name ?? "",
                })
              }
              onSearch={searchTerminationTypes}
              placeholder="Search termination type..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notice Date *
              </label>
              <AppDatePicker
                value={terminationFormData.noticeDate}
                onChange={(e) =>
                  setTerminationFormData({
                    ...terminationFormData,
                    noticeDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Termination Date *
              </label>
              <AppDatePicker
                value={terminationFormData.terminationDate}
                onChange={(e) =>
                  setTerminationFormData({
                    ...terminationFormData,
                    terminationDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={terminationFormData.reason}
              onChange={(e) =>
                setTerminationFormData({
                  ...terminationFormData,
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
              Description
            </label>
            <textarea
              value={terminationFormData.description}
              onChange={(e) =>
                setTerminationFormData({
                  ...terminationFormData,
                  description: e.target.value,
                })
              }
              rows={2}
              placeholder="Enter Description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document
            </label>
            <HrmFileUploadButton
              inputId="termination-document-upload"
              path={terminationFormData.documentPath}
              displayName={terminationFormData.documentName}
              onUploaded={({ path, name }) =>
                setTerminationFormData({
                  ...terminationFormData,
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
              resetTerminationForm();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveTermination}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {isEditing ? "Update" : "Create"}
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
              Termination Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedTermination?.employee}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedTermination && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedTermination.employee}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTermination.status)}`}
              >
                {getStatusIcon(selectedTermination.status)}
                {selectedTermination.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Termination Type</p>
                <p className="text-sm text-gray-600">
                  {selectedTermination.terminationType}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Notice Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedTermination.noticeDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Termination Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedTermination.terminationDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Approved By</p>
                <p className="text-sm text-gray-600">
                  {selectedTermination.approvedBy || "-"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reason</p>
              <p className="text-sm text-gray-600">
                {selectedTermination.reason}
              </p>
            </div>
            {selectedTermination.description && (
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-600">
                  {selectedTermination.description}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Document</p>
              <HrmDocumentLink path={selectedTermination.document} />
            </div>
          </div>
        )}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between gap-3">
          <div className="flex gap-2">
            {selectedTermination?.status === "Pending" && (
              <>
                <button
                  onClick={() => {
                    if (selectedTermination)
                      handleStatusUpdate(selectedTermination.id, "Approved");
                    setShowViewModal(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (selectedTermination)
                      handleStatusUpdate(selectedTermination.id, "Rejected");
                    setShowViewModal(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Reject
                </button>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowViewModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={() => {
                setShowViewModal(false);
                if (selectedTermination) openEditModal(selectedTermination);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Edit
            </button>
          </div>
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
            Delete Termination
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete this termination record for{" "}
            <span className="font-semibold">
              {selectedTermination?.employee}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteTermination}
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
          <span className="text-gray-900 font-medium">Terminations</span>
        </div>
      </div>
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Terminations
          </h2>
          <CreatePlusButton onClick={openCreateModal} title="Create termination" />
        </div>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Employee Name..."
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
                      setStatusFilter("Rejected");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Rejected
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="employee" label="Employee Name" />
                <SortHeader field="terminationType" label="Termination Type" />
                <SortHeader field="noticeDate" label="Notice Date" />
                <SortHeader field="terminationDate" label="Termination Date" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Document
                </th>
                <SortHeader field="status" label="Status" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Approved By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedTerminations.map((termination) => (
                <tr
                  key={termination.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(termination)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {termination.employee}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {termination.terminationType}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(termination.noticeDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(termination.terminationDate)}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <HrmDocumentLink path={termination.document} className="max-w-[180px]" />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(termination.status)}`}
                    >
                      {getStatusIcon(termination.status)}
                      {termination.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {termination.approvedBy || "-"}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(termination)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(termination)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(termination)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedTerminations.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No terminations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-sm text-gray-500">
            Showing{" "}
            {filteredTerminations.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredTerminations.length)} of{" "}
            {filteredTerminations.length} results
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

      {(showCreateModal || showEditModal) && CreateEditModal()}
      {showViewModal && ViewModal()}
      {showDeleteModal && DeleteModal()}
    </div>
  );
};
