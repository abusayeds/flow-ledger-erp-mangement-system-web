/**
 * Settings → Generate Barcode — table + add panel + live preview +
 * Product Library / Configure / Preview / Delete flows.
 * Products searched via `/product/all` (debounced).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  Trash2,
  Settings,
  MoreVertical,
  Package,
  Loader2,
} from "lucide-react";
import { jsPDF } from "jspdf";
import JsBarcode from "jsbarcode";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import { fetchProducts, type ProductListRow } from "@/services/productsApi";
import { BarcodeLabelCard } from "./BarcodeSvg";
import { ConfigureBarcodeModal } from "./ConfigureBarcodeModal";
import { BarcodePreviewModal } from "./BarcodePreviewModal";
import { ProductLibraryModal } from "./ProductLibraryModal";
import { consumeImportQueue, loadBarcodeConfig, saveBarcodeConfig } from "./storage";
import {
  formatMoney,
  newRowId,
  rowFromImport,
  type BarcodeConfig,
  type BarcodeRow,
  type LibraryImportItem,
} from "./types";

const fieldClass = "ua-field keep-box w-full px-3 py-2 text-sm focus:outline-none";

const emptyDraft = () => ({
  itemName: "",
  sku: "",
  labels: 1,
  header: "",
  line1: "",
  line2: "",
  productId: "" as string | undefined,
  currency: "BDT",
});

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function expandLabels(rows: BarcodeRow[]): BarcodeRow[] {
  const out: BarcodeRow[] = [];
  for (const row of rows) {
    const n = Math.max(1, row.labels || 1);
    for (let i = 0; i < n; i++) out.push(row);
  }
  return out;
}

function drawBarcodeDataUrl(sku: string, config: BarcodeConfig): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, sku || "SKU", {
      format: config.barcodeType || "CODE128",
      displayValue: false,
      height: 48,
      width: 1.6,
      margin: 2,
      background: "#ffffff",
      lineColor: "#111111",
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function downloadPdf(rows: BarcodeRow[], config: BarcodeConfig) {
  const labels = expandLabels(rows);
  if (!labels.length) {
    showToast("Select products to generate", "info");
    return;
  }
  const thermal = config.printMode === "Thermal" || config.paperSize === "Thermal Roll";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: thermal ? [config.boxWidth || 90, config.boxHeight || 140] : "a4",
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const boxW = Math.min(config.boxWidth || 90, pageW - 10);
  const boxH = Math.min(config.boxHeight || 50, thermal ? pageH - 6 : 55);
  const cols = thermal ? 1 : Math.max(1, Math.floor((pageW - 10) / (boxW + 4)));
  const gap = 4;
  let col = 0;
  let rowY = 8;

  labels.forEach((label, idx) => {
    if (idx > 0 && thermal) doc.addPage();
    if (!thermal && col >= cols) {
      col = 0;
      rowY += boxH + gap;
      if (rowY + boxH > pageH - 8) {
        doc.addPage();
        rowY = 8;
      }
    }
    const x = thermal ? (pageW - boxW) / 2 : 8 + col * (boxW + gap);
    const y = thermal ? 6 : rowY;
    doc.setDrawColor(200);
    doc.rect(x, y, boxW, boxH);
    doc.setFontSize(10);
    doc.setTextColor(20);
    const align = config.textAlignment === "Left" ? "left" : config.textAlignment === "Right" ? "right" : "center";
    const tx = align === "left" ? x + 3 : align === "right" ? x + boxW - 3 : x + boxW / 2;
    if (label.header) doc.text(label.header, tx, y + 7, { align, maxWidth: boxW - 6 });
    const img = drawBarcodeDataUrl(label.sku, config);
    if (img) {
      const imgW = boxW - 10;
      const imgH = Math.min(18, boxH * 0.35);
      doc.addImage(img, "PNG", x + 5, y + 10, imgW, imgH);
    }
    doc.setFontSize(9);
    if (label.sku) doc.text(label.sku, tx, y + boxH - 12, { align });
    if (label.line1) doc.text(label.line1, tx, y + boxH - 6, { align });
    if (!thermal) col += 1;
  });

  doc.save("barcodes.pdf");
  showToast(`Generated PDF for ${labels.length} label${labels.length > 1 ? "s" : ""}`, "success");
}

function printLabels() {
  const el = document.getElementById("barcode-preview-print");
  if (!el) {
    showToast("Open preview to print", "info");
    return;
  }
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    showToast("Popup blocked — allow popups to print", "error");
    return;
  }
  win.document.write(
    `<!doctype html><html><head><title>Barcode Labels</title>
    <style>body{font-family:system-ui,sans-serif;margin:16px;background:#fff;color:#111}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    @media print{.grid{gap:8px}}</style></head><body>${el.innerHTML}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}

export const GenerateBarcodePanel: React.FC<{
  /** When true (settings → Product Library), open library modal on mount */
  openLibraryOnMount?: boolean;
}> = ({ openLibraryOnMount = false }) => {
  const [rows, setRows] = useState<BarcodeRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState(emptyDraft);
  const [config, setConfig] = useState<BarcodeConfig>(() => loadBarcodeConfig());

  const [suggest, setSuggest] = useState<ProductListRow[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);

  const [libraryOpen, setLibraryOpen] = useState(openLibraryOnMount);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const queued = consumeImportQueue<LibraryImportItem>();
    if (queued.length) {
      setRows((prev) => [...prev, ...queued.map(rowFromImport)]);
      showToast(`Imported ${queued.length} product${queued.length > 1 ? "s" : ""}`, "success");
    }
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
      setMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced product search
  useEffect(() => {
    const q = draft.itemName.trim();
    if (picked || q.length < 1) {
      setSuggest([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const { rows: found } = await fetchProducts({
          page: 1,
          limit: 12,
          searchTerm: q,
          sort: "productName",
        });
        setSuggest(found);
        setSuggestOpen(true);
      } catch (err) {
        setSuggest([]);
        showToast(errMsg(err, "Product search failed"), "error");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [draft.itemName, picked]);

  const selectedRows = useMemo(
    () => rows.filter((r) => checked.has(r.id)),
    [rows, checked],
  );
  const selectedCount = selectedRows.length;
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));

  const productAvailable = Boolean(draft.sku.trim() || draft.productId);

  const applyProduct = (p: ProductListRow) => {
    setPicked(true);
    setDraft({
      itemName: p.name,
      sku: p.sku === "—" ? "" : p.sku,
      labels: 1,
      header: p.name,
      line1: formatMoney(p.price, p.currency || "BDT"),
      line2: "",
      productId: p._id,
      currency: p.currency || "BDT",
    });
    setSuggestOpen(false);
    setSuggest([]);
  };

  const addRow = () => {
    if (!draft.itemName.trim() || !draft.sku.trim()) {
      showToast("Item Name and SKU are required", "info");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        id: newRowId(),
        productId: draft.productId,
        itemName: draft.itemName.trim(),
        sku: draft.sku.trim(),
        labels: Math.max(1, draft.labels || 1),
        header: draft.header.trim() || draft.itemName.trim(),
        line1: draft.line1.trim(),
        line2: draft.line2.trim(),
        currency: draft.currency,
      },
    ]);
    setDraft(emptyDraft());
    setPicked(false);
    showToast("Barcode row added", "success");
  };

  const importItems = useCallback((items: LibraryImportItem[]) => {
    setRows((prev) => [...prev, ...items.map(rowFromImport)]);
    showToast(`Imported ${items.length} product${items.length > 1 ? "s" : ""}`, "success");
  }, []);

  const toggleAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchRow = (id: string, patch: Partial<BarcodeRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const confirmDelete = () => {
    if (!selectedCount) {
      showToast("Select products to delete", "info");
      setDeleteOpen(false);
      return;
    }
    setRows((prev) => prev.filter((r) => !checked.has(r.id)));
    setChecked(new Set());
    setDeleteOpen(false);
    showToast("Selected products removed", "success");
  };

  const targetRows = selectedCount > 0 ? selectedRows : rows;

  const onCancel = () => {
    setChecked(new Set());
    setDraft(emptyDraft());
    setPicked(false);
    showToast("Selection cleared", "info");
  };

  return (
    <div className="flex flex-col gap-4 min-h-[520px]">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Generate Barcode</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create printable barcode labels from products</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <IconBtn title="Download" onClick={() => downloadPdf(targetRows, config)}>
            <Download className="w-5 h-5" />
          </IconBtn>
          <IconBtn
            title="Preview"
            onClick={() => {
              if (!targetRows.length) {
                showToast("Add or select products first", "info");
                return;
              }
              setPreviewOpen(true);
            }}
          >
            <Eye className="w-5 h-5" />
          </IconBtn>
          <IconBtn
            title="Delete"
            onClick={() => {
              if (!selectedCount) {
                showToast("Select products to delete", "info");
                return;
              }
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="w-5 h-5" />
          </IconBtn>
          <IconBtn title="Configure" onClick={() => setConfigureOpen(true)}>
            <Settings className="w-5 h-5" />
          </IconBtn>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => downloadPdf(selectedCount ? selectedRows : rows, config)}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Generate ({pad2(selectedCount || rows.length)})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-[220px] bg-gray-50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="rounded border-gray-400"
                  />
                </th>
                {["Item Name", "SKU", "No of Labels", "Header", "Line 1", "Line 2", "Action"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-24 text-center text-sm text-gray-500 bg-gray-50">
                    Product Not Available.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-100/80">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        className="rounded border-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">{row.itemName}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.sku}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={row.labels}
                        onChange={(e) =>
                          patchRow(row.id, { labels: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className={`${fieldClass} w-20`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.header}
                        onChange={(e) => patchRow(row.id, { header: e.target.value })}
                        className={fieldClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.line1}
                        onChange={(e) => patchRow(row.id, { line1: e.target.value })}
                        className={fieldClass}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.line2}
                        onChange={(e) => patchRow(row.id, { line2: e.target.value })}
                        className={fieldClass}
                      />
                    </td>
                    <td className="px-3 py-2 relative">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId((id) => (id === row.id ? null : row.id));
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuId === row.id && (
                        <div className="absolute right-2 z-10 mt-1 w-36 rounded-md border border-gray-300 bg-white shadow-lg py-1">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-gray-800"
                            onClick={() => {
                              setChecked(new Set([row.id]));
                              setPreviewOpen(true);
                              setMenuId(null);
                            }}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600"
                            onClick={() => {
                              setRows((prev) => prev.filter((r) => r.id !== row.id));
                              setChecked((prev) => {
                                const next = new Set(prev);
                                next.delete(row.id);
                                return next;
                              });
                              setMenuId(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Barcode */}
      <div className="border border-gray-200 rounded-lg p-4 sm:p-5 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-semibold text-gray-900">Add Barcode</h3>
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            <Package className="w-4 h-4" />
            Product Library
          </button>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
            <div className="relative" ref={searchWrapRef}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Item Name*</label>
              <input
                value={draft.itemName}
                onChange={(e) => {
                  setPicked(false);
                  setDraft((d) => ({ ...d, itemName: e.target.value }));
                }}
                onFocus={() => suggest.length && setSuggestOpen(true)}
                placeholder="Search product..."
                className={fieldClass}
                autoComplete="off"
              />
              {searching && (
                <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-8 text-gray-400" />
              )}
              {suggestOpen && suggest.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg">
                  {suggest.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => applyProduct(p)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-gray-900 truncate">{p.name}</span>
                      <span className="text-gray-600 shrink-0 whitespace-nowrap">
                        {formatMoney(p.price, p.currency || "BDT")} {p.currency || "BDT"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SKU*</label>
              <input
                value={draft.sku}
                onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">No of Labels*</label>
              <input
                type="number"
                min={1}
                value={draft.labels}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, labels: Math.max(1, Number(e.target.value) || 1) }))
                }
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Header</label>
              <input
                value={draft.header}
                onChange={(e) => setDraft((d) => ({ ...d, header: e.target.value }))}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Line 1</label>
              <input
                value={draft.line1}
                onChange={(e) => setDraft((d) => ({ ...d, line1: e.target.value }))}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Line 2</label>
              <input
                value={draft.line2}
                onChange={(e) => setDraft((d) => ({ ...d, line2: e.target.value }))}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="w-full xl:w-56 shrink-0 flex flex-col gap-3">
            {productAvailable || draft.itemName.trim() ? (
              <BarcodeLabelCard
                header={draft.header || draft.itemName}
                sku={draft.sku || "SKU"}
                line1={draft.line1}
                line2={draft.line2}
                config={config}
              />
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
                Product Not Available.
              </div>
            )}
            <button
              type="button"
              onClick={addRow}
              className="w-full px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <ProductLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onImport={importItems}
      />
      <ConfigureBarcodeModal
        open={configureOpen}
        initial={config}
        onClose={() => setConfigureOpen(false)}
        onSave={(c) => {
          setConfig(c);
          saveBarcodeConfig(c);
          setConfigureOpen(false);
          showToast("Barcode configuration saved", "success");
        }}
      />
      <BarcodePreviewModal
        open={previewOpen}
        rows={selectedCount ? selectedRows : rows}
        config={config}
        onClose={() => setPreviewOpen(false)}
        onDownload={() => downloadPdf(selectedCount ? selectedRows : rows, config)}
        onPrint={printLabels}
      />

      {deleteOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Alert</h3>
            </div>
            <div className="px-5 py-5 text-sm text-gray-700">
              Are you sure you want to delete selected Products?
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IconBtn: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
  >
    {children}
  </button>
);

export default GenerateBarcodePanel;
