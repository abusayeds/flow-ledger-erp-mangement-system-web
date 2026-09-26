/**
 * File: src/pages/purchase/Transfers.tsx
 * Stock Transfers page — list, create modal, view modal, pagination.
 *
 * Backed by the warehouse transfer API:
 *   GET  /purchase/warehouses/transfer/all?page=&limit=  -> list (paginated envelope)
 *   GET  /purchase/warehouses/transfer/single/:id        -> one transfer (View modal)
 *   POST /purchase/warehouses/transfer/create            -> create (applies immediately)
 *
 * A transfer is an immediate stock movement (the API returns "Stock transfer
 * completed successfully"); there is no status, edit or delete endpoint.
 * Product / warehouse selects load from /product/all and /purchase/warehouses/all.
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { api } from "../../lib/api/client";
import { ApiError } from "../../lib/api/ApiError";
import {
  Search,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  ArrowRight,
  Package,
  Warehouse,
  Calendar,
  Loader2,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transfer {
  id: string;
  productId: string;
  product: string;
  sku: string;
  fromWarehouseId: string;
  fromWarehouse: string;
  fromCity: string;
  toWarehouseId: string;
  toWarehouse: string;
  toCity: string;
  quantity: number;
  date: string; // yyyy-mm-dd
  notes: string;
  stock?: ApiStock;
}

interface ApiStock {
  onHandStock?: number;
  committedStock?: number;
  availableForSale?: number;
  toBeInvoiced?: number;
  toBeBilled?: number;
}
interface ApiProductRef {
  _id: string;
  productName?: string;
  name?: string;
  sku?: string;
  stock?: ApiStock;
}
interface ApiWarehouseRef {
  _id: string;
  name?: string;
  city?: string;
}
interface ApiTransfer {
  _id: string;
  product_id: ApiProductRef | string;
  from_warehouse: ApiWarehouseRef | string;
  to_warehouse: ApiWarehouseRef | string;
  quantity: number;
  date: string;
  notes?: string;
}
interface ApiProduct {
  _id: string;
  productName?: string;
  name?: string;
  sku?: string;
}
interface ApiWarehouse {
  _id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const errMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const productName = (ref: ApiProductRef | string | undefined): string =>
  typeof ref === "object" && ref ? (ref.productName ?? ref.name ?? "") : "";
const productSku = (ref: ApiProductRef | string | undefined): string =>
  typeof ref === "object" && ref ? (ref.sku ?? "") : "";
const whName = (ref: ApiWarehouseRef | string | undefined): string =>
  typeof ref === "object" && ref ? (ref.name ?? "").trim() : "";
const whCity = (ref: ApiWarehouseRef | string | undefined): string =>
  typeof ref === "object" && ref ? (ref.city ?? "") : "";
const refId = (ref: { _id: string } | string | undefined): string =>
  typeof ref === "object" && ref ? ref._id : (ref ?? "");

const mapApiTransfer = (t: ApiTransfer): Transfer => ({
  id: t._id,
  productId: refId(t.product_id),
  product: productName(t.product_id),
  sku: productSku(t.product_id),
  fromWarehouseId: refId(t.from_warehouse),
  fromWarehouse: whName(t.from_warehouse),
  fromCity: whCity(t.from_warehouse),
  toWarehouseId: refId(t.to_warehouse),
  toWarehouse: whName(t.to_warehouse),
  toCity: whCity(t.to_warehouse),
  quantity: t.quantity ?? 0,
  date: toDateInput(t.date),
  notes: t.notes ?? "",
  stock:
    typeof t.product_id === "object" ? t.product_id.stock : undefined,
});

type SortField =
  | "product"
  | "fromWarehouse"
  | "toWarehouse"
  | "quantity"
  | "date";
type SortDir = "asc" | "desc";

// ─── Component ────────────────────────────────────────────────────────────────

export const Transfers: React.FC = () => {
  const navigate = useNavigate();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // View modal
  const [showView, setShowView] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<Transfer | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Dropdown sources
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [warehouses, setWarehouses] = useState<ApiWarehouse[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    productId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    quantity: 1,
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // ─── Data loading ────────────────────────────────────────────────────────

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<ApiTransfer[]>(
        "/purchase/warehouses/transfer/all",
        { params: { page: 1, limit: 1000 } },
      );
      setTransfers(Array.isArray(data) ? data.map(mapApiTransfer) : []);
    } catch (err) {
      const message = errMessage(err, "Couldn't load transfers.");
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [p, w] = await Promise.allSettled([
        api.get<ApiProduct[]>("/product/all", {
          params: { page: 1, limit: 1000 },
        }),
        api.get<ApiWarehouse[]>("/purchase/warehouses/all", {
          params: { page: 1, limit: 1000 },
        }),
      ]);
      if (p.status === "fulfilled" && Array.isArray(p.value))
        setProducts(p.value);
      if (w.status === "fulfilled" && Array.isArray(w.value))
        setWarehouses(w.value);
    } catch {
      /* dropdowns degrade gracefully */
    }
  }, []);

  useEffect(() => {
    loadTransfers();
    loadOptions();
  }, [loadTransfers, loadOptions]);

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

  const filteredTransfers = useMemo(() => {
    let result = [...transfers];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.product.toLowerCase().includes(q) ||
          t.fromWarehouse.toLowerCase().includes(q) ||
          t.toWarehouse.toLowerCase().includes(q) ||
          t.sku.toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      let aVal: string | number = a[sortField] as string | number;
      let bVal: string | number = b[sortField] as string | number;
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [transfers, searchQuery, sortField, sortDir]);

  const totalPages = Math.ceil(filteredTransfers.length / perPage);
  const paginatedTransfers = filteredTransfers.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({
      productId: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      quantity: 1,
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSaveTransfer = async () => {
    if (!formData.fromWarehouseId)
      return showToast("Please select the source warehouse", "info");
    if (!formData.toWarehouseId)
      return showToast("Please select the destination warehouse", "info");
    if (formData.fromWarehouseId === formData.toWarehouseId)
      return showToast("From and To warehouses cannot be the same", "info");
    if (!formData.productId) return showToast("Please select a product", "info");
    if (!formData.quantity || formData.quantity < 1)
      return showToast("Please enter a valid quantity", "info");
    if (!formData.date) return showToast("Please select a date", "info");

    const payload = {
      product_id: formData.productId,
      from_warehouse: formData.fromWarehouseId,
      to_warehouse: formData.toWarehouseId,
      quantity: formData.quantity,
      date: formData.date,
      notes: formData.notes,
    };

    setSaving(true);
    try {
      await api.post("/purchase/warehouses/transfer/create", payload);
      showToast("Stock transfer completed successfully!", "success");
      setShowModal(false);
      resetForm();
      await loadTransfers();
    } catch (err) {
      showToast(errMessage(err, "Couldn't create transfer."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleViewTransfer = async (transfer: Transfer) => {
    setViewTransfer(transfer);
    setShowView(true);
    setViewLoading(true);
    try {
      const data = await api.get<ApiTransfer>(
        `/purchase/warehouses/transfer/single/${transfer.id}`,
      );
      if (data) setViewTransfer(mapApiTransfer(data));
    } catch (err) {
      showToast(errMessage(err, "Couldn't load transfer details."), "error");
    } finally {
      setViewLoading(false);
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
  // MAIN LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Breadcrumb */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">
            Dashboard
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">Transfers</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Transfers
          </h2>
          <button
            onClick={openCreateModal}
            className="w-9 h-9 ml-8 flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
            title="Create Transfer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by product or warehouse..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              onClick={() => loadTransfers()}
              className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600"
            >
              Refresh
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Per Page */}
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
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="product" label="Product" />
                <SortHeader field="fromWarehouse" label="From Warehouse" />
                <SortHeader field="toWarehouse" label="To Warehouse" />
                <SortHeader field="quantity" label="Quantity" />
                <SortHeader field="date" label="Date" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading transfers…</span>
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-red-600"
                  >
                    {loadError}
                  </td>
                </tr>
              ) : paginatedTransfers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No transfers found.
                  </td>
                </tr>
              ) : (
                paginatedTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {transfer.product}
                        </span>
                        {transfer.sku && (
                          <span className="text-xs text-gray-400">
                            ({transfer.sku})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Warehouse className="w-3.5 h-3.5 text-gray-400" />
                        {transfer.fromWarehouse}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        {transfer.toWarehouse}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {transfer.quantity}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{transfer.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewTransfer(transfer)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 text-sm rounded-md flex items-center justify-center ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
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

      {/* Create Transfer Modal - Transparent Background */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Create Transfer
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Move stock between warehouses
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Warehouse <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.fromWarehouseId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fromWarehouseId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {(w.name ?? "").trim()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Warehouse <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.toWarehouseId}
                    onChange={(e) =>
                      setFormData({ ...formData, toWarehouseId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="">Select warehouse</option>
                    {warehouses
                      .filter((w) => w._id !== formData.fromWarehouseId)
                      .map((w) => (
                        <option key={w._id} value={w._id}>
                          {(w.name ?? "").trim()}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.productId}
                    onChange={(e) =>
                      setFormData({ ...formData, productId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.productName ?? p.name}
                        {p.sku ? ` (${p.sku})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <AppDatePicker
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTransfer}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Transferring…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Transfer Modal */}
      {showView && viewTransfer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Transfer Details
              </h2>
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
                <div className="space-y-5">
                  {/* Product */}
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {viewTransfer.product}
                      </h3>
                      {viewTransfer.sku && (
                        <p className="text-xs text-gray-500">
                          SKU: {viewTransfer.sku}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Movement */}
                  <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg p-4">
                    <div className="text-center flex-1">
                      <p className="text-xs text-gray-500">From</p>
                      <p className="text-sm font-medium text-gray-900">
                        {viewTransfer.fromWarehouse || "—"}
                      </p>
                      {viewTransfer.fromCity && (
                        <p className="text-xs text-gray-400">
                          {viewTransfer.fromCity}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center text-blue-600">
                      <ArrowRight className="w-5 h-5" />
                      <span className="text-xs font-semibold mt-1">
                        {viewTransfer.quantity}
                      </span>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-gray-500">To</p>
                      <p className="text-sm font-medium text-gray-900">
                        {viewTransfer.toWarehouse || "—"}
                      </p>
                      {viewTransfer.toCity && (
                        <p className="text-xs text-gray-400">
                          {viewTransfer.toCity}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Quantity</p>
                      <p className="text-sm text-gray-900">
                        {viewTransfer.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Date</p>
                      <p className="text-sm text-gray-900">
                        {viewTransfer.date || "—"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm text-gray-900">
                        {viewTransfer.notes || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Stock snapshot */}
                  {viewTransfer.stock && (
                    <div className="pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        Product Stock
                      </p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-500">On Hand</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {viewTransfer.stock.onHandStock ?? "—"}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-500">Committed</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {viewTransfer.stock.committedStock ?? "—"}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-500">Available</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {viewTransfer.stock.availableForSale ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowView(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
