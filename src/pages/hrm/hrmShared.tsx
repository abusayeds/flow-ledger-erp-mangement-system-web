/**
 * File: src/pages/hrm/hrmShared.tsx
 * Shared UI bits for the HRM module redesign (Employees / Set Salary / Payroll)
 * — searchable select (matches the ERPGO dropdown-with-search reference),
 * initials avatar, field wrapper and chip helpers. Qayd blue theme.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Search, FileText, Upload } from "lucide-react";
import { getList, toArray } from "@/services/_http";
import { employeesService } from "@/services/hrm";
import type { AsyncOption } from "@/components/ui/AsyncSearchSelect";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/env";
import { showToast } from "@/utils/toast";

const HRM_BASE = "/hrm";
const HRM_SETUP = `${HRM_BASE}/setup`;

/** Debounce input before sending `searchTerm` to list APIs. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Standard HRM list query: page 1, limit, optional debounced searchTerm. */
export function useHrmSearchListParams(
  searchQuery: string,
  limit = 100,
  extra?: Record<string, unknown>,
) {
  const debounced = useDebouncedValue(searchQuery.trim(), 300);
  return useMemo(
    () => ({
      page: 1,
      limit,
      ...(debounced ? { searchTerm: debounced } : {}),
      ...extra,
    }),
    [debounced, limit, extra],
  );
}

/* ── initials avatar ───────────────────────────────────────────── */

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

export function Avatar({ name, size = 9 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const color = AVATAR_COLORS[(name.charCodeAt(0) + name.length) % AVATAR_COLORS.length];
  return (
    <div
      className={`rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${color}`}
      style={{ width: size * 4, height: size * 4 }}
    >
      {initials}
    </div>
  );
}

/* ── labelled field wrapper ────────────────────────────────────── */

export function Field({
  label,
  required,
  children,
  hint,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

/** Native <select> — keep-box so dark theme option lists stay readable. */
export const selectCls = `keep-box ua-field ${inputCls}`;

/* ── searchable select (reference: dropdown with search box) ───── */

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  disabledPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        className={`keep-box ua-field w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm text-left ${
          disabled
            ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
            : open
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-white"
              : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {disabled ? disabledPlaceholder || placeholder : value || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {open && !disabled && (
        <div className="ua-dropdown-panel absolute left-0 right-0 top-full mt-1 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="relative border-b border-gray-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="keep-box ua-field w-full pl-9 pr-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  o === value ? "bg-blue-50 text-blue-700" : "text-gray-900"
                }`}
              >
                {o}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── status chips ──────────────────────────────────────────────── */

export function chipCls(kind: string): string {
  switch (kind) {
    case "Completed":
    case "Active":
    case "Paid":
    case "Approved":
      return "bg-green-100 text-green-700";
    case "Draft":
    case "Pending":
      return "bg-yellow-100 text-yellow-700";
    case "Unpaid":
    case "Rejected":
      return "bg-red-100 text-red-600";
    case "Inactive":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

export function Chip({ label }: { label: string }) {
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${chipCls(label)}`}>
      {label}
    </span>
  );
}

/* ── breadcrumb bar (matches CRM pages) ────────────────────────── */

export function HrmBreadcrumb({
  trail,
  current,
  onNavigate,
}: {
  trail: { label: string; to?: string }[];
  current: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {trail.map((t) => (
          <React.Fragment key={t.label}>
            <button
              onClick={() => t.to && onNavigate(t.to)}
              className={t.to ? "hover:text-gray-700" : "cursor-default"}
            >
              {t.label}
            </button>
            <span>›</span>
          </React.Fragment>
        ))}
        <span className="text-gray-900 font-medium">{current}</span>
      </div>
    </div>
  );
}

/* ── API label extraction ──────────────────────────────────────────
 * Backend records vary in which key holds the human-readable name
 * (name / type_name / warning_type / populated refs like
 * user_id: { name }). These helpers pick the first readable string and
 * never return a raw id — blank is preferred so callers can filter
 * empties and fall back to local lists instead of showing invisible
 * or id-only options. */
export const looksLikeId = (s: string) => /^[0-9a-f]{24}$/i.test(s) || /^\d+$/.test(s);

export function apiLabel(rec: any, keys: string[]): string {
  const readable = (v: any): string =>
    typeof v === "string" && v.trim() && !looksLikeId(v.trim()) ? v.trim() : "";
  for (const k of keys) {
    const v = rec?.[k];
    const direct = readable(v);
    if (direct) return direct;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const nk of ["name", "title", ...Object.keys(v)]) {
        if (nk === "_id" || nk.endsWith("_id")) continue;
        const nested = readable(v[nk]);
        if (nested) return nested;
      }
    }
  }
  // last resort: any readable field under a non-id, non-meta key
  for (const [k, v] of Object.entries(rec ?? {})) {
    if (k === "_id" || /_?ids?$/i.test(k) || /^(createdAt|updatedAt|status|color|isDeleted|isArchive)$/.test(k)) continue;
    const s = readable(v);
    if (s && !/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  }
  return "";
}

/** Extract User `_id` from an HRM employee profile (workflow refs use User ids). */
export function employeeUserId(rec: any): string {
  const u = rec?.employee_user_id ?? rec?.user_id;
  if (u && typeof u === "object") return String(u._id ?? u.id ?? "");
  if (u) return String(u);
  return String(rec?.id ?? rec?._id ?? "");
}

export function employeeOption(rec: any): { id: string; name: string } {
  return {
    id: employeeUserId(rec),
    name:
      apiLabel(rec, ["employee_user_id", "user_id", "name", "employee_name", "full_name"]) ||
      "Employee",
  };
}

/** Live employee search (User ids for workflow employee_id fields). */
export async function searchEmployees(q: string): Promise<AsyncOption[]> {
  const rows = await employeesService.list({
    page: 1,
    limit: 50,
    searchTerm: q || undefined,
  });
  return rows.map(employeeOption).filter((o) => o.id && o.name);
}

function setupOptions(rows: any[], labelKeys: string[]): AsyncOption[] {
  return rows
    .map((t) => ({
      id: String(t.id ?? t._id ?? ""),
      name: apiLabel(t, labelKeys),
    }))
    .filter((o) => o.id && o.name);
}

async function searchSetup(entity: string, labelKeys: string[], q: string): Promise<AsyncOption[]> {
  const rows = await getList(`${HRM_SETUP}/${entity}`, {
    page: 1,
    limit: 50,
    searchTerm: q || undefined,
  });
  return setupOptions(rows, labelKeys);
}

export const searchAwardTypes = (q: string) =>
  searchSetup("award-types", ["name", "award_type", "type_name", "title"], q);
export const searchTerminationTypes = (q: string) =>
  searchSetup("termination-types", ["name", "termination_type", "type_name"], q);
export const searchWarningTypes = (q: string) =>
  searchSetup("warning-types", ["name", "warning_type", "warning_type_name", "type_name"], q);
export const searchComplaintTypes = (q: string) =>
  searchSetup("complaint-types", ["name", "complaint_type", "type_name"], q);
export const searchDocumentCategories = (q: string) =>
  searchSetup("document-categories", ["name", "document_category", "category_name"], q);
export const searchAnnouncementCategories = (q: string) =>
  searchSetup("announcement-categories", ["name", "announcement_category", "category_name"], q);
export const searchEventTypes = (q: string) =>
  searchSetup("event-types", ["name", "event_type", "type_name"], q);
export const searchDocuments = (q: string) =>
  getList(`${HRM_BASE}/documents`, { page: 1, limit: 50, searchTerm: q || undefined }).then((rows) =>
    setupOptions(rows, ["title", "name"]),
  );
export const searchDepartmentsAll = (q: string) => searchDepartments(q);

export const searchBankAccounts = (q: string) =>
  getList("/account/bank-accounts/all", { page: 1, limit: 50, searchTerm: q || undefined }).then(
    (rows) =>
      toArray(rows).map((a: Record<string, unknown>) => ({
        id: String(a._id ?? a.id ?? ""),
        name: String(a.account_name || a.bank_name || a.name || ""),
      })).filter((o) => o.id && o.name),
  );
export const searchBranches = (q: string) =>
  searchSetup("branches", ["branch_name", "name"], q);
export const searchDepartments = (q: string, branchId?: string) =>
  getList(`${HRM_SETUP}/departments`, { page: 1, limit: 50, searchTerm: q || undefined }).then(
    (rows) =>
      setupOptions(
        branchId
          ? rows.filter((d: any) => {
              const bid =
                typeof d.branch_id === "object"
                  ? String(d.branch_id?._id ?? d.branch_id?.id ?? "")
                  : String(d.branch_id ?? "");
              return !bid || bid === branchId;
            })
          : rows,
        ["department_name", "name"],
      ),
  );
export const searchDesignations = (q: string, departmentId?: string) =>
  getList(`${HRM_SETUP}/designations`, { page: 1, limit: 50, searchTerm: q || undefined }).then(
    (rows) =>
      setupOptions(
        departmentId
          ? rows.filter((d: any) => {
              const did =
                typeof d.department_id === "object"
                  ? String(d.department_id?._id ?? d.department_id?.id ?? "")
                  : String(d.department_id ?? "");
              return !did || did === departmentId;
            })
          : rows,
        ["designation_name", "name"],
      ),
  );

/** Orange create (+) — keep clear of filters / toolbar edge. */
export function CreatePlusButton({
  onClick,
  title = "Create",
  className = "",
}: {
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-9 h-9 flex-shrink-0 ml-4 mr-3 sm:ml-6 sm:mr-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm ${className}`}
    >
      <Plus className="w-5 h-5" strokeWidth={2.2} />
    </button>
  );
}

/** Searchable select that stores `id` but displays `name`. */
export function IdSearchSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  // Re-export pattern kept for local option lists; prefer AsyncSearchSelect for API lists.
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
          setQuery("");
        }}
        className={`keep-box ua-field w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm text-left ${
          disabled
            ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
            : open
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-white"
              : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected?.name || placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {open && !disabled && (
        <div className="ua-dropdown-panel absolute left-0 right-0 top-full mt-1 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="relative border-b border-gray-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="keep-box ua-field w-full pl-9 pr-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  o.id === value ? "bg-blue-50 text-blue-700" : "text-gray-900"
                }`}
              >
                {o.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { AsyncSearchSelect } from "@/components/ui/AsyncSearchSelect";
export type { AsyncOption } from "@/components/ui/AsyncSearchSelect";

/* ── HRM file upload (API path strings) ───────────────────────────
 * RULE: Any HRM file upload MUST go through uploadHrmFile and persist
 * the returned path; always render with HrmDocumentLink. */

/** Treat empty / placeholder / non-path values as "no document". */
export function hasHrmDocument(value: unknown): boolean {
  const src = String(value ?? "").trim();
  if (!src) return false;
  if (/^\{\{.*\}\}$/.test(src)) return false;
  if (/^(null|undefined|n\/a|none|-)$/i.test(src)) return false;
  if (src.includes("file_path_or_url")) return false;
  return true;
}

export async function uploadHrmFile(file: File): Promise<{ path: string; name: string; url: string }> {
  const formData = new FormData();
  formData.append("files", file);
  const uploadRes = await api.raw.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = uploadRes.data?.data ?? uploadRes.data;
  const row = Array.isArray(data) ? data[0] : data;
  const path = String(row?.file_path || row?.path || "");
  if (!path) throw new Error("Upload did not return a file path");
  const name = String(row?.file_name || file.name);
  // Prefer server absolute `url` when present; else resolve path for this app.
  const url = String(row?.url || "").trim() || resolveHrmFileUrl(path);
  return { path, name, url };
}

/**
 * Resolve a stored upload path for browser open.
 * - Absolute http(s)/blob → as-is
 * - Dev: root-relative `/files/...` (Vite proxies `/files` → backend)
 * - Prod: `${BACKEND_BASE_URL}/files/...` (host root — never `/api/v1`)
 */
export function resolveHrmFileUrl(value: unknown): string {
  if (!hasHrmDocument(value)) return "";
  return resolveMediaUrl(value);
}

export function hrmFileLabel(pathOrName: string): string {
  if (!hasHrmDocument(pathOrName)) return "";
  try {
    const part = pathOrName.split("?")[0].split("#")[0];
    const base = part.split("/").pop() || pathOrName;
    return decodeURIComponent(base);
  } catch {
    return pathOrName;
  }
}

/** Icon-only document control — no path text. Empty → N/A. */
export function HrmDocumentLink({
  path,
  className = "",
  title,
}: {
  path?: string | null;
  className?: string;
  title?: string;
}) {
  if (!hasHrmDocument(path)) {
    return <span className={`text-sm text-gray-400 ${className}`}>N/A</span>;
  }
  const href = resolveHrmFileUrl(path);
  const tip = title || hrmFileLabel(String(path)) || "View document";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={tip}
      aria-label={tip}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 ${className}`}
    >
      <FileText className="w-4 h-4" />
    </a>
  );
}

export function HrmFileUploadButton({
  path,
  displayName,
  onUploaded,
  inputId = "hrm-file-upload",
  disabled,
  className = "",
}: {
  path?: string;
  displayName?: string;
  onUploaded: (v: { path: string; name: string }) => void;
  inputId?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const attached = hasHrmDocument(path);
  const label =
    displayName && hasHrmDocument(displayName) && !displayName.includes("/files/")
      ? displayName
      : attached
        ? "File attached"
        : "";

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadHrmFile(file);
      onUploaded({ path: uploaded.path, name: uploaded.name });
      showToast("File uploaded", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2 items-center">
        <input
          value={label}
          readOnly
          placeholder="No file chosen"
          className={`flex-1 ${inputCls} bg-white`}
        />
        <label
          className={`px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 flex items-center gap-1.5 shrink-0 ${
            disabled || uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
          }`}
        >
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading…" : "Browse"}
          <input
            type="file"
            className="hidden"
            id={inputId}
            disabled={disabled || uploading}
            onChange={(e) => void onFileChange(e)}
          />
        </label>
        {attached ? <HrmDocumentLink path={path} /> : <span className="text-sm text-gray-400 shrink-0">N/A</span>}
      </div>
    </div>
  );
}
