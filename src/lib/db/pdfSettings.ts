/**
 * File: src/lib/db/pdfSettings.ts
 * PDF & Print settings — backend `/setting/pdf/:pdfType` is source of truth
 * for Normal print mode. Thermal stays Dexie-local (API has no print-mode).
 * Dexie also caches Normal so liveQuery / offline still work.
 */

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import {
  UI_DOC_TO_API,
  apiDocToUi,
  applyUiToApiDoc,
  fetchPdfSetting,
  patchPdfSetting,
  resetPdfSettingApi,
} from "@/services/pdfSettingsApi";

/* ── document types (order matches the reference dropdown) ─────── */
export const PDF_DOC_TYPES = [
  { key: "invoice", label: "Invoice", title: "INVOICE" },
  { key: "salesReceipt", label: "Sales Receipt", title: "SALES RECEIPT" },
  { key: "proformaInvoice", label: "Proforma Invoice", title: "PROFORMA INVOICE" },
  { key: "estimate", label: "Estimate", title: "ESTIMATE" },
  { key: "deliveryChallan", label: "Delivery Challan", title: "DELIVERY CHALLAN" },
  { key: "bill", label: "Bill", title: "BILL" },
  { key: "purchaseOrder", label: "Purchase Order", title: "PURCHASE ORDER" },
  { key: "creditNote", label: "Credit Note", title: "CREDIT NOTE" },
  { key: "paymentReceived", label: "Payment Received", title: "PAYMENT RECEIPT" },
  { key: "paymentMade", label: "Payment Made", title: "PAYMENT MADE" },
  { key: "debitNote", label: "Debit Note", title: "DEBIT NOTE" },
  { key: "statement", label: "Statement", title: "STATEMENT" },
  { key: "packingSlip", label: "Packing Slip", title: "PACKING SLIP" },
  { key: "deliveryNote", label: "Delivery Note", title: "DELIVERY NOTE" },
] as const;

export type PdfDocType = (typeof PDF_DOC_TYPES)[number]["key"];
export type PrintMode = "normal" | "thermal";

export const docTypeLabel = (k: PdfDocType) => PDF_DOC_TYPES.find((d) => d.key === k)?.label || k;
export const docTypeTitle = (k: PdfDocType) => PDF_DOC_TYPES.find((d) => d.key === k)?.title || k;

/* ── settings shape ────────────────────────────────────────────── */
export interface PdfSettings {
  /* Style */
  textColor: string;
  borderColor: string;
  fillColor: string;
  fillTextColor: string;
  font: string;                                  // Arial | Helvetica | Times | Courier
  fontSize: "Small" | "Medium" | "Large";
  paper: "US Paper" | "A4 Paper";
  fullPage: "Yes" | "No";
  horizontalLines: "Show" | "Hide";
  verticalLines: "Show" | "Hide";
  scaling: "Aspect To Fit" | "Actual Size";
  horizontal: "Left" | "Center" | "Right";
  vertical: "Top" | "Center" | "Bottom";
  margin: { top: number; bottom: number; left: number; right: number };
  outerBorder: "Show" | "Hide";
  compactMode: boolean;

  /* Header */
  titleAlignment: "Left" | "Center" | "Right";
  subTitleAlignment: "Left" | "Center" | "Right";
  subTitle: boolean;
  logoSize: "Small" | "Medium" | "Large";
  dateFormat: "Short" | "Medium" | "Long";
  logo: boolean;
  header: boolean;
  numberNo: boolean;
  poNo: boolean;
  dueDate: boolean;
  documentCopyLabel: boolean;
  totalAmount: boolean;
  paidAmount: boolean;

  /* Company */
  companyRegNo: boolean;
  companyRegTaxAlignBelow: "Name" | "Address";
  companyTaxId: boolean;
  companyName: boolean;
  companyCountry: boolean;
  companyAddress: boolean;
  companyPhone: boolean;
  companyMobile: boolean;
  companyFax: boolean;
  companyEmail: boolean;
  companyWebsite: boolean;

  /* Contact (the customer / vendor block) */
  contactTaxId: boolean;
  contactRegNo: boolean;
  contactRegTaxAlignBelow: "Name" | "Address";
  contactHomePhone: boolean;
  contactBusinessPhone: boolean;
  contactEmail: boolean;
  contactEmailBelow: "Name" | "Address";
  contactMobile: boolean;
  contactFax: boolean;
  contactFirstLastName: boolean;
  contactMobileBelow: "Name" | "Address";
  contactAddressAlignment: "Left" | "Center" | "Right";

  /* Summary */
  summaryTotal: boolean;
  summaryAmountUsed: boolean;
  summaryTax: "Individual" | "Group";
  summaryTaxPercent: boolean;
  summaryTaxableAmount: boolean;
  summaryReturnOrder: boolean;

  /* Notes & Terms */
  showNotes: boolean;
  showTerms: boolean;

  /* Signature */
  companySign: "Company" | "None";
  companySignAlignment: "Left" | "Center" | "Right";
  contactSignAlignment: "Left" | "Center" | "Right";
  signatureSize: "Small" | "Medium" | "Large";
  contactSign: boolean;

  /* Footer */
  createdHyperlink: boolean;
  showTemplateForPages: "First" | "All";
  pageNumberAlignment: "Left" | "Center" | "Right";
  pageNumber: boolean;

  /* Payment */
  paymentHistory: boolean;
  payNowAlignment: "Up" | "Down";
  paymentMethodsAlignment: "Below" | "Above";
  paymentMethods: "Show" | "Hide";
  paymentNote: boolean;
  paymentNumber: boolean;
}

/* ── defaults (match the reference screenshots) ────────────────── */
export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  textColor: "#1d4ed8",
  borderColor: "#111111",
  fillColor: "#ffffff",
  fillTextColor: "#111111",
  font: "Arial",
  fontSize: "Medium",
  paper: "US Paper",
  fullPage: "Yes",
  horizontalLines: "Show",
  verticalLines: "Hide",
  scaling: "Aspect To Fit",
  horizontal: "Center",
  vertical: "Center",
  margin: { top: 30, bottom: 30, left: 30, right: 30 },
  outerBorder: "Show",
  compactMode: false,

  titleAlignment: "Center",
  subTitleAlignment: "Center",
  subTitle: true,
  logoSize: "Medium",
  dateFormat: "Medium",
  logo: true,
  header: true,
  numberNo: true,
  poNo: true,
  dueDate: true,
  documentCopyLabel: true,
  totalAmount: true,
  paidAmount: true,

  companyRegNo: true,
  companyRegTaxAlignBelow: "Name",
  companyTaxId: true,
  companyName: true,
  companyCountry: true,
  companyAddress: true,
  companyPhone: true,
  companyMobile: true,
  companyFax: true,
  companyEmail: true,
  companyWebsite: true,

  contactTaxId: true,
  contactRegNo: true,
  contactRegTaxAlignBelow: "Address",
  contactHomePhone: true,
  contactBusinessPhone: true,
  contactEmail: true,
  contactEmailBelow: "Name",
  contactMobile: true,
  contactFax: true,
  contactFirstLastName: true,
  contactMobileBelow: "Name",
  contactAddressAlignment: "Left",

  summaryTotal: true,
  summaryAmountUsed: true,
  summaryTax: "Individual",
  summaryTaxPercent: true,
  summaryTaxableAmount: true,
  summaryReturnOrder: true,

  showNotes: true,
  showTerms: true,

  companySign: "Company",
  companySignAlignment: "Left",
  contactSignAlignment: "Right",
  signatureSize: "Small",
  contactSign: true,

  createdHyperlink: false,
  showTemplateForPages: "First",
  pageNumberAlignment: "Right",
  pageNumber: false,

  paymentHistory: true,
  payNowAlignment: "Up",
  paymentMethodsAlignment: "Below",
  paymentMethods: "Show",
  paymentNote: false,
  paymentNumber: true,
};

/** "Standard" template preset (bottom-toolbar button). */
export const STANDARD_PDF_SETTINGS: PdfSettings = {
  ...DEFAULT_PDF_SETTINGS,
  fillColor: "#f5f5f5",
  fillTextColor: "#111111",
  outerBorder: "Show",
  horizontalLines: "Show",
  verticalLines: "Show",
};

const metaKey = (docType: PdfDocType, mode: PrintMode) => `pdf:${docType}:${mode}`;

/** UI-only fields not on the backend schema — preserve from local cache. */
const LOCAL_ONLY_KEYS: (keyof PdfSettings)[] = [
  "paper",
  "compactMode",
  "pageNumber",
  "paymentHistory",
  "payNowAlignment",
  "paymentMethodsAlignment",
  "paymentMethods",
  "paymentNote",
  "paymentNumber",
];

function pickLocalOnly(s: Partial<PdfSettings> | undefined): Partial<PdfSettings> {
  const out: Partial<PdfSettings> = {};
  if (!s) return out;
  for (const k of LOCAL_ONLY_KEYS) {
    if (s[k] !== undefined) (out as any)[k] = s[k];
  }
  return out;
}

async function readLocal(docType: PdfDocType, mode: PrintMode): Promise<PdfSettings> {
  try {
    const row = await db.meta.get(metaKey(docType, mode));
    return { ...DEFAULT_PDF_SETTINGS, ...(row?.value || {}) };
  } catch {
    return { ...DEFAULT_PDF_SETTINGS };
  }
}

async function writeLocal(docType: PdfDocType, mode: PrintMode, s: PdfSettings): Promise<void> {
  try {
    await db.meta.put({ key: metaKey(docType, mode), value: s });
  } catch {
    /* ignore */
  }
}

/* ── read / write (backend for Normal; Thermal = local only) ───── */
export async function getPdfSettings(docType: PdfDocType, mode: PrintMode): Promise<PdfSettings> {
  const local = await readLocal(docType, mode);
  if (mode === "thermal") return local;

  const apiType = UI_DOC_TO_API[docType];
  const apiDoc = await fetchPdfSetting(apiType);
  if (!apiDoc) return local;

  const mapped = apiDocToUi(apiDoc, DEFAULT_PDF_SETTINGS, pickLocalOnly(local));
  await writeLocal(docType, mode, mapped);
  return mapped;
}

export async function savePdfSettings(
  docType: PdfDocType,
  mode: PrintMode,
  s: PdfSettings,
): Promise<void> {
  await writeLocal(docType, mode, s);
  if (mode === "thermal") return;

  const apiType = UI_DOC_TO_API[docType];
  const existing = await fetchPdfSetting(apiType);
  if (!existing) {
    throw new Error("PDF setting not found on server for this document type.");
  }
  const payload = applyUiToApiDoc(s, existing);
  await patchPdfSetting(apiType, payload);
}

export async function resetPdfSettings(
  docType: PdfDocType,
  mode: PrintMode,
): Promise<PdfSettings> {
  if (mode === "thermal") {
    try {
      await db.meta.delete(metaKey(docType, mode));
    } catch {
      /* ignore */
    }
    return { ...DEFAULT_PDF_SETTINGS };
  }

  const apiType = UI_DOC_TO_API[docType];
  const resetDoc = await resetPdfSettingApi(apiType);
  const localOnly = pickLocalOnly(await readLocal(docType, mode));
  const mapped = resetDoc
    ? apiDocToUi(resetDoc, DEFAULT_PDF_SETTINGS, localOnly)
    : { ...DEFAULT_PDF_SETTINGS, ...localOnly };
  await writeLocal(docType, mode, mapped);
  return mapped;
}

/** Live settings (Dexie). Refreshes from backend on mount for Normal mode. */
export function usePdfSettings(docType: PdfDocType, mode: PrintMode): PdfSettings {
  const row = useLiveQuery(() => db.meta.get(metaKey(docType, mode)), [docType, mode]);
  React.useEffect(() => {
    void getPdfSettings(docType, mode);
  }, [docType, mode]);
  return { ...DEFAULT_PDF_SETTINGS, ...(row?.value || {}) };
}

/* ── shared formatting helpers driven by the settings ──────────── */
export function formatPdfDate(input: string | number | undefined, fmt: PdfSettings["dateFormat"]): string {
  if (input == null || input === "") return "";
  const t = typeof input === "number" ? input : Date.parse(String(input));
  if (Number.isNaN(t)) return String(input);
  const d = new Date(t);
  if (fmt === "Short") return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  if (fmt === "Long") return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const PDF_FONT_STACK: Record<string, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
  Times: "'Times New Roman', Times, serif",
  Courier: "'Courier New', Courier, monospace",
};

/** Base body font-size (px) for the preview per setting. */
export const PDF_FONT_PX: Record<PdfSettings["fontSize"], number> = { Small: 10, Medium: 11, Large: 13 };
export const PDF_LOGO_PX: Record<PdfSettings["logoSize"], number> = { Small: 22, Medium: 32, Large: 44 };
