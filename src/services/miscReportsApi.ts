/**
 * Items / Projects & Time Sheet / Taxes reports — client columns, backend data.
 */
import { api } from "@/lib/api/client";
import type { ReportCol, ReportFilters, ReportView } from "@/services/reportTypes";

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

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

const moneyLines = (byCur: Record<string, number>): string => {
  const entries = Object.entries(byCur).filter(([, v]) => Math.abs(v) > 0.0001);
  if (entries.length === 0) return money(0, "USD");
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, amt]) => money(amt, cur))
    .join("\n");
};

const addCur = (bag: Record<string, number>, currency: string, amount: number) => {
  const cur = (currency || "USD").toUpperCase() || "USD";
  bag[cur] = (bag[cur] || 0) + amount;
};

const mergeCur = (a: Record<string, number>, b: Record<string, number>) => {
  Object.entries(b).forEach(([c, v]) => addCur(a, c, v));
  return a;
};

const fmtDate = (d?: string | Date | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const rangeFrom = (filters: ReportFilters) => {
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

const rangeTo = (filters: ReportFilters) => {
  if (String(filters.period || "All") === "Custom") return filters.toDate || today();
  return today();
};

const inRange = (raw: unknown, from: string, to: string) => {
  if (!raw) return periodAll(from);
  const t = new Date(raw as string | Date).getTime();
  if (Number.isNaN(t)) return false;
  const a = new Date(from).setHours(0, 0, 0, 0);
  const b = new Date(to).setHours(23, 59, 59, 999);
  return t >= a && t <= b;
};

const periodAll = (from: string) => from === "2000-01-01";

async function fetchPages(
  path: string,
  params: Record<string, unknown> = {},
  maxPages = 20,
  limit = 100,
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await api.raw.get(path, { params: { ...params, page, limit } });
    const body = res.data ?? {};
    const rows: any[] = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.data?.allRecords)
        ? body.data.allRecords
        : Array.isArray(body.allRecords)
          ? body.allRecords
          : [];
    all.push(...rows);
    const totalPages = Number(body.pagination?.totalPage) || 1;
    if (page >= totalPages || rows.length === 0) break;
  }
  return all;
}

const lineProductId = (line: any) =>
  typeof line.product_id === "object" ? text(line.product_id?._id) : text(line.product_id);

const fmtHours = (hours: number, minutes = 0) => {
  const totalMins = Math.round(num(hours) * 60) + Math.floor(num(minutes));
  const h = Math.floor(totalMins / 60);
  const m = Math.abs(totalMins % 60);
  return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
};

/* ── Stock Report ──────────────────────────────────────────────── */
export async function loadStockReport(filters: ReportFilters): Promise<ReportView> {
  const from = rangeFrom(filters);
  const to = rangeTo(filters);

  const productParams: Record<string, unknown> = { sort: "productName" };
  if (filters.categoryId) productParams.category = filters.categoryId;
  if (filters.productId) productParams._id = filters.productId;
  if (filters.status === "Archived") productParams.isArchive = "true";

  const products = await fetchPages("/product/all", productParams, 20, 100);

  // Movement: In from bills, Out from invoices (date-filtered).
  const [bills, invoices] = await Promise.all([
    fetchPages("/bill/all", { dateFrom: from, dateTo: to, dateField: "date", sort: "-date" }),
    fetchPages("/invoices", { dateFrom: from, dateTo: to, dateField: "date", sort: "-date" }),
  ]);

  const inQty = new Map<string, number>();
  const outQty = new Map<string, number>();
  for (const b of bills) {
    for (const line of Array.isArray(b.product) ? b.product : []) {
      const id = lineProductId(line);
      if (!id) continue;
      inQty.set(id, (inQty.get(id) || 0) + num(line.quantity));
    }
  }
  for (const inv of invoices) {
    for (const line of Array.isArray(inv.product) ? inv.product : []) {
      const id = lineProductId(line);
      if (!id) continue;
      outQty.set(id, (outQty.get(id) || 0) + num(line.quantity));
    }
  }

  const cols: ReportCol[] = [
    { label: "SKU" },
    { label: "Product Type" },
    { label: "Item Name" },
    { label: "Vendor" },
    { label: "Category" },
    { label: "Unit Type" },
    { label: "Buy Price", right: true },
    { label: "Sell Price", right: true },
    { label: "Stock Value (Buy)", right: true },
    { label: "Stock Value (Sell)", right: true },
    { label: "In", right: true },
    { label: "Out", right: true },
    { label: "Stock", right: true },
  ];

  const tBuy: Record<string, number> = {};
  const tSell: Record<string, number> = {};
  const tValBuy: Record<string, number> = {};
  const tValSell: Record<string, number> = {};
  let tIn = 0;
  let tOut = 0;
  let tStock = 0;
  const rows: string[][] = [];

  for (const p of products) {
    const id = text(p._id);
    if (filters.productId && id !== filters.productId) continue;
    if (filters.productType === "Multi-variant") continue;
    if (filters.status === "Active" && p.isArchive) continue;
    if (filters.status === "Archived" && !p.isArchive) continue;

    const cat =
      typeof p.category === "object"
        ? text(p.category?.category || p.category?.name)
        : text(p.category);
    const cur = text(p.pricing?.currency) || "USD";
    const buy = num(p.pricing?.buyPrice);
    const sell = num(p.pricing?.sellPrice);
    const stock = num(p.stock?.onHandStock ?? p.quantity);
    const inn = inQty.get(id) || 0;
    const out = outQty.get(id) || 0;
    const valBuy = buy * stock;
    const valSell = sell * stock;

    addCur(tBuy, cur, buy);
    addCur(tSell, cur, sell);
    addCur(tValBuy, cur, valBuy);
    addCur(tValSell, cur, valSell);
    tIn += inn;
    tOut += out;
    tStock += stock;

    rows.push([
      text(p.sku) || "",
      "Standard",
      text(p.productName) || "—",
      "", // no vendor on product model
      cat || "",
      text(p.unitType) || "",
      money(buy, cur),
      money(sell, cur),
      money(valBuy, cur),
      money(valSell, cur),
      String(inn),
      String(out),
      String(stock),
    ]);
  }

  return {
    name: "Stock Report",
    cols,
    rows,
    totals: [
      "",
      "",
      `Total (${rows.length})`,
      "",
      "",
      "",
      moneyLines(tBuy),
      moneyLines(tSell),
      moneyLines(tValBuy),
      moneyLines(tValSell),
      String(tIn),
      String(tOut),
      String(tStock),
    ],
    meta: { from, to },
    source: "backend",
  };
}

/* ── Time Log Report ───────────────────────────────────────────── */
export async function loadTimeLogReport(filters: ReportFilters): Promise<ReportView> {
  const from = rangeFrom(filters);
  const to = rangeTo(filters);

  // Backend /time-log/all returns full company list (no queryBuilder filters yet).
  const res = await api.raw.get("/time-log/all");
  const body = res.data ?? {};
  const raw: any[] = Array.isArray(body.data) ? body.data : [];

  // Optional: map project → client for customer filter
  let projectClients = new Map<string, string[]>();
  if (filters.customerId) {
    try {
      const projects = await fetchPages("/project/all", { limit: 200 }, 10, 100);
      projectClients = new Map(
        projects.map((p: any) => [
          text(p._id || p.id),
          (Array.isArray(p.clientIds) ? p.clientIds : []).map((c: any) =>
            typeof c === "object" ? text(c._id) : text(c),
          ),
        ]),
      );
    } catch {
      /* ignore */
    }
  }

  const cols: ReportCol[] = [
    { label: "Date" },
    { label: "Customer" },
    { label: "Project" },
    { label: "Task" },
    { label: "Status" },
    { label: "Hours", right: true },
    { label: "Notes" },
  ];

  let hoursSum = 0;
  const rows: string[][] = [];

  for (const log of raw) {
    const dateRaw = log.date || log.created_at;
    if (!inRange(dateRaw, from, to) && !periodAll(from)) continue;

    const projectId = text(log.project_id?._id || log.project_id || "");
    const projectName = text(log.project) || text(log.project_name) || "";
    if (filters.customerId) {
      const clients = projectClients.get(projectId) || [];
      if (!clients.includes(filters.customerId)) continue;
    }
    // Status: time-log has no status — map type / active
    const status = log.active === false ? "Inactive" : text(log.type) === "project" ? "" : text(log.status) || "";
    if (filters.status && filters.status !== "All") {
      if (filters.status === "Invoiced" && status !== "Invoiced") continue;
      if (filters.status === "Inactive" && log.active !== false) continue;
    }

    const hrs = num(log.hours);
    const mins = num(log.minutes);
    hoursSum += hrs + mins / 60;

    rows.push([
      fmtDate(dateRaw),
      "", // customer not on time-log doc
      projectName || "—",
      text(log.task) || text(log.task_name) || "",
      status,
      fmtHours(hrs, mins),
      text(log.notes) || text(log.details) || "",
    ]);
  }

  const totalHours = Math.floor(hoursSum);
  const totalMins = Math.round((hoursSum - totalHours) * 60);

  return {
    name: "Time Log Report",
    cols,
    rows,
    totals: [`Time Logs ( ${rows.length} )`, "", "", "", "", fmtHours(totalHours, totalMins), ""],
    meta: { from, to },
    source: "backend",
  };
}

/* ── Project Report ────────────────────────────────────────────── */
export async function loadProjectReport(filters: ReportFilters): Promise<ReportView> {
  const params: Record<string, unknown> = { page: 1, limit: 100 };
  if (filters.status && filters.status !== "All") params.status = filters.status;
  if (filters.projectId) params._id = filters.projectId;

  // Prefer dedicated report endpoint (tasks/bugs/milestones counts).
  let projects: any[] = [];
  try {
    projects = await fetchPages("/project/report", params, 20, 50);
  } catch {
    projects = await fetchPages("/project/all", params, 20, 50);
  }

  if (filters.projectId) {
    projects = projects.filter((p) => text(p._id || p.id) === filters.projectId);
  }

  const cols: ReportCol[] = [
    { label: "Name" },
    { label: "Status" },
    { label: "Start Date" },
    { label: "End Date" },
    { label: "Tasks" },
    { label: "Bugs" },
    { label: "Milestones" },
  ];

  const rows = projects.map((p) => [
    text(p.name) || "—",
    text(p.status) || "—",
    text(p.start_date) || fmtDate(p.start_date) || "-",
    text(p.end_date) || fmtDate(p.end_date) || "-",
    text(p.tasks_count) || "—",
    text(p.bugs_count) || "—",
    text(p.milestones_count) || "—",
  ]);

  return {
    name: "Project Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, "", "", "", "", "", ""],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Tax Report ────────────────────────────────────────────────── */
export async function loadTaxReport(filters: ReportFilters): Promise<ReportView> {
  const from = rangeFrom(filters);
  const to = rangeTo(filters);
  const invParams: Record<string, unknown> = {
    dateFrom: from,
    dateTo: to,
    dateField: "date",
    sort: "-date",
  };
  if (filters.customerId) invParams.customer_id = filters.customerId;

  const invoices = await fetchPages("/invoices", invParams);
  type Agg = { name: string; amount: Record<string, number> };
  const map = new Map<string, Agg>();

  for (const inv of invoices) {
    const cur = text(inv.currency) || "USD";
    const breakdown: any[] = Array.isArray(inv.tax_breakdown) ? inv.tax_breakdown : [];
    if (breakdown.length) {
      for (const row of breakdown) {
        const rate = num(row.rate);
        const label = `${text(row.name) || "Tax"}${rate ? ` (${rate.toFixed(3)}%)` : ""}`;
        if (!map.has(label)) map.set(label, { name: label, amount: {} });
        addCur(map.get(label)!.amount, cur, num(row.amount));
      }
    } else if (num(inv.tax)) {
      const label = "Sales tax";
      if (!map.has(label)) map.set(label, { name: label, amount: {} });
      addCur(map.get(label)!.amount, cur, num(inv.tax));
    }
  }

  // Also include purchase tax from bills (shown as negative in client sample sometimes).
  try {
    const bills = await fetchPages("/bill/all", {
      dateFrom: from,
      dateTo: to,
      dateField: "date",
    });
    for (const b of bills) {
      const cur = text(b.currency) || "USD";
      const breakdown: any[] = Array.isArray(b.tax_breakdown) ? b.tax_breakdown : [];
      if (breakdown.length) {
        for (const row of breakdown) {
          const rate = num(row.rate);
          const label = `${text(row.name) || "Tax"}${rate ? ` (${rate.toFixed(3)}%)` : ""}`;
          if (!map.has(label)) map.set(label, { name: label, amount: {} });
          // Client sample mixes positive/negative — keep purchase as separate signed amounts by subtracting
          addCur(map.get(label)!.amount, cur, -Math.abs(num(row.amount)));
        }
      } else if (num(b.tax)) {
        const label = "Purchase tax";
        if (!map.has(label)) map.set(label, { name: label, amount: {} });
        addCur(map.get(label)!.amount, cur, -Math.abs(num(b.tax)));
      }
    }
  } catch {
    /* ignore */
  }

  const cols: ReportCol[] = [{ label: "Tax Name" }, { label: "Amount", right: true }];
  const tAmt: Record<string, number> = {};
  const rows = [...map.values()].map((a) => {
    mergeCur(tAmt, a.amount);
    return [a.name, moneyLines(a.amount)];
  });

  return {
    name: "Tax Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, moneyLines(tAmt)],
    meta: { from, to },
    source: "backend",
  };
}

export const MISC_REPORT_NAMES = [
  "Stock Report",
  "Time Log Report",
  "Project Report",
  "Tax Report",
  "Tax Summary Report",
] as const;

export function isMiscReport(name: string) {
  return (MISC_REPORT_NAMES as readonly string[]).includes(name);
}
