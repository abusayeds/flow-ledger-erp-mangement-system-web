/**
 * File: src/pages/purchase/DebitNotes.tsx
 * Debit Note — master/detail layout matching the reference design.
 * Left: list (search, sort, status/vendor/date filters, selection mode).
 * Right: detail (action icons + ⋮ menu, Unused badge, line items, totals
 *        with Amount Used / Amount Unused, terms/notes/attachment, ribbon)
 *        and modals (Apply to Bill → Bills picker, Activity Log,
 *        Preview / Email / Settings).
 * Purchase-side analog of the Credit Note: it carries a balance you Apply to
 * a Bill (vendor side), instead of an invoice.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { dateRangeFor } from "@/lib/listDateRange";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchDebitNotes,
  fetchDebitNote,
  updateDebitNoteSignature,
  deleteDebitNote,
  deleteDebitNotes,
  type DebitNoteListRow,
} from "@/services/debitNotesApi";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useCollection, repo, nextNumber, money as fmtMoney, CreateDocForm, PdfPreviewModal} from "@/lib/db";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { ActivityLogModal } from "@/components/modals/ActivityLogModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
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
  Download,
  X,
  Trash2,
  MessageCircle,
  CircleChevronUp,
  CircleChevronDown,
  Calendar,
  Barcode,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
type Status = "Unused" | "Partially Used" | "Used";

interface DebitNote {
  id: string;
  backendId: string;
  name: string;
  vendorId: string;
  number: string;
  note: string;
  date: string;
  amount: string;
  status: Status;
  appliedAmount: number;
  balanceAmount: number;
}

const normalizeDnStatus = (raw?: string): Status => {
  const s = (raw || "").toLowerCase();
  if (s.includes("partial")) return "Partially Used";
  if (s === "used" || s === "applied" || s === "settled") return "Used";
  return "Unused";
};

const mapDebitNoteRow = (row: DebitNoteListRow): DebitNote => ({
  id: row._id,
  backendId: row._id,
  name: row.vendorName,
  vendorId: row.vendorId || "",
  number: row.number.startsWith("#") ? row.number : `#${String(row.number).replace(/^#/, "")}`,
  note: row.note,
  date: row.dateLabel,
  amount: fmtMoney(row.amount),
  status: normalizeDnStatus(row.status),
  appliedAmount: row.appliedAmount,
  balanceAmount: row.balanceAmount > 0 ? row.balanceAmount : Math.max(0, row.amount - row.appliedAmount),
});

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};

const DN_TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const DN_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const nowLabel = () => "Today " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const dnSortField = (label: string) => {
  if (label === "Total") return "total";
  if (label === "Debit Note #") return "invoice_number";
  if (label === "Status") return "status";
  if (label === "Name" || label === "First Name" || label === "Last Name") return "vendor_name";
  return "date";
};

const sortFields = ["Name", "First Name", "Last Name", "Debit Note date", "Debit Note #", "Status", "Total"];
const sortDirections = ["Ascending", "Descending"];
const statusList: (Status | "All" | "Trash")[] = ["All", "Unused", "Partially Used", "Used", "Trash"];
const dateRanges = ["All", "Today", "This Week", "Last Week", "This Month", "Last 30 Days", "Last Month", "Last 90 Days", "This Year", "Last Year", "Date Range"];

const STATUS_BADGE: Record<Status, string> = {
  Unused: "bg-gray-900 text-white",
  "Partially Used": "bg-orange-500 text-white",
  Used: "bg-green-500 text-white",
};
const RIBBON_BG: Record<Status, string> = {
  Unused: "bg-green-500 text-white",
  "Partially Used": "bg-orange-500 text-white",
  Used: "bg-green-600 text-white",
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

/* ── Apply to Bill modal (live: picks one of the vendor's open bills) ── */
const ApplyModal: React.FC<{
  onClose: () => void;
  dn: DebitNote;
  unused: number;
  openBills: any[];
  onApply: (billId: number, amount: number) => void;
}> = ({ onClose, dn, unused, openBills, onApply }) => {
  const [amount, setAmount] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(openBills[0]?.id ?? null);
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const picked = openBills.find((i) => i.id === pickedId);
  const maxApply = Math.min(unused, picked?.amountDue ?? unused);
  const parsed = parseFloat(amount) || 0;
  const applyAmt = Math.min(parsed > 0 ? parsed : maxApply, maxApply);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
          <h3 className="text-base font-semibold text-gray-900">Apply to Bill</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button
              onClick={() => pickedId != null && applyAmt > 0 && onApply(pickedId, applyAmt)}
              disabled={pickedId == null || maxApply <= 0}
              className={`px-4 py-1.5 text-sm rounded-md ${pickedId == null || maxApply <= 0 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >Save</button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-gray-700">Debit Note</label>
            <div className="text-sm font-semibold text-gray-900">{dn.number} <span className="text-gray-500 font-normal">({money(unused)} unused)</span></div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-gray-700">Amount</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setAmount(maxApply.toFixed(2))} className="px-3 py-1.5 text-xs border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 whitespace-nowrap">Full Payment</button>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={money(maxApply)} className="w-32 text-right border-b border-gray-300 pb-1 text-sm outline-none bg-transparent text-gray-900" />
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-800 mb-2">Bills</div>
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 max-h-56 overflow-y-auto custom-scrollbar">
              {openBills.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">No open bills for this vendor</div>}
              {openBills.map((bill) => (
                <button key={bill.id} onClick={() => setPickedId(bill.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
                  <span className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${pickedId === bill.id ? "border-blue-600" : "border-gray-400"}`}>
                    {pickedId === bill.id && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{bill.number}</span>
                    <span className="block text-xs text-gray-500">{bill.date}</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{money(bill.amountDue || 0)} <span className="text-xs text-gray-500 font-normal">due</span></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ── DEBIT NOTE preview (white document) ───────────────────────── */
const PreviewModal: React.FC<{ onClose: () => void; dn: DebitNote }> = ({ onClose, dn }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">Debit Note {dn.number}</h3>
        <div className="flex items-center gap-1">
          {[Download, Printer, Mail].map((Ic, i) => (
            <button key={i} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Ic className="w-4 h-4" /></button>
          ))}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div style={{ background: "#fff", color: "#111" }} className="p-6">
        <div className="relative">
          {/* Unused corner ribbon */}
          <div className="absolute top-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
            <div className="absolute top-[18px] -left-[34px] w-32 -rotate-45 bg-gray-900 text-white text-[10px] font-semibold py-1 text-center">{dn.status}</div>
          </div>
          <div className="text-right text-sm italic text-gray-500">(Original)</div>
          <div className="border border-gray-300">
            <h1 className="text-center text-2xl font-bold py-3 border-b border-gray-300">DEBIT NOTE</h1>
            <div className="flex justify-between gap-6 p-4">
              <div>
                <div className="font-bold text-lg">info</div>
                <div className="text-sm text-gray-700">Bangladesh</div>
                <div className="text-sm text-gray-700">info@inovoic.com</div>
                <div className="font-bold text-sm mt-2">Debit Note To:</div>
                <div className="text-sm font-semibold">{dn.name}</div>
              </div>
              <table className="text-sm border-collapse h-fit">
                <tbody>
                  {[["Debit Note #", dn.number.replace("#", "")], ["Debit Note date", dn.date], ["Total", dn.amount]].map(([k, v]) => (
                    <tr key={k}><td className="border border-gray-300 px-3 py-1.5 font-semibold text-right">{k}</td><td className="border border-gray-300 px-3 py-1.5">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-6 text-center text-sm font-semibold border-t border-gray-300">hdgh</div>
          </div>
        </div>
      </div>
    </div>
  </Overlay>
);

/* ── Email modal ───────────────────────────────────────────────── */
const EmailModal: React.FC<{ onClose: () => void; dn: DebitNote }> = ({ onClose, dn }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
        <h3 className="text-base font-medium text-gray-900">Debit Note {dn.number} from info</h3>
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
        <input defaultValue={`Debit Note ${dn.number} from info`} className="w-full border-b border-gray-200 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-200 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {dn.name}</p>
          <p>Debit Note {dn.number}<br />Total Amount: {dn.amount}</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Debit Note {dn.number}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

/* ── Floating-label field ──────────────────────────────────────── */
const fieldCls = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
const FloatField: React.FC<{ label?: string; value?: string; placeholder?: string; icon?: React.ReactNode }> = ({ label, value, placeholder, icon }) => (
  <div className="relative fl-wrap">
    {label && <label className="fl-label">{label}</label>}
    <div className="relative">
      <input defaultValue={value} placeholder={placeholder && placeholder !== label ? placeholder : " "} className={fieldCls} />
      {icon && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
    </div>
  </div>
);

/* ── Add Vendor modal (same as Bill page) ──────────────────────── */
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
            <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><FloatField placeholder="Street 1" /><FloatField placeholder="Street 2" /></div><div className="grid grid-cols-4 gap-2"><FloatField placeholder="Zip" /><FloatField placeholder="City" /><FloatField placeholder="State" /><FloatField placeholder="Country" /></div></div>
            <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><FloatField placeholder="Street 1" /><FloatField placeholder="Street 2" /></div><div className="grid grid-cols-4 gap-2"><FloatField placeholder="Zip" /><FloatField placeholder="City" /><FloatField placeholder="State" /><FloatField placeholder="Country" /></div></div>
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

/* ── Edit Debit Note (inline form, replaces detail) ────────────── */
const EditDebitNote: React.FC<{ dn: DebitNote; onClose: () => void }> = ({ dn, onClose }) => {
  const [attachment, setAttachment] = useState("");
  const dbVendors = useCollection<any>("vendors", "name");
  const vendorList = useMemo(() => dbVendors.map((v: { name: string }) => v.name), [dbVendors]);
  const [vendorQuery, setVendorQuery] = useState(dn.name);
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
  return (
    <section className="module-detail-panel custom-scrollbar">
      {/* header */}
      <div className="module-title-bar sticky top-0 z-20">
        <h1 className="text-lg font-semibold text-gray-900">Edit Debit Note</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} title="Settings" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Barcode className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={onClose} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Save</button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* top fields */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2 relative fl-wrap" ref={vref}>
            <label className="fl-label">Vendor *</label>
            <div className="relative">
              <input value={vendorQuery} onChange={(e) => { setVendorQuery(e.target.value); setVendorOpen(true); }} onFocus={() => setVendorOpen(true)} placeholder=" " className={fieldCls} />
              <button onClick={() => setAddVendor(true)} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Pencil className="w-4 h-4" /></button>
            </div>
            {vendorOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-60 overflow-y-auto custom-scrollbar">
                {matches.map((v) => <button key={v} onClick={() => { setVendorQuery(v); setVendorOpen(false); }} className="w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">{v}</button>)}
                {matches.length === 0 && <div className="px-3 py-2.5 text-sm text-gray-400">No vendor found</div>}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Address</label>
            <button className="w-full mt-0.5 flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-500"><span /> <ChevronDown className="w-4 h-4" /></button>
          </div>
          <FloatField label="Debit Note #" value={dn.number.replace("#", "")} />
          <FloatField label="Currency" value="$ USD" />
          <FloatField label="Debit Note date *" value={dn.date} icon={<Calendar className="w-4 h-4" />} />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="w-64"><FloatField label="Sub Title" value="hdgh" /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" /> Discount before tax</label>
        </div>

        {/* line items */}
        <div className="border border-gray-200 rounded-md overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left font-semibold px-4 py-2.5">Sr. No.</th>
                <th className="text-left font-semibold px-2 py-2.5">Items</th>
                <th className="text-right font-semibold px-2 py-2.5">Quantity</th>
                <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                <th className="text-right font-semibold px-2 py-2.5">Tax</th>
                <th className="text-right font-semibold px-2 py-2.5">Discount</th>
                <th className="text-right font-semibold px-4 py-2.5">Amount</th>
              </tr>
            </thead>
          </table>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Product</button>
              <button className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Service</button>
            </div>
            <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Settings className="w-4 h-4" /></button>
          </div>
        </div>

        {/* terms / notes / totals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-4">
            <div><label className="text-xs text-gray-500">Terms &amp; Conditions</label><textarea defaultValue="Eum illo minus fuga" className="mt-1 w-full h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700 outline-none resize-none" /></div>
            <div><label className="text-xs text-gray-500">Internal Notes</label><textarea placeholder="Internal Notes" className="mt-1 w-full h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700 outline-none resize-none" /></div>
          </div>
          <div className="space-y-4">
            <div><label className="text-xs text-gray-500">Notes</label><textarea defaultValue={dn.note} className="mt-1 w-full h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700 outline-none resize-none" /></div>
            <DocAttachmentField compact value={attachment} onChange={(p) => setAttachment(p)} />
          </div>
          <div className="border border-gray-200 rounded-md overflow-hidden self-start">
            <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{dn.amount}</span></div>
            <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-200"><span className="text-gray-700">Total</span><span className="font-semibold text-gray-900">{dn.amount}</span></div>
            <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Amount Used</span><span>$0.00</span></div>
            <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Amount Unused</span><span className="font-semibold text-gray-900">{dn.amount}</span></div>
          </div>
        </div>
      </div>

      {addVendor && <AddVendorModal onClose={() => setAddVendor(false)} />}
      {settingsOpen && <AppSettingsModal initialTab="Debit Note" onClose={() => setSettingsOpen(false)} />}
    </section>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const DebitNotes: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number | string; openCreate?: boolean } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<string>(navSelectedId != null ? String(navSelectedId) : "");
  useEffect(() => { if (navSelectedId != null) setSelectedId(String(navSelectedId)); }, [navSelectedId]);
  const [sortBy, setSortBy] = useState("Debit Note date");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [vendorFilterLabels, setVendorFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "apply" | "pdfSettings">(null);
  const [editMode, setEditMode] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  useEffect(() => {
    if (navState?.openCreate) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, location.pathname, navigate]);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [sortBy, sortDir, statusFilter, vendorFilter, dateFilter]);

  const debitNoteDateRange = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);
  const backendStatusFilter = useMemo(() => {
    if (statusFilter === "All" || statusFilter === "Trash") return undefined;
    // UI labels → backend debitNoteStatus enum values
    if (statusFilter === "Unused") return "Draft,Open,Approved";
    if (statusFilter === "Partially Used") return "Partial";
    if (statusFilter === "Used") return "Applied,Paid";
    return statusFilter;
  }, [statusFilter]);
  const { data: listData } = useQuery({
    queryKey: ["debit-notes-list", page, search, sortBy, sortDir, statusFilter, vendorFilter, dateFilter],
    queryFn: () => fetchDebitNotes({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(dnSortField(sortBy), sortDir),
      status: backendStatusFilter,
      isDeleted: statusFilter === "Trash" || undefined,
      vendor_id: partyFilterParam(vendorFilter),
      dateField: "date",
      ...debitNoteDateRange,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = listData?.pagination;
  const debitNotes: DebitNote[] = useMemo(
    () => (listData?.rows ?? []).map(mapDebitNoteRow),
    [listData?.rows],
  );

  const filtered = debitNotes;
  const selected = debitNotes.find((i) => i.id === selectedId) || debitNotes[0];

  useEffect(() => {
    if (debitNotes.length > 0 && !debitNotes.some((p) => p.id === selectedId)) {
      setSelectedId(debitNotes[0].id);
    }
  }, [debitNotes, selectedId]);

  const { data: selectedBackend } = useQuery({
    queryKey: ["debit-note", selected?.backendId],
    queryFn: () => fetchDebitNote(selected!.backendId),
    enabled: !!selected?.backendId,
    staleTime: 15_000,
  });

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dbNotes = useCollection<any>("debitNotes");
  const dbVendors = useCollection<any>("vendors", "name");
  const dbBills = useCollection<any>("bills");
  const selectedDb: any = dbNotes.find((d) => String(d._id) === selected?.backendId || String(d.id) === selectedId) || {
    id: selected?.id,
    _id: selected?.backendId,
    number: selected?.number,
    notes: selectedBackend?.notes || selected?.note,
    internalNotes: selectedBackend?.internal_notes,
    terms: selectedBackend?.terms_and_conditions,
    date: selected?.date,
    total: selectedBackend?.total ?? (selected ? num(selected.amount) : 0),
    subTotal: selectedBackend?.sub_total ?? 0,
    tax: selectedBackend?.tax ?? 0,
    inlineDiscount: selectedBackend?.inline_discount ?? 0,
    status: selected?.status,
    amountUsed: selectedBackend?.applied_amount ?? selected?.appliedAmount ?? 0,
    items: selectedBackend?.product || [],
    vendorId:
      (typeof selectedBackend?.vendor_id === "object"
        ? (selectedBackend?.vendor_id as any)?._id
        : selectedBackend?.vendor_id) || selected?.vendorId,
    signature: selectedBackend?.signature,
    Attachment: selectedBackend?.Attachment || selectedBackend?.attachments,
  };
  const selectedVendor: any =
    dbVendors.find((v) => String(v._id) === selected?.vendorId) ||
    dbVendors.find((v) => v.id === selectedDb.vendorId || String(v._id) === String(selectedDb.vendorId)) ||
    {};
  const partyBackendId =
    selected?.vendorId ||
    partyIdFromRef(selectedVendor._id) ||
    partyIdFromRef(selectedDb.vendorId) ||
    "";
  const openBills = dbBills.filter(
    (b) =>
      (b.vendorId === selectedDb.vendorId || String(b.vendorId) === String(selectedDb.vendorId) || String(b.vendorId) === String(selected?.vendorId)) &&
      (b.amountDue || 0) > 0,
  );
  const usedFor = (dn: DebitNote) => dn.appliedAmount || 0;
  const unusedFor = (dn: DebitNote) => dn.balanceAmount ?? Math.max(0, num(dn.amount) - usedFor(dn));
  const isApplied = selected ? usedFor(selected) > 0 : false;
  const detailItems = (selectedDb.items?.length ? selectedDb.items : selectedBackend?.product) || [];

  const logActivity = async (kind: string, text: string) => {
    if (!selectedDb.id || typeof selectedDb.id !== "number") return;
    const rec = dbNotes.find((d) => d.id === selectedDb.id);
    await repo.update("debitNotes", selectedDb.id, { activity: [...(rec?.activity || []), { kind, text, ts: Date.now(), dateLabel: nowLabel() }] });
  };
  const duplicateAsDebitNote = async () => {
    if (typeof selectedDb.id !== "number") {
      showToast("Duplicate requires a local draft record", "info");
      return;
    }
    const n = await nextNumber("debitNotes");
    const id = await repo.add("debitNotes", {
      vendorId: selectedDb.vendorId, date: selectedDb.date, due: selectedDb.due, ts: Date.now(),
      number: "#" + n, status: "Unused", items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0,
      tax: selectedDb.tax || 0, total: selectedDb.total || 0, amountUsed: 0, inlineDiscount: selectedDb.inlineDiscount || 0,
      notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    });
    setSelectedId(String(id));
    showToast("Debit note duplicated", "success");
    void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
  };
  const trashCurrent = async () => {
    const id = selected?.backendId;
    if (!id) return;
    await deleteDebitNote(id);
    showToast(`Debit Note ${selected?.number} moved to trash`, "success");
    setSelectedId(debitNotes.find((c) => c.id !== id)?.id ?? "");
    setConfirmAction(null);
    void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
  };
  const trashSelected = async () => {
    const ids = [...checked];
    if (ids.length === 0) { showToast("Select debit notes to delete", "info"); return; }
    await deleteDebitNotes(ids);
    showToast(`${ids.length} debit ${ids.length === 1 ? "note" : "notes"} moved to trash`, "success");
    if (ids.includes(selectedId)) setSelectedId(debitNotes.find((c) => !ids.includes(c.id))?.id ?? "");
    setConfirmAction(null);
    exitSelect();
    void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
  };
  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedDb?._id || selected?.backendId;
    let signaturePath = data.image;
    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `debit-note-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        signaturePath =
          uploadRes.data?.data?.file_path ||
          uploadRes.data?.data?.path ||
          uploadRes.data?.data?.[0]?.path ||
          data.image;
        await updateDebitNoteSignature(String(backendId), signaturePath);
      }
      if (typeof selectedDb.id === "number") {
        // Local meta only — avoid write-through updateDraft (Draft-only) after signature API.
        await repo.put("debitNotes", {
          ...selectedDb,
          signature: signaturePath,
          signatureName: data.name,
          signatureTitle: data.title,
          signatureDate: data.date,
          updatedAt: new Date().toISOString(),
        });
      }
      if (backendId) {
        await queryClient.invalidateQueries({ queryKey: ["debit-note", String(backendId)] });
        await queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
      }
      await logActivity("status", `Vendor signature added to Debit Note ${selectedDb.number}.`);
      showToast("Signature saved", "success");
      setSigOpen(false);
    } catch {
      showToast("Could not save signature", "error");
    }
  };

  const listUnusedTotal = filtered.reduce((s, i) => s + unusedFor(i), 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const selectedTotal = debitNotes.filter((i) => checked.has(i.id)).reduce((s, i) => s + num(i.amount), 0);
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.id))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const applyToBill = async (billId: number, amount: number) => {
    const bill = dbBills.find((i) => i.id === billId);
    if (!bill) return;
    const newDue = Math.max(0, (bill.amountDue || 0) - amount);
    await repo.update("bills", billId, {
      amountDue: +newDue.toFixed(2),
      amountPaid: +((bill.amountPaid || 0) + amount).toFixed(2),
      ...(newDue === 0 ? { status: "Paid" } : {}),
    });
    if (typeof selectedDb.id === "number") {
      const newUsed = (selectedDb.amountUsed || 0) + amount;
      const total = selectedDb.total || 0;
      await repo.update("debitNotes", selectedDb.id, {
        amountUsed: +newUsed.toFixed(2),
        appliedBillNo: bill.number,
        status: newUsed >= total ? "Used" : "Partially Used",
      });
    }
    await logActivity("sent", `Debit Note ${selectedDb.number} applied to bill ${bill.number}.`);
    showToast(`${money(amount)} applied to bill ${bill.number}`, "success");
    void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
    void queryClient.invalidateQueries({ queryKey: ["debit-note", selected?.backendId] });
    setModal(null);
  };

  const actionIcons: { icon: React.ElementType; title: string; onClick?: () => void }[] = [
    { icon: Settings, title: "Settings", onClick: () => setModal("settings") },
    { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) },
    { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") },
    { icon: Pencil, title: "Edit", onClick: () => setEditMode(true) },
    { icon: PenTool, title: "Vendor Signature", onClick: () => setSigOpen(true) },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => { void logActivity("printed", `Debit Note ${selectedDb.number} printed.`); setModal("preview"); } },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  const hasActiveFilters = statusFilter !== "All" || !!search.trim() || vendorFilter.length > 0 || dateFilter !== "All";
  if (!selected && !createOpen && !hasActiveFilters) return <ListEmptyState title="No debit notes yet" onCreate={() => setCreateOpen(true)} createLabel="New Debit Note" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Debit Note" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              <button title="Delete" onClick={() => (checked.size === 0 ? showToast("Select debit notes to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp…", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Debit Notes</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Debit Notes")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("debit-notes"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("debit-notes"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search debit notes..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
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
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Debit Note date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => dateRanges.map((d) => (
              <button key={d} onClick={() => { setDateFilter(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
          {filtered.map((p) => {
            const active = !selectMode && !createOpen && !editMode && p.id === selectedId;
            const isChecked = checked.has(p.id);
            const applied = usedFor(p) > 0;
            return (
              <button key={p.id} onClick={() => (selectMode ? toggleRow(p.id) : (setSelectedId(p.id), setCreateOpen(false), setEditMode(false)))}
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
                  <span className={`text-sm font-semibold mt-0.5 ${applied ? "text-green-600" : "text-gray-900"}`}>{applied ? money(unusedFor(p)) : p.amount}</span>
                  <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter
          total={<>{money(listUnusedTotal)} <span className="font-normal text-slate-500">Unused</span></>}
          countLabel={`${listPagination?.totalData ?? filtered.length} Debit Notes`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {createOpen ? (
        /* Create Debit Note — same full inline form as Create Credit Note */
        <CreateDocForm collection="debitNotes" title="New Debit Note" party="vendors" buy creditTotals onClose={() => setCreateOpen(false)} onSaved={(id) => { setSelectedId(String(id)); void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] }); }} />
      ) : selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} Debit {checked.size === 1 ? "Note" : "Notes"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(selectedTotal)}</span>
            </div>
          </div>
        </section>
      ) : editMode && selectedDb?.id ? (
        <CreateDocForm
          collection="debitNotes"
          title="Edit Debit Note"
          party="vendors"
          buy
          creditTotals
          record={selectedDb}
          onClose={() => setEditMode(false)}
          onSaved={(id) => {
            setEditMode(false);
            setSelectedId(String(id));
            void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
          }}
        />
      ) : (
        <section className="module-detail-panel custom-scrollbar">
          <div className="relative flex-1 overflow-hidden flex flex-col">
            {/* header */}
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
                {/* ⋮ menu */}
                <Dropdown align="right" panelClass="min-w-[200px]" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <div className="py-1">
                      <button type="button" onClick={() => { showToast("Opening WhatsApp…", "info"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
                      <MoreMenuFlyoutRow label="Duplicate">
                        <button type="button" onClick={() => { void duplicateAsDebitNote(); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">As Debit Note</button>
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={() => { setModal("apply"); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Apply To Bill</button>
                      <button type="button" onClick={() => { setSigRequestOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Signature Request</button>
                      <button type="button" onClick={() => { setActivityOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left border-t border-gray-200">Activity Log</button>
                      <button type="button" onClick={() => { setConfirmAction("trashOne"); close(); }} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200">Trash</button>
                    </div>
                  )}
                </Dropdown>
              </div>
            </div>

            {/* meta row — #, Debit Note date, (Settled On when applied), amount + badge */}
            {expanded && (
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-12">
                <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
                <div><div className="text-xs text-gray-500">Debit Note date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                {isApplied && (
                  <div><div className="text-xs text-gray-500">Settled On</div><button onClick={() => selectedDb.appliedBillNo && navigate("/purchase/bills", { state: { selectedId: parseInt(String(selectedDb.appliedBillNo).replace("#", ""), 10) } })} className="text-sm font-semibold text-blue-600 hover:underline">{selectedDb.appliedBillNo || "—"}</button></div>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-900">{selected.amount}</span>
                <span className={`mt-1 px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
              </div>
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
                  {detailItems.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>
                  )}
                  {detailItems.map((it: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-200 align-top">
                      <td className="px-5 py-3 text-gray-700">{idx + 1}</td>
                      <td className="px-2 py-3">
                        <div className="font-semibold text-gray-900">{it.name || it.product_name || "—"}</div>
                        {(it.description || it.desc) && <div className="text-xs text-gray-500 mt-0.5">{it.description || it.desc}</div>}
                      </td>
                      <td className="px-2 py-3 text-right text-gray-800">{it.qty ?? it.quantity ?? 1}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(it.rate ?? it.price ?? 0)}</td>
                      <td className="px-2 py-3 text-gray-800">{DN_TAX_NAME[it.taxId || 1]}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{it.discount ? `${it.discount}%` : "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(it.amount ?? (it.qty || it.quantity || 0) * (it.rate || it.price || 0))}</td>
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
                  <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selectedDb.terms || selectedBackend?.terms_and_conditions || "—"}</div>
                </div>
                <DocAttachmentField
                  compact
                  value={selectedBackend?.Attachment || selectedDb?.Attachment || selectedDb?.attachments || ""}
                  onChange={async (path) => {
                    if (!selectedDb?.id || typeof selectedDb.id !== "number") {
                      showToast("Save the document first", "error");
                      throw new Error("missing id");
                    }
                    await repo.update("debitNotes", selectedDb.id, { Attachment: path, attachments: path });
                    await queryClient.invalidateQueries({ queryKey: ["debit-note", selected?.backendId] });
                    await queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
                    showToast(path ? "Attachment saved" : "Attachment removed", "success");
                  }}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">Notes</label>
                  <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selectedDb.notes || selectedBackend?.notes || selected?.note || "—"}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Internal Notes</label>
                  <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{selectedDb.internalNotes || selectedBackend?.internal_notes || "—"}</div>
                </div>
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden self-start">
                <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedDb.subTotal ?? selectedBackend?.sub_total)}</span></div>
                {(selectedDb.inlineDiscount || selectedBackend?.inline_discount || 0) > 0 && (
                  <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Inline Discount</span><span>{fmtMoney(selectedDb.inlineDiscount || selectedBackend?.inline_discount)}</span></div>
                )}
                {Object.entries(
                  (detailItems as any[]).reduce((acc: Record<number, number>, it: any) => {
                    const base = it.amount ?? (it.qty || it.quantity || 0) * (it.rate || it.price || 0);
                    acc[it.taxId || 1] = (acc[it.taxId || 1] || 0) + base;
                    return acc;
                  }, {}),
                ).map(([taxId, base]) => (
                  <div key={taxId} className="flex justify-between px-4 py-2 text-xs text-gray-500">
                    <span>{DN_TAX_NAME[Number(taxId)]} {DN_TAX_RATE[Number(taxId)]}% on {fmtMoney(base as number)}</span>
                    <span>{fmtMoney(((base as number) * (DN_TAX_RATE[Number(taxId)] || 0)) / 100)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-200"><span className="text-gray-700">Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedDb.total ?? selectedBackend?.total ?? num(selected.amount))}</span></div>
                <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Amount Used</span><span>{money(usedFor(selected))}</span></div>
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Amount Unused</span><span className="font-semibold text-gray-900">{money(unusedFor(selected))}</span></div>
              </div>
            </div>

            <SignatureBlock
              record={{ ...selectedDb, signature: selectedBackend?.signature || selectedDb.signature }}
              label="Vendor Signature"
            />

            {/* status corner ribbon */}
            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 text-[10px] font-semibold py-1 text-center ${RIBBON_BG[selected.status]}`}>{selected.status}</div>
            </div>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "settings" && <AppSettingsModal initialTab="Debit Note" onClose={() => setModal(null)} />}
      {modal === "preview" && (() => {
        const d: any = dbNotes.find((x) => String(x._id) === selectedId || String(x.id) === selectedId) || {};
        return <PdfPreviewModal docType="debitNote" recordId={d.id} title="Debit Note " onClose={() => setModal(null)} />;
      })()}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} dn={selected} />}
      {modal === "apply" && <ApplyModal onClose={() => setModal(null)} dn={selected} unused={unusedFor(selected)} openBills={openBills} onApply={applyToBill} />}
      {modal === "pdfSettings" && <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="debitNote" />}
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
          docLabel="Debit Note"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedVendor}
          documentId={String(selectedBackend?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="debit_note"
          emailNav="debit_note"
          pdfDocType="debitNote"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{
            status:
              selectedBackend?.status && selectedBackend.status !== "Draft"
                ? selectedBackend.status
                : "Open",
          }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void logActivity("sent", `Signature request for Debit Note ${selectedDb.number} sent.`);
            void queryClient.invalidateQueries({ queryKey: ["debit-notes-list"] });
            if (selected?.backendId) void queryClient.invalidateQueries({ queryKey: ["debit-note", selected.backendId] });
          }}
        />
      )}
      {activityOpen && <ActivityLogModal docLabel="Debit Note" record={selectedDb} onClose={() => setActivityOpen(false)} />}
      {confirmAction === "trashOne" && (
        <ConfirmAlert message="Are you sure want to trash this debit note?" onNo={() => setConfirmAction(null)} onYes={trashCurrent} />
      )}
      {confirmAction === "trashSelected" && (
        <ConfirmAlert message="Are you sure want to delete these debit notes?" onNo={() => setConfirmAction(null)} onYes={trashSelected} />
      )}
    </div>
  );
};

export default DebitNotes;
