/**
 * Root dashboard Summary cards — layout matches product screenshot (6×3).
 * Figures from existing APIs: `/dashboard/summary`, banks, notes, drafts, time logs.
 */
import { api } from "@/lib/api/client";
import { fetchInvoices } from "@/services/invoicesApi";
import { fetchPaymentReceived } from "@/services/paymentReceivedApi";
import { fetchExpenses } from "@/services/expensesApi";
import { fetchCreditNotes } from "@/services/creditNotesApi";
import { fetchDebitNotes } from "@/services/debitNotesApi";
import { fetchEstimates } from "@/services/estimatesApi";
import { fetchProformaInvoices } from "@/services/proformaInvoicesApi";
import { fetchPaginatedList } from "@/services/paginatedList";

export type SummaryCardColor = "red" | "green" | "orange" | "muted" | "profit";

export type DashboardSummaryCard = {
  key: string;
  label: string;
  values: string[];
  color: SummaryCardColor;
  info?: boolean;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

const money = (amount: number, currency = "USD") => {
  const cur = (currency || "USD").toUpperCase();
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  if (cur === "BDT") return `${sign}৳${formatted} BDT`;
  if (cur === "USD") return `${sign}$${formatted} USD`;
  return `${sign}${formatted} ${cur}`;
};

const moneyLines = (byCur: Record<string, number>, allowZero = false): string[] => {
  const entries = Object.entries(byCur).filter(([, v]) => allowZero || Math.abs(v) > 0.0001);
  if (entries.length === 0) return [money(0, "BDT")];
  // Prefer BDT then USD then others (screenshot order often BDT first)
  entries.sort(([a], [b]) => {
    const rank = (c: string) => (c === "BDT" ? 0 : c === "USD" ? 1 : 2);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return entries.map(([cur, amt]) => money(amt, cur));
};

const addCur = (bag: Record<string, number>, currency: string, amount: number) => {
  const cur = (currency || "USD").toUpperCase() || "USD";
  bag[cur] = (bag[cur] || 0) + amount;
};

const fmtHours = (hours: number): string => {
  const totalMins = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, "0")} Hours`;
};

/** Map UI period label → dashboard query params */
export function periodToParams(period: string): Record<string, string> {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const startOfWeek = () => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  };

  switch (period) {
    case "Today":
      return { period: "custom", from: iso(now), to: iso(now) };
    case "This Week":
      return { period: "custom", from: iso(startOfWeek()), to: iso(now) };
    case "Last Week": {
      const end = startOfWeek();
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { period: "custom", from: iso(start), to: iso(end) };
    }
    case "This Month":
      return { period: "this_month" };
    case "Last 30 Days":
      return { period: "last_30_days" };
    case "Last Month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { period: "custom", from: iso(start), to: iso(end) };
    }
    case "Last 90 Days": {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { period: "custom", from: iso(from), to: iso(now) };
    }
    case "This Quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return {
        period: "custom",
        from: iso(new Date(now.getFullYear(), q, 1)),
        to: iso(now),
      };
    }
    case "Last Quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), q - 3, 1);
      const end = new Date(now.getFullYear(), q, 0);
      return { period: "custom", from: iso(start), to: iso(end) };
    }
    case "Last 6 Months": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 6);
      return { period: "custom", from: iso(from), to: iso(now) };
    }
    case "This Year":
      return { period: "this_year" };
    case "Last 12 Months": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { period: "custom", from: iso(from), to: iso(now) };
    }
    case "Last Year": {
      const y = now.getFullYear() - 1;
      return {
        period: "custom",
        from: `${y}-01-01`,
        to: `${y}-12-31`,
      };
    }
    case "This Financial Year":
    case "Last Financial Year": {
      // Jul–Jun FY fallback
      const y = now.getFullYear();
      const m = now.getMonth();
      if (period === "This Financial Year") {
        const startY = m >= 6 ? y : y - 1;
        return { period: "custom", from: `${startY}-07-01`, to: iso(now) };
      }
      const startY = m >= 6 ? y - 1 : y - 2;
      return {
        period: "custom",
        from: `${startY}-07-01`,
        to: `${startY + 1}-06-30`,
      };
    }
    default:
      return { period: "this_year" };
  }
}

async function fetchAllPages<T>(
  load: (page: number, limit: number) => Promise<{ rows: T[]; totalPages: number }>,
  limit = 100,
  maxPages = 8,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const { rows, totalPages } = await load(page, limit);
    all.push(...rows);
    if (page >= totalPages || rows.length === 0) break;
  }
  return all;
}

async function fetchBanks(): Promise<any[]> {
  try {
    const res = await api.raw.get("/account/bank-accounts/all", {
      params: { page: 1, limit: 200 },
    });
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? data : Array.isArray(data?.allRecords) ? data.allRecords : [];
  } catch {
    return [];
  }
}

async function fetchAccountSummary(): Promise<any> {
  try {
    const res = await api.raw.get("/account/reports/summary");
    return res.data?.data ?? res.data ?? {};
  } catch {
    return {};
  }
}

export function dateBounds(period: string): { from: string; to: string } {
  const p = periodToParams(period);
  if (p.period === "this_year") {
    const y = new Date().getFullYear();
    return { from: `${y}-01-01`, to: new Date().toISOString().slice(0, 10) };
  }
  if (p.period === "this_month") {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
    };
  }
  if (p.period === "last_30_days") {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  return {
    from: p.from || `${new Date().getFullYear()}-01-01`,
    to: p.to || new Date().toISOString().slice(0, 10),
  };
}

export async function loadDashboardSummaryCards(
  periodLabel: string,
): Promise<{
  cards: DashboardSummaryCard[];
  topCustomers: { name: string; amount: string }[];
  topProducts: { name: string; amount: string }[];
  topVendors: { name: string; amount: string }[];
  chart: any;
}> {
  const params = periodToParams(periodLabel);
  const { from, to } = dateBounds(periodLabel);

  const [
    dashRes,
    acct,
    banks,
    invoices,
    payments,
    expenses,
    creditNotes,
    debitNotes,
    estimates,
    proformas,
    drafts,
  ] = await Promise.all([
    api.raw.get("/dashboard/summary", { params }).then((r) => r.data?.data ?? r.data ?? {}),
    fetchAccountSummary(),
    fetchBanks(),
    fetchAllPages(async (page, limit) => {
      const r = await fetchInvoices({
        page,
        limit,
        dateFrom: from,
        dateTo: to,
        dateField: "date",
      });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
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
      const r = await fetchEstimates({
        page,
        limit,
        dateFrom: from,
        dateTo: to,
      });
      return { rows: r.rows, totalPages: r.pagination.totalPage || 1 };
    }),
    fetchAllPages(async (page, limit) => {
      const r = await fetchProformaInvoices({
        page,
        limit,
      });
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

  const stats = dashRes?.stats ?? {};
  const acctSummary = acct?.summary ?? {};

  const cashBag: Record<string, number> = {};
  const bankBag: Record<string, number> = {};
  for (const b of banks) {
    const bal = num(b.current_balance);
    const type = text(b.account_type).toLowerCase();
    const cur = text(b.currency) || "USD";
    if (type.includes("cash")) addCur(cashBag, cur, bal);
    else addCur(bankBag, cur, bal);
  }

  const salesBag: Record<string, number> = {};
  const outstandingBag: Record<string, number> = {};
  const overdueBag: Record<string, number> = {};
  const now = Date.now();
  for (const inv of invoices as any[]) {
    const cur = text(inv.currency) || "USD";
    const total = num(inv.amount ?? inv.total);
    const due = num(inv.dueAmount ?? inv.balance_amount ?? inv.amountDue);
    addCur(salesBag, cur, total);
    if (due > 0) addCur(outstandingBag, cur, -due);
    const dueDate = inv.dueDate || inv.due_date;
    const status = text(inv.status).toLowerCase();
    if (due > 0 && (status === "overdue" || (dueDate && new Date(dueDate).getTime() < now))) {
      addCur(overdueBag, cur, due);
    }
  }

  const payRecvBag: Record<string, number> = {};
  for (const p of payments as any[]) {
    addCur(payRecvBag, text(p.currency) || "USD", num(p.total ?? p.amount ?? p.payment_amount));
  }

  const expBag: Record<string, number> = {};
  for (const e of expenses as any[]) {
    addCur(expBag, text(e.currency) || "USD", num(e.amount ?? e.total));
  }

  // Bills / vendor payments raw for currency + balance
  let billsRaw: any[] = [];
  let vendorRaw: any[] = [];
  try {
    const [bRes, vRes] = await Promise.all([
      fetchPaginatedList<any>("/bill/all", { page: 1, limit: 200 }),
      fetchPaginatedList<any>("/account/vendor-payments/all", { page: 1, limit: 200 }),
    ]);
    billsRaw = bRes.rows;
    vendorRaw = vRes.rows;
  } catch {
    billsRaw = [];
    vendorRaw = [];
  }

  const payableBag: Record<string, number> = {};
  const billsBag: Record<string, number> = {};
  for (const b of billsRaw) {
    const cur = text(b.currency) || "USD";
    addCur(billsBag, cur, num(b.total ?? b.amount));
    const due = num(b.balance_amount ?? b.balance);
    if (due > 0) addCur(payableBag, cur, due);
  }

  const payMadeBag: Record<string, number> = {};
  for (const p of vendorRaw) {
    addCur(
      payMadeBag,
      text(p.currency) || "USD",
      num(p.payment_amount ?? p.total ?? p.amount),
    );
  }

  const creditBag: Record<string, number> = {};
  for (const c of creditNotes as any[]) {
    addCur(creditBag, text(c.currency) || "USD", num(c.amount ?? c.total));
  }

  const debitBag: Record<string, number> = {};
  for (const d of debitNotes as any[]) {
    addCur(debitBag, text(d.currency) || "USD", num(d.amount ?? d.total));
  }

  const estBag: Record<string, number> = {};
  for (const e of estimates as any[]) {
    addCur(estBag, text(e.currency) || "USD", num(e.amount ?? e.total));
  }

  const draftBag: Record<string, number> = {};
  for (const inv of drafts as any[]) {
    addCur(draftBag, text(inv.currency) || "USD", num(inv.amount ?? inv.total));
  }

  const proformaBag: Record<string, number> = {};
  for (const p of proformas as any[]) {
    addCur(proformaBag, text(p.currency) || "USD", num(p.amount ?? p.total));
  }

  // Fallbacks from dashboard stats when list bags empty
  const singleOrBag = (bag: Record<string, number>, fallback: unknown) =>
    Object.keys(bag).length ? moneyLines(bag) : [money(num(fallback))];

  // Net profit: sales − expenses per currency (and leftover singles from stats)
  const profitBag: Record<string, number> = {};
  const allCur = new Set([...Object.keys(salesBag), ...Object.keys(expBag)]);
  for (const c of allCur) {
    profitBag[c] = (salesBag[c] || 0) - (expBag[c] || 0);
  }
  if (!Object.keys(profitBag).length) {
    profitBag.USD = num(stats.net_profit ?? acctSummary.net_profit);
  }

  const cards: DashboardSummaryCard[] = [
    {
      key: "Outstanding",
      label: "Outstanding",
      values: singleOrBag(outstandingBag, stats.outstanding ?? acctSummary.outstanding),
      color: "red",
      info: true,
    },
    {
      key: "Cash In Hand",
      label: "Cash In Hand",
      values: moneyLines(cashBag),
      color: "orange",
    },
    {
      key: "Total Bank Balance",
      label: "Total Bank Balance",
      values: moneyLines(bankBag),
      color: "green",
    },
    {
      key: "Sales",
      label: "Sales",
      values: singleOrBag(salesBag, stats.sales ?? acctSummary.sales),
      color: "green",
    },
    {
      key: "Payments",
      label: "Payment Received",
      values: singleOrBag(payRecvBag, stats.payment_received ?? acctSummary.payment_received),
      color: "green",
    },
    {
      key: "Expenses",
      label: "Expenses",
      values: singleOrBag(expBag, stats.expenses ?? acctSummary.expenses),
      color: "orange",
    },
    {
      key: "Payable Amount",
      label: "Payable Amount",
      values: singleOrBag(payableBag, stats.payable_amount),
      color: "red",
      info: true,
    },
    {
      key: "Payment Made",
      label: "Payment Made",
      values: singleOrBag(payMadeBag, stats.payment_made),
      color: "green",
    },
    {
      key: "Purchase Orders",
      label: "Purchase Orders",
      values: [money(num(stats.purchase_orders ?? acctSummary.purchase_order), "BDT")],
      color: "muted",
    },
    {
      key: "Overdue",
      label: "Overdue",
      values: singleOrBag(overdueBag, stats.overdue ?? acctSummary.overdue),
      color: "red",
      info: true,
    },
    {
      key: "Bills",
      label: "Bills",
      values: singleOrBag(billsBag, stats.bills ?? acctSummary.bills),
      color: "muted",
    },
    {
      key: "Credit Notes",
      label: "Credit Notes",
      values: singleOrBag(creditBag, acctSummary.credit_notes),
      color: "green",
    },
    {
      key: "Debit Notes",
      label: "Debit Notes",
      values: singleOrBag(debitBag, acctSummary.debit_notes),
      color: "green",
    },
    {
      key: "Estimates",
      label: "Estimates",
      values: singleOrBag(estBag, stats.estimates ?? acctSummary.estimates),
      color: "orange",
    },
    {
      key: "Net Profit",
      label: "Net Profit",
      values: moneyLines(profitBag, true),
      color: "profit",
    },
    {
      key: "Draft Invoices",
      label: "Draft Invoices",
      values: moneyLines(draftBag),
      color: "muted",
    },
    {
      key: "Proforma Invoices",
      label: "Proforma Invoices",
      values: singleOrBag(proformaBag, stats.proforma_invoices ?? acctSummary.proforma_invoice),
      color: "muted",
    },
    {
      key: "Time Logs",
      label: "Time Logs",
      values: [fmtHours(num(acctSummary.time_logs))],
      color: "muted",
    },
  ];

  const mapTop = (rows: any[], currency = "BDT") =>
    (Array.isArray(rows) ? rows : [])
      .slice(0, 5)
      .map((c: any) => ({
        name: text(c.name) || "—",
        amount: money(num(c.amount), currency),
      }));

  const topCustomers = mapTop(dashRes?.topCustomers);
  const topProducts = mapTop(dashRes?.topProducts);
  const topVendors = mapTop(dashRes?.topVendors);

  return { cards, topCustomers, topProducts, topVendors, chart: dashRes?.chart };
}
