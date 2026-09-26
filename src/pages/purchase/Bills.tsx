/**
 * File: src/pages/purchase/Bills.tsx
 * Bill — master/detail layout matching the reference design.
 * Left: list (search, sort, status/vendor/date filters, selection mode).
 * Right: detail (action icons incl. $ payment + ⋮ menu, status badge, meta
 *        with Bill date + Due, line items, terms/notes/attachment, totals
 *        with Amount Due, ribbon). FAB opens an inline Create Bill form with
 *        a vendor search + add-vendor modal.
 * Modals: Add Payment, Add Vendor, Preview / Email / Settings.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useState, useEffect } from "react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { dateRangeFor } from "@/lib/listDateRange";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useCollection, repo, nextNumber, money as fmtMoney, parseMoney, CreateDocForm, DocPreview , PdfPreviewModal} from "@/lib/db";
import { fetchBills, updateBill } from "@/services/billsApi";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { buildListSortParam } from "@/lib/listSort";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { ActivityLogModal } from "@/components/modals/ActivityLogModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { BillPaymentsModal, type BillPaymentDoc } from "@/components/modals/BillPaymentsModal";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { showToast } from "@/utils/toast";
import { api } from "@/lib/api/client";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  Settings,
  ChevronUp,
  SlidersHorizontal,
  Pencil,
  PenTool,
  DollarSign,
  Eye,
  Printer,
  Mail,
  MoreVertical,
  Download,
  X,
  Trash2,
  MessageCircle,
  Calendar,
  CircleChevronUp,
  CircleChevronDown,
  Barcode,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
type Status = "Draft" | "Sent" | "Paid" | "Partially Paid" | "Overdue";

interface Bill {
  id: number;
  backendId?: string;
  name: string;
  number: string;
  note: string;
  date: string;
  due: string;
  amount: string;
  status: Status;
}

const bills: Bill[] = [
  { id: 7, name: "Est lorem ut maxime", number: "#7", note: "hi, Mollit fugiat elit", date: "Jun 17, 2026", due: "Jun 17, 2026", amount: "$0.00", status: "Paid" },
  { id: 6, name: "bipul company", number: "#6", note: "hi, Mollit fugiat elit", date: "Jun 17, 2026", due: "Jun 17, 2026", amount: "$0.00", status: "Paid" },
  { id: 5, name: "SSE", number: "#5", note: "hi, Mollit fugiat elit", date: "Jun 16, 2026", due: "Jun 16, 2026", amount: "$0.00", status: "Draft" },
  { id: 4, name: "SSE", number: "#4", note: "Mollit fugiat elit", date: "Jun 16, 2026", due: "Jun 16, 2026", amount: "$0.00", status: "Draft" },
];

const sortFields = ["Name", "First Name", "Last Name", "Bill date", "Bill #", "Due Date", "Status", "Total"];
const sortDirections = ["Ascending", "Descending"];
const statusList: (Status | "All" | "Trash")[] = ["All", "Draft", "Sent", "Paid", "Partially Paid", "Overdue", "Trash"];
const duplicateAs = ["As Bill", "As Debit Note"];
const BILL_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const BILL_TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const nowLabel = () => "Today " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const dateRanges = ["All", "Today", "This Week", "Last Week", "This Month", "Last 30 Days", "Last Month", "Last 90 Days", "This Year", "Last Year", "Date Range"];

const STATUS_BADGE: Record<Status, string> = {
  Draft: "bg-gray-600 text-white",
  Sent: "bg-gray-900 text-white",
  Paid: "bg-green-500 text-white",
  "Partially Paid": "bg-orange-500 text-white",
  Overdue: "bg-red-500 text-white",
};

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
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

/* ── Floating-label field ──────────────────────────────────────── */
const fieldCls = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
const FloatField: React.FC<{ label: string; value?: string; placeholder?: string; icon?: React.ReactNode }> = ({ label, value, placeholder, icon }) => (
  <div className="relative fl-wrap">
    {label && <label className="fl-label">{label}</label>}
    <div className="relative">
      <input defaultValue={value} placeholder={placeholder && placeholder !== label ? placeholder : " "} className={fieldCls} />
      {icon && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
    </div>
  </div>
);

/* ── Add Vendor modal (from Create Bill vendor box pencil) ─────── */
const AddVendorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [same, setSame] = useState(false);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-4xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Add Vendor</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={onClose} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-6">
              <FloatField label="Company Name" placeholder="Company Name" />
              <FloatField label="Reg. No" placeholder="Reg. No" />
              <div className="relative fl-wrap">
                <label className="fl-label">Tax ID</label>
                <div className="relative">
                  <input placeholder=" " className={fieldCls} />
                  <button className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Fetch Details</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4"><FloatField label="Business Phone" placeholder="Business Phone" /><FloatField label="Fax" placeholder="Fax" /></div>
            </div>
            <div className="space-y-6">
              <FloatField label="First Name" placeholder="First Name" />
              <FloatField label="Last Name" placeholder="Last Name" />
              <FloatField label="Email" placeholder="Email" />
              <div className="grid grid-cols-2 gap-4"><FloatField label="Mobile" placeholder="Mobile" /><FloatField label="Home Phone" placeholder="Home Phone" /></div>
              <div className="grid grid-cols-2 gap-4"><FloatField label="Birthday" placeholder="Birthday" icon={<Calendar className="w-4 h-4" />} /><FloatField label="Anniversary" placeholder="Anniversary" icon={<Calendar className="w-4 h-4" />} /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">Address</span><span className="text-xs text-gray-400">Billing</span></div>
            <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={same} onChange={() => setSame((v) => !v)} className="accent-blue-600" /> Same as Billing</label><span className="text-xs text-gray-400">Shipping</span></div>
            <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><FloatField label="" placeholder="Street 1" /><FloatField label="" placeholder="Street 2" /></div><div className="grid grid-cols-4 gap-2"><FloatField label="" placeholder="Zip" /><FloatField label="" placeholder="City" /><FloatField label="" placeholder="State" /><FloatField label="" placeholder="Country" /></div></div>
            <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><FloatField label="" placeholder="Street 1" /><FloatField label="" placeholder="Street 2" /></div><div className="grid grid-cols-4 gap-2"><FloatField label="" placeholder="Zip" /><FloatField label="" placeholder="City" /><FloatField label="" placeholder="State" /><FloatField label="" placeholder="Country" /></div></div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
            <div className="border border-gray-300 rounded-md overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
                {[Bold, Italic, Underline].map((Ic, i) => <button key={i} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"><Ic className="w-4 h-4" /></button>)}
                <span className="w-px h-5 bg-gray-300 mx-1" />
                <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200"><span className="w-4 h-4 rounded bg-gray-900 border border-gray-300" /></button>
                <select className="ml-1 text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"><option>10</option><option>14</option><option>18</option></select>
              </div>
              <textarea placeholder="Bank Details" className="w-full h-24 p-3 text-sm text-gray-800 outline-none resize-none" />
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ── BILL preview (white document) ─────────────────────────────── */
const PreviewModal: React.FC<{ onClose: () => void; bill: Bill }> = ({ onClose, bill }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">Bill {bill.number}</h3>
        <div className="flex items-center gap-1">
          {[Download, Printer, Mail].map((Ic, i) => (
            <button key={i} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Ic className="w-4 h-4" /></button>
          ))}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div style={{ background: "#fff", color: "#111" }} className="p-6">
        <div className="text-right text-sm italic text-gray-500">(Original)</div>
        <div className="border border-gray-300">
          <h1 className="text-center text-2xl font-bold py-3 border-b border-gray-300">BILL</h1>
          <div className="flex justify-between gap-6 p-4">
            <div>
              <div className="font-bold text-lg">info</div>
              <div className="text-sm text-gray-700">Bangladesh</div>
              <div className="text-sm text-gray-700">info@inovoic.com</div>
              <div className="font-bold text-sm mt-2">Vendor:</div>
              <div className="text-sm font-semibold">{bill.name}</div>
            </div>
            <table className="text-sm border-collapse">
              <tbody>
                {[["Bill #", bill.number.replace("#", "")], ["Bill date", bill.date], ["Due Date", bill.due], ["Amount Due", bill.amount]].map(([k, v]) => (
                  <tr key={k}><td className="border border-gray-300 px-3 py-1.5 font-semibold text-right">{k}</td><td className="border border-gray-300 px-3 py-1.5">{v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <table className="w-full text-xs border-t border-gray-300">
            <thead>
              <tr>{["Sr. No.", "Items", "Quantity", "Rate", "Tax", "Amount"].map((h) => <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-bold">{h}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} className="border border-gray-300 px-2 py-6 text-center text-gray-400">No items</td></tr>
            </tbody>
          </table>
          <div className="flex justify-end px-4 py-3 text-sm">
            <table className="text-right">
              <tbody>
                <tr><td className="px-3 py-1 font-bold">Sub Total</td><td className="px-3 py-1">$0.00</td></tr>
                <tr><td className="px-3 py-1 font-bold">Total</td><td className="px-3 py-1">$0.00</td></tr>
                <tr className="border-t border-gray-300"><td className="px-3 py-1 font-bold">Amount Due</td><td className="px-3 py-1 font-bold">{bill.amount}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-300 text-sm">
            <div className="font-bold">Terms &amp; Conditions</div>
            <div className="text-gray-700">Perferendis ad vero</div>
          </div>
        </div>
      </div>
    </div>
  </Overlay>
);

/* ── Email modal ───────────────────────────────────────────────── */
const EmailModal: React.FC<{ onClose: () => void; bill: Bill }> = ({ onClose, bill }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-base font-medium text-gray-900">Bill {bill.number} from info</h3>
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
        <input defaultValue={`Bill ${bill.number} from info`} className="w-full border-b border-gray-200 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-200 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {bill.name}</p>
          <p>Bill {bill.number}<br />Total Amount: {bill.amount}</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Bill {bill.number}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

/* ── Component ──────────────────────────────────────────────────── */
export const Bills: React.FC = () => {
  const queryClient = useQueryClient();
  const dbBills = useCollection<any>("bills");
  const dbVendors = useCollection<any>("vendors", "name");

  // Opened from an activity link / Header (+) → pre-select or open create.
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number | string; openCreate?: boolean } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<number | string>(navSelectedId ?? 7);
  useEffect(() => { if (navSelectedId != null) setSelectedId(navSelectedId); }, [navSelectedId]);
  const [sortBy, setSortBy] = useState("Bill date");
  const [sortDir, setSortDir] = useState("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [vendorFilterLabels, setVendorFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "pdfSettings" | "payment">(null);
  const [createMode, setCreateMode] = useState(!!navState?.openCreate);
  useEffect(() => {
    if (navState?.openCreate) {
      setCreateMode(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, location.pathname, navigate]);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [dupOpen, setDupOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => { setPage(1); }, [search, sortBy, sortDir, statusFilter, vendorFilter, dateFilter]);

  const billDateRange = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);
  const { data: backendBills } = useQuery({
    queryKey: ["bills-backend-list", page, search, sortBy, sortDir, statusFilter, vendorFilter, dateFilter],
    queryFn: () => fetchBills({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(sortBy === "Total" ? "total" : sortBy === "Status" ? "status" : "date", sortDir === "Ascending" ? "Ascending" : "Descending"),
      status: statusFilter === "Trash" ? undefined : statusFilter,
      isDeleted: statusFilter === "Trash" || undefined,
      vendor_id: partyFilterParam(vendorFilter),
      dateField: "date",
      ...billDateRange,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = backendBills?.pagination;

  const bills: Bill[] = useMemo(() => {
    const rows = backendBills?.rows ?? [];
    return rows.map((row, index) => {
      const linked = dbBills.find((b) => String(b._id) === row._id) || dbBills.find((b) => String(b.number).replace(/^#/, "") === row.number);
      return {
        id: linked?.id ?? (index + 1),
        backendId: row._id,
        name: row.vendorName,
        number: row.number.startsWith("#") ? row.number : `#${row.number}`,
        note: linked?.notes || "—",
        date: row.dateLabel,
        due: linked?.due || row.dateLabel,
        amount: fmtMoney(row.amount),
        status: row.status as Bill["status"],
      };
    });
  }, [backendBills?.rows, dbBills]);

  const filtered = useMemo(() => {
    const toNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
    let list = bills.filter(
      (i) =>
        (statusFilter === "All" || i.status === statusFilter) &&
        (search.trim() === "" || i.name.toLowerCase().includes(search.toLowerCase()) || i.number.includes(search)),
    );
    list = [...list].sort((a, b) => {
      let r = 0;
      if (sortBy === "Total") r = toNum(a.amount) - toNum(b.amount);
      else if (sortBy === "Bill #") r = a.id - b.id;
      else if (sortBy === "Status") r = a.status.localeCompare(b.status);
      else if (sortBy === "Name" || sortBy === "First Name" || sortBy === "Last Name") r = a.name.localeCompare(b.name);
      else r = a.id - b.id; // Bill date / Due Date
      return sortDir === "Ascending" ? r : -r;
    });
    return list;
  }, [bills, sortBy, sortDir, statusFilter, search]);

  const selected =
    bills.find((i) => i.id === selectedId || i.backendId === selectedId) || bills[0];
  const selectedDb: any =
    dbBills.find((d) => String(d._id) === String(selected?.backendId || selectedId)) ||
    dbBills.find((d) => d.id === (selected?.id ?? selectedId)) ||
    {};
  const selectedVendor: any = dbVendors.find((v) => v.id === selectedDb.vendorId) || {};

  /* Append an event to the bill's activity log. */
  const logActivity = async (kind: string, text: string) => {
    const rec = dbBills.find((d) => d.id === selectedDb.id);
    await repo.update("bills", selectedDb.id, { activity: [...(rec?.activity || []), { kind, text, ts: Date.now(), dateLabel: nowLabel() }] });
  };
  const { data: paymentMethodOptions = [] } = useQuery({
    queryKey: ["payment-methods-options"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  /** $ Add Payment — same split-pane modal as Invoice → Payment Received. */
  const selectedBills = filtered.filter((i) => checked.has(i.id));
  const batchPaymentBills = useMemo((): BillPaymentDoc[] | undefined => {
    if (!selectMode || selectedBills.length === 0) return undefined;
    const rows = backendBills?.rows ?? [];
    const docs = selectedBills
      .filter((bill) => bill.backendId)
      .map((bill) => {
        const row = rows.find((r) => r._id === bill.backendId);
        const linkedDb =
          dbBills.find((d) => String(d._id) === bill.backendId) ||
          dbBills.find((d) => String(d.number).replace(/^#/, "") === bill.number.replace(/^#/, ""));
        return {
          _id: String(bill.backendId),
          bill_number: bill.number.replace(/^#/, ""),
          currency: row?.currency || linkedDb?.currency || "USD",
          total: row?.amount ?? linkedDb?.total ?? (parseFloat(bill.amount.replace(/[^0-9.]/g, "")) || 0),
          balance_amount:
            row?.dueAmount ??
            linkedDb?.amountDue ??
            row?.amount ??
            (parseFloat(bill.amount.replace(/[^0-9.]/g, "")) || 0),
          paid_amount: row?.paidAmount ?? linkedDb?.amountPaid ?? 0,
          vendor_id: row?.vendorId ? { _id: row.vendorId, name: row.vendorName || bill.name } : undefined,
          vendor_name: bill.name || row?.vendorName || "",
          payment_method: [],
        } satisfies BillPaymentDoc;
      });
    return docs.length > 0 ? docs : undefined;
  }, [selectMode, selectedBills, backendBills?.rows, dbBills]);
  const openBillPayment = () => {
    if (selectMode) {
      if (checked.size === 0) {
        showToast("Select bills to add payment", "warning");
        return;
      }
      const withBackend = selectedBills.filter((bill) => bill.backendId);
      if (withBackend.length === 0) {
        showToast("Selected bills are not synced to the server", "warning");
        return;
      }
      const rows = backendBills?.rows ?? [];
      const vendorIds = withBackend
        .map((bill) => rows.find((r) => r._id === bill.backendId)?.vendorId)
        .filter(Boolean) as string[];
      if (vendorIds.length !== withBackend.length) {
        showToast("Some selected bills have no linked vendor", "warning");
        return;
      }
      if (new Set(vendorIds).size > 1) {
        showToast("Selected bills must belong to the same vendor", "warning");
        return;
      }
    }
    setModal("payment");
  };
  const selectedBillRow = (backendBills?.rows ?? []).find((r) => {
    const linked = dbBills.find((b) => String(b._id) === r._id);
    return linked?.id === selectedId || r.number.replace(/^#/, "") === selected?.number?.replace(/^#/, "") || r._id === selected?.backendId;
  });
  /** Create a debit note from this bill (⋮ Debit Note / Duplicate ▸ As Debit Note). */
  const createDebitNote = async () => {
    const n = await nextNumber("debitNotes");
    const id = await repo.add("debitNotes", {
      number: "#" + n, vendorId: selectedDb.vendorId, date: selectedDb.date, due: selectedDb.due, ts: Date.now(),
      status: "Unused", items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0, tax: selectedDb.tax || 0,
      total: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    });
    await logActivity("status", `Debit note created from Bill ${selectedDb.number}.`);
    showToast("Debit note created", "success");
    navigate("/purchase/debit-notes", { state: { selectedId: id } });
  };
  const duplicateBillAs = async (label: string) => {
    if (label === "As Debit Note") { await createDebitNote(); return; }
    const n = await nextNumber("bills");
    const id = await repo.add("bills", {
      number: "#" + n, vendorId: selectedDb.vendorId, date: selectedDb.date, due: selectedDb.due, ts: Date.now(),
      status: "Draft", items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0, tax: selectedDb.tax || 0,
      total: selectedDb.total || 0, amountPaid: 0, amountDue: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    });
    setSelectedId(id);
    showToast("Bill duplicated", "success");
  };
  const trashCurrent = async () => {
    await repo.remove("bills", selectedDb.id);
    showToast(`Bill ${selectedDb.number} moved to trash`, "success");
    setSelectedId(bills.find((b) => b.id !== selectedDb.id)?.id ?? 0);
    setConfirmAction(null);
  };
  const trashSelectedBills = async () => {
    const ids = [...checked];
    await repo.removeMany("bills", ids);
    showToast(`${ids.length} ${ids.length === 1 ? "bill" : "bills"} moved to trash`, "success");
    if (ids.includes(Number(selectedId))) setSelectedId(bills.find((b) => !ids.includes(b.id))?.id ?? 0);
    setConfirmAction(null);
    exitSelect();
  };
  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedDb?._id || selected?.backendId;
    let signaturePath = data.image;
    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `bill-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        signaturePath =
          uploadRes.data?.data?.file_path ||
          uploadRes.data?.data?.path ||
          uploadRes.data?.data?.[0]?.path ||
          data.image;
        await updateBill(String(backendId), { signature: signaturePath });
      }
      if (selectedDb?.id) {
        await repo.update("bills", selectedDb.id, {
          signature: signaturePath,
          signatureName: data.name,
          signatureTitle: data.title,
          signatureDate: data.date,
        });
      }
      await logActivity("status", `Vendor signature added to Bill ${selectedDb.number}.`);
      showToast("Signature saved", "success");
    } catch {
      showToast("Could not save signature", "error");
    }
  };

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const listTotal = filtered.reduce((s, i) => s + num(i.amount), 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const selectedTotal = bills.filter((i) => checked.has(i.id)).reduce((s, i) => s + num(i.amount), 0);
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
    { icon: DollarSign, title: "Add Payment", onClick: openBillPayment },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => { logActivity("printed", `Bill ${selectedDb.number} printed.`); setModal("preview"); } },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  const hasActiveFilters = statusFilter !== "All" || !!search.trim() || vendorFilter.length > 0 || dateFilter !== "All";
  if (!selected && !createMode && !hasActiveFilters) return <ListEmptyState title="No bills yet" onCreate={() => setCreateMode(true)} createLabel="New Bill" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setCreateMode(true)} createTitle="Create Bill" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              <button title="Delete" onClick={() => (checked.size === 0 ? showToast("Select bills to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="Add Payment" onClick={openBillPayment} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><DollarSign className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp…", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Bills</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Bills")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("bills"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("bills"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bills..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        {/* toolbar */}
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-200">
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
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Bill date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => dateRanges.map((d) => (
              <button key={d} onClick={() => { setDateFilter(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
          {filtered.map((p) => {
            const active = !selectMode && !createMode && p.id === selectedId;
            const isChecked = checked.has(p.id);
            return (
              <button key={p.id} onClick={() => (selectMode ? toggleRow(p.id) : (setSelectedId(p.id), setCreateMode(false)))}
                className={`w-full text-left px-4 py-3 border-b border-gray-200 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
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
                  <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter
          total={<>{money(listTotal)} <span className="font-normal text-slate-500">Due</span></>}
          countLabel={`${listPagination?.totalData ?? filtered.length} Bills`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} {checked.size === 1 ? "Bill" : "Bills"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(selectedTotal)}</span>
            </div>
          </div>
        </section>
      ) : createMode ? (
        <CreateDocForm collection="bills" title="Create Bill" party="vendors" buy amountDue onClose={() => setCreateMode(false)} onSaved={(id) => setSelectedId(id)} />
      ) : editRecord ? (
        <CreateDocForm collection="bills" title="Edit Bill" party="vendors" buy amountDue record={editRecord} onClose={() => setEditRecord(null)} onSaved={(id) => { setEditRecord(null); setSelectedId(id); }} />
      ) : (
        <section className="module-detail-panel custom-scrollbar">
          <div className="relative flex-1 overflow-hidden flex flex-col">
            {/* header */}
            <div className="module-title-bar">
              <DocPartyHeader
                party="vendor"
                partyId={selectedBillRow?.vendorId || partyIdFromRef(selectedVendor._id)}
                title={selected.name}
                subtitle={selectedVendor.contact || selectedVendor.email || ""}
                titleClassName="text-lg font-semibold text-gray-900 truncate"
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {actionIcons.map((a) => (
                  <button key={a.title} title={a.title} onClick={a.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><a.icon className="w-4 h-4" /></button>
                ))}
                {/* ⋮ menu (reference: WhatsApp / Duplicate ▸ / Debit Note / Signature Request / Activity Log / Trash) */}
                <Dropdown align="right" panelClass="min-w-[200px]" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <div className="py-1">
                      <button type="button" onClick={() => { showToast("Opening WhatsApp…", "info"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
                      <MoreMenuFlyoutRow label="Duplicate">
                        {duplicateAs.map((st) => (
                          <button key={st} type="button" onClick={() => { duplicateBillAs(st); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{st}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={() => { createDebitNote(); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Debit Note</button>
                      <button type="button" onClick={() => { setSigRequestOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Signature Request</button>
                      <button type="button" onClick={() => { setActivityOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Activity Log</button>
                      <button type="button" onClick={() => { setConfirmAction("trashOne"); close(); }} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200">Trash</button>
                    </div>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* meta row — #, Bill date, Due, status badge (chevron toggle) */}
            {expanded && (
            <div className="module-title-bar">
              <div className="flex items-center gap-12">
                <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
                <div><div className="text-xs text-gray-500">Bill date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                <div><div className="text-xs text-gray-500">Due</div><div className="text-sm font-semibold text-gray-900">{selected.due}</div></div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
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
                      <td className="px-2 py-3 text-gray-800">{BILL_TAX_NAME[it.taxId || 1]}</td>
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
                <div>
                  <DocAttachmentField
                    compact
                    value={selectedDb?.Attachment || selectedDb?.attachments || ""}
                    onChange={async (path) => {
                      const id = String(selected?.backendId || selectedDb?._id || "");
                      if (!id && !selectedDb?.id) {
                        showToast("Save the document first", "error");
                        throw new Error("missing id");
                      }
                      if (id) {
                        await updateBill(id, { Attachment: path, attachments: path });
                        await queryClient.invalidateQueries({ queryKey: ["bills-backend-list"] });
                      }
                      if (selectedDb?.id) {
                        await repo.update("bills", selectedDb.id, { Attachment: path, attachments: path });
                      }
                      showToast(path ? "Attachment saved" : "Attachment removed", "success");
                    }}
                  />
                </div>
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
                    <span>{BILL_TAX_NAME[Number(taxId)]} {BILL_TAX_RATE[Number(taxId)]}% on {fmtMoney(base as number)}</span>
                    <span>{fmtMoney(((base as number) * (BILL_TAX_RATE[Number(taxId)] || 0)) / 100)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-200"><span className="text-gray-700">Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedDb.total)}</span></div>
                {(selectedDb.amountPaid || 0) > 0 && (
                  <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Amount Paid</span><span>{fmtMoney(selectedDb.amountPaid)}</span></div>
                )}
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Amount Due</span><span className="font-semibold text-gray-900">{fmtMoney(selectedDb.amountDue)}</span></div>
              </div>
            </div>

            {/* saved signature (shows after Add Signature) */}
            <SignatureBlock record={selectedDb} label="Vendor Signature" />

            {/* status corner ribbon */}
            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 text-[10px] font-semibold py-1 text-center ${STATUS_BADGE[selected.status]}`}>{selected.status}</div>
            </div>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "payment" && (
        <BillPaymentsModal
          open
          bills={batchPaymentBills}
          bill={
            batchPaymentBills?.[0] ?? {
              _id: String(selectedBillRow?._id || selected?.backendId || selectedDb._id || ""),
              bill_number: (selectedBillRow?.number || selected?.number || selectedDb.number || "").replace(/^#/, ""),
              currency: selectedBillRow?.currency || selectedDb.currency || "USD",
              total: selectedBillRow?.amount ?? selectedDb.total ?? 0,
              balance_amount: selectedBillRow?.dueAmount ?? selectedDb.amountDue ?? 0,
              paid_amount: selectedBillRow?.paidAmount ?? selectedDb.amountPaid ?? 0,
              vendor_id: selectedBillRow?.vendorId
                ? { _id: selectedBillRow.vendorId, name: selectedBillRow.vendorName || selected?.name }
                : selectedVendor._id
                  ? { _id: String(selectedVendor._id), name: selectedVendor.contact || selectedVendor.name }
                  : undefined,
              vendor_name: selected?.name || selectedBillRow?.vendorName || "",
              payment_method: [],
            }
          }
          paymentMethods={paymentMethodOptions}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      {modal === "settings" && <AppSettingsModal initialTab="Bill" onClose={() => setModal(null)} />}
      {modal === "preview" && (() => { const d: any = dbBills.find((x) => x.id === selectedId) || {}; const pp: any = dbVendors.find((x) => x.id === d.vendorId) || {}; const pn = pp.name || "—"; return <PdfPreviewModal docType="bill" recordId={d.id} title={`Bill `} onClose={() => setModal(null)} />; })()}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} bill={selected} />}
      {modal === "pdfSettings" && (
        <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="bill" />
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
          docLabel="Bill"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedVendor}
          documentId={String(selectedBillRow?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="bill"
          emailNav="bill"
          pdfDocType="bill"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{ updatedAt: new Date().toISOString() }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void logActivity("sent", `Signature request for Bill ${selectedDb.number} sent.`);
            void queryClient.invalidateQueries({ queryKey: ["bills-backend-list"] });
          }}
        />
      )}
      {activityOpen && <ActivityLogModal docLabel="Bill" record={selectedDb} onClose={() => setActivityOpen(false)} />}
      {confirmAction === "trashOne" && (
        <ConfirmAlert message="Are you sure want to trash this bill?" onNo={() => setConfirmAction(null)} onYes={trashCurrent} />
      )}
      {confirmAction === "trashSelected" && (
        <ConfirmAlert message="Are you sure want to delete these bills?" onNo={() => setConfirmAction(null)} onYes={trashSelectedBills} />
      )}
    </div>
  );
};

export default Bills;
