/**
 * File: src/pages/Proposal.tsx
 * Sales Proposal management — list, create/edit modal, view modal, delete.
 *
 * Backed by the proposal API:
 *   GET    /proposal/all?page=&limit=  -> list (paginated envelope)
 *   GET    /proposal/single/:id        -> one proposal (View modal)
 *   POST   /proposal/create            -> create
 *   PATCH  /proposal/edit/:id          -> update
 *   DELETE /proposal/delete/:id        -> delete (soft)
 *
 * The API stores customer_id / warehouse_id / product[].product_id as raw ids
 * (names are not populated), so they are resolved from:
 *   /customer/all              -> customers
 *   /purchase/warehouses/all   -> warehouses
 *   /product/all               -> products
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Filter,
  Download,
  Plus,
  X,
  Clock,
  AlertCircle,
  Send,
  Globe,
  Save,
  Loader2,
  RefreshCw,
  Ban,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { api } from "../lib/api/client";
import { ApiError } from "../lib/api/ApiError";
import { showToast } from "../utils/toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProposalItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number; // rate
  discount: number; // %
  tax: number; // %
  amount: number; // line subtotal (excl. tax)
}

interface Proposal {
  id: string;
  proposalNumber: string;
  customerId: string;
  warehouseId: string;
  proposalDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  notes: string;
  deposit: number;
  discount: number;
  shippingCost: number;
  inlineDiscount: number;
  discountBeforeTax: number;
  items: ProposalItem[];
}

interface ApiProposalItem {
  product_id: string;
  quantity: number;
  rate: number;
  tax: number;
  discount: number;
  amount: number;
}
interface ApiProposal {
  _id: string;
  customer_id?: string | null;
  warehouse_id?: string | null;
  proposal_number: string;
  proposal_date: string;
  due_date: string;
  discount_before_tax?: number;
  product?: ApiProposalItem[];
  service?: unknown[];
  status?: string;
  notes?: string;
  deposit?: number;
  discount?: number;
  shipping_cost?: number;
  inline_discount?: number;
  tax?: number;
  sub_total?: number;
  total?: number;
}
interface ApiCustomer {
  _id: string;
  name?: string;
  customerName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}
interface ApiWarehouse {
  _id: string;
  name?: string;
}
interface ApiProduct {
  _id: string;
  productName?: string;
  name?: string;
  sku?: string;
  pricing?: { sellPrice?: number; buyPrice?: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: string | number) => Number(v) || 0;
const errMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const customerLabel = (c: ApiCustomer): string =>
  c.name ??
  c.customerName ??
  [c.firstName, c.lastName].filter(Boolean).join(" ") ??
  c.email ??
  c._id;
const productLabel = (p: ApiProduct): string =>
  p.productName ?? p.name ?? p._id;

const mapApiProposal = (p: ApiProposal): Proposal => ({
  id: p._id,
  proposalNumber: p.proposal_number ?? "",
  customerId: p.customer_id ?? "",
  warehouseId: p.warehouse_id ?? "",
  proposalDate: toDateInput(p.proposal_date),
  dueDate: toDateInput(p.due_date),
  subtotal: p.sub_total ?? 0,
  tax: p.tax ?? 0,
  total: p.total ?? 0,
  status: p.status ?? "Draft",
  notes: p.notes ?? "",
  deposit: p.deposit ?? 0,
  discount: p.discount ?? 0,
  shippingCost: p.shipping_cost ?? 0,
  inlineDiscount: p.inline_discount ?? 0,
  discountBeforeTax: p.discount_before_tax ?? 0,
  items: (p.product ?? []).map((it, idx) => ({
    id: `item-${idx}`,
    productId: it.product_id,
    quantity: it.quantity ?? 0,
    unitPrice: it.rate ?? 0,
    discount: it.discount ?? 0,
    tax: it.tax ?? 0,
    amount: it.amount ?? 0,
  })),
});

const newItem = (): ProposalItem => ({
  id: `new-${Math.random().toString(36).slice(2)}`,
  productId: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  tax: 0,
  amount: 0,
});

const languages = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
];

const STATUS_OPTIONS = [
  "Draft",
  "Partial",
  "Paid",
  "Overdue",
  "Recurring",
  "Void",
  "CreditNotesApplied",
  "Open",
];

export const SalesProposals: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // View modal
  const [showView, setShowView] = useState(false);
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Inline status update (from a list row)
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Option sources
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [warehouses, setWarehouses] = useState<ApiWarehouse[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    warehouseId: "",
    proposalNumber: "",
    proposalDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    status: "Draft",
    notes: "",
    deposit: 0,
    discount: 0,
    shippingCost: 0,
    inlineDiscount: 0,
    discountBeforeTax: 0,
  });
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    newItem(),
  ]);

  // ─── Lookup maps ───────────────────────────────────────────────────────────
  const customerNameById = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach((c) => (m[c._id] = customerLabel(c)));
    return m;
  }, [customers]);
  const warehouseNameById = useMemo(() => {
    const m: Record<string, string> = {};
    warehouses.forEach((w) => (m[w._id] = (w.name ?? "").trim()));
    return m;
  }, [warehouses]);
  const productNameById = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => (m[p._id] = productLabel(p)));
    return m;
  }, [products]);

  // ─── Data loading ──────────────────────────────────────────────────────────
  // GET /proposal/all?page=&limit=&searchTerm=&status=
  // `searchTerm` → free-text search (customer name, email, etc.).
  // `status`     → exact status enum value (omitted for "All").
  const loadProposals = useCallback(async (search = "", status = "") => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<ApiProposal[]>("/proposal/all", {
        params: {
          page: 1,
          limit: 1000,
          ...(search.trim() ? { searchTerm: search.trim() } : {}),
          ...(status ? { status } : {}),
        },
      });
      setProposals(Array.isArray(data) ? data.map(mapApiProposal) : []);
    } catch (err) {
      const message = errMessage(err, "Couldn't load proposals.");
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [c, w, p] = await Promise.allSettled([
        api.get<ApiCustomer[]>("/customer/all", {
          params: { page: 1, limit: 1000 },
        }),
        api.get<ApiWarehouse[]>("/purchase/warehouses/all", {
          params: { page: 1, limit: 1000 },
        }),
        api.get<ApiProduct[]>("/product/all", {
          params: { page: 1, limit: 1000 },
        }),
      ]);
      if (c.status === "fulfilled" && Array.isArray(c.value))
        setCustomers(c.value);
      if (w.status === "fulfilled" && Array.isArray(w.value))
        setWarehouses(w.value);
      if (p.status === "fulfilled" && Array.isArray(p.value))
        setProducts(p.value);
    } catch {
      /* dropdowns degrade gracefully */
    }
  }, []);

  // Load the option sources (customers/warehouses/products) once.
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // The status value sent to the backend `status` param ("" means no filter).
  const activeStatus = statusFilter !== "All" ? statusFilter : "";

  // Debounce and refetch from the server whenever the search box or the status
  // filter changes. Fires on mount to load the initial list.
  useEffect(() => {
    const handle = setTimeout(() => {
      loadProposals(searchTerm, activeStatus);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchTerm, activeStatus, loadProposals]);

  // ─── Totals ────────────────────────────────────────────────────────────────
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    proposalItems.forEach((item) => {
      const base = item.quantity * item.unitPrice;
      const discountAmount = base * (item.discount / 100);
      const taxable = base - discountAmount;
      subtotal += taxable;
      totalDiscount += discountAmount;
      totalTax += taxable * (item.tax / 100);
    });
    const total =
      subtotal +
      totalTax +
      num(formData.shippingCost) -
      num(formData.discount) -
      num(formData.inlineDiscount) -
      num(formData.discountBeforeTax);
    return {
      subtotal: round2(subtotal),
      totalDiscount: round2(totalDiscount),
      totalTax: round2(totalTax),
      total: round2(total),
    };
  };
  const { subtotal, totalDiscount, totalTax, total } = calculateTotals();

  // ─── Item helpers ──────────────────────────────────────────────────────────
  const recalcAmount = (item: ProposalItem): number => {
    const base = item.quantity * item.unitPrice;
    return round2(base - base * (item.discount / 100));
  };

  const addItemRow = () => setProposalItems((prev) => [...prev, newItem()]);
  const removeItemRow = (id: string) =>
    setProposalItems((prev) =>
      prev.length > 1 ? prev.filter((i) => i.id !== id) : prev,
    );

  const updateItem = (
    id: string,
    field: keyof ProposalItem,
    value: string | number,
  ) => {
    setProposalItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value } as ProposalItem;
        if (field === "productId") {
          const found = products.find((p) => p._id === value);
          const price = found?.pricing?.sellPrice ?? found?.pricing?.buyPrice;
          if (typeof price === "number") updated.unitPrice = price;
        }
        updated.amount = recalcAmount(updated);
        return updated;
      }),
    );
  };

  // ─── Form open / reset ─────────────────────────────────────────────────────
  const resetForm = () => {
    setFormData({
      customerId: "",
      warehouseId: "",
      proposalNumber: `PROP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 900) + 100)}`,
      proposalDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      status: "Draft",
      notes: "",
      deposit: 0,
      discount: 0,
      shippingCost: 0,
      inlineDiscount: 0,
      discountBeforeTax: 0,
    });
    setProposalItems([newItem()]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setIsEditing(false);
    setShowModal(true);
  };

  const openEdit = (p: Proposal) => {
    setEditingId(p.id);
    setFormData({
      customerId: p.customerId,
      warehouseId: p.warehouseId,
      proposalNumber: p.proposalNumber,
      proposalDate: p.proposalDate,
      dueDate: p.dueDate,
      status: p.status,
      notes: p.notes,
      deposit: p.deposit,
      discount: p.discount,
      shippingCost: p.shippingCost,
      inlineDiscount: p.inlineDiscount,
      discountBeforeTax: p.discountBeforeTax,
    });
    setProposalItems(
      p.items.length > 0
        ? p.items.map((i) => ({ ...i }))
        : [newItem()],
    );
    setIsEditing(true);
    setShowModal(true);
  };

  // ─── View (single) ─────────────────────────────────────────────────────────
  const openView = async (p: Proposal) => {
    setViewProposal(p);
    setShowView(true);
    setViewLoading(true);
    try {
      const data = await api.get<ApiProposal>(`/proposal/single/${p.id}`);
      if (data) setViewProposal(mapApiProposal(data));
    } catch (err) {
      showToast(errMessage(err, "Couldn't load proposal details."), "error");
    } finally {
      setViewLoading(false);
    }
  };

  // ─── Create / Update ───────────────────────────────────────────────────────
  const handleSaveProposal = async () => {
    if (!formData.customerId) return showToast("Please select a customer", "info");
    if (!formData.warehouseId)
      return showToast("Please select a warehouse", "info");
    if (!formData.proposalNumber.trim())
      return showToast("Please enter a proposal number", "info");
    const items = proposalItems.filter((i) => i.productId);
    if (items.length === 0)
      return showToast("Please add at least one product", "info");

    const payload = {
      customer_id: formData.customerId,
      warehouse_id: formData.warehouseId,
      proposal_number: formData.proposalNumber.trim(),
      proposal_date: formData.proposalDate,
      due_date: formData.dueDate,
      discount_before_tax: num(formData.discountBeforeTax),
      status: formData.status,
      notes: formData.notes,
      deposit: num(formData.deposit),
      discount: num(formData.discount),
      shipping_cost: num(formData.shippingCost),
      inline_discount: num(formData.inlineDiscount),
      tax: totalTax,
      sub_total: subtotal,
      total,
      isDeleted: false,
      archive: false,
      product: items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
        rate: i.unitPrice,
        tax: i.tax,
        discount: i.discount,
        amount: recalcAmount(i),
      })),
      service: [],
    };

    setSaving(true);
    try {
      if (isEditing && editingId) {
        await api.patch(`/proposal/edit/${editingId}`, payload);
        showToast("Proposal updated successfully!", "success");
      } else {
        await api.post("/proposal/create", payload);
        showToast("Proposal created successfully!", "success");
      }
      setShowModal(false);
      resetForm();
      await loadProposals(searchTerm, activeStatus);
    } catch (err) {
      showToast(errMessage(err, "Couldn't save proposal."), "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/proposal/delete/${toDelete.id}`);
      showToast("Proposal deleted successfully!", "success");
      setShowDelete(false);
      setToDelete(null);
      await loadProposals(searchTerm, activeStatus);
    } catch (err) {
      showToast(errMessage(err, "Couldn't delete proposal."), "error");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Inline status update ──────────────────────────────────────────────────
  // PATCH /proposal/edit/:id  body: { status }
  const handleStatusUpdate = async (proposal: Proposal, newStatus: string) => {
    setStatusMenuFor(null);
    if (proposal.status === newStatus) return;
    setUpdatingStatusId(proposal.id);
    try {
      await api.patch(`/proposal/edit/${proposal.id}`, { status: newStatus });
      showToast(`Status updated to ${newStatus}.`, "success");
      await loadProposals(searchTerm, activeStatus);
    } catch (err) {
      showToast(errMessage(err, "Couldn't update status."), "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // ─── Filter / paginate ─────────────────────────────────────────────────────
  // Both the text search and the status filter are applied server-side via the
  // `searchTerm` param, so the returned list is used as-is.
  const filteredProposals = proposals;

  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage);
  const paginatedProposals = filteredProposals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Draft":
        return "bg-gray-100 text-gray-700";
      case "Partial":
        return "bg-yellow-100 text-yellow-700";
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Overdue":
        return "bg-orange-100 text-orange-700";
      case "Recurring":
        return "bg-indigo-100 text-indigo-700";
      case "Void":
        return "bg-red-100 text-red-700";
      case "CreditNotesApplied":
        return "bg-teal-100 text-teal-700";
      case "Open":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Draft":
        return <FileText className="w-3 h-3" />;
      case "Partial":
        return <Clock className="w-3 h-3" />;
      case "Paid":
        return <DollarSign className="w-3 h-3" />;
      case "Overdue":
        return <AlertCircle className="w-3 h-3" />;
      case "Recurring":
        return <RefreshCw className="w-3 h-3" />;
      case "Void":
        return <Ban className="w-3 h-3" />;
      case "CreditNotesApplied":
        return <CreditCard className="w-3 h-3" />;
      case "Open":
        return <Send className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="module-page-shell">
      <div className="max-w-[1600px] mx-auto">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Sales Proposals</span>
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {languages.find((lang) => lang.code === selectedLanguage)?.name}
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
            {showLanguageDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowLanguageDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSelectedLanguage(lang.code);
                        setShowLanguageDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${
                        selectedLanguage === lang.code
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      {lang.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="dashboard-title-bar -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
              Manage Proposal
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage sales proposals for your customers
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Proposal
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search proposals..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button
                onClick={() => loadProposals(searchTerm, activeStatus)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Status:</span>
                  <div className="flex gap-2 flex-wrap">
                    {["All", ...STATUS_OPTIONS].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          statusFilter === status
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Proposals Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    "Proposal Number",
                    "Customer",
                    "Proposal Date",
                    "Due Date",
                    "Subtotal",
                    "Tax",
                    "Total Amount",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading proposals…</span>
                      </div>
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      {loadError}
                    </td>
                  </tr>
                ) : paginatedProposals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      No proposals found.
                    </td>
                  </tr>
                ) : (
                  paginatedProposals.map((proposal) => (
                    <tr
                      key={proposal.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openView(proposal)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-sm"
                        >
                          {proposal.proposalNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {customerNameById[proposal.customerId] || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {proposal.proposalDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {proposal.dueDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatCurrency(proposal.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatCurrency(proposal.tax)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(proposal.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() =>
                              setStatusMenuFor(
                                statusMenuFor === proposal.id
                                  ? null
                                  : proposal.id,
                              )
                            }
                            disabled={updatingStatusId === proposal.id}
                            title="Update status"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-shadow hover:ring-2 hover:ring-offset-1 hover:ring-blue-300 disabled:opacity-60 ${getStatusColor(
                              proposal.status,
                            )}`}
                          >
                            {updatingStatusId === proposal.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              getStatusIcon(proposal.status)
                            )}
                            {proposal.status}
                            <ChevronRight className="w-3 h-3 rotate-90" />
                          </button>
                          {statusMenuFor === proposal.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setStatusMenuFor(null)}
                              />
                              <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                                {STATUS_OPTIONS.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() =>
                                      handleStatusUpdate(proposal, s)
                                    }
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                                      proposal.status === s
                                        ? "font-semibold text-blue-600"
                                        : "text-gray-700"
                                    }`}
                                  >
                                    {getStatusIcon(s)}
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openView(proposal)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(proposal)}
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setToDelete(proposal);
                              setShowDelete(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
                className="px-2 py-1 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-500">per page</span>
            </div>

            <div className="text-sm text-gray-500">
              Showing{" "}
              {filteredProposals.length === 0
                ? 0
                : (currentPage - 1) * itemsPerPage + 1}{" "}
              to{" "}
              {Math.min(currentPage * itemsPerPage, filteredProposals.length)}{" "}
              of {filteredProposals.length} results
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
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
                    onClick={() => handlePageChange(pageNumber)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentPage === pageNumber
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Proposal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[90vw] max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditing ? "Edit Sales Proposal" : "Create Sales Proposal"}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Fill in the details to {isEditing ? "update" : "create"} a
                  sales proposal
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Details */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Sales Proposal Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Customer *
                        </label>
                        <select
                          value={formData.customerId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customerId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Select Customer</option>
                          {customers.map((c) => (
                            <option key={c._id} value={c._id}>
                              {customerLabel(c)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Warehouse *
                        </label>
                        <select
                          value={formData.warehouseId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              warehouseId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Select Warehouse</option>
                          {warehouses.map((w) => (
                            <option key={w._id} value={w._id}>
                              {(w.name ?? "").trim()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Proposal Number *
                        </label>
                        <input
                          type="text"
                          value={formData.proposalNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              proposalNumber: e.target.value,
                            })
                          }
                          placeholder="PROP-001"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) =>
                            setFormData({ ...formData, status: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Proposal Date
                        </label>
                        <AppDatePicker
                          value={formData.proposalDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              proposalDate: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Due Date
                        </label>
                        <AppDatePicker
                          value={formData.dueDate}
                          onChange={(e) =>
                            setFormData({ ...formData, dueDate: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Notes
                    </h3>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
                      placeholder="Additional notes..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Items */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-gray-900">
                        Sales Proposal Items
                      </h3>
                      <button
                        onClick={addItemRow}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Item
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                              Product
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                              Unit Price
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                              Discount %
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                              Tax %
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                              Amount
                            </th>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {proposalItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-t border-gray-200"
                            >
                              <td className="px-3 py-2">
                                <select
                                  value={item.productId}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "productId",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full min-w-[160px] px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                  <option value="">Select Product</option>
                                  {products.map((p) => (
                                    <option key={p._id} value={p._id}>
                                      {productLabel(p)}
                                      {p.sku ? ` (${p.sku})` : ""}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "quantity",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-20 px-2 py-1 text-sm border border-gray-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "unitPrice",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-24 px-2 py-1 text-sm border border-gray-200 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={item.discount}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "discount",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-16 px-2 py-1 text-sm border border-gray-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={item.tax}
                                  onChange={(e) =>
                                    updateItem(
                                      item.id,
                                      "tax",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="w-16 px-2 py-1 text-sm border border-gray-200 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                                {formatCurrency(item.amount)}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => removeItemRow(item.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Additional charges */}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Additional Charges
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {(
                        [
                          ["shippingCost", "Shipping Cost"],
                          ["discount", "Discount"],
                          ["inlineDiscount", "Inline Discount"],
                          ["discountBeforeTax", "Discount Before Tax"],
                          ["deposit", "Deposit"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={formData[key]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [key]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 sticky top-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Proposal Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Item Discount:</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(totalDiscount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(totalTax)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Shipping:</span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(num(formData.shippingCost))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Other Discounts:</span>
                        <span className="font-medium text-red-600">
                          -
                          {formatCurrency(
                            num(formData.discount) +
                              num(formData.inlineDiscount) +
                              num(formData.discountBeforeTax),
                          )}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between text-base font-bold">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-blue-600">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProposal}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving
                  ? "Saving…"
                  : isEditing
                    ? "Update Proposal"
                    : "Create Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Proposal Modal */}
      {showView && viewProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {viewProposal.proposalNumber}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewProposal.status)}`}
                >
                  {getStatusIcon(viewProposal.status)}
                  {viewProposal.status}
                </span>
              </div>
              <button
                onClick={() => setShowView(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {viewLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading details…</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-500">Customer</p>
                      <p className="text-sm text-gray-900">
                        {customerNameById[viewProposal.customerId] ||
                          viewProposal.customerId ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Warehouse</p>
                      <p className="text-sm text-gray-900">
                        {warehouseNameById[viewProposal.warehouseId] ||
                          viewProposal.warehouseId ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Proposal Date</p>
                      <p className="text-sm text-gray-900">
                        {viewProposal.proposalDate || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Due Date</p>
                      <p className="text-sm text-gray-900">
                        {viewProposal.dueDate || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm text-gray-900">
                        {viewProposal.notes || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="overflow-x-auto border border-gray-200 rounded-lg mb-6">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">
                            Product
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                            Rate
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                            Disc %
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                            Tax %
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewProposal.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-3 py-2 text-gray-900">
                              {productNameById[it.productId] || it.productId}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {it.quantity}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {formatCurrency(it.unitPrice)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {it.discount}%
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {it.tax}%
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900">
                              {formatCurrency(it.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-full sm:w-72 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewProposal.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewProposal.tax)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewProposal.shippingCost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deposit</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewProposal.deposit)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">
                          Total
                        </span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(viewProposal.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              {!viewLoading && (
                <button
                  onClick={() => {
                    setShowView(false);
                    openEdit(viewProposal);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button
                onClick={() => setShowView(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Delete Proposal
              </h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{toDelete.proposalNumber}</span>?
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
