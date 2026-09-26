/**
 * File: src/lib/db/PdfDocPreview.tsx
 * Document preview — ALWAYS the real backend PDF via POST /pdf/generate.
 * No local HTML mock (that diverged from print). Spinner while loading;
 * error text if the server PDF cannot be fetched.
 */

import React, { useEffect, useState } from "react";
import { useCollection } from "./hooks";
import { fetchServerPdfUrl, hasServerPdf } from "./serverPdf";
import type { PdfDocType, PdfSettings, PrintMode } from "./pdfSettings";

/** Resolve Mongo `_id` from Dexie when the caller only has a numeric UI id. */
function useDexieBackendId(docType: PdfDocType, recordId?: number, partyId?: number): string {
  const invoices = useCollection<any>("invoices");
  const estimates = useCollection<any>("estimates");
  const proformas = useCollection<any>("proformas");
  const salesReceipts = useCollection<any>("salesReceipts");
  const creditNotes = useCollection<any>("creditNotes");
  const deliveryChallans = useCollection<any>("deliveryChallans");
  const paymentsReceived = useCollection<any>("paymentsReceived");
  const bills = useCollection<any>("bills");
  const purchaseOrders = useCollection<any>("purchaseOrders");
  const debitNotes = useCollection<any>("debitNotes");
  const paymentsMade = useCollection<any>("paymentsMade");
  const customers = useCollection<any>("customers");

  const pick = (rows: any[]) => {
    if (recordId == null) return "";
    const row = rows.find((r) => r.id === recordId || String(r._id) === String(recordId));
    return row?._id ? String(row._id) : "";
  };

  if (docType === "statement") {
    const party =
      partyId != null
        ? customers.find((c) => c.id === partyId || String(c._id) === String(partyId))
        : null;
    return party?._id ? String(party._id) : "";
  }

  switch (docType) {
    case "invoice":
    case "packingSlip":
      return pick(invoices);
    case "salesReceipt":
      return pick(salesReceipts);
    case "proformaInvoice":
      return pick(proformas);
    case "estimate":
      return pick(estimates);
    case "deliveryChallan":
    case "deliveryNote":
      return pick(deliveryChallans);
    case "creditNote":
      return pick(creditNotes);
    case "bill":
      return pick(bills);
    case "purchaseOrder":
      return pick(purchaseOrders);
    case "debitNote":
      return pick(debitNotes);
    case "paymentReceived":
      return pick(paymentsReceived);
    case "paymentMade":
      return pick(paymentsMade);
    default:
      return "";
  }
}

export const PdfDocPreview: React.FC<{
  docType: PdfDocType;
  mode: PrintMode;
  settings: PdfSettings;
  /** lock the party (e.g. a specific customer's statement) */
  partyId?: number;
  /** lock the document (numeric UI id) */
  recordId?: number;
  /** Mongo `_id` — preferred so preview always hits the correct server document */
  backendId?: string;
  className?: string;
  /** Fires with the blob object URL once the PDF is ready (null while loading / on failure). */
  onPdfUrl?: (url: string | null) => void;
}> = ({ docType, mode, settings: _settings, partyId, recordId, backendId, className = "", onPdfUrl }) => {
  // settings are applied server-side from saved PDF settings; prop kept for API compat
  void _settings;

  const fromDexie = useDexieBackendId(docType, recordId, partyId);
  const resolvedBackendId = String(backendId || fromDexie || "").trim();
  const useServer = hasServerPdf(docType);

  const [serverPdfUrl, setServerPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfFailed, setPdfFailed] = useState(false);
  const onPdfUrlRef = React.useRef(onPdfUrl);
  onPdfUrlRef.current = onPdfUrl;

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    if (!useServer) {
      setPdfLoading(false);
      setServerPdfUrl(null);
      setPdfFailed(true);
      onPdfUrlRef.current?.(null);
      return () => {
        alive = false;
      };
    }
    setPdfLoading(true);
    setServerPdfUrl(null);
    setPdfFailed(false);
    onPdfUrlRef.current?.(null);
    // With or without id: server returns real PDF (blank/sample when id omitted).
    fetchServerPdfUrl(docType, resolvedBackendId || undefined, {
      thermal: mode === "thermal",
    }).then((u) => {
      url = u;
      if (!alive) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      setServerPdfUrl(u);
      setPdfFailed(!u);
      setPdfLoading(false);
      onPdfUrlRef.current?.(u);
    });
    return () => {
      alive = false;
      onPdfUrlRef.current?.(null);
      if (url) URL.revokeObjectURL(url);
    };
  }, [docType, resolvedBackendId, mode, useServer]);

  if (pdfLoading) {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3f4f6",
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: 44,
            height: 44,
            border: "3px solid #e5e7eb",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
          }}
        />
      </div>
    );
  }

  if (serverPdfUrl) {
    return (
      <div
        className={className}
        style={{ width: "100%", height: "100%", minHeight: "70vh", background: "#f3f4f6" }}
      >
        <iframe
          src={`${serverPdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title="Document PDF"
          style={{ width: "100%", height: "100%", minHeight: "70vh", border: "none" }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f6",
        color: "#6b7280",
        fontSize: 14,
      }}
    >
      {pdfFailed ? "Couldn't load PDF preview from server." : "No PDF preview available."}
    </div>
  );
};

export default PdfDocPreview;
