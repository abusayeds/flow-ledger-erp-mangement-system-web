/**
 * File: src/pages/purchase/PurchaseOrders.tsx
 * Purchase Order — master/detail layout matching the reference design.
 * Left: list (search, sort, status/vendor/date filters, selection mode).
 * Right: detail (action icons + ⋮ menu, status badge, meta with Bill Status,
 *        line items, terms/notes/attachment, totals, ribbon) and modals
 *        (Preview / Email / Settings).
 * Purchase-side analog of the Estimate: vendor instead of customer, and the
 * meta tracks Bill Status (Not Billed) instead of carrying a payment.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useState, useEffect } from "react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { PartyFilterPopover } from "@/components/ui/PartyFilterPopover";
import { dateRangeFor } from "@/lib/listDateRange";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter } from "@/components/ui/ListSidebarFooter";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useCollection, repo, nextNumber, money as fmtMoney, CreateDocForm, DocPreview , PdfPreviewModal} from "@/lib/db";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { ActivityLogModal } from "@/components/modals/ActivityLogModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
import { updatePurchaseOrder } from "@/services/purchaseOrdersApi";
import { api } from "@/lib/api/client";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  Settings,
  SlidersHorizontal,
  Pencil,
  PenTool,
  Eye,
  Printer,
  Mail,
  MoreVertical,
  X,
  Trash2,
  MessageCircle,
  CircleChevronUp,
  CircleChevronDown,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
type Status = "Draft" | "Sent" | "Approved" | "On Hold" | "Disputed" | "Declined" | "Cancelled" | "Closed" | "Received";

interface PurchaseOrder {
  id: number;
  name: string;
  vendor: string;
  number: string;
  note: string;
  date: string;
  amount: string;
  status: Status;
  billNo: string;
  billStatus: string;
}

const sortFields = ["Name", "First Name", "Last Name", "Purchase orders date", "Purchase Order #", "Status", "Total"];
const sortDirections = ["Ascending", "Descending"];
const statusList: (Status | "All" | "Trash")[] = ["All", "Draft", "Sent", "Approved", "On Hold", "Disputed", "Declined", "Cancelled", "Closed", "Received", "Trash"];
const markAsStatuses: Status[] = ["Draft", "Sent", "Approved", "On Hold", "Disputed", "Declined", "Cancelled", "Closed", "Received"];
const duplicateAs = ["As Invoice", "As Estimate", "As Proforma Invoice", "As Purchase Order"];
const PO_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const PO_TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const nowLabel = () => "Today " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const dateRanges = ["All", "Today", "This Week", "Last Week", "This Month", "Last 30 Days", "Last Month", "Last 90 Days", "This Quarter", "Last Quarter", "This Year", "Last Year", "Date Range"];

const STATUS_BADGE: Record<Status, string> = {
  Draft: "bg-gray-600 text-white",
  Sent: "bg-gray-900 text-white",
  Approved: "bg-green-500 text-white",
  "On Hold": "bg-orange-500 text-white",
  Disputed: "bg-amber-500 text-white",
  Declined: "bg-red-500 text-white",
  Cancelled: "bg-red-500 text-white",
  Closed: "bg-gray-500 text-white",
  Received: "bg-green-600 text-white",
};

/** Backend may send `draft` / `onhold`; normalize so STATUS_BADGE always hits. */
const normalizePoStatus = (raw: unknown): Status => {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
  const compact = key.replace(/\s+/g, "");
  const map: Record<string, Status> = {
    draft: "Draft",
    sent: "Sent",
    approved: "Approved",
    "on hold": "On Hold",
    onhold: "On Hold",
    disputed: "Disputed",
    declined: "Declined",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    closed: "Closed",
    posted: "Closed",
    received: "Received",
  };
  return map[key] || map[compact] || "Draft";
};

const poBadge = (status: unknown) => STATUS_BADGE[normalizePoStatus(status)];

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};

const rowDateIso = (value: string): string | null => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const matchesDateRange = (value: string, range: { dateFrom?: string; dateTo?: string }) => {
  if (!range.dateFrom) return true;
  const iso = rowDateIso(value);
  if (!iso) return false;
  const end = range.dateTo || range.dateFrom;
  return iso >= range.dateFrom && iso <= end;
};

/* ── Modal shell ───────────────────────────────────────────────── */
const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div>
    </div>
  );
};

/* ── Email modal ───────────────────────────────────────────────── */
const EmailModal: React.FC<{ onClose: () => void; po: PurchaseOrder }> = ({ onClose, po }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-base font-medium text-gray-900">Purchase Order {po.number} from info</h3>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Send</button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <input placeholder="To" className="flex-1 bg-transparent text-sm outline-none" />
          <button className="text-xs text-gray-500 hover:text-gray-700">Cc &amp; Bcc</button>
        </div>
        <input defaultValue={`Purchase Order ${po.number} from info`} className="w-full border-b border-gray-200 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-200 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {po.name}</p>
          <p>Purchase Order {po.number}<br />Total Amount: {po.amount}</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Purchase Order {po.number}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

/* ── Component ──────────────────────────────────────────────────── */
export const PurchaseOrder: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number; openCreate?: boolean } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState(navSelectedId ?? 1);
  useEffect(() => { if (navSelectedId != null) setSelectedId(navSelectedId); }, [navSelectedId]);
  const [sortBy, setSortBy] = useState("Purchase orders date");
  const [sortDir, setSortDir] = useState("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [vendorFilterLabels, setVendorFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "pdfSettings">(null);
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  useEffect(() => {
    if (navState?.openCreate) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, location.pathname, navigate]);
  const [editRecord, setEditRecord] = useState<any>(null);

  const dbOrders = useCollection<any>("purchaseOrders");
  const dbVendors = useCollection<any>("vendors", "name");
  const poDateRange = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);
  const filteredVendorLocalIds = useMemo(() => {
    if (!vendorFilter.length) return null;
    const keys = new Set(vendorFilter.map(String));
    return new Set(
      dbVendors.filter((v) => keys.has(String(v._id))).map((v) => v.id),
    );
  }, [dbVendors, vendorFilter]);
  const orders: PurchaseOrder[] = useMemo(
    () => dbOrders.slice().sort((a, b) => b.id - a.id).map((d) => {
      const ven = dbVendors.find((v) => v.id === d.vendorId);
      const vn = ven?.name || "—";
      return { id: d.id, name: vn, vendor: ven?.contact || ven?.email || "", number: d.number, note: d.notes || "No Notes", date: d.date, amount: fmtMoney(d.total), status: normalizePoStatus(d.status), billNo: d.billNo || "-", billStatus: d.billStatus || "Not Billed" };
    }),
    [dbOrders, dbVendors],
  );

  const filtered = useMemo(() => {
    const toNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    let list = orders.filter(
      (i) =>
        (statusFilter === "All" || i.status === statusFilter) &&
        (filteredVendorLocalIds == null || filteredVendorLocalIds.has(dbOrders.find((d) => d.id === i.id)?.vendorId)) &&
        matchesDateRange(i.date, poDateRange) &&
        (search.trim() === "" || i.name.toLowerCase().includes(search.toLowerCase()) || i.number.includes(search)),
    );
    list = [...list].sort((a, b) => {
      let r = 0;
      if (sortBy === "Total") r = toNum(a.amount) - toNum(b.amount);
      else if (sortBy === "Purchase Order #") r = a.id - b.id;
      else if (sortBy === "Status") r = a.status.localeCompare(b.status);
      else if (sortBy === "Name" || sortBy === "First Name" || sortBy === "Last Name") r = a.name.localeCompare(b.name);
      else r = a.id - b.id; // Purchase orders date
      return sortDir === "Ascending" ? r : -r;
    });
    return list;
  }, [orders, sortBy, sortDir, statusFilter, filteredVendorLocalIds, poDateRange, search, dbOrders]);

  const selected = orders.find((i) => i.id === selectedId) || orders[0];
  const selectedDb: any = dbOrders.find((d) => d.id === (selected?.id ?? selectedId)) || {};
  const selectedVendor: any = dbVendors.find((v) => v.id === selectedDb.vendorId) || {};

  /* Append an event to the purchase order's activity log. */
  const logActivity = async (kind: string, text: string) => {
    const rec = dbOrders.find((d) => d.id === selectedDb.id);
    await repo.update("purchaseOrders", selectedDb.id, { activity: [...(rec?.activity || []), { kind, text, ts: Date.now(), dateLabel: nowLabel() }] });
  };
  const markAs = async (status: string) => {
    await repo.update("purchaseOrders", selectedDb.id, { status });
    await logActivity(status === "Sent" ? "sent" : "status", `Purchase Order ${selectedDb.number} mark as ${status.toLowerCase()}.`);
    showToast(`Purchase order marked as ${status}`, "success");
  };
  const convertToBill = async () => {
    if (!selectedDb?.id) return;
    const n = await nextNumber("bills");
    const id = await repo.add("bills", {
      number: "#" + n, vendorId: selectedDb.vendorId, date: selectedDb.date, due: selectedDb.due || selectedDb.date,
      ts: Date.now(), status: "Draft", items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0,
      tax: selectedDb.tax || 0, total: selectedDb.total || 0, amountPaid: 0,
      amountDue: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    });
    await repo.update("purchaseOrders", selectedDb.id, { billNo: "#" + n, billId: id, billStatus: "Billed" });
    await logActivity("sent", `Purchase Order ${selectedDb.number} converted to bill.`);
    showToast("Converted to bill", "success");
    navigate("/purchase/bills", { state: { selectedId: id } });
  };
  /** Customer-side duplicates need a customer — reuse one with the vendor's
   *  name, or copy the vendor into customers so the link stays live. */
  const ensureCustomerForVendor = async (): Promise<number> => {
    const customers = await repo.getAll("customers");
    const match = customers.find((c: any) => c.name === selectedVendor.name);
    if (match) return match.id;
    const { id, createdAt, updatedAt, payable, ...rest } = selectedVendor;
    return repo.add("customers", { ...rest, balance: 0, status: "Active" });
  };
  const duplicatePoAs = async (label: string) => {
    const base = {
      date: selectedDb.date, due: selectedDb.due, ts: Date.now(),
      items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0, tax: selectedDb.tax || 0,
      total: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    };
    if (label === "As Purchase Order") {
      const n = await nextNumber("purchaseOrders");
      const id = await repo.add("purchaseOrders", { ...base, number: "#" + n, vendorId: selectedDb.vendorId, status: "Draft", billNo: "-", billStatus: "Not Billed", amountPaid: 0, amountDue: base.total });
      setSelectedId(id);
      showToast("Purchase order duplicated", "success");
      return;
    }
    const customerId = await ensureCustomerForVendor();
    if (label === "As Invoice") {
      const n = await nextNumber("invoices");
      const id = await repo.add("invoices", { ...base, number: "#" + n, customerId, status: "Draft", shipping: 0, amountPaid: 0, amountDue: base.total });
      showToast("Invoice created", "success");
      navigate("/sales/sales-invoice", { state: { selectedId: id } });
    } else if (label === "As Estimate") {
      const n = await nextNumber("estimates");
      const id = await repo.add("estimates", { ...base, number: "#" + n, customerId, status: "Draft" });
      showToast("Estimate created", "success");
      navigate("/sales/estimates", { state: { selectedId: id } });
    } else if (label === "As Proforma Invoice") {
      const n = await nextNumber("proformas");
      const id = await repo.add("proformas", { ...base, number: "#" + n, customerId, status: "Draft", amountPaid: 0, amountDue: base.total });
      showToast("Proforma invoice created", "success");
      navigate("/sales/proforma-invoices", { state: { selectedId: id } });
    }
  };
  const trashCurrent = async () => {
    await repo.remove("purchaseOrders", selectedDb.id);
    showToast(`Purchase Order ${selectedDb.number} moved to trash`, "success");
    setSelectedId(orders.find((o) => o.id !== selectedDb.id)?.id ?? 0);
    setConfirmAction(null);
  };
  const trashSelectedPo = async () => {
    const ids = [...checked];
    await repo.removeMany("purchaseOrders", ids);
    showToast(`${ids.length} purchase ${ids.length === 1 ? "order" : "orders"} moved to trash`, "success");
    if (ids.includes(selectedId)) setSelectedId(orders.find((o) => !ids.includes(o.id))?.id ?? 0);
    setConfirmAction(null);
    exitSelect();
  };
  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedDb?._id;
    let signaturePath = data.image;
    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `po-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        signaturePath =
          uploadRes.data?.data?.file_path ||
          uploadRes.data?.data?.path ||
          uploadRes.data?.data?.[0]?.path ||
          data.image;
        await updatePurchaseOrder(String(backendId), { signature: signaturePath });
      }
      if (selectedDb?.id) {
        await repo.update("purchaseOrders", selectedDb.id, {
          signature: signaturePath,
          signatureName: data.name,
          signatureTitle: data.title,
          signatureDate: data.date,
        });
      }
      await logActivity("status", `Vendor signature added to Purchase Order ${selectedDb.number}.`);
      showToast("Signature saved", "success");
    } catch {
      showToast("Could not save signature", "error");
    }
  };

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const listTotal = filtered.reduce((s, i) => s + num(i.amount), 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const selectedTotal = orders.filter((i) => checked.has(i.id)).reduce((s, i) => s + num(i.amount), 0);
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: number) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.id))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const actionIcons: { icon: React.ElementType; title: string; onClick?: () => void }[] = [
    { icon: Settings, title: "Settings", onClick: () => setModal("settings") },
    { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) },
    { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") },
    { icon: Pencil, title: "Edit", onClick: () => selectedDb?.id && setEditRecord(selectedDb) },
    { icon: PenTool, title: "Vendor Signature", onClick: () => setSigOpen(true) },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => { logActivity("printed", `Purchase Order ${selectedDb.number} printed.`); setModal("preview"); } },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  const hasActiveFilters = statusFilter !== "All" || !!search.trim() || vendorFilter.length > 0 || dateFilter !== "All";
  if (!selected && !createOpen && !hasActiveFilters) return <ListEmptyState title="No purchase orders yet" onCreate={() => setCreateOpen(true)} createLabel="New Purchase Order" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Purchase Order" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              <button title="Delete" onClick={() => (checked.size === 0 ? showToast("Select purchase orders to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp…", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Purchase Orders</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Purchase Orders")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("purchase-orders"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("purchase-orders"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search purchase orders..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        {/* toolbar */}
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => (
              <>
                {sortFields.map((o) => (
                  <button key={o} onClick={() => { setSortBy(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>
                ))}
                <div className="border-t border-gray-200 my-1" />
                {sortDirections.map((d) => (
                  <button key={d} onClick={() => { setSortDir(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === sortDir && <Check className="w-4 h-4 text-blue-600" />}</button>
                ))}
              </>
            )}
          </Dropdown>
          <Dropdown trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusList.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${s === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{s} {s === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <PartyFilterPopover
            kind="vendor"
            appliedIds={vendorFilter}
            appliedLabels={vendorFilterLabels}
            onApply={(ids, labels) => {
              setVendorFilter(ids);
              setVendorFilterLabels(labels);
            }}
          />
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Purchase orders date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => dateRanges.map((d) => (
              <button key={d} onClick={() => { setDateFilter(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
          {filtered.map((p) => {
            const active = !selectMode && p.id === selectedId;
            const isChecked = checked.has(p.id);
            return (
              <button key={p.id} onClick={() => (selectMode ? toggleRow(p.id) : setSelectedId(p.id))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.number}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{p.note}</div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-xs text-gray-500">{p.date}</span>
                  <span className="text-sm font-semibold text-gray-900 mt-0.5">{p.amount}</span>
                  <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${poBadge(p.status)}`}>{p.status}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter total={money(listTotal)} countLabel={`${filtered.length} Purchase Orders`} />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {createOpen ? (
        <CreateDocForm collection="purchaseOrders" title="New Purchase Order" party="vendors" buy onClose={() => setCreateOpen(false)} onSaved={(id) => setSelectedId(id)} />
      ) : editRecord ? (
        <CreateDocForm collection="purchaseOrders" title="Edit Purchase Order" party="vendors" buy record={editRecord} onClose={() => setEditRecord(null)} onSaved={(id) => { setEditRecord(null); setSelectedId(id); }} />
      ) : selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} Purchase {checked.size === 1 ? "Order" : "Orders"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(selectedTotal)}</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="module-detail-panel custom-scrollbar">
          <div className="relative flex-1 overflow-hidden flex flex-col">
            {/* header */}
            <div className="module-title-bar">
              <DocPartyHeader
                party="vendor"
                partyId={partyIdFromRef(selectedVendor._id)}
                title={selected.name}
                subtitle={selected.vendor || selectedVendor.contact || selectedVendor.email || ""}
                titleClassName="text-lg font-semibold text-gray-900 truncate"
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {actionIcons.map((a) => (
                  <button key={a.title} title={a.title} onClick={a.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><a.icon className="w-4 h-4" /></button>
                ))}
                {/* ⋮ menu (reference: WhatsApp / Convert to Bill / Mark As ▸ / Duplicate ▸ / Signature Request / Activity Log / Trash) */}
                <Dropdown align="right" panelClass="min-w-[200px]" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <div className="py-1">
                      <button type="button" onClick={() => { showToast("Opening WhatsApp…", "info"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
                      <button type="button" onClick={() => { convertToBill(); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Convert to Bill</button>
                      <MoreMenuFlyoutRow label="Mark As">
                        {markAsStatuses.map((st) => (
                          <button key={st} type="button" onClick={() => { markAs(st); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{st}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <MoreMenuFlyoutRow label="Duplicate">
                        {duplicateAs.map((st) => (
                          <button key={st} type="button" onClick={() => { duplicatePoAs(st); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{st}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={() => { setSigRequestOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left border-t border-gray-200">Signature Request</button>
                      <button type="button" onClick={() => { setActivityOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Activity Log</button>
                      <button type="button" onClick={() => { setConfirmAction("trashOne"); close(); }} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200">Trash</button>
                    </div>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* meta row — #, date, Bill #, Bill Status, status badge (chevron toggle) */}
            {expanded && (
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-12">
                <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
                <div><div className="text-xs text-gray-500">Purchase orders date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                {selected.billStatus === "Billed" && (
                  <div>
                    <div className="text-xs text-gray-500">Bill #</div>
                    <button onClick={() => navigate("/purchase/bills", { state: { selectedId: selectedDb.billId ?? parseInt(selected.billNo.replace("#", "")) } })} className="text-sm font-semibold text-blue-600 hover:text-blue-700">{selected.billNo}</button>
                  </div>
                )}
                <div><div className="text-xs text-gray-500">Bill Status</div><div className={`text-sm font-semibold ${selected.billStatus === "Billed" ? "text-green-600" : "text-red-500"}`}>{selected.billStatus}</div></div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${poBadge(selected.status)}`}>{selected.status}</span>
            </div>
            )}

            {/* line items */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-left font-semibold px-5 py-2.5">Sr. No.</th>
                    <th className="text-left font-semibold px-2 py-2.5">Items</th>
                    <th className="text-right font-semibold px-2 py-2.5">Quantity</th>
                    <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                    <th className="text-left font-semibold px-2 py-2.5">Tax</th>
                    <th className="text-right font-semibold px-2 py-2.5">Discount</th>
                    <th className="text-right font-semibold px-5 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDb.items || []).length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>
                  )}
                  {(selectedDb.items || []).map((it: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200 align-top">
                      <td className="px-5 py-3 text-gray-700">{idx + 1}</td>
                      <td className="px-2 py-3"><div className="font-semibold text-gray-900">{it.name}</div>{it.description && <div className="text-xs text-gray-500 mt-0.5">{it.description}</div>}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{it.qty ?? 1}{it.unit ? ` ${it.unit}` : ""}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(it.rate)}</td>
                      <td className="px-2 py-3 text-gray-800">{PO_TAX_NAME[it.taxId || 1]}</td>
                      <td className="px-2 py-3 text-right text-gray-500 text-xs">{it.discount ? `${it.discount}%` : "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(it.amount ?? (it.qty || 0) * (it.rate || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* terms + notes + attachment + totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">Terms &amp; Conditions</label>
                  <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selectedDb.terms || "—"}</div>
                </div>
                <DocAttachmentField
                  compact
                  value={selectedDb?.Attachment || selectedDb?.attachments || ""}
                  onChange={async (path) => {
                    if (!selectedDb?.id) {
                      showToast("Save the document first", "error");
                      throw new Error("missing id");
                    }
                    await repo.update("purchaseOrders", selectedDb.id, { Attachment: path });
                    showToast(path ? "Attachment saved" : "Attachment removed", "success");
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selectedDb.notes || "—"}</div>
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden self-start">
                <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedDb.subTotal)}</span></div>
                {(selectedDb.inlineDiscount || 0) > 0 && (
                  <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Inline Discount</span><span>{fmtMoney(selectedDb.inlineDiscount)}</span></div>
                )}
                {Object.entries(
                  ((selectedDb.items || []) as any[]).reduce((acc: Record<number, number>, it: any) => {
                    const base = it.amount ?? (it.qty || 0) * (it.rate || 0);
                    acc[it.taxId || 1] = (acc[it.taxId || 1] || 0) + base;
                    return acc;
                  }, {}),
                ).map(([taxId, base]) => (
                  <div key={taxId} className="flex justify-between px-4 py-2 text-xs text-gray-500">
                    <span>{PO_TAX_NAME[Number(taxId)]} {PO_TAX_RATE[Number(taxId)]}% on {fmtMoney(base as number)}</span>
                    <span>{fmtMoney(((base as number) * (PO_TAX_RATE[Number(taxId)] || 0)) / 100)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedDb.total)}</span></div>
              </div>
            </div>

            {/* saved signature (shows after Add Signature) */}
            <SignatureBlock record={selectedDb} label="Vendor Signature" />

            {/* status corner ribbon */}
            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 text-[10px] font-semibold py-1 text-center ${poBadge(selected.status)}`}>{selected.status}</div>
            </div>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "settings" && <AppSettingsModal initialTab="Purchase Order" onClose={() => setModal(null)} />}
      {modal === "preview" && (() => { const d: any = dbOrders.find((x) => x.id === selectedId) || {}; const pp: any = dbVendors.find((x) => x.id === d.vendorId) || {}; const pn = pp.name || "—"; return <PdfPreviewModal docType="purchaseOrder" recordId={d.id} title={`Purchase Order `} onClose={() => setModal(null)} />; })()}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} po={selected} />}
      {modal === "pdfSettings" && (
        <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="purchaseOrder" />
      )}
      {sigOpen && (
        <SignatureModal
          heading="Vendor Signature"
          defaultName={selectedVendor.contact || selectedVendor.name || ""}
          onDone={saveSignature}
          onClose={() => setSigOpen(false)}
        />
      )}
      {sigRequestOpen && (
        <SignatureRequestModal
          docLabel="Purchase Order"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedVendor}
          documentId={String(selectedDb?._id || "") || undefined}
          emailType="purchase_order"
          emailNav="purchase_order"
          pdfDocType="purchaseOrder"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{ updatedAt: new Date().toISOString() }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void logActivity("sent", `Signature request for Purchase Order ${selectedDb.number} sent.`);
          }}
        />
      )}
      {activityOpen && <ActivityLogModal docLabel="Purchase Order" record={selectedDb} onClose={() => setActivityOpen(false)} />}
      {confirmAction === "trashOne" && (
        <ConfirmAlert message="Are you sure want to trash this purchase order?" onNo={() => setConfirmAction(null)} onYes={trashCurrent} />
      )}
      {confirmAction === "trashSelected" && (
        <ConfirmAlert message="Are you sure want to delete these purchase orders?" onNo={() => setConfirmAction(null)} onYes={trashSelectedPo} />
      )}
    </div>
  );
};

export default PurchaseOrder;
