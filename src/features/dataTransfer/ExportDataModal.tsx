import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import { exportModuleById, type ExportModuleId } from "./modules";
import { runExportDownload, type ExportDownloadFormat } from "./exportRunner";

type Step = "fields" | "format";

type Props = {
  moduleId: ExportModuleId;
  onClose: () => void;
};

const FORMAT_OPTIONS: { id: ExportDownloadFormat; label: string }[] = [
  { id: "pdf", label: "PDF" },
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "XLSX" },
  { id: "xls", label: "XLS" },
  { id: "excel", label: "Excel" },
];

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

export const ExportDataModal: React.FC<Props> = ({ moduleId, onClose }) => {
  const mod = useMemo(() => exportModuleById(moduleId), [moduleId]);
  const [step, setStep] = useState<Step>("fields");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(mod.fields.map((f) => f.key)),
  );
  const [format, setFormat] = useState<ExportDownloadFormat>("xlsx");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStep("fields");
    setSelected(new Set(mod.fields.map((f) => f.key)));
    setFormat("xlsx");
  }, [mod]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const allSelected = selected.size === mod.fields.length && mod.fields.length > 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(mod.fields.map((f) => f.key)));
  };

  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onNext = async () => {
    if (step === "fields") {
      if (!selected.size) {
        showToast("Select at least one field", "info");
        return;
      }
      setStep("format");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const count = await runExportDownload(moduleId, [...selected], format);
      const label = FORMAT_OPTIONS.find((o) => o.id === format)?.label || format.toUpperCase();
      showToast(`Exported ${count} row${count === 1 ? "" : "s"} as ${label}`, "success");
      onClose();
    } catch (err) {
      showToast(errMsg(err, "Export failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-5 py-3 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{mod.title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onNext()}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === "fields" ? "Next" : "Export"}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {step === "fields" ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[280px]">
              <div className="space-y-1">
                {mod.fields.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(f.key)}
                      onChange={() => toggleOne(f.key)}
                      className="rounded border-gray-400"
                    />
                    <span className="text-sm text-gray-800">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 shrink-0">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-400"
                />
                <span className="text-sm font-medium text-gray-900">Select All</span>
              </label>
            </div>
          </>
        ) : (
          <div className="px-5 py-6 space-y-4">
            <p className="text-sm text-gray-600">
              {selected.size} field{selected.size === 1 ? "" : "s"} selected. Choose download format:
            </p>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer ${
                    format === opt.id ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    checked={format === opt.id}
                    onChange={() => setFormat(opt.id)}
                  />
                  <span className="text-sm text-gray-900">{opt.label}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep("fields")}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              ← Back to fields
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportDataModal;
