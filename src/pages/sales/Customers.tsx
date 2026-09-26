/**
 * File: src/pages/sales/Customers.tsx
 * Customer page — master/detail layout.
 * Left: customer list (search, sort, filter chips, selection mode, pagination).
 * Right: detail with Overview / Details / Settings tabs + action icons
 *        (edit, Add Payment, Statement, more) and their modals.
 *
 * ✅ Fully connected to backend via /api/v1/customers (REST).
 * ✅ Server-side: searchTerm, sort, pagination, isArchive filter.
 * ✅ No local Dexie reads/writes for the customer entity.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { downloadDocPdf } from "@/lib/db";
import { exportReportCsv, exportReportXlsx } from "@/lib/reportExport";
import { useAppSettings, isCustomerFieldVisible } from "@/lib/db/appSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Archive,
  Copy,
  Mail,
  Eye,
  Upload,
  X,
  Download,
  Printer,
  MessageCircle,
  Sparkles,
  RotateCcw,
  Bold,
  Italic,
  Underline,
  SlidersHorizontal,
  Merge,
  Settings,
} from "lucide-react";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PartyStatementModal, type StatementConfig } from "@/components/modals/PartyStatementModal";
import { PdfDocPreview } from "@/lib/db/PdfDocPreview";
import { usePdfSettings, getPdfSettings } from "@/lib/db/pdfSettings";
import { TabSlide } from "@/components/ui/TabSlide";
import { RecentActivities } from "@/components/ui/RecentActivities";
import { showToast } from "@/utils/toast";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  fetchCustomers,
  fetchCustomer,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  archiveCustomers,
  deleteCustomer,
  deleteCustomers,
  permanentDeleteCustomer,
  permanentDeleteCustomers,
  restoreCustomer,
  restoreCustomers,
  mergeCustomers,
  backendToRow,
  uiSortToBackend,
  uiSortDirection,
  createdOnToRange,
  type CustomerFormData,
  type TCustomerRow,
} from "@/services/customersApi";
import type { TBackendParty } from "@/services/customerTypes";
import { buildListSortParam } from "@/lib/listSort";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { InvoicePaymentsModal } from "@/components/modals/InvoicePaymentsModal";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { createVendor } from "@/services/vendorsApi";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Constants ─────────────────────────────────────────────────────── */
const sortFields = ["Name", "First Name", "Last Name", "Created On", "Outstanding", "Total", "Due", "Paid"];
const createdOptions = ["All", "Today", "This Week", "This Month", "This Year"];
const statusOptions = ["Active", "Archived", "Trash"] as const;
type CustomerStatusFilter = (typeof statusOptions)[number];
const activityFilters = ["All", "Created", "Updated", "Archived", "Draft", "Sent", "Invoiced"];
const PAYMENT_TERMS = ["Default Company", "Net on receipt", "Net 7", "Net 10", "Net 15", "Net 30", "Net 60"];
const CURRENCIES = ["$ USD", "৳ BDT", "€ EUR", "£ GBP", "₹ INR"];
const PAGE_SIZE = LIST_PAGE_SIZE;

const chartData = [
  { name: "Jan '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Feb '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Mar '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Apr '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "May '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Jun '26", Sales: 0, Overdue: 0, Paid: 0 },
];

/* ── Helpers ───────────────────────────────────────────────────────── */
const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Convert full TBackendParty doc → UI form initial state */
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
    defaultTaxService: typeof p.default_tax_service_id === "object"
      ? `${(p.default_tax_service_id as any).name ?? ""} (${(p.default_tax_service_id as any).rate ?? ""}%)`
      : "None",
    defaultTaxProduct: typeof p.default_tax_product_id === "object"
      ? `${(p.default_tax_product_id as any).name ?? ""} (${(p.default_tax_product_id as any).rate ?? ""}%)`
      : "None",
    hourlyRate: p.hourly_rate != null ? String(p.hourly_rate) : "",
    paymentTerms: p.payment_terms ?? "Default Company",
    openingBalance: p.opening_balance != null ? String(p.opening_balance) : "",
    openingBalanceDate: p.opening_balance_date ? String(p.opening_balance_date).slice(0, 10) : "",
    notes: p.notes ?? "",
    paymentReminder: p.payment_reminder !== false,
    isLoginRequired: p.is_login_required ?? false,
  };
}

/* ── Detail "more" menu ────────────────────────────────────────────── */
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

/* ── Modal shell ───────────────────────────────────────────────────── */
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

/* ── Statement preview ─────────────────────────────────────────────── */
const StatementPreview: React.FC<{
  onClose: () => void;
  name: string;
  partyId: number;
  backendId?: string;
  onOpenSettings: () => void;
  onDownload?: () => void;
}> = ({ onClose, name, partyId, backendId, onOpenSettings, onDownload }) => {
  const settings = usePdfSettings("statement", "normal");
  const printRef = useRef<HTMLDivElement>(null);
  const print = () => {
    const html = printRef.current?.innerHTML || "";
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${name}'s Statement</title></head><body style="margin:0;background:#fff">${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.onafterprint = () => w.close(); }, 300);
  };
  const actions: { icon: React.ElementType; title: string; onClick?: () => void }[] = [
    { icon: SlidersHorizontal, title: "PDF settings", onClick: onOpenSettings },
    { icon: Download, title: "Download", onClick: onDownload },
    { icon: Printer, title: "Print", onClick: print },
    { icon: Mail, title: "Email" },
    { icon: MessageCircle, title: "WhatsApp" },
  ];
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
          <h3 className="text-base font-medium">{name}'s Statement</h3>
          <div className="flex items-center gap-1">
            {actions.map((a) => (
              <button key={a.title} onClick={a.onClick} title={a.title} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><a.icon className="w-4 h-4" /></button>
            ))}
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div ref={printRef} className="bg-gray-200">
          <PdfDocPreview
            docType="statement"
            mode="normal"
            settings={settings}
            partyId={partyId}
            backendId={backendId}
          />
        </div>
      </div>
    </Overlay>
  );
};

/* ── Merge Customers modal ─────────────────────────────────────────── */
const MergeCustomersModal: React.FC<{
  customers: { _id: string; name: string; contact: string }[];
  onClose: () => void;
  onMerge: (targetId: string) => void;
}> = ({ customers, onClose, onMerge }) => {
  const [targetId, setTargetId] = useState<string | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
          <h3 className="text-base font-semibold text-gray-900">Merge Customers</h3>
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
          {customers.map((c) => (
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
          Select the customer with which you wish to merge the rest of the customers
        </div>
      </div>
    </div>
  );
};

/* ── Toggle ────────────────────────────────────────────────────────── */
const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button onClick={onChange} className={`w-9 h-5 rounded-full transition-colors relative ${on ? "bg-blue-600" : "bg-gray-300"}`}>
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
  </button>
);

/* ── Date field (AppDatePicker) ───────────────────────────────────── */
const DateField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <AppDatePicker floatingLabel={label} value={value} onValueChange={onChange} />
);

/* ── Rich text editor ──────────────────────────────────────────────── */
const RichTextEditor: React.FC<{ value: string; onChange: (html: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState("#000000");
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const exec = (cmd: string, val?: string) => { ref.current?.focus(); document.execCommand(cmd, false, val); onChange(ref.current?.innerHTML || ""); };
  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-300 bg-gray-50">
        {([["bold", Bold], ["italic", Italic], ["underline", Underline]] as const).map(([cmd, Ic]) => (
          <button key={cmd} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"><Ic className="w-4 h-4" /></button>
        ))}
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <label className="relative w-6 h-6 rounded border border-gray-300 cursor-pointer" style={{ background: color }}>
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); exec("foreColor", e.target.value); }} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <select defaultValue="3" onChange={(e) => exec("fontSize", e.target.value)} className="ml-1 text-xs border border-gray-300 rounded px-1.5 py-1 bg-white">
          {[["1", "12"], ["2", "14"], ["3", "16"], ["4", "18"], ["5", "20"], ["6", "24"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML || "")}
        data-placeholder={placeholder}
        className="w-full min-h-28 p-3 text-sm text-gray-800 outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400"
      />
    </div>
  );
};

/* ── Edit Customer form ────────────────────────────────────────────── */
const editFieldCls = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600";
const EditField: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ReactNode }> = ({ label, value, onChange, placeholder, icon }) => (
  <div className="relative fl-wrap">
    <label className="fl-label">{label}</label>
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder && placeholder !== label ? placeholder : " "} className={editFieldCls} />
      {icon && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
    </div>
  </div>
);

const EditSelect: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <div className="relative fl-wrap">
    <label className="fl-label">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${editFieldCls} appearance-none pr-8`}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
  </div>
);

const EditCustomer: React.FC<{
  doc: TBackendParty | null;   // null = create mode
  onClose: () => void;
  onSaved: (row: TCustomerRow) => void;
}> = ({ doc, onClose, onSaved }) => {
  const qc = useQueryClient();
  const isCreate = doc === null;
  const customerSettings = useAppSettings("customer");
  const show = (key: string) => isCustomerFieldVisible(customerSettings?.fieldVisibility, key);
  const [tab, setTab] = useState<"Details" | "Settings">("Details");
  const [tabDir, setTabDir] = useState<"" | "left" | "right">("");
  const switchTab = (t: "Details" | "Settings") => {
    if (t === tab) return;
    setTabDir(t === "Settings" ? "right" : "left");
    setTab(t);
  };

  const [f, setF] = useState<CustomerFormData>(() => doc ? docToForm(doc) : {
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
  });

  const set = (k: keyof CustomerFormData, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [sameAsBilling, setSameAsBilling] = useState(f.sameAsBilling);
  const [emailEditing, setEmailEditing] = useState(!f.email);
  /** Settings-only field (no backend column) — still respect Field Visibility. */
  const [taxpayerType, setTaxpayerType] = useState("Regular");

  const ship = (k: "Street1" | "Street2" | "Zip" | "City" | "State" | "Country") =>
    sameAsBilling ? (f as any)[k.charAt(0).toLowerCase() + k.slice(1)] : (f as any)["ship" + k];

  const createMut = useMutation({
    mutationFn: (data: CustomerFormData) => createCustomer(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      showToast("Customer created", "success");
      onSaved(backendToRow(created));
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? "Failed to create customer", "error"),
  });

  const updateMut = useMutation({
    mutationFn: (data: CustomerFormData) => updateCustomer(doc!._id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", doc!._id] });
      showToast("Customer updated", "success");
      onSaved(backendToRow(updated));
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? "Failed to update customer", "error"),
  });

  const isBusy = createMut.isPending || updateMut.isPending;

  const save = () => {
    if (!f.name.trim()) { showToast("Company name is required", "warning"); return; }
    const payload: CustomerFormData = { ...f, sameAsBilling };
    if (isCreate) createMut.mutate(payload);
    else updateMut.mutate(payload);
  };

  const shipDisabled = sameAsBilling;
  const shipField = (label: string, key: "Street1" | "Street2" | "Zip" | "City" | "State" | "Country", placeholder?: string) => (
    <div className={`relative fl-wrap ${shipDisabled ? "opacity-60 pointer-events-none" : ""}`}>
      <label className="fl-label">{label}</label>
      <input value={ship(key)} onChange={(e) => set(("ship" + key) as any, e.target.value)} placeholder={placeholder && placeholder !== label ? placeholder : " "} className={editFieldCls} />
    </div>
  );

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300">
        <h1 className="text-lg font-semibold text-gray-900">{isCreate ? "Create Customer" : "Edit Customer"}</h1>
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
              <EditField label="Company Name" value={f.name} onChange={(v) => set("name", v)} />
              <div className="grid grid-cols-2 gap-4">
                {show("Reg. No") && <EditField label="Reg. No" value={f.regNo} onChange={(v) => set("regNo", v)} />}
                {show("GSTIN / VAT Number") && <EditField label="GSTIN / VAT Number" value={f.taxId} onChange={(v) => set("taxId", v)} />}
              </div>
              {show("Taxpayer Type") && (
                <EditSelect
                  label="Taxpayer Type"
                  value={taxpayerType}
                  options={["Regular", "Composition", "Unregistered", "Consumer"]}
                  onChange={setTaxpayerType}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                {show("Business Phone") && <EditField label="Business Phone" value={f.phone} onChange={(v) => set("phone", v)} />}
                {show("Fax") && <EditField label="Fax" value={f.fax} onChange={(v) => set("fax", v)} />}
              </div>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <EditField label="First Name" value={f.firstName} onChange={(v) => set("firstName", v)} />
                {show("Last Name") && <EditField label="Last Name" value={f.lastName} onChange={(v) => set("lastName", v)} />}
              </div>
              {show("Email") && (
                <div className="relative">
                  <label className="absolute -top-2 left-2 px-1 bg-white text-[11px] text-gray-500 z-10">Email</label>
                  {f.email && !emailEditing ? (
                    <div className={`${editFieldCls} flex items-center`}>
                      <span className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-300 rounded-full pl-3 pr-1.5 py-0.5 text-sm text-gray-800">
                        {f.email}
                        <button type="button" onClick={() => { set("email", ""); setEmailEditing(true); }} className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 text-white hover:bg-gray-500"><X className="w-3 h-3" /></button>
                      </span>
                    </div>
                  ) : (
                    <input
                      value={f.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={() => f.email.trim() && setEmailEditing(false)}
                      onKeyDown={(e) => e.key === "Enter" && f.email.trim() && setEmailEditing(false)}
                      placeholder="Email"
                      className={editFieldCls}
                    />
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {show("Mobile") && <EditField label="Mobile" value={f.mobile} onChange={(v) => set("mobile", v)} />}
                {show("Home Phone") && <EditField label="Home Phone" value={f.homePhone} onChange={(v) => set("homePhone", v)} />}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {show("Birthday") && <DateField label="Birthday" value={f.birthday} onChange={(v) => set("birthday", v)} />}
                {show("Anniversary") && <DateField label="Anniversary" value={f.anniversary} onChange={(v) => set("anniversary", v)} />}
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
              <EditField label="Street 1" value={f.street1} onChange={(v) => set("street1", v)} />
              {show("Street 2") && <EditField label="Street 2" value={f.street2} onChange={(v) => set("street2", v)} placeholder="Street 2" />}
              <div className="grid grid-cols-3 gap-3">
                {show("Zip Code") && <EditField label="Zip Code" value={f.zip} onChange={(v) => set("zip", v)} />}
                {show("City") && <EditField label="City" value={f.city} onChange={(v) => set("city", v)} />}
                {show("State") && <EditField label="State" value={f.state} onChange={(v) => set("state", v)} placeholder="State" />}
              </div>
              {show("Country") && <EditField label="Country" value={f.country} onChange={(v) => set("country", v)} />}
            </div>
            {show("Entire Shipping Address") && (
              <div className="space-y-4">
                {shipField("Street 1", "Street1")}
                {show("Street 2") && shipField("Street 2", "Street2")}
                <div className="grid grid-cols-3 gap-3">
                  {show("Zip Code") && shipField("Zip Code", "Zip")}
                  {show("City") && shipField("City", "City")}
                  {show("State") && shipField("State", "State")}
                </div>
                {show("Country") && shipField("Country", "Country")}
              </div>
            )}
          </div>

          {show("Bank Details") && (
            <div className="pt-2">
              <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
              <RichTextEditor value={f.bank} onChange={(html) => set("bank", html)} placeholder="Bank Details" />
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {show("Currency") && <EditSelect label="Currency" value={f.currency} options={CURRENCIES} onChange={(v) => set("currency", v)} />}
            {show("Default Taxes (Services)") && <EditField label="Default Taxes (Services)" value={f.defaultTaxService} onChange={(v) => set("defaultTaxService", v)} />}
            {show("Default Taxes (Product)") && <EditField label="Default Taxes (Product)" value={f.defaultTaxProduct} onChange={(v) => set("defaultTaxProduct", v)} />}
            {show("Hourly Rate") && <EditField label="Hourly Rate" value={f.hourlyRate} onChange={(v) => set("hourlyRate", v)} placeholder="Hourly Rate" />}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {show("Payment Terms (Sales)") && (
              <div className="lg:col-span-2">
                <EditSelect label="Payment Terms (Sales)" value={f.paymentTerms} options={PAYMENT_TERMS} onChange={(v) => set("paymentTerms", v)} />
              </div>
            )}
            {show("Opening Balance") && <EditField label="Opening Balance" value={f.openingBalance} onChange={(v) => set("openingBalance", v)} placeholder="Opening Balance" />}
            {show("Opening Balance Date") && <DateField label="Opening Balance Date" value={f.openingBalanceDate} onChange={(v) => set("openingBalanceDate", v)} />}
          </div>
          {show("Notes") && (
            <div>
              <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Notes" rows={5} className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600 resize-y" />
            </div>
          )}
          {show("Payment Reminder") && (
            <div className="flex items-center gap-6">
              <span className="text-sm font-semibold text-gray-900">Payment Reminder</span>
              <Toggle on={f.paymentReminder} onChange={() => set("paymentReminder", !f.paymentReminder)} />
            </div>
          )}
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-gray-900">Contact Login</span>
            <Toggle on={!!f.isLoginRequired} onChange={() => set("isLoginRequired", !f.isLoginRequired)} />
          </div>
        </div>
      )}
      </TabSlide>
    </section>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export const Customers: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const customerSettings = useAppSettings("customer");
  const showField = (key: string) => isCustomerFieldVisible(customerSettings?.fieldVisibility, key);
  const navSelectedId = (location.state as { selectedId?: string; openCreate?: boolean } | null)?.selectedId;
  const openCreateFromNav = !!(location.state as { openCreate?: boolean } | null)?.openCreate;

  /* ── Server-side query params ───────────────────── */
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("Created On");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("Active");
  const [createdOn, setCreatedOn] = useState("All");
  const [activityFilter, setActivityFilter] = useState("All");

  // Debounced search input → only fire after user stops typing
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ── List query ─────────────────────────────────── */
  const dateRange = createdOnToRange(createdOn);
  const { data: listData, isLoading, isFetching } = useQuery({
    queryKey: ["customers", page, searchTerm, sortBy, statusFilter, createdOn],
    queryFn: () => fetchCustomers({
      page,
      limit: PAGE_SIZE,
      searchTerm: searchTerm || undefined,
      sort: buildListSortParam(uiSortToBackend(sortBy), uiSortDirection(sortBy)),
      isArchive: statusFilter === "Archived" || undefined,
      isDeleted: statusFilter === "Trash" || undefined,
      ...dateRange,
    }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const rows: TCustomerRow[] = listData?.rows ?? [];
  const pagination = listData?.pagination;

  /* ── Selected customer & detail ─────────────────── */
  const [selectedId, setSelectedId] = useState<string>("");
  const [createMode, setCreateMode] = useState(openCreateFromNav);
  useEffect(() => {
    if (openCreateFromNav) {
      setCreateMode(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [openCreateFromNav, location.pathname, navigate]);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<"Overview" | "Details" | "Settings">("Overview");
  const [modal, setModal] = useState<null | "payment" | "statement" | "preview" | "pdfSettings" | "settings">(null);
  const [statementConfig, setStatementConfig] = useState<StatementConfig | null>(null);
  const [selAction, setSelAction] = useState<null | "merge" | "mergeConfirm" | "archive" | "delete">(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tabDir, setTabDir] = useState<"" | "left" | "right">("");

  const { data: paymentMethodOptions = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  // Select first row on initial load
  useEffect(() => {
    if (!selectedId && rows.length > 0) setSelectedId(rows[0]._id);
  }, [rows, selectedId]);

  // Navigation-driven pre-selection
  useEffect(() => {
    if (navSelectedId) { setSelectedId(navSelectedId); setEditMode(false); setCreateMode(false); }
  }, [navSelectedId]);

  /* ── Fetch single (full detail doc) when selected ── */
  const { data: selectedDoc, isFetching: detailLoading } = useQuery<TBackendParty | null>({
    queryKey: ["customer", selectedId, statusFilter],
    queryFn: () => (selectedId ? fetchCustomer(selectedId) : null),
    enabled: !!selectedId,
    staleTime: 60_000,
  });

  const selected = rows.find((r) => r._id === selectedId) ?? rows[0];
  const doc = selectedDoc ?? null;

  /* ── Tab switch ─────────────────────────────────── */
  const tabs: ("Overview" | "Details" | "Settings")[] = ["Overview", "Details", "Settings"];
  const switchTab = (t: (typeof tabs)[number]) => {
    if (t === tab) return;
    setTabDir(tabs.indexOf(t) > tabs.indexOf(tab) ? "right" : "left");
    setTab(t);
  };

  /* ── Mutations ──────────────────────────────────── */
  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveCustomer(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelectedId((cur) => (cur === id ? "" : cur));
      setEditMode(false);
      showToast("Customer archived", "success");
    },
    onError: () => showToast("Archive failed", "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      statusFilter === "Trash" ? permanentDeleteCustomer(id) : deleteCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelectedId(rows.find((r) => r._id !== selectedId)?._id ?? "");
      showToast(
        statusFilter === "Trash" ? "Customer permanently deleted" : "Customer deleted",
        "success",
      );
    },
    onError: () => showToast("Delete failed", "error"),
  });

  const bulkArchiveMut = useMutation({
    mutationFn: (ids: string[]) => archiveCustomers(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      showToast(`${checked.size} customer(s) archived`, "success");
      exitSelect(); setSelAction(null);
    },
    onError: () => showToast("Archive failed", "error"),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      statusFilter === "Trash" ? permanentDeleteCustomers(ids) : deleteCustomers(ids),
    onSuccess: () => {
      const count = checked.size;
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelectedId("");
      showToast(
        statusFilter === "Trash"
          ? `${count} customer(s) permanently deleted`
          : `${count} customer(s) deleted`,
        "success",
      );
      exitSelect(); setSelAction(null);
    },
    onError: () => showToast("Delete failed", "error"),
  });

  const restoreMut = useMutation({
    mutationFn: (ids: string[]) => restoreCustomers(ids),
    onSuccess: () => {
      const count = checked.size || 1;
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelectedId("");
      showToast(`${count} customer(s) restored`, "success");
      exitSelect(); setSelAction(null);
    },
    onError: () => showToast("Restore failed", "error"),
  });

  const mergeMut = useMutation({
    mutationFn: ({ survivorId, mergedIds }: { survivorId: string; mergedIds: string[] }) =>
      mergeCustomers(survivorId, mergedIds),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelectedId(vars.survivorId);
      showToast("Customers merged", "success");
      exitSelect(); setSelAction(null);
    },
    onError: () => showToast("Merge failed", "error"),
  });

  /* ── Selection helpers ──────────────────────────── */
  const allSelected = rows.length > 0 && rows.every((r) => checked.has(r._id));
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(rows.map((r) => r._id))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const checkedIds = [...checked];
  const selectedCustomers = rows.filter((r) => checked.has(r._id));
  const totals = {
    total: selectedCustomers.reduce((s, c) => s + Math.abs(c.amount), 0),
    paid: selectedCustomers.filter((c) => c.amount >= 0).reduce((s, c) => s + c.amount, 0),
    due: selectedCustomers.filter((c) => c.amount < 0).reduce((s, c) => s + Math.abs(c.amount), 0),
  };

  const listDue = rows.reduce((s, c) => s + (c.amount < 0 ? Math.abs(c.amount) : 0), 0);

  /* ── Archive / Delete single ───────────────────── */
  const archiveSelectedOne = () => {
    if (!selected?._id) return;
    archiveMut.mutate(selected._id);
  };
  const removeSelected = () => {
    if (!selected?._id) return;
    deleteMut.mutate(selected._id);
  };

  /* ── Bulk merge ─────────────────────────────────── */
  const bulkMerge = (survivorId: string) => {
    const mergedIds = checkedIds.filter((id) => id !== survivorId);
    mergeMut.mutate({ survivorId, mergedIds });
  };

  /* ── Duplicate — login off + email cleared so unique-index / password rules never block copies ── */
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
      if (target === "customer" || target === "both") {
        const created = await createCustomer(form);
        qc.invalidateQueries({ queryKey: ["customers"] });
        setSelectedId(created._id);
        showToast("Customer duplicated", "success");
        if (target === "customer") return;
      }
      if (target === "vendor" || target === "both") {
        const asVendor = await createVendor({ ...form });
        showToast(target === "both" ? "Also duplicated as vendor" : "Duplicated as vendor", "success");
        navigate("/purchase/vendors", { state: { selectedId: asVendor._id } });
      }
    } catch (e: any) {
      showToast(e?.message || "Duplicate failed", "error");
    }
  };

  /* ── Empty state: only when there are truly no active customers (no filters) ── */
  const hasActiveFilters =
    statusFilter !== "Active" ||
    createdOn !== "All" ||
    !!searchTerm.trim();
  if (!isLoading && rows.length === 0 && !createMode && !hasActiveFilters) {
    return <ListEmptyState title="No customers yet" onCreate={() => { setCreateMode(true); setSelectMode(false); }} createLabel="New Customer" />;
  }

  const emptyFilterLabel =
    statusFilter === "Archived"
      ? "No archived customers"
      : statusFilter === "Trash"
        ? "No customers in trash"
        : searchTerm.trim()
          ? "No customers match your search"
          : createdOn !== "All"
            ? "No customers in this date range"
            : "No customers";

  /* ── Profile fields from detail doc ─────────────── */
  const profile = doc?.businessProfile ?? {};
  const billing = profile.billing_address ?? {};
  const shipping = profile.shipping_address ?? {};
  const billingLines = [
    billing.address_line_1,
    showField("Street 2") ? billing.address_line_2 : null,
    [showField("City") ? billing.city : null, showField("Zip Code") ? billing.zip_code : null].filter(Boolean).join(" ") || null,
    showField("State") ? billing.state : null,
    showField("Country") ? billing.country : null,
  ].filter(Boolean);
  const shippingLines = [
    shipping.address_line_1,
    showField("Street 2") ? shipping.address_line_2 : null,
    [showField("City") ? shipping.city : null, showField("Zip Code") ? shipping.zip_code : null].filter(Boolean).join(" ") || null,
    showField("State") ? shipping.state : null,
    showField("Country") ? shipping.country : null,
  ].filter(Boolean);

  const stmtSummary = { amount: money(0), paid: money(0), balance: money(0) };

  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => { setCreateMode(true); setSelectMode(false); }} createTitle="Create Customer" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>
              {allSelected && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
            <div className="flex items-center gap-0.5">
              {statusFilter !== "Trash" && (
                <button title="Merge" onClick={() => (checked.size < 2 ? showToast("Select at least two customers to merge", "warning") : setSelAction("merge"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Merge className="w-4 h-4" /></button>
              )}
              {statusFilter === "Trash" ? (
                <button title="Restore" onClick={() => (checked.size === 0 ? showToast("Select customers to restore", "warning") : restoreMut.mutate(checkedIds))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
              ) : (
                <button title="Archive" onClick={() => (checked.size === 0 ? showToast("Select customers to archive", "warning") : setSelAction("archive"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Archive className="w-4 h-4" /></button>
              )}
              <button title={statusFilter === "Trash" ? "Delete permanently" : "Delete"} onClick={() => (checked.size === 0 ? showToast("Select customers to delete", "warning") : setSelAction("delete"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Customers</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Customers")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select customers"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <button type="button" title="Settings" onClick={() => setModal("settings")} className="p-1.5 hover:bg-gray-100 rounded-md"><Settings className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("contacts"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("contacts"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search customers..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* toolbar */}
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => sortFields.map((o) => (
              <button key={o} onClick={() => { setSortBy(o); setPage(1); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <Dropdown trigger={<span className={`inline-flex items-center gap-1 text-xs border border-dashed rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400 ${statusFilter === "Trash" ? "text-red-500 border-red-300" : "text-gray-600 border-gray-300"}`}><Plus className="w-3 h-3" />Status{statusFilter !== "Active" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusOptions.map((o) => (
              <button
                key={o}
                onClick={() => { setStatusFilter(o); setPage(1); setSelectedId(""); close(); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${o === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}
              >
                {o} {o === statusFilter && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </Dropdown>
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Created On | {createdOn}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => createdOptions.map((o) => (
              <button key={o} onClick={() => { setCreatedOn(o); setPage(1); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === createdOn && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* rows */}
        <div className="flex-1 overflow-y-auto hover-scrollbar relative">
          {(isLoading || isFetching) && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-500 animate-pulse" />
          )}
          {!isLoading && rows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-500">{emptyFilterLabel}</div>
          )}
          {rows.map((c) => {
            const active = !selectMode && c._id === selectedId;
            const isChecked = checked.has(c._id);
            return (
              <button key={c._id} onClick={() => (selectMode ? toggleRow(c._id) : (setSelectedId(c._id), setEditMode(false)))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-center gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{c.contact}</div>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ${c.amount < 0 ? "text-red-500" : "text-gray-900"}`}>{money(c.amount)}</span>
              </button>
            );
          })}
        </div>

        <ListSidebarFooter
          total={<>{money(listDue)} <span className="font-normal text-slate-500">Due</span></>}
          countLabel={`${pagination?.totalData ?? rows.length} Contacts`}
          pagination={pagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {selectMode ? (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm">
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
        <EditCustomer
          key="create"
          doc={null}
          onClose={() => setCreateMode(false)}
          onSaved={(row) => { setStatusFilter("Active"); setSortBy("Created On"); setPage(1); setSelectedId(row._id); }}
        />
      ) : editMode && doc ? (
        <EditCustomer
          key={selectedId}
          doc={doc}
          onClose={() => setEditMode(false)}
          onSaved={(row) => setSelectedId(row._id)}
        />
      ) : selected ? (
        <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
          {/* detail header */}
          <div className="h-12 flex items-center justify-between px-6 border-b border-gray-300 bg-gray-100">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight truncate">{selected.name}</h1>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  if (!doc) {
                    if (detailLoading) showToast("Loading customer…", "info");
                    else showToast("Customer details unavailable", "warning");
                    return;
                  }
                  setEditMode(true);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setModal("settings")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Settings"><Settings className="w-4 h-4" /></button>
              <button onClick={() => setModal("payment")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Add Payment"><DollarSign className="w-4 h-4" /></button>
              <button onClick={() => setModal("statement")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Statement"><FileText className="w-4 h-4" /></button>
              <Dropdown align="right" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><MoreVertical className="w-4 h-4" /></span>}>
                {(close) => (
                  <DetailMoreMenu close={close} onArchive={archiveSelectedOne} onTrash={removeSelected} onDuplicate={handleDuplicate} />
                )}
              </Dropdown>
            </div>
          </div>

          {/* tabs */}
          <div className="flex items-center justify-center gap-8 border-b border-gray-300">
            {tabs.map((t) => (
              <button key={t} onClick={() => switchTab(t)} className={`py-3 text-sm transition-colors border-b-2 -mb-px ${tab === t ? "text-gray-900 font-medium border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}>{t}</button>
            ))}
          </div>

          <TabSlide tabKey={tab} dir={tabDir}>

          {/* ── Overview ── */}
          {tab === "Overview" && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Outstanding", value: money(selected.amount < 0 ? Math.abs(selected.amount) : 0), color: "text-red-500" },
                  { label: "Net Profit", value: money(0), color: "text-gray-900" },
                  { label: "Sales", value: money(0), color: "text-gray-900" },
                ].map((c) => (
                  <div key={c.label} className="text-center py-2">
                    <div className={`text-xs font-medium mb-1 ${c.label === "Outstanding" ? "text-red-500" : "text-gray-500"}`}>{c.label}</div>
                    <div className={`text-lg font-semibold ${c.color}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-900">Sales</span>
                  <div className="flex items-center gap-4">
                    {[{ c: "#007aff", l: "Sales" }, { c: "#ff3b30", l: "Overdue" }, { c: "#34a853", l: "Paid" }].map((x) => (
                      <span key={x.l} className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-3 h-3 rounded-[3px]" style={{ background: x.c }} />{x.l}</span>
                    ))}
                    <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600">Months <ChevronDown className="w-3.5 h-3.5" /></span>}>
                      {(close) => ["Days", "Weeks", "Months", "Years"].map((o) => <button key={o} onClick={close} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o}</button>)}
                    </Dropdown>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--color-gray-500)", fontSize: 11 }} axisLine={{ stroke: "var(--color-gray-200)" }} tickLine={false} />
                    <YAxis tick={{ fill: "var(--color-gray-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "var(--color-gray-100)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--color-gray-200)", borderRadius: 8, color: "var(--color-gray-900)" }} />
                    <Bar dataKey="Sales" fill="#007aff" barSize={36} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Overdue" fill="#ff3b30" barSize={36} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Paid" fill="#34a853" barSize={36} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-medium text-gray-900">Recent Activities</h3>
                  <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600">{activityFilter} <ChevronDown className="w-3.5 h-3.5" /></span>}>
                    {(close) => activityFilters.map((o) => <button key={o} onClick={() => { setActivityFilter(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === activityFilter && <Check className="w-4 h-4 text-blue-600" />}</button>)}
                  </Dropdown>
                </div>
                <RecentActivities customerId={selected.id} filter={activityFilter} />
              </div>
            </div>
          )}

          {/* ── Details ── */}
          {tab === "Details" && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  ["Company", profile.companyName || selected.name],
                  showField("Reg. No") ? ["Reg. No", profile.registration_number || "—"] : null,
                  showField("GSTIN / VAT Number") ? ["GSTIN / VAT Number", profile.tax_number || "—"] : null,
                  showField("Business Phone") ? ["Business Phone", profile.business_phone || "—"] : null,
                  showField("Fax") ? ["Fax", profile.fax || "—"] : null,
                  showField("Email") ? ["Email", doc?.email || "—"] : null,
                  ["First Name", (doc?.name ?? "").split(" ")[0] || "—"],
                  showField("Last Name") ? ["Last Name", (doc?.name ?? "").split(" ").slice(1).join(" ") || "—"] : null,
                  showField("Mobile") ? ["Mobile Number", doc?.phone || "—"] : null,
                  showField("Home Phone") ? ["Home Phone", profile.home_phone || "—"] : null,
                  showField("Birthday") ? ["Birthday", profile.birthday ? String(profile.birthday).slice(0, 10) : "—"] : null,
                  showField("Anniversary") ? ["Anniversary", profile.anniversary ? String(profile.anniversary).slice(0, 10) : "—"] : null,
                ].filter(Boolean).map((pair) => {
                  const [k, v] = pair as [string, string];
                  return (
                    <div key={k}><div className="text-xs text-gray-500">{k}</div><div className="text-sm font-semibold text-gray-900 mt-0.5 break-words">{v}</div></div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Billing Address</div>
                  <div className="text-sm text-gray-800 leading-relaxed">{billingLines.length ? billingLines.map((l, i) => <div key={i}>{l}</div>) : "—"}</div>
                </div>
                {showField("Entire Shipping Address") && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Shipping Address</div>
                    <div className="text-sm text-gray-800 leading-relaxed">{shippingLines.length ? shippingLines.map((l, i) => <div key={i}>{l}</div>) : "—"}</div>
                  </div>
                )}
              </div>
              {showField("Bank Details") && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
                  {profile.bank_details
                    ? <div className="text-sm text-gray-800 leading-relaxed [&_b]:font-bold" dangerouslySetInnerHTML={{ __html: profile.bank_details }} />
                    : <div className="text-sm text-gray-400">—</div>}
                </div>
              )}
            </div>
          )}

          {/* ── Settings ── */}
          {tab === "Settings" && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  showField("Currency") ? ["Currency", doc?.currency || "$ USD"] : null,
                  showField("Default Taxes (Services)") ? ["Default Taxes (Services)", typeof profile.default_tax_service_id === "object" ? (profile.default_tax_service_id as any)?.name ?? "None" : "None"] : null,
                  showField("Default Taxes (Product)") ? ["Default Taxes (Product)", typeof profile.default_tax_product_id === "object" ? (profile.default_tax_product_id as any)?.name ?? "None" : "None"] : null,
                  showField("Hourly Rate") ? ["Hourly Rate", profile.hourly_rate ? money(profile.hourly_rate) : "—"] : null,
                  showField("Payment Terms (Sales)") ? ["Payment Terms (Sales)", profile.payment_terms || "Default Company"] : null,
                  showField("Opening Balance") ? ["Opening Balance", profile.opening_balance ? money(profile.opening_balance) : "—"] : null,
                  showField("Opening Balance Date") ? ["Opening Balance Date", profile.opening_balance_date ? String(profile.opening_balance_date).slice(0, 10) : "—"] : null,
                ].filter(Boolean).map((pair) => {
                  const [k, v] = pair as [string, string];
                  return (
                    <div key={k}><div className="text-xs text-gray-500">{k}</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{v}</div></div>
                  );
                })}
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
                          if (!selected._id) return;
                          updateCustomer(selected._id, { ...docToForm(doc!), paymentReminder: !(profile.payment_reminder !== false) })
                            .then(() => qc.invalidateQueries({ queryKey: ["customer", selected._id] }));
                        }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between max-w-sm">
                    <span className="text-sm text-gray-700">Contact Login</span>
                    <Toggle
                      on={profile.is_login_required ?? false}
                      onChange={() => {
                        if (!selected._id) return;
                        updateCustomer(selected._id, { ...docToForm(doc!), isLoginRequired: !(profile.is_login_required ?? false) })
                          .then(() => qc.invalidateQueries({ queryKey: ["customer", selected._id] }));
                      }}
                    />
                  </div>
                </div>
            </div>
          )}
          </TabSlide>
        </section>
      ) : (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm">
          <div className="text-center px-6">
            <p className="text-sm text-gray-500">{isLoading ? "Loading…" : emptyFilterLabel}</p>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "payment" && selected && (
        <InvoicePaymentsModal
          open
          invoice={null}
          customerId={selected._id}
          customerName={selected.name}
          paymentMethods={paymentMethodOptions}
          onClose={() => setModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["customers"] });
          }}
        />
      )}
      {modal === "statement" && selected && (
        <PartyStatementModal
          party="customer"
          onClose={() => setModal(null)}
          onExport={async (config) => {
            setStatementConfig(config);
            const grid = {
              name: `${selected.name} Statement`,
              cols: ["Date", "Details", "Amount", "Paid", "Balance"],
              rows: [
                ["—", "Opening Balance", "$0.00", "$0.00", "$0.00"],
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
              // PDF → preview
              setModal("preview");
            } catch {
              showToast("Export failed", "error");
            }
          }}
        />
      )}
      {modal === "preview" && selected && (
        <StatementPreview
          onClose={() => setModal(null)}
          name={selected.name}
          partyId={selected.id}
          backendId={selected._id ? String(selected._id) : undefined}
          onOpenSettings={() => setModal("pdfSettings")}
          onDownload={async () => downloadDocPdf({
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
            itemRows: [["—", "Opening Balance", "$0.00", "$0.00", "$0.00"]],
            note: statementConfig?.message
              ? {
                  label: statementConfig.messagePlacement === "top" ? "Statement Message" : "Statement Message",
                  value: statementConfig.message,
                }
              : undefined,
            settings: await getPdfSettings("statement", "normal"),
          })}
        />
      )}
      {modal === "pdfSettings" && selected && (
        <PdfPrintSettingsModal onClose={() => setModal("preview")} initialDocType="statement" partyId={selected.id} />
      )}
      {modal === "settings" && (
        <AppSettingsModal initialTab="Customer" onClose={() => setModal(null)} />
      )}
      {(selAction === "merge" || selAction === "mergeConfirm") && (
        <MergeCustomersModal
          customers={rows.filter((r) => checked.has(r._id))}
          onClose={() => { setSelAction(null); setMergeTargetId(null); }}
          onMerge={(id) => { setMergeTargetId(id); setSelAction("mergeConfirm"); }}
        />
      )}
      {selAction === "mergeConfirm" && mergeTargetId != null && (
        <ConfirmAlert
          message="Are you sure want to merge these customers?"
          onNo={() => setSelAction("merge")}
          onYes={() => bulkMerge(mergeTargetId)}
        />
      )}
      {selAction === "archive" && (
        <ConfirmAlert message="Are you sure want to archive these customers?" onNo={() => setSelAction(null)} onYes={() => bulkArchiveMut.mutate(checkedIds)} />
      )}
      {selAction === "delete" && (
        <ConfirmAlert
          message={
            statusFilter === "Trash"
              ? "Permanently delete these customers? This cannot be undone."
              : "Are you sure want to delete these customers?"
          }
          onNo={() => setSelAction(null)}
          onYes={() => bulkDeleteMut.mutate(checkedIds)}
        />
      )}
    </div>
  );
};

export default Customers;
