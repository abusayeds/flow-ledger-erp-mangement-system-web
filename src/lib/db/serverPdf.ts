/**
 * File: src/lib/db/serverPdf.ts
 * Fetches the REAL backend-rendered PDF (POST /pdf/generate) for a document, so
 * the preview/download shows the server's template + live data instead of the
 * browser-drawn jsPDF mock. Falls back to null (→ caller keeps its local render)
 * when there's no backend id, no token, or the request fails.
 */

import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/tokenStore";
import { db } from "./db";
import type { PdfDocType } from "./pdfSettings";

/** Web preview doc-type → backend `/pdf/generate` `type` (DOC_CONFIG key). */
const WEB_TO_PDF_TYPE: Partial<Record<PdfDocType, string>> = {
  invoice: "Invoice",
  salesReceipt: "Sales_Receipt",
  proformaInvoice: "Proforma_Invoice",
  estimate: "Estimate",
  deliveryChallan: "Delivery_Challan",
  bill: "Bill",
  purchaseOrder: "Purchase_Order",
  creditNote: "Credit_Note",
  debitNote: "Debit_Note",
  paymentReceived: "Payment_Received",
  paymentMade: "Payment_Made",
  statement: "Statement",
  packingSlip: "Packing_Slip",
  deliveryNote: "Delivery_Note",
};

export function backendPdfType(docType: PdfDocType): string | undefined {
  return WEB_TO_PDF_TYPE[docType];
}

/** True when this web doc-type has a real server PDF generator. */
export function hasServerPdf(docType: PdfDocType): boolean {
  return !!WEB_TO_PDF_TYPE[docType];
}

/** Fetch the backend PDF as a blob object URL, or null if unavailable.
 *  `id` may be omitted — server returns a blank/sample PDF for that type
 *  (used by PDF Settings preview so layout matches print exactly). */
export async function fetchServerPdfUrl(
  docType: PdfDocType,
  id?: string,
  opts?: { thermal?: boolean },
): Promise<string | null> {
  const type = WEB_TO_PDF_TYPE[docType];
  if (!type || !getToken()) return null;
  try {
    const body: Record<string, unknown> = { type };
    if (id) body.id = id;
    if (opts?.thermal) body.thermal = true;
    const res = await api.raw.post("/pdf/generate", body, { responseType: "blob" });
    const blob = res.data as Blob;
    // Auth/error responses sometimes arrive as JSON with blob content-type mishaps.
    if (blob && blob.type && blob.type.includes("json")) return null;
    // Force a PDF MIME so browser "Save as" / download attribute works reliably.
    const pdfBlob =
      blob.type === "application/pdf"
        ? blob
        : new Blob([blob], { type: "application/pdf" });
    return URL.createObjectURL(pdfBlob);
  } catch {
    return null;
  }
}

/**
 * Fetch a MERGED backend PDF for several documents (each rendered on its own
 * page[s]) as a blob object URL, or null. The backend `/pdf/generate` accepts
 * `{ type, ids: [...] }` and returns one combined PDF.
 */
export async function fetchServerBatchPdfUrl(
  docType: PdfDocType,
  ids: string[],
): Promise<string | null> {
  const type = WEB_TO_PDF_TYPE[docType];
  const clean = ids.filter(Boolean);
  if (!type || clean.length === 0 || !getToken()) return null;
  if (clean.length === 1) return fetchServerPdfUrl(docType, clean[0]);
  try {
    const res = await api.raw.post(
      "/pdf/generate",
      { type, ids: clean },
      { responseType: "blob" },
    );
    return URL.createObjectURL(res.data as Blob);
  } catch {
    return null;
  }
}

/** Local Dexie table backing each preview doc-type (to resolve the record `_id`). */
const WEB_TO_COLLECTION: Partial<Record<PdfDocType, string>> = {
  invoice: "invoices",
  salesReceipt: "salesReceipts",
  proformaInvoice: "proformas",
  estimate: "estimates",
  deliveryChallan: "deliveryChallans",
  bill: "bills",
  purchaseOrder: "purchaseOrders",
  creditNote: "creditNotes",
  debitNote: "debitNotes",
  paymentReceived: "paymentsReceived",
  paymentMade: "paymentsMade",
  packingSlip: "invoices",
  deliveryNote: "deliveryChallans",
};

/** Backend PDF blob URL for a UI record (numeric id), or null. */
export async function serverPdfUrlForRecord(
  docType: PdfDocType,
  recordId: number,
): Promise<string | null> {
  const col = WEB_TO_COLLECTION[docType];
  if (!col) return null;
  try {
    let row = await (db as any)[col].get(Number(recordId));
    if (!row?._id) {
      const all = await (db as any)[col].toArray();
      row = all.find((r: any) => r.id === recordId || String(r._id) === String(recordId));
    }
    if (!row?._id) return null;
    return fetchServerPdfUrl(docType, String(row._id));
  } catch {
    return null;
  }
}

/** Resolve several UI records (numeric ids) → their backend `_id`s, in order. */
async function backendIdsForRecords(
  docType: PdfDocType,
  recordIds: number[],
): Promise<string[]> {
  const col = WEB_TO_COLLECTION[docType];
  if (!col) return [];
  const out: string[] = [];
  for (const rid of recordIds) {
    try {
      const row = await (db as any)[col].get(Number(rid));
      if (row?._id) out.push(String(row._id));
    } catch {
      /* skip unresolved */
    }
  }
  return out;
}

/** Merged backend PDF blob URL for several UI records (numeric ids), or null. */
export async function serverBatchPdfUrlForRecords(
  docType: PdfDocType,
  recordIds: number[],
): Promise<string | null> {
  const ids = await backendIdsForRecords(docType, recordIds);
  return fetchServerBatchPdfUrl(docType, ids);
}

/** Sanitize a download filename and ensure it ends with `.pdf`. */
export function pdfDownloadFilename(name?: string, fallback = "document"): string {
  const base = String(name || fallback)
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim() || fallback;
  return `${base}.pdf`;
}

/** Trigger a browser file download from an object/blob URL (keeps the source URL intact). */
export function triggerBlobDownload(url: string, filename?: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = pdfDownloadFilename(filename);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download a merged backend PDF for several records. Returns false if unavailable. */
export async function downloadServerBatchPdf(
  docType: PdfDocType,
  recordIds: number[],
  filename?: string,
): Promise<boolean> {
  const url = await serverBatchPdfUrlForRecords(docType, recordIds);
  if (!url) return false;
  triggerBlobDownload(url, filename || docType);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/** Print a merged backend PDF for several records via a hidden iframe. */
export async function printServerBatchPdf(
  docType: PdfDocType,
  recordIds: number[],
): Promise<boolean> {
  const url = await serverBatchPdfUrlForRecords(docType, recordIds);
  if (!url) return false;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.src = url;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(iframe);
  return true;
}

/** Download the backend PDF for a record. Returns false if unavailable. */
export async function downloadServerPdf(
  docType: PdfDocType,
  recordId: number,
  filename?: string,
  backendId?: string,
): Promise<boolean> {
  const id = backendId?.trim();
  let url: string | null = null;
  if (id) {
    url = await fetchServerPdfUrl(docType, id);
  } else if (Number.isFinite(recordId) && recordId > 0) {
    url = await serverPdfUrlForRecord(docType, recordId);
  }
  // Last resort: still try a typed PDF (helps when local row lookup failed).
  if (!url && id) url = await fetchServerPdfUrl(docType, id);
  if (!url) return false;
  triggerBlobDownload(url, filename || docType);
  setTimeout(() => URL.revokeObjectURL(url!), 10000);
  return true;
}

/** Print the backend PDF for a record via a hidden iframe. Returns false if unavailable. */
export async function printServerPdf(
  docType: PdfDocType,
  recordId: number,
  backendId?: string,
): Promise<boolean> {
  const url = backendId?.trim()
    ? await fetchServerPdfUrl(docType, backendId.trim())
    : await serverPdfUrlForRecord(docType, recordId);
  if (!url) return false;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(iframe);
  return true;
}
