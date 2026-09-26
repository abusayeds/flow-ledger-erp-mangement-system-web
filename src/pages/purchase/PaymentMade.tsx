/**
 * File: src/pages/purchase/PaymentMade.tsx
 * Payment Made — master/detail layout matching the reference design.
 * Left: list (search, sort, status/vendor/date filters, selection mode).
 * Right: detail (action icons + ⋮ menu, meta with Payment date / Type, a
 *        Bills section showing the bill the payment was applied to, Notes +
 *        Internal Notes, Attachment) and modals (Edit Payment → Bills chooser,
 *        PDF preview / Email).
 * Purchase-side analog of Payment Received, but a payment is applied to a Bill
 * (the detail carries a Bills section, and editing opens a bill chooser).
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useState, useEffect } from "react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { dateRangeFor } from "@/lib/listDateRange";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { buildListSortParam } from "@/lib/listSort";
import { fetchVendorPayments, type VendorPaymentListRow } from "@/services/vendorPaymentsApi";
import { useLocation, useNavigate } from "react-router-dom";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useCollection, repo, DocPreview, PdfPreviewModal } from "@/lib/db";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { RecordPaymentMadeForm, type PaymentMadePrefill } from "@/components/payments/RecordPaymentMadeForm";
import { showToast } from "@/utils/toast";
import {
  Search,
  Plus,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Pencil,
  Eye,
  Printer,
  Mail,
  MoreVertical,
  Download,
  X,
  Trash2,
  MessageCircle,
  Settings,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
interface Payment {
  id: string;
  backendId: string;
  name: string;
  number: string;
  note: string;
  date: string;
  amount: string;
  method: string;
  billNo: string;
}

const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const mapPaymentRow = (row: VendorPaymentListRow): Payment => ({
  id: row._id,
  backendId: row._id,
  name: row.vendorName,
  number: row.number.startsWith("#") ? row.number : `#${String(row.number).replace(/^#/, "")}`,
  note: row.note,
  date: row.dateLabel,
  amount: fmtMoney(row.amount),
  method: row.method,
  billNo: row.billNo,
});

const paySortField = (label: string) => {
  if (label === "Amount") return "total";
  if (label === "Payment #") return "payment_number";
  if (label === "Name" || label === "First Name" || label === "Last Name") return "vendor_name";
  return "date";
};

const sortFields = ["Name", "First Name", "Last Name", "Payment date", "Payment #", "Amount"];
const sortDirections = ["Ascending", "Descending"];
const statusList = ["All", "Trash"];
const paymentTypes = ["Stripe", "Paypal", "Venmo", "Cash", "Bank", "Custom", "UPI", "Google Pay", "Apple Pay", "Square"];
const dateRanges = ["All", "Today", "This Week", "Last Week", "This Month", "Last 30 Days", "Last Month", "Last 90 Days", "This Year", "Last Year", "Date Range"];

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

/* ── Bills chooser (opened from Edit Payment) ──────────────────── */
const BillsChooser: React.FC<{ onClose: () => void; onDone: () => void; vendor: string; billNo: string }> = ({ onClose, onDone, vendor, billNo }) => {
  const [picked, setPicked] = useState(true);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-xl my-10 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 420 }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Bills</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={onDone} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Done</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => setPicked((p) => !p)} className="w-full flex items-start gap-3 px-5 py-3 border-b border-gray-200 hover:bg-gray-50 text-left">
            <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${picked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{picked && <Check className="w-3.5 h-3.5 text-white" />}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{vendor}</div>
              <div className="text-xs text-gray-500 mt-0.5">{billNo}</div>
              <div className="text-xs text-gray-500 mt-0.5">Mollit fugiat elit</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500">Jun 17, 2026</span>
              <span className="text-sm font-semibold text-gray-900 mt-0.5">$0.00</span>
              <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500 text-white">Paid</span>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <span className={`w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${picked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{picked && <Check className="w-3.5 h-3.5 text-white" />}</span>
          <div className="flex-1 text-center">
            <div className="text-sm font-semibold text-gray-900">$0.00 <span className="text-gray-500 font-normal">Due</span></div>
            <div className="text-xs text-gray-500">{picked ? "1 Bill Selected" : "0 Bills Selected"}</div>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ── Edit Payment modal ────────────────────────────────────────── */
const EditModal: React.FC<{ onClose: () => void; p: Payment }> = ({ onClose, p }) => {
  const [attachment, setAttachment] = useState("");
  const [billsOpen, setBillsOpen] = useState(false);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Edit Payment</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={onClose} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs text-gray-500">Payment #</label><input defaultValue={p.number.replace("#", "")} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white" /></div>
          <div><label className="text-xs text-gray-500">Vendor *</label><input defaultValue={p.name} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Payment date *</label>
              <div className="mt-1"><AppDatePicker defaultValue="2026-06-21" className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white" /></div>
            </div>
            <div><label className="text-xs text-gray-500">Type *</label>
              <select defaultValue={p.method} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">{[p.method, ...paymentTypes.filter((t) => t !== p.method)].map((m) => <option key={m}>{m}</option>)}</select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Amount</label>
            <div className="flex items-center gap-2 mt-1">
              <button className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap">Full Payment</button>
              <input defaultValue="200" className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white text-right" />
            </div>
            <div className="text-xs text-gray-400 text-right mt-1">$0.00 Due</div>
          </div>
          <div><label className="text-xs text-gray-500">Notes</label><textarea rows={2} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white" /></div>
          <div><label className="text-xs text-gray-500">Internal Notes</label><textarea rows={2} placeholder="Internal Notes" className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white" /></div>
          <DocAttachmentField compact value={attachment} onChange={(path) => setAttachment(path)} />
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="text-sm font-medium text-gray-800">Bills</span>
            <button onClick={() => setBillsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Pencil className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      {billsOpen && <BillsChooser onClose={() => setBillsOpen(false)} onDone={() => setBillsOpen(false)} vendor={p.name} billNo={p.billNo} />}
    </Overlay>
  );
};

/* ── PAYMENT MADE preview (white document) ─────────────────────── */
const PreviewModal: React.FC<{ onClose: () => void; p: Payment }> = ({ onClose, p }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">Payment Made {p.number}</h3>
        <div className="flex items-center gap-1">
          {[Download, Printer, Mail].map((Ic, i) => (
            <button key={i} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Ic className="w-4 h-4" /></button>
          ))}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div style={{ background: "#fff", color: "#111" }} className="p-6">
        <h1 className="text-center text-2xl font-bold mb-4">PAYMENT MADE</h1>
        <div className="mb-4 text-sm">
          <div className="font-bold text-lg">info</div>
          <div className="text-gray-700">Bangladesh</div>
          <div className="text-gray-700">info@inovoic.com</div>
          <div className="font-bold mt-2">Payment To:</div>
          <div className="font-semibold">{p.name}</div>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>{["Payment #", "Payment date", "Amount", "Payment Type"].map((h) => <th key={h} className="border border-gray-300 px-3 py-2 text-left font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-3 py-2">{p.number.replace("#", "")}</td>
              <td className="border border-gray-300 px-3 py-2">{p.date}</td>
              <td className="border border-gray-300 px-3 py-2">{p.amount}</td>
              <td className="border border-gray-300 px-3 py-2">{p.method}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </Overlay>
);

/* ── Email modal ───────────────────────────────────────────────── */
const EmailModal: React.FC<{ onClose: () => void; p: Payment }> = ({ onClose, p }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-base font-medium text-gray-900">Payment Made {p.number} from info</h3>
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
        <input defaultValue={`Payment Made ${p.number} from info`} className="w-full border-b border-gray-200 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-200 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {p.name}</p>
          <p>Payment Made {p.number}<br />Amount: {p.amount} ({p.method})</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Payment Made {p.number}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

/* ── Component ──────────────────────────────────────────────────── */

export const PaymentMade: React.FC = () => {
  const queryClient = useQueryClient();
  const dbPayments = useCollection<any>("paymentsMade");
  const dbVendors = useCollection<any>("vendors", "name");
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as {
    selectedId?: number | string;
    openCreate?: boolean;
    vendorId?: string;
    vendorName?: string;
    billId?: string;
    billNumber?: string;
    dueAmount?: number;
  } | null) ?? null;
  const [createPrefill, setCreatePrefill] = useState<PaymentMadePrefill | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  useEffect(() => {
    if (navState?.openCreate) {
      setCreatePrefill({
        vendorId: navState.vendorId,
        vendorName: navState.vendorName,
        billId: navState.billId,
        billNumber: navState.billNumber,
        dueAmount: navState.dueAmount,
      });
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, location.pathname, navigate]);
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<string>(navSelectedId != null ? String(navSelectedId) : "");
  useEffect(() => { if (navSelectedId != null) setSelectedId(String(navSelectedId)); }, [navSelectedId]);
  const [sortBy, setSortBy] = useState("Payment date");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [vendorFilterLabels, setVendorFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | "preview" | "email" | "edit">(null);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [sortBy, sortDir, statusFilter, vendorFilter, dateFilter]);

  const paymentDateRange = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);
  const { data: listData } = useQuery({
    queryKey: ["vendor-payments-list", page, search, sortBy, sortDir, statusFilter, vendorFilter, dateFilter],
    queryFn: () => fetchVendorPayments({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(paySortField(sortBy), sortDir),
      isDeleted: statusFilter === "Trash" || undefined,
      vendor_id: partyFilterParam(vendorFilter),
      dateField: "date",
      ...paymentDateRange,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = listData?.pagination;
  const payments: Payment[] = useMemo(
    () => (listData?.rows ?? []).map(mapPaymentRow),
    [listData?.rows],
  );

  const filtered = payments;
  const selected = payments.find((i) => i.id === selectedId) || payments[0];
  const selectedDb: any =
    dbPayments.find((d) => String(d._id) === selected?.backendId || String(d.id) === selectedId) || {};

  useEffect(() => {
    if (payments.length > 0 && !payments.some((p) => p.id === selectedId)) {
      setSelectedId(payments[0].id);
    }
  }, [payments, selectedId]);

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const listTotal = filtered.reduce((s, i) => s + num(i.amount), 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const selectedTotal = payments.filter((i) => checked.has(i.id)).reduce((s, i) => s + num(i.amount), 0);
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.id))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const actionIcons: { icon: React.ElementType; title: string; onClick?: () => void }[] = [
    { icon: SlidersHorizontal, title: "Adjust" },
    { icon: Pencil, title: "Edit", onClick: () => setModal("edit") },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => setModal("preview") },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  const hasActiveFilters = statusFilter !== "All" || !!search.trim() || vendorFilter.length > 0 || dateFilter !== "All";
  if (!selected && !createOpen && !hasActiveFilters) return <ListEmptyState title="No payments made yet" onCreate={() => setCreateOpen(true)} createLabel="New Payment" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel
        onCreate={() => { setCreatePrefill(undefined); setCreateOpen(true); }}
        createTitle="Create Payment"
        hideCreate={selectMode}
      >
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              {[Trash2, MessageCircle, Mail, Eye, Check].map((Ic, i) => (
                <button key={i} onClick={Ic === Check ? exitSelect : Ic === Eye ? () => setModal("preview") : undefined} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Ic className="w-4 h-4" /></button>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Payment Made</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Payment Made")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>
                {(close) => (<><button onClick={() => { openListImport("payment-made"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("payment-made"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}
              </Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search payments..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
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
                  <button key={d} onClick={() => { setSortDir(d as "Ascending" | "Descending"); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === sortDir && <Check className="w-4 h-4 text-blue-600" />}</button>
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
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Payment date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>
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
              <button key={p.id} onClick={() => (selectMode ? toggleRow(p.id) : (setSelectedId(p.id), setCreateOpen(false)))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.number}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{p.note}</div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 min-w-0 max-w-[140px]">
                  <span className="text-xs text-gray-500 truncate">{p.date}</span>
                  <span className="text-sm font-semibold text-gray-900 mt-0.5">{p.amount}</span>
                  <span className="text-xs text-gray-500 mt-0.5 truncate w-full text-right">{p.method}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter
          total={money(listTotal)}
          countLabel={`${listPagination?.totalData ?? filtered.length} Payments`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {createOpen ? (
        <RecordPaymentMadeForm
          prefill={createPrefill}
          onClose={() => { setCreateOpen(false); setCreatePrefill(undefined); }}
          onSaved={(id) => {
            setSelectedId(String(id));
            setCreatePrefill(undefined);
            void queryClient.invalidateQueries({ queryKey: ["vendor-payments-list"] });
          }}
        />
      ) : selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} {checked.size === 1 ? "Payment" : "Payments"} Selected</h2>
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
              <h1 className="text-lg font-semibold text-gray-900 truncate min-w-0">{selected.name}</h1>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {actionIcons.map((a) => (
                  <button key={a.title} title={a.title} onClick={a.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><a.icon className="w-4 h-4" /></button>
                ))}
                <Dropdown align="right" panelClass="w-48" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <>
                      <button onClick={close} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-400" /></button>
                      <button onClick={close} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200"><Trash2 className="w-4 h-4" /> Trash</button>
                    </>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* meta row */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200">
              <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
              <div className="flex items-center gap-12">
                <div><div className="text-xs text-gray-500">Payment date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                <div><div className="text-xs text-gray-500">Payment Type</div><div className="text-sm font-semibold text-gray-900">{selected.method}</div></div>
              </div>
            </div>

            {/* Bills section */}
            <div className="border-b border-gray-200">
              <div className="px-5 py-2.5 bg-gray-50 text-sm font-semibold text-gray-900">Bills</div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-800">{selected.billNo}</span>
                <span className="text-sm font-semibold text-gray-900">{selected.amount}</span>
              </div>
            </div>

            {/* Notes | Internal Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-gray-200">
              <div className="px-5 py-3 border-r border-gray-200">
                <div className="text-sm font-semibold text-gray-900 mb-2">Notes</div>
                <div className="text-sm text-gray-600">No Notes</div>
              </div>
              <div className="px-5 py-3">
                <div className="text-sm font-semibold text-gray-900 mb-2">Internal Notes</div>
                <div className="text-sm text-gray-600">No Internal Notes</div>
              </div>
            </div>

            {/* Attachment */}
            <div className="px-5 py-4 max-w-md">
              <DocAttachmentField
                value={selectedDb?.Attachment || selectedDb?.attachments || ""}
                onChange={async (path) => {
                  const id = String(selected?.backendId || selectedDb?._id || "");
                  if (!selectedDb?.id && !id) {
                    showToast("Save the document first", "error");
                    throw new Error("missing id");
                  }
                  if (selectedDb?.id) {
                    await repo.update("paymentsMade", selectedDb.id, { Attachment: path, attachments: path });
                  }
                  showToast(path ? "Attachment saved" : "Attachment removed", "success");
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "edit" && <EditModal onClose={() => setModal(null)} p={selected} />}
      {modal === "preview" && (() => {
        const d: any = dbPayments.find((x) => String(x._id) === selectedId || String(x.id) === selectedId) || {};
        return <PdfPreviewModal docType="paymentMade" recordId={d.id} title="Payment Made " onClose={() => setModal(null)} />;
      })()}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} p={selected} />}
    </div>
  );
};

export default PaymentMade;
