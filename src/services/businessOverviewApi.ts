/**
 * Business Overview reports — Summary, Quarters, Profit by Product, Profit & Loss.
 * All figures come from existing backend endpoints (no dummy / Dexie).
 */
import { api } from "@/lib/api/client";
import { fetchInvoices } from "@/services/invoicesApi";
import { fetchProducts } from "@/services/productsApi";
import { fetchPaymentReceived } from "@/services/paymentReceivedApi";
import { fetchExpenses } from "@/services/expensesApi";
import { fetchCreditNotes } from "@/services/creditNotesApi";
import { fetchDebitNotes } from "@/services/debitNotesApi";
import type { ReportCol, ReportFilters, ReportView } from "@/services/reportTypes";

export type SummaryLine = { label: string; values: string[] };
export type SummaryBlock = { title: string; lines: SummaryLine[] };

export type QuarterMonthRow = {
  label: string;
  count: number;
  paid: string;
  due: string;
  overdue: string;
  total: string;
};

export type QuarterBlock = {
  title: string;
  months: QuarterMonthRow[];
  totals: { paid: string; due: string; overdue: string; total: string };
};

export type BusinessOverviewView = ReportView & {
  layout: "summary" | "quarters" | "table" | "pnl";
  summaryBlocks?: SummaryBlock[];
  quarterBlocks?: QuarterBlock[];
};

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const yearEnd = () => `${new Date().getFullYear()}-12-31`;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

const money = (amount: number, currency = "USD") => {
  const cur = (currency || "USD").toUpperCase();
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = amount < 0 ? "-" : "";
  if (cur === "BDT") return `${sign}৳${formatted} BDT`;
  if (cur === "USD") return `${sign}$${formatted} USD`;
  return `${sign}${formatted} ${cur}`;
};

/** Format one or more currency buckets as display lines. */
const moneyLines = (byCur: Record<string, number>): string[] => {
  const entries = Object.entries(byCur).filter(([, v]) => Math.abs(v) > 0.0001);
  if (entries.length === 0) return [money(0, "USD")];
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, amt]) => money(amt, cur));
};

const addCur = (bag: Record<string, number>, currency: string, amount: number) => {
  const cur = (currency || "USD").toUpperCase() || "USD";
  bag[cur] = (bag[cur] || 0) + amount;
};

const toExportRows = (blocks: SummaryBlock[]): { cols: ReportCol[]; rows: string[][]; totals: string[] } => {
  const cols: ReportCol[] = [{ label: "Section" }, { label: "Item" }, { label: "Amount", right: true }];
  const rows: string[][] = [];
  blocks.forEach((b) => {
    b.lines.forEach((line) => {
      rows.push([b.title, line.label, line.values.join(" | ")]);
    });
  });
  return { cols, rows, totals: ["", `Lines (${rows.length})`, ""] };
};

const dashRangeFrom = (filters: ReportFilters) => {
  const period = String(filters.period || "All");
  if (period === "Custom") return filters.fromDate || yearStart();
  if (period === "This Year") return yearStart();
  if (period === "This Month") {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (period === "Last 30 Days") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  return "2000-01-01";
};

const dashRangeTo = (filters: ReportFilters) => {
  if (String(filters.period || "All") === "Custom") return filters.toDate || today();
  return today();
};

async function fetchDashboardSummary(filters: ReportFilters) {
  const period = String(filters.period || "All");
  const params: Record<string, string> = { granularity: "month" };

  if (period === "This Month") {
    params.period = "this_month";
  } else if (period === "Last 30 Days") {
    params.period = "last_30_days";
  } else if (period === "This Year") {
    params.period = "this_year";
  } else if (period === "Custom") {
    params.period = "custom";
    params.from = filters.fromDate || yearStart();
    params.to = filters.toDate || today();
  } else {
    // All — widest practical range the dashboard accepts as custom
    params.period = "custom";
    params.from = "2000-01-01";
    params.to = today();
  }

  if (filters.contactId) {
    params.user_id = filters.contactId;
    if (filters.contactRole) params.role = filters.contactRole;
  } else if (filters.customerId) {
    params.user_id = filters.customerId;
    params.role = "customer";
  }

  const res = await api.raw.get("/dashboard/summary", { params });
  return res.data?.data ?? res.data ?? {};
}

async function fetchAccountSummary() {
  const res = await api.raw.get("/account/reports/summary");
  return res.data?.data ?? res.data ?? {};
}

async function fetchBankAccounts() {
  try {
    const res = await api.raw.get("/account/bank-accounts/all", { params: { page: 1, limit: 200 } });
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? data : Array.isArray(data?.allRecords) ? data.allRecords : [];
  } catch {
    return [];
  }
}

/** Paginate a list fetcher until done or maxPages. */
async function fetchAllPages<T>(
  load: (page: number, limit: number) => Promise<{ rows: T[]; totalPages: number }>,
  limit = 100,
  maxPages = 10,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { rows, totalPages } = await load(page, limit);
    all.push(...rows);
    if (page >= totalPages || rows.length === 0) break;
  }
  return all;
}

export async function loadSummaryReport(filters: ReportFilters): Promise<BusinessOverviewView> {
  const from = dashRangeFrom(filters);
  const to = dashRangeTo(filters);

  const [dash, acct, banks, payments, expenses, creditNotes, debitNotes, draftInvoices] = await Promise.all([
    fetchDashboardSummary(filters),
    fetchAccountSummary(),
    fetchBankAccounts(),
    fetchAllPages(async (page, limit) => {
      const r = await fetchPaymentReceived({ page, limit });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
    fetchAllPages(async (page, limit) => {
      const r = await fetchExpenses({ page, limit });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
    fetchAllPages(async (page, limit) => {
      const r = await fetchCreditNotes({ page, limit });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
    fetchAllPages(async (page, limit) => {
      const r = await fetchDebitNotes({ page, limit });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
    fetchAllPages(async (page, limit) => {
      const r = await fetchInvoices({
        page,
        limit,
        status: "Draft",
        dateFrom: from,
        dateTo: to,
      });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
  ]);

  const stats = dash?.stats ?? {};
  const acctSummary = acct?.summary ?? {};
  const salesBd = acct?.sales_breakdown ?? {};

  const cashBag: Record<string, number> = {};
  const bankBag: Record<string, number> = {};
  for (const b of banks as any[]) {
    const bal = num(b.current_balance);
    const type = text(b.account_type).toLowerCase();
    const cur = text(b.currency) || "USD";
    if (type.includes("cash")) addCur(cashBag, cur, bal);
    else addCur(bankBag, cur, bal);
  }

  const payByMethod = new Map<string, Record<string, number>>();
  for (const p of payments as any[]) {
    const methods: string[] = Array.isArray(p.payment_method) && p.payment_method.length
      ? p.payment_method.map((m: unknown) => text(m) || "Other")
      : ["Unspecified"];
    const amt = num(p.total ?? p.payment_amount ?? p.amount);
    const cur = text(p.currency) || "USD";
    const share = amt / methods.length;
    methods.forEach((m) => {
      const bag = payByMethod.get(m) || {};
      addCur(bag, cur, share);
      payByMethod.set(m, bag);
    });
  }

  const expByCat = new Map<string, Record<string, number>>();
  for (const e of expenses as any[]) {
    const cat = text(e.category) || "Uncategorized";
    const bag = expByCat.get(cat) || {};
    addCur(bag, text(e.currency) || "USD", num(e.amount));
    expByCat.set(cat, bag);
  }

  const creditBag: Record<string, number> = {};
  for (const c of creditNotes as any[]) {
    addCur(creditBag, text(c.currency) || "USD", num(c.amount ?? c.total));
  }
  const debitBag: Record<string, number> = {};
  for (const d of debitNotes as any[]) {
    addCur(debitBag, text(d.currency) || "USD", num(d.amount ?? d.total));
  }

  const draftBag: Record<string, number> = {};
  for (const inv of draftInvoices as any[]) {
    addCur(draftBag, text(inv.currency) || "USD", num(inv.amount));
  }

  const fmtStat = (n: unknown) => [money(num(n))];

  const topList = (arr: any[] | undefined, fallback: { name: string; value: number }[] = []) => {
    const src = Array.isArray(arr) && arr.length ? arr : fallback;
    return src.slice(0, 5).map((x) => ({
      label: text(x.name) || "—",
      values: [money(num(x.amount ?? x.value))],
    }));
  };

  const blocks: SummaryBlock[] = [
    {
      title: "Summary Report",
      lines: [
        { label: "Outstanding", values: fmtStat(stats.outstanding ?? acctSummary.outstanding) },
        { label: "Cash in Hand", values: moneyLines(cashBag) },
        { label: "Total Bank Balance", values: moneyLines(bankBag) },
        { label: "Sales", values: fmtStat(stats.sales ?? acctSummary.sales) },
        { label: "Payment Received", values: fmtStat(stats.payment_received ?? acctSummary.payment_received) },
        { label: "Expenses", values: fmtStat(stats.expenses ?? acctSummary.expenses) },
        { label: "Payable Amount", values: fmtStat(stats.payable_amount) },
        { label: "Payment Mades", values: fmtStat(stats.payment_made) },
        { label: "Purchase Orders", values: fmtStat(stats.purchase_orders ?? acctSummary.purchase_order) },
        { label: "Overdue", values: fmtStat(stats.overdue ?? acctSummary.overdue) },
        { label: "Bills", values: fmtStat(stats.bills ?? acctSummary.bills) },
        {
          label: "Credit Note",
          values: Object.keys(creditBag).length ? moneyLines(creditBag) : fmtStat(acctSummary.credit_notes),
        },
        {
          label: "Debit Notes",
          values: Object.keys(debitBag).length ? moneyLines(debitBag) : fmtStat(acctSummary.debit_notes),
        },
        { label: "Estimates", values: fmtStat(stats.estimates ?? acctSummary.estimates) },
        { label: "Net Profit", values: fmtStat(stats.net_profit ?? acctSummary.net_profit) },
        {
          label: "Draft Invoices",
          values: Object.keys(draftBag).length ? moneyLines(draftBag) : [money(0)],
        },
        { label: "Proforma Invoice", values: fmtStat(stats.proforma_invoices ?? acctSummary.proforma_invoice) },
        {
          label: "Time Logs",
          values: [`${num(acctSummary.time_logs).toFixed(2)} hrs`],
        },
      ],
    },
    {
      title: "Top Customers",
      lines: topList(dash?.topCustomers, acct?.top_customers),
    },
    {
      title: "Top Vendors",
      lines: topList(dash?.topVendors, acct?.top_vendors),
    },
    {
      title: "Top Products",
      lines: topList(dash?.topProducts),
    },
    {
      title: "Top Task",
      lines: topList(dash?.topServices),
    },
    {
      title: "Sales",
      lines: [
        { label: "Discount", values: fmtStat(salesBd.discount) },
        { label: "Net Sales", values: fmtStat(salesBd.net_sales) },
        { label: "Tax", values: fmtStat(salesBd.tax) },
        { label: "Gross Sales", values: fmtStat(salesBd.gross_sales) },
        { label: "Total", values: fmtStat(salesBd.total ?? stats.sales) },
      ],
    },
    {
      title: "Payment Received",
      lines: [
        ...[...payByMethod.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, bag]) => ({ label: name, values: moneyLines(bag) })),
        {
          label: "Total",
          values: fmtStat(stats.payment_received ?? acctSummary.payment_received),
        },
      ],
    },
    {
      title: "Expenses",
      lines: [
        ...[...expByCat.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, bag]) => ({ label: name, values: moneyLines(bag) })),
        { label: "Total", values: fmtStat(stats.expenses ?? acctSummary.expenses) },
      ],
    },
  ];

  const flat = toExportRows(blocks);
  return {
    name: "Summary Report",
    layout: "summary",
    cols: flat.cols,
    rows: flat.rows,
    totals: flat.totals,
    meta: { from, to },
    source: "backend",
    summaryBlocks: blocks,
  };
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function loadQuartersReport(filters: ReportFilters): Promise<BusinessOverviewView> {
  const from = dashRangeFrom(filters);
  const to = dashRangeTo(filters);
  const dash = await fetchDashboardSummary(filters);
  const chart = dash?.chart ?? {};
  const labels: string[] = Array.isArray(chart.labels) ? chart.labels : [];
  const paidArr: number[] = Array.isArray(chart.paid) ? chart.paid.map(num) : [];
  const overdueArr: number[] = Array.isArray(chart.overdue) ? chart.overdue.map(num) : [];
  const salesArr: number[] = Array.isArray(chart.sales) ? chart.sales.map(num) : [];

  // Parse "Aug 2026" / "Aug" style labels into year+month for quarter grouping.
  const parseLabel = (label: string, index: number) => {
    const m = label.match(/([A-Za-z]+)\s*(\d{4})?/);
    const monthName = m?.[1] || "";
    const year = Number(m?.[2]) || new Date(from).getFullYear();
    let monthIdx = MONTH_SHORT.findIndex((x) => x.toLowerCase() === monthName.slice(0, 3).toLowerCase());
    if (monthIdx < 0) {
      // Fallback: sequential months from filter start
      const start = new Date(from);
      monthIdx = (start.getMonth() + index) % 12;
    }
    return { year, monthIdx, label };
  };

  type Acc = { paid: number; due: number; overdue: number; total: number; count: number; label: string; monthIdx: number };
  const byYm = new Map<string, Acc>();

  labels.forEach((label, i) => {
    const { year, monthIdx } = parseLabel(label, i);
    const key = `${year}-${monthIdx}`;
    const paid = paidArr[i] || 0;
    const overdue = overdueArr[i] || 0;
    const sales = salesArr[i] || 0;
    const due = Math.max(0, sales - paid - overdue);
    byYm.set(key, {
      paid,
      due,
      overdue,
      total: sales,
      count: sales > 0 || paid > 0 || overdue > 0 ? 1 : 0,
      label: `${MONTH_SHORT[monthIdx]}`,
      monthIdx,
    });
  });

  const years = [...new Set([...byYm.keys()].map((k) => Number(k.split("-")[0])))].sort((a, b) => b - a);
  const quarterBlocks: QuarterBlock[] = [];
  const tableRows: string[][] = [];

  for (const year of years) {
    for (let q = 4; q >= 1; q--) {
      const monthsInQ = [0, 1, 2].map((i) => (q - 1) * 3 + i);
      const monthRows: QuarterMonthRow[] = monthsInQ.map((monthIdx) => {
        const acc = byYm.get(`${year}-${monthIdx}`) || {
          paid: 0,
          due: 0,
          overdue: 0,
          total: 0,
          count: 0,
          label: MONTH_SHORT[monthIdx],
          monthIdx,
        };
        const active = Math.abs(acc.total) > 0.001 || Math.abs(acc.paid) > 0.001 || Math.abs(acc.overdue) > 0.001;
        const countLabel = active ? String(Math.max(1, acc.count)).padStart(2, "0") : "0";
        return {
          label: `${MONTH_SHORT[monthIdx]} (${countLabel})`,
          count: active ? Math.max(1, acc.count) : 0,
          paid: money(acc.paid),
          due: money(acc.due),
          overdue: money(acc.overdue),
          total: money(acc.total),
        };
      });

      const hasData = monthRows.some((m) => m.count > 0 || m.paid !== money(0) || m.total !== money(0));
      if (!hasData && years.length > 1) continue;

      const sum = (pick: keyof Acc) =>
        monthsInQ.reduce((s, mi) => s + num((byYm.get(`${year}-${mi}`) as Acc | undefined)?.[pick]), 0);

      const totals = {
        paid: money(sum("paid")),
        due: money(sum("due")),
        overdue: money(sum("overdue")),
        total: money(sum("total")),
      };

      const title = `Q${q}, ${year}`;
      quarterBlocks.push({ title, months: monthRows, totals });

      monthRows.forEach((m) => {
        tableRows.push([title, m.label, m.paid, m.due, m.overdue, m.total]);
      });
      tableRows.push([title, "Total", totals.paid, totals.due, totals.overdue, totals.total]);
    }
  }

  const cols: ReportCol[] = [
    { label: "Quarter" },
    { label: "Month" },
    { label: "Paid", right: true },
    { label: "Due", right: true },
    { label: "Overdue", right: true },
    { label: "Total", right: true },
  ];

  return {
    name: "Quarters Report",
    layout: "quarters",
    cols,
    rows: tableRows,
    totals: ["", `Months (${tableRows.length})`, "", "", "", ""],
    meta: { from, to },
    source: "backend",
    quarterBlocks,
  };
}

export async function loadProfitByProductReport(filters: ReportFilters): Promise<BusinessOverviewView> {
  const from = dashRangeFrom(filters);
  const to = dashRangeTo(filters);
  const categoryId = text(filters.categoryId);
  const productId = text(filters.productId);
  const productType = text(filters.productType) || "All";

  const products = await fetchAllPages(async (page, limit) => {
    const r = await fetchProducts({
      page,
      limit,
      category: categoryId || undefined,
    });
    return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
  }, 100, 20);

  const filteredProducts = products.filter((p) => {
    if (productId && p._id !== productId) return false;
    // Backend has no multi-variant flag — catalog products are Standard.
    if (productType === "Multi-variant") return false;
    if (productType === "Standard") return true;
    return true;
  });

  type Agg = {
    productId: string;
    sku: string;
    productType: string;
    itemName: string;
    unitType: string;
    buySum: number;
    buyQty: number;
    sellSum: number;
    sellQty: number;
    quantity: number;
    discount: number;
    stock: number;
    currency: string;
    sales: number;
  };

  const productMap = new Map(filteredProducts.map((p) => [p._id, p]));
  const allowedIds = productId
    ? new Set([productId])
    : categoryId || productType === "Multi-variant"
      ? new Set(filteredProducts.map((p) => p._id))
      : null;
  const agg = new Map<string, Agg>();

  for (let page = 1; page <= 20; page++) {
    const res = await api.raw.get("/invoices", {
      params: { page, limit: 100, dateFrom: from, dateTo: to, dateField: "date" },
    });
    const body = res.data ?? {};
    const items: any[] = Array.isArray(body.data) ? body.data : [];
    const totalPages = Number(body.pagination?.totalPage) || 1;

    for (const inv of items) {
      const currency = text(inv.currency) || "USD";
      const lines: any[] = Array.isArray(inv.product) ? inv.product : [];
      for (const line of lines) {
        const pid =
          typeof line.product_id === "object" && line.product_id
            ? text(line.product_id._id)
            : text(line.product_id);
        if (allowedIds && pid && !allowedIds.has(pid)) continue;
        if (allowedIds && !pid) continue;
        if (productType === "Multi-variant") continue;

        const key = pid || `name:${text(line.product_name) || "unknown"}:${currency}`;
        const prod = pid ? productMap.get(pid) : undefined;
        if ((categoryId || productId) && pid && !prod) continue;

        const qty = num(line.quantity);
        const rate = num(line.rate);
        const discount = num(line.discount);
        const amount = num(line.amount) || Math.max(0, qty * rate - discount);
        const buy = prod?.buyPrice ?? 0;

        const prev = agg.get(key) || {
          productId: pid,
          sku: prod?.sku || "—",
          productType: "Standard",
          itemName: prod?.name || text(line.product_name) || text(line.product_id?.productName) || "—",
          unitType: prod?.unit || "—",
          buySum: 0,
          buyQty: 0,
          sellSum: 0,
          sellQty: 0,
          quantity: 0,
          discount: 0,
          stock: prod?.stock ?? 0,
          currency,
          sales: 0,
        };

        prev.quantity += qty;
        prev.discount += discount;
        prev.sales += amount;
        prev.sellSum += rate * qty;
        prev.sellQty += qty;
        prev.buySum += buy * qty;
        prev.buyQty += qty;
        if (prod) {
          prev.sku = prod.sku || prev.sku;
          prev.unitType = prod.unit || prev.unitType;
          prev.stock = prod.stock ?? prev.stock;
          prev.itemName = prod.name || prev.itemName;
        }
        agg.set(key, prev);
      }
    }

    if (page >= totalPages || items.length === 0) break;
  }

  // Include products with zero sales still listed? Client shows sold products mainly.
  // Also include stock products that appear in catalog with sales only.
  const cols: ReportCol[] = [
    { label: "SKU" },
    { label: "Product Type" },
    { label: "Item Name" },
    { label: "Unit Type" },
    { label: "Avg. Buy Price", right: true },
    { label: "Avg. Sell Price", right: true },
    { label: "Quantity", right: true },
    { label: "Discount", right: true },
    { label: "Stock", right: true },
    { label: "Profit", right: true },
    { label: "Total Sales", right: true },
  ];

  let totQty = 0;
  let totDiscount = 0;
  let totStock = 0;
  let totProfit = 0;
  let totSales = 0;

  const rows = [...agg.values()]
    .sort((a, b) => b.sales - a.sales)
    .map((a) => {
      const avgBuy = a.buyQty ? a.buySum / a.buyQty : 0;
      const avgSell = a.sellQty ? a.sellSum / a.sellQty : 0;
      const profit = a.sales - a.buySum;
      totQty += a.quantity;
      totDiscount += a.discount;
      totStock += num(a.stock);
      totProfit += profit;
      totSales += a.sales;
      return [
        a.sku,
        a.productType,
        a.itemName,
        a.unitType,
        money(avgBuy, a.currency),
        money(avgSell, a.currency),
        String(a.quantity),
        money(a.discount, a.currency),
        String(a.stock ?? 0),
        money(profit, a.currency),
        money(a.sales, a.currency),
      ];
    });

  return {
    name: "Profit by Product Report",
    layout: "table",
    cols,
    rows,
    totals: [
      `Total (${rows.length})`,
      "",
      "",
      "",
      "",
      "",
      String(totQty),
      money(totDiscount),
      String(totStock),
      money(totProfit),
      money(totSales),
    ],
    meta: { from, to },
    source: "backend",
  };
}

export async function loadOperationalProfitLoss(filters: ReportFilters): Promise<BusinessOverviewView> {
  const from = dashRangeFrom(filters);
  const to = dashRangeTo(filters);

  const [dash, acct, expenses, creditNotes] = await Promise.all([
    fetchDashboardSummary(filters),
    fetchAccountSummary(),
    fetchAllPages(async (page, limit) => {
      const r = await fetchExpenses({ page, limit });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
    fetchAllPages(async (page, limit) => {
      const r = await fetchCreditNotes({ page, limit });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
  ]);

  const stats = dash?.stats ?? {};
  const sales = num(stats.sales ?? acct?.summary?.sales);
  const returnsBag: Record<string, number> = {};
  for (const c of creditNotes as any[]) {
    addCur(returnsBag, text(c.currency) || "USD", num(c.amount ?? c.total));
  }
  const returnsTotal = Object.values(returnsBag).reduce((s, n) => s + n, 0) || num(acct?.summary?.credit_notes);
  const purchases = num(stats.purchase_orders ?? acct?.summary?.purchase_order);
  const paymentMade = num(stats.payment_made);

  const expByCat = new Map<string, number>();
  for (const e of expenses as any[]) {
    const cat = text(e.category) || "Uncategorized";
    expByCat.set(cat, (expByCat.get(cat) || 0) + num(e.amount));
  }
  const opExTotal = [...expByCat.values()].reduce((s, n) => s + n, 0) || num(stats.expenses);

  const netIncome = sales - returnsTotal;
  const costOfSales = purchases || paymentMade;
  const grossProfit = netIncome - costOfSales;
  const netProfit = grossProfit - opExTotal;

  const blocks: SummaryBlock[] = [
    {
      title: "Income",
      lines: [
        { label: "Sales", values: [money(sales)] },
        {
          label: "Returns",
          values: Object.keys(returnsBag).length ? moneyLines(returnsBag) : [money(returnsTotal)],
        },
        { label: "Net Income", values: [money(netIncome)] },
      ],
    },
    {
      title: "Less Cost of Sales",
      lines: [
        { label: "Purchases", values: [money(purchases), ...(paymentMade ? [money(paymentMade)] : [])] },
        { label: "Total Cost of Sales", values: [money(costOfSales)] },
      ],
    },
    {
      title: "Gross Profit",
      lines: [{ label: "Gross Profit", values: [money(grossProfit)] }],
    },
    {
      title: "Less Operating Expenses",
      lines: [
        ...[...expByCat.entries()].map(([label, amt]) => ({ label, values: [money(amt)] })),
        { label: "Total Operating Expenses", values: [money(opExTotal)] },
      ],
    },
    {
      title: "Net Profit",
      lines: [{ label: "Net Profit", values: [money(netProfit)] }],
    },
  ];

  const flat = toExportRows(blocks);
  return {
    name: "Profit & Loss",
    layout: "pnl",
    cols: flat.cols,
    rows: flat.rows,
    totals: ["", "Net Profit", money(netProfit)],
    meta: { from, to },
    source: "backend",
    summaryBlocks: blocks,
  };
}

export function isBusinessOverviewReport(name: string) {
  return (
    name === "Summary Report" ||
    name === "Quarters Report" ||
    name === "Profit by Product Report" ||
    name === "Profit & Loss"
  );
}

export { today, yearStart, yearEnd };
