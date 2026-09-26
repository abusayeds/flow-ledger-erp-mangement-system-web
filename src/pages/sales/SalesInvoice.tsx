/**
 * File: src/pages/sales/SalesInvoice.tsx
 * Sales Invoice — master/detail layout matching the reference design.
 * Left: invoice list (search, sort, filter chips, status badges, footer).
 * Right: invoice detail (header actions, addresses, payment methods,
 *        line-items table, terms/notes/totals, attachments, Draft ribbon).
 * Backend intentionally not wired (per request) — data is hardcoded to
 * match the design. Selecting a list row updates the detail panel.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildListSortParam } from "@/lib/listSort";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PaymentMethodsModal } from "@/components/modals/PaymentMethodsModal";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { PdfDocPreview } from "@/lib/db/PdfDocPreview";
import { downloadServerPdf, printServerPdf, downloadServerBatchPdf, printServerBatchPdf, serverBatchPdfUrlForRecords, triggerBlobDownload } from "@/lib/db/serverPdf";
import { usePdfSettings, type PdfDocType } from "@/lib/db/pdfSettings";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { showToast } from "@/utils/toast";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { useCollection, repo, nextNumber, money as fmtMoney } from "@/lib/db";
import { CreateInvoiceForm } from "./CreateInvoiceForm";
import { fetchInvoice, fetchInvoices, updateInvoice, hardDeleteInvoice, hardDeleteInvoices, restoreInvoices, invoiceCustomerId, type BackendInvoiceDoc } from "@/services/invoicesApi";
import { fetchPaymentMethods, type PaymentMethodOption } from "@/services/paymentMethodsApi";
import { resolveMediaUrl } from "@/lib/env";
import { InvoicePaymentsModal } from "@/components/modals/InvoicePaymentsModal";
import {
  DocPartyHeader,
  partyIdFromRef,
} from "@/components/modals/PartyDetailModal";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MenuSideFlyout } from "@/components/ui/MenuSideFlyout";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { todayIso } from "@/lib/dateIso";
import { numericId } from "@/lib/db/sync";
import { createInvoicePayment } from "@/services/paymentReceivedApi";
import {
  Search,
  Plus,
  ChevronDown,
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
  FileText,
  Download,
  X,
  Paperclip,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Link2,
  Trash2,
  MessageCircle,
  ChevronRight,
  CircleChevronUp,
  CircleChevronDown,
  RotateCcw,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";

/* ── Types & data ──────────────────────────────────────────────── */
type Status = "Draft" | "Paid" | "Partial" | "Overdue" | "Void" | "Open" | "Recurring" | "CreditNotesApplied";

interface LineItem {
  no: number;
  name: string;
  sub?: string;
  qty: string;
  mrp: string;
  rate: string;
  rateSub?: string;
  tax: string;
  discountLabel?: string;
  amount: string;
}

interface Invoice {
  id: number | string;
  backendId?: string;
  name: string;
  customerSubtitle?: string;
  number: string;
  note: string;
  date: string;
  due: string;
  amount: string;
  currency?: string;
  status: Status;
}

type DetailLine = {
  id: string;
  name: string;
  description: string;
  qty: number;
  rate: number;
  tax: number;
  discount: number;
  amount: number;
};

const invoices: Invoice[] = [
  { id: 14, name: "Sed aliquip eaque co", number: "#14", note: "Test, Sit quos sint quos e", date: "Jun 18, 2026", due: "Jun 18, 2026", amount: "$9,093.88", status: "Draft" },
  { id: 13, name: "Harum ut dolore aliq", number: "#13", note: "hi, Sit quos sint quos e", date: "Jun 17, 2026", due: "Jun 17, 2026", amount: "$12,303.16", status: "Paid" },
  { id: 12, name: "sayed cpy 1", number: "#12", note: "Sit quos sint quos e", date: "Jun 16, 2026", due: "Jun 16, 2026", amount: "$0.00", status: "Paid" },
  { id: 11, name: "Aliqua In vel quod", number: "#11", note: "Sit quos sint quos e", date: "Jun 16, 2026", due: "Jun 16, 2026", amount: "$1,730.00", status: "Paid" },
  { id: 10, name: "Aute quidem et perfe", number: "#10", note: "Sit quos sint quos e", date: "Jun 16, 2026", due: "Jun 16, 2026", amount: "$0.00", status: "Paid" },
  { id: 9, name: "STA", number: "#9", note: "hi, hi", date: "Jun 16, 2026", due: "Jun 16, 2026", amount: "$1,730.00", status: "Paid" },
  { id: 8, name: "sayed cpy", number: "#8", note: "No Notes", date: "Apr 27, 2026", due: "Apr 27, 2026", amount: "$50.00", status: "Paid" },
  { id: 6, name: "STA", number: "#6", note: "No Notes", date: "Apr 27, 2026", due: "Apr 27, 2026", amount: "$160.00", status: "Overdue" },
  { id: 5, name: "SMT", number: "#5", note: "No Notes", date: "Apr 27, 2026", due: "Apr 27, 2026", amount: "$160.00", status: "Overdue" },
];

const lineItems: LineItem[] = [
  { no: 1, name: "Product 1", sub: "this is product 1", qty: "50 box", mrp: "$0.00", rate: "$25.00", rateSub: "Batch product 1", tax: "Test Tax, new test …", discountLabel: "Mfg Date 4/29/2026 · Exp. Date 2/25/2027", amount: "$1,250.00" },
  { no: 2, name: "charge", sub: "hi  ……………", qty: "123 cm", mrp: "$0.00", rate: "$32.00", rateSub: "SAC 23", tax: "new test tax", amount: "$3,936.00" },
];

const paymentMethods = [
  { label: "Mastercard", bg: "#ffffff", fg: "#eb001b" },
  { label: "iZettle", bg: "#1d1d1b", fg: "#ffffff" },
  { label: "PayPal", bg: "#003087", fg: "#ffffff" },
  { label: "Stripe", bg: "#635bff", fg: "#ffffff" },
  { label: "SC", bg: "#0473ea", fg: "#ffffff" },
  { label: "DBS", bg: "#ed1c24", fg: "#ffffff" },
  { label: "Benefit", bg: "#ffffff", fg: "#e2231a" },
  { label: "AmEx", bg: "#006fcf", fg: "#ffffff" },
  { label: "Cash App", bg: "#00d632", fg: "#ffffff" },
  { label: "VISA", bg: "#ffffff", fg: "#1a1f71" },
  { label: "Discover", bg: "#ffffff", fg: "#f76b1c" },
  { label: "M-PESA", bg: "#ffffff", fg: "#43b02a" },
  { label: "NET", bg: "#0066b3", fg: "#ffd200" },
  { label: "Zelle", bg: "#6d1ed4", fg: "#ffffff" },
  { label: "Facebook Pay", bg: "#ffffff", fg: "#1877f2" },
  { label: "SumUp", bg: "#ffffff", fg: "#1c1c1c" },
];

const sortFields = [
  "Created On", "Name", "First Name", "Last Name", "Invoice date", "Due Date",
  "Invoice #", "Status", "Total", "Due", "Paid",
];
const statusList = [
  "All", "Draft", "Partial", "Paid", "Overdue", "Recurring",
  "Void", "Credit Notes Applied", "Open", "Trash",
];
const STATUS_BADGE: Record<Status, string> = {
  Draft: "bg-gray-600 text-white",
  Paid: "bg-green-500 text-white",
  Partial: "bg-orange-500 text-white",
  Overdue: "bg-red-500 text-white",
  Void: "bg-slate-700 text-white",
  Open: "bg-blue-500 text-white",
  Recurring: "bg-indigo-500 text-white",
  CreditNotesApplied: "bg-purple-500 text-white",
};

const statusLabel = (status: Status | string): string =>
  status === "CreditNotesApplied" ? "Credit Notes Applied" : String(status || "");

const normalizeInvoiceStatus = (raw?: string): Status => {
  const s = String(raw || "").trim();
  if (s === "Credit Notes Applied" || s === "CreditNotesApplied") return "CreditNotesApplied";
  const known = ["Draft", "Paid", "Partial", "Overdue", "Void", "Open", "Recurring"] as const;
  if ((known as readonly string[]).includes(s)) {
    return s as Status;
  }
  return "Draft";
};

const invoiceSortToBackend = (value: string) => {
  switch (value) {
    case "Invoice #":
      return "invoice_number";
    case "Name":
    case "First Name":
    case "Last Name":
      return "customer_name";
    case "Status":
      return "status";
    case "Total":
    case "Due":
    case "Paid":
      return "total";
    case "Due Date":
      return "due_date";
    case "Invoice date":
      return "date";
    case "Created On":
    default:
      return "createdAt";
  }
};

const apiText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const numberValue = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const apiMoney = (amount: number, currency?: string) => {
  const cur = apiText(currency) || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${cur} ${(amount || 0).toFixed(2)}`;
  }
};

const invoiceAddressLines = (address?: BackendInvoiceDoc["billing_address"]) =>
  [address?.street, address?.street2, [address?.city, address?.state, address?.zip].filter(Boolean).join(", "), address?.country]
    .filter(Boolean);

const customerDisplayName = (customer: any): string => {
  return (
    apiText(customer?.businessProfile?.companyName) ||
    apiText(customer?.company_name) ||
    apiText(customer?.name) ||
    apiText(customer?.contact) ||
    "—"
  );
};

const customerDisplaySubtitle = (customer: any): string => {
  return [apiText(customer?.name), apiText(customer?.email)].filter(Boolean).join(" · ");
};

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};

const DynamicPaymentBadges: React.FC<{ names: string[]; options: PaymentMethodOption[] }> = ({ names, options }) => {
  if (!names.length) return <div className="text-sm text-gray-400">—</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((name) => {
        const meta = options.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
        return (
          <span
            key={name}
            className="px-1.5 h-6 min-w-[34px] rounded text-[9px] font-bold flex items-center justify-center border border-black/10 bg-white"
            title={name}
          >
            {meta?.logo ? <img src={resolveMediaUrl(meta.logo)} alt={name} className="max-h-4 max-w-14 object-contain" /> : name}
          </span>
        );
      })}
    </div>
  );
};

/* ── Modal shell ───────────────────────────────────────────────── */
const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({
  onClose,
  children,
}) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full flex justify-center">
        {children}
      </div>
    </div>
  );
};

/* ── Print / preview modal (white printable document) ──────────── */
const PreviewModal: React.FC<{ onClose: () => void; title?: string }> = ({ onClose, title }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
      {/* dark header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">{title || "Invoice# 14"}</h3>
        <div className="flex items-center gap-1">
          {[Download, Printer, Mail].map((Ic, i) => (
            <button key={i} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
              <Ic className="w-4 h-4" />
            </button>
          ))}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* white document */}
      <div style={{ background: "#fff", color: "#111" }} className="p-6">
        <div className="text-right text-sm italic text-gray-500">(Original)</div>
        <div className="border border-gray-300">
          <h1 className="text-center text-2xl font-bold py-3 border-b border-gray-300">INVOICE</h1>
          <div className="flex justify-between gap-6 p-4">
            <div>
              <div className="font-bold text-lg">info</div>
              <div className="text-sm text-gray-700">Bangladesh</div>
              <div className="text-sm text-gray-700">info@inovoic.com</div>
            </div>
            <table className="text-sm border-collapse">
              <tbody>
                {[
                  ["Invoice #", "14"],
                  ["P.O. #", "58"],
                  ["Invoice date", "Jun 18, 2026"],
                  ["Due Date", "Jun 18, 2026"],
                  ["Total", "$9,093.88"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="border border-gray-300 px-3 py-1.5 font-semibold text-right">{k}</td>
                    <td className="border border-gray-300 px-3 py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-2 text-right text-xs text-gray-600">We accept payment by</div>
          <div className="px-4 pb-3 flex flex-wrap gap-1 justify-end">
            {paymentMethods.map((p) => (
              <span key={p.label} className="px-1.5 h-6 min-w-[34px] rounded text-[9px] font-bold flex items-center justify-center border border-gray-300" style={{ background: p.bg, color: p.fg }}>
                {p.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6 px-4 py-3 text-sm border-t border-gray-300">
            <div>
              <div className="font-bold">Invoice To:</div>
              <div className="font-semibold">Sed aliquip eaque co</div>
              <div>kj</div>
              <div>dk dhaka 12540</div>
              <div>Bangladesh</div>
            </div>
            <div>
              <div className="font-bold">Ship To</div>
              <div>kj</div>
              <div>dk dhaka 12540 Bangladesh</div>
              <div className="font-bold mt-1">Shipping Method:</div>
              <div>Priority Shipping</div>
            </div>
          </div>
          <div className="text-center font-bold text-sm py-1">Test</div>
          {/* products */}
          <table className="w-full text-xs border-t border-gray-300">
            <thead>
              <tr>
                {["Sr. No.", "Products", "Quantity", "Unit Price", "new test tax", "Test Tax", "Amount"].map((h) => (
                  <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-2 text-center">1.</td>
                <td className="border border-gray-300 px-2 py-2"><div className="font-semibold">Product 1</div><div className="text-gray-500">this is product 1</div></td>
                <td className="border border-gray-300 px-2 py-2 font-semibold">50 box</td>
                <td className="border border-gray-300 px-2 py-2">$25.00<div className="text-[10px]">Exp. Date Feb 25, 2027</div></td>
                <td className="border border-gray-300 px-2 py-2">$725.00<div className="text-[10px]">Mfg Date Apr 29, 2026</div></td>
                <td className="border border-gray-300 px-2 py-2">$900.00</td>
                <td className="border border-gray-300 px-2 py-2">$1,250.00</td>
              </tr>
            </tbody>
          </table>
          {/* services */}
          <table className="w-full text-xs">
            <thead>
              <tr>
                {["Sr. No.", "Services", "Quantity", "Rate", "new test tax", "Amount"].map((h) => (
                  <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-2 text-center">1.</td>
                <td className="border border-gray-300 px-2 py-2"><div className="font-semibold">charge</div><div className="text-gray-500">hi  ………</div></td>
                <td className="border border-gray-300 px-2 py-2">123 cm</td>
                <td className="border border-gray-300 px-2 py-2">$32.00</td>
                <td className="border border-gray-300 px-2 py-2">$2,282.88</td>
                <td className="border border-gray-300 px-2 py-2">$3,936.00</td>
              </tr>
            </tbody>
          </table>
          {/* totals */}
          <div className="flex justify-end px-4 py-3 text-sm">
            <table className="text-right">
              <tbody>
                <tr><td className="px-3 py-1 font-bold">Sub Total</td><td className="px-3 py-1">$5,186.00</td></tr>
                <tr><td className="px-3 py-1 text-gray-600">new test tax 58% on $5,186.00</td><td className="px-3 py-1">$3,007.88</td></tr>
                <tr><td className="px-3 py-1 text-gray-600">Test Tax 72% on $1,250.00</td><td className="px-3 py-1">$900.00</td></tr>
                <tr className="border-t border-gray-300"><td className="px-3 py-1 font-bold">Total</td><td className="px-3 py-1 font-bold">$9,093.88</td></tr>
                <tr><td className="px-3 py-1 font-bold">Amount Due</td><td className="px-3 py-1 font-bold">$9,093.88</td></tr>
              </tbody>
            </table>
          </div>
          <div className="text-right px-4 pb-2 text-xs">Total in Words: Nine Thousand Ninety Three Dollars and Eighty Eight Cents</div>
          <div className="px-4 py-3 border-t border-gray-300 text-sm">
            <div className="font-bold">Terms &amp; Conditions</div>
            <div className="text-gray-700">Eos ab vel officiis</div>
          </div>
        </div>
      </div>
    </div>
  </Overlay>
);

/* ── Email compose modal ───────────────────────────────────────── */
const EmailModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
        <h3 className="text-base font-medium text-gray-900">Invoice # 14 from info</h3>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Send</button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <input placeholder="To" className="flex-1 bg-transparent text-sm outline-none" />
          <button className="text-xs text-gray-500 hover:text-gray-700">Cc &amp; Bcc</button>
        </div>
        <input defaultValue="Invoice # 14 from info" className="w-full border-b border-gray-300 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <span className="text-sm text-gray-700">From: info@inovoic.com</span>
          <div className="flex items-center gap-2 text-gray-500">
            <ChevronDown className="w-4 h-4" />
            <Pencil className="w-4 h-4" />
          </div>
        </div>
        {/* toolbar */}
        <div className="flex items-center gap-1 flex-wrap text-gray-500 border-b border-gray-300 pb-2">
          <span className="inline-flex items-center text-xs px-1">Font <ChevronDown className="w-3 h-3 ml-0.5" /></span>
          {[Bold, Italic, Underline].map((Ic, i) => <button key={i} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded"><Ic className="w-3.5 h-3.5" /></button>)}
          <span className="px-1 font-bold text-sm border-b-2 border-current">A</span>
          {[AlignLeft, AlignCenter, AlignRight, ImageIcon, Link2].map((Ic, i) => <button key={i} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded"><Ic className="w-3.5 h-3.5" /></button>)}
        </div>
        {/* body */}
        <div className="text-sm text-gray-800 space-y-2 min-h-[140px]">
          <p>Dear Sed aliquip eaque co</p>
          <p>50 quie sint quos e<br />Invoice # 14<br />Invoice Total Amount: $9,093.88</p>
          <p>Eos ab vel officiis</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Invoice # 14</span>
        </div>
        {/* attachment */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="inline-flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-sm text-gray-700">
            <FileText className="w-4 h-4" /> Invoice #14 <X className="w-3.5 h-3.5 cursor-pointer" />
          </span>
          <button className="w-9 h-9 flex items-center justify-center rounded-md bg-gray-800 text-white"><Paperclip className="w-4 h-4" /></button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

/* ── $ menu: Add Payment / Mark as Paid ▸ payment methods ──────── */
const PaidMenu: React.FC<{
  close: () => void;
  onAddPayment: () => void;
  onMarkPaid: (method: string) => void;
  methods: string[];
}> = ({ close, onAddPayment, onMarkPaid, methods }) => {
  const item = "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap";
  const names = methods.length ? methods : ["Cash", "Cheque", "Bank Transfer", "Others"];
  return (
    <div className="py-1 min-w-[170px]">
      <button type="button" onClick={() => { onAddPayment(); close(); }} className={item}>Add Payment</button>
      <MoreMenuFlyoutRow label="Mark as Paid">
        {names.map((m) => (
          <button key={m} type="button" onClick={() => { onMarkPaid(m); close(); }} className={item}>{m}</button>
        ))}
      </MoreMenuFlyoutRow>
    </div>
  );
};

/* ── ⋮ menu (WhatsApp / Packing Slip / Delivery Note /
      Duplicate ▸ / Credit Notes ▸ / Mark as Draft|Void|Paid ▸ / Signature Request / Activity / Trash) ── */
const DUP_TARGETS = ["As Invoice", "As Estimate", "As Proforma Invoice", "As Credit Note", "As Purchase Order", "As Delivery Challan"];
const InvoiceMoreMenu: React.FC<{
  close: () => void;
  onAction: (a: string) => void;
  paymentMethods: string[];
}> = ({ close, onAction, paymentMethods }) => {
  const item = "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap";
  const run = (a: string) => { onAction(a); close(); };
  const payNames = paymentMethods.length ? paymentMethods : ["Cash", "Cheque", "Bank Transfer", "Others"];
  return (
    <div className="py-1 min-w-[190px]">
      <button type="button" onClick={() => run("whatsapp")} className={item}>WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
      <button type="button" onClick={() => run("packingSlip")} className={item}>Packing Slip</button>
      <button type="button" onClick={() => run("deliveryNote")} className={item}>Delivery Note</button>
      <MoreMenuFlyoutRow label="Duplicate">
        {DUP_TARGETS.map((t) => (
          <button key={t} type="button" onClick={() => run("dup:" + t)} className={item}>{t}</button>
        ))}
      </MoreMenuFlyoutRow>
      <MoreMenuFlyoutRow label="Credit Notes">
        <button type="button" onClick={() => run("dup:As Credit Note")} className={item}>Create New</button>
      </MoreMenuFlyoutRow>
      <button type="button" onClick={() => run("mark:Draft")} className={item}>Mark as Draft</button>
      <button type="button" onClick={() => run("mark:Void")} className={item}>Mark as Void</button>
      <MoreMenuFlyoutRow label="Mark as Paid">
        {payNames.map((m) => (
          <button key={m} type="button" onClick={() => run("paid:" + m)} className={item}>{m}</button>
        ))}
      </MoreMenuFlyoutRow>
      <button type="button" onClick={() => run("signature")} className={`${item} border-t border-gray-200`}>Signature Request</button>
      <button type="button" onClick={() => run("activity")} className={item}>Activity Log</button>
      <button type="button" onClick={() => run("trash")} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200">Trash</button>
    </div>
  );
};

/* ── Packing Slip / Delivery Note preview (settings-driven, live data) ── */
const DocTypePreview: React.FC<{
  docType: PdfDocType;
  title: string;
  recordId: number;
  recordIds?: number[];
  /** Mongo `_id` — exact `/pdf/generate` preview */
  backendId?: string;
  onClose: () => void;
}> = ({ docType, title, recordId, recordIds, backendId, onClose }) => {
  const settings = usePdfSettings(docType, "normal");
  // Batch mode: several selected records merged into one PDF (each on its own page).
  const batchIds = (recordIds ?? []).filter((n) => Number.isFinite(n));
  const isBatch = batchIds.length > 1;
  const [batchUrl, setBatchUrl] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState<boolean>(isBatch);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const onPdfUrl = useCallback((url: string | null) => setPreviewUrl(url), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    if (!isBatch) return;
    let alive = true;
    let url: string | null = null;
    setBatchLoading(true);
    setBatchUrl(null);
    serverBatchPdfUrlForRecords(docType, batchIds).then((u) => {
      url = u;
      if (!alive) { if (u) URL.revokeObjectURL(u); return; }
      setBatchUrl(u);
      setBatchLoading(false);
    });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType, isBatch, batchIds.join(",")]);
  const fileName = `${title || docType}.pdf`;
  const onDownload = () => {
    if (isBatch && batchUrl) {
      triggerBlobDownload(batchUrl, fileName);
      return;
    }
    if (!isBatch && previewUrl) {
      triggerBlobDownload(previewUrl, fileName);
      return;
    }
    void (isBatch
      ? downloadServerBatchPdf(docType, batchIds, fileName)
      : downloadServerPdf(docType, recordId, fileName, backendId));
  };
  const onPrint = () => {
    if (isBatch && batchUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      iframe.src = batchUrl;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 60000);
      };
      document.body.appendChild(iframe);
      return;
    }
    if (!isBatch && previewUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      iframe.src = previewUrl;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 60000);
      };
      document.body.appendChild(iframe);
      return;
    }
    void (isBatch
      ? printServerBatchPdf(docType, batchIds)
      : printServerPdf(docType, recordId, backendId));
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
          <h3 className="text-base font-medium">{title}</h3>
          <div className="flex items-center gap-1">
            <button type="button" title="Download" onClick={onDownload} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Download className="w-4 h-4" /></button>
            <button type="button" title="Print" onClick={onPrint} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Printer className="w-4 h-4" /></button>
            <button type="button" onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {isBatch ? (
          batchLoading ? (
            <div style={{ width: "100%", height: "70vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="animate-spin" style={{ width: 44, height: 44, border: "3px solid #e5e7eb", borderTopColor: "#2563eb", borderRadius: "50%" }} />
            </div>
          ) : batchUrl ? (
            <div style={{ width: "100%", height: "70vh", background: "#f3f4f6" }}>
              <iframe src={`${batchUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title="Documents PDF" style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
          ) : (
            <PdfDocPreview docType={docType} mode="normal" settings={settings} recordId={recordId} backendId={backendId} onPdfUrl={onPdfUrl} />
          )
        ) : (
          <PdfDocPreview docType={docType} mode="normal" settings={settings} recordId={recordId} backendId={backendId} onPdfUrl={onPdfUrl} />
        )}
      </div>
    </div>
  );
};

/* ── Activity Log modal — live events for one invoice ──────────── */
const ActivityLogModal: React.FC<{ invoice: any; payments: any[]; onClose: () => void }> = ({ invoice, payments, onClose }) => {
  const rows = [
    ...payments.map((p) => ({ text: `Payment ${p.number} received (${p.method || "Cash"}).`, date: p.date, ts: p.ts || 0 })),
    { text: `Invoice ${invoice.number} created.`, date: invoice.date, ts: invoice.ts || 0 },
  ].sort((a, b) => b.ts - a.ts);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-md my-16 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
          <h3 className="text-base font-semibold text-gray-900">Activity Log — Invoice {invoice.number}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></div>
              <div>
                <div className="text-sm text-gray-800">{r.text}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  );
};

/* ── Create Invoice modal (live customer + item pickers → persists) ── */
const TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const fmtToday = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
type DraftRow = { key: string; name: string; qty: number; rate: number; taxId: number };

const CreateInvoiceModal: React.FC<{ onClose: () => void; onSaved: (id: number) => void }> = ({ onClose, onSaved }) => {
  const customers = useCollection<any>("customers", "name");
  const products = useCollection<any>("products", "name");
  const services = useCollection<any>("services", "name");
  const catalog = useMemo(
    () => [
      ...products.map((p) => ({ key: "p" + p.id, name: p.name, rate: p.price || 0, taxId: p.taxId || 1 })),
      ...services.map((s) => ({ key: "s" + s.id, name: s.name, rate: s.price || 0, taxId: s.taxId || 1 })),
    ],
    [products, services],
  );
  const [customerId, setCustomerId] = useState<number | "">("");
  const [date, setDate] = useState(todayIso());
  const [due, setDue] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([{ key: "", name: "", qty: 1, rate: 0, taxId: 1 }]);

  const addRow = () => setRows((r) => [...r, { key: "", name: "", qty: 1, rate: 0, taxId: 1 }]);
  const pickItem = (idx: number, key: string) =>
    setRows((r) => r.map((row, i) => {
      if (i !== idx) return row;
      const it = catalog.find((c) => c.key === key);
      return it ? { ...row, key, name: it.name, rate: it.rate, taxId: it.taxId } : { ...row, key: "", name: "" };
    }));
  const setQty = (idx: number, qty: number) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, qty } : row)));
  const removeRow = (idx: number) => setRows((r) => (r.length > 1 ? r.filter((_, i) => i !== idx) : r));

  const subTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0);
  const taxTotal = rows.reduce((s, r) => s + r.qty * r.rate * ((TAX_RATE[r.taxId] || 0) / 100), 0);
  const total = subTotal + taxTotal;

  const save = async () => {
    if (customerId === "") return;
    const n = await nextNumber("invoices");
    const items = rows.filter((r) => r.name).map((r, i) => ({ id: i + 1, name: r.name, qty: r.qty, rate: r.rate, taxId: r.taxId, amount: +(r.qty * r.rate).toFixed(2) }));
    const id = await repo.add("invoices", {
      number: "#" + n, customerId, date, due, ts: Date.now(), status: "Draft",
      items, subTotal: +subTotal.toFixed(2), tax: +taxTotal.toFixed(2), shipping: 0,
      total: +total.toFixed(2), amountPaid: 0, amountDue: +total.toFixed(2), notes, terms: "",
    });
    onSaved(id);
    onClose();
  };

  const fc = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-3xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
          <h3 className="text-base font-semibold text-gray-900">Create Invoice</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={save} disabled={customerId === ""} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">Save</button>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-xs text-gray-500">Customer *</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")} className={`mt-1 ${fc}`}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500">Invoice date</label><AppDatePicker value={date} onValueChange={setDate} className={`mt-1 ${fc}`} /></div>
            <div><label className="text-xs text-gray-500">Due date</label><AppDatePicker value={due} onValueChange={setDue} className={`mt-1 ${fc}`} /></div>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left font-semibold px-3 py-2">Item</th>
                <th className="text-right font-semibold px-2 py-2 w-20">Qty</th>
                <th className="text-right font-semibold px-2 py-2 w-24">Rate</th>
                <th className="text-right font-semibold px-3 py-2 w-28">Amount</th>
                <th className="w-8" />
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-3 py-2">
                      <select value={r.key} onChange={(e) => pickItem(i, e.target.value)} className="w-full bg-transparent text-sm outline-none">
                        <option value="">Select product / service</option>
                        {catalog.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right"><input type="number" min={0} value={r.qty} onChange={(e) => setQty(i, Number(e.target.value))} className="w-16 bg-transparent text-sm text-right outline-none" /></td>
                    <td className="px-2 py-2 text-right text-gray-700">{fmtMoney(r.rate)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmtMoney(r.qty * r.rate)}</td>
                    <td className="px-2 py-2 text-right"><button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-gray-200"><button onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Item</button></div>
          </div>

          <div className="flex justify-between gap-5">
            <div className="flex-1"><label className="text-xs text-gray-500">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full h-20 border border-gray-200 rounded-md p-2 text-sm outline-none resize-none" /></div>
            <div className="w-56 border border-gray-200 rounded-md overflow-hidden self-start">
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-600">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(subTotal)}</span></div>
              <div className="flex justify-between px-3 py-2 text-sm border-t border-gray-200"><span className="text-gray-600">Tax</span><span className="text-gray-700">{fmtMoney(taxTotal)}</span></div>
              <div className="flex justify-between px-3 py-2.5 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{fmtMoney(total)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const SalesInvoice: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  // Opened from an activity link / Header create menu / Time Logs.
  const navState = (location.state as {
    selectedId?: number | string;
    openCreate?: boolean;
    prefillCustomer?: {
      localId?: number;
      backendId?: string;
      name?: string;
      email?: string;
    };
  } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<number | string>(navSelectedId ?? 0);
  useEffect(() => { if (navSelectedId != null) setSelectedId(navSelectedId); }, [navSelectedId]);
  const [sortBy, setSortBy] = useState("Created On");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    null | "settings" | "preview" | "email" | "payment" | "pdfSettings"
  >(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number | string>>(new Set());
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  const [createPrefillCustomer, setCreatePrefillCustomer] = useState(navState?.prefillCustomer);
  const [editOpen, setEditOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  useEffect(() => {
    if (navState?.openCreate) {
      setCreateOpen(true);
      setCreatePrefillCustomer(navState.prefillCustomer);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, navState?.prefillCustomer, location.pathname, navigate]);
  // reference features: expandable info panel, doc-type previews, activity log, trash alerts
  const [expanded, setExpanded] = useState(true);
  const [docPreview, setDocPreview] = useState<null | "packingSlip" | "deliveryNote">(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [sortBy, sortDir, statusFilter, customerFilter]);

  // live from the shared datastore (used for detail/create helpers — not list source)
  const dbInvoices = useCollection<any>("invoices");
  const dbCustomers = useCollection<any>("customers", "name");
  const { data: backendInvoiceList } = useQuery({
    queryKey: ["sales-invoice-backend-list", page, search, sortBy, sortDir, statusFilter, customerFilter],
    queryFn: () =>
      fetchInvoices({
        page,
        limit: LIST_PAGE_SIZE,
        searchTerm: search || undefined,
        sort: buildListSortParam(invoiceSortToBackend(sortBy), sortDir),
        status: statusFilter === "Trash" ? undefined : statusFilter,
        isDeleted: statusFilter === "Trash" || undefined,
        customer_id: partyFilterParam(customerFilter),
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = backendInvoiceList?.pagination;

  const filtered = useMemo(() => {
    const backendRows = backendInvoiceList?.rows ?? [];
    return backendRows.map((row) => {
        const linkedLocal =
          dbInvoices.find((item) => item._id === row._id) ||
          dbInvoices.find((item) => String(item.number).replace(/^#/, "") === row.number);
        // Prefer Dexie id when linked; otherwise keep the Mongo _id so selection stays stable across list refreshes.
        return {
          id: linkedLocal?.id ?? row._id,
          backendId: row._id,
          name: row.customerName,
          customerSubtitle: row.customerSubtitle,
          number: `#${row.number}`,
          note: row.customerSubtitle || linkedLocal?.notes || "No Notes",
          date: row.dateLabel,
          due: row.dateLabel,
          amount: apiMoney(row.amount, row.currency),
          currency: row.currency,
          status: normalizeInvoiceStatus(row.status),
        } satisfies Invoice;
      });
  }, [backendInvoiceList?.rows, dbInvoices]);

  const listDue = useMemo(
    () => filtered.reduce((sum, item) => sum + (Number(item.amount.replace(/[^0-9.-]/g, "")) || 0), 0),
    [filtered],
  );

  const selected =
    filtered.find((i) => i.id === selectedId) ||
    filtered.find((i) => i.backendId === selectedId) ||
    filtered[0];
  const selectedDb: any =
    (typeof selected?.id === "number" ? dbInvoices.find((i) => i.id === selected.id) : undefined) ||
    dbInvoices.find((i) => i._id === selected?.backendId) ||
    (selected?.backendId ? dbInvoices.find((i) => i.id === numericId(String(selected.backendId))) : undefined) ||
    {};
  const selectedCustomerLocal: any = dbCustomers.find((c) => c.id === selectedDb.customerId) || {};

  useEffect(() => {
    if (
      filtered.length > 0 &&
      !filtered.some((item) => item.id === selectedId || item.backendId === selectedId)
    ) {
      setSelectedId(filtered[0].backendId || filtered[0].id);
    }
  }, [filtered, selectedId]);
  const { data: paymentMethodOptions = [] } = useQuery({
    queryKey: ["sales-invoice-payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });
  const { data: selectedInvoiceDoc } = useQuery({
    queryKey: ["sales-invoice-backend-detail", selected?.backendId],
    queryFn: () => fetchInvoice(String(selected?.backendId)),
    enabled: !!selected?.backendId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const partyBackendId =
    invoiceCustomerId(selectedInvoiceDoc) ||
    partyIdFromRef(selectedCustomerLocal._id) ||
    "";

  const selectedCustomer: any =
    selectedCustomerLocal?.id
      ? selectedCustomerLocal
      : dbCustomers.find((c) => partyBackendId && String(c._id) === partyBackendId) ||
        (selectedInvoiceDoc?.customer_id && typeof selectedInvoiceDoc.customer_id === "object"
          ? {
              name: selectedInvoiceDoc.customer_id.name || selectedInvoiceDoc.customer_name,
              email: (selectedInvoiceDoc.customer_id as any).email,
              contact: selectedInvoiceDoc.customer_id.name,
              _id: (selectedInvoiceDoc.customer_id as any)._id,
            }
          : { name: selectedInvoiceDoc?.customer_name || selected?.name || "" });

  const detailLines = useMemo<DetailLine[]>(() => {
    const products = (selectedInvoiceDoc?.product ?? []).map((item, index) => ({
      id: `p-${index}`,
      name: apiText(item.product_name || (typeof item.product_id === "object" ? item.product_id?.productName : "")) || "Product",
      description: apiText(item.description || (typeof item.product_id === "object" ? item.product_id?.description : "")),
      qty: numberValue(item.quantity ?? 1),
      rate: numberValue(item.rate),
      tax: numberValue(item.tax),
      discount: numberValue(item.discount),
      amount: numberValue(item.amount ?? numberValue(item.quantity) * numberValue(item.rate)),
    }));
    const services = (selectedInvoiceDoc?.service ?? []).map((item, index) => ({
      id: `s-${index}`,
      name: apiText(item.service_name || (typeof item.service_id === "object" ? item.service_id?.serviceName : "")) || "Service",
      description: apiText(item.description || (typeof item.service_id === "object" ? item.service_id?.description : "")),
      qty: numberValue(item.quantity ?? 1),
      rate: numberValue(item.rate),
      tax: numberValue(item.tax),
      discount: numberValue(item.discount),
      amount: numberValue(item.amount ?? numberValue(item.quantity) * numberValue(item.rate)),
    }));
    if (products.length || services.length) return [...products, ...services];
    return (selectedDb.items || []).map((item: any, index: number) => ({
      id: `l-${index}`,
      name: item.name || "Item",
      description: item.description || "",
      qty: numberValue(item.qty ?? 1),
      rate: numberValue(item.rate),
      tax: TAX_RATE[item.taxId || 1] || 0,
      discount: numberValue(item.discount),
      amount: numberValue(item.amount ?? numberValue(item.qty) * numberValue(item.rate)),
    }));
  }, [selectedDb.items, selectedInvoiceDoc?.product, selectedInvoiceDoc?.service]);

  const detailSubTotal = numberValue(selectedInvoiceDoc?.sub_total ?? selectedDb.subTotal);
  const detailTotal = numberValue(selectedInvoiceDoc?.total ?? selectedDb.total);
  const detailPaid = numberValue(selectedInvoiceDoc?.paid_amount ?? selectedDb.amountPaid);
  const detailDue = numberValue(
    selectedInvoiceDoc?.balance_amount ?? selectedDb.amountDue ?? Math.max(0, detailTotal - detailPaid),
  );
  const detailTerms = apiText(selectedInvoiceDoc?.terms_and_conditions) || selectedDb.terms || "—";
  const detailNotes = apiText(selectedInvoiceDoc?.notes) || selectedDb.notes || "—";

  const dbPaymentsReceived = useCollection<any>("paymentsReceived");
  const invoicePayments = dbPaymentsReceived.filter((p) => p.invoiceId === selectedDb.id);

  /** Build a Dexie-shaped invoice for CreateInvoiceForm (edit), including backend-only rows. */
  const buildEditInvoiceFromBackend = (doc: BackendInvoiceDoc, local?: any) => {
    const backendId = String(doc._id);
    const localId =
      (typeof local?.id === "number" && local.id) ||
      numericId(backendId);
    const customerMongo = invoiceCustomerId(doc);
    const localCustomer =
      dbCustomers.find((c) => customerMongo && String(c._id) === customerMongo) ||
      (typeof local?.customerId === "number" ? dbCustomers.find((c) => c.id === local.customerId) : undefined);
    const items =
      (local?.items?.length ? local.items : null) ||
      [
        ...(doc.product ?? []).map((item, index) => ({
          id: index + 1,
          name: apiText(item.product_name || (typeof item.product_id === "object" ? item.product_id?.productName : "")) || "Product",
          description: apiText(item.description),
          qty: numberValue(item.quantity ?? 1),
          rate: numberValue(item.rate),
          taxId: 1,
          discount: numberValue(item.discount),
          amount: numberValue(item.amount),
        })),
        ...(doc.service ?? []).map((item, index) => ({
          id: 1000 + index,
          name: apiText(item.service_name || (typeof item.service_id === "object" ? item.service_id?.serviceName : "")) || "Service",
          description: apiText(item.description),
          qty: numberValue(item.quantity ?? 1),
          rate: numberValue(item.rate),
          taxId: 1,
          discount: numberValue(item.discount),
          amount: numberValue(item.amount),
        })),
      ];
    return {
      ...(local || {}),
      id: localId,
      _id: backendId,
      number: local?.number || (doc.invoice_number ? `#${doc.invoice_number}` : selected?.number || ""),
      customerId: localCustomer?.id ?? local?.customerId ?? (customerMongo ? numericId(customerMongo) : ""),
      customerName: localCustomer?.name || selected?.name || doc.customer_name || "",
      customerBackendId: customerMongo || "",
      customerEmail: localCustomer?.email || (typeof doc.customer_id === "object" ? (doc.customer_id as any)?.email : "") || "",
      date: local?.date || (doc.date ? new Date(doc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""),
      due: local?.due || (doc.due_date ? new Date(doc.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""),
      status: normalizeInvoiceStatus(doc.status || local?.status),
      items,
      subTotal: numberValue(doc.sub_total ?? local?.subTotal),
      tax: numberValue(doc.tax ?? local?.tax),
      shipping: numberValue(doc.shipping_cost ?? local?.shipping),
      total: numberValue(doc.total ?? local?.total),
      amountPaid: numberValue(doc.paid_amount ?? local?.amountPaid),
      amountDue: numberValue(doc.balance_amount ?? local?.amountDue),
      notes: apiText(doc.notes) || local?.notes || "",
      terms: apiText(doc.terms_and_conditions) || local?.terms || "",
      currency: doc.currency || local?.currency || "USD",
      paymentMethod: doc.payment_method || local?.paymentMethod || [],
      payment_method: doc.payment_method || local?.payment_method || [],
      subTitle: apiText(doc.sub_title) || local?.subTitle || "",
      shippingMethod: apiText(doc.shipping_method) || local?.shippingMethod || "",
      Attachment: doc.Attachment || local?.Attachment || "",
      street1: doc.billing_address?.street || local?.street1 || "",
      street2: doc.billing_address?.street2 || local?.street2 || "",
      city: doc.billing_address?.city || local?.city || "",
      state: doc.billing_address?.state || local?.state || "",
      zip: doc.billing_address?.zip || local?.zip || "",
      country: doc.billing_address?.country || local?.country || "",
      shipStreet1: doc.shipping_address?.street || local?.shipStreet1 || "",
      shipStreet2: doc.shipping_address?.street2 || local?.shipStreet2 || "",
      shipCity: doc.shipping_address?.city || local?.shipCity || "",
      shipState: doc.shipping_address?.state || local?.shipState || "",
      shipZip: doc.shipping_address?.zip || local?.shipZip || "",
      shipCountry: doc.shipping_address?.country || local?.shipCountry || "",
    };
  };

  const openEditInvoice = async () => {
    try {
      let local =
        (typeof selectedDb?.id === "number" ? selectedDb : null) ||
        (selected?.backendId
          ? dbInvoices.find((i) => i._id === selected.backendId) ||
            dbInvoices.find((i) => i.id === numericId(String(selected.backendId)))
          : null);

      if (local?.id && !selected?.backendId) {
        setEditInvoice(local);
        setEditOpen(true);
        return;
      }

      const backendId = String(selectedInvoiceDoc?._id || selected?.backendId || local?._id || "");
      if (!backendId) {
        if (local?.id) {
          setEditInvoice(local);
          setEditOpen(true);
          return;
        }
        showToast("Invoice not ready to edit yet", "warning");
        return;
      }

      const doc = selectedInvoiceDoc?._id === backendId
        ? selectedInvoiceDoc
        : await fetchInvoice(backendId);
      if (!doc?._id) {
        showToast("Could not load invoice for editing", "error");
        return;
      }

      const shaped = buildEditInvoiceFromBackend(doc, local || undefined);
      await repo.put("invoices", {
        ...shaped,
        updatedAt: new Date().toISOString(),
        createdAt: local?.createdAt || new Date().toISOString(),
      });
      setEditInvoice(shaped);
      setEditOpen(true);
    } catch (err: any) {
      showToast(err?.message || "Could not open invoice editor", "error");
    }
  };

  /* ── reference actions: mark-as-paid / duplicate / trash ──────── */
  const paymentMethodNames = useMemo(
    () => paymentMethodOptions.map((m) => m.name).filter(Boolean),
    [paymentMethodOptions],
  );

  const markInvoiceStatus = async (status: string) => {
    const backendId = selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id;
    try {
      if (backendId) await updateInvoice(String(backendId), { status });
      if (typeof selectedDb?.id === "number") await repo.update("invoices", selectedDb.id, { status });
      await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
      if (backendId) await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", String(backendId)] });
      showToast(`Invoice marked as ${status}`, "success");
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || "Could not update status", "error");
    }
  };

  const markAsPaid = async (method: string, invoiceIds?: Array<number | string>) => {
    const ids = (invoiceIds ?? [...checked]).filter((id) => id != null && id !== "");
    if (!ids.length) {
      // Single-invoice Mark as Paid from ⋮ menu
      const backendId = String(selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id || "");
      const customerId = invoiceCustomerId(selectedInvoiceDoc) || partyBackendId;
      const due = detailDue > 0 ? detailDue : detailTotal;
      try {
        if (backendId && customerId && due > 0) {
          await createInvoicePayment({
            customer_id: customerId,
            invoice_id: backendId,
            payment_date: todayIso(),
            payment_type: method,
            amount: due,
            type: "invoice",
            notes: `Marked as paid via ${method}`,
          });
        } else if (backendId) {
          await updateInvoice(backendId, {
            status: "Paid",
            paid_amount: detailTotal,
            balance_amount: 0,
            payment_method: [method],
          });
        }
        if (typeof selectedDb?.id === "number") {
          await repo.update("invoices", selectedDb.id, {
            status: "Paid",
            amountPaid: selectedDb.total || detailTotal,
            amountDue: 0,
          });
        }
        await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
        if (backendId) await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", backendId] });
        showToast(`Invoice marked as paid (${method})`, "success");
      } catch (err: any) {
        showToast(err?.response?.data?.message || err?.message || "Could not mark as paid", "error");
      }
      return;
    }

    let done = 0;
    for (const id of ids) {
      const row = filtered.find((i) => i.id === id || i.backendId === id);
      const local = dbInvoices.find((i) => i.id === id || i._id === row?.backendId);
      const backendId = String(row?.backendId || local?._id || "");
      const customerMongo =
        (local?.customerId != null
          ? (await (async () => {
              const c = dbCustomers.find((x) => x.id === local.customerId);
              return c?._id ? String(c._id) : "";
            })())
          : "") || "";
      const total = Number(local?.total ?? row?.amount?.replace?.(/[^0-9.-]/g, "") ?? 0) || 0;
      const due = Number(local?.amountDue ?? total) || 0;
      try {
        if (backendId && customerMongo && due > 0) {
          await createInvoicePayment({
            customer_id: String(customerMongo),
            invoice_id: backendId,
            payment_date: todayIso(),
            payment_type: method,
            amount: due,
            type: "invoice",
            notes: `Marked as paid via ${method}`,
          });
        } else if (backendId) {
          await updateInvoice(backendId, { status: "Paid", paid_amount: total, balance_amount: 0, payment_method: [method] });
        }
        if (typeof local?.id === "number") {
          await repo.update("invoices", local.id, { status: "Paid", amountPaid: total, amountDue: 0 });
        }
        done += 1;
      } catch {
        /* continue other rows */
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
    showToast(`${done} ${done === 1 ? "invoice" : "invoices"} marked as paid (${method})`, "success");
    exitSelect();
  };

  /** Duplicate the selected invoice into another document collection. */
  const duplicateAs = async (label: string) => {
    const doc = selectedInvoiceDoc;
    const inv = selectedDb;
    const customerMongo = invoiceCustomerId(doc) || partyBackendId;
    const localCustomer =
      dbCustomers.find((c) => c.id === inv?.customerId) ||
      dbCustomers.find((c) => String(c._id) === customerMongo);
    const customerId =
      localCustomer?.id ??
      (typeof inv?.customerId === "number" ? inv.customerId : customerMongo ? numericId(customerMongo) : undefined);
    const customerName =
      localCustomer?.name ||
      selected?.name ||
      (doc?.customer_id && typeof doc.customer_id === "object" ? doc.customer_id.name : "") ||
      doc?.customer_name ||
      "";

    const items =
      (inv?.items?.length ? inv.items : null) ||
      detailLines.map((line, i) => ({
        id: i + 1,
        name: line.name,
        description: line.description,
        qty: line.qty,
        rate: line.rate,
        taxId: 1,
        discount: line.discount,
        amount: line.amount,
      }));

    const total = Number(inv?.total ?? detailTotal) || 0;
    const subTotal = Number(inv?.subTotal ?? detailSubTotal) || total;
    const tax = Number(inv?.tax ?? 0) || 0;
    const date =
      inv?.date ||
      (doc?.date ? new Date(doc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : fmtToday());
    const due = inv?.due || date;

    if (!customerId && label !== "As Purchase Order") {
      showToast("Customer missing — cannot duplicate", "warning");
      return;
    }

    const base = {
      customerId,
      customerName,
      date,
      due,
      ts: Date.now(),
      items,
      subTotal,
      tax,
      total,
      notes: inv?.notes || detailNotes || "",
      terms: inv?.terms || detailTerms || "",
      currency: inv?.currency || doc?.currency || "USD",
    };

    try {
      const create = async (col: any, extra: Record<string, any>) => {
        const n = await nextNumber(col);
        return repo.add(col, { ...base, number: "#" + n, ...extra });
      };
      switch (label) {
        case "As Invoice": {
          const id = await create("invoices", { status: "Draft", amountPaid: 0, amountDue: total });
          setSelectedId(id);
          await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
          showToast("Invoice duplicated", "success");
          break;
        }
        case "As Estimate": {
          const id = await create("estimates", { status: "Draft" });
          showToast("Estimate created", "success");
          navigate("/sales/estimates", { state: { selectedId: id } });
          break;
        }
        case "As Proforma Invoice": {
          const id = await create("proformas", { status: "Draft", amountPaid: 0, amountDue: total });
          showToast("Proforma invoice created", "success");
          navigate("/sales/proforma-invoices", { state: { selectedId: id } });
          break;
        }
        case "As Credit Note": {
          const id = await create("creditNotes", { status: "Unused", amountPaid: 0, amountDue: total, amountUsed: 0 });
          showToast("Credit note created", "success");
          navigate("/sales/credit-notes", { state: { selectedId: id } });
          break;
        }
        case "As Purchase Order": {
          const vendors = await repo.getAll("vendors");
          const id = await create("purchaseOrders", {
            vendorId: vendors[0]?.id ?? 1,
            status: "Draft",
            billStatus: "Not Billed",
            amountPaid: 0,
            amountDue: total,
          });
          showToast("Purchase order created", "success");
          navigate("/purchase/purchase-orders", { state: { selectedId: id } });
          break;
        }
        case "As Delivery Challan": {
          const id = await create("deliveryChallans", {
            status: "Draft",
            invoiceNo: inv?.number || selected?.number,
            invoiceStatus: "Invoiced",
            amountPaid: 0,
            amountDue: total,
          });
          showToast("Delivery challan created", "success");
          navigate("/sales/delivery-challan", { state: { selectedId: id } });
          break;
        }
        default:
          showToast(`Unknown duplicate target: ${label}`, "warning");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || err?.message || "Duplicate failed", "error");
    }
  };

  const handleMoreAction = (a: string) => {
    if (a === "whatsapp") showToast("Opening WhatsApp…", "info");
    else if (a === "packingSlip") setDocPreview("packingSlip");
    else if (a === "deliveryNote") setDocPreview("deliveryNote");
    else if (a.startsWith("dup:")) void duplicateAs(a.slice(4));
    else if (a.startsWith("mark:")) void markInvoiceStatus(a.slice(5));
    else if (a.startsWith("paid:")) void markAsPaid(a.slice(5), []);
    else if (a === "signature") setSigRequestOpen(true);
    else if (a === "activity") setActivityOpen(true);
    else if (a === "trash") setConfirmAction("trashOne");
  };

  const trashSelectedInvoices = async () => {
    const ids = [...checked].filter((id): id is number => typeof id === "number");
    const backendIds = filtered
      .filter((item) => checked.has(item.id) && item.backendId)
      .map((item) => String(item.backendId));
    if (statusFilter === "Trash") {
      if (backendIds.length) await hardDeleteInvoices(backendIds);
    } else if (ids.length) {
      await repo.removeMany("invoices", ids);
    }
    await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
    showToast(
      statusFilter === "Trash"
        ? `${checked.size} ${checked.size === 1 ? "invoice" : "invoices"} permanently deleted`
        : `${checked.size} ${checked.size === 1 ? "invoice" : "invoices"} moved to trash`,
      "success",
    );
    if ([...checked].includes(selectedId)) setSelectedId(filtered.find((i) => !checked.has(i.id))?.id ?? 0);
    setConfirmAction(null);
    exitSelect();
  };
  const trashCurrent = async () => {
    const backendId = selected?.backendId || selectedDb?._id;
    if (statusFilter === "Trash") {
      if (backendId) await hardDeleteInvoice(String(backendId));
    } else if (selectedDb?.id) {
      await repo.remove("invoices", selectedDb.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
    showToast(
      statusFilter === "Trash"
        ? `Invoice ${selected?.number || selectedDb.number} permanently deleted`
        : `Invoice ${selected?.number || selectedDb.number} moved to trash`,
      "success",
    );
    setSelectedId(
      filtered.find((i) => i.id !== selected?.id && i.backendId !== selected?.backendId)?.id ??
        filtered.find((i) => i.backendId !== selected?.backendId)?.backendId ??
        0,
    );
    setConfirmAction(null);
  };
  const restoreSelectedInvoices = async () => {
    const backendIds = filtered
      .filter((item) => checked.has(item.id) && item.backendId)
      .map((item) => String(item.backendId));
    if (backendIds.length === 0) { showToast("Select invoices to restore", "warning"); return; }
    await restoreInvoices(backendIds);
    await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
    showToast(`${backendIds.length} ${backendIds.length === 1 ? "invoice" : "invoices"} restored`, "success");
    exitSelect();
  };

  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id;
    let signaturePath = data.image;

    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `invoice-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        signaturePath = uploadRes.data?.data?.file_path || uploadRes.data?.data?.path || data.image;
        await updateInvoice(String(backendId), { signature: signaturePath });
        await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", String(backendId)] });
      }
      if (selectedDb?.id) {
        await repo.update("invoices", selectedDb.id, {
          signature: signaturePath,
          signatureName: data.name,
          signatureTitle: data.title,
          signatureDate: data.date,
        });
      }
      showToast("Signature saved", "success");
    } catch {
      showToast("Could not save signature", "error");
    }
  };

  /* ── selection mode ── */
  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const selectedInvoices = filtered.filter((i) => checked.has(i.id));
  const batchPaymentInvoices = useMemo((): BackendInvoiceDoc[] | undefined => {
    if (!selectMode || selectedInvoices.length === 0) return undefined;
    const docs = selectedInvoices
      .filter((inv) => inv.backendId)
      .map((inv) => {
        const row = backendInvoiceList?.rows?.find((r) => r._id === inv.backendId);
        const linkedDb =
          dbInvoices.find((item) => item._id === inv.backendId) ||
          dbInvoices.find((item) => String(item.number).replace(/^#/, "") === inv.number.replace(/^#/, ""));
        const customerId = row?.customerId || "";
        const detailCustomer =
          selectedInvoiceDoc && selectedInvoiceDoc._id === inv.backendId ? selectedInvoiceDoc.customer_id : undefined;
        return {
          _id: String(inv.backendId),
          invoice_number: inv.number.replace(/^#/, ""),
          currency: inv.currency || row?.currency || "USD",
          total: row?.amount ?? linkedDb?.total ?? num(inv.amount),
          balance_amount: row?.dueAmount ?? linkedDb?.amountDue ?? row?.amount ?? num(inv.amount),
          customer_id: customerId ? { _id: customerId, name: inv.name } : detailCustomer,
          customer_name: inv.name,
          payment_method: [],
        } satisfies BackendInvoiceDoc;
      });
    return docs.length > 0 ? docs : undefined;
  }, [selectMode, selectedInvoices, backendInvoiceList?.rows, dbInvoices, selectedInvoiceDoc]);
  const openAddPayment = () => {
    if (selectMode) {
      if (checked.size === 0) {
        showToast("Select invoices to add payment", "warning");
        return;
      }
      const withBackend = selectedInvoices.filter((inv) => inv.backendId);
      if (withBackend.length === 0) {
        showToast("Selected invoices are not synced to the server", "warning");
        return;
      }
      const rows = backendInvoiceList?.rows ?? [];
      const customerIds = withBackend
        .map((inv) => rows.find((r) => r._id === inv.backendId)?.customerId)
        .filter(Boolean) as string[];
      if (customerIds.length !== withBackend.length) {
        showToast("Some selected invoices have no linked customer", "warning");
        return;
      }
      if (new Set(customerIds).size > 1) {
        showToast("Selected invoices must belong to the same customer", "warning");
        return;
      }
    }
    setModal("payment");
  };
  const totals = {
    total: selectedInvoices.reduce((s, i) => s + num(i.amount), 0),
    paid: selectedInvoices.filter((i) => i.status === "Paid").reduce((s, i) => s + num(i.amount), 0),
    due: selectedInvoices.filter((i) => i.status === "Overdue").reduce((s, i) => s + num(i.amount), 0),
  };

  const exitSelect = () => {
    setSelectMode(false);
    setChecked(new Set());
  };
  const toggleRow = (id: number | string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) exitSelect();
    else setChecked(new Set(filtered.map((i) => i.id)));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const actionIcons: {
    icon: React.ElementType;
    title: string;
    onClick?: () => void;
  }[] = [
    { icon: Settings, title: "Settings", onClick: () => setModal("settings") },
    { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) },
    { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") },
    { icon: Pencil, title: "Edit", onClick: () => void openEditInvoice() },
    { icon: PenTool, title: "Customer Signature", onClick: () => setSigOpen(true) },
    { icon: DollarSign, title: "Add Payment", onClick: openAddPayment },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => setModal("preview") },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  const hasActiveListFilters =
    !!search.trim() ||
    statusFilter !== "All" ||
    customerFilter.length > 0;

  // Match Delivery Challan: only full-page empty when nothing selected and create is closed.
  // Create always opens inside the normal list + right-panel shell.
  if (!selected && !createOpen && !hasActiveListFilters) {
    return <ListEmptyState title="No invoices yet" onCreate={() => setCreateOpen(true)} createLabel="New Invoice" />;
  }

  return (
    <div className="relative flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Invoice" hideCreate={selectMode}>
        {/* List header — default vs. selection mode */}
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300">
            <button
              onClick={toggleAll}
              className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${
                allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"
              }`}
              title="Select all"
            >
              {allSelected && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
            <div className="flex items-center gap-0.5">
              {statusFilter === "Trash" && (
                <button
                  title="Restore"
                  onClick={() => (checked.size === 0 ? showToast("Select invoices to restore", "warning") : restoreSelectedInvoices())}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                ><RotateCcw className="w-4 h-4" /></button>
              )}
              <button
                title={statusFilter === "Trash" ? "Delete permanently" : "Delete"}
                onClick={() => (checked.size === 0 ? showToast("Select invoices to delete", "warning") : setConfirmAction("trashSelected"))}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              ><Trash2 className="w-4 h-4" /></button>
              {/* $ → Add Payment / Mark as Paid ▸ (payment-method submenu) */}
              <Dropdown
                align="right"
                trigger={
                  <span title="Payments" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer">
                    <DollarSign className="w-4 h-4" />
                  </span>
                }
              >
                {(close) => (
                  <PaidMenu
                    close={close}
                    methods={paymentMethodNames}
                    onAddPayment={openAddPayment}
                    onMarkPaid={(m) => (checked.size === 0 ? showToast("Select invoices to mark as paid", "warning") : markAsPaid(m))}
                  />
                )}
              </Dropdown>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp…", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Invoices</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Invoices")} className="p-1.5 hover:bg-gray-100 rounded-md">
                <Search className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => setSelectMode(true)}
                className="p-1.5 hover:bg-gray-100 rounded-md"
                title="Select invoices"
              >
                <Pencil className="w-4 h-4 text-gray-500" />
              </button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>
                {(close) => (
                  <>
                    <button onClick={() => { openListImport("invoices"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button>
                    <button onClick={() => { openListExport("invoices"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search invoices..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Toolbar: sort + filter chips */}
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          {/* Sort by: fields + direction */}
          <Dropdown
            trigger={
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">
                Sort by | <span className="text-gray-800 font-medium">{sortBy}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            }
          >
            {() => (
              <>
                {sortFields.map((o) => (
                  <button
                    key={o}
                    onClick={() => setSortBy(o)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    {o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
                <div className="border-t border-gray-200 my-1" />
                {(["Ascending", "Descending"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSortDir(d)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    {d} {d === sortDir && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </>
            )}
          </Dropdown>

          {/* Status filter */}
          <Dropdown
            trigger={
              <span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400">
                <Plus className="w-3 h-3" />
                Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}
              </span>
            }
          >
            {(close) =>
              statusList.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    close();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                    s === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"
                  }`}
                >
                  {s} {s === statusFilter && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))
            }
          </Dropdown>

          <PartyFilterPopover
            kind="customer"
            appliedIds={customerFilter}
            appliedLabels={customerFilterLabels}
            onApply={(ids, labels) => {
              setCustomerFilter(ids);
              setCustomerFilterLabels(labels);
            }}
          />
        </div>

        {/* List rows — FAB stays outside the scroller so it remains clickable */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
            {filtered.map((inv) => {
              const active = !selectMode && !createOpen && !editOpen && (inv.backendId ? inv.backendId === selected?.backendId : inv.id === selectedId);
              const isChecked = checked.has(inv.id);
              const rowCustomer = dbCustomers.find((c) => c.id === dbInvoices.find((item) => item.id === inv.id)?.customerId);
              const rowSubtitle = customerDisplaySubtitle(rowCustomer) || inv.note;
              return (
                <button
                  key={inv.backendId || inv.id}
                  type="button"
                  onClick={() => (selectMode ? toggleRow(inv.id) : (setSelectedId(inv.backendId || inv.id), setCreateOpen(false), setEditOpen(false), setEditInvoice(null)))}
                  className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${
                    active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  {selectMode && (
                    <span
                      className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${
                        isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{inv.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{inv.number}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{rowSubtitle || "No Notes"}</div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-gray-500">{inv.date}</span>
                    <span className="text-sm font-semibold text-gray-900 mt-0.5">{inv.amount}</span>
                    <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[inv.status]}`}>
                      {statusLabel(inv.status)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <ListSidebarFooter
          total={<>{money(listDue)} Due</>}
          countLabel={`${listPagination?.totalData ?? filtered.length} Invoices`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL: create/edit form / selection summary / detail ════════ */}
      {createOpen || (!selected && hasActiveListFilters) ? (
        <CreateInvoiceForm
          key={createPrefillCustomer?.backendId || createPrefillCustomer?.localId || "new"}
          prefillCustomer={createPrefillCustomer}
          onClose={() => { setCreateOpen(false); setCreatePrefillCustomer(undefined); }}
          onSaved={(id) => { setSortBy("Created On"); setSortDir("Descending"); setSelectedId(id); setCreatePrefillCustomer(undefined); void queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] }); }}
        />
      ) : editOpen && editInvoice ? (
        <CreateInvoiceForm
          key={String(editInvoice._id || editInvoice.id || selectedId)}
          invoice={editInvoice}
          onClose={() => { setEditOpen(false); setEditInvoice(null); }}
          onSaved={(id) => {
            setSelectedId(editInvoice._id || id);
            setEditOpen(false);
            setEditInvoice(null);
            void queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
            if (editInvoice._id) {
              void queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", String(editInvoice._id)] });
            }
          }}
        />
      ) : selectMode ? (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">
              {checked.size} {checked.size === 1 ? "Invoice" : "Invoices"} Selected
            </h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">{money(totals.total)}</span>
              <span className="text-gray-500">Paid</span>
              <span className="font-semibold text-green-500">{money(totals.paid)}</span>
              <span className="text-gray-500">Due</span>
              <span className="font-semibold text-red-500">{money(totals.due)}</span>
            </div>
          </div>
        </section>
      ) : (
      <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="h-12 flex items-center justify-between gap-3 px-6 border-b border-gray-300 bg-gray-100">
            <DocPartyHeader
              party="customer"
              partyId={partyBackendId}
              title={selected?.name}
              subtitle={customerDisplaySubtitle(selectedCustomer) || selected?.customerSubtitle || ""}
            />
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {actionIcons.map((a) => (
                <button
                  key={a.title}
                  title={a.title}
                  onClick={a.onClick}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  <a.icon className="w-4 h-4" />
                </button>
              ))}
              <Dropdown align="right" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                {(close) => (
                  <InvoiceMoreMenu
                    close={close}
                    onAction={handleMoreAction}
                    paymentMethods={paymentMethodNames}
                  />
                )}
              </Dropdown>
            </div>
          </div>

          {/* Expandable info panel (chevron toggle in the header) */}
          {expanded && (
          <>
          {/* Meta row */}
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-300">
            <div className="flex items-center gap-10">
              <div>
                <div className="text-xs text-gray-500">{selected.number}</div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedInvoiceDoc ? apiMoney(selectedInvoiceDoc.total || 0, selectedInvoiceDoc.currency) : selected.amount}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Invoice date</div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedInvoiceDoc?.date ? new Date(selectedInvoiceDoc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : selected.date}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Due</div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedInvoiceDoc?.due_date ? new Date(selectedInvoiceDoc.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : selected.due}
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[selected.status]}`}>
              {statusLabel(selected.status)}
            </span>
          </div>

          {/* Addresses + payment methods */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-5 py-4 border-b border-gray-300">
            <div>
              <div className="text-xs text-gray-500 mb-1">Billing Address</div>
              {(selectedInvoiceDoc ? invoiceAddressLines(selectedInvoiceDoc.billing_address) : [selectedCustomer.street1, selectedCustomer.street2, [selectedCustomer.city, selectedCustomer.zip].filter(Boolean).join(" "), selectedCustomer.country].filter(Boolean)).length
                ? (selectedInvoiceDoc ? invoiceAddressLines(selectedInvoiceDoc.billing_address) : [selectedCustomer.street1, selectedCustomer.street2, [selectedCustomer.city, selectedCustomer.zip].filter(Boolean).join(" "), selectedCustomer.country].filter(Boolean)).map((l: string, i: number) => (
                    <div key={i} className={`text-sm ${i === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{l}</div>
                  ))
                : <div className="text-sm text-gray-400">—</div>}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Shipping Address</div>
              {(selectedInvoiceDoc ? invoiceAddressLines(selectedInvoiceDoc.shipping_address) : [selectedCustomer.shipStreet1, selectedCustomer.shipStreet2, [selectedCustomer.shipCity, selectedCustomer.shipZip].filter(Boolean).join(" "), selectedCustomer.shipCountry].filter(Boolean)).length
                ? (selectedInvoiceDoc ? invoiceAddressLines(selectedInvoiceDoc.shipping_address) : [selectedCustomer.shipStreet1, selectedCustomer.shipStreet2, [selectedCustomer.shipCity, selectedCustomer.shipZip].filter(Boolean).join(" "), selectedCustomer.shipCountry].filter(Boolean)).map((l: string, i: number) => (
                    <div key={i} className={`text-sm ${i === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{l}</div>
                  ))
                : <div className="text-sm text-gray-400">—</div>}
            </div>
            <div>
              <button
                type="button"
                onClick={() => setPaymentMethodsOpen(true)}
                className="mb-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Payment Methods <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethodsOpen(true)}
                className="block w-full text-left"
                title="Select payment methods"
              >
                <DynamicPaymentBadges names={selectedInvoiceDoc?.payment_method ?? []} options={paymentMethodOptions} />
              </button>
            </div>
          </div>

          {/* Sub meta */}
          <div className="grid grid-cols-3 gap-6 px-5 py-3 border-b border-gray-300">
            <div>
              <div className="text-xs text-gray-500">Sub Title</div>
              <div className="text-sm font-semibold text-gray-900">{selectedInvoiceDoc?.sub_title || selectedDb.subTitle || selectedCustomer.subtitle || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Shipping Method</div>
              <div className="text-sm font-semibold text-gray-900">{selectedInvoiceDoc?.shipping_method || selectedDb.shippingMethod || "Standard Ground"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">P.O. #</div>
              <div className="text-sm font-semibold text-gray-900">{selectedInvoiceDoc?.po || selectedDb.poNo || selectedDb.id || "—"}</div>
            </div>
          </div>
          </>
          )}

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left font-semibold px-5 py-2.5">Sr. No.</th>
                  <th className="text-left font-semibold px-2 py-2.5">Items</th>
                  <th className="text-right font-semibold px-2 py-2.5">Quantity</th>
                  <th className="text-right font-semibold px-2 py-2.5">MRP</th>
                  <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                  <th className="text-left font-semibold px-2 py-2.5">Tax</th>
                  <th className="text-right font-semibold px-2 py-2.5">Discount</th>
                  <th className="text-right font-semibold px-5 py-2.5">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detailLines.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>
                )}
                {detailLines.map((it, idx) => (
                  <tr key={it.id} className="border-b border-gray-300 align-top">
                    <td className="px-5 py-3 text-gray-700">{idx + 1}</td>
                    <td className="px-2 py-3">
                      <div className="font-semibold text-gray-900">{it.name}</div>
                      {it.description && <div className="text-xs text-gray-500 mt-1">{it.description}</div>}
                    </td>
                    <td className="px-2 py-3 text-right text-gray-800">{it.qty}</td>
                    <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(0)}</td>
                    <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(it.rate)}</td>
                    <td className="px-2 py-3 text-gray-800">{it.tax ? `${it.tax}%` : "—"}</td>
                    <td className="px-2 py-3 text-right text-gray-500 text-xs">{it.discount ? fmtMoney(it.discount) : "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Terms / Notes / Totals — live from the selected invoice */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
            <div>
              <label className="text-xs text-gray-500">Terms &amp; Conditions</label>
              <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                {detailTerms}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Notes</label>
              <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">
                {detailNotes}
              </div>
            </div>
            <div className="border border-gray-200 rounded-md overflow-hidden self-start">
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-700">Sub Total</span>
                <span className="font-semibold text-gray-900">{fmtMoney(detailSubTotal)}</span>
              </div>
              {detailLines.some((it) => it.tax > 0) && (
                <div className="flex justify-between px-4 py-2 text-xs text-gray-500">
                  <span>Tax</span>
                  <span>{fmtMoney(Math.max(0, detailTotal - detailSubTotal + detailLines.reduce((s, it) => s + it.discount, 0)))}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-200">
                <span className="text-gray-700">Total</span>
                <span className="font-semibold text-gray-900">{fmtMoney(detailTotal)}</span>
              </div>
              {detailPaid > 0 && (
                <div className="flex justify-between px-4 py-2 text-sm">
                  <span className="text-gray-700">Amount Paid</span>
                  <span className="font-semibold text-gray-900">{fmtMoney(detailPaid)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 bg-gray-100">
                <span className="font-semibold text-gray-900">Amount Due</span>
                <span className="font-semibold text-gray-900">{fmtMoney(detailDue)}</span>
              </div>
            </div>
          </div>

          {/* Attachment */}
          <div className="px-5 pb-6 max-w-md">
            <DocAttachmentField
              value={selectedInvoiceDoc?.Attachment || selectedDb?.Attachment || selectedDb?.attachments || ""}
              onChange={async (path) => {
                const backendId = selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id;
                if (!backendId) {
                  showToast("Save the invoice first", "error");
                  throw new Error("missing id");
                }
                await updateInvoice(String(backendId), { Attachment: path });
                await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", String(backendId)] });
                await queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
                if (selectedDb?.id) {
                  await repo.update("invoices", selectedDb.id, { Attachment: path });
                }
                showToast(path ? "Attachment saved" : "Attachment removed", "success");
              }}
            />
          </div>

          {/* saved signature (shows after Add Signature) */}
          <SignatureBlock
            record={{
              ...selectedDb,
              signature: selectedInvoiceDoc?.signature || selectedDb.signature,
              signatureName: selectedDb.signatureName,
              signatureTitle: selectedDb.signatureTitle,
              signatureDate: selectedDb.signatureDate,
            }}
            label="Customer Signature"
          />

          {/* Draft corner ribbon */}
          {selected.status === "Draft" && (
            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className="absolute bottom-[18px] -left-[34px] w-32 rotate-45 bg-gray-600 text-white text-[10px] font-semibold py-1 text-center">
                Draft
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ════════ MODALS (opened via detail action icons) ════════ */}
      {modal === "settings" && <AppSettingsModal initialTab="Invoice" onClose={() => setModal(null)} />}
      {modal === "preview" && (() => {
        // In select mode with several rows ticked, merge them all into one PDF;
        // otherwise preview the single active record.
        const batchIds = selectMode ? [...checked].filter((id): id is number => typeof id === "number") : [];
        const d: any =
          (batchIds.length
            ? dbInvoices.find((i) => i.id === batchIds[0])
            : dbInvoices.find(
                (i) =>
                  i.id === selectedId ||
                  i._id === selectedId ||
                  i._id === selected?.backendId ||
                  i.id === selected?.id,
              )) ||
          selectedDb ||
          {};
        const cp: any = dbCustomers.find((c) => c.id === d.customerId) || {};
        const cn = cp.name || "—";
        const ht =
          selectMode && selectedInvoices.length
            ? "Invoice " + selectedInvoices.map((i) => i.number.replace("#", "")).join(", ")
            : `Invoice${d.number || selected?.number || ""}`;
        void cn;
        void cp;
        const pdfBackendId = String(
          selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id || d?._id || "",
        );
        const pdfRecordId = Number(d.id || selectedDb?.id || selected?.id) || 0;
        return (
          <DocTypePreview
            docType="invoice"
            title={ht}
            recordId={pdfRecordId}
            recordIds={batchIds.length > 1 ? batchIds : undefined}
            backendId={pdfBackendId || undefined}
            onClose={() => setModal(null)}
          />
        );
      })()}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} />}
      {modal === "payment" && (
        <InvoicePaymentsModal
          open
          invoices={batchPaymentInvoices}
          invoice={
            batchPaymentInvoices?.[0] ??
            selectedInvoiceDoc ?? {
              _id: String(selectedDb._id || selected?.backendId || ""),
              invoice_number: selectedDb.number?.replace(/^#/, "") || selected?.number?.replace(/^#/, "") || "",
              currency: selectedDb.currency || selected?.currency || "USD",
              total: selectedDb.total || num(selected?.amount || "0"),
              balance_amount: selectedDb.amountDue ?? detailDue,
              customer_id: selectedCustomer._id
                ? { _id: String(selectedCustomer._id), name: selectedCustomer.contact || selectedCustomer.name }
                : undefined,
              customer_name: selected?.name,
              payment_method: [],
            }
          }
          paymentMethods={paymentMethodOptions}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      {modal === "pdfSettings" && (
        <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="invoice" />
      )}
      {paymentMethodsOpen && (
        <PaymentMethodsModal
          selectedNames={selectedInvoiceDoc?.payment_method ?? []}
          onSaveSelection={async (names) => {
            const backendId = selectedInvoiceDoc?._id || selected?.backendId;
            if (!backendId) {
              showToast("Select an invoice first", "warning");
              return;
            }
            try {
              await updateInvoice(String(backendId), { payment_method: names });
              await queryClient.invalidateQueries({
                queryKey: ["sales-invoice-backend-detail", String(backendId)],
              });
              showToast("Payment methods updated", "success");
            } catch {
              showToast("Could not update payment methods", "error");
            }
          }}
          onClose={() => setPaymentMethodsOpen(false)}
        />
      )}
      {sigOpen && (
        <SignatureModal
          heading="Customer Signature"
          defaultName={
            selectedCustomer.contact ||
            selectedCustomer.name ||
            (selectedInvoiceDoc?.customer_id && typeof selectedInvoiceDoc.customer_id === "object"
              ? selectedInvoiceDoc.customer_id.name || selectedInvoiceDoc.customer_name || ""
              : selectedInvoiceDoc?.customer_name || "")
          }
          onDone={saveSignature}
          onClose={() => setSigOpen(false)}
        />
      )}
      {sigRequestOpen && (
        <SignatureRequestModal
          docLabel="Invoice"
          number={
            selectedInvoiceDoc?.invoice_number
              ? `#${selectedInvoiceDoc.invoice_number}`
              : selectedDb.number || selected?.number || ""
          }
          customer={{
            ...selectedCustomer,
            name:
              selectedCustomer.name ||
              selected?.name ||
              (selectedInvoiceDoc?.customer_id && typeof selectedInvoiceDoc.customer_id === "object"
                ? selectedInvoiceDoc.customer_id.name
                : "") ||
              selectedInvoiceDoc?.customer_name ||
              "",
            email:
              selectedCustomer.email ||
              (selectedInvoiceDoc?.customer_id && typeof selectedInvoiceDoc.customer_id === "object"
                ? (selectedInvoiceDoc.customer_id as any).email
                : "") ||
              "",
          }}
          documentId={String(selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="invoice"
          emailNav="invoice"
          pdfDocType="invoice"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{
            status:
              selectedInvoiceDoc?.status && selectedInvoiceDoc.status !== "Draft"
                ? selectedInvoiceDoc.status
                : "Open",
          }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-list"] });
            const bid = selectedInvoiceDoc?._id || selected?.backendId;
            if (bid) void queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", String(bid)] });
          }}
        />
      )}
      {docPreview && (
        <DocTypePreview
          docType={docPreview}
          title={`${docPreview === "packingSlip" ? "Packing Slip" : "Delivery Note"} ${selected.number}`}
          recordId={Number(selectedDb?.id || selected?.id) || 0}
          backendId={String(selectedInvoiceDoc?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          onClose={() => setDocPreview(null)}
        />
      )}
      {activityOpen && (
        <ActivityLogModal invoice={selectedDb} payments={invoicePayments} onClose={() => setActivityOpen(false)} />
      )}
      {confirmAction === "trashOne" && (
        <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete this invoice? This cannot be undone." : "Are you sure want to trash this invoice?"} onNo={() => setConfirmAction(null)} onYes={trashCurrent} />
      )}
      {confirmAction === "trashSelected" && (
        <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete these invoices? This cannot be undone." : "Are you sure want to delete these invoices?"} onNo={() => setConfirmAction(null)} onYes={trashSelectedInvoices} />
      )}
    </div>
  );
};
