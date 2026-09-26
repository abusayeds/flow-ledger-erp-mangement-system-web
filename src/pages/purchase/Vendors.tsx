/**
 * File: src/pages/purchase/Vendors.tsx
 * Vendor page — master/detail layout matching the reference design.
 * Left: vendor list (search, sort, status / created-on filters, selection).
 * Right: detail with Overview / Details / Settings tabs + action icons
 *        (edit, Add Payment $, Statement) and an inline Edit Vendor form.
 * Connected to backend via /api/v1/vendor/* (same party write shape as Customers).
 */

import React, { useMemo, useState, useEffect } from "react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { createdOnToRange, createCustomer, type CustomerFormData } from "@/services/customersApi";
import type { TBackendParty } from "@/services/customerTypes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { useLocation, useNavigate } from "react-router-dom";
import { useCollection, downloadDocPdf } from "@/lib/db";
import { exportReportCsv, exportReportXlsx } from "@/lib/reportExport";
import {
  fetchVendors,
  fetchVendor,
  createVendor,
  updateVendor,
  archiveVendor,
  archiveVendors,
  deleteVendor,
  deleteVendors,
  mergeVendors,
  type VendorListRow,
} from "@/services/vendorsApi";
import { fetchVendorPayments } from "@/services/vendorPaymentsApi";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { BillPaymentsModal } from "@/components/modals/BillPaymentsModal";
import { buildListSortParam } from "@/lib/listSort";
import { TabSlide } from "@/components/ui/TabSlide";
import { RecentActivities } from "@/components/ui/RecentActivities";
import { showToast } from "@/utils/toast";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PartyStatementModal, type StatementConfig } from "@/components/modals/PartyStatementModal";
import {
  Search,
  Plus,
  ChevronDown,
  Check,
  Pencil,
  DollarSign,
  FileText,
  MoreVertical,
  Trash2,
  Copy,
  Mail,
  X,
  Download,
  Printer,
  Sparkles,
  Archive,
  Merge,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  Settings,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";
import { useAppSettings, isVendorFieldVisible } from "@/lib/db/appSettings";

/* ── Constants ─────────────────────────────────────────────────── */
const sortFields = ["Name", "First Name", "Last Name", "Created On", "Payable", "Total", "Due", "Paid"];
const createdOptions = ["All", "Today", "This Week", "This Month", "This Year"];
const statusOptions = ["Active", "Archived", "Trash"] as const;
const activityFilters = ["All", "Created", "Updated", "Archived", "Bill", "Expense", "Payment"];
const VENDORS_LIST_KEY = "vendors-backend-list";

type VendorRow = {
  _id: string;
  name: string;
  contact: string;
  amount: number;
};

/* ── Helpers ───────────────────────────────────────────────────── */
const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Convert full TBackendParty doc → UI form initial state (same shape as Customers) */
function docToForm(doc: TBackendParty): CustomerFormData {
  const p = doc.businessProfile ?? {};
  const billing = p.billing_address ?? {};
  const shipping = p.shipping_address ?? {};
  const [firstName = "", ...lastParts] = (doc.name ?? "").split(" ");
  return {
    name: p.companyName ?? "",
    firstName,
    lastName: lastParts.join(" "),
    email: doc.email ?? "",
    phone: p.business_phone ?? "",
    mobile: doc.phone ?? "",
    fax: p.fax ?? "",
    homePhone: p.home_phone ?? "",
    regNo: p.registration_number ?? "",
    taxId: p.tax_number ?? "",
    birthday: p.birthday ? String(p.birthday).slice(0, 10) : "",
    anniversary: p.anniversary ? String(p.anniversary).slice(0, 10) : "",
    bank: p.bank_details ?? "",
    street1: billing.address_line_1 ?? "",
    street2: billing.address_line_2 ?? "",
    zip: billing.zip_code ?? "",
    city: billing.city ?? "",
    state: billing.state ?? "",
    country: billing.country ?? "",
    sameAsBilling: p.same_as_billing ?? false,
    shipStreet1: shipping.address_line_1 ?? "",
    shipStreet2: shipping.address_line_2 ?? "",
    shipZip: shipping.zip_code ?? "",
    shipCity: shipping.city ?? "",
    shipState: shipping.state ?? "",
    shipCountry: shipping.country ?? "",
    currency: doc.currency ?? "$ USD",
    defaultTaxService: "None",
    defaultTaxProduct: "None",
    hourlyRate: p.hourly_rate != null ? String(p.hourly_rate) : "",
    paymentTerms: p.payment_terms ?? "Default Company",
    openingBalance: p.opening_balance != null ? String(p.opening_balance) : "",
    openingBalanceDate: p.opening_balance_date ? String(p.opening_balance_date).slice(0, 10) : "",
    notes: p.notes ?? "",
    paymentReminder: p.payment_reminder !== false,
    isLoginRequired: p.is_login_required ?? false,
  };
}

function emptyForm(): CustomerFormData {
  return {
    name: "", firstName: "", lastName: "", email: "",
    phone: "", mobile: "", fax: "", homePhone: "", regNo: "", taxId: "",
    birthday: "", anniversary: "", bank: "",
    street1: "", street2: "", zip: "", city: "", state: "", country: "",
    sameAsBilling: false,
    shipStreet1: "", shipStreet2: "", shipZip: "", shipCity: "", shipState: "", shipCountry: "",
    currency: "$ USD", defaultTaxService: "None", defaultTaxProduct: "None",
    hourlyRate: "", paymentTerms: "Default Company",
    openingBalance: "", openingBalanceDate: "", notes: "", paymentReminder: true,
    isLoginRequired: false,
  };
}

function mapListRow(row: VendorListRow): VendorRow {
  return {
    _id: row._id,
    name: row.name,
    contact: row.email || row.phone || "—",
    amount: -(row.opening_balance || 0),
  };
}

/* ── Detail "more" menu (Archive / Duplicate ▸ / Trash) ────────── */
const DetailMoreMenu: React.FC<{
  close: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onDuplicate: (target: "customer" | "vendor" | "both") => void;
}> = ({ close, onArchive, onTrash, onDuplicate }) => {
  const item = "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left";
  const run = (fn: () => void) => { fn(); close(); };
  return (
    <div>
      <button type="button" onClick={() => run(onArchive)} className={item}>
        <span className="flex items-center gap-2"><Archive className="w-4 h-4" /> Archive</span>
      </button>
      <MoreMenuFlyoutRow
        label={<span className="flex items-center gap-2"><Copy className="w-4 h-4" /> Duplicate</span>}
        className={item}
      >
        {(["customer", "vendor", "both"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => run(() => onDuplicate(t))}
            className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left capitalize"
          >
            {t}
          </button>
        ))}
      </MoreMenuFlyoutRow>
      <button type="button" onClick={() => run(onTrash)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200">
        <Trash2 className="w-4 h-4" /> Trash
      </button>
    </div>
  );
};

/* ── Merge Vendors modal (mirrors the customers merge flow) ────── */
const MergeVendorsModal: React.FC<{
  vendors: { _id: string; name: string; contact: string }[];
  onClose: () => void;
  onMerge: (targetId: string) => void;
}> = ({ vendors, onClose, onMerge }) => {
  const [targetId, setTargetId] = useState<string | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Merge Vendors</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button
              onClick={() => targetId != null && onMerge(targetId)}
              disabled={targetId == null}
              className={`px-5 py-1.5 text-sm rounded-md font-medium ${targetId == null ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              Merge
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {vendors.map((c) => (
            <button key={c._id} onClick={() => setTargetId(c._id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50">
              <span className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${targetId === c._id ? "border-blue-600" : "border-gray-400"}`}>
                {targetId === c._id && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                {c.contact && <span className="block text-xs text-gray-500 truncate">{c.contact}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-500">
          Select the vendor with which you wish to merge the rest of the vendors
        </div>
      </div>
    </div>
  );
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

/* ── Statement preview (white document) ────────────────────────── */
interface StmtRow { date: string; details: string; amount: string; paid: string; balance: string }
const StatementPreview: React.FC<{ onClose: () => void; name: string; vendor: any; rows: StmtRow[]; summary: { amount: string; paid: string; balance: string }; onDownload?: () => void }> = ({ onClose, name, vendor, rows, summary, onDownload }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">{name}'s Statement</h3>
        <div className="flex items-center gap-1">
          {[Download, Printer, Mail].map((Ic, i) => (
            <button key={i} onClick={i === 0 ? onDownload : undefined} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Ic className="w-4 h-4" /></button>
          ))}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div style={{ background: "#fff", color: "#111" }} className="p-6">
        <h1 className="text-center text-2xl font-bold mb-4">STATEMENT</h1>
        <div className="flex justify-between gap-6 mb-4">
          <div className="text-sm">
            <div className="font-bold">info</div>
            <div>Bangladesh</div>
            <div>info@inovoic.com</div>
            <div className="font-bold mt-2">Statement To:</div>
            <div className="font-semibold">{name}</div>
            {vendor?.contact && <div>{vendor.contact}</div>}
            {vendor?.email && <div>{vendor.email}</div>}
            {vendor?.phone && <div>Phone: {vendor.phone}</div>}
          </div>
          <table className="text-sm border-collapse h-fit">
            <tbody>
              {[["Amount", summary.amount], ["Paid", summary.paid], ["Balance", summary.balance], ["From", "Apr 27, 2026"], ["To", "Jun 22, 2026"]].map(([k, v]) => (
                <tr key={k}><td className="border border-gray-300 px-3 py-1 font-semibold text-right">{k}</td><td className="border border-gray-300 px-3 py-1">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>{["Date", "Details", "Amount", "Paid", "Balance"].map((h) => <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            <tr><td className="border border-gray-300 px-2 py-1.5">—</td><td className="border border-gray-300 px-2 py-1.5">Opening Balance</td><td className="border border-gray-300 px-2 py-1.5">$0.00</td><td className="border border-gray-300 px-2 py-1.5">$0.00</td><td className="border border-gray-300 px-2 py-1.5">$0.00</td></tr>
            {rows.length === 0 && <tr><td className="border border-gray-300 px-2 py-6 text-center text-gray-400" colSpan={5}>No transactions</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}><td className="border border-gray-300 px-2 py-1.5">{r.date}</td><td className="border border-gray-300 px-2 py-1.5">{r.details}</td><td className="border border-gray-300 px-2 py-1.5">{r.amount}</td><td className="border border-gray-300 px-2 py-1.5">{r.paid}</td><td className="border border-gray-300 px-2 py-1.5">{r.balance}</td></tr>
            ))}
            <tr className="font-bold"><td className="border border-gray-300 px-2 py-1.5" colSpan={2}>Total</td><td className="border border-gray-300 px-2 py-1.5">{summary.amount}</td><td className="border border-gray-300 px-2 py-1.5">{summary.paid}</td><td className="border border-gray-300 px-2 py-1.5">{summary.balance}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </Overlay>
);

/* ── Toggle ────────────────────────────────────────────────────── */
const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button onClick={onChange} className={`w-9 h-5 rounded-full transition-colors relative ${on ? "bg-blue-600" : "bg-gray-300"}`}>
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
  </button>
);

/* ── Vendor form (inline right panel — Create & Edit) ───────────── */
const fieldCls = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600";
const VField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, type = "text", disabled }) =>
  type === "date" ? (
    <AppDatePicker floatingLabel={label} value={value} onValueChange={onChange} disabled={disabled} placeholder={placeholder} />
  ) : (
  <div className="relative fl-wrap">
    <label className="fl-label">{label}</label>
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder && placeholder !== label ? placeholder : " "}
      className={`${fieldCls} ${disabled ? "bg-gray-50 text-gray-400" : ""}`}
    />
  </div>
);

const VendorForm: React.FC<{
  title: string;
  doc: TBackendParty | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}> = ({ title, doc, onClose, onSaved }) => {
  const qc = useQueryClient();
  const isCreate = doc === null;
  const vendorSettings = useAppSettings("vendor");
  const show = (key: string) => isVendorFieldVisible(vendorSettings?.fieldVisibility, key);
  const [taxpayerType, setTaxpayerType] = useState("Regular");
  const [tab, setTab] = useState<"Details" | "Settings">("Details");
  const [tabDir, setTabDir] = useState<"" | "left" | "right">("");
  const switchTab = (t: "Details" | "Settings") => {
    if (t === tab) return;
    setTabDir(t === "Settings" ? "right" : "left");
    setTab(t);
  };
  const [f, setF] = useState<CustomerFormData>(() => (doc ? docToForm(doc) : emptyForm()));
  const [sameAsBilling, setSameAsBilling] = useState(!!f.sameAsBilling);
  const set = (k: keyof CustomerFormData, v: any) => setF((p) => ({ ...p, [k]: v }));

  const createMut = useMutation({
    mutationFn: (data: CustomerFormData) => createVendor(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: [VENDORS_LIST_KEY] });
      showToast("Vendor created", "success");
      onSaved(String(created._id));
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? "Failed to create vendor", "error"),
  });

  const updateMut = useMutation({
    mutationFn: (data: CustomerFormData) => updateVendor(doc!._id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: [VENDORS_LIST_KEY] });
      qc.invalidateQueries({ queryKey: ["vendor", doc!._id] });
      showToast("Vendor updated", "success");
      onSaved(String(updated._id ?? doc!._id));
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? "Failed to update vendor", "error"),
  });

  const isBusy = createMut.isPending || updateMut.isPending;

  const save = () => {
    const name = f.name.trim() || `${f.firstName} ${f.lastName}`.trim();
    if (!name) { showToast("Enter a company or contact name", "warning"); return; }
    const payload: CustomerFormData = { ...f, name, sameAsBilling };
    if (isCreate) createMut.mutate(payload);
    else updateMut.mutate(payload);
  };

  const shipVal = (k: "Street1" | "Street2" | "Zip" | "City" | "State" | "Country") =>
    sameAsBilling ? (f as any)[k.charAt(0).toLowerCase() + k.slice(1)] : (f as any)["ship" + k];

  return (
    <section className="module-detail-panel custom-scrollbar">
      <div className="module-title-bar">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={save} disabled={isBusy} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-60">
            {isBusy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-center gap-8 border-b border-gray-300">
        {(["Details", "Settings"] as const).map((t) => (
          <button key={t} onClick={() => switchTab(t)} className={`py-3 text-sm transition-colors border-b-2 -mb-px ${tab === t ? "text-gray-900 font-medium border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      <TabSlide tabKey={tab} dir={tabDir}>
      {tab === "Details" ? (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-6">
              <VField label="Company Name" value={f.name} onChange={(v) => set("name", v)} />
              <div className="grid grid-cols-2 gap-4">
                {show("Reg. No") && <VField label="Reg. No" value={f.regNo} onChange={(v) => set("regNo", v)} />}
                {show("GSTIN / VAT Number") && <VField label="GSTIN / VAT Number" value={f.taxId} onChange={(v) => set("taxId", v)} />}
              </div>
              {show("Taxpayer Type") && (
                <div className="relative fl-wrap">
                  <label className="fl-label">Taxpayer Type</label>
                  <select value={taxpayerType} onChange={(e) => setTaxpayerType(e.target.value)} className={fieldCls}>
                    {["Regular", "Composition", "Unregistered", "Consumer"].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {show("Business Phone") && <VField label="Business Phone" value={f.phone} onChange={(v) => set("phone", v)} />}
                {show("Fax") && <VField label="Fax" value={f.fax} onChange={(v) => set("fax", v)} />}
              </div>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <VField label="First Name" value={f.firstName} onChange={(v) => set("firstName", v)} />
                {show("Last Name") && <VField label="Last Name" value={f.lastName} onChange={(v) => set("lastName", v)} />}
              </div>
              {show("Email") && <VField label="Email" value={f.email} onChange={(v) => set("email", v)} type="email" />}
              <div className="grid grid-cols-2 gap-4">
                {show("Mobile") && <VField label="Mobile" value={f.mobile} onChange={(v) => set("mobile", v)} />}
                {show("Home Phone") && <VField label="Home Phone" value={f.homePhone} onChange={(v) => set("homePhone", v)} />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {show("Birthday") && <VField label="Birthday" value={f.birthday} onChange={(v) => set("birthday", v)} type="date" />}
                {show("Anniversary") && <VField label="Anniversary" value={f.anniversary} onChange={(v) => set("anniversary", v)} type="date" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-2">
            <div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">Address</span><span className="text-xs text-gray-400">Billing</span></div>
            {show("Entire Shipping Address") ? (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={sameAsBilling} onChange={() => setSameAsBilling((v) => !v)} className="accent-blue-600" /> Same as Billing</label>
                <span className="text-xs text-gray-400">Shipping</span>
              </div>
            ) : (
              <div />
            )}
            <div className="space-y-4">
              <VField label="Street 1" value={f.street1} onChange={(v) => set("street1", v)} />
              {show("Street 2") && <VField label="Street 2" value={f.street2} onChange={(v) => set("street2", v)} />}
              <div className="grid grid-cols-3 gap-3">
                {show("Zip Code") && <VField label="Zip Code" value={f.zip} onChange={(v) => set("zip", v)} />}
                {show("City") && <VField label="City" value={f.city} onChange={(v) => set("city", v)} />}
                {show("State") && <VField label="State" value={f.state} onChange={(v) => set("state", v)} />}
              </div>
              {show("Country") && <VField label="Country" value={f.country} onChange={(v) => set("country", v)} />}
            </div>
            {show("Entire Shipping Address") && (
              <div className={`space-y-4 ${sameAsBilling ? "opacity-60 pointer-events-none" : ""}`}>
                <VField label="Street 1" value={shipVal("Street1")} onChange={(v) => set("shipStreet1", v)} disabled={sameAsBilling} />
                {show("Street 2") && <VField label="Street 2" value={shipVal("Street2")} onChange={(v) => set("shipStreet2", v)} disabled={sameAsBilling} />}
                <div className="grid grid-cols-3 gap-3">
                  {show("Zip Code") && <VField label="Zip Code" value={shipVal("Zip")} onChange={(v) => set("shipZip", v)} disabled={sameAsBilling} />}
                  {show("City") && <VField label="City" value={shipVal("City")} onChange={(v) => set("shipCity", v)} disabled={sameAsBilling} />}
                  {show("State") && <VField label="State" value={shipVal("State")} onChange={(v) => set("shipState", v)} disabled={sameAsBilling} />}
                </div>
                {show("Country") && <VField label="Country" value={shipVal("Country")} onChange={(v) => set("shipCountry", v)} disabled={sameAsBilling} />}
              </div>
            )}
          </div>

          {show("Bank Details") && (
            <div className="pt-2">
              <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
              <div className="border border-gray-300 rounded-md overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
                  {[Bold, Italic, Underline].map((Ic, i) => <button key={i} type="button" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"><Ic className="w-4 h-4" /></button>)}
                  <span className="w-px h-5 bg-gray-300 mx-1" />
                  <button type="button" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200"><span className="w-4 h-4 rounded bg-gray-900 border border-gray-300" /></button>
                  <select className="ml-1 text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"><option>10</option><option>14</option><option>16</option><option>18</option><option>24</option></select>
                </div>
                <textarea value={f.bank} onChange={(e) => set("bank", e.target.value)} placeholder="Bank Details" className="w-full h-28 p-3 text-sm text-gray-800 outline-none resize-none" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 space-y-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-6">
            {show("Currency") && <VField label="Currency" value={f.currency} onChange={(v) => set("currency", v)} />}
            {show("Payment Terms (Sales)") && <VField label="Payment Terms (Purchases)" value={f.paymentTerms} onChange={(v) => set("paymentTerms", v)} />}
            {show("Opening Balance") && <VField label="Opening Balance" value={f.openingBalance} onChange={(v) => set("openingBalance", v)} />}
            {show("Opening Balance Date") && <VField label="Opening Balance Date" value={f.openingBalanceDate} onChange={(v) => set("openingBalanceDate", v)} type="date" />}
          </div>
          {show("Notes") && (
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes" rows={4} className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600 resize-y" />
          )}
          <div className="space-y-4 pt-2">
            {show("Payment Reminder") && (
              <div className="flex items-center justify-between max-w-sm"><span className="text-sm text-gray-700">Payment Reminder</span><Toggle on={f.paymentReminder} onChange={() => set("paymentReminder", !f.paymentReminder)} /></div>
            )}
            <div className="flex items-center justify-between max-w-sm"><span className="text-sm text-gray-700">Contact Login</span><Toggle on={!!f.isLoginRequired} onChange={() => set("isLoginRequired", !f.isLoginRequired)} /></div>
          </div>
        </div>
      )}
      </TabSlide>
    </section>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const Vendors: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const vendorSettings = useAppSettings("vendor");
  const showField = (key: string) => isVendorFieldVisible(vendorSettings?.fieldVisibility, key);
  const navSelectedId = (location.state as { selectedId?: string; openCreate?: boolean } | null)?.selectedId;
  const openCreateFromNav = !!(location.state as { openCreate?: boolean } | null)?.openCreate;

  const dbVendors = useCollection<any>("vendors", "name");
  const dbBills = useCollection<any>("bills");
  const dbExpenses = useCollection<any>("expenses");

  const [createMode, setCreateMode] = useState(openCreateFromNav);
  useEffect(() => {
    if (openCreateFromNav) {
      setCreateMode(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [openCreateFromNav, location.pathname, navigate]);

  const [selectedId, setSelectedId] = useState<string>(navSelectedId ?? "");
  useEffect(() => {
    if (navSelectedId) { setSelectedId(String(navSelectedId)); setEditMode(false); setCreateMode(false); }
  }, [navSelectedId]);

  const [tab, setTab] = useState<"Overview" | "Details" | "Settings">("Overview");
  const [sortBy, setSortBy] = useState("Created On");
  const [createdOn, setCreatedOn] = useState("All");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("Active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, sortBy, statusFilter, createdOn]);

  const createdOnRange = createdOnToRange(createdOn);
  const { data: backendVendors } = useQuery({
    queryKey: [VENDORS_LIST_KEY, page, search, sortBy, statusFilter, createdOn],
    queryFn: () => fetchVendors({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(sortBy === "Created On" ? "createdAt" : "name", "Descending"),
      isArchive: statusFilter === "Archived" || undefined,
      isDeleted: statusFilter === "Trash" || undefined,
      ...createdOnRange,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = backendVendors?.pagination;

  const vendors: VendorRow[] = useMemo(
    () => (backendVendors?.rows ?? []).map(mapListRow),
    [backendVendors?.rows],
  );

  useEffect(() => {
    if (!selectedId && vendors.length > 0) setSelectedId(vendors[0]._id);
  }, [vendors, selectedId]);

  const { data: selectedDoc } = useQuery<TBackendParty | null>({
    queryKey: ["vendor", selectedId, statusFilter],
    queryFn: () => (selectedId ? fetchVendor(selectedId) : null),
    enabled: !!selectedId,
    staleTime: 60_000,
  });

  const { data: paymentMethodOptions = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: vendorPaymentsData } = useQuery({
    queryKey: ["vendor-payments", selectedId],
    queryFn: () => fetchVendorPayments({ vendor_id: selectedId, page: 1, limit: 50, sort: "-payment_date" }),
    enabled: !!selectedId,
    staleTime: 30_000,
  });
  const venPayments = vendorPaymentsData?.rows ?? [];

  const [activityFilter, setActivityFilter] = useState("All");
  const [modal, setModal] = useState<null | "payment" | "statement" | "preview" | "settings">(null);
  const [statementConfig, setStatementConfig] = useState<StatementConfig | null>(null);
  const [selAction, setSelAction] = useState<null | "merge" | "mergeConfirm" | "archive" | "delete">(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [recordsType, setRecordsType] = useState<"Expenses" | "Bill" | "Payment Made">("Expenses");

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const selected = vendors.find((c) => c._id === selectedId) || vendors[0];
  const doc = selectedDoc ?? null;
  const listDue = vendors.reduce((s, c) => s + (c.amount < 0 ? -c.amount : 0), 0);

  // Optional Dexie link for local bills/expenses/activities (overview only)
  const linkedDexie = dbVendors.find((v) => String(v._id) === selectedId);
  const dexieVendorId = linkedDexie?.id as number | undefined;
  const venBills = dexieVendorId != null ? dbBills.filter((b) => b.vendorId === dexieVendorId) : [];
  const venExpenses = dexieVendorId != null ? dbExpenses.filter((x) => x.vendorId === dexieVendorId) : [];
  const venPayable = venBills.reduce((s, b) => s + (b.amountDue || 0), 0);
  const venTotal = venBills.reduce((s, b) => s + (b.total || 0), 0);
  const venPaid = venPayments.reduce((s, p) => s + (p.amount || 0), 0);

  const profile = doc?.businessProfile ?? {};
  const billing = profile.billing_address ?? {};
  const shipping = profile.shipping_address ?? {};
  const billingLine1 = [
    billing.address_line_1,
    showField("Street 2") ? billing.address_line_2 : null,
  ].filter(Boolean).join(", ");
  const billingLine2 = [
    showField("City") ? billing.city : null,
    showField("State") ? billing.state : null,
    showField("Country") ? billing.country : null,
    showField("Zip Code") ? billing.zip_code : null,
  ].filter(Boolean).join(", ");
  const shippingLine1 = [
    shipping.address_line_1,
    showField("Street 2") ? shipping.address_line_2 : null,
  ].filter(Boolean).join(", ");
  const shippingLine2 = [
    showField("City") ? shipping.city : null,
    showField("State") ? shipping.state : null,
    showField("Country") ? shipping.country : null,
    showField("Zip Code") ? shipping.zip_code : null,
  ].filter(Boolean).join(", ");

  const stmtTx = [
    ...venBills.map((b) => ({ ts: b.ts || 0, date: b.date, details: `Bill ${b.number}`, amount: b.total || 0, paid: 0 })),
    ...venPayments.map((p) => ({
      ts: p.paymentDateIso ? new Date(p.paymentDateIso).getTime() : 0,
      date: p.dateLabel,
      details: `Payment ${p.number}`,
      amount: 0,
      paid: p.amount || 0,
    })),
  ].sort((a, b) => a.ts - b.ts);
  let _bal = 0;
  const stmtRows = stmtTx.map((t) => { _bal += t.amount - t.paid; return { date: t.date, details: t.details, amount: money(t.amount), paid: money(t.paid), balance: money(_bal) }; });
  const stmtSummary = { amount: money(stmtTx.reduce((s, t) => s + t.amount, 0)), paid: money(stmtTx.reduce((s, t) => s + t.paid, 0)), balance: money(_bal) };

  /* ── Mutations ───────────────────────────────────────────────── */
  const invalidateList = () => qc.invalidateQueries({ queryKey: [VENDORS_LIST_KEY] });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveVendor(id),
    onSuccess: () => {
      invalidateList();
      showToast("Vendor archived", "success");
      setSelectedId(vendors.find((v) => v._id !== selectedId)?._id ?? "");
      setEditMode(false);
    },
    onError: () => showToast("Archive failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteVendor(id),
    onSuccess: () => {
      invalidateList();
      showToast("Vendor deleted", "success");
      setSelectedId(vendors.find((v) => v._id !== selectedId)?._id ?? "");
      setEditMode(false);
    },
    onError: () => showToast("Delete failed", "error"),
  });

  const bulkArchiveMut = useMutation({
    mutationFn: (ids: string[]) => archiveVendors(ids),
    onSuccess: (_, ids) => {
      invalidateList();
      showToast(`${ids.length} ${ids.length === 1 ? "vendor" : "vendors"} archived`, "success");
      if (ids.includes(selectedId)) setSelectedId(vendors.find((v) => !ids.includes(v._id))?._id ?? "");
      exitSelect();
      setSelAction(null);
    },
    onError: () => showToast("Archive failed", "error"),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => deleteVendors(ids),
    onSuccess: (_, ids) => {
      invalidateList();
      showToast(`${ids.length} ${ids.length === 1 ? "vendor" : "vendors"} deleted`, "success");
      if (ids.includes(selectedId)) setSelectedId(vendors.find((v) => !ids.includes(v._id))?._id ?? "");
      exitSelect();
      setSelAction(null);
    },
    onError: () => showToast("Delete failed", "error"),
  });

  const mergeMut = useMutation({
    mutationFn: ({ survivorId, mergedIds }: { survivorId: string; mergedIds: string[] }) =>
      mergeVendors(survivorId, mergedIds),
    onSuccess: (_, vars) => {
      invalidateList();
      setSelectedId(vars.survivorId);
      showToast("Vendors merged", "success");
      exitSelect();
      setSelAction(null);
    },
    onError: () => showToast("Merge failed", "error"),
  });

  const archiveSelectedOne = () => {
    if (!selected?._id) return;
    archiveMut.mutate(selected._id);
  };
  const removeSelected = () => {
    if (!selected?._id) return;
    deleteMut.mutate(selected._id);
  };

  const checkedIds = [...checked];
  const bulkMerge = (survivorId: string) => {
    const mergedIds = checkedIds.filter((id) => id !== survivorId);
    mergeMut.mutate({ survivorId, mergedIds });
  };

  const goToCustomer = (customerId: string) =>
    navigate("/sales/customers", { state: { selectedId: String(customerId) } });

  const buildDupForm = () => {
    const form = docToForm(doc!);
    form.name = `${form.name || "Contact"} (Copy)`.trim();
    form.email = "";
    form.isLoginRequired = false;
    return form;
  };

  const handleDuplicate = async (target: "customer" | "vendor" | "both") => {
    if (!doc) return;
    const form = buildDupForm();
    try {
      if (target === "vendor" || target === "both") {
        const created = await createVendor(form);
        invalidateList();
        setSelectedId(String(created._id));
        showToast("Vendor duplicated", "success");
        if (target === "vendor") return;
      }
      if (target === "customer" || target === "both") {
        const asCustomer = await createCustomer({ ...form });
        showToast(target === "both" ? "Also duplicated as customer" : "Duplicated as customer", "success");
        goToCustomer(asCustomer._id);
      }
    } catch (e: any) {
      showToast(e?.message || "Duplicate failed", "error");
    }
  };

  const allSelected = vendors.length > 0 && vendors.every((c) => checked.has(c._id));
  const selectedVendors = vendors.filter((c) => checked.has(c._id));
  const totals = {
    total: selectedVendors.reduce((s, c) => s + Math.abs(c.amount), 0),
    paid: 0,
    due: selectedVendors.reduce((s, c) => s + Math.abs(c.amount), 0),
  };
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(vendors.map((c) => c._id))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const tabs: ("Overview" | "Details" | "Settings")[] = ["Overview", "Details", "Settings"];
  const [tabDir, setTabDir] = useState<"" | "left" | "right">("");
  const switchTab = (t: (typeof tabs)[number]) => {
    if (t === tab) return;
    setTabDir(tabs.indexOf(t) > tabs.indexOf(tab) ? "right" : "left");
    setTab(t);
  };

  if (!selected && !createMode) {
    const hasActiveFilters = statusFilter !== "Active" || !!search.trim() || createdOn !== "All";
    if (hasActiveFilters) {
      return (
        <div className="module-workspace">
          <ResizableListPanel onCreate={() => { setCreateMode(true); setEditMode(false); }} createTitle="Create Vendor">
            <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">Vendors</h2>
            </div>
            <div className="px-3 py-2 border-b border-gray-300">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
              </div>
            </div>
            <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
              <Dropdown trigger={<span className={`inline-flex items-center gap-1 text-xs border border-dashed rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400 ${statusFilter === "Trash" ? "text-red-500 border-red-300" : "text-gray-600 border-gray-300"}`}><Plus className="w-3 h-3" />Status{statusFilter !== "Active" ? ` | ${statusFilter}` : ""}</span>}>
                {(close) => statusOptions.map((o) => (
                  <button key={o} onClick={() => { setStatusFilter(o); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${o === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{o} {o === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
                ))}
              </Dropdown>
            </div>
            <div className="flex-1 flex items-center justify-center px-6 text-center">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {statusFilter === "Trash" ? "No trashed vendors" : statusFilter === "Archived" ? "No archived vendors" : "No matching vendors"}
                </div>
                <div className="mt-1 text-xs text-gray-500">Try clearing filters to see active vendors.</div>
              </div>
            </div>
          </ResizableListPanel>
          <div className="flex-1" />
        </div>
      );
    }
    return (
      <div className="flex h-full bg-[#FAFBFC] items-center justify-center">
        <button onClick={() => setCreateMode(true)} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Vendor</button>
      </div>
    );
  }

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => { setCreateMode(true); setEditMode(false); }} createTitle="Create Vendor" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>
              {allSelected && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
            <div className="flex items-center gap-0.5">
              <button
                title="Merge"
                onClick={() => (checked.size < 2 ? showToast("Select at least two vendors to merge", "warning") : setSelAction("merge"))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              ><Merge className="w-4 h-4" /></button>
              <button
                title="Archive"
                onClick={() => (checked.size === 0 ? showToast("Select vendors to archive", "warning") : setSelAction("archive"))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              ><Archive className="w-4 h-4" /></button>
              <button
                title="Delete"
                onClick={() => (checked.size === 0 ? showToast("Select vendors to delete", "warning") : setSelAction("delete"))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
              ><Trash2 className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Vendors</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Vendors")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select vendors"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <button type="button" title="Settings" onClick={() => setModal("settings")} className="p-1.5 hover:bg-gray-100 rounded-md"><Settings className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("contacts"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("contacts"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => sortFields.map((o) => (
              <button key={o} onClick={() => { setSortBy(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <Dropdown trigger={<span className={`inline-flex items-center gap-1 text-xs border border-dashed rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400 ${statusFilter === "Trash" ? "text-red-500 border-red-300" : "text-gray-600 border-gray-300"}`}><Plus className="w-3 h-3" />Status{statusFilter !== "Active" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusOptions.map((o) => (
              <button key={o} onClick={() => { setStatusFilter(o); setSelectedId(""); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${o === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{o} {o === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Created On | {createdOn}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => createdOptions.map((o) => (
              <button key={o} onClick={() => { setCreatedOn(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === createdOn && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
          {vendors.map((c) => {
            const active = !selectMode && c._id === selectedId;
            const isChecked = checked.has(c._id);
            return (
              <button key={c._id} onClick={() => (selectMode ? toggleRow(c._id) : (setSelectedId(c._id), setEditMode(false), setCreateMode(false)))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-center gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                  {c.contact && <div className="text-xs text-gray-500 mt-0.5 truncate">{c.contact}</div>}
                </div>
                {c.amount > 0 && <span className="text-sm font-medium flex-shrink-0 text-gray-900">{money(c.amount)}</span>}
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter
          total={<>{money(listDue)} <span className="font-normal text-slate-500">Due</span></>}
          countLabel={`${listPagination?.totalData ?? vendors.length} Contacts`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} {checked.size === 1 ? "Contact" : "Contacts"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(totals.total)}</span>
              <span className="text-gray-500">Paid</span><span className="font-semibold text-green-500">{money(totals.paid)}</span>
              <span className="text-gray-500">Due</span><span className="font-semibold text-red-500">{money(totals.due)}</span>
            </div>
          </div>
        </section>
      ) : createMode ? (
        <VendorForm key="create" title="Create Vendor" doc={null} onClose={() => setCreateMode(false)} onSaved={(id) => { setSortBy("Created On"); setCreateMode(false); setSelectedId(id); }} />
      ) : editMode ? (
        doc ? (
          <VendorForm key={selectedId} title="Edit Vendor" doc={doc} onClose={() => setEditMode(false)} onSaved={(id) => { setSelectedId(id); setEditMode(false); }} />
        ) : (
          <section className="module-empty-panel">
            <div className="text-center px-6 text-sm text-gray-500">Loading vendor…</div>
          </section>
        )
      ) : selected ? (
        <section className="module-detail-panel custom-scrollbar">
          <div className="module-title-bar">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight truncate">{selected.name}</h1>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setEditMode(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => setModal("settings")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Settings"><Settings className="w-4 h-4" /></button>
              <button onClick={() => setModal("payment")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Add Payment"><DollarSign className="w-4 h-4" /></button>
              <button onClick={() => setModal("statement")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Statement"><FileText className="w-4 h-4" /></button>
              <Dropdown align="right" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="More"><MoreVertical className="w-4 h-4" /></span>}>
                {(close) => (
                  <DetailMoreMenu close={close} onArchive={archiveSelectedOne} onTrash={removeSelected} onDuplicate={handleDuplicate} />
                )}
              </Dropdown>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8 border-b border-gray-300">
            {tabs.map((t) => (
              <button key={t} onClick={() => switchTab(t)} className={`py-3 text-sm transition-colors border-b-2 -mb-px ${tab === t ? "text-gray-900 font-medium border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>{t}</button>
            ))}
          </div>

          <TabSlide tabKey={tab} dir={tabDir}>

          {tab === "Overview" && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-4 gap-4 divide-x divide-gray-200">
                {[
                  { label: "Payable Amount", value: money(-venPayable), color: "text-gray-900" },
                  { label: "Net Profit", value: money(venTotal - venPayable), color: "text-gray-900" },
                  { label: "Bills", value: money(venTotal), color: "text-gray-900" },
                  { label: "Payment Made", value: money(venPaid), color: "text-gray-900" },
                ].map((c) => (
                  <div key={c.label} className="text-center py-2">
                    <div className={`text-xs font-medium mb-1 ${c.label === "Payable Amount" ? "text-red-500" : "text-gray-500"}`}>{c.label}</div>
                    <div className={`text-lg font-semibold ${c.color}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3">
                  <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">{recordsType} <ChevronDown className="w-4 h-4 text-gray-500" /></span>}>
                    {(close) => (["Expenses", "Bill", "Payment Made"] as const).map((o) => (
                      <button key={o} onClick={() => { setRecordsType(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === recordsType && <Check className="w-4 h-4 text-blue-600" />}</button>
                    ))}
                  </Dropdown>
                </div>
                {(() => {
                  const rows =
                    recordsType === "Expenses"
                      ? venExpenses.map((x) => ({ id: `x${x.id}`, title: x.category || `Expense ${x.number}`, sub: x.date, right: money(x.amount || 0), status: "" }))
                      : recordsType === "Bill"
                        ? venBills.map((b) => ({ id: `b${b.id}`, title: `Bill ${b.number}`, sub: b.date, right: money(b.total || 0), status: b.status || "" }))
                        : venPayments.map((p) => ({ id: `p${p._id}`, title: `Payment ${p.number}`, sub: p.dateLabel, right: money(p.amount || 0), status: p.method || "" }));
                  return rows.length === 0 ? (
                    <div className="px-4 pb-10 pt-6 text-center text-sm text-gray-400">No Records</div>
                  ) : (
                    <div>
                      {rows.map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{r.sub}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-semibold text-gray-900">{r.right}</div>
                            {r.status && <div className="text-xs text-gray-500 mt-0.5">{r.status}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-medium text-gray-900">Recent Activities</h3>
                  <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600">{activityFilter} <ChevronDown className="w-3.5 h-3.5" /></span>}>
                    {(close) => activityFilters.map((o) => <button key={o} onClick={() => { setActivityFilter(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === activityFilter && <Check className="w-4 h-4 text-blue-600" />}</button>)}
                  </Dropdown>
                </div>
                <RecentActivities vendorId={dexieVendorId} filter={activityFilter} />
              </div>
            </div>
          )}

          {tab === "Details" && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                {[
                  ["Company", profile.companyName || selected.name],
                  showField("Reg. No") ? ["Reg. No", profile.registration_number || "—"] : null,
                  showField("GSTIN / VAT Number") ? ["GSTIN / VAT Number", profile.tax_number || "—"] : null,
                  showField("Business Phone") ? ["Business Phone", profile.business_phone || "—"] : null,
                  showField("Fax") ? ["Fax", profile.fax || "—"] : null,
                  ["First Name", (doc?.name ?? "").split(" ")[0] || "—"],
                  showField("Last Name") ? ["Last Name", (doc?.name ?? "").split(" ").slice(1).join(" ") || "—"] : null,
                  showField("Email") ? ["Email", doc?.email || "—"] : null,
                  showField("Mobile") ? ["Mobile Number", doc?.phone || "—"] : null,
                  showField("Home Phone") ? ["Home Phone", profile.home_phone || "—"] : null,
                  showField("Birthday") ? ["Birthday", profile.birthday ? String(profile.birthday).slice(0, 10) : "—"] : null,
                  showField("Anniversary") ? ["Anniversary", profile.anniversary ? String(profile.anniversary).slice(0, 10) : "—"] : null,
                ].filter(Boolean).map((pair) => {
                  const [k, v] = pair as [string, string];
                  return (
                    <div key={k}><div className="text-xs text-gray-500">{k}</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{v}</div></div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Billing Address</div>
                  <div className="text-sm text-gray-800 leading-relaxed">
                    {billingLine1 || billingLine2 ? (<>{billingLine1}{billingLine1 && billingLine2 && <br />}{billingLine2}</>) : "—"}
                  </div>
                </div>
                {showField("Entire Shipping Address") && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Shipping Address</div>
                    <div className="text-sm text-gray-800 leading-relaxed">
                      {shippingLine1 || shippingLine2 ? (<>{shippingLine1}{shippingLine1 && shippingLine2 && <br />}{shippingLine2}</>) : "—"}
                    </div>
                  </div>
                )}
              </div>
              {showField("Bank Details") && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
                  {profile.bank_details
                    ? <div className="text-sm text-gray-800 whitespace-pre-line [&_b]:font-bold" dangerouslySetInnerHTML={{ __html: profile.bank_details }} />
                    : <div className="text-sm text-gray-400">—</div>}
                </div>
              )}
            </div>
          )}

          {tab === "Settings" && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6 max-w-2xl">
                {showField("Currency") && (
                  <div><div className="text-xs text-gray-500">Currency</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{doc?.currency || "$ USD"}</div></div>
                )}
                {showField("Payment Terms (Sales)") && (
                  <div><div className="text-xs text-gray-500">Payment Terms (Purchases)</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{profile.payment_terms || "Default Company"}</div></div>
                )}
                {showField("Opening Balance") && (
                  <div><div className="text-xs text-gray-500">Opening Balance</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{profile.opening_balance != null ? money(Number(profile.opening_balance)) : "—"}</div></div>
                )}
                {showField("Opening Balance Date") && (
                  <div><div className="text-xs text-gray-500">Opening Balance Date</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{profile.opening_balance_date ? String(profile.opening_balance_date).slice(0, 10) : "—"}</div></div>
                )}
              </div>
              {showField("Notes") && profile.notes && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Notes</div>
                  <div className="text-sm text-gray-800">{profile.notes}</div>
                </div>
              )}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                {showField("Payment Reminder") && (
                  <div className="flex items-center justify-between max-w-sm">
                    <span className="text-sm text-gray-700">Payment Reminder</span>
                    <Toggle
                      on={profile.payment_reminder !== false}
                      onChange={() => {
                        if (!selected._id || !doc) return;
                        updateVendor(selected._id, { ...docToForm(doc), paymentReminder: !(profile.payment_reminder !== false) })
                          .then(() => qc.invalidateQueries({ queryKey: ["vendor", selected._id] }));
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between max-w-sm">
                  <span className="text-sm text-gray-700">Contact Login</span>
                  <Toggle
                    on={profile.is_login_required ?? false}
                    onChange={() => {
                      if (!selected._id || !doc) return;
                      updateVendor(selected._id, { ...docToForm(doc), isLoginRequired: !(profile.is_login_required ?? false) })
                        .then(() => qc.invalidateQueries({ queryKey: ["vendor", selected._id] }));
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          </TabSlide>
        </section>
      ) : (
        <section className="module-empty-panel">
          <div className="text-center px-6">
            <p className="text-sm text-gray-500">Select a vendor</p>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "payment" && selected && (
        <BillPaymentsModal
          open
          bill={null}
          vendorId={selected._id}
          vendorName={selected.name}
          paymentMethods={paymentMethodOptions}
          onClose={() => setModal(null)}
          onSaved={() => {
            invalidateList();
            qc.invalidateQueries({ queryKey: ["vendor-payments", selected._id] });
          }}
        />
      )}
      {modal === "statement" && selected && (
        <PartyStatementModal
          party="vendor"
          onClose={() => setModal(null)}
          onExport={(config) => {
            setStatementConfig(config);
            const grid = {
              name: `${selected.name} Statement`,
              cols: ["Date", "Details", "Amount", "Paid", "Balance"],
              rows: [
                ["—", "Opening Balance", "$0.00", "$0.00", "$0.00"],
                ...stmtRows.map((r) => [r.date, r.details, r.amount, r.paid, r.balance]),
                ["", "Total", stmtSummary.amount, stmtSummary.paid, stmtSummary.balance],
              ],
            };
            const fmt = config.exportFormat;
            try {
              if (fmt === "CSV") {
                exportReportCsv(grid);
                showToast("Statement exported as CSV", "success");
                setModal(null);
                return;
              }
              if (fmt === "XLS") {
                exportReportXlsx(grid, "xls");
                showToast("Statement exported as XLS", "success");
                setModal(null);
                return;
              }
              if (fmt === "XLSX" || fmt === "Excel") {
                exportReportXlsx(grid, "xlsx");
                showToast(`Statement exported as ${fmt}`, "success");
                setModal(null);
                return;
              }
              setModal("preview");
            } catch {
              showToast("Export failed", "error");
            }
          }}
        />
      )}
      {modal === "settings" && (
        <AppSettingsModal initialTab="Vendor" onClose={() => setModal(null)} />
      )}
      {modal === "preview" && selected && (
        <StatementPreview
          onClose={() => setModal(null)}
          name={selected.name}
          vendor={{ contact: selected.contact, email: doc?.email, phone: doc?.phone }}
          rows={stmtRows}
          summary={stmtSummary}
          onDownload={() => downloadDocPdf({
            filename: `${selected.name} Statement`,
            docTitle: "STATEMENT",
            partyLabel: "Statement To",
            partyLines: [selected.name, doc?.email, doc?.phone].filter(Boolean) as string[],
            meta: [
              ["Amount", stmtSummary.amount],
              ["Paid", stmtSummary.paid],
              ["Balance", stmtSummary.balance],
              ...(statementConfig?.dateFrom ? [["From", statementConfig.dateFrom] as [string, string]] : []),
              ...(statementConfig?.dateTo ? [["To", statementConfig.dateTo] as [string, string]] : []),
              ...(statementConfig?.dataType ? [["Type", statementConfig.dataType] as [string, string]] : []),
              ...(statementConfig?.status ? [["Status", statementConfig.status] as [string, string]] : []),
            ],
            itemHead: ["Date", "Details", "Amount", "Paid", "Balance"],
            itemRows: [["—", "Opening Balance", "$0.00", "$0.00", "$0.00"], ...stmtRows.map((r) => [r.date, r.details, r.amount, r.paid, r.balance]), ["", "Total", stmtSummary.amount, stmtSummary.paid, stmtSummary.balance]],
            note: statementConfig?.message
              ? { label: "Statement Message", value: statementConfig.message }
              : undefined,
          })}
        />
      )}
      {(selAction === "merge" || selAction === "mergeConfirm") && (
        <MergeVendorsModal
          vendors={vendors.filter((c) => checked.has(c._id))}
          onClose={() => { setSelAction(null); setMergeTargetId(null); }}
          onMerge={(id) => { setMergeTargetId(id); setSelAction("mergeConfirm"); }}
        />
      )}
      {selAction === "mergeConfirm" && mergeTargetId != null && (
        <ConfirmAlert
          message="Are you sure want to merge these vendors?"
          onNo={() => setSelAction("merge")}
          onYes={() => bulkMerge(mergeTargetId)}
        />
      )}
      {selAction === "archive" && (
        <ConfirmAlert message="Are you sure want to archive these vendors?" onNo={() => setSelAction(null)} onYes={() => bulkArchiveMut.mutate(checkedIds)} />
      )}
      {selAction === "delete" && (
        <ConfirmAlert message="Are you sure want to delete these vendors?" onNo={() => setSelAction(null)} onYes={() => bulkDeleteMut.mutate(checkedIds)} />
      )}
    </div>
  );
};

export default Vendors;
