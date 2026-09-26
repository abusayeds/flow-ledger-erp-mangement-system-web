/**
 * File: src/lib/db/pdf.ts
 * Generates and downloads a real .pdf for a document/statement preview using
 * jsPDF (drawn from the data — robust, unlike html2canvas which can't parse
 * the app's Tailwind v4 oklch colors). The Download icon in any preview calls
 * this; the browser saves e.g. "Invoice# 17.pdf".
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PdfSettings } from "./pdfSettings";

const COMPANY = ["info", "Bangladesh", "info@inovoic.com"];

const safe = (s: string) => (s || "document").replace(/[^a-z0-9 #._-]/gi, "").trim() || "document";

const hex2rgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export interface PdfDoc {
  filename: string;           // without extension
  docTitle: string;           // "INVOICE", "STATEMENT", …
  partyLabel?: string;        // "Invoice To:", "Vendor:", "Statement To"
  partyLines: string[];       // name + contact/email/phone
  meta: [string, string][];   // right-side key/value box
  /** line-item docs */
  itemHead?: string[];
  itemRows?: (string | number)[][];
  totals?: [string, string][];
  note?: { label: string; value: string };
  /** payment receipt: a big centered amount */
  bigAmount?: { label: string; value: string };
  /** saved PDF & Print settings — margins / colors / alignment applied */
  settings?: PdfSettings;
}

export function downloadDocPdf(d: PdfDoc): void {
  const s = d.settings;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = Math.max(24, s ? s.margin.left : 40);
  const MR = Math.max(24, s ? s.margin.right : 40);
  const titleY = Math.max(40, (s ? s.margin.top : 40) + 16);
  const accent = s ? hex2rgb(s.textColor) : ([17, 17, 17] as [number, number, number]);
  const fill = s ? hex2rgb(s.fillColor) : ([245, 245, 245] as [number, number, number]);
  const fillText = s ? hex2rgb(s.fillTextColor) : ([20, 20, 20] as [number, number, number]);
  const titleAlign = (s?.titleAlignment || "Center").toLowerCase() as "left" | "center" | "right";
  const titleX = titleAlign === "left" ? M : titleAlign === "right" ? W - MR : W / 2;

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...accent);
  doc.text(d.docTitle, titleX, titleY, { align: titleAlign });
  doc.setTextColor(20, 20, 20);

  // company + party (left) — company lines follow the Header/Company toggles
  const companyLines = s
    ? [s.companyName ? COMPANY[0] : "", s.companyCountry ? COMPANY[1] : "", s.companyEmail ? COMPANY[2] : ""].filter(Boolean)
    : COMPANY;
  doc.setFontSize(11);
  let y = titleY + 34;
  if (s?.header !== false && companyLines.length) {
    doc.setFont("helvetica", "bold").text(companyLines[0], M, y);
    doc.setFont("helvetica", "normal").setFontSize(9);
    companyLines.slice(1).forEach((l) => { y += 13; doc.text(l, M, y); });
  }
  if (d.partyLabel) { y += 20; doc.setFont("helvetica", "bold").setFontSize(10).text(d.partyLabel, M, y); }
  doc.setFont("helvetica", "normal").setFontSize(9);
  d.partyLines.filter(Boolean).forEach((l, i) => { doc.setFont("helvetica", i === 0 ? "bold" : "normal"); y += 13; doc.text(String(l), M, y); });

  // meta box (right)
  autoTable(doc, {
    startY: titleY + 24,
    margin: { left: W - MR - 220 },
    tableWidth: 220,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", halign: "right", fillColor: fill, textColor: fillText } },
    body: d.meta,
  });

  let cursor = Math.max(y, (doc as any).lastAutoTable?.finalY || 0) + 24;

  if (d.bigAmount) {
    doc.setDrawColor(210).line(M, cursor, W - M, cursor);
    cursor += 28;
    doc.setFont("helvetica", "normal").setFontSize(10).text(d.bigAmount.label, W / 2, cursor, { align: "center" });
    cursor += 26;
    doc.setFont("helvetica", "bold").setFontSize(20).text(d.bigAmount.value, W / 2, cursor, { align: "center" });
    cursor += 20;
  }

  if (d.itemRows && d.itemHead) {
    autoTable(doc, {
      startY: cursor,
      margin: { left: M, right: MR },
      theme: "grid",
      headStyles: { fillColor: fill, textColor: fillText, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4 },
      head: [d.itemHead],
      body: d.itemRows.length ? d.itemRows : [["", "No items", "", "", "", ""]],
    });
    cursor = (doc as any).lastAutoTable.finalY + 16;
  }

  if (d.totals && d.totals.length) {
    autoTable(doc, {
      startY: cursor,
      margin: { left: W - MR - 220 },
      tableWidth: 220,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
      body: d.totals,
    });
    cursor = (doc as any).lastAutoTable.finalY + 16;
  }

  if (d.note && (d.note.value || "").trim()) {
    doc.setFont("helvetica", "bold").setFontSize(10).text(d.note.label, M, cursor + 6);
    doc.setFont("helvetica", "normal").setFontSize(9).text(doc.splitTextToSize(d.note.value, W - 2 * M), M, cursor + 20);
  }

  doc.save(`${safe(d.filename)}.pdf`);
}
