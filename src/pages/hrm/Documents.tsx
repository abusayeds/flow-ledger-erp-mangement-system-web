/**
 * File: src/pages/hrm/Documents.tsx
 * Complete Documents Management page with list view, create/edit modal, and details modal
 * Based on provided screenshots design
 */

import React, { useEffect, useState, useMemo } from "react";
import { refLabel } from "@/services/_http";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  searchDocumentCategories,
  useHrmSearchListParams,
  HrmDocumentLink,
  HrmFileUploadButton,
  hrmFileLabel,
  resolveHrmFileUrl,
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
  FileText,
  CheckCircle,
  Clock,
  File,
  Image,
  FileArchive,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import { documentHooks, hrmStatusActions } from "@/services/hrm";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  documentCategoryId?: string;
  documentCategory: string;
  description: string;
  effectiveDate: string;
  uploadedBy: string;
  approvedBy: string;
  status: "Approved" | "Pending" | "Rejected";
  documentUrl: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapFromApi(p: any): Document {
  const dcRef = p.document_category_id;
  const path = String(p.document ?? p.document_url ?? p.documentUrl ?? "");
  return {
    id: String(p.id ?? p._id ?? ""),
    title: p.title ?? "",
    documentCategoryId:
      typeof dcRef === "object" ? String(dcRef?._id ?? dcRef?.id ?? "") : String(dcRef ?? ""),
    documentCategory:
      typeof dcRef === "object"
        ? dcRef?.name ?? dcRef?.document_category ?? ""
        : String(p.documentCategory ?? p.document_category ?? dcRef ?? ""),
    description: p.description ?? "",
    effectiveDate: (p.effective_date ?? p.effectiveDate ?? "").slice(0, 10),
    uploadedBy: p.uploaded_by ?? p.uploadedBy ?? "",
    approvedBy: refLabel(p.approved_by ?? p.approvedBy),
    status: p.status ?? "Pending",
    documentUrl: path,
    fileName: p.file_name ?? p.fileName ?? hrmFileLabel(path),
    fileType: p.file_type ?? p.fileType ?? "",
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
  | "title"
  | "documentCategory"
  | "effectiveDate"
  | "uploadedBy"
  | "approvedBy"
  | "status";
type SortDir = "asc" | "desc";

const docFilterStatuses = ["All", "Approved", "Pending", "Rejected"];

// ─── Main Component ──────────────────────────────────────────────────────────

export const Documents: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove, refetch } = useResourceData(
    documentHooks,
    { seed: [], params: listParams },
  );
  const documents = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null,
  );
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [documentFormData, setDocumentFormData] = useState({
    title: "",
    documentCategory: "",
    documentCategoryLabel: "",
    description: "",
    effectiveDate: "",
    documentPath: "",
    fileName: "",
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

  const filteredDocuments = useMemo(() => {
    let result =
      statusFilter === "All" ? [...documents] : documents.filter((d) => d.status === statusFilter);

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
  }, [documents, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredDocuments.length / perPage);
  const paginatedDocuments = filteredDocuments.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetDocumentForm = () => {
    setDocumentFormData({
      title: "",
      documentCategory: "",
      documentCategoryLabel: "",
      description: "",
      effectiveDate: "",
      documentPath: "",
      fileName: "",
    });
  };

  const openCreateModal = () => {
    resetDocumentForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (doc: Document) => {
    setSelectedDocument(doc);
    setDocumentFormData({
      title: doc.title,
      documentCategory: doc.documentCategoryId || "",
      documentCategoryLabel: doc.documentCategory,
      description: doc.description,
      effectiveDate: doc.effectiveDate,
      documentPath: doc.documentUrl,
      fileName: doc.fileName || hrmFileLabel(doc.documentUrl),
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (doc: Document) => {
    setSelectedDocument(doc);
    setShowViewModal(true);
  };

  const openDeleteModal = (doc: Document) => {
    setSelectedDocument(doc);
    setShowDeleteModal(true);
  };

  const handleStatusUpdate = async (
    id: string,
    newStatus: "Approved" | "Rejected",
  ) => {
    try {
      await hrmStatusActions.document(id, newStatus);
      await refetch();
      showToast(`Document ${newStatus.toLowerCase()} successfully!`, "success");
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  const handleSaveDocument = async () => {
    if (!documentFormData.title) {
      showToast("Please enter document title", "info");
      return;
    }
    if (!documentFormData.documentCategory) {
      showToast("Please select document category", "info");
      return;
    }
    if (!documentFormData.description) {
      showToast("Please enter description", "info");
      return;
    }
    if (!isEditing && !documentFormData.documentPath) {
      showToast("Please upload a document", "info");
      return;
    }

    const toApi: Record<string, any> = {
      title: documentFormData.title,
      document_category_id: documentFormData.documentCategory,
      description: documentFormData.description,
      effective_date: documentFormData.effectiveDate,
    };
    if (documentFormData.documentPath) {
      toApi.document = documentFormData.documentPath;
    }

    try {
      if (isEditing && selectedDocument) {
        await update(selectedDocument.id, toApi);
        showToast("Document updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(toApi);
        showToast("Document created successfully!", "success");
        setShowCreateModal(false);
      }
      resetDocumentForm();
    } catch {
      showToast("Failed to save document", "error");
    }
  };

  const handleDeleteDocument = async () => {
    if (selectedDocument) {
      try {
        await remove(selectedDocument.id);
        showToast("Document deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedDocument(null);
      } catch {
        showToast("Failed to delete document", "error");
      }
    }
  };

  const handleDownloadDocument = (doc: Document) => {
    const href = resolveHrmFileUrl(doc.documentUrl);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
    else showToast("No document file available", "info");
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

  const getFileIcon = (fileName: string) => {
    const ext = fileName?.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="w-4 h-4 text-red-500" />;
    if (ext === "jpg" || ext === "png" || ext === "jpeg")
      return <Image className="w-4 h-4 text-blue-500" />;
    if (ext === "zip" || ext === "rar")
      return <FileArchive className="w-4 h-4 text-yellow-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
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
              {isEditing ? "Edit Document" : "Create Document"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditing ? "Update document information" : "Add a new document"}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetDocumentForm();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={documentFormData.title}
              onChange={(e) =>
                setDocumentFormData({
                  ...documentFormData,
                  title: e.target.value,
                })
              }
              placeholder="Enter Title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Category *
            </label>
            <AsyncSearchSelect
              value={documentFormData.documentCategory}
              displayName={documentFormData.documentCategoryLabel}
              onChange={(id, opt) =>
                setDocumentFormData({
                  ...documentFormData,
                  documentCategory: id,
                  documentCategoryLabel: opt?.name ?? "",
                })
              }
              onSearch={searchDocumentCategories}
              placeholder="Search category..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              value={documentFormData.description}
              onChange={(e) =>
                setDocumentFormData({
                  ...documentFormData,
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
              Effective Date
            </label>
            <AppDatePicker
              value={documentFormData.effectiveDate}
              onChange={(e) =>
                setDocumentFormData({
                  ...documentFormData,
                  effectiveDate: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document *
            </label>
            <HrmFileUploadButton
              inputId="hrm-documents-upload"
              path={documentFormData.documentPath}
              displayName={documentFormData.fileName}
              onUploaded={({ path, name }) =>
                setDocumentFormData({
                  ...documentFormData,
                  documentPath: path,
                  fileName: name,
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
              resetDocumentForm();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveDocument}
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
              Document Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedDocument?.title}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedDocument && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Title</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedDocument.title}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedDocument.status)}`}
              >
                {getStatusIcon(selectedDocument.status)}
                {selectedDocument.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Document Category</p>
                <p className="text-sm text-gray-600">
                  {selectedDocument.documentCategory}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Effective Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedDocument.effectiveDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Uploaded By</p>
                <p className="text-sm text-gray-600">
                  {selectedDocument.uploadedBy}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Approved By</p>
                <p className="text-sm text-gray-600">
                  {selectedDocument.approvedBy || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-600">
                  {selectedDocument.description}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Document</p>
              <div className="flex items-center gap-2">
                {selectedDocument.fileName ? getFileIcon(selectedDocument.fileName) : null}
                <HrmDocumentLink path={selectedDocument.documentUrl} />
              </div>
            </div>
          </div>
        )}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-between gap-3">
          <div className="flex gap-2">
            {selectedDocument?.status === "Pending" && (
              <>
                <button
                  onClick={() => {
                    if (selectedDocument)
                      handleStatusUpdate(selectedDocument.id, "Approved");
                    setShowViewModal(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (selectedDocument)
                      handleStatusUpdate(selectedDocument.id, "Rejected");
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
                if (selectedDocument) openEditModal(selectedDocument);
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
            Delete Document
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{selectedDocument?.title}</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteDocument}
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
          <span className="text-gray-900 font-medium">Documents</span>
        </div>
      </div>
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Documents
          </h2>
          <CreatePlusButton onClick={openCreateModal} title="Create" />
        </div>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
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
                  {docFilterStatuses.map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStatusFilter(st);
                        setCurrentPage(1);
                        setShowFilters(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {st}
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
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="title" label="Title" />
                <SortHeader
                  field="documentCategory"
                  label="Document Category"
                />
                <SortHeader field="effectiveDate" label="Effective Date" />
                <SortHeader field="uploadedBy" label="Uploaded By" />
                <SortHeader field="approvedBy" label="Approved By" />
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
              {paginatedDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(doc)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {doc.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {doc.documentCategory}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(doc.effectiveDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.uploadedBy}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {doc.approvedBy || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}
                    >
                      {getStatusIcon(doc.status)}
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadDocument(doc);
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      {getFileIcon(doc.fileName)}
                    </button>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(doc)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(doc)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(doc)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedDocuments.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No documents found.
                  </td>{" "}
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
            {filteredDocuments.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredDocuments.length)} of{" "}
            {filteredDocuments.length} results
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
