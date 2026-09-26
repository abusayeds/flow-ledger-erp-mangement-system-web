/**
 * File: src/pages/hrm/Warnings.tsx
 * Complete Warnings Management page with list view, create/edit modal, and details modal
 * Based on provided screenshots design
 */

import React, { useEffect, useState, useMemo } from "react";
import { refLabel } from "@/services/_http";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  employeeUserId,
  apiLabel as empApiLabel,
  searchEmployees,
  searchWarningTypes,
  useHrmSearchListParams,
  HrmDocumentLink,
  HrmFileUploadButton,
  hrmFileLabel,
} from "./hrmShared";
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
  AlertTriangle,
  Flag,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import { warningHooks, hrmStatusActions } from "@/services/hrm";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Warning {
  id: string;
  employeeId?: string;
  employee: string;
  warningById?: string;
  warningBy: string;
  warningTypeId?: string;
  warningType: string;
  subject: string;
  severity: "High" | "Medium" | "Low";
  warningDate: string;
  description: string;
  document: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

// ─── mapFromApi ───────────────────────────────────────────────────────────────

const employeeRefValue = (ref: any) =>
  ref && typeof ref === "object" ? employeeUserId(ref) : String(ref ?? "");

const employeeRefLabel = (ref: any, fallback: any = "") =>
  typeof ref === "object"
    ? empApiLabel(ref, ["employee_user_id", "user_id", "name", "employee_name"]) || String(fallback || "")
    : String(fallback || ref || "");

const userRefValue = (ref: any) =>
  ref && typeof ref === "object" ? String(ref._id ?? ref.id ?? "") : String(ref ?? "");

function mapFromApi(p: any): Warning {
  const empField = p.employee_id ?? p.employeeId;
  const wtField = p.warning_type_id ?? p.warningTypeId;
  const sev = (p.severity ?? "medium");
  const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
  return {
    id: String(p.id ?? p._id ?? ""),
    employeeId: employeeRefValue(empField),
    employee: employeeRefLabel(empField, p.employee),
    warningById: userRefValue(p.warning_by ?? p.warningBy),
    warningBy: refLabel(p.warning_by ?? p.warningBy),
    warningTypeId:
      typeof wtField === "object"
        ? String(wtField?._id ?? wtField?.id ?? "")
        : String(wtField ?? ""),
    warningType:
      typeof wtField === "object"
        ? wtField?.name ?? wtField?.warning_type ?? ""
        : String(p.warningType ?? wtField ?? ""),
    subject: p.subject ?? "",
    severity: capFirst(sev) as Warning["severity"],
    warningDate: (p.warning_date ?? p.warningDate ?? "").slice(0, 10),
    description: p.description ?? "",
    document: p.document ?? "",
    status: (() => {
      const s = (p.status ?? "pending").toLowerCase();
      if (s === "approved") return "Approved";
      if (s === "rejected") return "Rejected";
      return "Pending";
    })() as Warning["status"],
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
  | "warningBy"
  | "warningType"
  | "subject"
  | "severity"
  | "warningDate"
  | "status";
type SortDir = "asc" | "desc";

const severities = ["High", "Medium", "Low"] as const;

// ─── Main Component ──────────────────────────────────────────────────────────

export const Warnings: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove, refetch } = useResourceData(
    warningHooks,
    { seed: [], params: listParams },
  );
  const warnings = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("warningDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [warningFormData, setWarningFormData] = useState({
    employee: "",
    employeeLabel: "",
    warningBy: "",
    warningByLabel: "",
    warningType: "",
    warningTypeLabel: "",
    subject: "",
    severity: "Medium" as "High" | "Medium" | "Low",
    warningDate: "",
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

  const filteredWarnings = useMemo(() => {
    let result = [...warnings];

    if (statusFilter !== "All") {
      result = result.filter((w) => w.status === statusFilter);
    }

    if (severityFilter !== "All") {
      result = result.filter((w) => w.severity === severityFilter);
    }

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "severity") {
        const severityOrder = { High: 3, Medium: 2, Low: 1 };
        aVal = severityOrder[a.severity];
        bVal = severityOrder[b.severity];
      }

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [warnings, statusFilter, severityFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredWarnings.length / perPage);
  const paginatedWarnings = filteredWarnings.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetWarningForm = () => {
    setWarningFormData({
      employee: "",
      employeeLabel: "",
      warningBy: "",
      warningByLabel: "",
      warningType: "",
      warningTypeLabel: "",
      subject: "",
      severity: "Medium",
      warningDate: "",
      description: "",
      documentPath: "",
      documentName: "",
    });
  };

  const openCreateModal = () => {
    resetWarningForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (warning: Warning) => {
    setSelectedWarning(warning);
    setWarningFormData({
      employee: warning.employeeId || "",
      employeeLabel: warning.employee,
      warningBy: warning.warningById || "",
      warningByLabel: warning.warningBy,
      warningType: warning.warningTypeId || "",
      warningTypeLabel: warning.warningType,
      subject: warning.subject,
      severity: warning.severity,
      warningDate: warning.warningDate,
      description: warning.description,
      documentPath: warning.document,
      documentName: hrmFileLabel(warning.document),
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (warning: Warning) => {
    setSelectedWarning(warning);
    setShowViewModal(true);
  };

  const openDeleteModal = (warning: Warning) => {
    setSelectedWarning(warning);
    setShowDeleteModal(true);
  };

  const handleStatusUpdate = async (
    id: string,
    newStatus: "Approved" | "Rejected",
  ) => {
    try {
      await hrmStatusActions.warningResponse(id, newStatus.toLowerCase());
      refetch();
      showToast(`Warning ${newStatus.toLowerCase()} successfully!`, "success");
    } catch {
      showToast("Action failed.", "error");
    }
  };

  const handleSaveWarning = async () => {
    if (!warningFormData.employee) {
      showToast("Please select an employee", "info");
      return;
    }
    if (!warningFormData.warningBy) {
      showToast("Please select warning by", "info");
      return;
    }
    if (!warningFormData.warningType) {
      showToast("Please select warning type", "info");
      return;
    }
    if (!warningFormData.subject) {
      showToast("Please enter subject", "info");
      return;
    }
    if (!warningFormData.warningDate) {
      showToast("Please select warning date", "info");
      return;
    }

    const payload: Record<string, string> = {
      employee_id: warningFormData.employee,
      warning_by: warningFormData.warningBy,
      warning_type_id: warningFormData.warningType,
      subject: warningFormData.subject,
      severity: warningFormData.severity.toLowerCase(),
      warning_date: warningFormData.warningDate,
      description: warningFormData.description,
    };
    if (warningFormData.documentPath) {
      payload.document = warningFormData.documentPath;
    }

    try {
      if (isEditing && selectedWarning) {
        await update(selectedWarning.id, payload);
        showToast("Warning updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(payload);
        showToast("Warning created successfully!", "success");
        setShowCreateModal(false);
      }
      resetWarningForm();
    } catch {
      showToast("Operation failed.", "error");
    }
  };

  const handleDeleteWarning = async () => {
    if (selectedWarning) {
      try {
        await remove(selectedWarning.id);
        showToast("Warning deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedWarning(null);
      } catch {
        showToast("Delete failed.", "error");
      }
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High":
        return "bg-red-100 text-red-700";
      case "Medium":
        return "bg-yellow-100 text-yellow-700";
      case "Low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "High":
        return <AlertTriangle className="w-3 h-3" />;
      case "Medium":
        return <AlertCircle className="w-3 h-3" />;
      case "Low":
        return <Flag className="w-3 h-3" />;
      default:
        return null;
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
              {isEditing ? "Edit Warning" : "Create Warning"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditing ? "Update warning information" : "Add a new warning"}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetWarningForm();
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
              value={warningFormData.employee}
              displayName={warningFormData.employeeLabel}
              onChange={(id, opt) =>
                setWarningFormData({
                  ...warningFormData,
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
              Warning By *
            </label>
            <AsyncSearchSelect
              value={warningFormData.warningBy}
              displayName={warningFormData.warningByLabel}
              onChange={(id, opt) =>
                setWarningFormData({
                  ...warningFormData,
                  warningBy: id,
                  warningByLabel: opt?.name ?? "",
                })
              }
              onSearch={searchEmployees}
              placeholder="Search issuer..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warning Type *
            </label>
            <AsyncSearchSelect
              value={warningFormData.warningType}
              displayName={warningFormData.warningTypeLabel}
              onChange={(id, opt) =>
                setWarningFormData({
                  ...warningFormData,
                  warningType: id,
                  warningTypeLabel: opt?.name ?? "",
                })
              }
              onSearch={searchWarningTypes}
              placeholder="Search warning type..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject *
            </label>
            <input
              type="text"
              value={warningFormData.subject}
              onChange={(e) =>
                setWarningFormData({
                  ...warningFormData,
                  subject: e.target.value,
                })
              }
              placeholder="Enter subject"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity *
            </label>
            <div className="flex gap-4">
              {severities.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="severity"
                    value={s}
                    checked={warningFormData.severity === s}
                    onChange={() =>
                      setWarningFormData({
                        ...warningFormData,
                        severity: s as any,
                      })
                    }
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warning Date *
            </label>
            <AppDatePicker
              value={warningFormData.warningDate}
              onChange={(e) =>
                setWarningFormData({
                  ...warningFormData,
                  warningDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={warningFormData.description}
              onChange={(e) =>
                setWarningFormData({
                  ...warningFormData,
                  description: e.target.value,
                })
              }
              rows={3}
              placeholder="Enter Description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document
            </label>
            <HrmFileUploadButton
              inputId="warning-document-upload"
              path={warningFormData.documentPath}
              displayName={warningFormData.documentName}
              onUploaded={({ path, name }) =>
                setWarningFormData({
                  ...warningFormData,
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
              resetWarningForm();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveWarning}
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
              Warning Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedWarning?.employee}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedWarning && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedWarning.employee}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedWarning.status)}`}
              >
                {getStatusIcon(selectedWarning.status)}
                {selectedWarning.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Warning By</p>
                <p className="text-sm text-gray-600">
                  {selectedWarning.warningBy}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Warning Type</p>
                <p className="text-sm text-gray-600">
                  {selectedWarning.warningType}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Subject</p>
                <p className="text-sm text-gray-600">
                  {selectedWarning.subject}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Severity</p>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(selectedWarning.severity)}`}
                >
                  {getSeverityIcon(selectedWarning.severity)}
                  {selectedWarning.severity}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Warning Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedWarning.warningDate)}
                </p>
              </div>
            </div>
            {selectedWarning.description && (
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-600">
                  {selectedWarning.description}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Document</p>
              <HrmDocumentLink path={selectedWarning.document} />
            </div>
          </div>
        )}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between gap-3">
          <div className="flex gap-2">
            {selectedWarning?.status === "Pending" && (
              <>
                <button
                  onClick={() => {
                    if (selectedWarning)
                      handleStatusUpdate(selectedWarning.id, "Approved");
                    setShowViewModal(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (selectedWarning)
                      handleStatusUpdate(selectedWarning.id, "Rejected");
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
                if (selectedWarning) openEditModal(selectedWarning);
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
            Delete Warning
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete this warning for{" "}
            <span className="font-semibold">{selectedWarning?.employee}</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteWarning}
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
          <span className="text-gray-900 font-medium">Warnings</span>
        </div>
      </div>
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Warnings
          </h2>
          <CreatePlusButton onClick={openCreateModal} title="Create warning" />
        </div>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Warnings..."
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
                <div className="absolute right-0 top-10 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-3 pb-2 mb-1 border-b border-gray-100">
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
                  <div className="px-3 pb-2 mt-2 mb-1 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      Severity
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSeverityFilter("All");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setSeverityFilter("High");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    High
                  </button>
                  <button
                    onClick={() => {
                      setSeverityFilter("Medium");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => {
                      setSeverityFilter("Low");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Low
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="employee" label="Employee Name" />
                <SortHeader field="warningBy" label="Warning By Name" />
                <SortHeader field="warningType" label="Warning Type" />
                <SortHeader field="subject" label="Subject" />
                <SortHeader field="severity" label="Severity" />
                <SortHeader field="warningDate" label="Warning Date" />
                <SortHeader field="status" label="Warning Status" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Document
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedWarnings.map((warning) => (
                <tr
                  key={warning.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(warning)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {warning.employee}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {warning.warningBy}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {warning.warningType}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {warning.subject}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(warning.severity)}`}
                    >
                      {getSeverityIcon(warning.severity)}
                      {warning.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(warning.warningDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(warning.status)}`}
                    >
                      {getStatusIcon(warning.status)}
                      {warning.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <HrmDocumentLink path={warning.document} className="max-w-[180px]" />
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(warning)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(warning)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(warning)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {paginatedWarnings.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No warnings found.
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
            {filteredWarnings.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredWarnings.length)} of{" "}
            {filteredWarnings.length} results
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
