/**
 * App Settings API — uses existing /setting/app endpoints as-is.
 * No backend changes. Maps UI (camelCase / labels) ↔ API (snake_case).
 *
 *   GET   /setting/app
 *   GET   /setting/app?type=...
 *   PATCH /setting/app          body: { type, ...fields }
 *   PATCH /setting/app/reset    body: { type? }
 */
import { api } from "@/lib/api/client";

/* ── section / type ids ─────────────────────────────────────────── */

export type ApiSettingType =
  | "general"
  | "modules"
  | "currency_format"
  | "printer"
  | "whatsApp"
  | "invoice"
  | "proforma_invoice"
  | "sales_receipt"
  | "estimate"
  | "delivery_challan"
  | "purchase_order"
  | "bill"
  | "credit_note"
  | "debit_note"
  | "expense"
  | "product"
  | "service"
  | "time_log";

/** UI section key (as used in AppSettingsModal / Dexie) → API `type`. */
export const UI_SECTION_TO_API: Record<string, ApiSettingType> = {
  general: "general",
  modules: "modules",
  currencyFormat: "currency_format",
  printer: "printer",
  whatsapp: "whatsApp",
  expense: "expense",
  product: "product",
  service: "service",
  timeLog: "time_log",
  "doc:invoice": "invoice",
  "doc:proformaInvoice": "proforma_invoice",
  "doc:salesReceipt": "sales_receipt",
  "doc:estimate": "estimate",
  "doc:deliveryChallan": "delivery_challan",
  "doc:purchaseOrder": "purchase_order",
  "doc:bill": "bill",
  "doc:creditNote": "credit_note",
  "doc:debitNote": "debit_note",
};

export const API_TYPE_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(UI_SECTION_TO_API).map(([ui, apiType]) => [apiType, ui]),
);

/* ── modules: display label ↔ API key ───────────────────────────── */

export const MODULE_UI_TO_API: Record<string, string> = {
  Invoice: "invoice",
  "Proforma Invoice": "proforma_invoice",
  Estimate: "estimate",
  "Delivery Challan": "delivery_challan",
  Bill: "bill",
  "Credit Note": "credit_note",
  "Debit Note": "debit_note",
  Expense: "expense",
  "Sales Receipt": "sales_receipt",
  "Packing Slip": "packing_slip",
  "Delivery Note": "delivery_note",
  "Time Log": "time_log",
  "Purchase Order": "purchase_order",
  Order: "order",
  Customer: "customer",
  Vendor: "vendor",
  Project: "project",
  Team: "team",
  "Payment Received": "payment_received",
  "Payment Made": "payment_made",
  Banking: "banking",
  Rewards: "rewards",
  Product: "product",
  Service: "service",
  Report: "report",
  "My Documents": "my_documents",
};

const MODULE_API_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_UI_TO_API).map(([ui, apiKey]) => [apiKey, ui]),
);

/* ── document field / column / summary label maps ───────────────── */

const FV_UI_TO_API: Record<string, string> = {
  "Due Date": "due_date",
  "Shipping Address": "shipping_address",
  "Internal Notes": "internal_notes",
  "Street 1": "street1",
  "Street 2": "street2",
  "Zip Code": "zip_code",
  City: "city",
  State: "state",
  Country: "country",
  "Sub Title": "sub_title",
  "PO #": "po",
  "P.O. Date": "po_date",
  "Recipient name": "recipient_name",
  "Shipping Cost And Method": "shipping_cost_and_method",
  "Shipping Tax": "shipping_tax",
  Salesperson: "salesperson",
  "Payment Methods": "payment_methods",
  "Payment Type": "payment_type",
  "Apply discount before tax": "apply_discount_before_tax",
  "Terms & Conditions": "terms_conditions",
  Notes: "notes",
  Attachment: "attachment",
};
const FV_API_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(FV_UI_TO_API).map(([ui, apiKey]) => [apiKey, ui]),
);

const COL_UI_TO_API: Record<string, string> = {
  "Service Name": "service_name",
  "Service name": "service_name", // legacy label
  "Product Name": "product_name",
  Description: "description",
  Discount: "discount",
  MRP: "mrp",
  Tax: "tax",
  "Line description full width": "line_description_full_width",
  "Stock In Suggestion List": "stock_in_suggestion_list",
  "Description In Suggestion List": "description_in_suggestion_list",
  "Buy Price in Suggestion List": "buy_price_in_suggestion_list",
  "Sell Price in Suggestion List": "sell_price_in_suggestion_list",
  "Item Code in Suggestion List": "item_code_in_suggestion_list",
  "Auto Fit": "auto_fit",
};
const COL_API_TO_UI: Record<string, string> = {
  service_name: "Service Name",
  product_name: "Product Name",
  description: "Description",
  discount: "Discount",
  mrp: "MRP",
  tax: "Tax",
  line_description_full_width: "Line description full width",
  stock_in_suggestion_list: "Stock In Suggestion List",
  description_in_suggestion_list: "Description In Suggestion List",
  buy_price_in_suggestion_list: "Buy Price in Suggestion List",
  sell_price_in_suggestion_list: "Sell Price in Suggestion List",
  item_code_in_suggestion_list: "Item Code in Suggestion List",
  auto_fit: "Auto Fit",
};

const SUM_UI_TO_API: Record<string, string> = {
  "Total Quantity": "total_quantity",
  "Round Off": "round_off",
  "Negative Value format with ( )": "negative_value_format",
  "Contact Note as Default Note": "contact_note_as_default_note",
  "Custom Charges": "custom_charges",
  "Show Line Total with Tax": "show_line_total_with_tax",
  // "Inline Discount" is UI-only — not sent to API
};
const SUM_API_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(SUM_UI_TO_API).map(([ui, apiKey]) => [apiKey, ui]),
);

const PRINT_UI_TO_API: Record<string, string> = {
  "Mark as Sent on Print": "mark_as_sent_on_print",
  "Mark as Sent on Email/WhatsApp": "mark_as_sent_on_email_or_whatsApp",
  "Combine PDF in Email": "combine_pdf_in_email",
};
const PRINT_API_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(PRINT_UI_TO_API).map(([ui, apiKey]) => [apiKey, ui]),
);

const PAYMENT_UI_TO_API: Record<string, string> = {
  "Cash Received Denomination": "cash_received_denomination",
};
const PAYMENT_API_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(PAYMENT_UI_TO_API).map(([ui, apiKey]) => [apiKey, ui]),
);

const mapBoolRecord = (
  src: Record<string, unknown> | undefined,
  dict: Record<string, string>,
  fallback?: Record<string, boolean>,
): Record<string, boolean> => {
  const out: Record<string, boolean> = { ...(fallback || {}) };
  if (!src || typeof src !== "object") return out;
  for (const [k, v] of Object.entries(src)) {
    const mapped = dict[k];
    if (mapped) out[mapped] = !!v;
  }
  return out;
};

const mapBoolRecordToApi = (
  src: Record<string, boolean> | undefined,
  dict: Record<string, string>,
): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  if (!src) return out;
  for (const [k, v] of Object.entries(src)) {
    const mapped = dict[k];
    if (mapped) out[mapped] = !!v;
  }
  return out;
};

/* ── UI ← API (per section) ─────────────────────────────────────── */

export function apiGeneralToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  return {
    ...fallback,
    chat: api.chat ?? fallback.chat,
    publicUrl: api.create_public_url_in_email ?? fallback.publicUrl,
    appearance: api.appearance ?? fallback.appearance,
    defaultMail: api.default_mail ?? fallback.defaultMail,
  };
}

export function apiModulesToUi(api: any, fallback: any) {
  const out: Record<string, boolean> = { ...fallback };
  if (!api || typeof api !== "object") return out;
  for (const [apiKey, v] of Object.entries(api)) {
    const ui = MODULE_API_TO_UI[apiKey];
    if (ui) out[ui] = !!v;
  }
  return out;
}

export function apiCurrencyToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  return {
    ...fallback,
    currency: api.currency ?? fallback.currency,
    currencySymbol: api.currency_symbol ?? fallback.currencySymbol,
    currencyCode: api.currency_code ?? fallback.currencyCode,
    multiCurrency: api.multi_currency_display ?? fallback.multiCurrency,
    decimalPlaces: String(api.decimal_places ?? fallback.decimalPlaces ?? "2"),
    dateFormat: api.date_number_format ?? fallback.dateFormat,
    language: api.language ?? fallback.language,
    timezone: api.timezone ?? fallback.timezone,
  };
}

export function apiPrinterToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  return { ...fallback, printMode: api.print_mode ?? fallback.printMode };
}

export function apiWhatsappToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  return {
    ...fallback,
    whatsapp: api.enabled ?? fallback.whatsapp,
    sendVia: api.send_via ?? fallback.sendVia,
    // terms / notes stay local UI defaults (not on API)
  };
}

export function apiExpenseToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  return {
    ...fallback,
    roundOff: api.round_off ?? fallback.roundOff,
    paymentType: api.payment_type ?? fallback.paymentType,
  };
}

export function apiServiceToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  return { ...fallback, sac: api.sac ?? fallback.sac };
}

export function apiProductToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  const fv = api.field_visibility || {};
  const allowZero = api.general?.allow_zero_stock;
  return {
    ...fallback,
    fieldVisibility: {
      HSN: fv.hsn ?? fallback.fieldVisibility?.HSN,
      Inventory: fv.inventory ?? fallback.fieldVisibility?.Inventory,
      MRP: fv.mrp ?? fallback.fieldVisibility?.MRP,
    },
    productImage: api.general?.product_img_on_line_item ?? fallback.productImage,
    zeroStock:
      allowZero === false
        ? "No, Don't Allow"
        : allowZero === true
          ? "Yes, Allow"
          : fallback.zeroStock,
    productStock: api.stock?.product_stock ?? fallback.productStock,
    outOfStockOnlineStore:
      api.stock?.out_of_stock_items_online_store ?? fallback.outOfStockOnlineStore ?? "Hide",
    checkout: {
      productPriceOnCheckout:
        api.checkout?.product_price_on_checkout ??
        fallback.checkout?.productPriceOnCheckout ??
        true,
      productImageSize:
        api.checkout?.product_image_size ??
        fallback.checkout?.productImageSize ??
        "Medium",
    },
  };
}

export function apiTimeLogToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  const cols = api.columns || {};
  return {
    ...fallback,
    columns: {
      "Include Project in Create Invoice":
        cols.include_project_in_create_invoice ??
        fallback.columns?.["Include Project in Create Invoice"],
      "Include Date in Create Invoice":
        cols.include_date_in_create_invoice ??
        fallback.columns?.["Include Date in Create Invoice"],
      "Include Notes in Create Invoice":
        cols.include_notes_in_create_invoice ??
        fallback.columns?.["Include Notes in Create Invoice"],
    },
    rounding: api.summary?.time_log_rounding ?? fallback.rounding,
  };
}

export function apiDocToUi(api: any, fallback: any) {
  if (!api || typeof api !== "object") return { ...fallback };
  const columnsApi = api.columns || {};
  const { quantity: qty, ...colBools } = columnsApi;
  const summaryMapped = mapBoolRecord(api.summary, SUM_API_TO_UI, fallback.summary);
  return {
    ...fallback,
    fieldVisibility: mapBoolRecord(api.field_visibility, FV_API_TO_UI, fallback.fieldVisibility),
    general: {
      lineOption: (api.general?.line_option as any) ?? fallback.general?.lineOption ?? "Both",
      createPublicUrlInEmail:
        api.general?.create_public_url_in_email ??
        fallback.general?.createPublicUrlInEmail ??
        true,
      trackPurchaseOrdersInStock:
        api.general?.track_purchase_orders_in_stock ??
        fallback.general?.trackPurchaseOrdersInStock ??
        true,
    },
    columns: mapBoolRecord(colBools, COL_API_TO_UI, fallback.columns),
    columnsQuantity: (qty as string) || fallback.columnsQuantity || "Show for Both",
    summary: {
      ...summaryMapped,
      // keep UI-only Inline Discount from fallback if API omits it
      "Inline Discount":
        api.summary && "inline_discount" in api.summary
          ? !!api.summary.inline_discount
          : fallback.summary?.["Inline Discount"] ?? true,
    },
    summarySubtotalWithTax:
      api.summary?.subtotal_with_tax ?? fallback.summarySubtotalWithTax ?? "Default",
    printEmail: mapBoolRecord(api.print_email, PRINT_API_TO_UI, fallback.printEmail),
    printCopies:
      api.print_email?.number_of_copies_on_print ?? fallback.printCopies ?? "Single Copy",
    payment: mapBoolRecord(api.payment, PAYMENT_API_TO_UI, fallback.payment),
  };
}

/** Convert full API setting document → UI section map. */
export function apiDocToUiSections(doc: any, defaults: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [uiSection, apiType] of Object.entries(UI_SECTION_TO_API)) {
    const fb = defaults[uiSection] ?? {};
    const raw = doc?.[apiType];
    switch (apiType) {
      case "general":
        out[uiSection] = apiGeneralToUi(raw, fb);
        break;
      case "modules":
        out[uiSection] = apiModulesToUi(raw, fb);
        break;
      case "currency_format":
        out[uiSection] = apiCurrencyToUi(raw, fb);
        break;
      case "printer":
        out[uiSection] = apiPrinterToUi(raw, fb);
        break;
      case "whatsApp":
        out[uiSection] = apiWhatsappToUi(raw, fb);
        break;
      case "expense":
        out[uiSection] = apiExpenseToUi(raw, fb);
        break;
      case "product":
        out[uiSection] = apiProductToUi(raw, fb);
        break;
      case "service":
        out[uiSection] = apiServiceToUi(raw, fb);
        break;
      case "time_log":
        out[uiSection] = apiTimeLogToUi(raw, fb);
        break;
      default:
        out[uiSection] = apiDocToUi(raw, fb);
        break;
    }
  }
  return out;
}

/* ── UI → API payloads (for PATCH) ──────────────────────────────── */

export function uiSectionToApiPayload(uiSection: string, value: any): Record<string, unknown> | null {
  const type = UI_SECTION_TO_API[uiSection];
  if (!type || !value) return null;

  switch (type) {
    case "general":
      return {
        type,
        chat: !!value.chat,
        create_public_url_in_email: !!value.publicUrl,
        appearance: value.appearance,
        default_mail: value.defaultMail,
      };
    case "modules": {
      const payload: Record<string, unknown> = { type };
      for (const [ui, apiKey] of Object.entries(MODULE_UI_TO_API)) {
        if (ui in value) payload[apiKey] = !!value[ui];
      }
      return payload;
    }
    case "currency_format":
      return {
        type,
        currency: value.currency,
        currency_symbol: !!value.currencySymbol,
        currency_code: !!value.currencyCode,
        multi_currency_display: !!value.multiCurrency,
        decimal_places: Number(value.decimalPlaces) || 2,
        date_number_format: value.dateFormat,
        language: value.language,
        timezone: value.timezone,
      };
    case "printer":
      return { type, print_mode: value.printMode };
    case "whatsApp":
      return {
        type,
        enabled: !!value.whatsapp,
        send_via: value.sendVia,
      };
    case "expense":
      return {
        type,
        round_off: !!value.roundOff,
        payment_type: !!value.paymentType,
      };
    case "service":
      return { type, sac: !!value.sac };
    case "product":
      return {
        type,
        field_visibility: {
          hsn: !!value.fieldVisibility?.HSN,
          inventory: !!value.fieldVisibility?.Inventory,
          mrp: !!value.fieldVisibility?.MRP,
        },
        general: {
          product_img_on_line_item: !!value.productImage,
          allow_zero_stock: value.zeroStock !== "No, Don't Allow",
        },
        stock: {
          product_stock: !!value.productStock,
          out_of_stock_items_online_store: value.outOfStockOnlineStore || "Hide",
        },
        checkout: {
          product_price_on_checkout: value.checkout?.productPriceOnCheckout !== false,
          product_image_size: value.checkout?.productImageSize || "Medium",
        },
      };
    case "time_log":
      return {
        type,
        columns: {
          include_project_in_create_invoice: !!value.columns?.["Include Project in Create Invoice"],
          include_date_in_create_invoice: !!value.columns?.["Include Date in Create Invoice"],
          include_notes_in_create_invoice: !!value.columns?.["Include Notes in Create Invoice"],
        },
        summary: {
          time_log_rounding: value.rounding || "0 mins",
        },
      };
    default:
      // document types — additive only; unknown UI-only keys stay local via merge
      return {
        type,
        field_visibility: mapBoolRecordToApi(value.fieldVisibility, FV_UI_TO_API),
        general: {
          line_option: value.general?.lineOption || "Both",
          create_public_url_in_email: !!value.general?.createPublicUrlInEmail,
          ...(value.general && "trackPurchaseOrdersInStock" in value.general
            ? { track_purchase_orders_in_stock: !!value.general.trackPurchaseOrdersInStock }
            : {}),
        },
        columns: {
          ...mapBoolRecordToApi(value.columns, COL_UI_TO_API),
          quantity: value.columnsQuantity || "Show for Both",
        },
        summary: {
          ...mapBoolRecordToApi(value.summary, SUM_UI_TO_API),
          subtotal_with_tax: value.summarySubtotalWithTax || "Default",
          ...(value.summary && "Inline Discount" in value.summary
            ? { inline_discount: !!value.summary["Inline Discount"] }
            : {}),
        },
        print_email: {
          ...mapBoolRecordToApi(value.printEmail, PRINT_UI_TO_API),
          number_of_copies_on_print: value.printCopies || "Single Copy",
        },
        payment: mapBoolRecordToApi(value.payment, PAYMENT_UI_TO_API),
      };
  }
}

/* ── HTTP ───────────────────────────────────────────────────────── */

let cacheDoc: any = null;
let cacheAt = 0;
const CACHE_MS = 3000;

export function invalidateAppSettingsCache() {
  cacheDoc = null;
  cacheAt = 0;
}

/** Full company setting document from backend (or null on failure). */
export async function fetchAppSettingDocument(force = false): Promise<any | null> {
  if (!force && cacheDoc && Date.now() - cacheAt < CACHE_MS) return cacheDoc;
  try {
    const data = await api.get<any>("/setting/app");
    cacheDoc = data;
    cacheAt = Date.now();
    return data;
  } catch {
    return null;
  }
}

export async function patchAppSetting(payload: Record<string, unknown>): Promise<void> {
  await api.patch("/setting/app", payload);
  invalidateAppSettingsCache();
}

export async function resetAppSettingType(type?: ApiSettingType): Promise<void> {
  await api.patch("/setting/app/reset", type ? { type } : {});
  invalidateAppSettingsCache();
}
