/**
 * File: src/lib/db/sync.ts
 * Backend ↔ datastore bridge. Mirrors REST collections into the local Dexie
 * tables the UI reads via `useCollection`/`useDoc`, and (for write-enabled
 * entities) routes `repo` writes back to the backend. All of this happens
 * BELOW the UI: no page, component, field, or layout changes.
 *
 * The UI keys records by a numeric `id` while the backend uses Mongo `_id`
 * strings, so each backend document gets a deterministic numeric `id` and keeps
 * its original `_id` (internal, ignored by the UI) so writes can be routed back.
 */

import { format } from "date-fns";
import { api, type ApiRequestConfig } from "@/lib/api/client";
import { getToken } from "@/lib/api/tokenStore";
import { toArray } from "@/services/_http";
import { db, type CollectionName } from "./db";
import { isTimelogInvoiced } from "@/lib/timelogInvoiced";

/** Stable positive 32-bit hash of a Mongo id → the UI's numeric primary key. */
export function numericId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

const num = (v: unknown): number =>
  typeof v === "number" ? v : parseFloat(String(v ?? "")) || 0;
const str = (v: unknown): string => (v == null ? "" : String(v));
/** Name of a possibly-populated ref (`{category|name|...}`), else "" for a bare id. */
const refName = (v: any): string =>
  v && typeof v === "object" ? str(v.category ?? v.name ?? v.title) : "";
/** Id of a possibly-populated ref (`{_id}`) or a bare id string. */
const refId = (v: any): string =>
  v && typeof v === "object" ? str(v._id) : str(v);
/** Only pass through a value that looks like a Mongo ObjectId (avoids CastErrors). */
const oid = (v: unknown): string | undefined => {
  const s = str(v);
  return /^[a-f0-9]{24}$/i.test(s) ? s : undefined;
};
/** ISO date → `YYYY-MM-DD` (what the form inputs expect); "" when absent. */
const ymd = (v: unknown): string => (v ? str(v).slice(0, 10) : "");
/** Backend date → the seed's display format ("Jun 20, 2026"); "" when absent. */
const fmtDate = (v: unknown): string => {
  if (!v) return "";
  const d = new Date(str(v));
  return isNaN(d.getTime()) ? "" : format(d, "MMM d, yyyy");
};
/** Any date string the UI holds → `YYYY-MM-DD`; "" when unparseable. */
const toIso = (v: unknown): string => {
  if (!v) return "";
  const d = new Date(str(v));
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Resolve a UI numeric id back to the backend Mongo `_id` via the local table. */
export async function backendIdOf(
  collection: CollectionName,
  id: unknown,
): Promise<string | undefined> {
  if (id == null || id === "") return undefined;
  try {
    const row = await (db as any)[collection].get(Number(id));
    const _id = str(row?._id);
    return _id || undefined;
  } catch {
    return undefined;
  }
}

type MapFn = (doc: any) => Record<string, any>;

interface WriteConfig {
  create: string;
  /** Omit when the backend has no edit endpoint (update stays local-only). */
  update?: (backendId: string) => string;
  remove: (backendId: string) => string;
  /** Verb for update (some backends use POST /edit/:id). Default "patch". */
  updateMethod?: "patch" | "put" | "post";
  /** Verb for delete (some backends use POST). Default "delete". */
  removeMethod?: "delete" | "post";
  /** Body for a POST-style delete that takes the id in the body (e.g. project). */
  removeBody?: (backendId: string) => Record<string, unknown>;
  /** UI row/patch → backend request body (may resolve refs, so may be async). */
  reverse: (row: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>;
}

interface SyncSpec {
  collection: CollectionName;
  url: string;
  map: MapFn;
  write?: WriteConfig;
}

// ── Field maps: backend doc → existing seed-row shape (never changes the UI) ──

/**
 * Full customer map (backend party doc → the exact row the Customers page/detail
 * form reads). Business fields live under `businessProfile`; the address under
 * `businessProfile.billing_address`.
 */
const mapCustomer: MapFn = (d) => {
  const bp = d.businessProfile ?? {};
  const ba = bp.billing_address ?? {};
  return {
    name: str(d.name) || str(bp.companyName),
    email: str(d.email),
    phone: str(d.phone) || str(bp.business_phone),
    subtitle: str(bp.companyName) || str(d.name),
    balance: num(bp.opening_balance ?? d.balance),
    status: bp.active === false || d.isDeleted ? "Inactive" : "Active",
    regNo: str(bp.registration_number),
    taxId: str(bp.tax_number),
    fax: str(bp.fax),
    homePhone: str(bp.home_phone),
    firstName: "",
    lastName: "",
    mobile: "",
    birthday: ymd(bp.birthday),
    anniversary: ymd(bp.anniversary),
    street1: str(ba.address_line_1),
    street2: str(ba.address_line_2),
    zip: str(ba.zip_code),
    city: str(ba.city),
    state: str(ba.state),
    country: str(ba.country),
    bank: str(bp.bank_details),
    currency: str(d.currency ?? bp.currency),
    defaultTaxService: refId(bp.default_tax_service_id),
    defaultTaxProduct: refId(bp.default_tax_product_id),
    hourlyRate: num(bp.hourly_rate),
    paymentTerms: str(bp.payment_terms),
    openingBalance: num(bp.opening_balance),
    openingBalanceDate: ymd(bp.opening_balance_date),
    notes: str(bp.notes),
    paymentReminder: !!bp.payment_reminder,
    sameAsBilling: !!bp.same_as_billing,
  };
};

/** Customer row → backend create/update body (flat fields the party helper expects). */
const reverseCustomer = (r: Record<string, any>) => {
  const billing = {
    name: str(r.name),
    address_line_1: str(r.street1),
    address_line_2: str(r.street2),
    city: str(r.city),
    state: str(r.state),
    country: str(r.country),
    zip_code: str(r.zip),
  };
  const hasAddr = !!(billing.address_line_1 || billing.city || billing.country);
  return {
    name: str(r.name),
    email: str(r.email),
    phone: str(r.phone),
    company_name: str(r.name),
    registration_number: str(r.regNo),
    tax_number: str(r.taxId),
    business_phone: str(r.phone),
    fax: str(r.fax),
    home_phone: str(r.homePhone),
    birthday: r.birthday || undefined,
    anniversary: r.anniversary || undefined,
    bank_details: str(r.bank),
    payment_terms: str(r.paymentTerms),
    default_tax_service_id: oid(r.defaultTaxService),
    default_tax_product_id: oid(r.defaultTaxProduct),
    hourly_rate: num(r.hourlyRate),
    opening_balance: num(r.openingBalance),
    opening_balance_date: r.openingBalanceDate || undefined,
    payment_reminder: !!r.paymentReminder,
    currency: str(r.currency) || undefined,
    same_as_billing: !!r.sameAsBilling,
    notes: str(r.notes),
    ...(hasAddr ? { billing_address: billing } : {}),
  };
};

const mapVendor: MapFn = (d) => ({
  name: str(d.name) || str(d.businessProfile?.companyName),
  email: str(d.email),
  phone: str(d.phone) || str(d.businessProfile?.business_phone),
  subtitle: str(d.designation) || str(d.businessProfile?.companyName),
  payable: num(d.businessProfile?.opening_balance ?? d.payable),
  status: d.isDeleted ? "Inactive" : "Active",
});

const mapProduct: MapFn = (d) => ({
  name: str(d.productName ?? d.name),
  category: refName(d.category),
  sku: str(d.sku),
  note: str(d.description),
  price: num(d.pricing?.sellPrice ?? d.price),
  buyPrice: num(d.pricing?.buyPrice ?? d.buyPrice),
  stock: num(d.stock?.onHandStock ?? d.stock?.quantity ?? d.quantity),
  unit: str(d.unitType ?? d.unit),
  image: str(d.image) || null,
  taxId: 0,
  status: d.isDeleted ? "Inactive" : "Active",
});

const mapService: MapFn = (d) => ({
  name: str(d.serviceName ?? d.name),
  note: str(d.description ?? d.note),
  price: num(d.rate ?? d.price),
  sac: typeof d.sac === "string" ? d.sac : d.sac ? "Yes" : "",
  qty: num(d.quantity ?? d.qty ?? 1),
  unit: str(d.unitType ?? d.unit),
  taxId: 0,
  status: d.isDeleted ? "Inactive" : "Active",
});

const mapTax: MapFn = (d) => ({ name: str(d.name), rate: num(d.rate) });
const mapCategory: MapFn = (d) => ({ name: str(d.category ?? d.name) });

// ── Invoice (and its sibling sales documents) ────────────────────────────────

/** Backend status → the label the sales-doc UI expects. */
const invStatus = (s: unknown): string =>
  str(s) === "Partial" ? "Partially Paid" : str(s) || "Draft";
const invStatusOut = (s: unknown): string =>
  str(s) === "Partially Paid" ? "Partial" : str(s) || "Draft";

/** Backend product/service line arrays → the UI's flat `items` array. */
const linesIn = (d: any): any[] => {
  const out: any[] = [];
  let i = 1;
  for (const p of d.product ?? [])
    out.push({
      id: i++,
      name: str(p.product_name) || refName(p.product_id),
      description: str(p.description),
      qty: num(p.quantity),
      rate: num(p.rate),
      taxId: 0,
      taxRate: num(p.tax),
      discount: num(p.discount),
      amount: num(p.amount),
    });
  for (const s of d.service ?? [])
    out.push({
      id: i++,
      name: str(s.service_name) || refName(s.service_id),
      description: str(s.description),
      qty: num(s.quantity),
      rate: num(s.rate),
      taxId: 0,
      taxRate: num(s.tax),
      discount: num(s.discount),
      amount: num(s.amount),
    });
  return out;
};

/** Backend sales doc → the UI invoice/proforma/receipt row shape. */
const mapInvoice: MapFn = (d) => ({
  number: str(d.invoice_number),
  customerId: d.customer_id ? numericId(refId(d.customer_id)) : "",
  customerName: str(d.customer_name) || refName(d.customer_id),
  date: fmtDate(d.date ?? d.createdAt),
  due: fmtDate(d.due_date),
  ts: d.date ? new Date(str(d.date)).getTime() : Date.now(),
  status: invStatus(d.status),
  items: linesIn(d),
  subTotal: num(d.sub_total),
  tax: num(d.tax),
  shipping: num(d.shipping_cost),
  total: num(d.total),
  amountPaid: num(d.paid_amount),
  amountDue: num(d.balance_amount),
  terms: str(d.terms_and_conditions),
  notes: str(d.notes),
  signature: str(d.signature),
  currency: str(d.currency),
  paymentMethod: Array.isArray(d.payment_method) ? d.payment_method.map((item: unknown) => str(item)).filter(Boolean) : [],
  payment_method: Array.isArray(d.payment_method) ? d.payment_method.map((item: unknown) => str(item)).filter(Boolean) : [],
  paymentType: Array.isArray(d.payment_method) ? str(d.payment_method[0]) : str(d.payment_method),
  subTitle: str(d.sub_title),
  shippingMethod: str(d.shipping_method),
  salespersonId:
    d.salesperson && typeof d.salesperson === "object"
      ? str(refId(d.salesperson))
      : /^[a-f\d]{24}$/i.test(str(d.salesperson))
        ? str(d.salesperson)
        : "",
  salesperson:
    d.salesperson && typeof d.salesperson === "object"
      ? str(d.salesperson.name)
      : /^[a-f\d]{24}$/i.test(str(d.salesperson))
        ? ""
        : str(d.salesperson),
  street1: str(d.billing_address?.street),
  street2: str(d.billing_address?.street2),
  city: str(d.billing_address?.city),
  state: str(d.billing_address?.state),
  zip: str(d.billing_address?.zip),
  country: str(d.billing_address?.country),
  shipStreet1: str(d.shipping_address?.street),
  shipStreet2: str(d.shipping_address?.street2),
  shipCity: str(d.shipping_address?.city),
  shipState: str(d.shipping_address?.state),
  shipZip: str(d.shipping_address?.zip),
  shipCountry: str(d.shipping_address?.country),
});

/** UI invoice row → backend create/update body (resolves customer ref + lines). */
const reverseInvoice = async (r: Record<string, any>) => {
  const customer_id = await backendIdOf("customers", r.customerId);
  const billingStreet = str(r.street1);
  const billingCity = str(r.city);
  const billingCountry = str(r.country);
  const shippingStreet = str(r.shipStreet1);
  const shippingCity = str(r.shipCity);
  const shippingCountry = str(r.shipCountry);
  const hasBillingAddress = !!(billingStreet && billingCity && billingCountry);
  const hasShippingAddress = !!(shippingStreet && shippingCity && shippingCountry);
  const product = (r.items ?? [])
    .filter((it: any) => str(it.name))
    .map((it: any) => {
      const base = num(it.qty) * num(it.rate);
      const discFlat = num(it.discount);
      // Backend treats a line discount strictly as a percent; convert the
      // UI's flat discount and recompute amount so validateItemAmount passes.
      const discPct = base > 0 ? (discFlat / base) * 100 : 0;
      return {
        product_name: str(it.name),
        description: str(it.description),
        quantity: num(it.qty),
        rate: num(it.rate),
        tax: num(it.taxRate ?? it.tax),
        discount: +discPct.toFixed(6),
        amount: +(base - (base * discPct) / 100).toFixed(2),
      };
    });
  return {
    invoice_number: str(r.number).replace(/^#/, ""),
    ...(customer_id ? { customer_id } : { customer_name: str(r.customerName) }),
    currency: str(r.currency) || undefined,
    date: toIso(r.date) || todayIso(),
    due_date: toIso(r.due) || toIso(r.date) || todayIso(),
    product,
    service: [],
    sub_total: num(r.subTotal),
    shipping_cost: num(r.shipping),
    total: num(r.total),
    paid_amount: num(r.amountPaid),
    balance_amount: num(r.amountDue),
    payment_method: Array.isArray(r.paymentMethod ?? r.payment_method)
      ? (r.paymentMethod ?? r.payment_method).map((item: unknown) => str(item)).filter(Boolean)
      : undefined,
    sub_title: str(r.subTitle) || undefined,
    shipping_method: str(r.shippingMethod) || undefined,
    ...(str(r.salespersonId) && /^[a-f\d]{24}$/i.test(str(r.salespersonId))
      ? { salesperson: str(r.salespersonId) }
      : {}),
    ...(hasBillingAddress
      ? {
          billing_address: {
            street: billingStreet,
            street2: str(r.street2) || undefined,
            city: billingCity,
            state: str(r.state) || undefined,
            zip: str(r.zip) || undefined,
            country: billingCountry,
          },
        }
      : {}),
    ...(hasShippingAddress
      ? {
          shipping_address: {
            street: shippingStreet,
            street2: str(r.shipStreet2) || undefined,
            city: shippingCity,
            state: str(r.shipState) || undefined,
            zip: str(r.shipZip) || undefined,
            country: shippingCountry,
          },
        }
      : {}),
    signature: str(r.signature) || undefined,
    terms_and_conditions: str(r.terms),
    notes: str(r.notes),
    status: invStatusOut(r.status),
    recurring: (() => {
      const v = str(r.recurring);
      if (!v || v === "None" || v === "Off" || v === "Never") return "Never";
      if (v === "Daily" || v === "Weekly" || v === "Monthly" || v === "Quarterly" || v === "Half-Yearly" || v === "Yearly") return v;
      return "Never";
    })(),
  };
};

// ── Purchase documents (bill / purchase order / debit note) — vendor-keyed ───

/**
 * Backend → UI status labels.
 * PO / purchase-return enums are lowercase (`draft`, `onhold`);
 * bill / debit-note enums are Title Case (`Draft`, `Partial`) — same as invoices.
 */
const purchaseStatusIn = (s: unknown): string => {
  const raw = str(s).trim();
  if (!raw) return "Draft";
  const key = raw.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  const compact = key.replace(/\s+/g, "");
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    approved: "Approved",
    received: "Received",
    onhold: "On Hold",
    "on hold": "On Hold",
    declined: "Declined",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    closed: "Closed",
    disputed: "Disputed",
    posted: "Closed",
    partial: "Partially Paid",
    "partially paid": "Partially Paid",
    paid: "Paid",
    overdue: "Overdue",
    unused: "Unused",
    used: "Used",
    "partially used": "Partially Used",
    open: "Open",
    returned: "Returned",
    applied: "Applied",
    void: "Void",
    recurring: "Recurring",
    creditnotesapplied: "Credit Notes Applied",
    "credit notes applied": "Credit Notes Applied",
  };
  return map[key] || map[compact] || raw.replace(/\b\w/g, (c) => c.toUpperCase());
};

/** PO / purchase-return write: lowercase enums. */
const purchaseStatusOutLower = (s: unknown): string => {
  const key = str(s).trim().toLowerCase();
  const map: Record<string, string> = {
    draft: "draft",
    sent: "sent",
    approved: "approved",
    received: "received",
    "on hold": "onhold",
    onhold: "onhold",
    declined: "declined",
    cancelled: "declined",
    canceled: "declined",
    closed: "posted",
    disputed: "declined",
    "partially paid": "partial",
    partial: "partial",
    paid: "paid",
    overdue: "overdue",
  };
  return map[key] || "draft";
};

/** Bill / debit-note write: Title Case enums (`Draft`, `Partial`, …). */
const purchaseStatusOutTitle = (s: unknown): string => {
  const v = str(s).trim();
  if (!v) return "Draft";
  if (v === "Partially Paid") return "Partial";
  const compact = v.toLowerCase().replace(/[\s_]+/g, "");
  const map: Record<string, string> = {
    draft: "Draft",
    partial: "Partial",
    partiallypaid: "Partial",
    paid: "Paid",
    overdue: "Overdue",
    recurring: "Recurring",
    void: "Void",
    open: "Open",
    creditnotesapplied: "CreditNotesApplied",
    approved: "Approved",
    applied: "Applied",
  };
  return map[compact] || "Draft";
};

/** Backend purchase doc → the UI bill/PO/debit-note row shape (vendor-keyed). */
const mapPurchase: MapFn = (d) => ({
  number: str(d.invoice_number),
  vendorId: d.vendor_id ? numericId(refId(d.vendor_id)) : "",
  vendorName: str(d.vendor_name) || refName(d.vendor_id),
  date: fmtDate(d.date ?? d.createdAt),
  due: fmtDate(d.due_date),
  ts: d.date ? new Date(str(d.date)).getTime() : Date.now(),
  status: purchaseStatusIn(d.status),
  items: linesIn(d),
  subTotal: num(d.sub_total),
  tax: num(d.tax),
  shipping: num(d.shipping_cost),
  total: num(d.total),
  amountPaid: num(d.paid_amount),
  amountDue: num(d.balance_amount),
  terms: str(d.terms_and_conditions),
  notes: str(d.notes),
  signature: str(d.signature),
});

/** UI purchase row → backend body (resolves vendor ref + lines). */
const reversePurchaseWith =
  (statusOut: (s: unknown) => string) =>
  async (r: Record<string, any>) => {
    const vendor_id = await backendIdOf("vendors", r.vendorId);
    const product = (r.items ?? [])
      .filter((it: any) => str(it.name))
      .map((it: any) => {
        const base = num(it.qty) * num(it.rate);
        const discPct = base > 0 ? (num(it.discount) / base) * 100 : 0;
        return {
          product_name: str(it.name),
          description: str(it.description),
          quantity: num(it.qty),
          rate: num(it.rate),
          tax: num(it.taxRate ?? it.tax),
          discount: +discPct.toFixed(6),
          amount: +(base - (base * discPct) / 100).toFixed(2),
        };
      });
    return {
      invoice_number: str(r.number).replace(/^#/, ""),
      ...(vendor_id ? { vendor_id } : { vendor_name: str(r.vendorName) }),
      date: toIso(r.date) || todayIso(),
      due_date: toIso(r.due) || toIso(r.date) || todayIso(),
      product,
      service: [],
      sub_total: num(r.subTotal),
      shipping_cost: num(r.shipping),
      total: num(r.total),
      paid_amount: num(r.amountPaid),
      balance_amount: num(r.amountDue),
      terms_and_conditions: str(r.terms),
      notes: str(r.notes),
      signature: str(r.signature) || undefined,
      status: statusOut(r.status),
    };
  };

/** Bills + debit notes (Title Case status enums). */
const reversePurchaseTitle = reversePurchaseWith(purchaseStatusOutTitle);
/** Purchase orders + returns (lowercase status enums). */
const reversePurchaseLower = reversePurchaseWith(purchaseStatusOutLower);

// ── Expense (vendor + category + amount) ─────────────────────────────────────

const mapExpense: MapFn = (d) => ({
  number: str(d.invoice_number),
  vendorId: d.vendor_id ? numericId(refId(d.vendor_id)) : "",
  vendorName: str(d.vendor_name) || refName(d.vendor_id),
  category: str(d.category),
  date: fmtDate(d.date ?? d.createdAt),
  ts: d.date ? new Date(str(d.date)).getTime() : Date.now(),
  amount: num(d.total),
  notes: str(d.notes),
});

const reverseExpense = async (r: Record<string, any>) => {
  const vendor_id = await backendIdOf("vendors", r.vendorId);
  const amt = num(r.amount);
  return {
    invoice_number: str(r.number).replace(/^#/, ""),
    ...(vendor_id ? { vendor_id } : { vendor_name: str(r.vendorName) }),
    category: str(r.category),
    date: toIso(r.date) || todayIso(),
    due_date: toIso(r.date) || todayIso(),
    product: [],
    service: [],
    sub_total: amt,
    total: amt,
    notes: str(r.notes),
    status: "Draft",
  };
};

// ── Full vendor (mirrors the customer party contract, keyed on `payable`) ─────

const mapVendorFull: MapFn = (d) => {
  const bp = d.businessProfile ?? {};
  const ba = bp.billing_address ?? {};
  return {
    name: str(d.name) || str(bp.companyName),
    email: str(d.email),
    phone: str(d.phone) || str(bp.business_phone),
    subtitle: str(bp.companyName) || str(d.name),
    payable: num(bp.opening_balance ?? d.payable),
    status: bp.active === false || d.isDeleted ? "Inactive" : "Active",
    regNo: str(bp.registration_number),
    taxId: str(bp.tax_number),
    fax: str(bp.fax),
    homePhone: str(bp.home_phone),
    firstName: "",
    lastName: "",
    mobile: "",
    birthday: ymd(bp.birthday),
    anniversary: ymd(bp.anniversary),
    street1: str(ba.address_line_1),
    street2: str(ba.address_line_2),
    zip: str(ba.zip_code),
    city: str(ba.city),
    state: str(ba.state),
    country: str(ba.country),
    bank: str(bp.bank_details),
    currency: str(d.currency ?? bp.currency),
    defaultTaxService: refId(bp.default_tax_service_id),
    defaultTaxProduct: refId(bp.default_tax_product_id),
    hourlyRate: num(bp.hourly_rate),
    paymentTerms: str(bp.payment_terms),
    openingBalance: num(bp.opening_balance),
    openingBalanceDate: ymd(bp.opening_balance_date),
    notes: str(bp.notes),
    paymentReminder: !!bp.payment_reminder,
    sameAsBilling: !!bp.same_as_billing,
  };
};

// vendor create/update share the customer party body; update carries `_id`
// (the /vendor/update route reads the id from the body, not the URL).
const reverseVendor = (r: Record<string, any>) => ({
  ...reverseCustomer(r),
  ...(r._id ? { _id: String(r._id) } : {}),
});

// ── Product write (pricing / stock / category ref) ───────────────────────────

async function categoryIdByName(name: unknown): Promise<string | undefined> {
  const n = str(name).trim();
  if (!n) return undefined;
  try {
    const all = await (db as any).categories.toArray();
    const hit = all.find((c: any) => str(c.name) === n);
    return hit?._id ? String(hit._id) : undefined;
  } catch {
    return undefined;
  }
}

const reverseProduct = async (r: Record<string, any>) => {
  const category =
    (r.categoryId ? String(r.categoryId) : "") ||
    (await categoryIdByName(r.category)) ||
    "";
  const onHand = num(r.stock);
  return {
    productName: str(r.name),
    sku: str(r.sku),
    unitType: str(r.unit),
    quantity: onHand || num(r.qty) || 1,
    description: str(r.note),
    pricing: { buyPrice: num(r.buyPrice), sellPrice: num(r.price) },
    stock: { onHandStock: onHand, availableForSale: onHand },
    ...(r.image && !String(r.image).startsWith("data:") ? { image: str(r.image) } : {}),
    ...(category ? { category } : {}),
  };
};

// ── Payment received / made ──────────────────────────────────────────────────

const firstMethod = (d: any): string =>
  Array.isArray(d.payment_method) ? str(d.payment_method[0]) : str(d.payment_method ?? d.method);

const mapPaymentReceived: MapFn = (d) => ({
  number: str(d.invoice_number) || str(d.payment_number),
  customerId: d.customer_id ? numericId(refId(d.customer_id)) : "",
  invoiceId: d.invoice_id ? numericId(refId(d.invoice_id)) : "",
  date: fmtDate(d.date ?? d.createdAt),
  ts: d.date ? new Date(str(d.date)).getTime() : Date.now(),
  amount: num(d.total ?? d.amount),
  method: firstMethod(d),
  notes: str(d.notes),
  internalNotes: str(d.internal_notes),
});

const reversePaymentReceived = async (r: Record<string, any>) => {
  const customer_id = await backendIdOf("customers", r.customerId);
  const invoice_id = await backendIdOf("invoices", r.invoiceId);
  const amt = num(r.amount);
  return {
    ...(customer_id ? { customer_id } : {}),
    ...(invoice_id ? { invoice_id } : {}),
    date: toIso(r.date) || todayIso(),
    payment_method: r.method ? [str(r.method)] : [],
    product: [],
    service: [],
    sub_total: amt,
    total: amt,
    notes: str(r.notes),
    internal_notes: str(r.internalNotes),
  };
};

// Payment made (vendorPayment) — read + delete only; create contract (bill
// allocations) is not reproduced from the simple web row, so no write map.
// Web ProjectStatus (Ongoing|Onhold|Completed|Planning) ↔ backend (Ongoing|Onhold|Finished).
const projStatusOut = (s: unknown): string => {
  const v = str(s);
  if (v === "Onhold") return "Onhold";
  if (v === "Completed" || v === "Finished") return "Finished";
  return "Ongoing"; // Ongoing / Planning
};

const mapProject: MapFn = (d) => ({
  name: str(d.name),
  status: d.status === "Finished" ? "Completed" : str(d.status) || "Planning",
  description: str(d.description),
  budget: num(d.budget),
  startDate: ymd(d.start_date),
  endDate: ymd(d.end_date),
  members: (d.members ?? []).map((m: any) => (m && typeof m === "object" ? m.name : m)).filter(Boolean),
  clients: (d.clients ?? []).map((c: any) => (c && typeof c === "object" ? c.name : c)).filter(Boolean),
  milestones: [],
  bugs: [],
  activities: [],
  totalTasks: num(d.total_task),
  completedTasks: 0,
});

const fmtMonth = (v: unknown): string => {
  if (!v) return "";
  const d = new Date(str(v));
  return isNaN(d.getTime()) ? "" : format(d, "MMM yyyy");
};

/** UI stores "HH:MM"; backend stores hours + minutes as separate numbers. */
const fmtTimelogHours = (d: any): string => {
  const raw = str(d.hours);
  if (raw.includes(":")) return raw;
  const h = Math.max(0, Math.floor(num(d.hours)));
  const m = Math.max(0, Math.floor(num(d.minutes)));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const reverseTimelog = async (r: any) => {
  const raw = str(r.hours || "00:00");
  let hours = 0;
  let minutes = 0;
  if (raw.includes(":")) {
    const [hh, mm] = raw.split(":");
    hours = parseInt(hh, 10) || 0;
    minutes = parseInt(mm, 10) || 0;
  } else {
    hours = Math.floor(num(r.hours));
    minutes = Math.floor(num(r.minutes));
  }
  const projectName = str(r.project);
  let project_id: string | undefined;
  if (projectName) {
    const rows = await db.projects.toArray();
    const match = rows.find((p: any) => str(p.name).trim() === projectName.trim() && oid(p._id));
    if (match) project_id = oid(match._id);
  } else if (oid(r.projectId) || oid(r.project_id)) {
    project_id = oid(r.projectId) || oid(r.project_id);
  }
  return {
    type: "manual" as const,
    project_name: projectName || undefined,
    ...(project_id ? { project_id } : {}),
    task_name: str(r.task) || undefined,
    notes: str(r.notes),
    hours,
    minutes,
    date: toIso(r.date) || todayIso(),
    is_active: true,
  };
};

const mapTimelog: MapFn = (d) => {
  const dateSrc = d.date ?? d.created_at;
  const backendId = str(d._id ?? d.id);
  return {
    project: str(d.project ?? d.project_name),
    task: str(d.task ?? d.task_name),
    hours: fmtTimelogHours(d),
    notes: str(d.notes ?? d.details),
    date: fmtDate(dateSrc),
    month: fmtMonth(dateSrc),
    ts: dateSrc ? new Date(str(dateSrc)).getTime() : Date.now(),
    dateLabel: fmtDate(dateSrc),
    invoiced: isTimelogInvoiced(backendId) || !!d.invoiced,
    customerId: null,
    projectId: oid(refId(d.project_id)) || null,
    taskId: null,
  };
};

const mapPaymentMade: MapFn = (d) => ({
  number: str(d.payment_number) || str(d.invoice_number),
  vendorId: d.vendor_id ? numericId(refId(d.vendor_id)) : "",
  date: fmtDate(d.payment_date ?? d.date ?? d.createdAt),
  ts: d.payment_date ? new Date(str(d.payment_date)).getTime() : Date.now(),
  amount: num(d.payment_amount ?? d.amount ?? d.total),
  method: firstMethod(d),
  notes: str(d.notes),
});

// ── Registry. Add an entry to bring a list live; add `write` for CRUD too. ────

export const SYNC_SPECS: SyncSpec[] = [
  {
    collection: "customers",
    url: "/customers",
    map: mapCustomer,
    write: {
      create: "/customers",
      update: (id) => `/customers/${id}`,
      remove: (id) => `/customers/${id}`,
      reverse: reverseCustomer,
    },
  },
  {
    collection: "invoices",
    url: "/invoices",
    map: mapInvoice,
    write: {
      create: "/invoices",
      update: (id) => `/invoices/${id}`,
      remove: (id) => `/invoices/${id}`,
      reverse: reverseInvoice,
    },
  },
  {
    collection: "proformas",
    url: "/proforma-invoice/all",
    map: mapInvoice,
    write: {
      create: "/proforma-invoice/create",
      update: (id) => `/proforma-invoice/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/proforma-invoice/delete/${id}`,
      reverse: reverseInvoice,
    },
  },
  {
    collection: "salesReceipts",
    url: "/sales-receipt/all",
    map: mapInvoice,
    write: {
      create: "/sales-receipt/create",
      update: (id) => `/sales-receipt/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/sales-receipt/delete/${id}`,
      reverse: reverseInvoice,
    },
  },
  {
    collection: "estimates",
    url: "/estimate/all",
    map: mapInvoice,
    write: {
      create: "/estimate/create",
      update: (id) => `/estimate/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/estimate/delete/${id}`,
      reverse: reverseInvoice,
    },
  },
  {
    collection: "deliveryChallans",
    url: "/delivery-challan/all",
    map: mapInvoice,
    write: {
      create: "/delivery-challan/create",
      update: (id) => `/delivery-challan/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/delivery-challan/delete/${id}`,
      reverse: reverseInvoice,
    },
  },
  {
    collection: "creditNotes",
    url: "/account/credit-notes/all",
    map: mapInvoice,
    write: {
      create: "/account/credit-notes/create",
      update: (id) => `/account/credit-notes/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/account/credit-notes/delete/${id}`,
      reverse: reverseInvoice,
    },
  },
  {
    collection: "vendors",
    url: "/vendor/all",
    map: mapVendorFull,
    write: {
      create: "/vendor/create",
      update: () => "/vendor/update", // id travels in the body (reverseVendor)
      updateMethod: "post",
      remove: (id) => `/vendor/delete/${id}`,
      reverse: reverseVendor,
    },
  },
  {
    collection: "expenses",
    url: "/expenses/all",
    map: mapExpense,
    write: {
      create: "/expenses/create",
      update: (id) => `/expenses/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/expenses/delete/${id}`,
      reverse: reverseExpense,
    },
  },
  {
    collection: "paymentsReceived",
    url: "/payment-received/all",
    map: mapPaymentReceived,
    write: {
      create: "/payment-received/create",
      update: (id) => `/payment-received/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/payment-received/delete/${id}`,
      reverse: reversePaymentReceived,
    },
  },
  // Payment made (vendorPayment): read-only — its create needs bill allocations
  // the simple web row doesn't carry, so writes stay local for now.
  {
    collection: "paymentsMade",
    url: "/account/vendor-payments/all",
    map: mapPaymentMade,
    // Bill-direct payment: /record persists the payment without the strict
    // bill allocation contract (the bill balance is updated
    // separately via the bills spec). No edit endpoint → create-only.
    write: {
      create: "/account/vendor-payments/record",
      remove: (id) => `/account/vendor-payments/delete/${id}`,
      reverse: async (r) => ({
        vendor_id: await backendIdOf("vendors", r.vendorId),
        payment_amount: num(r.amount),
        payment_method: r.method ? [str(r.method)] : undefined,
        payment_date: toIso(r.date) || todayIso(),
        notes: str(r.notes),
      }),
    },
  },
  // Projects: create/update via the combined /project/create-update (members &
  // clients are managed by separate invite endpoints, so core fields are safe).
  {
    collection: "projects",
    url: "/project/all",
    map: mapProject,
    write: {
      create: "/project/create-update",
      update: () => "/project/create-update",
      updateMethod: "post",
      remove: () => "/project/delete",
      removeMethod: "post",
      removeBody: (id) => ({ project_id: id }),
      reverse: async (r) => {
        // Backend requires a non-empty user_ids; resolve member names → ids.
        let userIds: string[] = [];
        let clientIds: string[] = [];
        try {
          const res = await api.raw.get("/project/users");
          const users = toArray<any>(res.data);
          const byName: Record<string, string> = {};
          for (const u of users) byName[str(u.name).trim()] = str(u._id);
          userIds = (r.members ?? []).map((m: any) => byName[str(m).trim()]).filter(Boolean);
          clientIds = (r.clients ?? []).map((c: any) => byName[str(c).trim()]).filter(Boolean);
        } catch { /* leave empty */ }
        return {
          ...(r._id ? { project_id: String(r._id) } : {}),
          name: str(r.name),
          description: str(r.description),
          budget: num(r.budget),
          start_date: toIso(r.startDate) || undefined,
          end_date: toIso(r.endDate) || undefined,
          status: projStatusOut(r.status),
          ...(userIds.length ? { user_ids: userIds } : {}),
          ...(clientIds.length ? { client_ids: clientIds } : {}),
        };
      },
    },
  },
  {
    collection: "timelogs",
    url: "/time-log/all",
    map: mapTimelog,
    write: {
      create: "/time-log/create",
      update: (id) => `/time-log/${id}`,
      updateMethod: "patch",
      remove: (id) => `/time-log/delete/${id}`,
      reverse: reverseTimelog,
    },
  },
  {
    collection: "bills",
    url: "/bill/all",
    map: mapPurchase,
    write: {
      create: "/bill/create",
      update: (id) => `/bill/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/bill/delete/${id}`,
      reverse: reversePurchaseTitle,
    },
  },
  {
    collection: "purchaseOrders",
    url: "/purchase/invoices/all",
    map: mapPurchase,
    write: {
      create: "/purchase/invoices/create",
      update: (id) => `/purchase/invoices/edit/${id}`,
      updateMethod: "patch",
      remove: (id) => `/purchase/invoices/delete/${id}`,
      reverse: reversePurchaseLower,
    },
  },
  {
    collection: "purchaseReturns",
    url: "/purchase/returns/all",
    map: mapPurchase,
    write: {
      create: "/purchase/returns/create",
      update: (id) => `/purchase/returns/edit/${id}`,
      updateMethod: "post",
      remove: (id) => `/purchase/returns/delete/${id}`,
      reverse: reversePurchaseLower,
    },
  },
  {
    collection: "debitNotes",
    url: "/account/debit-notes/all",
    map: mapPurchase,
    write: {
      create: "/account/debit-notes/create",
      update: (id) => `/account/debit-notes/update/${id}`,
      remove: (id) => `/account/debit-notes/delete/${id}`,
      reverse: reversePurchaseTitle,
    },
  },
  {
    collection: "products",
    url: "/product/all",
    map: mapProduct,
    write: {
      create: "/product/create",
      update: (id) => `/product/update/${id}`,
      updateMethod: "patch",
      remove: (id) => `/product/delete/${id}`,
      reverse: reverseProduct,
    },
  },
  {
    collection: "services",
    url: "/service/all",
    map: mapService,
    write: {
      create: "/service/create",
      update: (id) => `/service/${id}`,
      remove: (id) => `/service/${id}`,
      reverse: (r) => ({
        serviceName: str(r.name),
        description: str(r.note),
        rate: num(r.price),
        quantity: num(r.qty ?? 1),
        unitType: str(r.unit),
        sac: false,
        taxes: [],
      }),
    },
  },
  {
    collection: "taxes",
    url: "/tax/all",
    map: mapTax,
    write: {
      create: "/tax/create",
      update: (id) => `/tax/${id}`,
      remove: (id) => `/tax/${id}`,
      reverse: (r) => ({ name: str(r.name), rate: num(r.rate) }),
    },
  },
  {
    collection: "categories",
    url: "/category/all",
    map: mapCategory,
    write: {
      create: "/category/create",
      update: (id) => `/category/${id}`,
      remove: (id) => `/category/${id}`,
      reverse: (r) => ({ category: str(r.name ?? r.category) }),
    },
  },
];

const specByCollection = new Map(SYNC_SPECS.map((s) => [s.collection, s]));

/** Backend spec for a collection, if it is wired. */
export function specFor(name: CollectionName): SyncSpec | undefined {
  return specByCollection.get(name);
}

// ── Read sync ────────────────────────────────────────────────────────────────

const SYNC_HTTP: ApiRequestConfig = {
  skipGlobalLoading: true,
  skipUnauthorized: true,
};

async function fetchAllPaginatedDocs(url: string, pageSize = 1000): Promise<any[]> {
  const out: any[] = [];
  let page = 1;
  for (;;) {
    const res = await api.raw.get(url, { params: { page, limit: pageSize }, ...SYNC_HTTP });
    const body = res.data ?? {};
    const batch = Array.isArray(body.data) ? body.data : toArray<any>(body);
    out.push(...batch);
    const pag = body.pagination;
    const totalPage = Number(pag?.totalPage) || 1;
    if (batch.length === 0 || page >= totalPage) break;
    page += 1;
  }
  return out;
}

async function syncSpec(spec: SyncSpec): Promise<void> {
  try {
    const docs =
      spec.collection === "products"
        ? await fetchAllPaginatedDocs(spec.url)
        : toArray<any>((await api.raw.get(spec.url, { ...SYNC_HTTP })).data);
    const rows = docs.map((d) => {
      const _id = str(d._id ?? d.id);
      return { ...spec.map(d), _id, id: numericId(_id) };
    });
    // Replace in one Dexie transaction so liveQuery never sees an empty table
    // (clear-then-put without a txn flashes blank UI and feels like a page reload).
    const table = (db as any)[spec.collection];
    await db.transaction("rw", table, async () => {
      await table.clear();
      if (rows.length) await table.bulkPut(rows);
    });
  } catch (e) {
    console.warn(`[sync] ${spec.collection} skipped:`, e);
  }
}

/** Re-pull a single collection from the backend (used after a write). */
export async function resync(name: CollectionName): Promise<void> {
  const spec = specByCollection.get(name);
  if (spec && getToken()) await syncSpec(spec);
}

let inFlight: Promise<void> | null = null;

/** Sync every wired collection (one run at a time). No-op without a token. */
export async function syncAll(): Promise<void> {
  if (!getToken()) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    for (const spec of SYNC_SPECS) await syncSpec(spec);
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
