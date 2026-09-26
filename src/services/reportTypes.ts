/** Shared report view types used by reportsApi + businessOverviewApi. */

export type ReportCol = { label: string; right?: boolean; key?: string };

export type ReportView = {
  name: string;
  cols: ReportCol[];
  rows: string[][];
  totals: string[];
  meta?: { from?: string; to?: string; asOf?: string };
  source: "backend" | "unavailable";
  message?: string;
};

export type DatePeriodKey = "All" | "This Month" | "Last 30 Days" | "This Year" | "Custom";

export type ReportFilters = {
  asOfDate?: string;
  fromDate?: string;
  toDate?: string;
  showZero?: boolean;
  /** Dashboard period: All | This Month | Last 30 Days | This Year | Custom */
  period?: DatePeriodKey | string;
  /** Summary → Contacts (customer or vendor user_id) */
  contactId?: string;
  contactRole?: "customer" | "vendor";
  /** Customers filter (Sales / Quarters) */
  customerId?: string;
  /** Profit by Product / Sales by Category */
  categoryId?: string;
  productId?: string;
  serviceId?: string;
  productType?: "All" | "Standard" | "Multi-variant" | string;
  reportType?: "PDF" | "CSV" | "XLSX" | "XLS" | "HTML" | string;
  /** Sales filters (queryBuilder-backed where supported) */
  status?: string;
  salespersonId?: string;
  userId?: string;
  docType?: "All" | "Invoice" | "Delivery Challan" | "Sales Receipt" | string;
  paymentType?: string;
  paymentTerms?: string;
  /** Purchases & Expenses */
  vendorId?: string;
  categoryLabel?: string;
  groupBy?: string;
  projectId?: string;
};
