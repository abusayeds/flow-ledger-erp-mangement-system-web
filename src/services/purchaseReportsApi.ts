/**
 * Purchases & Expenses reports — columns match client site.
 * Uses existing backend list APIs (bill, purchase invoices as PO, expenses, vendor payments).
 * No dedicated Purchase Order module — PO reports use /purchase/invoices (workflow statuses).
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

const vendorName = (doc: any): string => {
  const v = doc?.vendor_id;
  if (v && typeof v === "object") {
    return text(v.businessProfile?.companyName) || text(v.name) || text(doc?.vendor_name) || "—";
  }
  return text(doc?.vendor_name) || "—";
};

const titleCaseStatus = (s: string) => {
  if (!s) return "—";
  if (s === s.toLowerCase()) return s.charAt(0).toUpperCase() + s.slice(1);
  return s;
};

/** Map UI status → backend purchase-order status (lowercase). */
const poStatusParam = (status?: string) => {
  if (!status || status === "All") return undefined;
  const map: Record<string, string> = {
    Draft: "draft",
    Sent: "sent",
    Approved: "approved",
    Received: "received",
    Closed: "paid",
    Posted: "posted",
    Partial: "partial",
    Paid: "paid",
    Overdue: "overdue",
    Declined: "declined",
    "On Hold": "onhold",
  };
  return map[status] || status.toLowerCase();
};

async function fetchPages(
  path: string,
  params: Record<string, unknown>,
  maxPages = 20,
  limit = 100,
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await api.raw.get(path, { params: { ...params, page, limit } });
    const body = res.data ?? {};
    const rows: any[] = Array.isArray(body.data) ? body.data : [];
    all.push(...rows);
    const totalPages = Number(body.pagination?.totalPage) || 1;
    if (page >= totalPages || rows.length === 0) break;
  }
  return all;
}

const purchaseListParams = (filters: ReportFilters, extra: Record<string, unknown> = {}) => {
  const params: Record<string, unknown> = {
    dateFrom: rangeFrom(filters),
    dateTo: rangeTo(filters),
    dateField: "date",
    sort: "-date",
    ...extra,
  };
  if (filters.vendorId) params.vendor_id = filters.vendorId;
  if (filters.status && filters.status !== "All") params.status = filters.status;
  return params;
};

const lineProductName = (line: any) =>
  text(line.product_name) ||
  (typeof line.product_id === "object" ? text(line.product_id?.productName) : "") ||
  "—";

const lineServiceName = (line: any) =>
  text(line.service_name) ||
  (typeof line.service_id === "object" ? text(line.service_id?.serviceName) : "") ||
  "—";

const lineProductId = (line: any) =>
  typeof line.product_id === "object" ? text(line.product_id?._id) : text(line.product_id);

const lineServiceId = (line: any) =>
  typeof line.service_id === "object" ? text(line.service_id?._id) : text(line.service_id);

const matchProductType = (filters: ReportFilters, hasProduct: boolean) => {
  if (!filters.productType || filters.productType === "All") return true;
  if (filters.productType === "Multi-variant") return false;
  if (filters.productType === "Standard") return hasProduct;
  return true;
};

const docHasProduct = (doc: any, productId?: string) => {
  const lines: any[] = Array.isArray(doc.product) ? doc.product : [];
  if (!productId) return lines.length > 0;
  return lines.some((l) => lineProductId(l) === productId);
};

const docHasService = (doc: any, serviceId?: string) => {
  const lines: any[] = Array.isArray(doc.service) ? doc.service : [];
  if (!serviceId) return lines.length > 0;
  return lines.some((l) => lineServiceId(l) === serviceId);
};

/* ── Bill Report ───────────────────────────────────────────────── */
export async function loadBillReport(filters: ReportFilters): Promise<ReportView> {
  const bills = await fetchPages("/bill/all", purchaseListParams(filters));
  const cols: ReportCol[] = [
    { label: "Bill #" },
    { label: "Vendor" },
    { label: "Status" },
    { label: "Date" },
    { label: "Due Date" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Sub Total", right: true },
    { label: "Amount Paid", right: true },
    { label: "Amount Due", right: true },
    { label: "Total", right: true },
  ];

  const tTax: Record<string, number> = {};
  const tShip: Record<string, number> = {};
  const tSub: Record<string, number> = {};
  const tPaid: Record<string, number> = {};
  const tDue: Record<string, number> = {};
  const tTot: Record<string, number> = {};
  const rows: string[][] = [];

  for (const b of bills) {
    if (filters.productId && !docHasProduct(b, filters.productId)) continue;
    if (filters.serviceId && !docHasService(b, filters.serviceId)) continue;
    if (!matchProductType(filters, Array.isArray(b.product) && b.product.length > 0)) continue;

    const cur = text(b.currency) || "USD";
    const tax: Record<string, number> = {};
    const ship: Record<string, number> = {};
    const sub: Record<string, number> = {};
    const paid: Record<string, number> = {};
    const due: Record<string, number> = {};
    const tot: Record<string, number> = {};
    addCur(tax, cur, num(b.tax));
    addCur(ship, cur, num(b.shipping_cost));
    addCur(sub, cur, num(b.sub_total));
    addCur(paid, cur, num(b.paid_amount));
    addCur(due, cur, num(b.balance_amount ?? num(b.total) - num(b.paid_amount)));
    addCur(tot, cur, num(b.total));
    mergeCur(tTax, tax);
    mergeCur(tShip, ship);
    mergeCur(tSub, sub);
    mergeCur(tPaid, paid);
    mergeCur(tDue, due);
    mergeCur(tTot, tot);

    rows.push([
      text(b.invoice_number || b.bill_number) || "—",
      vendorName(b),
      text(b.status) || "—",
      fmtDate(b.date || b.createdAt),
      b.due_date ? fmtDate(b.due_date) : "-",
      moneyLines(tax),
      moneyLines(ship),
      moneyLines(sub),
      moneyLines(paid),
      moneyLines(due),
      moneyLines(tot),
    ]);
  }

  return {
    name: "Bill Report",
    cols,
    rows,
    totals: [
      `Total Bills (${rows.length})`,
      "",
      "",
      "",
      "",
      moneyLines(tTax),
      moneyLines(tShip),
      moneyLines(tSub),
      moneyLines(tPaid),
      moneyLines(tDue),
      moneyLines(tTot),
    ],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Purchase Order Report (purchase invoices) ─────────────────── */
export async function loadPurchaseOrderReport(filters: ReportFilters): Promise<ReportView> {
  const params = purchaseListParams(filters);
  const poStatus = poStatusParam(filters.status);
  if (poStatus) params.status = poStatus;
  else delete params.status;

  const docs = await fetchPages("/purchase/invoices/all", params);
  const cols: ReportCol[] = [
    { label: "P.O. #" },
    { label: "Vendor" },
    { label: "Product Type" },
    { label: "Item Name" },
    { label: "Status" },
    { label: "Date" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Sub Total", right: true },
    { label: "Total", right: true },
  ];

  const tTax: Record<string, number> = {};
  const tShip: Record<string, number> = {};
  const tSub: Record<string, number> = {};
  const tTot: Record<string, number> = {};
  const rows: string[][] = [];

  for (const doc of docs) {
    const products: any[] = Array.isArray(doc.product) ? doc.product : [];
    if (!matchProductType(filters, products.length > 0)) continue;

    const items =
      products.length > 0
        ? products.map((p) => ({ type: "Standard", name: lineProductName(p) }))
        : [{ type: "", name: "" }];

    const cur = text(doc.currency) || "USD";
    const tax: Record<string, number> = {};
    const ship: Record<string, number> = {};
    const sub: Record<string, number> = {};
    const tot: Record<string, number> = {};
    addCur(tax, cur, num(doc.tax));
    addCur(ship, cur, num(doc.shipping_cost));
    addCur(sub, cur, num(doc.sub_total));
    addCur(tot, cur, num(doc.total));
    mergeCur(tTax, tax);
    mergeCur(tShip, ship);
    mergeCur(tSub, sub);
    mergeCur(tTot, tot);

    items.forEach((item, idx) => {
      rows.push([
        idx === 0 ? text(doc.invoice_number || doc.po) || "—" : "",
        idx === 0 ? vendorName(doc) : "",
        item.type,
        item.name,
        idx === 0 ? titleCaseStatus(text(doc.status)) : "",
        idx === 0 ? fmtDate(doc.date || doc.createdAt) : "",
        idx === 0 ? moneyLines(tax) : "",
        idx === 0 ? moneyLines(ship) : "",
        idx === 0 ? moneyLines(sub) : "",
        idx === 0 ? moneyLines(tot) : "",
      ]);
    });
  }

  return {
    name: "Purchase Order Report",
    cols,
    rows,
    totals: ["", "", "", "", "", "", moneyLines(tTax), moneyLines(tShip), moneyLines(tSub), moneyLines(tTot)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Purchase Order By Company ─────────────────────────────────── */
export async function loadPurchaseOrderByCompanyReport(filters: ReportFilters): Promise<ReportView> {
  const params = purchaseListParams(filters);
  const poStatus = poStatusParam(filters.status);
  if (poStatus) params.status = poStatus;
  else delete params.status;

  const docs = await fetchPages("/purchase/invoices/all", params);
  let companyLabel = "Company";
  try {
    const me = await api.get<any>("/user/my-profile");
    companyLabel =
      text(me?.businessProfile?.companyName) ||
      text(me?.name) ||
      text(me?.email)?.split("@")[0] ||
      "Company";
  } catch {
    /* keep default */
  }

  const cols: ReportCol[] = [
    { label: "P.O. #" },
    { label: "Vendor" },
    { label: "Status" },
    { label: "Date" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Sub Total", right: true },
    { label: "Total", right: true },
  ];

  const tTax: Record<string, number> = {};
  const tShip: Record<string, number> = {};
  const tSub: Record<string, number> = {};
  const tTot: Record<string, number> = {};
  const rows: string[][] = [[companyLabel, "", "", "", "", "", "", ""]];

  for (const doc of docs) {
    const cur = text(doc.currency) || "USD";
    const tax: Record<string, number> = {};
    const ship: Record<string, number> = {};
    const sub: Record<string, number> = {};
    const tot: Record<string, number> = {};
    addCur(tax, cur, num(doc.tax));
    addCur(ship, cur, num(doc.shipping_cost));
    addCur(sub, cur, num(doc.sub_total));
    addCur(tot, cur, num(doc.total));
    mergeCur(tTax, tax);
    mergeCur(tShip, ship);
    mergeCur(tSub, sub);
    mergeCur(tTot, tot);

    rows.push([
      text(doc.invoice_number || doc.po) || "—",
      vendorName(doc),
      titleCaseStatus(text(doc.status)),
      fmtDate(doc.date || doc.createdAt),
      moneyLines(tax),
      moneyLines(ship),
      moneyLines(sub),
      moneyLines(tot),
    ]);
  }

  return {
    name: "Purchase Order By Company",
    cols,
    rows,
    totals: [
      `Total: 1 Company`,
      "",
      "",
      "",
      moneyLines(tTax),
      moneyLines(tShip),
      moneyLines(tSub),
      moneyLines(tTot),
    ],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Purchase by Product ───────────────────────────────────────── */
export async function loadPurchaseByProductReport(filters: ReportFilters): Promise<ReportView> {
  const products = await fetchPages("/product/all", {}, 10, 200);
  const productMap = new Map(products.map((p: any) => [text(p._id), p]));

  const [bills, pos] = await Promise.all([
    fetchPages("/bill/all", purchaseListParams(filters)),
    fetchPages("/purchase/invoices/all", (() => {
      const p = purchaseListParams(filters);
      delete p.status;
      return p;
    })()),
  ]);

  type Agg = {
    sku: string;
    productType: string;
    itemName: string;
    unit: Record<string, number>;
    qty: number;
    discount: Record<string, number>;
    total: Record<string, number>;
  };
  const map = new Map<string, Agg>();

  const consume = (docs: any[]) => {
    for (const doc of docs) {
      const cur = text(doc.currency) || "USD";
      const lines: any[] = Array.isArray(doc.product) ? doc.product : [];
      for (const line of lines) {
        const pid = lineProductId(line);
        if (filters.productId && pid !== filters.productId) continue;
        if (filters.productType === "Multi-variant") continue;
        const prod = pid ? productMap.get(pid) : undefined;
        const name = lineProductName(line) || text(prod?.productName) || "—";
        const key = `${pid || name}|${cur}`;
        if (!map.has(key)) {
          map.set(key, {
            sku: text(prod?.sku) || "",
            productType: "Standard",
            itemName: name,
            unit: {},
            qty: 0,
            discount: {},
            total: {},
          });
        }
        const a = map.get(key)!;
        a.qty += num(line.quantity);
        addCur(a.unit, cur, num(line.rate));
        addCur(a.discount, cur, num(line.discount));
        addCur(a.total, cur, num(line.amount));
      }
    }
  };
  consume(bills);
  consume(pos);

  const cols: ReportCol[] = [
    { label: "SKU" },
    { label: "Product Type" },
    { label: "Item Name" },
    { label: "Unit Price", right: true },
    { label: "Quantity", right: true },
    { label: "Discount", right: true },
    { label: "Total", right: true },
  ];
  let qtySum = 0;
  const tDisc: Record<string, number> = {};
  const tTot: Record<string, number> = {};
  const rows = [...map.values()].map((a) => {
    qtySum += a.qty;
    mergeCur(tDisc, a.discount);
    mergeCur(tTot, a.total);
    return [a.sku || "", a.productType, a.itemName, moneyLines(a.unit), String(a.qty), moneyLines(a.discount), moneyLines(a.total)];
  });

  return {
    name: "Purchase by Product Report",
    cols,
    rows,
    totals: ["", "", "", "", String(qtySum), moneyLines(tDisc), moneyLines(tTot)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Purchase by Service ───────────────────────────────────────── */
export async function loadPurchaseByServiceReport(filters: ReportFilters): Promise<ReportView> {
  const [bills, pos] = await Promise.all([
    fetchPages("/bill/all", purchaseListParams(filters)),
    fetchPages("/purchase/invoices/all", (() => {
      const p = purchaseListParams(filters);
      delete p.status;
      return p;
    })()),
  ]);

  type Agg = {
    name: string;
    rate: Record<string, number>;
    qty: number;
    discount: Record<string, number>;
    total: Record<string, number>;
  };
  const map = new Map<string, Agg>();

  const consume = (docs: any[]) => {
    for (const doc of docs) {
      const cur = text(doc.currency) || "USD";
      const lines: any[] = Array.isArray(doc.service) ? doc.service : [];
      for (const line of lines) {
        const sid = lineServiceId(line);
        const name = lineServiceName(line);
        const key = `${sid || name}|${cur}`;
        if (!map.has(key)) map.set(key, { name, rate: {}, qty: 0, discount: {}, total: {} });
        const a = map.get(key)!;
        a.qty += num(line.quantity);
        addCur(a.rate, cur, num(line.rate));
        addCur(a.discount, cur, num(line.discount));
        addCur(a.total, cur, num(line.amount));
      }
    }
  };
  consume(bills);
  consume(pos);

  const cols: ReportCol[] = [
    { label: "Service Name" },
    { label: "Rate", right: true },
    { label: "Quantity", right: true },
    { label: "Discount", right: true },
    { label: "Total", right: true },
  ];
  let qtySum = 0;
  const tDisc: Record<string, number> = {};
  const tTot: Record<string, number> = {};
  const rows = [...map.values()].map((a) => {
    qtySum += a.qty;
    mergeCur(tDisc, a.discount);
    mergeCur(tTot, a.total);
    return [a.name, moneyLines(a.rate), String(a.qty), moneyLines(a.discount), moneyLines(a.total)];
  });

  return {
    name: "Purchase by Service Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, "", String(qtySum), moneyLines(tDisc), moneyLines(tTot)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Payment Made Report ───────────────────────────────────────── */
export async function loadPaymentMadeReport(filters: ReportFilters): Promise<ReportView> {
  const params: Record<string, unknown> = {
    dateFrom: rangeFrom(filters),
    dateTo: rangeTo(filters),
    dateField: "payment_date",
    sort: "-payment_date",
  };
  if (filters.vendorId) params.vendor_id = filters.vendorId;

  const payments = await fetchPages("/account/vendor-payments/all", params);
  const cols: ReportCol[] = [
    { label: "Payment #" },
    { label: "Bill #" },
    { label: "Vendor" },
    { label: "Date" },
    { label: "Payment Type" },
    { label: "Notes" },
    { label: "Tax", right: true },
    { label: "Amount", right: true },
  ];

  const tTax: Record<string, number> = {};
  const tAmt: Record<string, number> = {};
  const rows: string[][] = [];

  for (const p of payments) {
    const methods: string[] = Array.isArray(p.payment_method) ? p.payment_method.map(String) : [];
    const payType = methods[0] || text(p.payment_type) || "—";
    if (filters.paymentType && filters.paymentType !== "All" && payType !== filters.paymentType) continue;

    const cur = text(p.currency) || "USD";
    const tax: Record<string, number> = {};
    const amt: Record<string, number> = {};
    addCur(tax, cur, num(p.tax));
    addCur(amt, cur, num(p.payment_amount ?? p.amount ?? p.total));
    mergeCur(tTax, tax);
    mergeCur(tAmt, amt);

    const firstAlloc = Array.isArray(p.allocations) ? p.allocations[0] : null;
    const billNo =
      text(firstAlloc?.invoice_id?.invoice_number) ||
      text(firstAlloc?.invoice_number) ||
      text(p.reference_number) ||
      "";

    rows.push([
      text(p.payment_number) || "—",
      billNo,
      vendorName(p),
      fmtDate(p.payment_date || p.date || p.createdAt),
      payType,
      text(p.notes),
      moneyLines(tax),
      moneyLines(amt),
    ]);
  }

  return {
    name: "Payment Made Report",
    cols,
    rows,
    totals: [`Total Bills (${rows.length})`, "", "", "", "", "", moneyLines(tTax), moneyLines(tAmt)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Expense Report ────────────────────────────────────────────── */
export async function loadExpenseReport(filters: ReportFilters): Promise<ReportView> {
  const params = purchaseListParams(filters);
  if (filters.categoryId) params.category = filters.categoryId;
  // Expense category may be free-text name — also pass categoryLabel via categoryId if it's a name
  if (filters.categoryLabel) params.category = filters.categoryLabel;

  const expenses = await fetchPages("/expenses/all", params);
  const cols: ReportCol[] = [
    { label: "Expense #" },
    { label: "Vendor" },
    { label: "Category" },
    { label: "Payment Type" },
    { label: "Date" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Notes" },
    { label: "Total", right: true },
  ];

  const tTax: Record<string, number> = {};
  const tShip: Record<string, number> = {};
  const tTot: Record<string, number> = {};
  const rows: string[][] = [];

  for (const e of expenses) {
    const methods: string[] = Array.isArray(e.payment_method) ? e.payment_method.map(String) : [];
    const payType = methods[0] || "—";
    if (filters.paymentType && filters.paymentType !== "All" && payType !== filters.paymentType) continue;
    if (filters.categoryLabel && filters.categoryLabel !== "All") {
      const cat = text(e.category);
      if (cat !== filters.categoryLabel && text(e.category?._id) !== filters.categoryId) continue;
    }

    const cur = text(e.currency) || "USD";
    const tax: Record<string, number> = {};
    const ship: Record<string, number> = {};
    const tot: Record<string, number> = {};
    addCur(tax, cur, num(e.tax));
    addCur(ship, cur, num(e.shipping_cost));
    addCur(tot, cur, num(e.total ?? e.amount));
    mergeCur(tTax, tax);
    mergeCur(tShip, ship);
    mergeCur(tTot, tot);

    rows.push([
      text(e.invoice_number || e.expense_number) || "—",
      vendorName(e),
      text(typeof e.category === "object" ? e.category?.category || e.category?.name : e.category) || "—",
      payType,
      fmtDate(e.date || e.createdAt),
      moneyLines(tax),
      moneyLines(ship),
      text(e.notes),
      moneyLines(tot),
    ]);
  }

  return {
    name: "Expense Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, "", "", "", "", moneyLines(tTax), moneyLines(tShip), "", moneyLines(tTot)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

export const PURCHASE_REPORT_NAMES = [
  "Bill Report",
  "Purchase Order Report",
  "Purchase Order By Company",
  "Purchase by Product Report",
  "Purchase by Service Report",
  "Payment Made Report",
  "Expense Report",
] as const;

export function isPurchaseReport(name: string) {
  return (PURCHASE_REPORT_NAMES as readonly string[]).includes(name);
}
