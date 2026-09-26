import React, { useEffect, useMemo } from "react";
import { Download, Printer, X } from "lucide-react";
import { BarcodeLabelCard } from "./BarcodeSvg";
import type { BarcodeConfig, BarcodeRow } from "./types";

type Props = {
  open: boolean;
  rows: BarcodeRow[];
  config: BarcodeConfig;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
};

export const BarcodePreviewModal: React.FC<Props> = ({
  open,
  rows,
  config,
  onClose,
  onDownload,
  onPrint,
}) => {
  const labels = useMemo(() => {
    const out: BarcodeRow[] = [];
    for (const row of rows) {
      const n = Math.max(1, row.labels || 1);
      for (let i = 0; i < n; i++) out.push(row);
    }
    return out;
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">Preview</h3>
          <div className="flex items-center gap-1">
            <button type="button" title="Download" onClick={onDownload} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
              <Download className="w-5 h-5" />
            </button>
            <button type="button" title="Print" onClick={onPrint} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
              <Printer className="w-5 h-5" />
            </button>
            <button type="button" title="Close" onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div id="barcode-preview-print" className="flex-1 overflow-y-auto bg-white p-6">
          {labels.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-16">No labels to preview.</p>
          ) : (
            <div
              className={`grid gap-4 ${
                config.printMode === "Thermal" ? "grid-cols-1 max-w-xs mx-auto" : "grid-cols-2 sm:grid-cols-3"
              }`}
            >
              {labels.map((row, idx) => (
                <BarcodeLabelCard
                  key={`${row.id}-${idx}`}
                  header={row.header}
                  sku={row.sku}
                  line1={row.line1}
                  line2={row.line2}
                  config={config}
                  light
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodePreviewModal;
