/**
 * File: src/pages/Quotation.tsx
 * Quotations management — list, create/edit modal, view modal, delete.
 *
 * Backed by the quotation API:
 *   GET    /quotation/all?page=&limit=  -> list (paginated envelope)
 *   GET    /quotation/single/:id        -> one quotation (View modal)
 *   POST   /quotation/create            -> create
 *   PATCH  /quotation/:id               -> update
 *   DELETE /quotation/delete/:id        -> delete (soft)
 *
 * The API stores customer_id / warehouse_id / product[].product_id as ids
 * (customer_id arrives populated in the list, raw id in single), so they are
 * resolved from:
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
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Globe,
  Save,
  Loader2,
} from "lucide-react";
import { api } from "../lib/api/client";
import { ApiError } from "../lib/api/ApiError";
import { showToast } from "../utils/toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuotationItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number; // rate
  discount: number; // %
  tax: number; // %
  amount: number; // line subtotal (excl. tax)
}

interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  warehouseId: string;
  quotationDate: string; // yyyy-mm-dd
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
  items: QuotationItem[];
}

interface ApiQuotationItem {
  product_id: string;
  quantity: number;
  rate: number;
  tax: number;
  discount: number;
  amount: number;
}
interface ApiQuotation {
  _id: string;
  customer_id?: string | { _id: string; name?: string } | null;
  warehouse_id?: string | null;
  quotation_number: string;
  quotation_date: string;
  due_date: string;
  discount_before_tax?: number;
  product?: ApiQuotationItem[];
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

const refId = (ref: { _id: string } | string | null | undefined): string =>
  typeof ref === "object" && ref ? ref._id : (ref ?? "");
const customerLabel = (c: ApiCustomer): string =>
  c.name ??
  c.customerName ??
  [c.firstName, c.lastName].filter(Boolean).join(" ") ??
  c.email ??
  c._id;
const productLabel = (p: ApiProduct): string =>
  p.productName ?? p.name ?? p._id;

const mapApiQuotation = (q: ApiQuotation): Quotation => ({
  id: q._id,
  quotationNumber: q.quotation_number ?? "",
  customerId: refId(q.customer_id),
  warehouseId: q.warehouse_id ?? "",
  quotationDate: toDateInput(q.quotation_date),
  dueDate: toDateInput(q.due_date),
  subtotal: q.sub_total ?? 0,
  tax: q.tax ?? 0,
  total: q.total ?? 0,
  status: q.status ?? "Draft",
  notes: q.notes ?? "",
  deposit: q.deposit ?? 0,
  discount: q.discount ?? 0,
  shippingCost: q.shipping_cost ?? 0,
  inlineDiscount: q.inline_discount ?? 0,
  discountBeforeTax: q.discount_before_tax ?? 0,
  items: (q.product ?? []).map((it, idx) => ({
    id: `item-${idx}`,
    productId: it.product_id,
    quantity: it.quantity ?? 0,
    unitPrice: it.rate ?? 0,
    discount: it.discount ?? 0,
    tax: it.tax ?? 0,
    amount: it.amount ?? 0,
  })),
});

const newItem = (): QuotationItem => ({
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

const STATUS_OPTIONS = ["Draft", "Sent", "Accepted", "Partial", "Rejected"];

export const Quotations: React.FC = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
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
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState<Quotation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Option sources
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [warehouses, setWarehouses] = useState<ApiWarehouse[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    warehouseId: "",
    quotationNumber: "",
    quotationDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    status: "Draft",
    notes: "",
    deposit: 0,
    discount: 0,
    shippingCost: 0,
    inlineDiscount: 0,
    discountBeforeTax: 0,
  });
  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([
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
  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<ApiQuotation[]>("/quotation/all", {
        params: { page: 1, limit: 1000 },
      });
      setQuotations(Array.isArray(data) ? data.map(mapApiQuotation) : []);
    } catch (err) {
      const message = errMessage(err, "Couldn't load quotations.");
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

  useEffect(() => {
    loadQuotations();
    loadOptions();
  }, [loadQuotations, loadOptions]);

  // ─── Totals ────────────────────────────────────────────────────────────────
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    quotationItems.forEach((item) => {
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
  const recalcAmount = (item: QuotationItem): number => {
    const base = item.quantity * item.unitPrice;
    return round2(base - base * (item.discount / 100));
  };

  const addItemRow = () => setQuotationItems((prev) => [...prev, newItem()]);
  const removeItemRow = (id: string) =>
    setQuotationItems((prev) =>
      prev.length > 1 ? prev.filter((i) => i.id !== id) : prev,
    );

  const updateItem = (
    id: string,
    field: keyof QuotationItem,
    value: string | number,
  ) => {
    setQuotationItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value } as QuotationItem;
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
      quotationNumber: `QUO-${String(Math.floor(Math.random() * 900) + 100)}`,
      quotationDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      status: "Draft",
      notes: "",
      deposit: 0,
      discount: 0,
      shippingCost: 0,
      inlineDiscount: 0,
      discountBeforeTax: 0,
    });
    setQuotationItems([newItem()]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setIsEditing(false);
    setShowModal(true);
  };

  const openEdit = (q: Quotation) => {
    setEditingId(q.id);
    setFormData({
      customerId: q.customerId,
      warehouseId: q.warehouseId,
      quotationNumber: q.quotationNumber,
      quotationDate: q.quotationDate,
      dueDate: q.dueDate,
      status: q.status,
      notes: q.notes,
      deposit: q.deposit,
      discount: q.discount,
      shippingCost: q.shippingCost,
      inlineDiscount: q.inlineDiscount,
      discountBeforeTax: q.discountBeforeTax,
    });
    setQuotationItems(
      q.items.length > 0 ? q.items.map((i) => ({ ...i })) : [newItem()],
    );
    setIsEditing(true);
    setShowModal(true);
  };

  // ─── View (single) ─────────────────────────────────────────────────────────
  const openView = async (q: Quotation) => {
    setViewQuotation(q);
    setShowView(true);
    setViewLoading(true);
    try {
      const data = await api.get<ApiQuotation>(`/quotation/single/${q.id}`);
      if (data) setViewQuotation(mapApiQuotation(data));
    } catch (err) {
      showToast(errMessage(err, "Couldn't load quotation details."), "error");
    } finally {
      setViewLoading(false);
    }
  };

  // ─── Create / Update ───────────────────────────────────────────────────────
  const handleSaveQuotation = async () => {
    if (!formData.customerId)
      return showToast("Please select a customer", "info");
    if (!formData.warehouseId)
      return showToast("Please select a warehouse", "info");
    if (!formData.quotationNumber.trim())
      return showToast("Please enter a quotation number", "info");
    const items = quotationItems.filter((i) => i.productId);
    if (items.length === 0)
      return showToast("Please add at least one product", "info");

    const payload = {
      customer_id: formData.customerId,
      warehouse_id: formData.warehouseId,
      quotation_number: formData.quotationNumber.trim(),
      quotation_date: formData.quotationDate,
      due_date: formData.dueDate,
      discount_before_tax: num(formData.discountBeforeTax),
      status: formData.status,
      notes: formData.notes,
      deposit: num(formData.deposit),
      discount: num(formData.discount),
      shipping_cost: num(formData.shippingCost),
      inline_discount: num(formData.inlineDiscount),
      tax: totalTax,
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
        await api.patch(`/quotation/edit/${editingId}`, payload);
        showToast("Quotation updated successfully!", "success");
      } else {
        await api.post("/quotation/create", payload);
        showToast("Quotation created successfully!", "success");
      }
      setShowModal(false);
      resetForm();
      await loadQuotations();
    } catch (err) {
      showToast(errMessage(err, "Couldn't save quotation."), "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/quotation/delete/${toDelete.id}`);
      showToast("Quotation deleted successfully!", "success");
      setShowDelete(false);
      setToDelete(null);
      await loadQuotations();
    } catch (err) {
      showToast(errMessage(err, "Couldn't delete quotation."), "error");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Filter / paginate ─────────────────────────────────────────────────────
  const filteredQuotations = quotations.filter((q) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(term) ||
      (customerNameById[q.customerId] ?? "").toLowerCase().includes(term);
    const matchesStatus = statusFilter === "All" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);
  const paginatedQuotations = filteredQuotations.slice(
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
      case "Sent":
        return "bg-blue-100 text-blue-700";
      case "Accepted":
        return "bg-green-100 text-green-700";
      case "Partial":
        return "bg-yellow-100 text-yellow-700";
      case "Rejected":
        return "bg-red-100 text-red-700";
      case "Expired":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Draft":
        return <FileText className="w-3 h-3" />;
      case "Sent":
        return <Send className="w-3 h-3" />;
      case "Accepted":
        return <CheckCircle className="w-3 h-3" />;
      case "Partial":
        return <Clock className="w-3 h-3" />;
      case "Rejected":
        return <X className="w-3 h-3" />;
      case "Expired":
        return <AlertCircle className="w-3 h-3" />;
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
            <span className="text-gray-900 font-medium">Quotations</span>
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
              Manage Quotations
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage sales quotations for your customers
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Quotation
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search quotations..."
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
                onClick={() => loadQuotations()}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

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

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    "Quotation Number",
                    "Customer",
                    "Quotation Date",
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
                        <span className="text-sm">Loading quotations…</span>
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
                ) : paginatedQuotations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      No quotations found.
                    </td>
                  </tr>
                ) : (
                  paginatedQuotations.map((q) => (
                    <tr
                      key={q.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openView(q)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-sm"
                        >
                          {q.quotationNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {customerNameById[q.customerId] || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {q.quotationDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {q.dueDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatCurrency(q.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatCurrency(q.tax)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatCurrency(q.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            q.status,
                          )}`}
                        >
                          {getStatusIcon(q.status)}
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openView(q)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(q)}
                            className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setToDelete(q);
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
              {filteredQuotations.length === 0
                ? 0
                : (currentPage - 1) * itemsPerPage + 1}{" "}
              to{" "}
              {Math.min(currentPage * itemsPerPage, filteredQuotations.length)}{" "}
              of {filteredQuotations.length} results
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

      {/* Create / Edit Quotation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[90vw] max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditing ? "Edit Quotation" : "Create Quotation"}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Fill in the details to {isEditing ? "update" : "create"} a
                  quotation
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 rounded-lg p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Quotation Details
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
                          Quotation Number *
                        </label>
                        <input
                          type="text"
                          value={formData.quotationNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              quotationNumber: e.target.value,
                            })
                          }
                          placeholder="QUO-001"
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
                          Quotation Date
                        </label>
                        <AppDatePicker
                          value={formData.quotationDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              quotationDate: e.target.value,
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
                            setFormData({
                              ...formData,
                              dueDate: e.target.value,
                            })
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
                        Quotation Items
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
                          {quotationItems.map((item) => (
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

                {/* Right - Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 sticky top-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Quotation Summary
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

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuotation}
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
                    ? "Update Quotation"
                    : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Quotation Modal */}
      {showView && viewQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {viewQuotation.quotationNumber}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewQuotation.status)}`}
                >
                  {getStatusIcon(viewQuotation.status)}
                  {viewQuotation.status}
                </span>
              </div>
              <button
                onClick={() => setShowView(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
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
                        {customerNameById[viewQuotation.customerId] ||
                          viewQuotation.customerId ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Warehouse</p>
                      <p className="text-sm text-gray-900">
                        {warehouseNameById[viewQuotation.warehouseId] ||
                          viewQuotation.warehouseId ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Quotation Date</p>
                      <p className="text-sm text-gray-900">
                        {viewQuotation.quotationDate || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Due Date</p>
                      <p className="text-sm text-gray-900">
                        {viewQuotation.dueDate || "—"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm text-gray-900">
                        {viewQuotation.notes || "—"}
                      </p>
                    </div>
                  </div>

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
                        {viewQuotation.items.map((it) => (
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

                  <div className="flex justify-end">
                    <div className="w-full sm:w-72 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewQuotation.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewQuotation.tax)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewQuotation.shippingCost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deposit</span>
                        <span className="text-gray-900">
                          {formatCurrency(viewQuotation.deposit)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">
                          Total
                        </span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(viewQuotation.total)}
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
                    openEdit(viewQuotation);
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
                Delete Quotation
              </h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  {toDelete.quotationNumber}
                </span>
                ? This action cannot be undone.
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
