/**
 * Report export helpers — CSV, XLSX, XLS, PDF, HTML from a normalized grid.
 * PDF layout matches client-style report: green frame, orange title, company
 * block, date/total/from/to box, optional group headers (Vendor/Customer/…).
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "@/lib/api/client";

export type ExportGrid = {
  name: string;
  cols: string[];
  rows: string[][];
  totals?: string[];
  metaLines?: string[];
  meta?: { from?: string; to?: string; asOf?: string };
  /** Column label to group PDF/HTML tables by (e.g. "Vendor"). */
  groupByLabel?: string;
};

const QAYD_FOOTER = "Created by Qayd";
const QAYD_LOGO_URL = "/qayd.png";

/** Client PDF palette */
const GREEN: [number, number, number] = [124, 179, 66];
const GREEN_SOFT: [number, number, number] = [200, 230, 160];
const ORANGE: [number, number, number] = [230, 160, 40];
const GRAY_BAR: [number, number, number] = [210, 210, 210];
const GRAY_BOX: [number, number, number] = [236, 236, 236];
const TEXT_DARK: [number, number, number] = [40, 40, 40];

const safeName = (name: string) => name.replace(/[^\w\-]+/g, "_").slice(0, 80) || "report";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const sheetMatrix = (grid: ExportGrid): string[][] => {
  const matrix: string[][] = [];
  if (grid.metaLines?.length) {
    grid.metaLines.forEach((line) => matrix.push([line]));
    matrix.push([]);
  }
  matrix.push(grid.cols);
  grid.rows.forEach((r) => matrix.push(r));
  if (grid.totals?.length) matrix.push(grid.totals);
  return matrix;
};

const fmtDisplayDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const todayDisplay = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

let cachedLogoDataUrl: string | null | undefined;

async function loadQaydLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const res = await fetch(QAYD_LOGO_URL);
    if (!res.ok) {
      cachedLogoDataUrl = null;
      return null;
    }
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

type CompanyInfo = { name: string; address: string; email: string };

async function loadCompanyInfo(): Promise<CompanyInfo> {
  try {
    const me = await api.get<any>("/user/my-profile");
    const name =
      String(me?.businessProfile?.companyName || me?.name || "Company").trim() || "Company";
    const address =
      String(
        me?.businessProfile?.billing_address?.country ||
          me?.businessProfile?.company_address ||
          me?.address ||
          "",
      ).trim() || "";
    const email = String(me?.email || "").trim();
    return { name, address, email };
  } catch {
    return { name: "Company", address: "", email: "" };
  }
}

function drawQaydFooter(doc: InstanceType<typeof jsPDF>, logoDataUrl: string | null) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logoSize = 5;
  const gap = 2;
  const footerY = pageH - 7;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(153, 153, 153);
    if (logoDataUrl) {
      const textW = doc.getTextWidth(QAYD_FOOTER);
      const totalW = logoSize + gap + textW;
      const startX = (pageW - totalW) / 2;
      try {
        doc.addImage(logoDataUrl, "PNG", startX, footerY - logoSize + 1.5, logoSize, logoSize);
        doc.text(QAYD_FOOTER, startX + logoSize + gap, footerY);
      } catch {
        doc.text(QAYD_FOOTER, pageW / 2, footerY, { align: "center" });
      }
    } else {
      doc.text(QAYD_FOOTER, pageW / 2, footerY, { align: "center" });
    }
  }
}

function resolveGroupCol(grid: ExportGrid): number {
  if (grid.groupByLabel) {
    const i = grid.cols.findIndex((c) => c === grid.groupByLabel);
    if (i >= 0) return i;
  }
  return -1;
}

/** Pick a reasonable "Total" string for the header box. */
function headerTotal(grid: ExportGrid): string {
  const totals = grid.totals || [];
  for (let i = totals.length - 1; i >= 0; i--) {
    const t = String(totals[i] || "").trim();
    if (t && /[\d$৳]/.test(t) && !/^total/i.test(t)) {
      // Prefer first currency line if multiline
      return t.split("\n")[0];
    }
  }
  // Sum last numeric-looking cells across rows for money cols
  return "—";
}

function isMoneyCol(label: string) {
  const l = label.toLowerCase();
  return (
    l.includes("tax") ||
    l.includes("total") ||
    l.includes("amount") ||
    l.includes("price") ||
    l.includes("cost") ||
    l.includes("paid") ||
    l.includes("due") ||
    l.includes("sales") ||
    l.includes("shipping") ||
    l.includes("sub total") ||
    l.includes("value") ||
    l.includes("rate") ||
    l.includes("discount") ||
    l.includes("balance")
  );
}

function groupRows(grid: ExportGrid, groupCol: number) {
  const map = new Map<string, string[][]>();
  const order: string[] = [];
  for (const row of grid.rows) {
    const key = String(row[groupCol] || "").trim() || "—";
    // Skip fake company-header-only rows (PO By Company first row)
    const rest = row.filter((_, i) => i !== groupCol).join("").trim();
    if (!rest && key && !/\d/.test(key)) continue;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(row);
  }
  return order.map((k) => ({ key: k, rows: map.get(k)! }));
}

function stripCol(row: string[], col: number) {
  return row.filter((_, i) => i !== col);
}

function parseMoneyBag(cell: string): Record<string, number> {
  const bag: Record<string, number> = {};
  String(cell || "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const m = line.match(/([৳$€]?)\s*([\d,.-]+)\s*([A-Z]{3})?/);
      if (!m) return;
      const amt = Number(String(m[2]).replace(/,/g, "")) || 0;
      let cur = (m[3] || "").toUpperCase();
      if (!cur) {
        if (m[1] === "৳") cur = "BDT";
        else if (m[1] === "$") cur = "USD";
        else cur = "USD";
      }
      bag[cur] = (bag[cur] || 0) + amt;
    });
  return bag;
}

function formatMoneyBag(bag: Record<string, number>): string {
  const entries = Object.entries(bag).filter(([, v]) => Math.abs(v) > 0.0001);
  if (!entries.length) return "";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, amt]) => {
      const formatted = Math.abs(amt).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sign = amt < 0 ? "-" : "";
      if (cur === "BDT") return `${sign}৳${formatted} BDT`;
      if (cur === "USD") return `${sign}$${formatted} USD`;
      return `${sign}${formatted} ${cur}`;
    })
    .join("\n");
}

function sumGroupMoney(rows: string[][], displayCols: string[], fullCols: string[], _groupCol: number) {
  const out = displayCols.map(() => "");
  displayCols.forEach((label, di) => {
    if (!isMoneyCol(label)) return;
    const fullIdx = fullCols.findIndex((c) => c === label);
    if (fullIdx < 0) return;
    const bag: Record<string, number> = {};
    rows.forEach((r) => {
      const part = parseMoneyBag(String(r[fullIdx] || ""));
      Object.entries(part).forEach(([c, v]) => {
        bag[c] = (bag[c] || 0) + v;
      });
    });
    out[di] = formatMoneyBag(bag);
  });
  return out;
}

/** Build the same jsPDF document used for download / preview / print. */
export async function buildReportPdfDoc(grid: ExportGrid) {
  const landscape = grid.cols.length > 7;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const [company, logo] = await Promise.all([loadCompanyInfo(), loadQaydLogoDataUrl()]);

  const drawFrame = () => {
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.8);
    doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2 - 4);
  };

  drawFrame();

  // Title
  const title = grid.name.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...ORANGE);
  doc.text(title, pageW / 2, margin + 12, { align: "center" });

  // Company block (left)
  let y = margin + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ORANGE);
  doc.text(company.name, margin + 6, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (company.address) {
    doc.text(company.address, margin + 6, y);
    y += 4;
  }
  if (company.email) {
    doc.text(company.email, margin + 6, y);
    y += 4;
  }

  // Info box (right)
  const boxW = 58;
  const boxX = pageW - margin - 6 - boxW;
  const boxY = margin + 16;
  const rowsInfo: [string, string][] = [
    ["Date", todayDisplay()],
    ["Total", headerTotal(grid)],
    ["From", fmtDisplayDate(grid.meta?.from || grid.meta?.asOf)],
    ["To", fmtDisplayDate(grid.meta?.to || grid.meta?.asOf || new Date().toISOString().slice(0, 10))],
  ];
  const rowH = 6;
  const boxH = rowsInfo.length * rowH;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.3);
  doc.setFillColor(...GRAY_BOX);
  doc.rect(boxX, boxY, boxW, boxH, "FD");
  rowsInfo.forEach(([k, v], i) => {
    const ry = boxY + i * rowH;
    doc.setFillColor(...GRAY_BOX);
    doc.rect(boxX, ry, 18, rowH, "F");
    doc.setDrawColor(...GREEN);
    doc.rect(boxX, ry, boxW, rowH);
    doc.line(boxX + 18, ry, boxX + 18, ry + rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_DARK);
    doc.text(k, boxX + 1.5, ry + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ORANGE);
    const val = String(v).split("\n")[0];
    doc.text(val.length > 28 ? `${val.slice(0, 26)}…` : val, boxX + 19.5, ry + 4);
  });

  let cursorY = Math.max(y, boxY + boxH) + 6;
  const groupCol = resolveGroupCol(grid);
  const displayCols = groupCol >= 0 ? grid.cols.filter((_, i) => i !== groupCol) : grid.cols;
  const moneyIdx = new Set(displayCols.map((c, i) => (isMoneyCol(c) ? i : -1)).filter((i) => i >= 0));

  const tableTheme = {
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: ORANGE as [number, number, number],
      lineColor: GREEN as [number, number, number],
      lineWidth: 0.2,
      overflow: "linebreak" as const,
    },
    headStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: GREEN as [number, number, number],
      fontStyle: "bold" as const,
      lineColor: GREEN as [number, number, number],
      lineWidth: 0.25,
    },
    bodyStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255] as [number, number, number],
    },
    columnStyles: Object.fromEntries(
      [...moneyIdx].map((i) => [i, { halign: "right" as const }]),
    ),
    margin: { left: margin + 4, right: margin + 4, bottom: 14 },
  };

  const ensureSpace = (need: number) => {
    if (cursorY + need > pageH - 16) {
      doc.addPage();
      drawFrame();
      cursorY = margin + 8;
    }
  };

  if (groupCol >= 0) {
    const groups = groupRows(grid, groupCol);
    for (const g of groups) {
      ensureSpace(28);
      // Group header bar
      doc.setFillColor(...GRAY_BAR);
      doc.setDrawColor(...GREEN);
      doc.rect(margin + 4, cursorY, pageW - margin * 2 - 8, 7, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_DARK);
      doc.text(g.key, margin + 6, cursorY + 4.8);
      cursorY += 8;

      const body = g.rows.map((r) => stripCol(r, groupCol).map((c) => String(c || "").replace(/\n/g, " | ")));
      const gTot = sumGroupMoney(g.rows, displayCols, grid.cols, groupCol).map((c) =>
        String(c || "").replace(/\n/g, " | "),
      );
      // Only append group total if more than one data row
      if (g.rows.length > 1) {
        const hasMoney = gTot.some((t, i) => i > 0 && t);
        if (hasMoney) body.push(gTot);
      }

      autoTable(doc, {
        startY: cursorY,
        head: [displayCols],
        body,
        ...tableTheme,
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index === body.length - 1 && g.rows.length > 1) {
            data.cell.styles.fillColor = GRAY_BOX;
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 5;
    }
  } else {
    ensureSpace(20);
    const body = grid.rows.map((r) => r.map((c) => String(c || "").replace(/\n/g, " | ")));
    if (grid.totals?.length) {
      body.push(grid.totals.map((c) => String(c || "").replace(/\n/g, " | ")));
    }
    autoTable(doc, {
      startY: cursorY,
      head: [displayCols],
      body,
      ...tableTheme,
      didParseCell: (data) => {
        if (grid.totals?.length && data.section === "body" && data.row.index === body.length - 1) {
          data.cell.styles.fillColor = GRAY_BOX;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  drawQaydFooter(doc, logo);
  // Redraw frame on every page (footer pass already iterated pages)
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    drawFrame();
  }
  drawQaydFooter(doc, logo);

  return doc;
}

export async function buildReportPdfBlob(grid: ExportGrid): Promise<Blob> {
  const doc = await buildReportPdfDoc(grid);
  return doc.output("blob");
}

export async function buildReportPdfObjectUrl(grid: ExportGrid): Promise<string> {
  const blob = await buildReportPdfBlob(grid);
  return URL.createObjectURL(blob);
}

export function exportReportCsv(grid: ExportGrid) {
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = sheetMatrix(grid).map((row) => row.map(escape).join(","));
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${safeName(grid.name)}.csv`);
}

export function exportReportXlsx(grid: ExportGrid, bookType: "xlsx" | "xls" = "xlsx") {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetMatrix(grid));
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const primary = XLSX.write(wb, { bookType: bookType === "xls" ? "biff8" : "xlsx", type: "array" });
  const out =
    primary && (primary as ArrayBuffer | Uint8Array).byteLength
      ? primary
      : XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const mime =
    bookType === "xls"
      ? "application/vnd.ms-excel"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  downloadBlob(new Blob([out], { type: mime }), `${safeName(grid.name)}.${bookType}`);
}

export function exportReportHtml(grid: ExportGrid) {
  const groupCol = resolveGroupCol(grid);
  const displayCols = groupCol >= 0 ? grid.cols.filter((_, i) => i !== groupCol) : grid.cols;
  const th = displayCols
    .map((c) => `<th style="border:1px solid #7CB342;padding:6px;color:#7CB342;text-align:left;background:#fff">${escapeHtml(c)}</th>`)
    .join("");

  let tables = "";
  if (groupCol >= 0) {
    for (const g of groupRows(grid, groupCol)) {
      const body = g.rows
        .map(
          (r) =>
            `<tr>${stripCol(r, groupCol)
              .map((c) => `<td style="border:1px solid #7CB342;padding:6px;color:#E6A028">${escapeHtml(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      tables += `<div style="background:#d2d2d2;padding:6px 10px;font-weight:700;margin-top:12px;border:1px solid #7CB342">${escapeHtml(g.key)}</div>
<table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:4px"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
    }
  } else {
    const body = grid.rows
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td style="border:1px solid #7CB342;padding:6px;color:#E6A028">${escapeHtml(c)}</td>`).join("")}</tr>`,
      )
      .join("");
    const tot =
      grid.totals?.length
        ? `<tr style="font-weight:700;background:#ececec">${grid.totals.map((c) => `<td style="border:1px solid #7CB342;padding:6px;color:#E6A028">${escapeHtml(c)}</td>`).join("")}</tr>`
        : "";
    tables = `<table style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr>${th}</tr></thead><tbody>${body}${tot}</tbody></table>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(grid.name)}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;padding:24px;background:#f5f5f5">
<div style="background:#fff;border:2px solid #7CB342;padding:20px;max-width:1100px;margin:0 auto">
  <h1 style="text-align:center;color:#E6A028;letter-spacing:1px;margin:0 0 16px">${escapeHtml(grid.name.toUpperCase())}</h1>
  ${tables}
  <div style="margin-top:28px;text-align:center;color:#999;font-size:12px">
    <img src="${QAYD_LOGO_URL}" alt="Qayd" style="height:14px;vertical-align:middle;margin-right:6px"/>Created by Qayd
  </div>
</div>
</body></html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${safeName(grid.name)}.html`);
}

export async function exportReportPdf(grid: ExportGrid) {
  const doc = await buildReportPdfDoc(grid);
  doc.save(`${safeName(grid.name)}.pdf`);
}

export async function printReportPdf(grid: ExportGrid) {
  const url = await buildReportPdfObjectUrl(grid);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    return;
  }
  const revoke = () => URL.revokeObjectURL(url);
  w.addEventListener("load", () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
    setTimeout(revoke, 60_000);
  });
  setTimeout(revoke, 120_000);
}

export async function emailReportPdf(grid: ExportGrid) {
  const subject = encodeURIComponent(grid.name);
  const body = encodeURIComponent(
    `Please find the ${grid.name} attached after download.\n\n(Use Download from the report preview, then attach the PDF to your email.)`,
  );
  await exportReportPdf(grid);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

/** Suggested PDF group column per report title. */
export function suggestGroupByLabel(reportName: string): string | undefined {
  const map: Record<string, string> = {
    "Purchase Order Report": "Vendor",
    "Purchase Order By Company": "Vendor",
    "Bill Report": "Vendor",
    "Payment Made Report": "Vendor",
    "Expense Report": "Vendor",
    "Sales Report": "Customer",
    "Estimate Report": "Customer",
    "Payment Report": "Customer",
    "Stock Report": "Category",
    "Sales by Category Report": "Category Name",
  };
  return map[reportName];
}

const escapeHtml = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
