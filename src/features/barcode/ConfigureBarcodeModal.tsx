import React, { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { BarcodeConfig } from "./types";
import { DEFAULT_BARCODE_CONFIG } from "./types";

const fieldClass = "ua-field keep-box w-full px-3 py-2 text-sm focus:outline-none";

type Props = {
  open: boolean;
  initial: BarcodeConfig;
  onClose: () => void;
  onSave: (config: BarcodeConfig) => void;
};

export const ConfigureBarcodeModal: React.FC<Props> = ({
  open,
  initial,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<BarcodeConfig>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const patch = (p: Partial<BarcodeConfig>) => setDraft((d) => ({ ...d, ...p }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">Configure Barcode</h3>
          <button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-gray-200 text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-3">
          <Field label="Print Mode">
            <select className={fieldClass} value={draft.printMode} onChange={(e) => patch({ printMode: e.target.value as BarcodeConfig["printMode"] })}>
              <option value="Normal">Normal</option>
              <option value="Thermal">Thermal</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Box Height">
              <input type="number" className={fieldClass} value={draft.boxHeight} onChange={(e) => patch({ boxHeight: Number(e.target.value) || 0 })} />
              <span className="text-xs text-gray-500 mt-0.5">mm</span>
            </Field>
            <Field label="Box Width">
              <input type="number" className={fieldClass} value={draft.boxWidth} onChange={(e) => patch({ boxWidth: Number(e.target.value) || 0 })} />
              <span className="text-xs text-gray-500 mt-0.5">mm</span>
            </Field>
            <Field label="Bar Height">
              <input type="number" className={fieldClass} value={draft.barHeight} onChange={(e) => patch({ barHeight: Number(e.target.value) || 0 })} />
              <span className="text-xs text-gray-500 mt-0.5">mm</span>
            </Field>
            <Field label="Bar Width">
              <select className={fieldClass} value={draft.barWidth} onChange={(e) => patch({ barWidth: e.target.value })}>
                {["1 mm", "2 mm", "3 mm", "4 mm"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Barcode Type">
            <select className={fieldClass} value={draft.barcodeType} onChange={(e) => patch({ barcodeType: e.target.value })}>
              {["CODE128", "CODE39", "EAN13", "EAN8", "UPC"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Text">
              <select className={fieldClass} value={draft.text} onChange={(e) => patch({ text: e.target.value as BarcodeConfig["text"] })}>
                <option value="Show">Show</option>
                <option value="Hide">Hide</option>
              </select>
            </Field>
            <Field label="Font Size">
              <select className={fieldClass} value={draft.fontSize} onChange={(e) => patch({ fontSize: e.target.value as BarcodeConfig["fontSize"] })}>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </Field>
            <Field label="Text Alignment">
              <select className={fieldClass} value={draft.textAlignment} onChange={(e) => patch({ textAlignment: e.target.value as BarcodeConfig["textAlignment"] })}>
                <option value="Left">Left</option>
                <option value="Center">Center</option>
                <option value="Right">Right</option>
              </select>
            </Field>
            <Field label="Barcode Alignment">
              <select className={fieldClass} value={draft.barcodeAlignment} onChange={(e) => patch({ barcodeAlignment: e.target.value as BarcodeConfig["barcodeAlignment"] })}>
                <option value="Left">Left</option>
                <option value="Center">Center</option>
                <option value="Right">Right</option>
              </select>
            </Field>
          </div>
          <Field label="Paper Size">
            <select className={fieldClass} value={draft.paperSize} onChange={(e) => patch({ paperSize: e.target.value as BarcodeConfig["paperSize"] })}>
              <option value="A4 Paper">A4 Paper</option>
              <option value="Letter">Letter</option>
              <option value="Thermal Roll">Thermal Roll</option>
            </select>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-300 bg-gray-50 px-5 py-3">
          <button
            type="button"
            title="Reset"
            onClick={() => setDraft({ ...DEFAULT_BARCODE_CONFIG })}
            className="p-2 rounded-md hover:bg-gray-200 text-gray-600"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
    {children}
  </label>
);

export default ConfigureBarcodeModal;
