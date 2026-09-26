/**
 * File: src/pages/crm/Deals.tsx
 * Manage CRM Deals – list view with create/edit modals
 * Includes: search, pagination, sorting, filters, tasks count, status badges
 * Design matches provided screenshots and existing component patterns
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  fetchCrmDeals,
  createCrmDeal,
  updateCrmDeal,
  deleteCrmDeal,
  fetchCrmPipelines,
  fetchCrmUsers,
  fetchCrmLabels,
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
  DollarSign,
  Users,
  CheckSquare,
  Tag,
  LayoutGrid,
  Sparkles,
} from "lucide-react";

// Deal labels available for the "Deal Labels" quick-assign modal (matches the
// System Setup › Labels reference — brand colours preserved).
// ─── Types ────────────────────────────────────────────────────────────────────

export interface Deal {
  id: string;
  name: string;
  price: number;
  tasks: { completed: number; total: number };
  clients: string[];
  clientIds?: string[];
  stage: string;
  stageId?: string;
  status: "Active" | "Won" | "Lost";
  phone: string;
  pipeline: string;
  pipelineId?: string;
  sources: string[];
  sourceIds?: string[];
  products: string[];
  notes: string;
  createdAt: string;
}

// Live lists come from API — empty export kept for DealDetails import compat.
export const sampleDeals: Deal[] = [];

const mapDealRow = (row: import("@/services/crmApi").CrmDealRow): Deal => ({
  id: row._id,
  name: row.name,
  price: row.price,
  tasks: { completed: row.tasksDone, total: row.tasksTotal },
  clients: row.clients.map((c) => c.name),
  clientIds: row.clients.map((c) => c._id),
  stage: row.stageName,
  stageId: row.stageId,
  status: row.status === "Won" ? "Won" : row.status === "Lost" ? "Lost" : "Active",
  phone: row.phone,
  pipeline: row.pipelineName,
  pipelineId: row.pipelineId,
  sources: row.sources.map((s) => s.name),
  sourceIds: row.sources.map((s) => s._id),
  products: row.products.map((p) => p.name),
  notes: row.notes,
  createdAt: row.createdAt,
});

type SortField = "name" | "price" | "tasks" | "clients" | "stage" | "status";
type SortDir = "asc" | "desc";

// ─── Helper: get status badge ────────────────────────────────────────────────

const getStatusBadge = (status: Deal["status"]) => {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-700";
    case "Won":
      return "bg-blue-100 text-blue-700";
    case "Lost":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const Deals: React.FC = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelineOptions, setPipelineOptions] = useState<CrmNamed[]>([]);
  const [labelOptions, setLabelOptions] = useState<CrmNamed[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, pipes, labels] = await Promise.all([
        fetchCrmDeals(),
        fetchCrmPipelines(),
        fetchCrmLabels(),
      ]);
      setDeals(rows.map(mapDealRow));
      setPipelineOptions(pipes);
      setLabelOptions(labels);
    } catch (err: any) {
      showToast(err?.message || "Couldn't load deals", "error");
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [assignedLabels, setAssignedLabels] = useState<string[]>([]);
  const [pipelineFilterId, setPipelineFilterId] = useState("");
  const [pipelineFilterLabel, setPipelineFilterLabel] = useState("");

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    clientIds: [] as string[],
    price: 0,
    pipelineId: "",
    pipelineDisplayName: "",
    stageId: "",
    stageDisplayName: "",
    sourceIds: [] as string[],
    products: [] as string[],
    notes: "",
    status: "Active" as Deal["status"],
  });

  const searchCrmUsersOptions = useCallback(async (q: string) => {
    const rows = await fetchCrmUsers(q);
    return rows.map((u) => ({ id: u._id, name: u.name }));
  }, []);

  const searchPipelineOptions = useCallback(async (q: string) => {
    const rows = await searchCrmNamed("/crm/pipelines/all", q);
    return rows.map((p) => ({ id: p._id, name: p.name }));
  }, []);

  const searchDealStageOptions = useCallback(
    async (q: string) => {
      const rows = await searchCrmNamed("/crm/deal-stages/all", q);
      const filtered = formData.pipelineId
        ? rows.filter((s) => !s.pipeline_id || s.pipeline_id === formData.pipelineId)
        : rows;
      return filtered.map((s) => ({ id: s._id, name: s.name }));
    },
    [formData.pipelineId],
  );

  const searchSourceOptions = useCallback(async (q: string) => {
    const rows = await searchCrmNamed("/crm/sources/all", q);
    return rows.map((s) => ({ id: s._id, name: s.name }));
  }, []);

  const clientName = (id: string) => clientNames[id] || "Client";
  const sourceName = (id: string) => sourceNames[id] || "Source";

  const seedClientNames = (ids: string[], names: string[]) => {
    const map: Record<string, string> = {};
    ids.forEach((id, i) => {
      if (id && names[i]) map[id] = names[i];
    });
    setClientNames(map);
  };

  const seedSourceNames = (ids: string[], names: string[]) => {
    const map: Record<string, string> = {};
    ids.forEach((id, i) => {
      if (id && names[i]) map[id] = names[i];
    });
    setSourceNames(map);
  };

  // ─── Sorting & Filtering ───────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const filteredDeals = useMemo(() => {
    let result = [...deals];
    if (pipelineFilterId)
      result = result.filter((d) => d.pipelineId === pipelineFilterId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === "tasks") {
        aVal = a.tasks.completed === a.tasks.total ? 1 : 0;
        bVal = b.tasks.completed === b.tasks.total ? 1 : 0;
      }
      if (sortField === "clients") {
        aVal = a.clients.join(", ");
        bVal = b.clients.join(", ");
      }
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [deals, searchQuery, sortField, sortDir, pipelineFilterId]);

  const totalPages = Math.ceil(filteredDeals.length / perPage);
  const paginatedDeals = filteredDeals.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Handlers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setClientNames({});
    setSourceNames({});
    setFormData({
      name: "",
      phone: "",
      clientIds: [],
      price: 0,
      pipelineId: pipelineOptions[0]?._id || "",
      pipelineDisplayName: pipelineOptions[0]?.name || "",
      stageId: "",
      stageDisplayName: "",
      sourceIds: [],
      products: [],
      notes: "",
      status: "Active",
    });
  };

  const openCreateModal = () => {
    resetForm();
    setSelectedDeal(null);
    setShowCreateModal(true);
  };

  const openEditModal = (deal: Deal) => {
    setSelectedDeal(deal);
    seedClientNames(deal.clientIds || [], deal.clients);
    seedSourceNames(deal.sourceIds || [], deal.sources);
    setFormData({
      name: deal.name,
      phone: deal.phone,
      clientIds: deal.clientIds || [],
      price: deal.price,
      pipelineId: deal.pipelineId || "",
      pipelineDisplayName: deal.pipeline || "",
      stageId: deal.stageId || "",
      stageDisplayName: deal.stage || "",
      sourceIds: deal.sourceIds || [],
      products: deal.products,
      notes: deal.notes,
      status: deal.status,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDeleteModal(true);
  };

  const openLabelModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setAssignedLabels([]);
    setShowLabelModal(true);
  };
  const toggleLabel = (name: string) =>
    setAssignedLabels((prev) =>
      prev.includes(name) ? prev.filter((l) => l !== name) : [...prev, name],
    );

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast("Deal name is required", "info");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        price: formData.price || 0,
        phone: formData.phone.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        pipeline_id: formData.pipelineId || undefined,
        stage_id: formData.stageId || undefined,
        clients: formData.clientIds,
        sources: formData.sourceIds,
        status: formData.status,
      };
      if (selectedDeal && showEditModal) {
        await updateCrmDeal(selectedDeal.id, payload);
        showToast("Deal updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await createCrmDeal(payload);
        showToast("Deal created successfully!", "success");
        setShowCreateModal(false);
      }
      resetForm();
      setSelectedDeal(null);
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't save deal", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDeal) return;
    setSaving(true);
    try {
      await deleteCrmDeal(selectedDeal.id);
      showToast("Deal deleted successfully!", "success");
      setShowDeleteModal(false);
      setSelectedDeal(null);
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't delete deal", "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Sort Header ───────────────────────────────────────────────────────────

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

  // ─── Modals ─────────────────────────────────────────────────────────────────

  const CreateModal = () => (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-24"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Create Deal</h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deal Name <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Enter Deal Name"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone No</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="+1234567890"
            />
            <p className="text-xs text-gray-400 mt-1">
              Format: +[country code][phone number]
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clients <span className="text-red-500">*</span>
            </label>
            <AsyncSearchSelect
              value=""
              onChange={(id, opt) => {
                if (!id || formData.clientIds.includes(id)) return;
                setFormData({ ...formData, clientIds: [...formData.clientIds, id] });
                if (opt) setClientNames((prev) => ({ ...prev, [id]: opt.name }));
              }}
              onSearch={searchCrmUsersOptions}
              placeholder="Search to add clients"
            />
            {formData.clientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.clientIds.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {clientName(c)}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          clientIds: formData.clientIds.filter((x) => x !== c),
                        });
                        setClientNames((prev) => {
                          const next = { ...prev };
                          delete next[c];
                          return next;
                        });
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline</label>
            <AsyncSearchSelect
              value={formData.pipelineId}
              displayName={formData.pipelineDisplayName}
              onChange={(id, opt) =>
                setFormData({
                  ...formData,
                  pipelineId: id,
                  pipelineDisplayName: opt?.name ?? "",
                  stageId: "",
                  stageDisplayName: "",
                })
              }
              onSearch={searchPipelineOptions}
              placeholder="Select pipeline"
            />
          </div>
          <div>
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
              onSearch={searchDealStageOptions}
              placeholder="Select stage"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  const EditModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between">
          <h2 className="text-lg font-semibold">Edit Deal</h2>
          <button onClick={() => setShowEditModal(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Deal Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Price</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full pl-7 pr-3 py-2 border rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pipeline</label>
            <AsyncSearchSelect
              value={formData.pipelineId}
              displayName={formData.pipelineDisplayName}
              onChange={(id, opt) =>
                setFormData({
                  ...formData,
                  pipelineId: id,
                  pipelineDisplayName: opt?.name ?? "",
                  stageId: "",
                  stageDisplayName: "",
                })
              }
              onSearch={searchPipelineOptions}
              placeholder="Select pipeline"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stage</label>
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
              onSearch={searchDealStageOptions}
              placeholder="Select stage"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sources</label>
            <AsyncSearchSelect
              value=""
              onChange={(id, opt) => {
                if (!id || formData.sourceIds.includes(id)) return;
                setFormData({ ...formData, sourceIds: [...formData.sourceIds, id] });
                if (opt) setSourceNames((prev) => ({ ...prev, [id]: opt.name }));
              }}
              onSearch={searchSourceOptions}
              placeholder="Search to add sources"
            />
            {formData.sourceIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.sourceIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {sourceName(id)}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          sourceIds: formData.sourceIds.filter((x) => x !== id),
                        });
                        setSourceNames((prev) => {
                          const next = { ...prev };
                          delete next[id];
                          return next;
                        });
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Clients</label>
            <AsyncSearchSelect
              value=""
              onChange={(id, opt) => {
                if (!id || formData.clientIds.includes(id)) return;
                setFormData({ ...formData, clientIds: [...formData.clientIds, id] });
                if (opt) setClientNames((prev) => ({ ...prev, [id]: opt.name }));
              }}
              onSearch={searchCrmUsersOptions}
              placeholder="Search to add clients"
            />
            {formData.clientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.clientIds.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {clientName(c)}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          clientIds: formData.clientIds.filter((x) => x !== c),
                        });
                        setClientNames((prev) => {
                          const next = { ...prev };
                          delete next[c];
                          return next;
                        });
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone No</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              rows={6}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full border rounded-md px-3 py-2"
              placeholder="Enter notes..."
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => setShowEditModal(false)}
            className="px-4 py-2 border rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-40"
          >
            {saving ? "Saving…" : "Update"}
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
          <h3 className="text-lg font-semibold mb-2">Delete Deal</h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{selectedDeal?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 px-4 py-2 border rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────

  return (
    <div className="module-page-shell flex flex-col overflow-hidden p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={() => navigate("/")}>Dashboard</button>
            <span>›</span>
            <button onClick={() => navigate("/crm")}>CRM</button>
            <span>›</span>
            <span className="text-gray-900 font-medium">Deals</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 border rounded-md px-2 py-1 bg-white">
            <Globe className="w-4 h-4" />
            <span>en English</span>
          </div>
        </div>
      </div>

      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Deals</h2>
          <div className="flex items-center min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-44 sm:w-52 shrink-0">
                <AsyncSearchSelect
                  value={pipelineFilterId}
                  displayName={pipelineFilterLabel}
                  onChange={(id, opt) => {
                    setPipelineFilterId(id);
                    setPipelineFilterLabel(opt?.name ?? "");
                    setCurrentPage(1);
                  }}
                  onSearch={searchPipelineOptions}
                  placeholder="All pipelines"
                  className="text-sm"
                />
              </div>
              <button
                onClick={() => showToast("Kanban board coming soon", "info")}
                className="w-9 h-9 border border-gray-300 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-50 shrink-0"
                title="Kanban view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              title="Create deal"
              aria-label="Create deal"
              className="w-9 h-9 flex-shrink-0 ml-4 mr-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Deals..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border rounded-md"
              />
            </div>
            <button
              onClick={() => showToast("Search applied", "info")}
              className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-md"
            >
              Search
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-sm border rounded-md bg-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md bg-white"
              >
                <Filter className="w-4 h-4 text-gray-500" />
                <span>Filters</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border py-1 z-50">
                  <div className="px-3 pb-1.5 border-b">Status</div>
                  <button
                    onClick={() => {
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Active
                  </button>
                  <button
                    onClick={() => {
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Won
                  </button>
                  <button
                    onClick={() => {
                      setShowFilters(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    Lost
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
                <SortHeader field="price" label="Price" />
                <SortHeader field="tasks" label="Tasks" />
                <SortHeader field="clients" label="Clients" />
                <SortHeader field="stage" label="Stage" />
                <SortHeader field="status" label="Status" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedDeals.map((deal) => (
                <tr
                  key={deal.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/crm/deals/${deal.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {deal.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    ${deal.price.toLocaleString()}{" "}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {deal.tasks.completed}/{deal.tasks.total}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {deal.clients.join(", ")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{deal.stage}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(deal.status)}`}
                    >
                      {deal.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openLabelModal(deal)}
                        className="p-1.5 text-gray-400 hover:text-purple-600"
                        title="Labels"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/crm/deals/${deal.id}`)}
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(deal)}
                        className="p-1.5 text-gray-400 hover:text-green-600"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(deal)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedDeals.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No deals found.
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
            {filteredDeals.length === 0 ? 0 : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredDeals.length)} of{" "}
            {filteredDeals.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (currentPage <= 3) p = i + 1;
              else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
              else p = currentPage - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-8 h-8 text-sm rounded-md ${currentPage === p ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && CreateModal()}
      {showEditModal && EditModal()}
      {showDeleteModal && DeleteModal()}

      {showLabelModal && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-32"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Deal Labels</h3>
                  <p className="text-sm text-gray-500">{selectedDeal?.name}</p>
                </div>
              </div>
              <button onClick={() => setShowLabelModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              {labelOptions.map((l) => (
                <label key={l.name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignedLabels.includes(l.name)}
                    onChange={() => toggleLabel(l.name)}
                    className="accent-blue-600"
                  />
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: l.color || "#3b82f6" }}
                  >
                    {l.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowLabelModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLabelModal(false);
                  showToast(`Assigned ${assignedLabels.length} label(s)`, "success");
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deals;
