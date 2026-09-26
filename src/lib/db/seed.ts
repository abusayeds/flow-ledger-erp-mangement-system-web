/**
 * File: src/lib/db/seed.ts
 * Versioned, interconnected starter data for the demo datastore.
 *
 * These are REAL persisted records (not per-page hardcoded arrays): they live
 * in IndexedDB, reference each other by id, and are fully editable live. The
 * seed just gives the stage a believable starting point; everything added
 * during the demo behaves identically and shows up across features.
 *
 * Bump SEED_VERSION to force a reseed on next load. `?reset` in the URL or
 * window.__resetDemo() also forces it (no UI button — invisible in product).
 */

import { db, COLLECTIONS } from "./db";

export const SEED_VERSION = 3;

/* ── helpers ───────────────────────────────────────────────────── */
const ts = (s: string) => Date.parse(s) || Date.now();

/* ── reference entities ────────────────────────────────────────── */
const taxes = [
  { id: 1, name: "new test tax", rate: 58 },
  { id: 2, name: "Test Tax", rate: 72 },
  { id: 3, name: "VAT", rate: 15 },
  { id: 4, name: "GST", rate: 5 },
];
const units = ["box", "cm", "kg", "pcs", "hrs"].map((name, i) => ({ id: i + 1, name }));
const categories = ["General", "Accountants", "Advisers", "Office Supplies"].map((name, i) => ({ id: i + 1, name }));

const customers = [
  { id: 1, name: "bdcalling", email: "info@bdcalling.com", phone: "+1 202 555 0111", subtitle: "Software house", balance: 0, status: "Active" },
  { id: 2, name: "Sed aliquip eaque co", email: "sed@eaque.co", phone: "+1 202 555 0122", subtitle: "Vitae pariatur Vero", balance: 9093.88, status: "Active" },
  { id: 3, name: "Dignissimos quae ull", email: "dig@quae.com", phone: "+1 202 555 0133", subtitle: "Harum ut dolore aliq", balance: 4472.0, status: "Active" },
  { id: 4, name: "Harum ut dolore aliq", email: "harum@dolore.com", phone: "+1 202 555 0144", subtitle: "Dolore quidem nisi d", balance: 0, status: "Active" },
  { id: 5, name: "SMT", email: "smt@smt.com", phone: "+1 202 555 0155", subtitle: "Temporibus est dese", balance: 160.0, status: "Active" },
  { id: 6, name: "rahim", email: "rahim@mail.com", phone: "+1 202 555 0166", subtitle: "", balance: 0, status: "Active" },
];

const vendors = [
  { id: 1, name: "bipul company", email: "bipul@co.com", phone: "+1 303 555 0111", subtitle: "Mollit fugiat elit", payable: 0, status: "Active" },
  { id: 2, name: "Officiis ullam labor", email: "officiis@labor.com", phone: "+1 303 555 0122", subtitle: "", payable: 0, status: "Active" },
  { id: 3, name: "SSE", email: "sse@sse.com", phone: "+1 303 555 0133", subtitle: "", payable: 0, status: "Active" },
  { id: 4, name: "SST", email: "sst@sst.com", phone: "+1 303 555 0144", subtitle: "", payable: 0, status: "Active" },
  { id: 5, name: "bdcalling", email: "vendor@bdcalling.com", phone: "+1 303 555 0155", subtitle: "", payable: 6201.52, status: "Active" },
  { id: 6, name: "SMT", email: "vendor@smt.com", phone: "+1 303 555 0166", subtitle: "", payable: 160.0, status: "Active" },
];

const products = [
  { id: 1, name: "cat", category: "General", sku: "CAT-01", note: "House cat", price: 0, buyPrice: 10, stock: 200, unit: "cm", taxId: 1, status: "Active" },
  { id: 2, name: "demo product", category: "General", sku: "DMO-01", note: "", price: 12, buyPrice: 8, stock: 50, unit: "box", taxId: 2, status: "Active" },
  { id: 3, name: "Officiis ullam labor", category: "Office Supplies", sku: "OFF-01", note: "", price: 236, buyPrice: 180, stock: 0, unit: "pcs", taxId: 2, status: "Active" },
  { id: 4, name: "Widget A", category: "General", sku: "WID-A", note: "Standard widget", price: 45, buyPrice: 30, stock: 120, unit: "box", taxId: 1, status: "Active" },
  { id: 5, name: "Widget B", category: "General", sku: "WID-B", note: "", price: 65, buyPrice: 40, stock: 8, unit: "box", taxId: 1, status: "Active" },
  { id: 6, name: "Gadget Pro", category: "Office Supplies", sku: "GAD-PRO", note: "", price: 160, buyPrice: 110, stock: 35, unit: "pcs", taxId: 3, status: "Active" },
];

const services = [
  { id: 1, name: "demo name", note: "", price: 0, sac: "dg", qty: 1, unit: "box", taxId: 1, status: "Active" },
  { id: 2, name: "Consulting", note: "Hourly consulting", price: 120, sac: "CON", qty: 1, unit: "hrs", taxId: 2, status: "Active" },
  { id: 3, name: "Service 1", note: "this is Service 1", price: 45, sac: "—", qty: 1, unit: "box", taxId: 2, status: "Active" },
  { id: 4, name: "Service 2", note: "this is service 2", price: 40, sac: "—", qty: 1, unit: "box", taxId: 2, status: "Active" },
];

/* ── sales documents ───────────────────────────────────────────── */
const mkItem = (i: number, name: string, qty: number, rate: number, taxId = 1) => ({
  id: i, name, description: "", qty, rate, taxId, discount: 0, amount: +(qty * rate).toFixed(2),
});

const invoices = [
  {
    id: 16, number: "#16", customerId: 1, date: "Jun 20, 2026", due: "Jun 27, 2026", ts: ts("Jun 20, 2026"),
    status: "Paid", items: [mkItem(1, "Widget A", 10, 45), mkItem(2, "Consulting", 24, 120, 2)],
    subTotal: 3630.4, tax: 2571.12, shipping: 0, total: 6201.52, amountPaid: 6201.52, amountDue: 0,
    terms: "Perferendis ad vero", notes: "Mollit fugiat elit",
  },
  {
    id: 14, number: "#14", customerId: 2, date: "Jun 18, 2026", due: "Jun 25, 2026", ts: ts("Jun 18, 2026"),
    status: "Partially Paid", items: [mkItem(1, "Gadget Pro", 30, 160, 3)],
    subTotal: 5186.0, tax: 3907.88, shipping: 0, total: 9093.88, amountPaid: 0, amountDue: 9093.88,
    terms: "Perferendis ad vero", notes: "",
  },
  {
    id: 12, number: "#12", customerId: 4, date: "Jun 15, 2026", due: "Jun 22, 2026", ts: ts("Jun 15, 2026"),
    status: "Paid", items: [mkItem(1, "Widget B", 12, 65)],
    subTotal: 980.0, tax: 740.18, shipping: 0, total: 1720.18, amountPaid: 1720.18, amountDue: 0,
    terms: "", notes: "",
  },
  {
    id: 9, number: "#9", customerId: 3, date: "Jun 12, 2026", due: "Jun 19, 2026", ts: ts("Jun 12, 2026"),
    status: "Overdue", items: [mkItem(1, "Gadget Pro", 26, 160, 3)],
    subTotal: 4160.0, tax: 312.0, shipping: 0, total: 4472.0, amountPaid: 0, amountDue: 4472.0,
    terms: "", notes: "Harum ut dolore",
  },
  {
    id: 5, number: "#5", customerId: 5, date: "Apr 27, 2026", due: "Apr 27, 2026", ts: ts("Apr 27, 2026"),
    status: "Draft", items: [mkItem(1, "demo product", 1, 160, 2)],
    subTotal: 160.0, tax: 0, shipping: 0, total: 160.0, amountPaid: 0, amountDue: 160.0,
    terms: "", notes: "Mollit fugiat elit",
  },
];

const estimates = [
  { id: 9, number: "#9", customerId: 3, date: "Jun 12, 2026", ts: ts("Jun 12, 2026"), status: "Sent", items: [mkItem(1, "Gadget Pro", 26, 160, 3)], subTotal: 4160, tax: 312, total: 4472, terms: "", notes: "" },
  { id: 8, number: "#8", customerId: 1, date: "Jun 10, 2026", ts: ts("Jun 10, 2026"), status: "Approved", items: [mkItem(1, "Widget A", 5, 45)], subTotal: 225, tax: 130.5, total: 355.5, terms: "", notes: "" },
];

const paymentsReceived = [
  { id: 3, number: "#3", customerId: 1, invoiceId: 16, date: "Jun 20, 2026", ts: ts("Jun 20, 2026"), amount: 6201.52, method: "Stripe", notes: "", internalNotes: "" },
  { id: 2, number: "#2", customerId: 4, invoiceId: 12, date: "Jun 15, 2026", ts: ts("Jun 15, 2026"), amount: 1720.18, method: "Paypal", notes: "", internalNotes: "" },
];

/* ── purchase documents ────────────────────────────────────────── */
const bills = [
  { id: 7, number: "#7", vendorId: 1, date: "Jun 17, 2026", due: "Jun 17, 2026", ts: ts("Jun 17, 2026"), status: "Paid", items: [], subTotal: 0, total: 0, amountPaid: 0, amountDue: 0, notes: "hi, Mollit fugiat elit" },
  { id: 6, number: "#6", vendorId: 5, date: "Jun 17, 2026", due: "Jun 24, 2026", ts: ts("Jun 17, 2026"), status: "Partially Paid", items: [mkItem(1, "Widget A", 50, 30)], subTotal: 1500, total: 2370, amountPaid: 0, amountDue: 2370, notes: "" },
];

const purchaseReturns = [
  { id: 4, number: "#4", vendorId: 5, invoiceId: 16, date: "Jun 21, 2026", ts: ts("Jun 21, 2026"), status: "Returned", reason: "Goods damaged in transit", items: [], subTotal: 520, total: 520, notes: "Mollit fugiat elit" },
];

const expenses = [
  { id: 2, number: "#2", vendorId: 2, category: "Accountants", date: "Jun 17, 2026", ts: ts("Jun 17, 2026"), amount: 240, notes: "Monthly accounting" },
  { id: 1, number: "#1", vendorId: 3, category: "Advisers", date: "Jun 10, 2026", ts: ts("Jun 10, 2026"), amount: 0, notes: "" },
];

/* ── projects & time ───────────────────────────────────────────── */
const projects = [
  { id: 1, name: "Basia Johnson", customerId: 1, subtitle: "Vitae pariatur Vero", rate: 0, billed: 0 },
  { id: 2, name: "Ezekiel Haynes", customerId: 3, subtitle: "Dignissimos quae ull", rate: 13, billed: 0 },
  { id: 3, name: "Gloria Daniels", customerId: 4, subtitle: "Sed aliquip eaque co", rate: 0, billed: 0 },
];
const tasks = [
  { id: 1, name: "task1", projectId: 2, notes: "", rate: 13 },
];
const timelogs = [
  { id: 1, customerId: 3, projectId: 2, taskId: 1, project: "Basia Johnson", task: "ef", hours: "23:00", month: "Jun 2026", date: "Jun 19, 2026", ts: ts("Jun 19, 2026"), dateLabel: "Today 10:16 PM", notes: "", invoiced: false },
];

const employees = [
  { id: 1, name: "John Carter", department: "Sales", designation: "Manager", email: "john@info.com", status: "Active" },
  { id: 2, name: "Maria Lopez", department: "Finance", designation: "Accountant", email: "maria@info.com", status: "Active" },
];

/* ── secondary documents (so their lists show real rows) ───────── */
const docItem = (n: string, q: number, r: number, tax = 1) => [{ id: 1, name: n, qty: q, rate: r, taxId: tax, discount: 0, amount: +(q * r).toFixed(2) }];
const mkDoc = (id: number, partyKey: string, partyId: number, date: string, total: number, status: string, extra: any = {}) => ({
  id, number: "#" + id, [partyKey]: partyId, date, due: date, ts: ts(date), status,
  items: total ? docItem("Widget A", 1, total) : [], subTotal: total, tax: 0, total, amountPaid: 0, amountDue: total, notes: "", ...extra,
});

const proformas = [
  mkDoc(8, "customerId", 3, "Jun 17, 2026", 0, "Sent"),
  mkDoc(7, "customerId", 4, "Jun 17, 2026", 140, "Sent"),
  mkDoc(6, "customerId", 3, "Jun 16, 2026", 6142, "Draft"),
  mkDoc(5, "customerId", 5, "Jun 16, 2026", 2930, "Draft"),
];
const salesReceipts = [
  mkDoc(3, "customerId", 1, "Jun 17, 2026", 20178.72, "Paid", { method: "Master Card" }),
  mkDoc(2, "customerId", 5, "Jun 16, 2026", 1725, "Paid", { method: "Cash" }),
  mkDoc(1, "customerId", 6, "Jun 16, 2026", 450, "Paid", { method: "iZettle" }),
];
const creditNotes = [
  mkDoc(4, "customerId", 3, "Jun 17, 2026", 9604.92, "Unused"),
  mkDoc(3, "customerId", 4, "Jun 17, 2026", 310.5, "Unused"),
  mkDoc(2, "customerId", 2, "Jun 16, 2026", 3355, "Unused"),
  mkDoc(1, "customerId", 2, "Jun 16, 2026", 3325, "Unused"),
];
const deliveryChallans = [
  mkDoc(4, "customerId", 5, "Jun 16, 2026", 3355, "Draft", { invoiceNo: "-", invoiceStatus: "Not Invoiced" }),
  mkDoc(3, "customerId", 5, "Jun 16, 2026", 454.6, "Delivered", { invoiceNo: "-", invoiceStatus: "Not Invoiced" }),
  mkDoc(2, "customerId", 2, "Jun 16, 2026", 3355, "Draft", { invoiceNo: "-", invoiceStatus: "Not Invoiced" }),
  mkDoc(1, "customerId", 4, "Apr 27, 2026", 50, "Open", { invoiceNo: "-", invoiceStatus: "Not Invoiced" }),
];
const purchaseOrders = [
  mkDoc(7, "vendorId", 1, "Jun 17, 2026", 28263.4, "Sent", { billStatus: "Not Billed" }),
  mkDoc(5, "vendorId", 5, "Jun 16, 2026", 1500, "Approved", { billStatus: "Not Billed" }),
  mkDoc(2, "vendorId", 6, "Apr 27, 2026", 160, "Draft", { billStatus: "Not Billed" }),
];
const debitNotes = [
  mkDoc(3, "vendorId", 1, "Jun 17, 2026", 0, "Unused"),
  mkDoc(2, "vendorId", 5, "Jun 16, 2026", 520, "Unused"),
  mkDoc(1, "vendorId", 6, "Apr 27, 2026", 160, "Unused"),
];

const paymentsMade = [
  { id: 2, number: "#2", vendorId: 5, billId: 6, date: "Jun 17, 2026", ts: ts("Jun 17, 2026"), amount: 0, method: "Stripe", notes: "" },
  { id: 1, number: "#1", vendorId: 1, billId: 7, date: "Jun 16, 2026", ts: ts("Jun 16, 2026"), amount: 0, method: "Cash", notes: "" },
];

const company = [{ id: 1, name: "info", country: "Bangladesh", email: "info@inovoic.com", currency: "USD" }];

/* ── seed table map ────────────────────────────────────────────── */
const DATA: Record<string, any[]> = {
  company, taxes, units, categories, customers, vendors, products, services,
  invoices, estimates, paymentsReceived,
  proformas, salesReceipts, creditNotes, deliveryChallans,
  bills, purchaseOrders, purchaseReturns, debitNotes, expenses, paymentsMade,
  projects, tasks, timelogs, employees,
};

/* ── seeding (resilient — each op isolated, never all-or-nothing) ─ */
export async function resetDemo(): Promise<void> {
  for (const c of COLLECTIONS) {
    try { await (db as any)[c].clear(); } catch (e) { console.error("[demo] clear failed:", c, e); }
  }
  for (const [name, rows] of Object.entries(DATA)) {
    if (!rows?.length) continue;
    try { await (db as any)[name].bulkPut(rows); } catch (e) { console.error("[demo] seed failed:", name, e); }
  }
  try { await db.meta.put({ key: "seedVersion", value: SEED_VERSION }); } catch (e) { console.error("[demo] meta failed:", e); }
}

export async function seedIfNeeded(): Promise<void> {
  let stored: any;
  try { stored = (await db.meta.get("seedVersion"))?.value; } catch { stored = undefined; }
  // reseed when version changed OR core data is missing (self-heal)
  let needs = stored !== SEED_VERSION;
  if (!needs) {
    try { needs = (await db.customers.count()) === 0; } catch { needs = true; }
  }
  if (needs) await resetDemo();
}
