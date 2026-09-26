/**
 * File: src/pages/Reports.tsx
 * Reports hub — theme-aware (Appearance Light / Dark via remapped gray/white utilities).
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import {
  loadReportView,
  reportFilterKind,
  today,
  yearStart,
  yearEnd,
  type ReportView,
} from "@/services/reportsApi";
import { isSalesReport } from "@/services/salesReportsApi";
import { isPurchaseReport } from "@/services/purchaseReportsApi";
import { isMiscReport } from "@/services/miscReportsApi";
import type { BusinessOverviewView } from "@/services/businessOverviewApi";
import type { DatePeriodKey, ReportFilters } from "@/services/reportTypes";
import {
  exportReportCsv,
  exportReportHtml,
  exportReportPdf,
  exportReportXlsx,
  buildReportPdfObjectUrl,
  printReportPdf,
  emailReportPdf,
  suggestGroupByLabel,
  type ExportGrid,
} from "@/lib/reportExport";
import { fetchCustomers } from "@/services/customersApi";
import { fetchVendors } from "@/services/vendorsApi";
import { fetchProducts } from "@/services/productsApi";
import { fetchServices } from "@/services/servicesApi";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { api } from "@/lib/api/client";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  Download,
  Printer,
  MessageCircle,
  Mail,
  AlignLeft,
  X,
  XCircle,
  Loader2,
  Plus,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const categories: { title: string; items: string[] }[] = [
  {
    title: "Business Overview",
    items: ["Summary Report", "Quarters Report", "Profit by Product Report", "Profit & Loss"],
  },
  {
    title: "Sales",
    items: [
      "Invoice Aging Report",
      "Sales Report",
      "Estimate Report",
      "Payment Report",
      "Sales by Customer Report",
      "Sales by User Report",
      "Sales Report by Product",
      "Sales Report by Service",
      "Sales by Category Report",
    ],
  },
  {
    title: "Purchases & Expenses",
    items: [
      "Bill Report",
      "Purchase Order Report",
      "Purchase Order By Company",
      "Purchase by Product Report",
      "Purchase by Service Report",
      "Payment Made Report",
      "Expense Report",
    ],
  },
  { title: "Items", items: ["Stock Report"] },
  { title: "Projects & Time Sheet", items: ["Project Report", "Time Log Report"] },
  { title: "Taxes", items: ["Tax Report"] },
];

const DATE_OPTIONS: DatePeriodKey[] = ["All", "This Month", "Last 30 Days", "This Year", "Custom"];
const REPORT_TYPES = ["PDF", "CSV", "XLSX", "XLS", "HTML"] as const;
const PRODUCT_TYPES = ["All", "Standard", "Multi-variant"] as const;
const DOC_TYPES = ["All", "Invoice", "Delivery Challan", "Sales Receipt"] as const;
const INVOICE_STATUSES = ["All", "Draft", "Open", "Partial", "Paid", "Overdue", "Void"] as const;
const ESTIMATE_STATUSES = ["All", "Draft", "Sent", "Approved", "Received", "Open", "Invoiced", "Void"] as const;
const BILL_STATUSES = ["All", "Draft", "Open", "Partial", "Paid", "Overdue", "Void"] as const;
const PO_STATUSES = ["All", "Draft", "Sent", "Approved", "Received", "Closed", "Posted", "Partial", "Paid"] as const;
const GROUP_BY_OPTIONS = ["None", "Company Info"] as const;
const STOCK_STATUSES = ["All", "Active", "Archived"] as const;
const PROJECT_STATUSES = ["All", "Ongoing", "Onhold", "Finished"] as const;
const TIMELOG_STATUSES = ["All", "Invoiced", "Inactive"] as const;

const isBoReport = (name: string) =>
  name === "Summary Report" ||
  name === "Quarters Report" ||
  name === "Profit by Product Report" ||
  name === "Profit & Loss";

/* ── Pill dropdown (theme-aware) ─────── */
const PillDropdown: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
  children: (close: () => void) => React.ReactNode;
}> = ({ label, value, accent, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap bg-transparent ${
          accent
            ? "border-blue-500 text-blue-600"
            : "border-gray-300 text-gray-900 hover:border-gray-400"
        }`}
      >
        {accent && <XCircle className="w-3.5 h-3.5 text-blue-600" />}
        <span className={accent ? "text-blue-600" : "text-gray-500"}>{label}</span>
        <span className="text-gray-400">|</span>
        <span className={accent ? "text-blue-600 font-medium" : "text-gray-900 font-medium"}>{value}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute z-40 mt-2 min-w-[220px] max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl py-1">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-100 ${
      active ? "text-blue-600" : "text-gray-800"
    }`}
  >
    <span className="truncate">{children}</span>
    {active && <Check className="w-4 h-4 flex-shrink-0" />}
  </button>
);

type PartyOption = { id: string; label: string; role?: "customer" | "vendor"; subtitle?: string };

/** Searchable Contacts/Customers pill — options load from backend via searchTerm. */
const SearchablePartyPill: React.FC<{
  label: string;
  valueLabel: string;
  options: PartyOption[];
  selectedId: string;
  loading?: boolean;
  search: string;
  onSearch: (q: string) => void;
  onSelectAll: () => void;
  onSelect: (opt: PartyOption) => void;
}> = ({ label, valueLabel, options, selectedId, loading, search, onSearch, onSelectAll, onSelect }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1 text-xs whitespace-nowrap text-gray-900 bg-transparent hover:border-gray-400"
      >
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-900 font-medium max-w-[140px] truncate">{valueLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute z-40 mt-2 w-[280px] rounded-md border border-gray-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <MenuItem
              active={!selectedId}
              onClick={() => {
                onSelectAll();
                setOpen(false);
              }}
            >
              All
            </MenuItem>
            {loading && (
              <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
              </div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-500">No matches</div>
            )}
            {options.map((opt) => (
              <MenuItem
                key={`${opt.role || "x"}-${opt.id}`}
                active={selectedId === opt.id}
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{opt.label}</span>
                  {(opt.role || opt.subtitle) && (
                    <span className="text-[10px] text-gray-500 uppercase truncate">
                      {opt.subtitle || opt.role}
                    </span>
                  )}
                </span>
              </MenuItem>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const QaydFooterBrand: React.FC = () => (
  <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
    <img src="/qayd.png" alt="Qayd" className="h-3.5 w-3.5 object-contain opacity-90" />
    <span>Created by Qayd</span>
  </div>
);

const asBo = (report: ReportView | undefined): BusinessOverviewView | null => {
  if (!report || report.source !== "backend") return null;
  const bo = report as BusinessOverviewView;
  if (bo.layout === "summary" || bo.layout === "quarters" || bo.layout === "pnl" || bo.layout === "table") return bo;
  return null;
};

const toExportGrid = (report: ReportView): ExportGrid => ({
  name: report.name,
  cols: report.cols.map((c) => c.label),
  rows: report.rows,
  totals: report.totals,
  meta: report.meta,
  metaLines: [
    report.meta?.from && report.meta?.to ? `Period: ${report.meta.from} → ${report.meta.to}` : "",
    report.meta?.asOf ? `As of: ${report.meta.asOf}` : "",
  ].filter(Boolean),
  groupByLabel: suggestGroupByLabel(report.name),
});

const EXPORT_FORMATS = ["CSV", "XLSX", "XLS", "PDF", "HTML"] as const;

/** Toolbar / modal download — opens format dropdown then exports. */
const DownloadFormatMenu: React.FC<{
  disabled?: boolean;
  onPick: (kind: (typeof EXPORT_FORMATS)[number]) => void;
  buttonClassName?: string;
}> = ({ disabled, onPick, buttonClassName }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Download"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={
          buttonClassName ||
          "w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        }
      >
        <Download className="w-4 h-4" />
      </button>
      {open && !disabled && (
        <div className="absolute right-0 z-50 mt-1 min-w-[120px] rounded-md border border-gray-200 bg-white shadow-xl py-1">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                onPick(f);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Real PDF preview — same blob as Download PDF. */
const ReportPdfPreviewModal: React.FC<{
  report: ReportView;
  onClose: () => void;
}> = ({ report, onClose }) => {
  const grid = useMemo(() => toExportGrid(report), [report]);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let alive = true;
    setUrl(null);
    void buildReportPdfObjectUrl(grid)
      .then((u) => {
        if (!alive) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [grid]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-5xl my-6 rounded-lg overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3 bg-gray-100 border-b border-gray-200 text-gray-900">
          <h3 className="text-base font-medium">{report.name}</h3>
          <div className="flex items-center gap-1">
            <DownloadFormatMenu
              buttonClassName="w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200"
              onPick={(kind) => {
                if (kind === "CSV") exportReportCsv(grid);
                else if (kind === "XLSX") exportReportXlsx(grid, "xlsx");
                else if (kind === "XLS") exportReportXlsx(grid, "xls");
                else if (kind === "HTML") exportReportHtml(grid);
                else void exportReportPdf(grid);
              }}
            />
            <button
              type="button"
              title="Print"
              onClick={() => void printReportPdf(grid)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Email"
              onClick={() => void emailReportPdf(grid)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200"
            >
              <Mail className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="bg-gray-200 min-h-[70vh]">
          {url ? (
            <iframe title={`${report.name} PDF`} src={url} className="w-full h-[75vh] bg-white border-0" />
          ) : (
            <div className="flex items-center justify-center h-[75vh] text-gray-600 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating PDF…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MoneyCell: React.FC<{ value: string; green?: boolean }> = ({ value, green }) => (
  <div className={`text-right whitespace-pre-line leading-snug ${green ? "text-green-600" : "text-gray-900"}`}>
    {value}
  </div>
);

/* ── Report layouts (theme-aware surfaces) ─────── */
const SummaryLayout: React.FC<{ report: BusinessOverviewView }> = ({ report }) => {
  const blocks = report.summaryBlocks || [];
  return (
    <div className="w-full">
      {blocks.map((block, bi) => (
        <div key={block.title} className={bi > 0 ? "border-t border-gray-200" : ""}>
          <div className="px-4 py-2.5 text-sm font-bold text-gray-900 bg-gray-100 border-b border-gray-200">
            {block.title}
          </div>
          <table className="w-full text-sm">
              <tbody>
              {block.lines.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500 border-b border-gray-200" colSpan={2}>
                    No data
                  </td>
                  </tr>
              ) : (
                block.lines.map((line) => (
                  <tr key={`${block.title}-${line.label}`} className="border-b border-gray-200">
                    <td className="px-4 py-2.5 text-gray-900 font-medium align-top w-[40%]">{line.label}</td>
                    <td className="px-4 py-2.5 text-right align-top">
                      {line.values.map((v, i) => (
                        <div key={i} className="text-gray-900">
                          {v}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
      ))}
    </div>
  );
};

const QuartersLayout: React.FC<{ report: BusinessOverviewView; visibleCols: Set<string> }> = ({
  report,
  visibleCols,
}) => {
  const blocks = report.quarterBlocks || [];
  const show = (label: string) => visibleCols.has(label);
  return (
    <div className="w-full">
      {blocks.length === 0 ? (
        <div className="px-4 py-8 text-sm text-gray-500">No quarter data for the selected filters.</div>
      ) : (
        blocks.map((q) => (
          <div key={q.title} className="border-b border-gray-200">
            <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-gray-100 border-b border-gray-200 text-gray-900 text-xs font-bold">
              <div className="text-sm">{q.title}</div>
              {show("Paid") ? <div className="text-right">Paid</div> : <div />}
              {show("Due") ? <div className="text-right">Due</div> : <div />}
              {show("Overdue") ? <div className="text-right">Overdue</div> : <div />}
              {show("Total") ? <div className="text-right">Total</div> : <div />}
            </div>
            {q.months.map((m) => (
              <div
                key={m.label}
                className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-gray-200 text-sm items-start"
              >
                {show("Month") ? <div className="text-gray-900 font-semibold">{m.label}</div> : <div />}
                {show("Paid") ? <MoneyCell value={m.paid} green /> : <div />}
                {show("Due") ? <MoneyCell value={m.due} /> : <div />}
                {show("Overdue") ? <MoneyCell value={m.overdue} /> : <div />}
                {show("Total") ? <MoneyCell value={m.total} green /> : <div />}
              </div>
            ))}
            <div className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-gray-200 text-sm font-semibold items-start">
              {show("Month") ? <div className="text-gray-900">Total</div> : <div />}
              {show("Paid") ? <MoneyCell value={q.totals.paid} green /> : <div />}
              {show("Due") ? <MoneyCell value={q.totals.due} /> : <div />}
              {show("Overdue") ? <MoneyCell value={q.totals.overdue} /> : <div />}
              {show("Total") ? <MoneyCell value={q.totals.total} green /> : <div />}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const TableLayout: React.FC<{ report: ReportView; visibleCols: Set<string> }> = ({ report, visibleCols }) => {
  const cols = report.cols.filter((c) => visibleCols.has(c.label));
  const idx = report.cols.map((c, i) => (visibleCols.has(c.label) ? i : -1)).filter((i) => i >= 0);
  const rows = report.rows.map((r) => idx.map((i) => r[i] ?? ""));
  const totals = idx.map((i) => report.totals[i] ?? "");

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-100 border-b border-gray-200">
          {cols.map((c) => (
            <th
              key={c.label}
              className={`px-4 py-2.5 text-xs font-bold text-gray-900 whitespace-nowrap ${c.right ? "text-right" : "text-left"}`}
            >
              {c.label}
            </th>
          ))}
        </tr>
            </thead>
            <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={cols.length} className="px-4 py-10 text-center text-gray-500 border-b border-gray-200">
              No rows for the selected filters.
            </td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-2.5 text-gray-900 whitespace-pre-line ${cols[j]?.right ? "text-right" : "text-left"} ${
                    j === 0 ? "font-semibold" : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
        {rows.length > 0 && (
          <tr className="border-b border-gray-200 font-semibold bg-gray-50">
            {totals.map((cell, j) => (
              <td key={j} className={`px-4 py-2.5 text-gray-900 whitespace-pre-line ${cols[j]?.right ? "text-right" : "text-left"}`}>
                {cell}
              </td>
            ))}
          </tr>
        )}
            </tbody>
          </table>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const Reports: React.FC = () => {
  const [open, setOpen] = useState<Record<string, boolean>>({ "Business Overview": true });
  const [active, setActive] = useState("Summary Report");
  const [pdf, setPdf] = useState(false);

  // Shared / legacy filters
  const [asOfDate, setAsOfDate] = useState(today());
  const [fromDate, setFromDate] = useState(yearStart());
  const [toDate, setToDate] = useState(yearEnd());
  const [showZero, setShowZero] = useState(false);

  // BO pill filters
  const [period, setPeriod] = useState<DatePeriodKey>("All");
  const [contactId, setContactId] = useState("");
  const [contactRole, setContactRole] = useState<"customer" | "vendor" | "">("");
  const [contactLabel, setContactLabel] = useState("All");
  const [contactSearch, setContactSearch] = useState("");
  const [contactSearchDebounced, setContactSearchDebounced] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("All");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("All");
  const [productId, setProductId] = useState("");
  const [productLabel, setProductLabel] = useState("All");
  const [productType, setProductType] = useState<string>("All");
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>("PDF");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set());

  // Sales filters
  const [docType, setDocType] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [salespersonId, setSalespersonId] = useState("");
  const [salespersonLabel, setSalespersonLabel] = useState("All");
  const [userFilterId, setUserFilterId] = useState("");
  const [userFilterLabel, setUserFilterLabel] = useState("All");
  const [serviceId, setServiceId] = useState("");
  const [serviceLabel, setServiceLabel] = useState("All");
  const [paymentType, setPaymentType] = useState("All");
  const [paymentTerms, setPaymentTerms] = useState("All");
  const [vendorId, setVendorId] = useState("");
  const [vendorLabel, setVendorLabel] = useState("All");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorSearchDebounced, setVendorSearchDebounced] = useState("");
  const [groupBy, setGroupBy] = useState("None");
  const [projectId, setProjectId] = useState("");
  const [projectLabel, setProjectLabel] = useState("All");

  const boMode = isBoReport(active);
  const salesMode = isSalesReport(active);
  const purchaseMode = isPurchaseReport(active);
  const miscMode = isMiscReport(active);
  const filterKind = reportFilterKind(active);

  const reportFilters: ReportFilters = useMemo(
    () => ({
      period,
      fromDate: period === "Custom" ? fromDate : undefined,
      toDate: period === "Custom" ? toDate : undefined,
      contactId: contactId || undefined,
      contactRole: contactRole || undefined,
      customerId: customerId || undefined,
      vendorId: vendorId || undefined,
      categoryId: categoryId || undefined,
      categoryLabel: categoryLabel !== "All" ? categoryLabel : undefined,
      productId: productId || undefined,
      serviceId: serviceId || undefined,
      productType,
      reportType,
      showZero,
      asOfDate,
      status: statusFilter,
      salespersonId: salespersonId || undefined,
      userId: userFilterId || undefined,
      docType,
      paymentType,
      paymentTerms,
      groupBy,
      projectId: projectId || undefined,
    }),
    [
      period,
      fromDate,
      toDate,
      contactId,
      contactRole,
      customerId,
      vendorId,
      categoryId,
      categoryLabel,
      productId,
      serviceId,
      productType,
      reportType,
      showZero,
      asOfDate,
      statusFilter,
      salespersonId,
      userFilterId,
      docType,
      paymentType,
      paymentTerms,
      groupBy,
      projectId,
    ],
  );

  const { data: report, isFetching, isError, error, refetch } = useQuery({
    queryKey: [
      "main-reports",
      active,
      boMode || salesMode || purchaseMode || miscMode ? reportFilters : null,
      asOfDate,
      fromDate,
      toDate,
      showZero,
    ],
    queryFn: () =>
      loadReportView(
        active,
        boMode || salesMode || purchaseMode || miscMode
          ? reportFilters
          : { asOfDate, fromDate, toDate, showZero },
      ),
    staleTime: 15_000,
  });

  // Debounce party search for backend searchTerm
  useEffect(() => {
    const t = setTimeout(() => setContactSearchDebounced(contactSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [contactSearch]);
  useEffect(() => {
    const t = setTimeout(() => setCustomerSearchDebounced(customerSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [customerSearch]);
  useEffect(() => {
    const t = setTimeout(() => setVendorSearchDebounced(vendorSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [vendorSearch]);

  // Option lists from backend (searchable)
  const { data: contactOptions = [], isFetching: contactsLoading } = useQuery({
    queryKey: ["report-contacts", contactSearchDebounced],
    queryFn: async () => {
      const q = contactSearchDebounced || undefined;
      const [cust, vend] = await Promise.all([
        fetchCustomers({ page: 1, limit: 50, searchTerm: q }),
        fetchVendors({ page: 1, limit: 50, searchTerm: q }),
      ]);
      return [
        ...cust.rows.map((c) => ({
          id: c._id,
          label: c.name || "Customer",
          role: "customer" as const,
          subtitle: "customer",
        })),
        ...vend.rows.map((v) => ({
          id: v._id,
          label: v.company_name || v.name || "Vendor",
          role: "vendor" as const,
          subtitle: "vendor",
        })),
      ];
    },
    enabled: active === "Summary Report",
    staleTime: 15_000,
  });

  const { data: customerOptions = [], isFetching: customersLoading } = useQuery({
    queryKey: ["report-customers", customerSearchDebounced],
    queryFn: async () => {
      const r = await fetchCustomers({
        page: 1,
        limit: 50,
        searchTerm: customerSearchDebounced || undefined,
      });
      return r.rows.map((c) => ({ id: c._id, label: c.name || "Customer" }));
    },
    enabled:
      active === "Quarters Report" ||
      active === "Invoice Aging Report" ||
      active === "Sales Report" ||
      active === "Estimate Report" ||
      active === "Payment Report" ||
      active === "Sales by Customer Report" ||
      active === "Time Log Report" ||
      active === "Tax Report" ||
      active === "Tax Summary Report",
    staleTime: 15_000,
  });

  const needsVendors =
    active === "Bill Report" ||
    active === "Purchase Order Report" ||
    active === "Purchase Order By Company" ||
    active === "Payment Made Report" ||
    active === "Expense Report";

  const { data: vendorOptions = [], isFetching: vendorsLoading } = useQuery({
    queryKey: ["report-vendors", vendorSearchDebounced],
    queryFn: async () => {
      const r = await fetchVendors({
        page: 1,
        limit: 50,
        searchTerm: vendorSearchDebounced || undefined,
      });
      return r.rows.map((v) => ({
        id: v._id,
        label: v.company_name || v.name || "Vendor",
      }));
    },
    enabled: needsVendors,
    staleTime: 15_000,
  });

  const needsUsers =
    active === "Sales Report" ||
    active === "Estimate Report" ||
    active === "Payment Report" ||
    active === "Sales by Customer Report" ||
    active === "Sales by User Report";

  const { data: userOptions = [] } = useQuery({
    queryKey: ["report-company-users"],
    queryFn: async () => {
      const data = await api.get<any[]>("/user/all-user-for-company");
      const list = Array.isArray(data) ? data : [];
      return list.map((u) => ({
        id: String(u._id),
        label: String(u.name || u.email || "User"),
        email: String(u.email || ""),
      }));
    },
    enabled: needsUsers,
    staleTime: 60_000,
  });

  const { data: paymentMethodOptions = [] } = useQuery({
    queryKey: ["report-payment-methods"],
    queryFn: async () => {
      const rows = await fetchPaymentMethods();
      return rows.map((m) => ({ id: m._id, label: m.name }));
    },
    enabled:
      active === "Payment Report" ||
      active === "Sales Report" ||
      active === "Payment Made Report" ||
      active === "Expense Report",
    staleTime: 60_000,
  });

  const { data: serviceOptions = [] } = useQuery({
    queryKey: ["report-services"],
    queryFn: async () => {
      const r = await fetchServices({ page: 1, limit: 200 });
      return r.rows.map((s) => ({ id: s._id, label: s.name }));
    },
    enabled: active === "Sales Report" || active === "Bill Report",
    staleTime: 60_000,
  });

  const { data: categoryOptions = [] } = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const data = await api.get<any[]>("/category/all");
      const list = Array.isArray(data) ? data : [];
      return list.map((c) => ({ id: String(c._id), label: String(c.category || c.name || "—") }));
    },
    enabled:
      active === "Profit by Product Report" ||
      active === "Sales by Category Report" ||
      active === "Expense Report" ||
      active === "Stock Report",
    staleTime: 60_000,
  });

  const { data: productOptions = [] } = useQuery({
    queryKey: ["report-products", categoryId],
    queryFn: async () => {
      const r = await fetchProducts({ page: 1, limit: 200, category: categoryId || undefined });
      return r.rows.map((p) => ({ id: p._id, label: p.name }));
    },
    enabled:
      active === "Profit by Product Report" ||
      active === "Sales Report" ||
      active === "Sales Report by Product" ||
      active === "Bill Report" ||
      active === "Purchase by Product Report" ||
      active === "Stock Report",
    staleTime: 15_000,
  });

  const { data: projectOptions = [] } = useQuery({
    queryKey: ["report-projects"],
    queryFn: async () => {
      const res = await api.raw.get("/project/all", { params: { page: 1, limit: 100 } });
      const body = res.data ?? {};
      const list: any[] = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.data?.allRecords)
          ? body.data.allRecords
          : [];
      return list.map((p) => ({ id: String(p._id || p.id), label: String(p.name || "Project") }));
    },
    enabled: active === "Project Report",
    staleTime: 30_000,
  });

  useEffect(() => {
    if (report?.cols?.length) {
      setVisibleCols(new Set(report.cols.map((c) => c.label)));
    }
  }, [report?.name, report?.cols]);

  // Reset filters when switching reports
  useEffect(() => {
    setContactId("");
    setContactRole("");
    setContactLabel("All");
    setContactSearch("");
    setCustomerId("");
    setCustomerLabel("All");
    setCustomerSearch("");
    setCategoryId("");
    setCategoryLabel("All");
    setProductId("");
    setProductLabel("All");
    setProductType("All");
    setPeriod("All");
    setReportType("PDF");
    setDocType("All");
    setStatusFilter("All");
    setSalespersonId("");
    setSalespersonLabel("All");
    setUserFilterId("");
    setUserFilterLabel("All");
    setServiceId("");
    setServiceLabel("All");
    setPaymentType("All");
    setPaymentTerms("All");
    setVendorId("");
    setVendorLabel("All");
    setVendorSearch("");
    setGroupBy(active === "Purchase Order By Company" ? "Company Info" : "None");
    setProjectId("");
    setProjectLabel("All");
  }, [active]);

  const display = useMemo(() => {
    if (!report) return null;
    return report;
  }, [report]);

  const bo = asBo(display || undefined);

  const toggleCol = (label: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        if (next.size > 1) next.delete(label);
      } else next.add(label);
      return next;
    });
  };

  const runExport = (kind?: string) => {
    if (!display || display.source === "unavailable") return;
    const grid = toExportGrid(display);
    const k = (kind || reportType).toUpperCase();
    if (k === "CSV") exportReportCsv(grid);
    else if (k === "XLSX") exportReportXlsx(grid, "xlsx");
    else if (k === "XLS") exportReportXlsx(grid, "xls");
    else if (k === "HTML") exportReportHtml(grid);
    else void exportReportPdf(grid);
  };

  const colCountLabel =
    visibleCols.size === (report?.cols.length || 0) ? "All" : `${visibleCols.size} Selected`;

  return (
    <div className="flex h-full bg-[var(--app-bg)] overflow-hidden">
      <ResizableListPanel>
        <div className="h-12 flex items-center px-4 border-b border-gray-200 bg-white">
          <h2 className="text-base font-semibold text-gray-900">Reports</h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          {categories.map((cat) => {
            const isOpen = !!open[cat.title];
            return (
              <div key={cat.title}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [cat.title]: !o[cat.title] }))}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 hover:bg-gray-50"
                >
                  <span className="text-sm font-bold text-gray-900">{cat.title}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {isOpen &&
                  cat.items.map((it) => (
                    <button
                      key={it}
                      type="button"
                      onClick={() => setActive(it)}
                      className={`w-full text-left px-5 py-3 border-b border-gray-200 text-sm ${
                        it === active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {it}
                    </button>
                ))}
              </div>
            );
          })}
        </div>
      </ResizableListPanel>

      <section className="flex-1 flex flex-col overflow-hidden bg-[var(--app-bg)] min-w-0">
        <div className="m-2 flex-1 flex flex-col min-h-0 border border-gray-300 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            <AlignLeft className="w-5 h-5 text-gray-700 flex-shrink-0" />
            <h1 className="text-lg font-semibold text-gray-900 truncate">{active}</h1>
            {isFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Preview"
              disabled={!display || display.source === "unavailable"}
              onClick={() => setPdf(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200 disabled:opacity-40"
            >
              <Eye className="w-4 h-4" />
            </button>
            <DownloadFormatMenu
              disabled={!display || display.source === "unavailable"}
              onPick={(kind) => runExport(kind)}
            />
            <button type="button" title="Print" onClick={() => window.print()} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200">
              <Printer className="w-4 h-4" />
            </button>
            <button type="button" title="WhatsApp" className="w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button type="button" title="Mail" className="w-8 h-8 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-200">
              <Mail className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-white">
          {(boMode || salesMode || purchaseMode || miscMode) && (
            <>
              {active === "Invoice Aging Report" ? (
                <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-300 rounded-full px-2.5 py-1">
                  <span className="text-gray-400">Date</span>
                  <span className="text-gray-500">|</span>
                  <AppDatePicker value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="bg-transparent outline-none text-gray-900" />
                </label>
              ) : (
                <PillDropdown label="Date" value={period}>
                  {(close) => DATE_OPTIONS.map((opt) => (
                    <MenuItem key={opt} active={period === opt} onClick={() => { setPeriod(opt); close(); }}>{opt}</MenuItem>
                  ))}
                </PillDropdown>
              )}

              {period === "Custom" && active !== "Invoice Aging Report" && (
                <>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-300 rounded-full px-2.5 py-1">
                    From
                    <AppDatePicker value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent outline-none text-gray-900" />
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-300 rounded-full px-2.5 py-1">
                    To
                    <AppDatePicker value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent outline-none text-gray-900" />
                  </label>
                </>
              )}

              {active === "Summary Report" && (
                <SearchablePartyPill
                  label="Contacts"
                  valueLabel={contactLabel}
                  options={contactOptions}
                  selectedId={contactId}
                  loading={contactsLoading}
                  search={contactSearch}
                  onSearch={setContactSearch}
                  onSelectAll={() => { setContactId(""); setContactRole(""); setContactLabel("All"); }}
                  onSelect={(opt) => { setContactId(opt.id); setContactRole(opt.role || ""); setContactLabel(opt.label); }}
                />
              )}

              {(active === "Quarters Report" ||
                active === "Invoice Aging Report" ||
                active === "Sales Report" ||
                active === "Estimate Report" ||
                active === "Payment Report" ||
                active === "Sales by Customer Report" ||
                active === "Time Log Report" ||
                active === "Tax Report" ||
                active === "Tax Summary Report") && (
                <SearchablePartyPill
                  label="Customers"
                  valueLabel={customerLabel}
                  options={customerOptions}
                  selectedId={customerId}
                  loading={customersLoading}
                  search={customerSearch}
                  onSearch={setCustomerSearch}
                  onSelectAll={() => { setCustomerId(""); setCustomerLabel("All"); }}
                  onSelect={(opt) => { setCustomerId(opt.id); setCustomerLabel(opt.label); }}
                />
              )}

              {active === "Sales Report" && (
                <PillDropdown label="Type" value={docType}>
                  {(close) => DOC_TYPES.map((t) => (
                    <MenuItem key={t} active={docType === t} onClick={() => { setDocType(t); close(); }}>{t}</MenuItem>
                  ))}
                </PillDropdown>
              )}

              {(active === "Sales Report" || active === "Estimate Report" || active === "Payment Report" || active === "Sales by Customer Report" || active === "Sales by User Report") && (
                <PillDropdown label="Salesperson" value={salespersonLabel}>
                  {(close) => (
                    <>
                      <MenuItem active={!salespersonId} onClick={() => { setSalespersonId(""); setSalespersonLabel("All"); close(); }}>All</MenuItem>
                      {userOptions.map((u) => (
                        <MenuItem key={u.id} active={salespersonId === u.id} onClick={() => { setSalespersonId(u.id); setSalespersonLabel(u.label); close(); }}>{u.label}</MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {active === "Sales by User Report" && (
                <PillDropdown label="Users" value={userFilterLabel}>
                  {(close) => (
                    <>
                      <MenuItem active={!userFilterId} onClick={() => { setUserFilterId(""); setUserFilterLabel("All"); close(); }}>All</MenuItem>
                      {userOptions.map((u) => (
                        <MenuItem key={u.id} active={userFilterId === u.id} onClick={() => { setUserFilterId(u.id); setUserFilterLabel(u.label); close(); }}>{u.label}</MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {(active === "Invoice Aging Report" || active === "Sales Report" || active === "Estimate Report" || active === "Sales by Customer Report") && (
                <PillDropdown label="Status" value={statusFilter}>
                  {(close) => (active === "Estimate Report" ? ESTIMATE_STATUSES : INVOICE_STATUSES).map((s) => (
                    <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{s}</MenuItem>
                  ))}
                </PillDropdown>
              )}

              {active === "Sales Report" && (
                <>
                  <PillDropdown label="Products" value={productLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!productId} onClick={() => { setProductId(""); setProductLabel("All"); close(); }}>All</MenuItem>
                        {productOptions.map((p) => (
                          <MenuItem key={p.id} active={productId === p.id} onClick={() => { setProductId(p.id); setProductLabel(p.label); close(); }}>{p.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                  <PillDropdown label="Services" value={serviceLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!serviceId} onClick={() => { setServiceId(""); setServiceLabel("All"); close(); }}>All</MenuItem>
                        {serviceOptions.map((s) => (
                          <MenuItem key={s.id} active={serviceId === s.id} onClick={() => { setServiceId(s.id); setServiceLabel(s.label); close(); }}>{s.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                  <PillDropdown label="Payment Terms" value={paymentTerms}>
                    {(close) => (
                      <>
                        <MenuItem active={paymentTerms === "All"} onClick={() => { setPaymentTerms("All"); close(); }}>All</MenuItem>
                        {paymentMethodOptions.map((m) => (
                          <MenuItem key={m.id} active={paymentTerms === m.label} onClick={() => { setPaymentTerms(m.label); close(); }}>{m.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                </>
              )}

              {active === "Payment Report" && (
                <PillDropdown label="Payment Type" value={paymentType}>
                  {(close) => (
                    <>
                      <MenuItem active={paymentType === "All"} onClick={() => { setPaymentType("All"); close(); }}>All</MenuItem>
                      {paymentMethodOptions.map((m) => (
                        <MenuItem key={m.id} active={paymentType === m.label} onClick={() => { setPaymentType(m.label); close(); }}>{m.label}</MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {(active === "Profit by Product Report" || active === "Sales Report by Product") && (
                <>
                  {active === "Profit by Product Report" && (
                    <PillDropdown label="Category" value={categoryLabel}>
                      {(close) => (
                        <>
                          <MenuItem active={!categoryId} onClick={() => { setCategoryId(""); setCategoryLabel("All"); setProductId(""); setProductLabel("All"); close(); }}>All</MenuItem>
                          {categoryOptions.map((c) => (
                            <MenuItem key={c.id} active={categoryId === c.id} onClick={() => { setCategoryId(c.id); setCategoryLabel(c.label); setProductId(""); setProductLabel("All"); close(); }}>{c.label}</MenuItem>
                          ))}
                        </>
                      )}
                    </PillDropdown>
                  )}
                  <PillDropdown label="Products" value={productLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!productId} onClick={() => { setProductId(""); setProductLabel("All"); close(); }}>All</MenuItem>
                        {productOptions.map((p) => (
                          <MenuItem key={p.id} active={productId === p.id} onClick={() => { setProductId(p.id); setProductLabel(p.label); close(); }}>{p.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                </>
              )}

              {active === "Sales by Category Report" && (
                <PillDropdown label="Category" value={categoryLabel}>
                  {(close) => (
                    <>
                      <MenuItem active={!categoryId} onClick={() => { setCategoryId(""); setCategoryLabel("All"); close(); }}>All</MenuItem>
                      {categoryOptions.map((c) => (
                        <MenuItem key={c.id} active={categoryId === c.id} onClick={() => { setCategoryId(c.id); setCategoryLabel(c.label); close(); }}>{c.label}</MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {(active === "Profit by Product Report" ||
                active === "Sales Report" ||
                active === "Estimate Report" ||
                active === "Sales Report by Product" ||
                active === "Bill Report" ||
                active === "Purchase Order Report" ||
                active === "Purchase by Product Report") && (
                <PillDropdown label="Product Type" value={productType}>
                  {(close) => PRODUCT_TYPES.map((t) => (
                    <MenuItem key={t} active={productType === t} onClick={() => { setProductType(t); close(); }}>{t}</MenuItem>
                  ))}
                </PillDropdown>
              )}

              {needsVendors && (
                <SearchablePartyPill
                  label="Vendors"
                  valueLabel={vendorLabel}
                  options={vendorOptions}
                  selectedId={vendorId}
                  loading={vendorsLoading}
                  search={vendorSearch}
                  onSearch={setVendorSearch}
                  onSelectAll={() => { setVendorId(""); setVendorLabel("All"); }}
                  onSelect={(opt) => { setVendorId(opt.id); setVendorLabel(opt.label); }}
                />
              )}

              {(active === "Bill Report" || active === "Purchase Order Report" || active === "Purchase Order By Company") && (
                <PillDropdown label="Status" value={statusFilter}>
                  {(close) =>
                    (active === "Bill Report" ? BILL_STATUSES : PO_STATUSES).map((s) => (
                      <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{s}</MenuItem>
                    ))
                  }
                </PillDropdown>
              )}

              {active === "Bill Report" && (
                <>
                  <PillDropdown label="Products" value={productLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!productId} onClick={() => { setProductId(""); setProductLabel("All"); close(); }}>All</MenuItem>
                        {productOptions.map((p) => (
                          <MenuItem key={p.id} active={productId === p.id} onClick={() => { setProductId(p.id); setProductLabel(p.label); close(); }}>{p.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                  <PillDropdown label="Services" value={serviceLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!serviceId} onClick={() => { setServiceId(""); setServiceLabel("All"); close(); }}>All</MenuItem>
                        {serviceOptions.map((s) => (
                          <MenuItem key={s.id} active={serviceId === s.id} onClick={() => { setServiceId(s.id); setServiceLabel(s.label); close(); }}>{s.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                </>
              )}

              {active === "Purchase by Product Report" && (
                <PillDropdown label="Products" value={productLabel}>
                  {(close) => (
                    <>
                      <MenuItem active={!productId} onClick={() => { setProductId(""); setProductLabel("All"); close(); }}>All</MenuItem>
                      {productOptions.map((p) => (
                        <MenuItem key={p.id} active={productId === p.id} onClick={() => { setProductId(p.id); setProductLabel(p.label); close(); }}>{p.label}</MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {(active === "Purchase Order By Company" || active === "Payment Made Report") && (
                <PillDropdown label="Group By" value={groupBy}>
                  {(close) => GROUP_BY_OPTIONS.map((g) => (
                    <MenuItem key={g} active={groupBy === g} onClick={() => { setGroupBy(g); close(); }}>{g}</MenuItem>
                  ))}
                </PillDropdown>
              )}

              {(active === "Payment Made Report" || active === "Expense Report") && (
                <PillDropdown label="Payment Type" value={paymentType}>
                  {(close) => (
                    <>
                      <MenuItem active={paymentType === "All"} onClick={() => { setPaymentType("All"); close(); }}>All</MenuItem>
                      {paymentMethodOptions.map((m) => (
                        <MenuItem key={m.id} active={paymentType === m.label} onClick={() => { setPaymentType(m.label); close(); }}>{m.label}</MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {active === "Expense Report" && (
                <PillDropdown label="Category" value={categoryLabel}>
                  {(close) => (
                    <>
                      <MenuItem active={!categoryId && categoryLabel === "All"} onClick={() => { setCategoryId(""); setCategoryLabel("All"); close(); }}>All</MenuItem>
                      {categoryOptions.map((c) => (
                        <MenuItem
                          key={c.id}
                          active={categoryId === c.id || categoryLabel === c.label}
                          onClick={() => { setCategoryId(c.id); setCategoryLabel(c.label); close(); }}
                        >
                          {c.label}
                        </MenuItem>
                      ))}
                    </>
                  )}
                </PillDropdown>
              )}

              {active === "Stock Report" && (
                <>
                  <PillDropdown label="Group By" value={groupBy}>
                    {(close) => GROUP_BY_OPTIONS.map((g) => (
                      <MenuItem key={g} active={groupBy === g} onClick={() => { setGroupBy(g); close(); }}>{g}</MenuItem>
                    ))}
                  </PillDropdown>
                  <PillDropdown label="Category" value={categoryLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!categoryId} onClick={() => { setCategoryId(""); setCategoryLabel("All"); close(); }}>All</MenuItem>
                        {categoryOptions.map((c) => (
                          <MenuItem key={c.id} active={categoryId === c.id} onClick={() => { setCategoryId(c.id); setCategoryLabel(c.label); close(); }}>{c.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                  <PillDropdown label="Products" value={productLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!productId} onClick={() => { setProductId(""); setProductLabel("All"); close(); }}>All</MenuItem>
                        {productOptions.map((p) => (
                          <MenuItem key={p.id} active={productId === p.id} onClick={() => { setProductId(p.id); setProductLabel(p.label); close(); }}>{p.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                  <PillDropdown label="Status" value={statusFilter}>
                    {(close) => STOCK_STATUSES.map((s) => (
                      <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{s}</MenuItem>
                    ))}
                  </PillDropdown>
                  <PillDropdown label="Product Type" value={productType}>
                    {(close) => PRODUCT_TYPES.map((t) => (
                      <MenuItem key={t} active={productType === t} onClick={() => { setProductType(t); close(); }}>{t}</MenuItem>
                    ))}
                  </PillDropdown>
                </>
              )}

              {active === "Time Log Report" && (
                <>
                  <PillDropdown label="Status" value={statusFilter}>
                    {(close) => TIMELOG_STATUSES.map((s) => (
                      <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{s}</MenuItem>
                    ))}
                  </PillDropdown>
                  <PillDropdown label="Group By" value={groupBy}>
                    {(close) => GROUP_BY_OPTIONS.map((g) => (
                      <MenuItem key={g} active={groupBy === g} onClick={() => { setGroupBy(g); close(); }}>{g}</MenuItem>
                    ))}
                  </PillDropdown>
                </>
              )}

              {active === "Project Report" && (
                <>
                  <PillDropdown label="Status" value={statusFilter}>
                    {(close) => PROJECT_STATUSES.map((s) => (
                      <MenuItem key={s} active={statusFilter === s} onClick={() => { setStatusFilter(s); close(); }}>{s}</MenuItem>
                    ))}
                  </PillDropdown>
                  <PillDropdown label="Projects" value={projectLabel}>
                    {(close) => (
                      <>
                        <MenuItem active={!projectId} onClick={() => { setProjectId(""); setProjectLabel("All"); close(); }}>All</MenuItem>
                        {projectOptions.map((p) => (
                          <MenuItem key={p.id} active={projectId === p.id} onClick={() => { setProjectId(p.id); setProjectLabel(p.label); close(); }}>{p.label}</MenuItem>
                        ))}
                      </>
                    )}
                  </PillDropdown>
                </>
              )}

              {active === "Tax Report" && (
                <PillDropdown label="Group By" value={groupBy}>
                  {(close) => GROUP_BY_OPTIONS.map((g) => (
                    <MenuItem key={g} active={groupBy === g} onClick={() => { setGroupBy(g); close(); }}>{g}</MenuItem>
                  ))}
                </PillDropdown>
              )}

              <div className="w-px h-5 bg-gray-300 mx-1" />
              <PillDropdown label="Columns" value={colCountLabel} accent>
                {(close) => (report?.cols ?? []).map((c) => (
                  <MenuItem key={c.label} active={visibleCols.has(c.label)} onClick={() => { toggleCol(c.label); close(); }}>{c.label}</MenuItem>
                ))}
              </PillDropdown>

              <div className="w-px h-5 bg-gray-300 mx-1" />
              <PillDropdown label="Report Type" value={reportType}>
                {(close) => REPORT_TYPES.map((t) => (
                  <MenuItem key={t} active={reportType === t} onClick={() => { setReportType(t); close(); }}>{t}</MenuItem>
                ))}
              </PillDropdown>
            </>
          )}

          {!boMode && !salesMode && !purchaseMode && !miscMode && filterKind === "as_of" && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-300 rounded-full px-2.5 py-1">
              As of
              <AppDatePicker value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="bg-transparent outline-none text-gray-900" />
            </label>
          )}
          {!boMode && !salesMode && !purchaseMode && !miscMode && filterKind === "range" && (
            <>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-300 rounded-full px-2.5 py-1">
                From
                <AppDatePicker value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent outline-none text-gray-900" />
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 border border-gray-300 rounded-full px-2.5 py-1">
                To
                <AppDatePicker value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent outline-none text-gray-900" />
              </label>
            </>
          )}
          {!boMode && !salesMode && !purchaseMode && !miscMode && (
            <PillDropdown label="Report Type" value={reportType}>
              {(close) => REPORT_TYPES.map((t) => (
                <MenuItem key={t} active={reportType === t} onClick={() => { setReportType(t); close(); }}>{t}</MenuItem>
              ))}
            </PillDropdown>
          )}

          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1 text-xs text-gray-800 border border-gray-300 rounded-full px-3 py-1 hover:bg-gray-100"
          >
            <Plus className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-white">
          {isError && <div className="p-4 text-sm text-red-600">{(error as Error)?.message || "Failed to load report"}</div>}
          {!isError && display?.source === "unavailable" && (
            <div className="p-8 text-center text-sm text-amber-600">{display.message}</div>
          )}

          {display && display.source === "backend" && (
            <>
              {bo?.layout === "summary" && <SummaryLayout report={bo} />}
              {bo?.layout === "pnl" && <SummaryLayout report={bo} />}
              {bo?.layout === "quarters" && <QuartersLayout report={bo} visibleCols={visibleCols} />}
              {(!bo || bo.layout === "table") && <TableLayout report={display} visibleCols={visibleCols} />}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200 grid grid-cols-3 items-center text-xs text-gray-500 bg-gray-50">
          <div />
          <QaydFooterBrand />
          <div className="text-right">
            {display?.source === "backend" ? `1 – ${display.rows.length} of ${display.rows.length}` : "—"}
          </div>
        </div>
        </div>
      </section>

      {pdf && display && display.source === "backend" && (
        <ReportPdfPreviewModal report={display} onClose={() => setPdf(false)} />
      )}
    </div>
  );
};

export default Reports;
