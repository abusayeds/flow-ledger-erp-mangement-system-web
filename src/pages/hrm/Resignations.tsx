/**
 * File: src/pages/hrm/Resignations.tsx
 * Complete Resignations Management page with list view, create/edit modal, and details modal
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
  UserMinus,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import { resignationHooks, hrmStatusActions } from "@/services/hrm";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  apiLabel as empApiLabel,
  employeeUserId,
  searchEmployees,
  useHrmSearchListParams,
  HrmDocumentLink,
  HrmFileUploadButton,
  hrmFileLabel,
} from "./hrmShared";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Resignation {
  id: string;
  employeeId?: string;
  employee: string;
  resignationDate: string;
  lastWorkingDate: string;
  reason: string;
  description: string;
  document: string;
  status: "Pending" | "Accepted" | "Rejected" | "Cancelled";
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

function mapFromApi(p: any): Resignation {
  const empField = p.employee_id ?? p.employeeId;
  return {
    id: String(p.id ?? p._id ?? ""),
    employeeId: employeeRefValue(empField),
    employee: employeeRefLabel(empField, p.employee),
    resignationDate: (p.resignation_date ?? p.resignationDate ?? p.createdAt ?? "").slice(0, 10),
    lastWorkingDate: (p.last_working_date ?? p.lastWorkingDate ?? "").slice(0, 10),
    reason: p.reason ?? "",
    description: p.description ?? "",
    document: p.document ?? "",
    status: (() => {
      const s = (p.status ?? "pending").toLowerCase();
      if (s === "accepted") return "Accepted";
      if (s === "rejected") return "Rejected";
      if (s === "cancelled") return "Cancelled";
      return "Pending";
    })() as Resignation["status"],
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

type SortField = "employee" | "resignationDate" | "lastWorkingDate" | "status";
type SortDir = "asc" | "desc";

// ─── Main Component ──────────────────────────────────────────────────────────

export const Resignations: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove, refetch } = useResourceData(
    resignationHooks,
    { seed: [], params: listParams },
  );
  const resignations = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("resignationDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedResignation, setSelectedResignation] =
    useState<Resignation | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [resignationFormData, setResignationFormData] = useState({
    employee: "",
    employeeLabel: "",
    lastWorkingDate: "",
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

  const filteredResignations = useMemo(() => {
    let result =
      statusFilter === "All"
        ? [...resignations]
        : resignations.filter((r) => r.status === statusFilter);

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
  }, [resignations, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredResignations.length / perPage);
  const paginatedResignations = filteredResignations.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetResignationForm = () => {
    setResignationFormData({
      employee: "",
      employeeLabel: "",
      lastWorkingDate: "",
      reason: "",
      description: "",
      documentPath: "",
      documentName: "",
    });
  };

  const openCreateModal = () => {
    resetResignationForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (resignation: Resignation) => {
    setSelectedResignation(resignation);
    setResignationFormData({
      employee: resignation.employeeId || "",
      employeeLabel: resignation.employee,
      lastWorkingDate: resignation.lastWorkingDate,
      reason: resignation.reason,
      description: resignation.description,
      documentPath: resignation.document,
      documentName: hrmFileLabel(resignation.document),
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (resignation: Resignation) => {
    setSelectedResignation(resignation);
    setShowViewModal(true);
  };

  const openDeleteModal = (resignation: Resignation) => {
    setSelectedResignation(resignation);
    setShowDeleteModal(true);
  };

  const handleStatusUpdate = async (
    id: string,
    newStatus: "Accepted" | "Rejected",
  ) => {
    try {
      await hrmStatusActions.resignation(id, newStatus.toLowerCase());
      refetch();
      showToast(`Resignation ${newStatus.toLowerCase()} successfully!`, "success");
    } catch {
      showToast("Action failed.", "error");
    }
  };

  const handleSaveResignation = async () => {
    if (!resignationFormData.employee) {
      showToast("Please select an employee", "info");
      return;
    }
    if (!resignationFormData.lastWorkingDate) {
      showToast("Please select last working date", "info");
      return;
    }
    if (!resignationFormData.reason) {
      showToast("Please enter a reason", "info");
      return;
    }

    const payload: Record<string, string> = {
      employee_id: resignationFormData.employee,
      last_working_date: resignationFormData.lastWorkingDate,
      reason: resignationFormData.reason,
      description: resignationFormData.description,
    };
    if (resignationFormData.documentPath) {
      payload.document = resignationFormData.documentPath;
    }

    try {
      if (isEditing && selectedResignation) {
        await update(selectedResignation.id, payload);
        showToast("Resignation updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(payload);
        showToast("Resignation created successfully!", "success");
        setShowCreateModal(false);
      }
      resetResignationForm();
    } catch {
      showToast("Operation failed.", "error");
    }
  };

  const handleDeleteResignation = async () => {
    if (selectedResignation) {
      try {
        await remove(selectedResignation.id);
        showToast("Resignation deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedResignation(null);
      } catch {
        showToast("Delete failed.", "error");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Accepted":
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
      case "Accepted":
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
              {isEditing ? "Edit Resignation" : "Create Resignation"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditing
                ? "Update resignation information"
                : "Add a new resignation"}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetResignationForm();
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
              value={resignationFormData.employee}
              displayName={resignationFormData.employeeLabel}
              onChange={(id, opt) =>
                setResignationFormData({
                  ...resignationFormData,
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
              Last Working Date *
            </label>
            <AppDatePicker
              value={resignationFormData.lastWorkingDate}
              onChange={(e) =>
                setResignationFormData({
                  ...resignationFormData,
                  lastWorkingDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <textarea
              value={resignationFormData.reason}
              onChange={(e) =>
                setResignationFormData({
                  ...resignationFormData,
                  reason: e.target.value,
                })
              }
              rows={3}
              placeholder="Enter reason"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={resignationFormData.description}
              onChange={(e) =>
                setResignationFormData({
                  ...resignationFormData,
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
              inputId="resignation-document-upload"
              path={resignationFormData.documentPath}
              displayName={resignationFormData.documentName}
              onUploaded={({ path, name }) =>
                setResignationFormData({
                  ...resignationFormData,
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
              resetResignationForm();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveResignation}
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
              Resignation Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedResignation?.employee}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedResignation && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedResignation.employee}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedResignation.status)}`}
              >
                {getStatusIcon(selectedResignation.status)}
                {selectedResignation.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Resignation Date</p>
              <p className="text-sm text-gray-600">
                {formatDate(selectedResignation.resignationDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Working Date</p>
              <p className="text-sm text-gray-600">
                {formatDate(selectedResignation.lastWorkingDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reason</p>
              <p className="text-sm text-gray-600">
                {selectedResignation.reason}
              </p>
            </div>
            {selectedResignation.description && (
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-600">
                  {selectedResignation.description}
                </p>
              </div>
            )}
            {selectedResignation.approvedBy && (
              <div>
                <p className="text-xs text-gray-500">Approved By</p>
                <p className="text-sm text-gray-600">
                  {selectedResignation.approvedBy} at{" "}
                  {formatDate(selectedResignation.approvedAt)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Document</p>
              <HrmDocumentLink path={selectedResignation.document} />
            </div>
          </div>
        )}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between gap-3">
          <div className="flex gap-2">
            {selectedResignation?.status === "Pending" && (
              <>
                <button
                  onClick={() => {
                    if (selectedResignation)
                      handleStatusUpdate(selectedResignation.id, "Accepted");
                    setShowViewModal(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Accept
                </button>
                <button
                  onClick={() => {
                    if (selectedResignation)
                      handleStatusUpdate(selectedResignation.id, "Rejected");
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
                if (selectedResignation) openEditModal(selectedResignation);
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
            Delete Resignation
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete this resignation for{" "}
            <span className="font-semibold">
              {selectedResignation?.employee}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteResignation}
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
          <span className="text-gray-900 font-medium">Resignations</span>
        </div>
      </div>
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Resignations
          </h2>
          <CreatePlusButton onClick={openCreateModal} title="Create resignation" />
        </div>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Resignations..."
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
                      setStatusFilter("Accepted");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Accepted
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
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="employee" label="Employee" />
                <SortHeader field="resignationDate" label="Date" />
                <SortHeader field="lastWorkingDate" label="Last Working" />
                <SortHeader field="status" label="Status" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Document
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedResignations.map((resignation) => (
                <tr
                  key={resignation.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(resignation)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserMinus className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {resignation.employee}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(resignation.resignationDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(resignation.lastWorkingDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(resignation.status)}`}
                    >
                      {getStatusIcon(resignation.status)}
                      {resignation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <HrmDocumentLink path={resignation.document} className="max-w-[180px]" />
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(resignation)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(resignation)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(resignation)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedResignations.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No resignations found.
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
            {filteredResignations.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredResignations.length)} of{" "}
            {filteredResignations.length} results
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
