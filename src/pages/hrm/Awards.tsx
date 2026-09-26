/**
 * File: src/pages/hrm/Awards.tsx
 * Complete Awards Management page with list view, create/edit modal, and details modal
 * Based on provided screenshots design
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  searchAwardTypes,
  searchEmployees,
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
  Award,
  User,
  FileText,
  Upload,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import { awardHooks } from "@/services/hrm";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Award {
  id: string;
  employeeId: string;
  employee: string;
  awardTypeId: string;
  awardType: string;
  awardDate: string;
  description: string;
  certificate: string;
  certificateUrl: string;
  createdAt: string;
}

// ─── mapFromApi ───────────────────────────────────────────────────────────────

function mapFromApi(p: any): Award {
  const empField = p.employee_id ?? p.employeeId;
  const atField = p.award_type_id ?? p.awardTypeId;
  return {
    id: String(p.id ?? p._id ?? ""),
    employeeId:
      typeof empField === "object"
        ? String(empField?._id ?? empField?.id ?? "")
        : String(empField ?? ""),
    employee:
      typeof empField === "object"
        ? empField?.name ?? empField?.employee_name ?? ""
        : String(p.employee ?? empField ?? ""),
    awardTypeId:
      typeof atField === "object"
        ? String(atField?._id ?? atField?.id ?? "")
        : String(atField ?? ""),
    awardType:
      typeof atField === "object"
        ? atField?.name ?? atField?.award_type ?? ""
        : String(p.awardType ?? atField ?? ""),
    awardDate: (p.award_date ?? p.awardDate ?? "").slice(0, 10),
    description: p.description ?? "",
    certificate: p.certificate ?? "",
    certificateUrl: p.certificate_url ?? p.certificateUrl ?? "",
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

type SortField = "employee" | "awardType" | "awardDate";
type SortDir = "asc" | "desc";

// ─── Main Component ──────────────────────────────────────────────────────────

export const Awards: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove } = useResourceData(awardHooks, {
    seed: [],
    params: listParams,
  });
  const items = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("awardDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [awardTypeFilter, setAwardTypeFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAward, setSelectedAward] = useState<Award | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [awardFormData, setAwardFormData] = useState({
    employee: "",
    employeeLabel: "",
    awardType: "",
    awardTypeLabel: "",
    awardDate: "",
    description: "",
    certificatePath: "",
    certificateName: "",
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

  const filteredAwards = useMemo(() => {
    let result = [...items];

    if (awardTypeFilter !== "All") {
      result = result.filter((a) => a.awardType === awardTypeFilter);
    }

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
  }, [items, awardTypeFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredAwards.length / perPage);
  const paginatedAwards = filteredAwards.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetAwardForm = () => {
    setAwardFormData({
      employee: "",
      employeeLabel: "",
      awardType: "",
      awardTypeLabel: "",
      awardDate: "",
      description: "",
      certificatePath: "",
      certificateName: "",
    });
  };

  const openCreateModal = () => {
    resetAwardForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (award: Award) => {
    setSelectedAward(award);
    setAwardFormData({
      employee: award.employeeId,
      employeeLabel: award.employee,
      awardType: award.awardTypeId,
      awardTypeLabel: award.awardType,
      awardDate: award.awardDate,
      description: award.description,
      certificatePath: award.certificate,
      certificateName: hrmFileLabel(award.certificate),
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (award: Award) => {
    setSelectedAward(award);
    setShowViewModal(true);
  };

  const openDeleteModal = (award: Award) => {
    setSelectedAward(award);
    setShowDeleteModal(true);
  };

  const handleSaveAward = async () => {
    if (!awardFormData.employee) {
      showToast("Please select an employee", "info");
      return;
    }
    if (!awardFormData.awardType) {
      showToast("Please select an award type", "info");
      return;
    }
    if (!awardFormData.awardDate) {
      showToast("Please select award date", "info");
      return;
    }
    if (!awardFormData.description) {
      showToast("Please enter description", "info");
      return;
    }

    const payload: Record<string, string> = {
      employee_id: awardFormData.employee,
      award_type_id: awardFormData.awardType,
      award_date: awardFormData.awardDate,
      description: awardFormData.description,
    };
    if (awardFormData.certificatePath) {
      payload.certificate = awardFormData.certificatePath;
    }

    try {
      if (isEditing && selectedAward) {
        await update(selectedAward.id, payload);
        showToast("Award updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(payload);
        showToast("Award created successfully!", "success");
        setShowCreateModal(false);
      }
      resetAwardForm();
    } catch {
      showToast("Operation failed.", "error");
    }
  };

  const handleDeleteAward = async () => {
    if (selectedAward) {
      try {
        await remove(selectedAward.id);
        showToast("Award deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedAward(null);
      } catch {
        showToast("Delete failed.", "error");
      }
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

  // ─── Get unique award types for filter
  const uniqueAwardTypes = useMemo(() => {
    const types = [...new Set(items.map((a) => a.awardType))];
    return ["All", ...types];
  }, [items]);

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
              {isEditing ? "Edit Award" : "Create Award"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditing ? "Update award information" : "Add a new award"}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetAwardForm();
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
              value={awardFormData.employee}
              displayName={awardFormData.employeeLabel}
              onChange={(id, opt) =>
                setAwardFormData({
                  ...awardFormData,
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
              Award Type *
            </label>
            <AsyncSearchSelect
              value={awardFormData.awardType}
              displayName={awardFormData.awardTypeLabel}
              onChange={(id, opt) =>
                setAwardFormData({
                  ...awardFormData,
                  awardType: id,
                  awardTypeLabel: opt?.name ?? "",
                })
              }
              onSearch={searchAwardTypes}
              placeholder="Search award type..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Award Date *
            </label>
            <AppDatePicker
              value={awardFormData.awardDate}
              onChange={(e) =>
                setAwardFormData({
                  ...awardFormData,
                  awardDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={awardFormData.description}
              onChange={(e) =>
                setAwardFormData({
                  ...awardFormData,
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
              Certificate
            </label>
            <HrmFileUploadButton
              inputId="award-certificate-upload"
              path={awardFormData.certificatePath}
              displayName={awardFormData.certificateName}
              onUploaded={({ path, name }) =>
                setAwardFormData({
                  ...awardFormData,
                  certificatePath: path,
                  certificateName: name,
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
              resetAwardForm();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAward}
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
              Award Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedAward?.employee}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedAward && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Employee Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedAward.employee}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Award Type</p>
                <p className="text-sm text-gray-600">
                  {selectedAward.awardType}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Award Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedAward.awardDate)}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-600">
                  {selectedAward.description}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Certificate</p>
                <HrmDocumentLink path={selectedAward.certificate} />
              </div>
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
              if (selectedAward) openEditModal(selectedAward);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit Award
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
            Delete Award
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete this award for{" "}
            <span className="font-semibold">{selectedAward?.employee}</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteAward}
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
          <span className="text-gray-900 font-medium">Awards</span>
        </div>
      </div>
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Awards</h2>
          <CreatePlusButton onClick={openCreateModal} title="Create award" />
        </div>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Awards..."
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
                      Award Type
                    </span>
                  </div>
                  {uniqueAwardTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setAwardTypeFilter(type);
                        setCurrentPage(1);
                        setShowFilters(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {type}
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
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="employee" label="Employee" />
                <SortHeader field="awardType" label="Award Type" />
                <SortHeader field="awardDate" label="Award Date" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Certificate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedAwards.map((award) => (
                <tr
                  key={award.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(award)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {award.employee}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{award.awardType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(award.awardDate)}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <HrmDocumentLink path={award.certificate} className="max-w-[180px]" />
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(award)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(award)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(award)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedAwards.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No awards found.
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
            {filteredAwards.length === 0 ? 0 : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredAwards.length)} of{" "}
            {filteredAwards.length} results
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
