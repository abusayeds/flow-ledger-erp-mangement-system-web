import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import { importModuleById, type ImportModuleId } from "./modules";
import { downloadImportTemplate, parseImportFile } from "./exportRunner";

type Step = "upload" | "preview";

type Props = {
  moduleId: ImportModuleId;
  onClose: () => void;
};

const ACCEPT = ".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const ImportDataModal: React.FC<Props> = ({ moduleId, onClose }) => {
  const mod = useMemo(() => importModuleById(moduleId), [moduleId]);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
  }, [mod]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const ok = /\.(csv|tsv|xlsx|xls)$/i.test(f.name);
    if (!ok) {
      showToast("Please choose a CSV, TSV, XLSX, or XLS file", "error");
      return;
    }
    setFile(f);
  };

  const onNext = async () => {
    if (step === "upload") {
      if (!file) {
        showToast("Please choose a file", "info");
        return;
      }
      setBusy(true);
      try {
        const parsed = await parseImportFile(file);
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setStep("preview");
        if (!parsed.rows.length) showToast("File has no data rows", "info");
      } catch {
        showToast("Couldn't read that file", "error");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Preview → finish (frontend parse/preview; bulk create has no dedicated import API)
    showToast(
      `Parsed ${rows.length} row${rows.length === 1 ? "" : "s"} for ${mod.label}. Bulk create uses existing module screens until an import API is added.`,
      "success",
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
              {step === "upload" ? "Next" : "Finish"}
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {step === "upload" ? (
          <div className="px-6 py-8">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`w-full rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
                dragOver ? "border-blue-600 bg-blue-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
              }`}
            >
              <FileUp className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                {file ? file.name : "Please choose a file."}
              </p>
              <p className="text-xs text-gray-500">
                You can upload CSV, TSV, XLSX, XLS files.
              </p>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadImportTemplate(
                  mod.templateHeaders,
                  `${mod.id}-import-template.xlsx`,
                )
              }
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              Download a formatted template
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-5 py-4 min-h-0">
            <p className="text-sm text-gray-600 mb-3">
              Preview · {rows.length} row{rows.length === 1 ? "" : "s"} · {file?.name}
            </p>
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">
                        {h || "—"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {headers.map((_, j) => (
                        <td key={j} className="px-3 py-2 text-gray-800 whitespace-nowrap">
                          {row[j] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && (
              <p className="text-xs text-gray-500 mt-2">Showing first 50 rows.</p>
            )}
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportDataModal;
