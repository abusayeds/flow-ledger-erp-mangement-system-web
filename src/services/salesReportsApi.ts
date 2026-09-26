/**
 * Sales reports — columns match client Bill/Invoice report UI.
 * Data + filters come from existing backend list/report endpoints (no dummy).
 * Where a dedicated report API lacks filters, we load documents via
 * queryBuilder-backed list APIs (dateFrom/dateTo/customer_id/status/…).
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

const partyName = (doc: any): string => {
  const c = doc?.customer_id;
  if (c && typeof c === "object") {
    return text(c.businessProfile?.companyName) || text(c.name) || text(doc?.customer_name) || "—";
  }
  return text(doc?.customer_name) || "—";
};

const partyId = (doc: any): string => {
  const c = doc?.customer_id;
  if (c && typeof c === "object") return text(c._id);
  return typeof c === "string" ? c : "";
};

const partyPhone = (doc: any): string => {
  const c = doc?.customer_id;
  if (c && typeof c === "object") return text(c.phone) || text(c.businessProfile?.business_phone);
  return "";
};

const partyCompany = (doc: any): string => {
  const c = doc?.customer_id;
  if (c && typeof c === "object") return text(c.businessProfile?.companyName) || text(c.name);
  return text(doc?.customer_name);
};

const partyTaxId = (doc: any): string => {
  const c = doc?.customer_id;
  if (c && typeof c === "object") return text(c.tax_number) || text(c.businessProfile?.tax_number);
  return "";
};

const partyFirstLast = (doc: any): { first: string; last: string } => {
  const c = doc?.customer_id;
  const name = c && typeof c === "object" ? text(c.name) : "";
  if (!name) return { first: "", last: "" };
  const parts = name.split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
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
    const rows: any[] = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.data?.allPayment)
        ? body.data.allPayment
        : Array.isArray(body.allPayment)
          ? body.allPayment
          : [];
    all.push(...rows);
    const totalPages = Number(body.pagination?.totalPage) || 1;
    if (page >= totalPages || rows.length === 0) break;
  }
  return all;
}

const listParams = (filters: ReportFilters, extra: Record<string, unknown> = {}) => {
  const params: Record<string, unknown> = {
    dateFrom: rangeFrom(filters),
    dateTo: rangeTo(filters),
    dateField: "date",
    sort: "-date",
    ...extra,
  };
  if (filters.customerId) params.customer_id = filters.customerId;
  if (filters.status && filters.status !== "All") params.status = filters.status;
  if (filters.salespersonId) params.salesperson = filters.salespersonId;
  return params;
};

const AGING_STATUSES = new Set(["Open", "Partial", "Overdue"]);

/* ── Invoice Aging ─────────────────────────────────────────────── */
export async function loadInvoiceAgingReport(filters: ReportFilters): Promise<ReportView> {
  const asOf = filters.asOfDate || today();
  // Prefer dedicated aging API when no customer/status filter (backend supports as_of only).
  if (!filters.customerId && (!filters.status || filters.status === "All")) {
    const res = await api.raw.get("/account/reports/invoice-aging", { params: { as_of_date: asOf } });
    const data = res.data?.data ?? res.data ?? {};
    const parties: any[] = Array.isArray(data?.customers) ? data.customers : [];
    const cols: ReportCol[] = [
      { label: "Name" },
      { label: "0-30 Days", right: true },
      { label: "31-60 Days", right: true },
      { label: "61-90 Days", right: true },
      { label: ">90 Days", right: true },
      { label: "Total Outstanding", right: true },
    ];
    const sums = [0, 0, 0, 0, 0];
    const rows = parties.map((p) => {
      const d0 = num(p.current) + num(p["1_30_days"]);
      const d31 = num(p["31_60_days"]);
      const d61 = num(p["61_90_days"]);
      const d90 = num(p.over_90_days);
      const tot = num(p.total) || d0 + d31 + d61 + d90;
      const vals = [d0, d31, d61, d90, tot];
      vals.forEach((n, i) => (sums[i] += n));
      // Aging API has no per-row currency — show as USD-style numbers matching BO money helper default.
      return [text(p.customer_name) || "—", ...vals.map((v) => money(v, "BDT"))];
    });
    return {
      name: "Invoice Aging Report",
      cols,
      rows,
      totals: [`Total (${rows.length})`, ...sums.map((v) => money(v, "BDT"))],
      meta: { asOf: data?.as_of_date || asOf },
      source: "backend",
    };
  }

  // With customer/status: rebuild aging from invoice list (backend-filtered).
  const params: Record<string, unknown> = { sort: "-due_date" };
  if (filters.customerId) params.customer_id = filters.customerId;
  if (filters.status && filters.status !== "All") params.status = filters.status;
  const invoices = await fetchPages("/invoices", params);
  const asOfDate = new Date(asOf);
  type Bucket = { name: string; d0: Record<string, number>; d31: Record<string, number>; d61: Record<string, number>; d90: Record<string, number>; tot: Record<string, number> };
  const map = new Map<string, Bucket>();

  for (const inv of invoices) {
    const st = text(inv.status);
    if (filters.status && filters.status !== "All") {
      if (st !== filters.status) continue;
    } else if (!AGING_STATUSES.has(st)) continue;
    const balance = num(inv.balance_amount ?? (num(inv.total) - num(inv.paid_amount)));
    if (balance <= 0) continue;
    const due = inv.due_date ? new Date(inv.due_date) : asOfDate;
    const days = Math.floor((asOfDate.getTime() - due.getTime()) / 86400000);
    const cur = text(inv.currency) || "USD";
    const id = partyId(inv) || partyName(inv);
    if (!map.has(id)) {
      map.set(id, { name: partyName(inv), d0: {}, d31: {}, d61: {}, d90: {}, tot: {} });
    }
    const b = map.get(id)!;
    if (days <= 30) addCur(b.d0, cur, balance);
    else if (days <= 60) addCur(b.d31, cur, balance);
    else if (days <= 90) addCur(b.d61, cur, balance);
    else addCur(b.d90, cur, balance);
    addCur(b.tot, cur, balance);
  }

  const cols: ReportCol[] = [
    { label: "Name" },
    { label: "0-30 Days", right: true },
    { label: "31-60 Days", right: true },
    { label: "61-90 Days", right: true },
    { label: ">90 Days", right: true },
    { label: "Total Outstanding", right: true },
  ];
  const totalBags = [{}, {}, {}, {}, {}] as Record<string, number>[];
  const rows = [...map.values()].map((b) => {
    const cells = [b.d0, b.d31, b.d61, b.d90, b.tot];
    cells.forEach((bag, i) => mergeCur(totalBags[i], bag));
    return [b.name, ...cells.map(moneyLines)];
  });
  return {
    name: "Invoice Aging Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, ...totalBags.map(moneyLines)],
    meta: { asOf },
    source: "backend",
  };
}

/* ── Sales Report (Invoice + Challan + Receipt) ────────────────── */
export async function loadSalesReport(filters: ReportFilters): Promise<ReportView> {
  const type = text(filters.docType) || "All";
  const params = listParams(filters);
  const wantInv = type === "All" || type === "Invoice";
  const wantCh = type === "All" || type === "Delivery Challan";
  const wantSr = type === "All" || type === "Sales Receipt";

  const [invoices, challans, receipts] = await Promise.all([
    wantInv ? fetchPages("/invoices", params) : Promise.resolve([]),
    wantCh ? fetchPages("/delivery-challan/all", params) : Promise.resolve([]),
    wantSr ? fetchPages("/sales-receipt/all", { ...params, status: undefined }) : Promise.resolve([]),
  ]);

  type Row = {
    sort: number;
    sr: string;
    type: string;
    customer: string;
    status: string;
    date: string;
    due: string;
    tax: Record<string, number>;
    ship: Record<string, number>;
    sub: Record<string, number>;
    paid: Record<string, number>;
    dueAmt: Record<string, number>;
    total: Record<string, number>;
    productIds: string[];
    serviceIds: string[];
  };

  const rowsRaw: Row[] = [];

  const pushDoc = (doc: any, docType: string, paid: number, dueAmt: number) => {
    if (filters.productId) {
      const lines: any[] = Array.isArray(doc.product) ? doc.product : [];
      const hit = lines.some((l) => {
        const id = typeof l.product_id === "object" ? text(l.product_id?._id) : text(l.product_id);
        return id === filters.productId;
      });
      if (!hit) return;
    }
    if (filters.serviceId) {
      const lines: any[] = Array.isArray(doc.service) ? doc.service : [];
      const hit = lines.some((l) => {
        const id = typeof l.service_id === "object" ? text(l.service_id?._id) : text(l.service_id);
        return id === filters.serviceId;
      });
      if (!hit) return;
    }
    if (filters.paymentTerms && filters.paymentTerms !== "All") {
      const methods: string[] = Array.isArray(doc.payment_method) ? doc.payment_method.map(String) : [];
      if (!methods.includes(filters.paymentTerms)) return;
    }
    if (filters.productType && filters.productType !== "All") {
      // Backend has no multi-variant flag on lines — Standard = has product lines.
      const hasProd = Array.isArray(doc.product) && doc.product.length > 0;
      if (filters.productType === "Multi-variant") return;
      if (filters.productType === "Standard" && !hasProd) return;
    }

    const cur = text(doc.currency) || "USD";
    const tax: Record<string, number> = {};
    const ship: Record<string, number> = {};
    const sub: Record<string, number> = {};
    const paidBag: Record<string, number> = {};
    const dueBag: Record<string, number> = {};
    const tot: Record<string, number> = {};
    addCur(tax, cur, num(doc.tax));
    addCur(ship, cur, num(doc.shipping_cost));
    addCur(sub, cur, num(doc.sub_total));
    addCur(paidBag, cur, paid);
    addCur(dueBag, cur, dueAmt);
    addCur(tot, cur, num(doc.total));

    const productIds = (Array.isArray(doc.product) ? doc.product : []).map((l: any) =>
      typeof l.product_id === "object" ? text(l.product_id?._id) : text(l.product_id),
    );
    const serviceIds = (Array.isArray(doc.service) ? doc.service : []).map((l: any) =>
      typeof l.service_id === "object" ? text(l.service_id?._id) : text(l.service_id),
    );

    rowsRaw.push({
      sort: new Date(doc.date || doc.createdAt || 0).getTime(),
      sr: text(doc.invoice_number) || "—",
      type: docType,
      customer: partyName(doc),
      status: text(doc.status) || "—",
      date: fmtDate(doc.date || doc.createdAt),
      due: doc.due_date ? fmtDate(doc.due_date) : "-",
      tax,
      ship,
      sub,
      paid: paidBag,
      dueAmt: dueBag,
      total: tot,
      productIds,
      serviceIds,
    });
  };

  for (const inv of invoices) {
    pushDoc(inv, "Invoice", num(inv.paid_amount), num(inv.balance_amount ?? num(inv.total) - num(inv.paid_amount)));
  }
  for (const ch of challans) {
    pushDoc(ch, "Delivery Challan", 0, 0);
  }
  for (const sr of receipts) {
    pushDoc(sr, "Sales Receipt", num(sr.total), 0);
  }

  rowsRaw.sort((a, b) => b.sort - a.sort);

  const cols: ReportCol[] = [
    { label: "Sr. No." },
    { label: "Type" },
    { label: "Customer" },
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

  const totTax: Record<string, number> = {};
  const totShip: Record<string, number> = {};
  const totSub: Record<string, number> = {};
  const totPaid: Record<string, number> = {};
  const totDue: Record<string, number> = {};
  const totAll: Record<string, number> = {};

  const rows = rowsRaw.map((r) => {
    mergeCur(totTax, r.tax);
    mergeCur(totShip, r.ship);
    mergeCur(totSub, r.sub);
    mergeCur(totPaid, r.paid);
    mergeCur(totDue, r.dueAmt);
    mergeCur(totAll, r.total);
    return [
      r.sr,
      r.type,
      r.customer,
      r.status,
      r.date,
      r.due,
      moneyLines(r.tax),
      moneyLines(r.ship),
      moneyLines(r.sub),
      moneyLines(r.paid),
      moneyLines(r.dueAmt),
      moneyLines(r.total),
    ];
  });

  return {
    name: "Sales Report",
    cols,
    rows,
    totals: [
      `Total (${rows.length})`,
      "",
      "",
      "",
      "",
      "",
      moneyLines(totTax),
      moneyLines(totShip),
      moneyLines(totSub),
      moneyLines(totPaid),
      moneyLines(totDue),
      moneyLines(totAll),
    ],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Estimate Report ───────────────────────────────────────────── */
export async function loadEstimateReport(filters: ReportFilters): Promise<ReportView> {
  const estimates = await fetchPages("/estimate/all", listParams(filters));
  const cols: ReportCol[] = [
    { label: "Estimate #" },
    { label: "Salesperson" },
    { label: "Customer" },
    { label: "Tax ID" },
    { label: "Mobile" },
    { label: "Company Name" },
    { label: "First Name" },
    { label: "Last Name" },
    { label: "Product Type" },
    { label: "Item Name" },
    { label: "Status" },
    { label: "Date" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Notes" },
    { label: "Sub Total", right: true },
    { label: "Total", right: true },
  ];

  const totTax: Record<string, number> = {};
  const totShip: Record<string, number> = {};
  const totSub: Record<string, number> = {};
  const totAll: Record<string, number> = {};
  const rows: string[][] = [];

  for (const est of estimates) {
    if (filters.productType && filters.productType !== "All") {
      if (filters.productType === "Multi-variant") continue;
    }
    const products: any[] = Array.isArray(est.product) ? est.product : [];
    const services: any[] = Array.isArray(est.service) ? est.service : [];
    const items =
      products.length || services.length
        ? [
            ...products.map((p) => ({
              type: "Standard",
              name: text(p.product_name) || (typeof p.product_id === "object" ? text(p.product_id?.productName) : "") || "—",
            })),
            ...services.map((s) => ({
              type: "Service",
              name: text(s.service_name) || (typeof s.service_id === "object" ? text(s.service_id?.serviceName) : "") || "—",
            })),
          ]
        : [{ type: "", name: "" }];

    const { first, last } = partyFirstLast(est);
    const cur = text(est.currency) || "USD";
    const taxBag: Record<string, number> = {};
    const shipBag: Record<string, number> = {};
    const subBag: Record<string, number> = {};
    const totBag: Record<string, number> = {};
    addCur(taxBag, cur, num(est.tax));
    addCur(shipBag, cur, num(est.shipping_cost));
    addCur(subBag, cur, num(est.sub_total));
    addCur(totBag, cur, num(est.total));
    mergeCur(totTax, taxBag);
    mergeCur(totShip, shipBag);
    mergeCur(totSub, subBag);
    mergeCur(totAll, totBag);

    // One row per estimate (first item); extra items as additional rows with empty money cols
    items.forEach((item, idx) => {
      rows.push([
        idx === 0 ? text(est.invoice_number) || "—" : "",
        "", // salesperson not on estimate model
        idx === 0 ? partyName(est) : "",
        idx === 0 ? partyTaxId(est) : "",
        idx === 0 ? partyPhone(est) : "",
        idx === 0 ? partyCompany(est) : "",
        idx === 0 ? first : "",
        idx === 0 ? last : "",
        item.type,
        item.name,
        idx === 0 ? text(est.status) || "—" : "",
        idx === 0 ? fmtDate(est.date || est.createdAt) : "",
        idx === 0 ? moneyLines(taxBag) : "",
        idx === 0 ? moneyLines(shipBag) : "",
        idx === 0 ? text(est.notes) : "",
        idx === 0 ? moneyLines(subBag) : "",
        idx === 0 ? moneyLines(totBag) : "",
      ]);
    });
  }

  return {
    name: "Estimate Report",
    cols,
    rows,
    totals: [
      `Total (${estimates.length})`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      moneyLines(totTax),
      moneyLines(totShip),
      "",
      moneyLines(totSub),
      moneyLines(totAll),
    ],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Payment Report ────────────────────────────────────────────── */
export async function loadPaymentReport(filters: ReportFilters): Promise<ReportView> {
  const params: Record<string, unknown> = {
    dateFrom: rangeFrom(filters),
    dateTo: rangeTo(filters),
    dateField: "payment_date",
    sort: "-payment_date",
  };
  if (filters.customerId) params.customer_id = filters.customerId;
  if (filters.paymentType && filters.paymentType !== "All") params.payment_type = filters.paymentType;
  if (filters.salespersonId) params.salesperson = filters.salespersonId;

  const payments = await fetchPages("/payment/all", params);
  const cols: ReportCol[] = [
    { label: "Payment #" },
    { label: "Invoice #" },
    { label: "Sales Receipt #" },
    { label: "Customer" },
    { label: "Date" },
    { label: "Payment Type" },
    { label: "Notes" },
    { label: "Tax", right: true },
    { label: "Amount", right: true },
  ];

  const totTax: Record<string, number> = {};
  const totAmt: Record<string, number> = {};
  const rows = payments.map((p: any) => {
    const cur = text(p.currency) || "USD";
    const taxBag: Record<string, number> = {};
    const amtBag: Record<string, number> = {};
    addCur(taxBag, cur, num(p.tax));
    addCur(amtBag, cur, num(p.amount ?? p.payment_amount ?? p.total));
    mergeCur(totTax, taxBag);
    mergeCur(totAmt, amtBag);
    const inv =
      typeof p.invoice_id === "object"
        ? text(p.invoice_id?.invoice_number)
        : text(p.invoice_number);
    const cust =
      typeof p.customer_id === "object"
        ? text(p.customer_id?.businessProfile?.companyName) || text(p.customer_id?.name)
        : text(p.customer_name) || "—";
    const isReceipt = text(p.type) === "sales_receipt" || text(p.type) === "sales-receipt";
    return [
      text(p.payment_number) || "—",
      isReceipt ? "" : inv || "",
      isReceipt ? inv || text(p.sales_receipt_number) : "",
      cust || "—",
      fmtDate(p.payment_date || p.date || p.createdAt),
      text(p.payment_type) || (Array.isArray(p.payment_method) ? p.payment_method.join(", ") : "") || "—",
      text(p.notes),
      moneyLines(taxBag),
      moneyLines(amtBag),
    ];
  });

  return {
    name: "Payment Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, "", "", "", "", "", "", moneyLines(totTax), moneyLines(totAmt)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Sales by Customer ─────────────────────────────────────────── */
export async function loadSalesByCustomerReport(filters: ReportFilters): Promise<ReportView> {
  const invoices = await fetchPages("/invoices", listParams(filters));
  type Agg = {
    name: string;
    tax: Record<string, number>;
    ship: Record<string, number>;
    paid: Record<string, number>;
    due: Record<string, number>;
    sales: Record<string, number>;
  };
  const map = new Map<string, Agg>();

  for (const inv of invoices) {
    if (filters.salespersonId) {
      const sp = typeof inv.salesperson === "object" ? text(inv.salesperson?._id) : text(inv.salesperson);
      if (sp !== filters.salespersonId) continue;
    }
    const id = partyId(inv) || partyName(inv);
    if (!map.has(id)) map.set(id, { name: partyName(inv), tax: {}, ship: {}, paid: {}, due: {}, sales: {} });
    const a = map.get(id)!;
    const cur = text(inv.currency) || "USD";
    addCur(a.tax, cur, num(inv.tax));
    addCur(a.ship, cur, num(inv.shipping_cost));
    addCur(a.paid, cur, num(inv.paid_amount));
    addCur(a.due, cur, num(inv.balance_amount ?? num(inv.total) - num(inv.paid_amount)));
    addCur(a.sales, cur, num(inv.total));
  }

  const cols: ReportCol[] = [
    { label: "Name" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Amount Paid", right: true },
    { label: "Amount Due", right: true },
    { label: "Sales", right: true },
  ];
  const tTax: Record<string, number> = {};
  const tShip: Record<string, number> = {};
  const tPaid: Record<string, number> = {};
  const tDue: Record<string, number> = {};
  const tSales: Record<string, number> = {};
  const rows = [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => {
      mergeCur(tTax, a.tax);
      mergeCur(tShip, a.ship);
      mergeCur(tPaid, a.paid);
      mergeCur(tDue, a.due);
      mergeCur(tSales, a.sales);
      return [a.name, moneyLines(a.tax), moneyLines(a.ship), moneyLines(a.paid), moneyLines(a.due), moneyLines(a.sales)];
    });

  return {
    name: "Sales by Customer Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, moneyLines(tTax), moneyLines(tShip), moneyLines(tPaid), moneyLines(tDue), moneyLines(tSales)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Sales by User ─────────────────────────────────────────────── */
export async function loadSalesByUserReport(filters: ReportFilters): Promise<ReportView> {
  const invoices = await fetchPages("/invoices", listParams(filters));
  type Agg = {
    name: string;
    tax: Record<string, number>;
    ship: Record<string, number>;
    paid: Record<string, number>;
    due: Record<string, number>;
    sales: Record<string, number>;
  };
  const map = new Map<string, Agg>();

  for (const inv of invoices) {
    const spObj = inv.salesperson;
    const spId = typeof spObj === "object" ? text(spObj?._id) : text(spObj);
    if (filters.salespersonId && spId !== filters.salespersonId) continue;
    if (filters.userId && spId !== filters.userId && text(inv.user_id) !== filters.userId) continue;

    const name =
      (typeof spObj === "object" && (text(spObj?.email) || text(spObj?.name))) ||
      (spId ? spId : "Company");
    const key = spId || "company";
    if (!map.has(key)) map.set(key, { name, tax: {}, ship: {}, paid: {}, due: {}, sales: {} });
    const a = map.get(key)!;
    const cur = text(inv.currency) || "USD";
    addCur(a.tax, cur, num(inv.tax));
    addCur(a.ship, cur, num(inv.shipping_cost));
    addCur(a.paid, cur, num(inv.paid_amount));
    addCur(a.due, cur, num(inv.balance_amount ?? num(inv.total) - num(inv.paid_amount)));
    addCur(a.sales, cur, num(inv.total));
  }

  // If salesperson never set on invoices, fall back to one company bucket from my-profile email.
  if (map.size === 0 && invoices.length > 0) {
    try {
      const me = await api.get<any>("/user/my-profile");
      const name = text(me?.email) || text(me?.name) || "Company";
      const a: Agg = { name, tax: {}, ship: {}, paid: {}, due: {}, sales: {} };
      for (const inv of invoices) {
        const cur = text(inv.currency) || "USD";
        addCur(a.tax, cur, num(inv.tax));
        addCur(a.ship, cur, num(inv.shipping_cost));
        addCur(a.paid, cur, num(inv.paid_amount));
        addCur(a.due, cur, num(inv.balance_amount ?? num(inv.total) - num(inv.paid_amount)));
        addCur(a.sales, cur, num(inv.total));
      }
      map.set("company", a);
    } catch {
      /* ignore */
    }
  }

  const cols: ReportCol[] = [
    { label: "Name" },
    { label: "Tax", right: true },
    { label: "Shipping Cost", right: true },
    { label: "Amount Paid", right: true },
    { label: "Amount Due", right: true },
    { label: "Sales", right: true },
  ];
  const tTax: Record<string, number> = {};
  const tShip: Record<string, number> = {};
  const tPaid: Record<string, number> = {};
  const tDue: Record<string, number> = {};
  const tSales: Record<string, number> = {};
  const rows = [...map.values()].map((a) => {
    mergeCur(tTax, a.tax);
    mergeCur(tShip, a.ship);
    mergeCur(tPaid, a.paid);
    mergeCur(tDue, a.due);
    mergeCur(tSales, a.sales);
    return [a.name, moneyLines(a.tax), moneyLines(a.ship), moneyLines(a.paid), moneyLines(a.due), moneyLines(a.sales)];
  });

  return {
    name: "Sales by User Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, moneyLines(tTax), moneyLines(tShip), moneyLines(tPaid), moneyLines(tDue), moneyLines(tSales)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Sales by Product ──────────────────────────────────────────── */
export async function loadSalesByProductReport(filters: ReportFilters): Promise<ReportView> {
  const products = await fetchPages("/product/all", {
    ...(filters.productId ? { _id: filters.productId } : {}),
    ...(filters.categoryId ? { category: filters.categoryId } : {}),
  }, 10, 200);
  const productMap = new Map(products.map((p: any) => [text(p._id), p]));

  const invoices = await fetchPages("/invoices", listParams(filters));
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

  for (const inv of invoices) {
    const cur = text(inv.currency) || "USD";
    const lines: any[] = Array.isArray(inv.product) ? inv.product : [];
    for (const line of lines) {
      const pid = typeof line.product_id === "object" ? text(line.product_id?._id) : text(line.product_id);
      if (filters.productId && pid !== filters.productId) continue;
      if (filters.productType === "Multi-variant") continue;
      const prod = pid ? productMap.get(pid) : undefined;
      const name =
        text(line.product_name) ||
        text(prod?.productName) ||
        (typeof line.product_id === "object" ? text(line.product_id?.productName) : "") ||
        "—";
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
    return [
      a.sku || "",
      a.productType,
      a.itemName,
      moneyLines(a.unit),
      String(a.qty),
      moneyLines(a.discount),
      moneyLines(a.total),
    ];
  });

  return {
    name: "Sales Report by Product",
    cols,
    rows,
    totals: ["", "", `Total (${rows.length})`, "", String(qtySum), moneyLines(tDisc), moneyLines(tTot)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Sales by Service ──────────────────────────────────────────── */
export async function loadSalesByServiceReport(filters: ReportFilters): Promise<ReportView> {
  const invoices = await fetchPages("/invoices", listParams(filters));
  type Agg = {
    name: string;
    rate: Record<string, number>;
    qty: number;
    discount: Record<string, number>;
    total: Record<string, number>;
  };
  const map = new Map<string, Agg>();

  for (const inv of invoices) {
    const cur = text(inv.currency) || "USD";
    const lines: any[] = Array.isArray(inv.service) ? inv.service : [];
    for (const line of lines) {
      const sid = typeof line.service_id === "object" ? text(line.service_id?._id) : text(line.service_id);
      const name =
        text(line.service_name) ||
        (typeof line.service_id === "object" ? text(line.service_id?.serviceName) : "") ||
        "—";
      const key = `${sid || name}|${cur}`;
      if (!map.has(key)) map.set(key, { name, rate: {}, qty: 0, discount: {}, total: {} });
      const a = map.get(key)!;
      a.qty += num(line.quantity);
      addCur(a.rate, cur, num(line.rate));
      addCur(a.discount, cur, num(line.discount));
      addCur(a.total, cur, num(line.amount));
    }
  }

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
    name: "Sales Report by Service",
    cols,
    rows,
    totals: [`Total (${rows.length})`, "", String(qtySum), moneyLines(tDisc), moneyLines(tTot)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

/* ── Sales by Category ─────────────────────────────────────────── */
export async function loadSalesByCategoryReport(filters: ReportFilters): Promise<ReportView> {
  const products = await fetchPages("/product/all", {}, 10, 200);
  const productCat = new Map<string, string>();
  for (const p of products) {
    const cat =
      typeof p.category === "object"
        ? text(p.category?.category) || text(p.category?.name)
        : text(p.category);
    productCat.set(text(p._id), cat || "Uncategorized");
  }

  const invoices = await fetchPages("/invoices", listParams(filters));
  type Agg = { name: string; tax: Record<string, number>; discount: Record<string, number>; sales: Record<string, number> };
  const map = new Map<string, Agg>();

  for (const inv of invoices) {
    const cur = text(inv.currency) || "USD";
    const lines: any[] = Array.isArray(inv.product) ? inv.product : [];
    // Distribute doc tax proportionally by line amount when line tax is a rate.
    const lineAmounts = lines.map((l) => num(l.amount));
    const lineSum = lineAmounts.reduce((s, n) => s + n, 0) || 1;
    const docTax = num(inv.tax);

    lines.forEach((line, i) => {
      const pid = typeof line.product_id === "object" ? text(line.product_id?._id) : text(line.product_id);
      const catName = (pid && productCat.get(pid)) || "Uncategorized";
      if (filters.categoryId) {
        const prod = products.find((p: any) => text(p._id) === pid);
        const catId = typeof prod?.category === "object" ? text(prod.category?._id) : text(prod?.category);
        if (catId !== filters.categoryId && catName !== filters.categoryId) return;
      }
      if (!map.has(catName)) map.set(catName, { name: catName, tax: {}, discount: {}, sales: {} });
      const a = map.get(catName)!;
      const share = lineAmounts[i] / lineSum;
      addCur(a.tax, cur, docTax * share);
      addCur(a.discount, cur, num(line.discount));
      addCur(a.sales, cur, num(line.amount));
    });
  }

  const cols: ReportCol[] = [
    { label: "Category Name" },
    { label: "Tax", right: true },
    { label: "Discount", right: true },
    { label: "Sales", right: true },
  ];
  const tTax: Record<string, number> = {};
  const tDisc: Record<string, number> = {};
  const tSales: Record<string, number> = {};
  const rows = [...map.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => {
      mergeCur(tTax, a.tax);
      mergeCur(tDisc, a.discount);
      mergeCur(tSales, a.sales);
      return [a.name, moneyLines(a.tax), moneyLines(a.discount), moneyLines(a.sales)];
    });

  return {
    name: "Sales by Category Report",
    cols,
    rows,
    totals: [`Total (${rows.length})`, moneyLines(tTax), moneyLines(tDisc), moneyLines(tSales)],
    meta: { from: rangeFrom(filters), to: rangeTo(filters) },
    source: "backend",
  };
}

export const SALES_REPORT_NAMES = [
  "Invoice Aging Report",
  "Sales Report",
  "Estimate Report",
  "Payment Report",
  "Sales by Customer Report",
  "Sales by User Report",
  "Sales Report by Product",
  "Sales Report by Service",
  "Sales by Category Report",
] as const;

export function isSalesReport(name: string) {
  return (SALES_REPORT_NAMES as readonly string[]).includes(name);
}
