/**
 * File: src/pages/crm/Leads.tsx
 * Manage CRM Leads – full CRUD with list view, view modal, and create/edit modal
 * Includes: search, pagination, sorting, filters, tasks count, stage management
 * Design matches provided screenshot and existing component patterns
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  fetchCrmLeads,
  createCrmLead,
  updateCrmLead,
  deleteCrmLead,
  fetchCrmLeadStages,
  fetchCrmUsers,
  searchCrmNamed,
  type CrmNamed,
} from "@/services/crmApi";
import { AsyncSearchSelect } from "@/components/ui/AsyncSearchSelect";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Globe,
  User,
  Mail,
  Calendar,
  CheckSquare,
  Users,
  Sparkles,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
}

interface LeadTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  subjects: string;
  assignedTo: string[];
  assignedUserIds?: string[];
  tasks: LeadTask[];
  followUpDate: string;
  stage: string;
  stageId?: string;
  createdAt: string;
}

// Live lists come from API — empty exports kept for LeadDetail import compat.
export const users: User[] = [];
export const sampleLeads: Lead[] = [];

const mapLeadRow = (row: import("@/services/crmApi").CrmLeadRow): Lead => ({
  id: row._id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  subjects: row.subject,
  assignedTo: row.assignedUsers.map((u) => u.name),
  assignedUserIds: row.assignedUsers.map((u) => u._id),
  tasks: [],
  followUpDate: row.date,
  stage: row.stageName,
  stageId: row.stageId,
  createdAt: row.createdAt,
});

type SortField = "name" | "subjects" | "assignedTo" | "tasks" | "followUpDate" | "stage";
type SortDir = "asc" | "desc";

// ─── Helper: get tasks count display ─────────────────────────────────────────

const getTasksDisplay = (tasks: LeadTask[]): string => {
  const completed = tasks.filter((t) => t.completed).length;
  return `${completed}/${tasks.length}`;
};

// ─── Helper: stage badge styling ─────────────────────────────────────────────

const getStageBadge = (stage: string) => {
  const styles: Record<string, string> = {
    Lead: "bg-gray-100 text-gray-700",
    Contacted: "bg-blue-100 text-blue-700",
    Prospect: "bg-yellow-100 text-yellow-700",
    Qualified: "bg-purple-100 text-purple-700",
    Engaged: "bg-orange-100 text-orange-700",
    Converted: "bg-green-100 text-green-700",
  };
  return styles[stage] || "bg-gray-100 text-gray-700";
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stageOptions, setStageOptions] = useState<CrmNamed[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, stages] = await Promise.all([
        fetchCrmLeads(),
        fetchCrmLeadStages(),
      ]);
      setLeads(rows.map(mapLeadRow));
      setStageOptions(stages);
    } catch (err: any) {
      showToast(err?.message || "Couldn't load leads", "error");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const searchCrmUsersOptions = useCallback(async (q: string) => {
    const rows = await fetchCrmUsers(q);
    return rows.map((u) => ({ id: u._id, name: u.name }));
  }, []);

  const searchLeadStageOptions = useCallback(async (q: string) => {
    const rows = await searchCrmNamed("/crm/lead-stages/all", q);
    return rows.map((s) => ({ id: s._id, name: s.name }));
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("followUpDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subjects: "",
    assignedUserId: "",
    assignedUserDisplayName: "",
    followUpDate: "",
    stageId: "",
    stageDisplayName: "",
  });

  // ─── Sorting & Filtering ───────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.subjects.toLowerCase().includes(q),
      );
    }
    if (stageFilter !== "All")
      result = result.filter((l) => l.stage === stageFilter);
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === "assignedTo") {
        aVal = a.assignedTo.join(", ");
        bVal = b.assignedTo.join(", ");
      }
      if (sortField === "tasks") {
        aVal = getTasksDisplay(a.tasks);
        bVal = getTasksDisplay(b.tasks);
      }
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [leads, searchQuery, stageFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredLeads.length / perPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Handlers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      subjects: "",
      assignedUserId: "",
      assignedUserDisplayName: "",
      followUpDate: "",
      stageId: stageOptions[0]?._id || "",
      stageDisplayName: stageOptions[0]?.name || "",
    });
  };

  const openCreateModal = () => {
    resetForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      subjects: lead.subjects,
      assignedUserId: lead.assignedUserIds?.[0] || "",
      assignedUserDisplayName: lead.assignedTo[0] || "",
      followUpDate: lead.followUpDate,
      stageId: lead.stageId || "",
      stageDisplayName: lead.stage || "",
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (lead: Lead) => {
    navigate(`/crm/leads/${lead.id}`);
  };

  const openDeleteModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowDeleteModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Name is required", "info");
      return;
    }
    if (!formData.subjects.trim()) {
      showToast("Subjects is required", "info");
      return;
    }
    if (!formData.followUpDate) {
      showToast("Follow-up date is required", "info");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        subject: formData.subjects.trim(),
        date: formData.followUpDate,
        stage_id: formData.stageId || undefined,
        assigned_users: formData.assignedUserId ? [formData.assignedUserId] : [],
      };
      if (isEditing && selectedLead) {
        await updateCrmLead(selectedLead.id, payload);
        showToast("Lead updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await createCrmLead(payload);
        showToast("Lead created successfully!", "success");
        setShowCreateModal(false);
      }
      resetForm();
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't save lead", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      await deleteCrmLead(selectedLead.id);
      showToast("Lead deleted successfully!", "success");
      setShowDeleteModal(false);
      setSelectedLead(null);
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't delete lead", "error");
    } finally {
      setSaving(false);
    }
  };

// ─── Sort Header Component ─────────────────────────────────────────────────

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

  const ViewModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Lead Details</h2>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedLead && (
          <div className="p-6 space-y-4">
            <div>
              <p className="text-xs text-gray-500">Name</p>
              <p className="text-sm font-medium text-gray-900">
                {selectedLead.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm text-gray-600">
                {selectedLead.email || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm text-gray-600">
                {selectedLead.phone || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Subjects</p>
              <p className="text-sm text-gray-600">{selectedLead.subjects}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Assigned To</p>
              <p className="text-sm text-gray-600">
                {selectedLead.assignedTo.join(", ") || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Tasks</p>
              <p className="text-sm text-gray-600">
                {getTasksDisplay(selectedLead.tasks)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Follow Up Date</p>
              <p className="text-sm text-gray-600">
                {selectedLead.followUpDate}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Stage</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStageBadge(selectedLead.stage)}`}
              >
                {selectedLead.stage}
              </span>
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
              if (selectedLead) openEditModal(selectedLead);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );

  const closeLeadModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    resetForm();
  };

  const CreateEditModal = () => (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-20 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Lead" : "Create Lead"}
          </h2>
          <button onClick={closeLeadModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          {/* Name + AI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter Name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                type="button"
                onClick={() => showToast("AI suggestions coming soon", "info")}
                className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-md text-blue-600 hover:bg-blue-50"
                title="AI assist"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter Email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          {/* Subject + AI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.subjects}
                onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                placeholder="Enter Subject"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                type="button"
                onClick={() => showToast("AI suggestions coming soon", "info")}
                className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-md text-blue-600 hover:bg-blue-50"
                title="AI assist"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User <span className="text-red-500">*</span>
            </label>
            <AsyncSearchSelect
              value={formData.assignedUserId}
              displayName={formData.assignedUserDisplayName}
              onChange={(id, opt) =>
                setFormData({
                  ...formData,
                  assignedUserId: id,
                  assignedUserDisplayName: opt?.name ?? "",
                })
              }
              onSearch={searchCrmUsersOptions}
              placeholder="Select User"
            />
          </div>
          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone No</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Format: +[country code][phone number]
            </p>
          </div>
          {/* Follow Up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Follow Up Date <span className="text-red-500">*</span>
            </label>
            <AppDatePicker
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
            <AsyncSearchSelect
              value={formData.stageId}
              displayName={formData.stageDisplayName}
              onChange={(id, opt) =>
                setFormData({
                  ...formData,
                  stageId: id,
                  stageDisplayName: opt?.name ?? "",
                })
              }
              onSearch={searchLeadStageOptions}
              placeholder="Select stage"
            />
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={closeLeadModal}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  const DeleteModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Delete Lead
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{selectedLead?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
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
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => navigate("/")}
              className="hover:text-gray-700"
            >
              Dashboard
            </button>
            <span>›</span>
            <button
              onClick={() => navigate("/crm")}
              className="hover:text-gray-700"
            >
              CRM
            </button>
            <span>›</span>
            <span className="text-gray-900 font-medium">Leads</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1 bg-white">
            <Globe className="w-4 h-4" />
            <span>en English</span>
          </div>
        </div>
      </div>

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Leads</h2>
          <button
            type="button"
            onClick={openCreateModal}
            title="Create lead"
            aria-label="Create lead"
            className="w-9 h-9 flex-shrink-0 ml-4 mr-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Name and Subject..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <button
              onClick={() => showToast("Search applied", "info")}
              className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600"
            >
              Search
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
                <span>Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 pb-1.5 mb-1 border-b border-gray-100">
                    Stage
                  </div>
                  <button
                    onClick={() => {
                      setStageFilter("All");
                      setCurrentPage(1);
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    All
                  </button>
                  {stageOptions.map((s) => (
                    <button
                      key={s._id}
                      onClick={() => {
                        setStageFilter(s.name);
                        setCurrentPage(1);
                        setShowFilters(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {s.name}
                    </button>
                  ))}
                                    <button
                    onClick={() => setShowFilters(false)}
                    className="w-full px-3 py-1.5 text-left text-sm text-blue-600 hover:bg-blue-50"
                  >
                    Apply
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
                <SortHeader field="name" label="Name" />
                <SortHeader field="subjects" label="Subjects" />
                <SortHeader field="assignedTo" label="Users" />
                <SortHeader field="tasks" label="Tasks" />
                <SortHeader field="followUpDate" label="Follow Up Date" />
                <SortHeader field="stage" label="Stage" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(lead)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {lead.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.subjects}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {lead.assignedTo.join(", ")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {getTasksDisplay(lead.tasks)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {lead.followUpDate}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStageBadge(lead.stage)}`}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(lead)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(lead)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(lead)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedLeads.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No leads found.
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
            {filteredLeads.length === 0 ? 0 : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredLeads.length)} of{" "}
            {filteredLeads.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) pageNumber = i + 1;
              else if (currentPage <= 3) pageNumber = i + 1;
              else if (currentPage >= totalPages - 2)
                pageNumber = totalPages - 4 + i;
              else pageNumber = currentPage - 2 + i;
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
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
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

export default Leads;
