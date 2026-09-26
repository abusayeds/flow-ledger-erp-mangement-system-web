/**
 * File: src/lib/db/ImportModal.tsx
 * Global "Import <Entity>" modal (matches the reference design). Mounted once
 * in the layout; opened by any list page's ⋮ → Import via a window event
 * (`demo:import`, detail = entity title) so no per-page wiring/state is needed.
 */

import React, { useEffect, useState } from "react";

export const ImportModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Records");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const h = (e: Event) => { setTitle((e as CustomEvent).detail || "Records"); setFileName(""); setOpen(true); };
    window.addEventListener("demo:import", h);
    return () => window.removeEventListener("demo:import", h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={() => setOpen(false)}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg my-24 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Import {title}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={() => setOpen(false)} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Next</button>
          </div>
        </div>
        <div className="p-5">
          <label className="block border-2 border-dashed border-gray-300 rounded-lg py-12 text-center cursor-pointer hover:border-gray-400">
            <input type="file" accept=".csv,.tsv,.xlsx,.xls" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
            {fileName ? (
              <div className="text-sm font-semibold text-gray-900">{fileName}</div>
            ) : (
              <>
                <div className="text-sm font-semibold text-gray-900">Please choose a file.</div>
                <div className="text-xs text-gray-500 mt-1">You can upload CSV, TSV, XLSX, XLS files.</div>
              </>
            )}
          </label>
          <button className="mt-4 text-sm text-blue-600 hover:text-blue-700">Download a formatted template</button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
