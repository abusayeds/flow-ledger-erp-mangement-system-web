/**
 * Shared Attachment control for Sales / Purchase docs.
 * - Upload from Computer → POST /upload → file_path
 * - Upload from Document → pick an HRM document path
 * Parent persists the path on the record (Attachment / attachments).
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { documentsService } from "@/services/hrm";
import { resolveMediaUrl } from "@/lib/env";
import { showToast } from "@/utils/toast";
import { api } from "@/lib/api/client";

export type DocAttachmentValue = {
  path: string;
  name?: string;
};

type Props = {
  value?: string | null;
  onChange: (path: string, meta?: { name?: string }) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  /** Compact padding for form layouts */
  compact?: boolean;
  label?: string;
};

async function uploadFile(file: File): Promise<{ path: string; name: string }> {
  const formData = new FormData();
  formData.append("files", file);
  const uploadRes = await api.raw.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = uploadRes.data?.data ?? uploadRes.data;
  const row = Array.isArray(data) ? data[0] : data;
  const path = String(row?.file_path || row?.path || "").trim();
  if (!path) throw new Error("Upload did not return a file path");
  return { path, name: String(row?.file_name || file.name) };
}

function fileLabel(path: string): string {
  try {
    const base = path.split("?")[0].split("#")[0].split("/").pop() || path;
    return decodeURIComponent(base);
  } catch {
    return path;
  }
}

type DocRow = { id: string; title: string; path: string; name: string };

export const DocAttachmentField: React.FC<Props> = ({
  value,
  onChange,
  disabled,
  className = "",
  compact,
  label = "Attachment",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const path = String(value || "").trim();
  const href = path ? resolveMediaUrl(path) : "";
  const py = compact ? "py-4" : "py-5";

  const apply = async (next: string, name?: string) => {
    setBusy(true);
    try {
      await onChange(next, name ? { name } : undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save attachment", "error");
    } finally {
      setBusy(false);
    }
  };

  const onComputer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || disabled) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(file);
      await onChange(uploaded.path, { name: uploaded.name });
      showToast("Attachment uploaded", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setDocsLoading(true);
    documentsService
      .list({ limit: 100 })
      .then((rows) => {
        if (cancelled) return;
        const mapped = (rows || [])
          .map((d: any) => {
            const p = String(d.document ?? d.document_url ?? d.documentUrl ?? "").trim();
            if (!p) return null;
            return {
              id: String(d.id ?? d._id ?? ""),
              title: String(d.title || "Document"),
              path: p,
              name: String(d.file_name || d.fileName || fileLabel(p)),
            } as DocRow;
          })
          .filter(Boolean) as DocRow[];
        setDocs(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setDocs([]);
          showToast("Could not load documents", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen]);

  const filtered = docs.filter((d) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return d.title.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
  });

  return (
    <div className={className}>
      {label ? <label className="text-xs text-gray-500">{label}</label> : null}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onComputer}
        disabled={disabled || busy}
      />

      {path ? (
        <div className={`${label ? "mt-1" : ""} flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2.5 bg-white`}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 min-w-0 flex-1 text-sm text-blue-600 hover:underline"
            title={fileLabel(path)}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{fileLabel(path)}</span>
          </a>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void apply("")}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500"
            title="Remove attachment"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div
          className={`${label ? "mt-1" : ""} grid grid-cols-2 border border-gray-200 rounded-md divide-x divide-gray-200 ${
            disabled || busy ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center gap-2 ${py} hover:bg-gray-50 transition-colors`}
          >
            <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </span>
            <span className="text-xs text-gray-600">Upload from Computer</span>
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={`flex flex-col items-center gap-2 ${py} hover:bg-gray-50 transition-colors`}
          >
            <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-xs text-gray-600">Upload from Document</span>
          </button>
        </div>
      )}

      {pickerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPickerOpen(false);
            }}
          >
            <div className="w-full max-w-lg my-10 rounded-lg bg-white border border-gray-200 shadow-2xl overflow-hidden">
              <div className="h-12 px-4 flex items-center justify-between border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Choose Document</h3>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 border-b border-gray-100">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                {docsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-400">No documents found</div>
                ) : (
                  filtered.map((d) => (
                    <button
                      key={d.id || d.path}
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      onClick={async () => {
                        setPickerOpen(false);
                        setBusy(true);
                        try {
                          await onChange(d.path, { name: d.name });
                          showToast("Attachment linked", "success");
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : "Could not attach", "error");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <span className="w-9 h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">{d.title}</span>
                        <span className="block text-xs text-gray-500 truncate">{d.name}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default DocAttachmentField;
