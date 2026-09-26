/**
 * PDF & Print Settings API — existing endpoints only (no backend changes).
 *
 *   GET   /setting/pdf/:pdfType   (or "all")
 *   PATCH /setting/pdf/:pdfType
 *   PATCH /setting/pdf/reset/:pdfType
 *
 * UI uses a flat PdfSettings shape; API uses nested snake_case sections.
 */
import { api } from "@/lib/api/client";
import type { PdfDocType, PdfSettings } from "@/lib/db/pdfSettings";

/** UI doc key → API pdfType enum string */
export const UI_DOC_TO_API: Record<PdfDocType, string> = {
  invoice: "Invoice",
  salesReceipt: "Sales_Receipt",
  proformaInvoice: "Proforma_Invoice",
  estimate: "Estimate",
  deliveryChallan: "Delivery_Challan",
  bill: "Bill",
  purchaseOrder: "Purchase_Order",
  creditNote: "Credit_Note",
  paymentReceived: "Payment_Received",
  paymentMade: "Payment_Made",
  debitNote: "Debit_Note",
  statement: "Statement",
  packingSlip: "Packing_Slip",
  deliveryNote: "Delivery_Note",
};

const low = (v: string) => v.toLowerCase();

const fontUiToApi = (f: string): string => {
  const x = low(f);
  if (x.includes("times")) return "times";
  if (x.includes("courier")) return "courier";
  return "arial"; // Arial / Helvetica
};

const fontApiToUi = (f: string): string => {
  const x = low(f || "");
  if (x.startsWith("times")) return "Times";
  if (x.startsWith("courier")) return "Courier";
  return "Arial";
};

const fontSizeUiToApi = (s: string): string => {
  if (s === "Small") return "small";
  if (s === "Large") return "large";
  return "normal"; // Medium
};

const fontSizeApiToUi = (s: string): PdfSettings["fontSize"] => {
  if (s === "small") return "Small";
  if (s === "large" || s === "x-large" || s === "xx-large") return "Large";
  return "Medium";
};

const showHideUi = (v: string) => (low(v) === "hide" ? "hide" : "show");
const showHideApi = (v: string): "Show" | "Hide" => (low(v) === "hide" ? "Hide" : "Show");

const yesNoUi = (v: string) => (low(v) === "no" ? "no" : "yes");
const yesNoApi = (v: string): "Yes" | "No" => (low(v) === "no" ? "No" : "Yes");

const alignH = (v: string) => {
  const x = low(v);
  if (x === "center") return "center";
  if (x === "right") return "right";
  return "left";
};
const alignHUi = (v: string): "Left" | "Center" | "Right" => {
  const x = low(v || "");
  if (x === "center") return "Center";
  if (x === "right") return "Right";
  return "Left";
};

const alignV = (v: string) => {
  const x = low(v);
  if (x === "center" || x === "middle") return "middle";
  if (x === "bottom") return "bottom";
  return "top";
};
const alignVUi = (v: string): "Top" | "Center" | "Bottom" => {
  const x = low(v || "");
  if (x === "middle" || x === "center") return "Center";
  if (x === "bottom") return "Bottom";
  return "Top";
};

const titleAlignUiToApi = (v: string) => {
  // API enum: center | right only
  return low(v) === "right" ? "right" : "center";
};

const sizeUi = (v: string) => low(v) as "small" | "medium" | "large";
const sizeApi = (v: string): "Small" | "Medium" | "Large" => {
  const x = low(v || "");
  if (x === "small") return "Small";
  if (x === "large") return "Large";
  return "Medium";
};

const nameAddr = (v: string) => (low(v) === "address" ? "address" : "name");
const nameAddrUi = (v: string): "Name" | "Address" =>
  low(v || "") === "address" ? "Address" : "Name";

/** Strip mongoose meta before PATCH. */
function stripMeta(doc: any): Record<string, unknown> {
  if (!doc || typeof doc !== "object") return {};
  const {
    _id,
    __v,
    user_id,
    pdfType,
    createdAt,
    updatedAt,
    ...rest
  } = doc;
  return JSON.parse(JSON.stringify(rest));
}

/** Merge UI flat settings onto an existing API document (preserve unmapped API fields). */
export function applyUiToApiDoc(ui: PdfSettings, existing: any | null): Record<string, unknown> {
  const base: any = existing
    ? stripMeta(existing)
    : {
        style: {},
        columns: {},
        header: {},
        company: {},
        contact: {},
        summary: {},
        notes_terms: {},
        signature: {},
        footer: {},
      };

  base.style = {
    ...(base.style || {}),
    text_color: ui.textColor,
    border_color: ui.borderColor,
    fill_color: ui.fillColor,
    fill_text_color: ui.fillTextColor,
    font: fontUiToApi(ui.font),
    font_size: fontSizeUiToApi(ui.fontSize),
    full_page: yesNoUi(ui.fullPage),
    horizontal_lines: showHideUi(ui.horizontalLines),
    vertical_lines: showHideUi(ui.verticalLines),
    scaling: ui.scaling === "Actual Size" ? "actual_size" : "fit_to_page",
    horizontal_alignment: alignH(ui.horizontal),
    vertical_alignment: alignV(ui.vertical),
    margin: {
      top: ui.margin?.top ?? 15,
      bottom: ui.margin?.bottom ?? 15,
      left: ui.margin?.left ?? 15,
      right: ui.margin?.right ?? 15,
    },
    outer_border: showHideUi(ui.outerBorder),
  };

  base.header = {
    ...(base.header || {}),
    title_alignment: titleAlignUiToApi(ui.titleAlignment),
    sub_title_alignment: alignH(ui.subTitleAlignment),
    sub_title: !!ui.subTitle,
    logo_size: sizeUi(ui.logoSize),
    date_format: low(ui.dateFormat) as "short" | "medium" | "long",
    logo: !!ui.logo,
    header: !!ui.header,
    number: !!ui.numberNo,
    po_no: !!ui.poNo,
    due_date: !!ui.dueDate,
    document_copy_label: !!ui.documentCopyLabel,
    total_amount: !!ui.totalAmount,
    paid_amount: !!ui.paidAmount,
  };

  base.company = {
    ...(base.company || {}),
    Reg_no: !!ui.companyRegNo,
    reg_no_tax_id_align_below: nameAddr(ui.companyRegTaxAlignBelow),
    tax_id: !!ui.companyTaxId,
    name: !!ui.companyName,
    country: !!ui.companyCountry,
    address: !!ui.companyAddress,
    phone: !!ui.companyPhone,
    mobile: !!ui.companyMobile,
    fax: !!ui.companyFax,
    email: !!ui.companyEmail,
    website: !!ui.companyWebsite,
  };

  base.contact = {
    ...(base.contact || {}),
    tax_id: !!ui.contactTaxId,
    reg_no: !!ui.contactRegNo,
    reg_no_tax_id_align_below: nameAddr(ui.contactRegTaxAlignBelow),
    home_phone: !!ui.contactHomePhone,
    business_phone: !!ui.contactBusinessPhone,
    email: !!ui.contactEmail,
    email_below_contact: nameAddr(ui.contactEmailBelow),
    mobaile: !!ui.contactMobile,
    fax: !!ui.contactFax,
    first_last_name: !!ui.contactFirstLastName,
    mobile_below_contact: nameAddr(ui.contactMobileBelow),
    address_alignment: alignH(ui.contactAddressAlignment) === "right" ? "right" : "left",
  };

  base.summary = {
    ...(base.summary || {}),
    total: !!ui.summaryTotal,
    amount_used: !!ui.summaryAmountUsed,
    tax: ui.summaryTax === "Group" ? "combine" : "individual",
    tax_value: !!ui.summaryTaxPercent,
    taxable_amount: !!ui.summaryTaxableAmount,
    return_order: !!ui.summaryReturnOrder,
  };

  base.notes_terms = {
    ...(base.notes_terms || {}),
    notes: !!ui.showNotes,
    terms_and_condition: !!ui.showTerms,
  };

  const companySign =
    ui.companySign === "None" || low(String(ui.companySign)) === "none" ? "hide" : "company";

  base.signature = {
    ...(base.signature || {}),
    company_sign: companySign,
    contact_sign: !!ui.contactSign,
    company_signature_alignment: alignH(ui.companySignAlignment),
    contact_signature_alignment: alignH(ui.contactSignAlignment),
    signature_size: sizeUi(ui.signatureSize),
  };

  base.footer = {
    ...(base.footer || {}),
    created_moon_invoice_hyperlink: !!ui.createdHyperlink,
    show_tamplate_for_pages: ui.showTemplateForPages === "All" ? "all" : "first",
    page_number_alignment: alignH(ui.pageNumberAlignment),
  };

  return base;
}

/** Map API document → flat UI settings (fallback fills gaps / UI-only fields). */
export function apiDocToUi(
  api: any,
  fallback: PdfSettings,
  localExtras?: Partial<PdfSettings>,
): PdfSettings {
  const s = api?.style || {};
  const h = api?.header || {};
  const co = api?.company || {};
  const ct = api?.contact || {};
  const su = api?.summary || {};
  const nt = api?.notes_terms || {};
  const sg = api?.signature || {};
  const ft = api?.footer || {};

  const mapped: PdfSettings = {
    ...fallback,
    ...(localExtras || {}),

    textColor: s.text_color ?? fallback.textColor,
    borderColor: s.border_color ?? fallback.borderColor,
    fillColor: s.fill_color ?? fallback.fillColor,
    fillTextColor: s.fill_text_color ?? fallback.fillTextColor,
    font: fontApiToUi(s.font),
    fontSize: fontSizeApiToUi(s.font_size),
    fullPage: yesNoApi(s.full_page ?? "yes"),
    horizontalLines: showHideApi(s.horizontal_lines ?? "show"),
    verticalLines: showHideApi(s.vertical_lines ?? "hide"),
    scaling: low(s.scaling || "") === "actual_size" ? "Actual Size" : "Aspect To Fit",
    horizontal: alignHUi(s.horizontal_alignment),
    vertical: alignVUi(s.vertical_alignment),
    margin: {
      top: s.margin?.top ?? fallback.margin.top,
      bottom: s.margin?.bottom ?? fallback.margin.bottom,
      left: s.margin?.left ?? fallback.margin.left,
      right: s.margin?.right ?? fallback.margin.right,
    },
    outerBorder: showHideApi(s.outer_border ?? "show"),

    titleAlignment: alignHUi(h.title_alignment || "center"),
    subTitleAlignment: alignHUi(h.sub_title_alignment || "center"),
    subTitle: h.sub_title ?? fallback.subTitle,
    logoSize: sizeApi(h.logo_size),
    dateFormat:
      low(h.date_format || "") === "short"
        ? "Short"
        : low(h.date_format || "") === "long"
          ? "Long"
          : "Medium",
    logo: h.logo ?? fallback.logo,
    header: h.header ?? fallback.header,
    numberNo: h.number ?? fallback.numberNo,
    poNo: h.po_no ?? fallback.poNo,
    dueDate: h.due_date ?? fallback.dueDate,
    documentCopyLabel: h.document_copy_label ?? fallback.documentCopyLabel,
    totalAmount: h.total_amount ?? fallback.totalAmount,
    paidAmount: h.paid_amount ?? fallback.paidAmount,

    companyRegNo: co.Reg_no ?? fallback.companyRegNo,
    companyRegTaxAlignBelow: nameAddrUi(co.reg_no_tax_id_align_below),
    companyTaxId: co.tax_id ?? fallback.companyTaxId,
    companyName: co.name ?? fallback.companyName,
    companyCountry: co.country ?? fallback.companyCountry,
    companyAddress: co.address ?? fallback.companyAddress,
    companyPhone: co.phone ?? fallback.companyPhone,
    companyMobile: co.mobile ?? fallback.companyMobile,
    companyFax: co.fax ?? fallback.companyFax,
    companyEmail: co.email ?? fallback.companyEmail,
    companyWebsite: co.website ?? fallback.companyWebsite,

    contactTaxId: ct.tax_id ?? fallback.contactTaxId,
    contactRegNo: ct.reg_no ?? fallback.contactRegNo,
    contactRegTaxAlignBelow: nameAddrUi(ct.reg_no_tax_id_align_below),
    contactHomePhone: ct.home_phone ?? fallback.contactHomePhone,
    contactBusinessPhone: ct.business_phone ?? fallback.contactBusinessPhone,
    contactEmail: ct.email ?? fallback.contactEmail,
    contactEmailBelow: nameAddrUi(ct.email_below_contact),
    contactMobile: ct.mobaile ?? fallback.contactMobile,
    contactFax: ct.fax ?? fallback.contactFax,
    contactFirstLastName: ct.first_last_name ?? fallback.contactFirstLastName,
    contactMobileBelow: nameAddrUi(ct.mobile_below_contact),
    contactAddressAlignment: alignHUi(ct.address_alignment || "left"),

    summaryTotal: su.total ?? fallback.summaryTotal,
    summaryAmountUsed: su.amount_used ?? fallback.summaryAmountUsed,
    summaryTax: low(su.tax || "") === "combine" ? "Group" : "Individual",
    summaryTaxPercent: su.tax_value ?? fallback.summaryTaxPercent,
    summaryTaxableAmount: su.taxable_amount ?? fallback.summaryTaxableAmount,
    summaryReturnOrder: su.return_order ?? fallback.summaryReturnOrder,

    showNotes: nt.notes ?? fallback.showNotes,
    showTerms: nt.terms_and_condition ?? fallback.showTerms,

    companySign: low(sg.company_sign || "") === "hide" ? "None" : "Company",
    companySignAlignment: alignHUi(sg.company_signature_alignment || "left"),
    contactSignAlignment: alignHUi(sg.contact_signature_alignment || "right"),
    signatureSize: sizeApi(sg.signature_size),
    contactSign: sg.contact_sign ?? fallback.contactSign,

    createdHyperlink: ft.created_moon_invoice_hyperlink ?? fallback.createdHyperlink,
    showTemplateForPages: low(ft.show_tamplate_for_pages || "") === "all" ? "All" : "First",
    pageNumberAlignment: alignHUi(ft.page_number_alignment || "right"),
  };

  return mapped;
}

export async function fetchPdfSetting(apiType: string): Promise<any | null> {
  try {
    return await api.get(`/setting/pdf/${apiType}`);
  } catch {
    return null;
  }
}

export async function patchPdfSetting(apiType: string, payload: Record<string, unknown>): Promise<void> {
  await api.patch(`/setting/pdf/${apiType}`, payload);
}

export async function resetPdfSettingApi(apiType: string): Promise<any | null> {
  try {
    return await api.patch(`/setting/pdf/reset/${apiType}`, {});
  } catch {
    return null;
  }
}
