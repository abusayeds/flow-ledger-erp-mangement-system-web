/**
 * File: src/lib/db/appSettings.ts
 * App Settings persistence — backend `/setting/app` is source of truth,
 * Dexie `meta` is a local cache for liveQuery (Sidebar modules, etc.).
 */

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { api } from "@/lib/api/client";
import {
  UI_SECTION_TO_API,
  apiDocToUiSections,
  fetchAppSettingDocument,
  invalidateAppSettingsCache,
  patchAppSetting,
  resetAppSettingType,
  uiSectionToApiPayload,
} from "@/services/appSettingsApi";

/* ── per-document settings (identical shape for all 9 doc types) ── */
export interface DocSettings {
  fieldVisibility: Record<string, boolean>;
  general: {
    lineOption: "Both" | "Service" | "Product";
    createPublicUrlInEmail: boolean;
    /** Purchase Order — additive; missing → treated as on in UI when layout shows it. */
    trackPurchaseOrdersInStock?: boolean;
  };
  columns: Record<string, boolean>;
  columnsQuantity: "Show for Both" | "Show for Product" | "Show for Service";
  summary: Record<string, boolean>;
  summarySubtotalWithTax: "Default" | "Including Tax" | "Excluding Tax";
  printEmail: Record<string, boolean>;
  printCopies: "Single Copy" | "Two Copies" | "Three Copies";
  /** Invoice Payment section (UI + local; additive API when supported). */
  payment: Record<string, boolean>;
}

/** Invoice App Settings → Field Visibility keys (exact UI labels). */
export const INVOICE_FIELD_KEYS = [
  "Due Date",
  "Shipping Address",
  "Internal Notes",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "PO #",
  "P.O. Date",
  "Recipient name",
  "Shipping Cost And Method",
  "Shipping Tax",
  "Salesperson",
  "Payment Methods",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const INVOICE_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Buy Price in Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const INVOICE_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const INVOICE_PRINT_KEYS = [
  "Mark as Sent on Print",
  "Mark as Sent on Email/WhatsApp",
  "Combine PDF in Email",
] as const;

export const INVOICE_PAYMENT_KEYS = ["Cash Received Denomination"] as const;

/** Proforma Invoice App Settings keys (exact UI labels — subset of Invoice). */
export const PROFORMA_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Shipping Cost And Method",
  "Shipping Tax",
  "Salesperson",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const PROFORMA_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const PROFORMA_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const PROFORMA_PRINT_KEYS = [
  "Mark as Sent on Print",
  "Mark as Sent on Email/WhatsApp",
  "Combine PDF in Email",
] as const;

/** Sales Receipt */
export const SALES_RECEIPT_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Shipping Cost And Method",
  "Shipping Tax",
  "Salesperson",
  "Payment Type",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const SALES_RECEIPT_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Buy Price in Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const SALES_RECEIPT_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const SALES_RECEIPT_PRINT_KEYS = [
  "Combine PDF in Email",
] as const;

/** Estimate */
export const ESTIMATE_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Shipping Cost And Method",
  "Shipping Tax",
  "Salesperson",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const ESTIMATE_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const ESTIMATE_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const ESTIMATE_PRINT_KEYS = [
  "Mark as Sent on Print",
  "Mark as Sent on Email/WhatsApp",
  "Combine PDF in Email",
] as const;

/** Delivery Challan — no Quantity column option */
export const DELIVERY_CHALLAN_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Salesperson",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const DELIVERY_CHALLAN_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Buy Price in Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const DELIVERY_CHALLAN_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const DELIVERY_CHALLAN_PRINT_KEYS = [
  "Combine PDF in Email",
] as const;

/** Credit Note */
export const CREDIT_NOTE_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Salesperson",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const CREDIT_NOTE_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const CREDIT_NOTE_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const CREDIT_NOTE_PRINT_KEYS = [
  "Combine PDF in Email",
] as const;

/** Purchase Order App Settings keys (exact UI labels). */
export const PURCHASE_ORDER_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Shipping Cost And Method",
  "Shipping Tax",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const PURCHASE_ORDER_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Sell Price in Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const PURCHASE_ORDER_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const PURCHASE_ORDER_PRINT_KEYS = [
  "Mark as Sent on Print",
  "Mark as Sent on Email/WhatsApp",
  "Combine PDF in Email",
] as const;

/** Bill App Settings keys (exact UI labels). */
export const BILL_FIELD_KEYS = [
  "Due Date",
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "PO #",
  "P.O. Date",
  "Recipient name",
  "Shipping Cost And Method",
  "Shipping Tax",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const BILL_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Sell Price in Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const BILL_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const BILL_PRINT_KEYS = [
  "Mark as Sent on Print",
  "Mark as Sent on Email/WhatsApp",
  "Combine PDF in Email",
] as const;

/** Debit Note App Settings keys (exact UI labels). */
export const DEBIT_NOTE_FIELD_KEYS = [
  "Shipping Address",
  "Street 1",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Sub Title",
  "Recipient name",
  "Apply discount before tax",
  "Terms & Conditions",
  "Notes",
  "Attachment",
] as const;

export const DEBIT_NOTE_COLUMN_KEYS = [
  "Service Name",
  "Product Name",
  "Description",
  "Discount",
  "MRP",
  "Tax",
  "Line description full width",
  "Stock In Suggestion List",
  "Description In Suggestion List",
  "Item Code in Suggestion List",
  "Auto Fit",
] as const;

export const DEBIT_NOTE_SUMMARY_KEYS = [
  "Total Quantity",
  "Round Off",
  "Negative Value format with ( )",
  "Contact Note as Default Note",
  "Custom Charges",
  "Inline Discount",
  "Show Line Total with Tax",
] as const;

export const DEBIT_NOTE_PRINT_KEYS = [] as const;

export type DocLayoutId =
  | "invoice"
  | "proformaInvoice"
  | "salesReceipt"
  | "estimate"
  | "deliveryChallan"
  | "creditNote"
  | "purchaseOrder"
  | "bill"
  | "debitNote";

export type DocLayoutConfig = {
  fieldKeys: readonly string[];
  columnKeys: readonly string[];
  summaryKeys: readonly string[];
  printKeys: readonly string[];
  showQuantitySelect: boolean;
  showPublicUrl: boolean;
  showPayment: boolean;
  /** Purchase Order only — Track Purchase Orders in Stock toggle. */
  showTrackPurchaseOrdersInStock?: boolean;
};

export const DOC_LAYOUTS: Record<DocLayoutId, DocLayoutConfig> = {
  invoice: {
    fieldKeys: INVOICE_FIELD_KEYS,
    columnKeys: INVOICE_COLUMN_KEYS,
    summaryKeys: INVOICE_SUMMARY_KEYS,
    printKeys: INVOICE_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: true,
    showPayment: true,
  },
  proformaInvoice: {
    fieldKeys: PROFORMA_FIELD_KEYS,
    columnKeys: PROFORMA_COLUMN_KEYS,
    summaryKeys: PROFORMA_SUMMARY_KEYS,
    printKeys: PROFORMA_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: false,
    showPayment: false,
  },
  salesReceipt: {
    fieldKeys: SALES_RECEIPT_FIELD_KEYS,
    columnKeys: SALES_RECEIPT_COLUMN_KEYS,
    summaryKeys: SALES_RECEIPT_SUMMARY_KEYS,
    printKeys: SALES_RECEIPT_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: false,
    showPayment: false,
  },
  estimate: {
    fieldKeys: ESTIMATE_FIELD_KEYS,
    columnKeys: ESTIMATE_COLUMN_KEYS,
    summaryKeys: ESTIMATE_SUMMARY_KEYS,
    printKeys: ESTIMATE_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: false,
    showPayment: false,
  },
  deliveryChallan: {
    fieldKeys: DELIVERY_CHALLAN_FIELD_KEYS,
    columnKeys: DELIVERY_CHALLAN_COLUMN_KEYS,
    summaryKeys: DELIVERY_CHALLAN_SUMMARY_KEYS,
    printKeys: DELIVERY_CHALLAN_PRINT_KEYS,
    showQuantitySelect: false,
    showPublicUrl: false,
    showPayment: false,
  },
  creditNote: {
    fieldKeys: CREDIT_NOTE_FIELD_KEYS,
    columnKeys: CREDIT_NOTE_COLUMN_KEYS,
    summaryKeys: CREDIT_NOTE_SUMMARY_KEYS,
    printKeys: CREDIT_NOTE_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: false,
    showPayment: false,
  },
  purchaseOrder: {
    fieldKeys: PURCHASE_ORDER_FIELD_KEYS,
    columnKeys: PURCHASE_ORDER_COLUMN_KEYS,
    summaryKeys: PURCHASE_ORDER_SUMMARY_KEYS,
    printKeys: PURCHASE_ORDER_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: true,
    showPayment: false,
    showTrackPurchaseOrdersInStock: true,
  },
  bill: {
    fieldKeys: BILL_FIELD_KEYS,
    columnKeys: BILL_COLUMN_KEYS,
    summaryKeys: BILL_SUMMARY_KEYS,
    printKeys: BILL_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: true,
    showPayment: false,
  },
  debitNote: {
    fieldKeys: DEBIT_NOTE_FIELD_KEYS,
    columnKeys: DEBIT_NOTE_COLUMN_KEYS,
    summaryKeys: DEBIT_NOTE_SUMMARY_KEYS,
    printKeys: DEBIT_NOTE_PRINT_KEYS,
    showQuantitySelect: true,
    showPublicUrl: false,
    showPayment: false,
  },
};

export function buildRestrictedDocDefaults(layout: DocLayoutConfig): DocSettings {
  const fieldVisibility: Record<string, boolean> = {
    ...Object.fromEntries(INVOICE_FIELD_KEYS.map((k) => [k, false])),
    "Payment Type": false,
    ...Object.fromEntries(layout.fieldKeys.map((k) => [k, true])),
  };
  if ("Recipient name" in fieldVisibility) fieldVisibility["Recipient name"] = false;
  if ("Salesperson" in fieldVisibility) fieldVisibility.Salesperson = false;
  if ("Apply discount before tax" in fieldVisibility) fieldVisibility["Apply discount before tax"] = false;

  const columns: Record<string, boolean> = {
    ...Object.fromEntries(INVOICE_COLUMN_KEYS.map((k) => [k, false])),
    ...Object.fromEntries(layout.columnKeys.map((k) => [k, true])),
  };
  if ("Stock In Suggestion List" in columns) columns["Stock In Suggestion List"] = false;
  if ("Description In Suggestion List" in columns) columns["Description In Suggestion List"] = false;
  if ("Sell Price in Suggestion List" in columns) columns["Sell Price in Suggestion List"] = false;

  const summary: Record<string, boolean> = {
    "Total Quantity": false,
    "Round Off": false,
    "Negative Value format with ( )": false,
    "Contact Note as Default Note": false,
    "Custom Charges": false,
    "Inline Discount": true,
    "Show Line Total with Tax": false,
  };
  for (const k of layout.summaryKeys) {
    if (!(k in summary)) summary[k] = true;
  }

  const printEmail: Record<string, boolean> = {
    "Mark as Sent on Print": false,
    "Mark as Sent on Email/WhatsApp": false,
    "Combine PDF in Email": false,
    ...Object.fromEntries(layout.printKeys.map((k) => [k, true])),
  };

  return {
    fieldVisibility,
    general: {
      lineOption: "Both",
      createPublicUrlInEmail: layout.showPublicUrl,
      ...(layout.showTrackPurchaseOrdersInStock
        ? { trackPurchaseOrdersInStock: true }
        : {}),
    },
    columns,
    columnsQuantity: "Show for Both",
    summary,
    summarySubtotalWithTax: "Default",
    printEmail,
    printCopies: "Single Copy",
    payment: { "Cash Received Denomination": false },
  };
}

export const DOC_DEFAULTS: DocSettings = {
  fieldVisibility: {
    ...Object.fromEntries(INVOICE_FIELD_KEYS.map((k) => [k, true])),
    "Recipient name": false,
    Salesperson: false,
    "Apply discount before tax": false,
  },
  general: { lineOption: "Both", createPublicUrlInEmail: true },
  columns: {
    ...Object.fromEntries(INVOICE_COLUMN_KEYS.map((k) => [k, true])),
    "Stock In Suggestion List": false,
    "Description In Suggestion List": false,
  },
  columnsQuantity: "Show for Both",
  summary: {
    "Total Quantity": false,
    "Round Off": false,
    "Negative Value format with ( )": false,
    "Contact Note as Default Note": false,
    "Custom Charges": false,
    "Inline Discount": true,
    "Show Line Total with Tax": false,
  },
  summarySubtotalWithTax: "Default",
  printEmail: {
    "Mark as Sent on Print": true,
    "Mark as Sent on Email/WhatsApp": true,
    "Combine PDF in Email": true,
  },
  printCopies: "Single Copy",
  payment: { "Cash Received Denomination": false },
};

export const PROFORMA_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.proformaInvoice);
export const SALES_RECEIPT_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.salesReceipt);
export const ESTIMATE_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.estimate);
export const DELIVERY_CHALLAN_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.deliveryChallan);
export const CREDIT_NOTE_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.creditNote);
export const PURCHASE_ORDER_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.purchaseOrder);
export const BILL_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.bill);
export const DEBIT_NOTE_DOC_DEFAULTS = buildRestrictedDocDefaults(DOC_LAYOUTS.debitNote);

/* ── Order (POS) App Settings — distinct from DocSettings ───────── */
export const ORDER_GENERAL_KEYS = [
  "Apply discount before tax",
  "Create Public URL in Email",
  "Shipping Address",
] as const;

export const ORDER_COLUMN_KEYS = [
  "Total Quantity",
  "Line description full width",
  "Tax",
  "Discount",
] as const;

export const ORDER_SUMMARY_KEYS = [
  "Inline Discount",
  "Show Line Total with Tax",
  "Negative Value format with ( )",
  "Round Off",
] as const;

export const ORDER_PRINT_KEYS = [] as const;

export const ORDER_CHECKOUT_KEYS = ["Keep Amount Editable"] as const;

export const ORDER_PAYMENT_KEYS = ["Cash Received Denomination"] as const;

export interface OrderSettings {
  general: Record<string, boolean>;
  columns: Record<string, boolean>;
  summary: Record<string, boolean>;
  summarySubtotalWithTax: "Default" | "Including Tax" | "Excluding Tax";
  printEmail: {
    defaultPrint: "KOT" | "Receipt" | "Both";
    deliveryDate: "Show" | "Hide";
  };
  printCopies: "Single Copy" | "Two Copies" | "Three Copies";
  checkout: {
    keepAmountEditable: boolean;
    defaultOrderType: "Manual Select" | "Dine In" | "Takeaway" | "Delivery";
  };
  payment: Record<string, boolean>;
}

export const ORDER_DEFAULTS: OrderSettings = {
  general: {
    "Apply discount before tax": false,
    "Create Public URL in Email": true,
    "Shipping Address": true,
  },
  columns: Object.fromEntries(ORDER_COLUMN_KEYS.map((k) => [k, true])),
  summary: {
    "Inline Discount": true,
    "Show Line Total with Tax": false,
    "Negative Value format with ( )": false,
    "Round Off": false,
  },
  summarySubtotalWithTax: "Default",
  printEmail: {
    defaultPrint: "KOT",
    deliveryDate: "Show",
  },
  printCopies: "Single Copy",
  checkout: {
    keepAmountEditable: true,
    defaultOrderType: "Manual Select",
  },
  payment: { "Cash Received Denomination": false },
};

/** true → show / on; false → off. Missing key → on (safe; never breaks POS). */
export function isOrderSettingOn(
  map: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  if (!map || !(key in map)) return true;
  return map[key] !== false;
}

/** true → show; false → hide. Missing key → visible (safe; never breaks the form). */
export function isDocSettingOn(
  map: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  if (!map || !(key in map)) return true;
  return map[key] !== false;
}

/** If `allowed` is set, keys outside the list never show. */
export function isLayoutSettingOn(
  allowed: readonly string[] | null | undefined,
  map: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  if (allowed && !(allowed as readonly string[]).includes(key)) return false;
  return isDocSettingOn(map, key);
}

export function isProformaFieldVisible(
  fieldVisibility: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  return isLayoutSettingOn(PROFORMA_FIELD_KEYS, fieldVisibility, key);
}

export function isProformaColumnOn(
  columns: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  return isLayoutSettingOn(PROFORMA_COLUMN_KEYS, columns, key);
}

export function isProformaSummaryOn(
  summary: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  return isLayoutSettingOn(PROFORMA_SUMMARY_KEYS, summary, key);
}

export const COLLECTION_TO_DOC_LAYOUT: Partial<Record<string, DocLayoutId>> = {
  invoices: "invoice",
  proformas: "proformaInvoice",
  salesReceipts: "salesReceipt",
  estimates: "estimate",
  deliveryChallans: "deliveryChallan",
  creditNotes: "creditNote",
  purchaseOrders: "purchaseOrder",
  bills: "bill",
  debitNotes: "debitNote",
};

export const TAB_TO_DOC_LAYOUT: Record<string, DocLayoutId> = {
  Invoice: "invoice",
  "Proforma Invoice": "proformaInvoice",
  "Sales Receipt": "salesReceipt",
  Estimate: "estimate",
  "Delivery Challan": "deliveryChallan",
  "Credit Note": "creditNote",
  "Purchase Order": "purchaseOrder",
  Bill: "bill",
  "Debit Note": "debitNote",
};

/* ── document tab registry (label ↔ storage key) ───────────────── */
export const DOC_TYPES = [
  { key: "invoice", label: "Invoice" },
  { key: "proformaInvoice", label: "Proforma Invoice" },
  { key: "salesReceipt", label: "Sales Receipt" },
  { key: "estimate", label: "Estimate" },
  { key: "deliveryChallan", label: "Delivery Challan" },
  { key: "creditNote", label: "Credit Note" },
  { key: "order", label: "Order" },
  { key: "purchaseOrder", label: "Purchase Order" },
  { key: "bill", label: "Bill" },
  { key: "debitNote", label: "Debit Note" },
] as const;

/* ── non-document sections ─────────────────────────────────────── */
// POS intentionally omitted from the modules list (per reference instruction).
export const MODULE_NAMES = [
  "Invoice", "Proforma Invoice", "Estimate", "Delivery Challan", "Bill", "Credit Note",
  "Debit Note", "Expense", "Sales Receipt", "Packing Slip", "Delivery Note", "Time Log",
  "Purchase Order", "Order", "Project", "Team", "Payment Received", "Payment Made",
  "Banking", "Rewards", "Product", "Service", "Report", "My Documents",
  "Customer", "Vendor",
] as const;

/** Customer App Settings → Field Visibility keys (exact UI labels). */
export const CUSTOMER_FIELD_KEYS = [
  "Reg. No",
  "GSTIN / VAT Number",
  "Taxpayer Type",
  "Business Phone",
  "Fax",
  "Last Name",
  "Email",
  "Mobile",
  "Home Phone",
  "Birthday",
  "Anniversary",
  "Street 2",
  "Zip Code",
  "City",
  "State",
  "Country",
  "Entire Shipping Address",
  "Bank Details",
  "Currency",
  "Default Taxes (Services)",
  "Default Taxes (Product)",
  "Hourly Rate",
  "Payment Terms (Sales)",
  "Opening Balance",
  "Opening Balance Date",
  "Notes",
  "Payment Reminder",
] as const;

export type CustomerFieldKey = (typeof CUSTOMER_FIELD_KEYS)[number];

/** Default all visible — missing key also treated as visible so the app never hides unexpectedly. */
export const CUSTOMER_FIELD_DEFAULTS: Record<CustomerFieldKey, boolean> = Object.fromEntries(
  CUSTOMER_FIELD_KEYS.map((k) => [k, true]),
) as Record<CustomerFieldKey, boolean>;

/** Vendor Field Visibility — same keys as Customer. */
export const VENDOR_FIELD_KEYS = CUSTOMER_FIELD_KEYS;
export type VendorFieldKey = CustomerFieldKey;
export const VENDOR_FIELD_DEFAULTS: Record<VendorFieldKey, boolean> = { ...CUSTOMER_FIELD_DEFAULTS };

/** true → show field; false → hide. Unknown/missing keys default to visible (safe). */
export function isCustomerFieldVisible(
  fieldVisibility: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  if (!fieldVisibility || !(key in fieldVisibility)) return true;
  return fieldVisibility[key] !== false;
}

/** Same safe behavior as customer field visibility. */
export const isVendorFieldVisible = isCustomerFieldVisible;

/** Product field visibility — missing key → visible (safe). */
export function isProductFieldVisible(
  fieldVisibility: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  if (!fieldVisibility || !(key in fieldVisibility)) return true;
  return fieldVisibility[key] !== false;
}

export function isExpenseSettingOn(
  value: boolean | undefined | null,
  fallback = true,
): boolean {
  if (value === undefined || value === null) return fallback;
  return value !== false;
}

export function isTimeLogColumnOn(
  columns: Record<string, boolean> | undefined | null,
  key: string,
): boolean {
  if (!columns || !(key in columns)) return true;
  return columns[key] !== false;
}

export const SECTION_DEFAULTS: Record<string, any> = {
  general: { chat: true, publicUrl: true, appearance: "Dark", defaultMail: "Qayd Mail Server" },
  modules: Object.fromEntries(MODULE_NAMES.map((m) => [m, true])),
  currencyFormat: {
    currency: "$ USD",
    currencySymbol: true,
    currencyCode: true,
    multiCurrency: false,
    decimalPlaces: "2",
    dateFormat: "English (United States)",
    language: "English",
    timezone: "(GMT-7:00) America/Los_Angeles",
  },
  printer: { printMode: "Normal" },
  whatsapp: { whatsapp: true, sendVia: "Qayd", terms: true, notes: true },
  customer: { fieldVisibility: { ...CUSTOMER_FIELD_DEFAULTS } },
  vendor: { fieldVisibility: { ...VENDOR_FIELD_DEFAULTS } },
  expense: { roundOff: false, paymentType: true },
  product: {
    fieldVisibility: { HSN: true, Inventory: true, MRP: false },
    productImage: false,
    zeroStock: "Yes, Allow",
    productStock: true,
    outOfStockOnlineStore: "Hide",
    checkout: {
      productPriceOnCheckout: true,
      productImageSize: "Medium",
    },
  },
  service: { sac: true },
  timeLog: {
    columns: {
      "Include Project in Create Invoice": true,
      "Include Date in Create Invoice": true,
      "Include Notes in Create Invoice": true,
    },
    rounding: "0 mins",
  },
};
for (const d of DOC_TYPES) SECTION_DEFAULTS[`doc:${d.key}`] = DOC_DEFAULTS;
SECTION_DEFAULTS["doc:proformaInvoice"] = PROFORMA_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:salesReceipt"] = SALES_RECEIPT_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:estimate"] = ESTIMATE_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:deliveryChallan"] = DELIVERY_CHALLAN_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:creditNote"] = CREDIT_NOTE_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:order"] = ORDER_DEFAULTS;
SECTION_DEFAULTS["doc:purchaseOrder"] = PURCHASE_ORDER_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:bill"] = BILL_DOC_DEFAULTS;
SECTION_DEFAULTS["doc:debitNote"] = DEBIT_NOTE_DOC_DEFAULTS;

/* ── exchange rates (base: US Dollar = 1) ──────────────────────── */
export interface ExchangeRate { name: string; symbol: string; code: string; rate: number }
export const DEFAULT_EXCHANGE_RATES: ExchangeRate[] = [
  { name: "Albanian Lek", symbol: "ALL", code: "ALL", rate: 92.65 },
  { name: "Arubaanse gulden", symbol: "Afl.", code: "AWG", rate: 1.79 },
  { name: "Australian Dollar", symbol: "$", code: "AUD", rate: 1.52 },
  { name: "Azərbaycan Manatı", symbol: "₼", code: "AZN", rate: 1.7 },
  { name: "Bahamian Dollar", symbol: "$", code: "BSD", rate: 1.0 },
  { name: "balboa panameño", symbol: "B/.", code: "PAB", rate: 1.0 },
  { name: "Bangladeshi Taka", symbol: "৳", code: "BDT", rate: 122.53 },
  { name: "Barbadian Dollar", symbol: "$", code: "BBD", rate: 2.0 },
  { name: "British Pound", symbol: "£", code: "GBP", rate: 0.79 },
  { name: "Euro", symbol: "€", code: "EUR", rate: 0.92 },
  { name: "Indian Rupee", symbol: "₹", code: "INR", rate: 85.6 },
  { name: "Japanese Yen", symbol: "¥", code: "JPY", rate: 155.8 },
];

/* ── read / write (backend + Dexie cache) ───────────────────────── */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const metaKey = (section: string) => `app:${section}`;

async function cacheSection(section: string, value: any): Promise<void> {
  try {
    await db.meta.put({ key: metaKey(section), value });
  } catch {
    /* Dexie unavailable */
  }
}

async function readLocal(section: string): Promise<any> {
  try {
    const row = await db.meta.get(metaKey(section));
    return mergeSection(section, row?.value);
  } catch {
    return clone(SECTION_DEFAULTS[section] ?? {});
  }
}

function mergeSection(section: string, value: any): any {
  const defaults = clone(SECTION_DEFAULTS[section] ?? {});
  const v = value && typeof value === "object" ? value : {};
  if (section === "product") {
    return {
      ...defaults,
      ...v,
      fieldVisibility: {
        ...(defaults.fieldVisibility || {}),
        ...(v.fieldVisibility || {}),
      },
      checkout: {
        ...(defaults.checkout || {}),
        ...(v.checkout || {}),
      },
    };
  }
  if (section === "timeLog") {
    return {
      ...defaults,
      ...v,
      columns: {
        ...(defaults.columns || {}),
        ...(v.columns || {}),
      },
    };
  }
  if (section === "customer" || section === "vendor" || section.startsWith("doc:")) {
    const columns = {
      ...(defaults.columns || {}),
      ...(v.columns || {}),
    };
    // Migrate legacy column label → current Invoice label
    if (columns["Service name"] != null && columns["Service Name"] == null) {
      columns["Service Name"] = columns["Service name"];
    }
    delete columns["Service name"];
    return {
      ...defaults,
      ...v,
      fieldVisibility: {
        ...(defaults.fieldVisibility || {}),
        ...(v.fieldVisibility || {}),
      },
      columns,
      summary: {
        ...(defaults.summary || {}),
        ...(v.summary || {}),
      },
      printEmail: {
        ...(defaults.printEmail || {}),
        ...(v.printEmail || {}),
      },
      general: {
        ...(defaults.general || {}),
        ...(v.general || {}),
      },
      payment: {
        ...(defaults.payment || {}),
        ...(v.payment || {}),
      },
      checkout: {
        ...(defaults.checkout || {}),
        ...(v.checkout || {}),
      },
    };
  }
  return { ...defaults, ...v };
}

/** Pull full settings doc from backend and cache every UI section. */
export async function syncAppSettingsFromBackend(force = false): Promise<Record<string, any> | null> {
  const doc = await fetchAppSettingDocument(force);
  if (!doc) return null;
  const mapped = apiDocToUiSections(doc, SECTION_DEFAULTS);
  await Promise.all(
    Object.entries(mapped).map(([section, value]) => cacheSection(section, value)),
  );
  return mapped;
}

export async function getAppSettings(section: string): Promise<any> {
  try {
    const mapped = await syncAppSettingsFromBackend(false);
    if (mapped && mapped[section] != null) return mapped[section];
  } catch {
    /* try per-type / local */
  }

  const apiType = UI_SECTION_TO_API[section];
  if (apiType) {
    try {
      const raw = await api.get(`/setting/app`, { params: { type: apiType } });
      if (raw != null) {
        const one = apiDocToUiSections({ [apiType]: raw }, SECTION_DEFAULTS);
        const value = one[section] ?? clone(SECTION_DEFAULTS[section] ?? {});
        const merged = mergeSection(section, value);
        await cacheSection(section, merged);
        return merged;
      }
    } catch {
      /* fall through to local */
    }
  }
  return readLocal(section);
}

export async function saveAppSettings(section: string, value: any): Promise<void> {
  await cacheSection(section, value);
  const payload = uiSectionToApiPayload(section, value);
  if (!payload) return;
  await patchAppSetting(payload);
}

export async function resetAppSettings(section: string): Promise<void> {
  const apiType = UI_SECTION_TO_API[section];
  try {
    if (apiType) await resetAppSettingType(apiType);
    else invalidateAppSettingsCache();
  } catch {
    /* still clear local cache */
  }
  try {
    await db.meta.delete(metaKey(section));
  } catch {
    /* ignore */
  }
  try {
    const doc = await fetchAppSettingDocument(true);
    if (doc) {
      const mapped = apiDocToUiSections(doc, SECTION_DEFAULTS);
      if (mapped[section]) await cacheSection(section, mapped[section]);
    }
  } catch {
    /* ignore */
  }
}

/** Live settings for one section (Dexie). Refreshes from backend on mount. */
export function useAppSettings(section: string): any {
  const row = useLiveQuery(() => db.meta.get(metaKey(section)), [section]);
  React.useEffect(() => {
    void getAppSettings(section);
  }, [section]);
  return mergeSection(section, row?.value);
}

export async function getExchangeRates(): Promise<{ rates: ExchangeRate[]; lastUpdated: number }> {
  try {
    const row = await db.meta.get("app:exchangeRates");
    if (row?.value?.rates) return row.value;
  } catch { /* fall through to defaults */ }
  return { rates: clone(DEFAULT_EXCHANGE_RATES), lastUpdated: Date.now() };
}

export async function saveExchangeRates(rates: ExchangeRate[]): Promise<void> {
  await db.meta.put({ key: "app:exchangeRates", value: { rates, lastUpdated: Date.now() } });
}
