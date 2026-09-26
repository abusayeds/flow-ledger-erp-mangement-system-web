/**
 * File: src/pages/purchase/PurchaseReturns.tsx
 * Purchase Return — master/detail layout following our established flow
 * (vendor-side return document; goods sent back against a Bill / Purchase Order).
 * Left: list (search, sort, status/vendor/date filters, selection mode).
 * Right: detail (action icons + ⋮ menu, status badge, meta with Return date
 *        + Invoice # reference, line items header, Reason for Return,
 *        notes/attachment, Sub Total + Total, status ribbon). FAB opens an
 *        inline Create Purchase Return form with a vendor search + add-vendor.
 * Modals: Add Vendor, Preview (PURCHASE RETURN) / Email / Settings / Activity.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { dateRangeFor } from "@/lib/listDateRange";
import { useQuery } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { buildListSortParam } from "@/lib/listSort";
import { fetchPurchaseReturns, type PurchaseReturnListRow } from "@/services/purchaseReturnsApi";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { useCollection, repo, money as fmtMoney, CreateDocModal, DocPreview } from "@/lib/db";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
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
  Eye,
  Printer,
  Mail,
  MoreVertical,
  Download,
  X,
  Trash2,
  MessageCircle,
  Copy,
  Signature,
  History,
  Calendar,
  Barcode,
  Bold,
  Italic,
  Underline,
  CornerUpLeft,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
type Status = "Draft" | "Open" | "Returned" | "Cancelled";

interface Return {
  id: string;
  backendId: string;
  name: string;
  vendorId: string;
  number: string;
  invoice: string;
  note: string;
  reason: string;
  date: string;
  amount: string;
  status: Status;
}

const normalizeReturnStatus = (raw?: string): Status => {
  const s = (raw || "draft").toLowerCase();
  if (s === "draft") return "Draft";
  if (s === "open") return "Open";
  if (s === "returned") return "Returned";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  const t = (raw || "Draft").trim();
  return (t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()) as Status;
};

const mapReturnRow = (row: PurchaseReturnListRow): Return => ({
  id: row._id,
  backendId: row._id,
  name: row.vendorName,
  vendorId: row.vendorId || "",
  number: row.number.startsWith("#") ? row.number : `#${String(row.number).replace(/^#/, "")}`,
  invoice: row.invoice,
  note: row.note,
  reason: row.reason,
  date: row.dateLabel,
  amount: fmtMoney(row.amount),
  status: normalizeReturnStatus(row.status),
});

const prSortField = (label: string) => {
  if (label === "Total") return "total";
  if (label === "Return #") return "return_number";
  if (label === "Status") return "status";
  if (label === "Name" || label === "First Name" || label === "Last Name") return "vendor_name";
  return "date";
};

const apiStatusFilter = (filter: string): string | undefined => {
  if (!filter || filter === "All" || filter === "Trash") return undefined;
  return filter.toLowerCase();
};

const sortFields = ["Name", "First Name", "Last Name", "Return date", "Return #", "Status", "Total"];
const sortDirections = ["Ascending", "Descending"];
const statusList: (Status | "All" | "Trash")[] = ["All", "Draft", "Open", "Returned", "Cancelled", "Trash"];
const markAsList: Status[] = ["Draft", "Open", "Returned", "Cancelled"];
const duplicateAs = ["As Purchase Return"];
const invoiceRefs = ["#16", "#14", "#9", "#5"];
const dateRanges = ["All", "Today", "This Week", "Last Week", "This Month", "Last 30 Days", "Last Month", "Last 90 Days", "This Year", "Last Year", "Date Range"];

const STATUS_BADGE: Record<Status, string> = {
  Draft: "bg-gray-600 text-white",
  Open: "bg-blue-500 text-white",
  Returned: "bg-green-500 text-white",
  Cancelled: "bg-red-500 text-white",
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

/* ── Add Vendor modal ──────────────────────────────────────────── */
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
              </div>
              <textarea placeholder="Bank Details" className="w-full h-24 p-3 text-sm text-gray-800 outline-none resize-none" />
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ── Activity Log modal ────────────────────────────────────────── */
const ActivityModal: React.FC<{ onClose: () => void; ret: Return }> = ({ onClose, ret }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-lg my-16 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Activity Log</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-5 space-y-4">
        {[
          `New Purchase Return ${ret.number} created`,
          `Purchase Return ${ret.number} linked to invoice ${ret.invoice}`,
          ret.status === "Returned" ? `Purchase Return ${ret.number} marked as Returned` : `Purchase Return ${ret.number} is ${ret.status}`,
        ].map((t, i) => (
          <div key={i} className="flex gap-3">
            <span className="mt-1 w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
            <div><div className="text-sm text-gray-800">{t}</div><div className="text-xs text-gray-400 mt-0.5">{ret.date}</div></div>
          </div>
        ))}
      </div>
    </div>
  </Overlay>
);

/* ── PURCHASE RETURN preview (white document) ──────────────────── */
const PreviewModal: React.FC<{ onClose: () => void; ret: Return }> = ({ onClose, ret }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">Purchase Return {ret.number}</h3>
        <div className="flex items-center gap-1">
          {[Download, Printer, Mail].map((Ic, i) => (
            <button key={i} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Ic className="w-4 h-4" /></button>
          ))}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div style={{ background: "#fff", color: "#111" }} className="p-6">
        <div className="text-right text-sm italic text-gray-500">(Original)</div>
        <div className="relative border border-gray-300 overflow-hidden">
          {/* status corner ribbon */}
          <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
            <div className={`absolute top-[18px] -left-[34px] w-32 -rotate-45 text-[10px] font-semibold py-1 text-center ${STATUS_BADGE[ret.status]}`}>{ret.status}</div>
          </div>
          <h1 className="text-center text-2xl font-bold py-3 border-b border-gray-300">PURCHASE RETURN</h1>
          <div className="flex justify-between gap-6 p-4">
            <div>
              <div className="font-bold text-lg">info</div>
              <div className="text-sm text-gray-700">Bangladesh</div>
              <div className="text-sm text-gray-700">info@inovoic.com</div>
              <div className="font-bold text-sm mt-2">Vendor:</div>
              <div className="text-sm font-semibold">{ret.name}</div>
            </div>
            <table className="text-sm border-collapse">
              <tbody>
                {[["Return #", ret.number.replace("#", "")], ["Return date", ret.date], ["Invoice #", ret.invoice], ["Total", ret.amount]].map(([k, v]) => (
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
                <tr><td className="px-3 py-1 font-bold">Sub Total</td><td className="px-3 py-1">{ret.amount}</td></tr>
                <tr className="border-t border-gray-300"><td className="px-3 py-1 font-bold">Total</td><td className="px-3 py-1 font-bold">{ret.amount}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-300 text-sm">
            <div className="font-bold">Reason for Return</div>
            <div className="text-gray-700">{ret.reason || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  </Overlay>
);

/* ── Email modal ───────────────────────────────────────────────── */
const EmailModal: React.FC<{ onClose: () => void; ret: Return }> = ({ onClose, ret }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-base font-medium text-gray-900">Purchase Return {ret.number} from info</h3>
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
        <input defaultValue={`Purchase Return ${ret.number} from info`} className="w-full border-b border-gray-200 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-200 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {ret.name}</p>
          <p>Purchase Return {ret.number}<br />Total Amount: {ret.amount}</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Purchase Return {ret.number}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

/* ── Create Purchase Return (inline form, replaces detail) ─────── */
const CreateReturn: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const dbVendors = useCollection<any>("vendors", "name");
  const vendorList = useMemo(() => dbVendors.map((v: { name: string }) => v.name), [dbVendors]);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [addVendor, setAddVendor] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const vref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (vref.current && !vref.current.contains(e.target as Node)) setVendorOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const matches = vendorList.filter((v) => v.toLowerCase().includes(vendorQuery.toLowerCase()));
  const rows = [{ no: 1, name: "", desc: "Description" }, { no: 2, name: "Service", desc: "Description" }];
  const [attachment, setAttachment] = useState("");

  return (
    <section className="module-detail-panel custom-scrollbar">
      <div className="module-title-bar sticky top-0 z-20">
        <h1 className="text-lg font-semibold text-gray-900">Create Purchase Return</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} title="Settings" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Barcode className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={onClose} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Save</button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2 relative fl-wrap" ref={vref}>
            <label className="fl-label">Vendor *</label>
            <div className="relative">
              <input value={vendorQuery} onChange={(e) => { setVendorQuery(e.target.value); setVendorOpen(true); }} onFocus={() => setVendorOpen(true)} placeholder=" " className={fieldCls} />
              <button onClick={() => setAddVendor(true)} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
            </div>
            {vendorOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-60 overflow-y-auto custom-scrollbar">
                {matches.map((v) => (
                  <button key={v} onClick={() => { setVendorQuery(v); setVendorOpen(false); }} className="w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">{v}</button>
                ))}
                {matches.length === 0 && <div className="px-3 py-2.5 text-sm text-gray-400">No vendor found</div>}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Invoice #</label>
            <select className="w-full mt-0.5 px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900">{invoiceRefs.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <FloatField label="Return #" value="5" />
          <FloatField label="Currency" value="$ USD" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <FloatField label="Return date *" value="6/21/2026" icon={<Calendar className="w-4 h-4" />} />
          <div>
            <label className="text-[11px] text-gray-500">Address</label>
            <button className="w-full mt-0.5 flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-500"><span /> <ChevronDown className="w-4 h-4" /></button>
          </div>
          <FloatField label="" placeholder="Sub Title" />
          <div className="md:col-span-2"><FloatField label="" placeholder="Reason for Return" /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" /> Discount before tax</label>
        </div>

        <div className="border border-gray-200 rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left font-semibold px-4 py-2.5">Sr. No.</th>
                <th className="text-left font-semibold px-2 py-2.5">Items</th>
                <th className="text-right font-semibold px-2 py-2.5">Quantity</th>
                <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                <th className="text-left font-semibold px-2 py-2.5">Tax</th>
                <th className="text-right font-semibold px-2 py-2.5">Discount</th>
                <th className="text-right font-semibold px-4 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.no} className="border-t border-gray-200 align-top">
                  <td className="px-4 py-3 text-gray-700">{r.no}</td>
                  <td className="px-2 py-3"><input placeholder={r.name || "Item"} className="w-full bg-transparent text-sm outline-none font-medium text-gray-900" /><input placeholder={r.desc} className="w-full bg-transparent text-xs outline-none text-gray-500 mt-1" /></td>
                  <td className="px-2 py-3 text-right"><input defaultValue="1" className="w-12 bg-transparent text-sm text-right outline-none" /></td>
                  <td className="px-2 py-3 text-right"><input placeholder="Rate" className="w-16 bg-transparent text-sm text-right outline-none" /></td>
                  <td className="px-2 py-3"><span className="inline-flex items-center gap-1 text-sm text-gray-600">new test tax , Te… <ChevronDown className="w-3.5 h-3.5" /></span></td>
                  <td className="px-2 py-3 text-right"><span className="inline-flex items-center gap-1 text-sm text-gray-400">Discount <span className="px-1 bg-gray-100 rounded text-gray-500">%</span></span></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">$0.00</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Product</button>
              <button className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Service</button>
            </div>
            <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Settings className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-4">
            <div><label className="text-xs text-gray-500">Reason for Return</label><textarea placeholder="Reason for Return" className="mt-1 w-full h-20 border border-gray-200 rounded-md p-3 text-sm text-gray-700 outline-none resize-none" /></div>
            <div><label className="text-xs text-gray-500">Internal Notes</label><textarea placeholder="Internal Notes" className="mt-1 w-full h-20 border border-gray-200 rounded-md p-3 text-sm text-gray-700 outline-none resize-none" /></div>
          </div>
          <div className="space-y-4">
            <div><label className="text-xs text-gray-500">Notes</label><textarea defaultValue="Mollit fugiat elit" className="mt-1 w-full h-20 border border-gray-200 rounded-md p-3 text-sm text-gray-700 outline-none resize-none" /></div>
            <div>
              <DocAttachmentField compact value={attachment} onChange={(p) => setAttachment(p)} />
            </div>
          </div>
          <div className="border border-gray-200 rounded-md overflow-hidden self-start">
            <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">$0.00</span></div>
            <div className="flex justify-between px-4 py-2 text-sm text-gray-500"><span>Discount</span><span className="text-gray-400">30 or 30%</span></div>
            <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">$0.00</span></div>
          </div>
        </div>
      </div>

      {addVendor && <AddVendorModal onClose={() => setAddVendor(false)} />}
      {settingsOpen && <AppSettingsModal initialTab="Debit Note" onClose={() => setSettingsOpen(false)} />}
    </section>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const PurchaseReturns: React.FC = () => {
  const dbReturns = useCollection<any>("purchaseReturns");
  const dbVendors = useCollection<any>("vendors", "name");
  const [selectedId, setSelectedId] = useState("");
  const [sortBy, setSortBy] = useState("Return date");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [vendorFilterLabels, setVendorFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "activity">(null);
  const [createMode, setCreateMode] = useState(false);
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [sortBy, sortDir, statusFilter, vendorFilter, dateFilter]);

  const returnDateRange = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);
  const { data: listData } = useQuery({
    queryKey: ["purchase-returns-list", page, search, sortBy, sortDir, statusFilter, vendorFilter, dateFilter],
    queryFn: () => fetchPurchaseReturns({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(prSortField(sortBy), sortDir),
      status: apiStatusFilter(statusFilter),
      isDeleted: statusFilter === "Trash" || undefined,
      vendor_id: partyFilterParam(vendorFilter),
      dateField: "return_date",
      ...returnDateRange,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = listData?.pagination;
  const returns: Return[] = useMemo(
    () => (listData?.rows ?? []).map(mapReturnRow),
    [listData?.rows],
  );

  const filtered = returns;
  const selected = returns.find((i) => i.id === selectedId) || returns[0];
  const selectedDb: any =
    dbReturns.find((d) => String(d._id) === selected?.backendId || String(d.id) === selectedId) || {};
  const selectedVendor: any =
    dbVendors.find((v) => String(v._id) === selected?.vendorId) ||
    dbVendors.find((v) => v.id === selectedDb.vendorId) ||
    {};
  const partyBackendId =
    selected?.vendorId ||
    partyIdFromRef(selectedVendor._id) ||
    partyIdFromRef(selectedDb.vendorId) ||
    "";

  useEffect(() => {
    if (returns.length > 0 && !returns.some((p) => p.id === selectedId)) {
      setSelectedId(returns[0].id);
    }
  }, [returns, selectedId]);

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const listTotal = filtered.reduce((s, i) => s + num(i.amount), 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const selectedTotal = returns.filter((i) => checked.has(i.id)).reduce((s, i) => s + num(i.amount), 0);
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.id))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const actionIcons: { icon: React.ElementType; title: string; onClick?: () => void }[] = [
    { icon: Settings, title: "Settings", onClick: () => setModal("settings") },
    { icon: ChevronUp, title: "Collapse" },
    { icon: SlidersHorizontal, title: "Adjust" },
    { icon: Pencil, title: "Edit" },
    { icon: PenTool, title: "Signature" },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => setModal("preview") },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  const hasActiveFilters = statusFilter !== "All" || !!search.trim() || vendorFilter.length > 0 || dateFilter !== "All";
  if (!selected && !createMode && !hasActiveFilters) return <ListEmptyState title="No purchase returns yet" onCreate={() => setCreateMode(true)} createLabel="New Purchase Return" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setCreateMode(true)} createTitle="Create Purchase Return" hideCreate={selectMode}>
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
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Purchase Returns</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Debit Notes")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("debit-notes"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("debit-notes"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search purchase returns..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-200">
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
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Return date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => dateRanges.map((d) => (
              <button key={d} onClick={() => { setDateFilter(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        <div className="flex-1 overflow-y-auto hover-scrollbar relative">
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
                  <div className="text-xs text-gray-500 mt-0.5">{p.number} · Invoice {p.invoice}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{p.reason || p.note}</div>
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

        <ListSidebarFooter
          total={money(listTotal)}
          countLabel={`${listPagination?.totalData ?? filtered.length} Purchase Returns`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} {checked.size === 1 ? "Purchase Return" : "Purchase Returns"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(selectedTotal)}</span>
            </div>
          </div>
        </section>
      ) : createMode ? (
        <CreateReturn onClose={() => setCreateMode(false)} />
      ) : (
        <section className="module-detail-panel custom-scrollbar">
          <div className="relative flex-1 overflow-hidden flex flex-col">
            <div className="module-title-bar">
              <DocPartyHeader
                party="vendor"
                partyId={partyBackendId}
                title={selected?.name}
                subtitle={selectedVendor.contact || selectedVendor.email || ""}
                titleClassName="text-lg font-semibold text-gray-900 truncate"
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {actionIcons.map((a) => (
                  <button key={a.title} title={a.title} onClick={a.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><a.icon className="w-4 h-4" /></button>
                ))}
                <Dropdown align="right" panelClass="w-60" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <>
                      <button type="button" onClick={close} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-400" /></button>
                      <MoreMenuFlyoutRow
                        label={<span className="flex items-center gap-2"><Copy className="w-4 h-4 text-gray-400" /> Duplicate</span>}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        {duplicateAs.map((s) => (
                          <button key={s} type="button" onClick={close} className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{s}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={close} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><CornerUpLeft className="w-4 h-4 text-gray-400" /> Convert to Debit Note</button>
                      <MoreMenuFlyoutRow
                        label="Mark As"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        {markAsList.map((s) => (
                          <button key={s} type="button" onClick={close} className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{s}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={close} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><Signature className="w-4 h-4 text-gray-400" /> Signature Request</button>
                      <button type="button" onClick={() => { setModal("activity"); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><History className="w-4 h-4 text-gray-400" /> Activity Log</button>
                      <button type="button" onClick={close} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200"><Trash2 className="w-4 h-4" /> Trash</button>
                    </>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* meta row */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-12">
                <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
                <div><div className="text-xs text-gray-500">Return date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                <div><div className="text-xs text-gray-500">Invoice #</div><button className="text-sm font-semibold text-blue-600 hover:text-blue-700">{selected.invoice}</button></div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
            </div>

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
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">Reason for Return</label>
                  <div className="mt-1 h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selected.reason || "—"}</div>
                </div>
                <div>
                  <DocAttachmentField
                    compact
                    value={selectedDb?.Attachment || selectedDb?.attachments || ""}
                    onChange={async (path) => {
                      if (!selectedDb?.id) {
                        showToast("Save the document first", "error");
                        throw new Error("missing id");
                      }
                      await repo.update("purchaseReturns", selectedDb.id, { Attachment: path });
                      showToast(path ? "Attachment saved" : "Attachment removed", "success");
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <div className="mt-1 h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selected.note}</div>
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden self-start">
                <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{selected.amount}</span></div>
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{selected.amount}</span></div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 text-[10px] font-semibold py-1 text-center ${STATUS_BADGE[selected.status]}`}>{selected.status}</div>
            </div>
          </div>
        </section>
      )}

      {modal === "settings" && <AppSettingsModal initialTab="Debit Note" onClose={() => setModal(null)} />}
      {modal === "preview" && selected && (() => {
        const d: any = dbReturns.find((x) => String(x._id) === selectedId || String(x.id) === selectedId) || {};
        const pp: any = dbVendors.find((x) => x.id === d.vendorId) || { name: selected.name };
        const pn = pp.name || selected.name || "—";
        return (
          <DocPreview
            onClose={() => setModal(null)}
            headerTitle={`Purchase Return ${d.number || selected.number}`}
            docTitle="PURCHASE RETURN"
            partyLabel="Vendor:"
            partyName={pn}
            party={pp}
            number={d.number || selected.number}
            date={d.date || selected.date}
            due={d.due}
            items={d.items}
            subTotal={d.subTotal}
            tax={d.tax}
            total={d.total}
            amountDue={d.amountDue}
            reason={d.reason || selected.reason}
            terms={d.terms}
            notes={d.notes || selected.note}
          />
        );
      })()}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} ret={selected} />}
      {createOpen && <CreateDocModal collection="purchaseReturns" title="Create Purchase Return" party="vendors" buy onClose={() => setCreateOpen(false)} onSaved={(id) => setSelectedId(String(id))} />}
      {modal === "activity" && <ActivityModal onClose={() => setModal(null)} ret={selected} />}
    </div>
  );
};

export default PurchaseReturns;
