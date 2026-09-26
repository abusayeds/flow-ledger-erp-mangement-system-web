/**
 * File: src/pages/sales/SalesInvoiceReturns.tsx
 * Sales (Invoice) Returns — list, create/edit form, view modal, approve & delete.
 *
 * Backed by the invoice-return API:
 *   GET    /invoice-return/all?page=&limit=  -> list (paginated envelope)
 *   GET    /invoice-return/single/:id        -> one return (View modal)
 *   POST   /invoice-return/create            -> create (status: Returned)
 *   PATCH  /invoice-return/edit/:id          -> update
 *   PATCH  /invoice-return/approve/:id       -> approve (auto-creates a draft credit note)
 *   DELETE /invoice-return/delete/:id        -> delete
 *
 * A return references a whole sales invoice (no line items). invoice_id and
 * warehouse_id arrive populated; the invoice's customer_id is a raw id resolved
 * from /customer/all. Invoices come from /invoice/all, warehouses from
 * /purchase/warehouses/all.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { api } from "../../lib/api/client";
import { ApiError } from "../../lib/api/ApiError";
import { useCollection } from "../../lib/db";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  Filter,
  List,
  LayoutGrid,
  ArrowLeft,
  RefreshCw,
  Check,
  Loader2,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalesReturn {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  warehouseId: string;
  warehouse: string;
  warehouseCity: string;
  returnDate: string; // yyyy-mm-dd
  returnReason: string;
  notes: string;
  status: string; // "Returned" | "Approved" | ...
  creditNoteId: string;
  invoiceTotal: number;
}

/* ---- Raw API shapes ---- */
interface ApiInvoiceRef {
  _id: string;
  invoice_number?: string;
  customer_id?: string | { _id: string } | null;
  total?: number;
}
interface ApiWarehouseRef {
  _id: string;
  name?: string;
  city?: string;
}
interface ApiReturn {
  _id: string;
  invoice_id?: ApiInvoiceRef | string | null;
  warehouse_id?: ApiWarehouseRef | string | null;
  return_date: string;
  return_reason?: string;
  notes?: string;
  status?: string;
  credit_note_id?: string;
}
interface ApiInvoiceOption {
  _id: string;
  invoice_number: string;
  warehouse_id?: string | null;
  customer_id?: string | { _id: string; name?: string } | null;
  total?: number;
}
interface ApiCustomer {
  _id: string;
  name?: string;
  customerName?: string;
  company_name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  businessProfile?: { companyName?: string };
}
interface ApiWarehouse {
  _id: string;
  name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (val: number) => {
  const formatted = (val || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted}$`;
};

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const errMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const partyId = (ref: unknown): string => {
  if (!ref) return "";
  if (typeof ref === "string" || typeof ref === "number") return String(ref).trim();
  if (typeof ref === "object" && ref !== null) {
    const o = ref as { _id?: unknown; $oid?: string; toHexString?: () => string };
    if (typeof o.toHexString === "function") return o.toHexString();
    if (o.$oid) return String(o.$oid);
    if ("_id" in o && o._id !== ref) return partyId(o._id);
  }
  return "";
};
const refId = (ref: { _id: string } | string | null | undefined): string => partyId(ref);
const firstNonEmpty = (...values: Array<string | null | undefined>) =>
  values.map((v) => (v ?? "").trim()).find(Boolean) || "";

const customerLabel = (c: ApiCustomer): string =>
  firstNonEmpty(
    c.businessProfile?.companyName,
    c.company_name,
    c.customerName,
    c.name,
    [c.firstName, c.lastName].filter(Boolean).join(" "),
    c.email,
  );

const asList = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    if (Array.isArray(o.rows)) return o.rows as T[];
    if (Array.isArray(o.allCustomer)) return o.allCustomer as T[];
  }
  return [];
};

const mapApiReturn = (r: ApiReturn): SalesReturn => {
  const inv = r.invoice_id;
  const wh = r.warehouse_id;
  return {
    id: r._id,
    invoiceId: refId(inv),
    invoiceNumber:
      typeof inv === "object" && inv ? (inv.invoice_number ?? "") : "",
    customerId:
      typeof inv === "object" && inv ? refId(inv.customer_id ?? "") : "",
    warehouseId: refId(wh),
    warehouse: typeof wh === "object" && wh ? (wh.name ?? "").trim() : "",
    warehouseCity: typeof wh === "object" && wh ? (wh.city ?? "") : "",
    returnDate: toDateInput(r.return_date),
    returnReason: r.return_reason ?? "",
    notes: r.notes ?? "",
    status: r.status ?? "Returned",
    creditNoteId: r.credit_note_id ?? "",
    invoiceTotal: typeof inv === "object" && inv ? (inv.total ?? 0) : 0,
  };
};

const returnReasons = [
  "Defective",
  "Wrong Item",
  "Damaged",
  "Excess Quantity",
  "Other",
];

type SortField =
  | "invoiceNumber"
  | "customer"
  | "warehouse"
  | "returnDate"
  | "returnReason"
  | "status";
type SortDir = "asc" | "desc";

// ─── Searchable dropdown (input + filtered list) ────────────────────────────────
const SearchSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  disabledHint?: string;
}> = ({ value, onChange, options, placeholder, searchPlaceholder = "Search…", disabled, disabledHint }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = options.find((o) => String(o.value) === String(value) && o.label.trim());
  const filtered = options.filter(
    (o) => o.value && o.label.trim() && o.label.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white flex items-center justify-between gap-2 ${disabled ? "opacity-60 cursor-not-allowed" : "focus:outline-none focus:ring-2 focus:ring-blue-600"}`}
      >
        <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>
          {selected ? selected.label : (disabled && disabledHint ? disabledHint : placeholder)}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>
      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {filtered.map((o) => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(""); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${String(o.value) === String(value) ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}>{o.label}</button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-gray-400">No results</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const SalesInvoiceReturns: React.FC = () => {
  const navigate = useNavigate();

  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("returnDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Option sources — API invoices keep their FULL records (product/service
  // line arrays) so a picked invoice can show its real return items.
  const [apiInvoices, setApiInvoices] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<ApiWarehouse[]>([]);
  const [apiCustomers, setApiCustomers] = useState<ApiCustomer[]>([]);

  // View modal
  const [showView, setShowView] = useState(false);
  const [viewReturn, setViewReturn] = useState<SalesReturn | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState<SalesReturn | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formReturnDate, setFormReturnDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  // Loaded line items of the selected invoice, with an editable return quantity per
  // line (defaults to full) so a return can be partial.
  type ReturnItem = { name: string; description?: string; rate: number; taxId: number; invoicedQty: number; returnQty: number };
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);

  // Local datastore sources (front-end-only fallback), merged with the API
  // lists instead of clobbering them — API rows first, local rows after.
  const dbInvoices = useCollection<any>("invoices");
  const dbCustomers = useCollection<any>("customers", "name");
  const dbProducts = useCollection<any>("products", "name");
  const invoiceOptions = useMemo<ApiInvoiceOption[]>(
    () => [
      ...apiInvoices,
      ...dbInvoices
        .slice()
        .sort((a, b) => b.id - a.id)
        .map((i) => ({ _id: String(i.id), invoice_number: i.number, customer_id: String(i.customerId), total: i.total || 0 })),
    ],
    [apiInvoices, dbInvoices],
  );
  const customers = useMemo<ApiCustomer[]>(() => {
    const local = dbCustomers
      .map((c) => ({
        _id: partyId(c._id) || String(c.id),
        name: c.name,
        email: c.email,
        company_name: c.company_name || c.companyName,
        customerName: c.customerName,
        firstName: c.firstName,
        lastName: c.lastName,
        businessProfile: c.businessProfile,
      }))
      .filter((c) => customerLabel(c));
    const byId = new Map<string, ApiCustomer>();
    for (const c of [...apiCustomers, ...local]) {
      const id = partyId(c._id);
      if (!id || !customerLabel(c) || byId.has(id)) continue;
      byId.set(id, { ...c, _id: id });
    }
    return [...byId.values()];
  }, [apiCustomers, dbCustomers]);

  // ─── Lookup maps ───────────────────────────────────────────────────────────
  const customerNameById = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach((c) => (m[c._id] = customerLabel(c)));
    return m;
  }, [customers]);

  const invoiceCustomerById = useMemo(() => {
    const m: Record<string, string> = {};
    invoiceOptions.forEach((i) => (m[i._id] = refId(i.customer_id ?? "")));
    return m;
  }, [invoiceOptions]);

  // Customer picker options, and invoices scoped to the picked customer, labelled
  // "#number - customer name".
  const customerSelectOptions = useMemo(
    () =>
      customers
        .map((c) => ({ value: partyId(c._id), label: customerLabel(c) }))
        .filter((o) => o.value && o.label.trim())
        .sort((a, b) => a.label.localeCompare(b.label)),
    [customers],
  );
  const invoiceSelectOptions = useMemo(
    () =>
      invoiceOptions
        .filter((i) => !formCustomerId || refId(i.customer_id ?? "") === formCustomerId)
        .map((i) => {
          const cust = customerNameById[refId(i.customer_id ?? "")];
          return { value: i._id, label: cust ? `${i.invoice_number} - ${cust}` : i.invoice_number };
        }),
    [invoiceOptions, formCustomerId, customerNameById],
  );

  const displayCustomer = (ret: SalesReturn) => {
    const custId = ret.customerId || invoiceCustomerById[ret.invoiceId] || "";
    return customerNameById[custId] || "—";
  };

  // ─── Data loading ──────────────────────────────────────────────────────────
  const loadReturns = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<ApiReturn[]>("/invoice-return/all", {
        params: { page: 1, limit: 1000 },
      });
      setReturns(Array.isArray(data) ? data.map(mapApiReturn) : []);
    } catch (err) {
      const message = errMessage(err, "Couldn't load invoice returns.");
      setLoadError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [inv, wh, invoiceCustomers, allCustomers] = await Promise.allSettled([
        api.get<ApiInvoiceOption[]>("/invoice/all", {
          params: { page: 1, limit: 1000 },
        }),
        api.get<ApiWarehouse[]>("/purchase/warehouses/all", {
          params: { page: 1, limit: 1000 },
        }),
        api.get<ApiCustomer[]>("/customer/invoice-list", {
          params: { page: 1, limit: 1000 },
        }),
        api.get<ApiCustomer[]>("/customers", {
          params: { page: 1, limit: 1000 },
        }),
      ]);
      // Only accept non-empty API results — otherwise the empty (no-backend)
      // responses would clobber the local-datastore fallback below.
      if (inv.status === "fulfilled") {
        const rows = asList<ApiInvoiceOption>(inv.value);
        if (rows.length) setApiInvoices(rows);
      }
      if (wh.status === "fulfilled") {
        const rows = asList<ApiWarehouse>(wh.value);
        if (rows.length) setWarehouses(rows);
      }
      const namedCustomers = [
        ...(invoiceCustomers.status === "fulfilled" ? asList<ApiCustomer>(invoiceCustomers.value) : []),
        ...(allCustomers.status === "fulfilled" ? asList<ApiCustomer>(allCustomers.value) : []),
      ]
        .map((c) => ({ ...c, _id: partyId(c._id) }))
        .filter((c) => c._id && customerLabel(c));
      if (namedCustomers.length) {
        const unique = new Map(namedCustomers.map((c) => [c._id, c]));
        setApiCustomers([...unique.values()]);
      }
    } catch {
      /* dropdowns degrade gracefully */
    }
  }, []);

  useEffect(() => {
    loadReturns();
    loadOptions();
  }, [loadReturns, loadOptions]);

  // When an API customer is picked, fetch their invoices (with full product/
  // service line arrays) via /invoice/all?customer_id= and merge them in.
  useEffect(() => {
    if (!/^[0-9a-f]{24}$/i.test(formCustomerId)) return; // local (numeric) customer
    api
      .get<any[]>("/invoice/all", { params: { page: 1, limit: 1000, customer_id: formCustomerId } })
      .then((data) => {
        const rows = asList<any>(data);
        if (rows.length === 0) return;
        setApiInvoices((prev) => {
          const fresh = new Set(rows.map((d) => partyId(d._id)));
          return [...rows, ...prev.filter((p) => !fresh.has(partyId(p._id)))];
        });
      })
      .catch(() => { /* dropdown keeps whatever it already has */ });
  }, [formCustomerId]);

  // Pick an invoice -> default its warehouse AND load its line items so the user
  // can choose full or partial return quantities.
  const handleInvoiceChange = (invoiceId: string) => {
    setFormInvoiceId(invoiceId);
    const inv = invoiceOptions.find((i) => i._id === invoiceId);
    if (inv?.warehouse_id) setFormWarehouseId(inv.warehouse_id);

    let items: ReturnItem[] = [];

    // 1) real data: the API invoice's product[] + service[] lines
    const apiInv: any = apiInvoices.find((i) => i._id === invoiceId);
    if (apiInv) {
      const prodItems: ReturnItem[] = (apiInv.product || [])
        .filter((p: any) => !p.isDeleted)
        .map((p: any) => ({
          name: typeof p.product_id === "object" && p.product_id ? p.product_id.productName ?? "" : "",
          description: typeof p.product_id === "object" && p.product_id ? p.product_id.description ?? "" : "",
          rate: p.rate ?? 0,
          taxId: 1,
          invoicedQty: p.quantity ?? 1,
          returnQty: p.quantity ?? 1, // default: full return; user can lower it
        }))
        .filter((it: ReturnItem) => it.name); // unpopulated refs have no name to show
      const svcItems: ReturnItem[] = (apiInv.service || [])
        .filter((s: any) => !s.isDeleted)
        .map((s: any) => ({
          name: typeof s.service_id === "object" && s.service_id ? s.service_id.serviceName ?? s.service_id.name ?? "Service" : "Service",
          description: "",
          rate: s.rate ?? 0,
          taxId: 1,
          invoicedQty: s.quantity ?? 1,
          returnQty: s.quantity ?? 1,
        }));
      items = [...prodItems, ...svcItems];
    }

    // 2) local invoice line items
    if (items.length === 0) {
      const dbInv = dbInvoices.find((i) => String(i.id) === invoiceId);
      items = (dbInv?.items || []).map((it: any) => ({
        name: it.name || "",
        description: it.description || "",
        rate: it.rate || 0,
        taxId: it.taxId || 1,
        invoicedQty: it.qty ?? 1,
        returnQty: it.qty ?? 1,
      }));
    }

    // 3) never show a blank return list: fall back to 3 products from the
    // local datastore so the user can always pick items + quantity.
    if (items.length === 0) {
      items = dbProducts
        .filter((p) => p.status !== "Inactive" && (p.price || 0) > 0)
        .slice(0, 3)
        .map((p) => ({
          name: p.name,
          description: p.note || "",
          rate: p.price || 0,
          taxId: p.taxId || 1,
          invoicedQty: 2,
          returnQty: 2,
        }));
    }
    setReturnItems(items);
  };
  const setReturnQty = (i: number, qty: number) =>
    setReturnItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, returnQty: Math.min(r.invoicedQty, Math.max(0, qty)) } : r)));
  const removeReturnItem = (i: number) =>
    setReturnItems((rows) => rows.filter((_, idx) => idx !== i));
  const returnTotal = returnItems.reduce((s, r) => s + r.returnQty * r.rate, 0);

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

  const filteredReturns = useMemo(() => {
    let result = [...returns];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ret) =>
          ret.invoiceNumber.toLowerCase().includes(q) ||
          ret.returnReason.toLowerCase().includes(q) ||
          displayCustomer(ret).toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "All") {
      result = result.filter((ret) => ret.status === statusFilter);
    }
    result.sort((a, b) => {
      let aVal: string | number =
        sortField === "customer"
          ? displayCustomer(a)
          : (a[sortField] as string | number);
      let bVal: string | number =
        sortField === "customer"
          ? displayCustomer(b)
          : (b[sortField] as string | number);
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    returns,
    searchQuery,
    statusFilter,
    sortField,
    sortDir,
    customerNameById,
    invoiceCustomerById,
  ]);

  const totalPages = Math.ceil(filteredReturns.length / perPage);
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Status Badge ───────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Returned":
        return "bg-gray-100 text-gray-700 border border-gray-200";
      case "Approved":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "Completed":
        return "bg-green-100 text-green-700 border border-green-200";
      case "Rejected":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const canApprove = (status: string) => status === "Returned";
  const canEdit = (status: string) => status === "Returned";

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormReturnDate(new Date().toISOString().split("T")[0]);
    setFormCustomerId("");
    setFormInvoiceId("");
    setFormWarehouseId("");
    setFormReason("");
    setFormNotes("");
    setReturnItems([]);
    setEditingId(null);
  };

  // Pick a customer → clear the invoice so the picker only shows that customer's invoices.
  const handleCustomerChange = (cid: string) => {
    setFormCustomerId(cid);
    setFormInvoiceId("");
  };

  const handleCreate = () => {
    resetForm();
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditReturn = (ret: SalesReturn) => {
    if (!canEdit(ret.status)) {
      showToast("Only returns awaiting approval can be edited.", "info");
      return;
    }
    setEditingId(ret.id);
    setFormReturnDate(ret.returnDate);
    setFormCustomerId(ret.customerId || invoiceCustomerById[ret.invoiceId] || "");
    handleInvoiceChange(ret.invoiceId); // sets invoice id + loads its line items
    setFormWarehouseId(ret.warehouseId);
    setFormReason(ret.returnReason);
    setFormNotes(ret.notes);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSaveReturn = async () => {
    if (!formReturnDate) return showToast("Please select a return date", "info");
    if (!formInvoiceId)
      return showToast("Please select an original invoice", "info");
    if (!formWarehouseId) return showToast("Please select a warehouse", "info");
    if (!formReason) return showToast("Please select a return reason", "info");
    const returned = returnItems.filter((r) => r.returnQty > 0);
    if (returnItems.length > 0 && returned.length === 0)
      return showToast("Set a return quantity for at least one item", "info");

    const payload = {
      invoice_id: formInvoiceId,
      warehouse_id: formWarehouseId,
      return_date: formReturnDate,
      return_reason: formReason,
      notes: formNotes,
      // partial-return line items + total
      items: returned.map((r) => ({ name: r.name, description: r.description, rate: r.rate, taxId: r.taxId, qty: r.returnQty, amount: +(r.returnQty * r.rate).toFixed(2) })),
      total: +returnTotal.toFixed(2),
      is_partial: returned.some((r) => r.returnQty < r.invoicedQty),
    };

    setSaving(true);
    try {
      if (isEditing && editingId) {
        await api.patch(`/invoice-return/edit/${editingId}`, payload);
        showToast("Invoice return updated!", "success");
      } else {
        await api.post("/invoice-return/create", payload);
        showToast("Invoice return created!", "success");
      }
      setShowForm(false);
      resetForm();
      await loadReturns();
    } catch (err) {
      showToast(errMessage(err, "Couldn't save invoice return."), "error");
    } finally {
      setSaving(false);
    }
  };

  // ─── View (single) ─────────────────────────────────────────────────────────
  const openView = async (ret: SalesReturn) => {
    setViewReturn(ret);
    setShowView(true);
    setViewLoading(true);
    try {
      const data = await api.get<ApiReturn>(`/invoice-return/single/${ret.id}`);
      if (data) setViewReturn(mapApiReturn(data));
    } catch (err) {
      showToast(errMessage(err, "Couldn't load return details."), "error");
    } finally {
      setViewLoading(false);
    }
  };

  // ─── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async (ret: SalesReturn) => {
    setProcessingId(ret.id);
    try {
      await api.patch(`/invoice-return/approve/${ret.id}`);
      showToast("Return approved; draft credit note created.", "success");
      await loadReturns();
    } catch (err) {
      showToast(errMessage(err, "Couldn't approve return."), "error");
    } finally {
      setProcessingId(null);
    }
  };

  // ─── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/invoice-return/delete/${toDelete.id}`);
      showToast("Invoice return deleted!", "success");
      setShowDelete(false);
      setToDelete(null);
      await loadReturns();
    } catch (err) {
      showToast(errMessage(err, "Couldn't delete return."), "error");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Sort Header ────────────────────────────────────────────────────────────

  const SortHeader: React.FC<{ field: SortField; label: string }> = ({
    field,
    label,
  }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-50 whitespace-nowrap"
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
  // CREATE / EDIT FORM VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (showForm) {
    return (
      <div className="flex-1 m-2 bg-white border border-gray-300 shadow-sm overflow-hidden flex flex-col">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => navigate("/")}
              className="hover:text-gray-700"
            >
              Dashboard
            </button>
            <span>›</span>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="hover:text-gray-700"
            >
              Sales Returns
            </button>
            <span>›</span>
            <span className="text-gray-900 font-medium">
              {isEditing ? "Edit Sales Return" : "Create Sales Return"}
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Sales Return" : "Create Sales Return"}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <RefreshCw className="w-5 h-5 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">
                Sales Return Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <AppDatePicker
                    value={formReturnDate}
                    onChange={(e) => setFormReturnDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <SearchSelect
                  value={formCustomerId}
                  onChange={handleCustomerChange}
                  options={customerSelectOptions}
                  placeholder="Select Customer"
                  searchPlaceholder="Search customer…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Original Invoice <span className="text-red-500">*</span>
                </label>
                <SearchSelect
                  value={formInvoiceId}
                  onChange={handleInvoiceChange}
                  options={invoiceSelectOptions}
                  placeholder="Select Invoice"
                  searchPlaceholder="Search invoice…"
                  disabled={!formCustomerId}
                  disabledHint="Select a customer first"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={formWarehouseId}
                  onChange={(e) => setFormWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white"
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
                  Return Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white"
                >
                  <option value="">Select Reason</option>
                  {returnReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Return items — loaded from the selected invoice; edit quantities for a partial return */}
            {formInvoiceId && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Items</label>
                {returnItems.length === 0 ? (
                  <div className="border border-gray-200 rounded-md px-3 py-4 text-sm text-gray-400">This invoice has no line items.</div>
                ) : (
                  <div className="border border-gray-200 rounded-md overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs">
                          <th className="text-left font-semibold px-4 py-2.5">Item</th>
                          <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                          <th className="text-right font-semibold px-2 py-2.5">Invoiced Qty</th>
                          <th className="text-right font-semibold px-2 py-2.5">Return Qty</th>
                          <th className="text-right font-semibold px-4 py-2.5">Return Amount</th>
                          <th className="w-10 px-2 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnItems.map((it, i) => (
                          <tr key={i} className="border-t border-gray-200 align-top">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{it.name}</div>
                              {it.description && <div className="text-xs text-gray-500 mt-0.5">{it.description}</div>}
                            </td>
                            <td className="px-2 py-3 text-right text-gray-800">{fmtCurrency(it.rate)}</td>
                            <td className="px-2 py-3 text-right text-gray-800">{it.invoicedQty}</td>
                            <td className="px-2 py-3 text-right">
                              <input
                                type="number"
                                min={0}
                                max={it.invoicedQty}
                                value={it.returnQty}
                                onChange={(e) => setReturnQty(i, Number(e.target.value))}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-600"
                              />
                              <span className="text-[11px] text-gray-400 ml-1">/ {it.invoicedQty}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCurrency(it.returnQty * it.rate)}</td>
                            <td className="px-2 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeReturnItem(i)}
                                title="Remove this item from the return"
                                aria-label={`Remove ${it.name}`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-3 text-xs">
                        <button type="button" onClick={() => setReturnItems((rs) => rs.map((r) => ({ ...r, returnQty: r.invoicedQty })))} className="text-blue-600 hover:text-blue-700">Return full</button>
                        <button type="button" onClick={() => setReturnItems((rs) => rs.map((r) => ({ ...r, returnQty: 0 })))} className="text-gray-500 hover:text-gray-700">Clear all</button>
                      </div>
                      <div className="text-sm"><span className="text-gray-600">Return Total</span> <span className="font-semibold text-gray-900 ml-2">{fmtCurrency(returnTotal)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm resize-y"
              />
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pb-6">
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveReturn}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Saving…" : isEditing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex-1 m-2 bg-white border border-gray-300 shadow-sm overflow-hidden flex flex-col">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">
            Dashboard
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">Sales Returns</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Sales Returns
          </h2>
          <button
            onClick={handleCreate}
            className="w-9 h-9 flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
            title="Create Return"
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
                placeholder="Search by invoice, customer or reason..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-72 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              onClick={() => loadReturns()}
              className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600"
            >
              Refresh
            </button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* View toggle */}
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

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

            {/* Filters */}
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
                  {["All", "Returned", "Approved", "Completed", "Rejected"].map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setStatusFilter(st);
                          setCurrentPage(1);
                          setShowFilters(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${statusFilter === st ? "text-blue-600 font-medium bg-blue-50" : "text-gray-700"}`}
                      >
                        {st}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table / Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading invoice returns…</span>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center text-sm text-red-600">
            {loadError}
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-300">
                <tr>
                  <SortHeader field="invoiceNumber" label="Invoice Number" />
                  <SortHeader field="customer" label="Customer" />
                  <SortHeader field="warehouse" label="Warehouse" />
                  <SortHeader field="returnDate" label="Return Date" />
                  <SortHeader field="returnReason" label="Reason" />
                  <SortHeader field="status" label="Status" />
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <button
                        onClick={() => openView(ret)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {ret.invoiceNumber || "—"}
                      </button>
                    </td>
                    <td className="px-3 py-4 text-gray-900">
                      {displayCustomer(ret)}
                    </td>
                    <td className="px-3 py-4 text-gray-600">
                      {ret.warehouse || "—"}
                    </td>
                    <td className="px-3 py-4 text-gray-600">
                      {ret.returnDate}
                    </td>
                    <td className="px-3 py-4 text-gray-600">
                      {ret.returnReason || "—"}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(ret.status)}`}
                      >
                        {ret.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openView(ret)}
                          className="p-1.5 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canApprove(ret.status) ? (
                          <button
                            onClick={() => handleApprove(ret)}
                            disabled={processingId === ret.id}
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
                            title="Approve (creates credit note)"
                          >
                            {processingId === ret.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-7 h-7" /> /* fixed slot keeps action columns aligned */
                        )}
                        <button
                          onClick={() => handleEditReturn(ret)}
                          disabled={!canEdit(ret.status)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          title={
                            canEdit(ret.status)
                              ? "Edit"
                              : "Approved returns can't be edited"
                          }
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setToDelete(ret);
                            setShowDelete(true);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedReturns.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-12 text-center text-gray-500"
                    >
                      No returns found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedReturns.map((ret) => (
              <div
                key={ret.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => openView(ret)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {ret.invoiceNumber || "Return"}
                  </button>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(ret.status)}`}
                  >
                    {ret.status}
                  </span>
                </div>
                <div className="text-sm text-gray-900 mb-1">
                  {displayCustomer(ret)}
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {ret.returnDate} • {ret.warehouse || "—"}
                </div>
                <div className="flex items-center justify-between mb-3 pt-3 border-t border-gray-100">
                  <div>
                    <div className="text-xs text-gray-500">Reason</div>
                    <div className="text-sm font-medium text-gray-900">
                      {ret.returnReason || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Invoice Total</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {fmtCurrency(ret.invoiceTotal)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => openView(ret)}
                    className="p-1.5 text-yellow-500 hover:text-yellow-600 rounded"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {canApprove(ret.status) ? (
                    <button
                      onClick={() => handleApprove(ret)}
                      disabled={processingId === ret.id}
                      className="p-1.5 text-blue-500 hover:text-blue-700 rounded disabled:opacity-50"
                      title="Approve (creates credit note)"
                    >
                      {processingId === ret.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-7 h-7" /> /* fixed slot keeps action columns aligned */
                  )}
                  <button
                    onClick={() => handleEditReturn(ret)}
                    disabled={!canEdit(ret.status)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                    title={
                      canEdit(ret.status)
                        ? "Edit"
                        : "Approved returns can't be edited"
                    }
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setToDelete(ret);
                      setShowDelete(true);
                    }}
                    className="p-1.5 text-red-400 hover:text-red-600 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {paginatedReturns.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                No returns found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-sm text-gray-500">
            Showing{" "}
            {filteredReturns.length === 0 ? 0 : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredReturns.length)} of{" "}
            {filteredReturns.length} results
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

      {/* View Return Modal */}
      {showView && viewReturn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Return · {viewReturn.invoiceNumber || "Invoice"}
                </h2>
                <span
                  className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${getStatusColor(viewReturn.status)}`}
                >
                  {viewReturn.status}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Invoice Number</p>
                    <p className="text-sm text-gray-900">
                      {viewReturn.invoiceNumber || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="text-sm text-gray-900">
                      {displayCustomer(viewReturn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Warehouse</p>
                    <p className="text-sm text-gray-900">
                      {viewReturn.warehouse || "—"}
                      {viewReturn.warehouseCity
                        ? ` (${viewReturn.warehouseCity})`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Return Date</p>
                    <p className="text-sm text-gray-900">
                      {viewReturn.returnDate || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reason</p>
                    <p className="text-sm text-gray-900">
                      {viewReturn.returnReason || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Total</p>
                    <p className="text-sm text-gray-900">
                      {fmtCurrency(viewReturn.invoiceTotal)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-sm text-gray-900">
                      {viewReturn.notes || "—"}
                    </p>
                  </div>
                  {viewReturn.creditNoteId && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">Credit Note</p>
                      <p className="text-sm text-gray-900">
                        {viewReturn.creditNoteId}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              {!viewLoading && canApprove(viewReturn.status) && (
                <button
                  onClick={() => {
                    setShowView(false);
                    handleApprove(viewReturn);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm inline-flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
              )}
              {!viewLoading && canEdit(viewReturn.status) && (
                <button
                  onClick={() => {
                    setShowView(false);
                    handleEditReturn(viewReturn);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm inline-flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button
                onClick={() => setShowView(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && toDelete && (
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
                Delete Return
              </h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this return for{" "}
                <span className="font-semibold">
                  {toDelete.invoiceNumber || "this invoice"}
                </span>
                ? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
