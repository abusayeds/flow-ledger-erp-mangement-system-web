/**
 * Main Reports hub APIs — /account/reports/* (+ list types).
 * Double-entry P&L / cash flow / balance sheet reuse existing doubleEntry helpers.
 * Business Overview reports live in businessOverviewApi.
 */
import { api } from "@/lib/api/client";
import { doubleEntryReports, balanceSheetActions } from "@/services/doubleEntry";
import { fetchProducts } from "@/services/productsApi";
import { fetchServices } from "@/services/servicesApi";
import {
  loadOperationalProfitLoss,
  loadProfitByProductReport,
  loadQuartersReport,
  loadSummaryReport,
} from "@/services/businessOverviewApi";
import {
  loadEstimateReport,
  loadInvoiceAgingReport,
  loadPaymentReport,
  loadSalesByCategoryReport,
  loadSalesByCustomerReport,
  loadSalesByProductReport,
  loadSalesByServiceReport,
  loadSalesByUserReport,
  loadSalesReport,
} from "@/services/salesReportsApi";
import {
  loadBillReport,
  loadExpenseReport,
  loadPaymentMadeReport,
  loadPurchaseByProductReport,
  loadPurchaseByServiceReport,
  loadPurchaseOrderByCompanyReport,
  loadPurchaseOrderReport,
} from "@/services/purchaseReportsApi";
import {
  loadProjectReport,
  loadStockReport,
  loadTaxReport,
  loadTimeLogReport,
} from "@/services/miscReportsApi";
import type { ReportCol, ReportFilters, ReportView } from "@/services/reportTypes";

export type { ReportCol, ReportFilters, ReportView } from "@/services/reportTypes";
export { isSalesReport } from "@/services/salesReportsApi";
export { isPurchaseReport } from "@/services/purchaseReportsApi";
export { isMiscReport } from "@/services/miscReportsApi";

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const yearEnd = () => `${new Date().getFullYear()}-12-31`;

const unavailable = (name: string, reason: string): ReportView => ({
  name,
  cols: [{ label: "Status" }],
  rows: [[reason]],
  totals: ["—"],
  source: "unavailable",
  message: reason,
});

async function fetchBillAging(asOfDate: string) {
  const res = await api.raw.get("/account/reports/bill-aging", { params: { as_of_date: asOfDate } });
  return res.data?.data ?? res.data;
}

async function fetchVendorBalance(asOfDate: string, showZero: boolean) {
  const res = await api.raw.get("/account/reports/vendor-balance", {
    params: { as_of_date: asOfDate, show_zero_balances: showZero ? "true" : "false" },
  });
  return res.data?.data ?? res.data;
}

const mapAgingCustomers = (name: string, data: any, partyKey: "customer_name" | "vendor_name"): ReportView => {
  const parties: any[] = Array.isArray(data?.customers)
    ? data.customers
    : Array.isArray(data?.vendors)
      ? data.vendors
      : [];
  const cols: ReportCol[] = [
    { label: "Name" },
    { label: "Current", right: true },
    { label: "1-30 Days", right: true },
    { label: "31-60 Days", right: true },
    { label: "61-90 Days", right: true },
    { label: ">90 Days", right: true },
    { label: "Total Outstanding", right: true },
  ];
  const sums = [0, 0, 0, 0, 0, 0];
  const rows = parties.map((p) => {
    const vals = [
      Number(p.current) || 0,
      Number(p["1_30_days"]) || 0,
      Number(p["31_60_days"]) || 0,
      Number(p["61_90_days"]) || 0,
      Number(p.over_90_days) || 0,
      Number(p.total) || 0,
    ];
    vals.forEach((n, i) => (sums[i] += n));
    return [String(p[partyKey] || "—"), ...vals.map(money)];
  });
  return {
    name,
    cols,
    rows,
    totals: [`Total (${rows.length})`, ...sums.map(money)],
    meta: { asOf: data?.as_of_date },
    source: "backend",
  };
};

/** Map sidebar report title → backend fetch + normalized grid. */
export async function loadReportView(reportName: string, filters: ReportFilters = {}): Promise<ReportView> {
  const asOf = filters.asOfDate || today();
  const from = filters.fromDate || yearStart();
  const to = filters.toDate || yearEnd();
  const showZero = !!filters.showZero;

  switch (reportName) {
    case "Summary Report":
      return loadSummaryReport({ ...filters, asOfDate: asOf, showZero });

    case "Quarters Report":
      return loadQuartersReport({ ...filters, asOfDate: asOf, showZero });

    case "Profit by Product Report":
      return loadProfitByProductReport({ ...filters, asOfDate: asOf, showZero });

    case "Invoice Aging Report":
      return loadInvoiceAgingReport({ ...filters, asOfDate: asOf, showZero });

    case "Bill Aging Report":
      return mapAgingCustomers(reportName, await fetchBillAging(asOf), "vendor_name");

    case "Tax Summary Report":
    case "Tax Report":
      return loadTaxReport({ ...filters, fromDate: from, toDate: to });

    case "Stock Report":
      return loadStockReport(filters);

    case "Project Report":
      return loadProjectReport(filters);

    case "Time Log Report":
      return loadTimeLogReport(filters);

    case "Sales Report":
      return loadSalesReport(filters);
    case "Estimate Report":
      return loadEstimateReport(filters);
    case "Payment Report":
      return loadPaymentReport(filters);
    case "Bill Report":
      return loadBillReport(filters);
    case "Purchase Order Report":
      return loadPurchaseOrderReport(filters);
    case "Purchase Order By Company":
      return loadPurchaseOrderByCompanyReport(filters);
    case "Purchase by Product Report":
      return loadPurchaseByProductReport(filters);
    case "Purchase by Service Report":
      return loadPurchaseByServiceReport(filters);
    case "Payment Made Report":
      return loadPaymentMadeReport(filters);
    case "Expense Report":
      return loadExpenseReport(filters);
    case "Purchase Report":
      return loadPurchaseOrderReport(filters);

    case "Sales by Customer Report":
      return loadSalesByCustomerReport(filters);

    case "Purchase by Vendor Report": {
      const data = await fetchVendorBalance(asOf, showZero);
      const list: any[] = Array.isArray(data?.vendors) ? data.vendors : Array.isArray(data) ? data : [];
      const cols: ReportCol[] = [
        { label: "Vendor" },
        { label: "Billed", right: true },
        { label: "Paid", right: true },
        { label: "Balance", right: true },
      ];
      let billed = 0, paid = 0, bal = 0;
      const rows = list.map((v) => {
        const a = Number(v.total_billed ?? v.total_invoiced) || 0;
        const b = Number(v.total_paid) || 0;
        const d = Number(v.balance) || 0;
        billed += a; paid += b; bal += d;
        return [String(v.vendor_name || "—"), money(a), money(b), money(d)];
      });
      return {
        name: reportName,
        cols,
        rows,
        totals: [`Total (${rows.length})`, money(billed), money(paid), money(bal)],
        meta: { asOf },
        source: "backend",
      };
    }

    case "Product Report": {
      const { rows: products } = await fetchProducts({ page: 1, limit: 500 });
      const cols: ReportCol[] = [
        { label: "Product" },
        { label: "SKU" },
        { label: "Category" },
        { label: "Stock", right: true },
        { label: "Sell Price", right: true },
      ];
      const rows = products.map((p) => [
        p.name,
        p.sku,
        p.category,
        p.stock == null ? "—" : String(p.stock),
        money(p.price),
      ]);
      return {
        name: reportName,
        cols,
        rows,
        totals: [`Total (${rows.length})`, "", "", "", ""],
        source: "backend",
      };
    }

    case "Service Report": {
      const { rows: services } = await fetchServices({ page: 1, limit: 500 });
      const cols: ReportCol[] = [
        { label: "Service" },
        { label: "Unit" },
        { label: "Rate", right: true },
      ];
      let sum = 0;
      const rows = services.map((s) => {
        sum += s.price;
        return [s.name, s.unit, money(s.price)];
      });
      return {
        name: reportName,
        cols,
        rows,
        totals: [`Total (${rows.length})`, "", money(sum)],
        source: "backend",
      };
    }

    case "Profit & Loss":
      return loadOperationalProfitLoss({ ...filters, asOfDate: asOf, showZero });

    case "Sales by User Report":
      return loadSalesByUserReport(filters);
    case "Sales Report by Product":
      return loadSalesByProductReport(filters);
    case "Sales Report by Service":
      return loadSalesByServiceReport(filters);
    case "Sales by Category Report":
      return loadSalesByCategoryReport(filters);

    case "Double Entry Profit & Loss": {
      const data: any = await doubleEntryReports.profitLoss({ from_date: from, to_date: to });
      const revenue = Array.isArray(data?.revenue) ? data.revenue : [];
      const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
      const cols: ReportCol[] = [
        { label: "Section" },
        { label: "Account" },
        { label: "Code" },
        { label: "Balance", right: true },
      ];
      const rows = [
        ...revenue.map((r: any) => ["Revenue", String(r.account_name || "—"), String(r.account_code || "—"), money(Number(r.balance) || 0)]),
        ...expenses.map((r: any) => ["Expense", String(r.account_name || "—"), String(r.account_code || "—"), money(Number(r.balance) || 0)]),
        ["Net profit", "—", "—", money(Number(data?.net_profit) || 0)],
      ];
      return {
        name: reportName,
        cols,
        rows,
        totals: ["", "", "", money(Number(data?.net_profit) || 0)],
        meta: { from: data?.from_date || from, to: data?.to_date || to },
        source: "backend",
      };
    }

    case "Cash Flow": {
      const data: any = await doubleEntryReports.cashFlow({ from_date: from, to_date: to });
      const cols: ReportCol[] = [{ label: "Item" }, { label: "Amount", right: true }];
      const rows: string[][] = [];
      const pushObj = (prefix: string, obj: any) => {
        if (!obj || typeof obj !== "object") return;
        Object.entries(obj).forEach(([k, v]) => {
          if (typeof v === "number") rows.push([`${prefix}${k.replace(/_/g, " ")}`, money(v)]);
          else if (v && typeof v === "object" && !Array.isArray(v)) pushObj(`${prefix}${k} › `, v);
        });
      };
      pushObj("", data);
      if (rows.length === 0) rows.push(["No cash-flow lines", money(0)]);
      return {
        name: reportName,
        cols,
        rows,
        totals: [`Total (${rows.length})`, ""],
        meta: { from, to },
        source: "backend",
      };
    }

    case "Balance Sheet": {
      const data: any = await balanceSheetActions.latest();
      if (!data) {
        return unavailable(reportName, "No balance sheet found. Generate one under Double Entry → Balance Sheets.");
      }
      // Supports both mapped FE view and raw backend envelope
      const date = String(data.date || data.balance_sheet?.balance_sheet_date || data.balance_sheet_date || "—").slice(0, 10);
      const year = String(data.year || data.balance_sheet?.financial_year || data.financial_year || "—");
      const status = String(data.status || data.balance_sheet?.status || "—");
      const assets = Number(data.summary?.assets ?? data.summary?.total_assets ?? data.total_assets) || 0;
      const liabilities = Number(data.summary?.liabilities ?? data.summary?.total_liabilities ?? data.total_liabilities) || 0;
      const equity = Number(data.summary?.equity ?? data.summary?.total_equity ?? data.total_equity) || 0;
      const cols: ReportCol[] = [{ label: "Field" }, { label: "Value", right: true }];
      const rows = [
        ["Date", date],
        ["Financial year", year],
        ["Status", status],
        ["Total assets", money(assets)],
        ["Total liabilities", money(liabilities)],
        ["Total equity", money(equity)],
      ];
      return {
        name: reportName,
        cols,
        rows,
        totals: ["", ""],
        meta: { asOf: date },
        source: "backend",
      };
    }

    default:
      return unavailable(reportName, "Report not mapped to a backend endpoint.");
  }
}

export function reportFilterKind(reportName: string): "as_of" | "range" | "none" {
  if (
    reportName === "Invoice Aging Report" ||
    reportName === "Bill Aging Report" ||
    reportName === "Sales by Customer Report" ||
    reportName === "Purchase by Vendor Report" ||
    reportName === "Balance Sheet"
  ) {
    return "as_of";
  }
  if (
    reportName === "Tax Summary Report" ||
    reportName === "Tax Report" ||
    reportName === "Profit & Loss" ||
    reportName === "Double Entry Profit & Loss" ||
    reportName === "Cash Flow" ||
    reportName === "Summary Report" ||
    reportName === "Quarters Report" ||
    reportName === "Profit by Product Report" ||
    reportName === "Stock Report" ||
    reportName === "Time Log Report" ||
    reportName === "Project Report"
  ) {
    return "range";
  }
  return "none";
}

export { today, yearStart, yearEnd };
