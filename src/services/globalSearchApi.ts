/**
 * Global navbar search — queries existing list APIs with searchTerm.
 */
import { fetchCustomers } from "@/services/customersApi";
import { fetchVendors } from "@/services/vendorsApi";
import { fetchInvoices } from "@/services/invoicesApi";
import { fetchEstimates } from "@/services/estimatesApi";
import { fetchProformaInvoices } from "@/services/proformaInvoicesApi";
import { fetchSalesReceipts } from "@/services/salesReceiptsApi";
import { fetchDeliveryChallans } from "@/services/deliveryChallansApi";
import { fetchCreditNotes } from "@/services/creditNotesApi";
import { fetchPaymentReceived } from "@/services/paymentReceivedApi";
import { fetchBills } from "@/services/billsApi";
import { fetchPurchaseOrders } from "@/services/purchaseOrdersApi";
import { fetchExpenses } from "@/services/expensesApi";
import { fetchVendorPayments } from "@/services/vendorPaymentsApi";
import { fetchDebitNotes } from "@/services/debitNotesApi";
import { fetchProducts } from "@/services/productsApi";
import { fetchServices } from "@/services/servicesApi";
import { fetchPaginatedList } from "@/services/paginatedList";
import { api } from "@/lib/api/client";

export type GlobalSearchModule =
  | "All"
  | "Customers"
  | "Invoices"
  | "Proforma Invoices"
  | "Sales Receipts"
  | "Estimates"
  | "Delivery Challans"
  | "Credit Notes"
  | "Payment Received"
  | "Vendors"
  | "Purchase Orders"
  | "Bills"
  | "Expenses"
  | "Payment Made"
  | "Debit Notes"
  | "Products"
  | "Services"
  | "Time Logs"
  | "Projects"
  | "Reports"
  | "Team"
  | "Companies";

export const GLOBAL_SEARCH_MODULES: GlobalSearchModule[] = [
  "All",
  "Customers",
  "Invoices",
  "Proforma Invoices",
  "Sales Receipts",
  "Estimates",
  "Delivery Challans",
  "Credit Notes",
  "Payment Received",
  "Vendors",
  "Purchase Orders",
  "Bills",
  "Expenses",
  "Payment Made",
  "Debit Notes",
  "Products",
  "Services",
  "Time Logs",
  "Projects",
  "Reports",
  "Team",
  "Companies",
];

export type GlobalSearchHit = {
  id: string;
  module: Exclude<GlobalSearchModule, "All">;
  title: string;
  number: string;
  date: string;
  amount: string;
  path: string;
  selectedId: string;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

const money = (amount: number, currency = "USD") => {
  const cur = (currency || "USD").toUpperCase();
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  if (cur === "BDT") return `${sign}৳${formatted} BDT`;
  if (cur === "USD") return `${sign}$${formatted} USD`;
  return `${sign}${formatted} ${cur}`;
};

const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const withHash = (n: string) => {
  const t = text(n);
  if (!t || t === "—") return "—";
  return t.startsWith("#") ? t : `#${t}`;
};

type SearchFn = (q: string, limit: number) => Promise<GlobalSearchHit[]>;

const searchCustomers: SearchFn = async (q, limit) => {
  const { rows } = await fetchCustomers({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `customer-${r._id}`,
    module: "Customers" as const,
    title: r.name || "Customer",
    number: "—",
    date: "—",
    amount: money(num(r.amount), "BDT"),
    path: "/sales/customers",
    selectedId: r._id,
  }));
};

const searchVendors: SearchFn = async (q, limit) => {
  const { rows } = await fetchVendors({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `vendor-${r._id}`,
    module: "Vendors" as const,
    title: r.name || "Vendor",
    number: "—",
    date: "—",
    amount: money(num(r.opening_balance), "BDT"),
    path: "/purchase/vendors",
    selectedId: r._id,
  }));
};

const searchInvoices: SearchFn = async (q, limit) => {
  const { rows } = await fetchInvoices({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `invoice-${r._id}`,
    module: "Invoices" as const,
    title: r.customerName || "Invoice",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/sales/sales-invoice",
    selectedId: r._id,
  }));
};

const searchEstimates: SearchFn = async (q, limit) => {
  const { rows } = await fetchEstimates({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `estimate-${r._id}`,
    module: "Estimates" as const,
    title: r.customerName || "Estimate",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/sales/estimates",
    selectedId: r._id,
  }));
};

const searchProformas: SearchFn = async (q, limit) => {
  const { rows } = await fetchProformaInvoices({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `proforma-${r._id}`,
    module: "Proforma Invoices" as const,
    title: r.customerName || "Proforma Invoice",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/sales/proforma-invoices",
    selectedId: r._id,
  }));
};

const searchReceipts: SearchFn = async (q, limit) => {
  const { rows } = await fetchSalesReceipts({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `receipt-${r._id}`,
    module: "Sales Receipts" as const,
    title: r.customerName || "Sales Receipt",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/sales/sales-receipts",
    selectedId: r._id,
  }));
};

const searchChallans: SearchFn = async (q, limit) => {
  const { rows } = await fetchDeliveryChallans({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `challan-${r._id}`,
    module: "Delivery Challans" as const,
    title: r.customerName || "Delivery Challan",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/sales/delivery-challan",
    selectedId: r._id,
  }));
};

const searchCreditNotes: SearchFn = async (q, limit) => {
  const { rows } = await fetchCreditNotes({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `cn-${r._id}`,
    module: "Credit Notes" as const,
    title: r.customerName || "Credit Note",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/sales/credit-notes",
    selectedId: r._id,
  }));
};

const searchPaymentReceived: SearchFn = async (q, limit) => {
  const { rows } = await fetchPaymentReceived({ page: 1, limit, searchTerm: q });
  return rows.map((r) => {
    const name =
      text((r.customer_id as any)?.businessProfile?.companyName) ||
      text((r.customer_id as any)?.name) ||
      text(r.customer_name) ||
      "Payment";
    return {
      id: `pr-${r._id}`,
      module: "Payment Received" as const,
      title: name,
      number: withHash(text(r.payment_number) || text(r.invoice_number)),
      date: fmtDate(r.date || r.createdAt),
      amount: money(num(r.total), text(r.currency) || "USD"),
      path: "/sales/payment-received",
      selectedId: r._id,
    };
  });
};

const searchBills: SearchFn = async (q, limit) => {
  const { rows } = await fetchBills({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `bill-${r._id}`,
    module: "Bills" as const,
    title: r.vendorName || "Bill",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/purchase/bills",
    selectedId: r._id,
  }));
};

const searchPurchaseOrders: SearchFn = async (q, limit) => {
  const { rows } = await fetchPurchaseOrders({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `po-${r._id}`,
    module: "Purchase Orders" as const,
    title: r.vendorName || "Purchase Order",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/purchase/purchase-orders",
    selectedId: r._id,
  }));
};

const searchExpenses: SearchFn = async (q, limit) => {
  const { rows } = await fetchExpenses({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `exp-${r._id}`,
    module: "Expenses" as const,
    title: r.category !== "—" ? r.category : r.vendorName || "Expense",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/purchase/expense",
    selectedId: r._id,
  }));
};

const searchPaymentMade: SearchFn = async (q, limit) => {
  const { rows } = await fetchVendorPayments({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `pm-${r._id}`,
    module: "Payment Made" as const,
    title: r.vendorName || "Payment Made",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, "USD"),
    path: "/purchase/payment-made",
    selectedId: r._id,
  }));
};

const searchDebitNotes: SearchFn = async (q, limit) => {
  const { rows } = await fetchDebitNotes({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `dn-${r._id}`,
    module: "Debit Notes" as const,
    title: r.vendorName || "Debit Note",
    number: withHash(r.number),
    date: r.dateLabel,
    amount: money(r.amount, r.currency),
    path: "/purchase/debit-notes",
    selectedId: r._id,
  }));
};

const searchProducts: SearchFn = async (q, limit) => {
  const { rows } = await fetchProducts({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `product-${r._id}`,
    module: "Products" as const,
    title: r.name || "Product",
    number: text(r.sku) || "—",
    date: "—",
    amount: money(r.price || r.buyPrice, r.currency || "USD"),
    path: "/items/product",
    selectedId: r._id,
  }));
};

const searchServices: SearchFn = async (q, limit) => {
  const { rows } = await fetchServices({ page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `service-${r._id}`,
    module: "Services" as const,
    title: r.name || "Service",
    number: "—",
    date: "—",
    amount: money(r.price, r.currency || "USD"),
    path: "/items/services",
    selectedId: r._id,
  }));
};

const searchProjects: SearchFn = async (q, limit) => {
  const { rows } = await fetchPaginatedList<any>("/project/all", { page: 1, limit, searchTerm: q });
  return rows.map((r) => ({
    id: `project-${r._id}`,
    module: "Projects" as const,
    title: text(r.name) || "Project",
    number: "—",
    date: fmtDate(r.start_date || r.createdAt),
    amount: money(num(r.budget), "USD"),
    path: `/project/projects/${r._id}`,
    selectedId: String(r._id),
  }));
};

const searchTimeLogs: SearchFn = async (q, limit) => {
  const res = await api.raw.get("/time-log/all", { params: { page: 1, limit: 200 } });
  const body = res.data ?? {};
  const rows: any[] = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  const needle = q.toLowerCase();
  return rows
    .filter((r) => {
      const hay = [r.project, r.task, r.notes, r.details, r.hours].map(text).join(" ").toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, limit)
    .map((r) => ({
      id: `timelog-${r._id}`,
      module: "Time Logs" as const,
      title: text(r.project) || text(r.task) || "Time Log",
      number: text(r.hours) || "—",
      date: fmtDate(r.date || r.created_at || r.createdAt),
      amount: "—",
      path: "/time-logs",
      selectedId: String(r._id),
    }));
};

const searchCompanies: SearchFn = async (q, limit) => {
  const res = await api.raw.get("/company-register/all", { params: { page: 1, limit: 100 } });
  const body = res.data ?? {};
  const rows: any[] = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  const needle = q.toLowerCase();
  return rows
    .filter((r) => {
      const hay = [r.business_name, r.email, r.name].map(text).join(" ").toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, limit)
    .map((r) => ({
      id: `company-${r._id}`,
      module: "Companies" as const,
      title: text(r.business_name || r.name) || "Company",
      number: "—",
      date: fmtDate(r.createdAt),
      amount: "—",
      path: "/companies",
      selectedId: String(r._id),
    }));
};

const REPORT_LINKS = [
  { title: "Sales Report", path: "/reports" },
  { title: "Expense Report", path: "/reports" },
  { title: "Payment Made Report", path: "/reports" },
  { title: "Tax Report", path: "/reports" },
];

const searchReports: SearchFn = async (q, limit) => {
  const needle = q.toLowerCase();
  return REPORT_LINKS.filter((r) => r.title.toLowerCase().includes(needle) || "report".includes(needle))
    .slice(0, limit)
    .map((r, i) => ({
      id: `report-${i}-${r.title}`,
      module: "Reports" as const,
      title: r.title,
      number: "—",
      date: "—",
      amount: "—",
      path: r.path,
      selectedId: "",
    }));
};

const searchTeam: SearchFn = async (q, limit) => {
  try {
    const { rows } = await fetchPaginatedList<any>("/user/all", { page: 1, limit, searchTerm: q });
    return rows.map((r) => ({
      id: `team-${r._id}`,
      module: "Team" as const,
      title: text(r.name) || "Team member",
      number: text(r.email) || "—",
      date: "—",
      amount: "—",
      path: "/team",
      selectedId: String(r._id),
    }));
  } catch {
    return [];
  }
};

const SEARCHERS: Record<Exclude<GlobalSearchModule, "All">, SearchFn> = {
  Customers: searchCustomers,
  Invoices: searchInvoices,
  "Proforma Invoices": searchProformas,
  "Sales Receipts": searchReceipts,
  Estimates: searchEstimates,
  "Delivery Challans": searchChallans,
  "Credit Notes": searchCreditNotes,
  "Payment Received": searchPaymentReceived,
  Vendors: searchVendors,
  "Purchase Orders": searchPurchaseOrders,
  Bills: searchBills,
  Expenses: searchExpenses,
  "Payment Made": searchPaymentMade,
  "Debit Notes": searchDebitNotes,
  Products: searchProducts,
  Services: searchServices,
  "Time Logs": searchTimeLogs,
  Projects: searchProjects,
  Reports: searchReports,
  Team: searchTeam,
  Companies: searchCompanies,
};

/** Modules searched when filter = All (priority order). */
const ALL_PRIORITY: Exclude<GlobalSearchModule, "All">[] = [
  "Customers",
  "Invoices",
  "Bills",
  "Estimates",
  "Products",
  "Vendors",
  "Payment Received",
  "Payment Made",
  "Credit Notes",
  "Delivery Challans",
  "Proforma Invoices",
  "Sales Receipts",
  "Purchase Orders",
  "Expenses",
  "Debit Notes",
  "Services",
  "Projects",
  "Time Logs",
  "Companies",
  "Team",
  "Reports",
];

export async function runGlobalSearch(opts: {
  query: string;
  module: GlobalSearchModule;
  limit?: number;
}): Promise<GlobalSearchHit[]> {
  const q = opts.query.trim();
  if (!q) return [];
  const limit = opts.limit ?? 12;

  if (opts.module !== "All") {
    try {
      return await SEARCHERS[opts.module](q, limit);
    } catch {
      return [];
    }
  }

  const perModule = Math.max(2, Math.ceil(limit / 4));
  const settled = await Promise.allSettled(
    ALL_PRIORITY.map((m) => SEARCHERS[m](q, perModule)),
  );
  const hits: GlobalSearchHit[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") hits.push(...s.value);
  }
  return hits.slice(0, Math.max(limit, 40));
}
