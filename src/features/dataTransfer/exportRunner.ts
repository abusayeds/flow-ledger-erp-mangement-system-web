/**
 * Fetch module records from existing list APIs and build export grids.
 * Frontend-only — no dedicated export backend routes.
 */
import * as XLSX from "xlsx";
import { api } from "@/lib/api/client";
import { exportReportCsv, exportReportXlsx, exportReportPdf, type ExportGrid } from "@/lib/reportExport";
import type { ExportModuleId } from "./modules";
import { exportModuleById } from "./modules";

const text = (v: unknown) =>
  typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

const partyName = (p: unknown) => {
  if (!p || typeof p !== "object") return text(p);
  const o = p as Record<string, unknown>;
  const profile = o.businessProfile as Record<string, unknown> | undefined;
  return (
    text(profile?.companyName) ||
    text(o.name) ||
    text(o.customer_name) ||
    text(o.vendor_name) ||
    ""
  );
};

const addr = (a: unknown, key: string) => {
  if (!a || typeof a !== "object") return "";
  const o = a as Record<string, unknown>;
  const map: Record<string, string> = {
    street1: text(o.street || o.street1 || o.address_line1),
    street2: text(o.street2 || o.address_line2),
    city: text(o.city),
    state: text(o.state),
    zip: text(o.zip || o.postal_code || o.postalCode),
    country: text(o.country),
  };
  return map[key] || "";
};

const firstLine = (doc: any) => {
  const products = Array.isArray(doc?.product) ? doc.product : [];
  const services = Array.isArray(doc?.service) ? doc.service : [];
  return products[0] || services[0] || null;
};

const lineTax = (line: any, i: number) => {
  const taxes = Array.isArray(line?.taxes) ? line.taxes : Array.isArray(line?.tax) ? line.tax : [];
  const t = taxes[i] || null;
  if (!t || typeof t !== "object") return { name: "", rate: "", type: "" };
  return {
    name: text(t.name || t.tax_name),
    rate: text(t.rate ?? t.tax_rate),
    type: text(
      t.type || t.tax_type || (t.inclusive ? "Inclusive" : t.exclusive ? "Exclusive" : ""),
    ),
  };
};

async function fetchAllRaw(path: string, extra: Record<string, unknown> = {}): Promise<any[]> {
  const limit = 100;
  let page = 1;
  const all: any[] = [];
  for (;;) {
    try {
      const res = await api.raw.get(path, { params: { page, limit, ...extra } });
      const body = res.data ?? {};
      const rows: any[] = Array.isArray(body.data) ? body.data : [];
      all.push(...rows);
      const totalPage = Number(body.pagination?.totalPage) || 1;
      if (page >= totalPage || rows.length === 0) break;
      page += 1;
      if (page > 40) break;
    } catch {
      break;
    }
  }
  return all;
}

const PATHS: Partial<Record<ExportModuleId, string>> = {
  contacts: "/customers",
  invoices: "/invoices",
  "sales-receipts": "/sales-receipt/all",
  "proforma-invoices": "/proforma-invoice/all",
  estimates: "/estimate/all",
  "delivery-challans": "/delivery-challan/all",
  "credit-notes": "/account/credit-notes/all",
  "payment-received": "/payment-received/all",
  bills: "/bill/all",
  "debit-notes": "/account/debit-notes/all",
  "payment-made": "/account/vendor-payments/all",
  expenses: "/expenses/all",
  projects: "/project/all",
  services: "/service/all",
  products: "/product/all",
};

async function loadDocs(moduleId: ExportModuleId): Promise<any[]> {
  if (moduleId === "purchase-orders") {
    // No purchase-order list API on this backend yet
    return [];
  }
  if (moduleId === "timelogs") {
    try {
      const res = await api.raw.get("/time-log/all");
      const data = res.data?.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  const path = PATHS[moduleId];
  if (!path) return [];
  return fetchAllRaw(path);
}

const SALES_IDS = new Set<ExportModuleId>([
  "invoices",
  "sales-receipts",
  "proforma-invoices",
  "estimates",
  "delivery-challans",
  "credit-notes",
]);

const PURCHASE_IDS = new Set<ExportModuleId>(["bills", "debit-notes", "purchase-orders"]);

function salesCell(doc: any, key: string): string {
  const billing = doc?.billing_address || doc?.billingAddress;
  const shipping = doc?.shipping_address || doc?.shippingAddress;
  const customer = doc.customer_id || doc.customer;
  const line = firstLine(doc);
  const t1 = lineTax(line, 0);
  const t2 = lineTax(line, 1);
  const t3 = lineTax(line, 2);
  const map: Record<string, string> = {
    date: text(doc.date || doc.createdAt).slice(0, 10),
    number: text(doc.invoice_number || doc.estimate_number || doc.number || doc.challan_number),
    customerName: partyName(customer) || text(doc.customer_name),
    discountRate: text(doc.discount_rate ?? doc.discount),
    applyDiscountBeforeTax: text(doc.apply_discount_before_tax),
    taxId: text(typeof customer === "object" ? (customer as any)?.businessProfile?.taxId : ""),
    email: text(typeof customer === "object" ? (customer as any)?.email : doc.email),
    mobile: text(typeof customer === "object" ? (customer as any)?.mobile : doc.mobile),
    shippingCost: text(doc.shipping_cost),
    shippingMethod: text(doc.shipping_method),
    roundOff: text(doc.round_off),
    notes: text(doc.notes),
    termsConditions: text(doc.terms_and_conditions),
    subTitle: text(doc.sub_title),
    currency: text(doc.currency),
    billingStreet1: addr(billing, "street1"),
    billingStreet2: addr(billing, "street2"),
    billingCity: addr(billing, "city"),
    billingState: addr(billing, "state"),
    billingCountry: addr(billing, "country"),
    billingZip: addr(billing, "zip"),
    shippingStreet1: addr(shipping, "street1"),
    shippingStreet2: addr(shipping, "street2"),
    shippingCity: addr(shipping, "city"),
    shippingState: addr(shipping, "state"),
    shippingCountry: addr(shipping, "country"),
    itemQuantity: text(line?.quantity),
    itemUnitType: text(line?.unit_type || line?.unitType),
    itemPrice: text(line?.rate ?? line?.price),
    itemCode: text(line?.sku || line?.item_code || line?.code),
    itemDiscount: text(line?.discount),
    itemTax1Name: t1.name,
    itemTax1Rate: t1.rate,
    itemTax1Type: t1.type,
    itemTax2Name: t2.name,
    itemTax2Rate: t2.rate,
    itemTax2Type: t2.type,
    itemTax3Name: t3.name,
    itemTax3Rate: t3.rate,
    itemTax3Type: t3.type,
    subTotal: text(doc.sub_total),
    tax: text(doc.tax),
    total: text(doc.total),
    status: text(doc.status),
  };
  return map[key] ?? "";
}

function purchaseCell(doc: any, key: string): string {
  const vendor = doc.vendor_id || doc.vendor;
  const line = firstLine(doc);
  const map: Record<string, string> = {
    date: text(doc.date || doc.createdAt).slice(0, 10),
    number: text(doc.bill_number || doc.invoice_number || doc.number || doc.po_number),
    vendorName: partyName(vendor) || text(doc.vendor_name),
    currency: text(doc.currency),
    subTotal: text(doc.sub_total),
    tax: text(doc.tax),
    total: text(doc.total),
    status: text(doc.status),
    notes: text(doc.notes),
    itemQuantity: text(line?.quantity),
    itemPrice: text(line?.rate ?? line?.price),
    itemDiscount: text(line?.discount),
  };
  return map[key] ?? "";
}

function cell(moduleId: ExportModuleId, doc: any, key: string): string {
  if (moduleId === "contacts") {
    const billing = doc?.billing_address || doc?.billingAddress || doc?.businessProfile?.billingAddress;
    const shipping =
      doc?.shipping_address || doc?.shippingAddress || doc?.businessProfile?.shippingAddress;
    const profile = doc?.businessProfile || {};
    const nameParts = text(doc.name).split(/\s+/);
    const map: Record<string, string> = {
      companyName: text(profile.companyName) || text(doc.name),
      firstName: text(profile.firstName) || nameParts[0] || "",
      lastName: text(profile.lastName) || nameParts.slice(1).join(" "),
      taxId: text(profile.taxId || profile.tax_id || doc.tax_id),
      regNo: text(profile.regNo || profile.reg_no || doc.reg_no),
      email: text(doc.email || profile.email),
      mobile: text(doc.mobile || doc.phone || profile.mobile),
      billingStreet1: addr(billing, "street1"),
      billingStreet2: addr(billing, "street2"),
      billingCity: addr(billing, "city"),
      billingZip: addr(billing, "zip"),
      billingState: addr(billing, "state"),
      billingCountry: addr(billing, "country"),
      shippingStreet1: addr(shipping, "street1"),
      shippingStreet2: addr(shipping, "street2"),
      shippingCity: addr(shipping, "city"),
      shippingZip: addr(shipping, "zip"),
      shippingState: addr(shipping, "state"),
      shippingCountry: addr(shipping, "country"),
      businessPhone: text(profile.businessPhone || profile.business_phone || doc.business_phone),
      homePhone: text(profile.homePhone || doc.home_phone),
      fax: text(profile.fax || doc.fax),
      notes: text(doc.notes || profile.notes),
      hourlyRate: text(profile.hourlyRate ?? doc.hourly_rate),
      openingBalance: text(profile.opening_balance ?? doc.opening_balance),
      openingBalanceDate: text(profile.opening_balance_date ?? doc.opening_balance_date),
      outstanding: text(doc.outstanding ?? profile.outstanding),
      payableAmount: text(doc.payable_amount ?? profile.payable_amount),
      sales: text(doc.sales),
      paymentReceived: text(doc.payment_received),
      estimates: text(doc.estimates),
      overdue: text(doc.overdue),
      creditNotes: text(doc.credit_notes),
      bills: text(doc.bills),
      purchaseOrders: text(doc.purchase_orders),
      paymentMade: text(doc.payment_made),
      debitNotes: text(doc.debit_notes),
    };
    return map[key] ?? "";
  }

  if (SALES_IDS.has(moduleId)) return salesCell(doc, key);
  if (PURCHASE_IDS.has(moduleId)) return purchaseCell(doc, key);

  if (moduleId === "payment-received" || moduleId === "payment-made") {
    const party = doc.customer_id || doc.vendor_id || doc.customer || doc.vendor;
    const map: Record<string, string> = {
      date: text(doc.date || doc.payment_date || doc.createdAt).slice(0, 10),
      number: text(doc.payment_number || doc.number || doc.reference),
      partyName: partyName(party) || text(doc.customer_name || doc.vendor_name),
      amount: text(doc.amount || doc.total || doc.payment_amount),
      currency: text(doc.currency),
      paymentMethod: text(
        Array.isArray(doc.payment_method)
          ? doc.payment_method.join(", ")
          : doc.payment_method || doc.method,
      ),
      notes: text(doc.notes),
      status: text(doc.status),
    };
    return map[key] ?? "";
  }

  if (moduleId === "expenses") {
    const map: Record<string, string> = {
      date: text(doc.date || doc.createdAt).slice(0, 10),
      category: text(
        typeof doc.category === "object"
          ? doc.category?.category_name || doc.category?.name
          : doc.category || doc.category_name,
      ),
      amount: text(doc.amount || doc.total),
      currency: text(doc.currency),
      vendorName: partyName(doc.vendor_id || doc.vendor) || text(doc.vendor_name),
      notes: text(doc.notes || doc.description),
      status: text(doc.status),
    };
    return map[key] ?? "";
  }

  if (moduleId === "projects") {
    const map: Record<string, string> = {
      name: text(doc.name || doc.projectName || doc.project_name),
      customerName: partyName(doc.customer_id || doc.customer) || text(doc.customer_name),
      status: text(doc.status),
      startDate: text(doc.start_date || doc.startDate).slice(0, 10),
      endDate: text(doc.end_date || doc.endDate).slice(0, 10),
      notes: text(doc.notes || doc.description),
    };
    return map[key] ?? "";
  }

  if (moduleId === "services") {
    const taxes = Array.isArray(doc.taxes) ? doc.taxes : [];
    const map: Record<string, string> = {
      serviceName: text(doc.serviceName || doc.name),
      quantity: text(doc.quantity ?? 1),
      rate: text(doc.rate),
      unitType: text(doc.unitType || doc.unit_type),
      taxable: taxes.length || doc.taxable ? "Yes" : "No",
      notes: text(doc.description || doc.notes),
      sac: text(doc.sac) || (doc.sac === true ? "Yes" : ""),
    };
    return map[key] ?? "";
  }

  if (moduleId === "products") {
    const cat = doc.category;
    const catName = cat && typeof cat === "object" ? text(cat.category || cat.name) : text(cat);
    const stock = doc.stock;
    const map: Record<string, string> = {
      parentSku: text(doc.parentSku || doc.parent_sku),
      sku: text(doc.sku),
      productName: text(doc.productName || doc.name),
      attribute1: text(doc.attribute1 || doc.attributes?.[0]),
      attribute2: text(doc.attribute2 || doc.attributes?.[1]),
      attribute3: text(doc.attribute3 || doc.attributes?.[2]),
      buyPrice: text(doc?.pricing?.buyPrice ?? doc.buyPrice),
      sellPrice: text(doc?.pricing?.sellPrice ?? doc.sellPrice),
      mrp: text(doc?.pricing?.mrp ?? doc.mrp),
      category: catName,
      quantity: text(doc.quantity),
      unit: text(doc.unitType || doc.unit),
      quantity2: text(doc.quantity2),
      unitType2: text(doc.unitType2),
      quantity3: text(doc.quantity3),
      unitType3: text(doc.unitType3),
      stock: text(stock?.onHandStock ?? doc.stock),
      isTaxable: text(
        doc.isTaxable ?? (Array.isArray(doc.taxes) && doc.taxes.length ? "Yes" : "No"),
      ),
      notes: text(doc.description || doc.notes),
      showOnMenu: text(doc.showOnMenu ?? doc.show_on_menu),
      hsn: text(doc.hsn),
    };
    return map[key] ?? "";
  }

  if (moduleId === "timelogs") {
    const project = doc.project_id || doc.project;
    const service = doc.service_id || doc.service;
    const map: Record<string, string> = {
      date: text(doc.date || doc.createdAt).slice(0, 10),
      projectName:
        project && typeof project === "object"
          ? text((project as any).name || (project as any).projectName)
          : text(doc.project_name),
      serviceName:
        service && typeof service === "object"
          ? text((service as any).serviceName || (service as any).name)
          : text(doc.service_name),
      hours: text(doc.hours ?? doc.duration ?? doc.total_hours),
      createdInvoice: text(doc.invoice_id || doc.created_invoice || doc.is_invoiced),
      notes: text(doc.notes || doc.description),
    };
    return map[key] ?? "";
  }

  return "";
}

export async function buildExportGrid(
  moduleId: ExportModuleId,
  selectedKeys: string[],
): Promise<ExportGrid> {
  const mod = exportModuleById(moduleId);
  const keys = selectedKeys.length ? selectedKeys : mod.fields.map((f) => f.key);
  const labelByKey = Object.fromEntries(mod.fields.map((f) => [f.key, f.label]));
  const cols = keys.map((k) => labelByKey[k] || k);
  const docs = await loadDocs(moduleId);
  const rows = docs.map((doc) => keys.map((k) => cell(moduleId, doc, k)));
  return { name: mod.title, cols, rows };
}

export type ExportDownloadFormat = "pdf" | "csv" | "xlsx" | "xls" | "excel";

export async function runExportDownload(
  moduleId: ExportModuleId,
  selectedKeys: string[],
  format: ExportDownloadFormat,
): Promise<number> {
  const grid = await buildExportGrid(moduleId, selectedKeys);
  if (format === "csv") exportReportCsv(grid);
  else if (format === "pdf") await exportReportPdf(grid);
  else if (format === "xls") exportReportXlsx(grid, "xls");
  else exportReportXlsx(grid, "xlsx"); // xlsx + excel
  return grid.rows.length;
}

export function downloadImportTemplate(headers: string[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function parseImportFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        }) as string[][];
        const headers = (matrix[0] || []).map((h) => String(h ?? "").trim());
        const rows = matrix
          .slice(1)
          .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
          .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
