/**
 * File: src/pages/items/Services.tsx
 * Service — master/detail layout matching the reference design.
 * Left: list (search, sort, status filter, selection mode with Merge).
 * Right: sectioned read-only view (Details / Quantity / Pricing & Tax /
 *        Description). Top-right pencil → inline Edit Service; FAB → Create.
 * Selection mode (list pencil) adds a Merge action → Merge Services modal.
 * A service has no stock/image — simpler than a Product.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { useCollection, repo, money, parseMoney } from "@/lib/db";
import { useAppSettings } from "@/lib/db/appSettings";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchServices,
  deleteService,
  deleteServices,
  archiveService,
  archiveServices,
  unarchiveService,
  mergeServices,
  type ServiceListRow,
} from "@/services/servicesApi";
import { showToast } from "@/utils/toast";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import {
  Search,
  Plus,
  ChevronDown,
  Check,
  Settings,
  Pencil,
  MoreVertical,
  Trash2,
  Copy,
  Archive,
  Combine,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
interface Service {
  id: string;
  backendId: string;
  name: string;
  note: string;
  price: string;
  sac: string;
  qty: string;
  unit: string;
  tax: string;
}

const mapServiceRow = (row: ServiceListRow): Service => ({
  id: row._id,
  backendId: row._id,
  name: row.name,
  note: row.note,
  price: money(row.price),
  sac: row.sac,
  qty: row.qty,
  unit: row.unit,
  tax: row.tax,
});

const serviceSortField = (label: string) => {
  if (label === "Rate") return "rate";
  if (label === "Created On") return "createdAt";
  return "serviceName";
};

const sortFields = ["Name", "Rate", "Created On"];
const statusList = ["All", "Active", "Archived", "Trash"];
const unitTypes = ["box", "cm", "kg", "pcs", "hrs"];
const taxList = ["Test Tax", "new test tax", "VAT", "GST"];

/* ── Outside-click dropdown ────────────────────────────────────── */
const Dropdown: React.FC<{
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  panelClass?: string;
}> = ({ trigger, children, align = "left", panelClass = "" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && (
        <div className={`absolute z-30 mt-2 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-xl py-1 ${align === "right" ? "right-0" : "left-0"} ${panelClass}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

/* ── Modal shell ───────────────────────────────────────────────── */
const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div>
    </div>
  );
};

/* ── Section header + helpers ──────────────────────────────────── */
const SectionBar: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-5 py-2.5 bg-gray-50 border-y border-gray-200 text-sm font-semibold text-gray-900">{title}</div>
);
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><div className="text-xs text-gray-500">{label}</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div></div>
);
const fieldCls = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
const FloatField: React.FC<{ label?: string; value?: string; placeholder?: string; onChange?: (v: string) => void }> = ({ label, value, placeholder, onChange }) => (
  <div className="relative fl-wrap">
    {label && <label className="fl-label">{label}</label>}
    <input
      {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : { defaultValue: value })}
      placeholder={placeholder && placeholder !== label ? placeholder : " "} className={fieldCls}
    />
  </div>
);

/* ── Merge Services modal ──────────────────────────────────────── */
const MergeModal: React.FC<{
  items: Service[];
  onClose: () => void;
  onMerge: (survivorBackendId: string) => void;
}> = ({ items, onClose, onMerge }) => {
  const [pick, setPick] = useState<string | null>(items[0]?.backendId ?? null);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-xl my-16 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Merge Services</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button
              type="button"
              disabled={!pick}
              onClick={() => pick && onMerge(pick)}
              className={`px-5 py-1.5 text-sm rounded-md font-medium ${!pick ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              Merge
            </button>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {items.map((s) => (
            <button key={s.id} type="button" onClick={() => setPick(s.backendId)} className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-200 hover:bg-gray-50 text-left">
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pick === s.backendId ? "border-blue-600" : "border-gray-400"}`}>
                {pick === s.backendId && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </span>
              <span className="text-sm font-semibold text-gray-900">{s.name}</span>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 text-xs text-gray-500 bg-gray-50">Select the service with which you wish to merge the rest of the services</div>
      </div>
    </Overlay>
  );
};

/* ── Service form (Create / Edit, replaces detail) ─────────────── */
const ServiceForm: React.FC<{ mode: "create" | "edit"; service?: Service; onClose: () => void; onSave?: (d: any) => void }> = ({ mode, service, onClose, onSave }) => {
  const serviceSettings = useAppSettings("service");
  const showSac = serviceSettings?.sac !== false;
  const [name, setName] = useState(service?.name ?? "");
  const [sac, setSac] = useState(service && service.sac !== "—" ? service.sac : "");
  const [qty, setQty] = useState(service?.qty ?? "1");
  const [unit, setUnit] = useState(service?.unit ?? "box");
  const [rate, setRate] = useState(service ? service.price.replace(/[^0-9.]/g, "") : "0");
  const [tax, setTax] = useState(service?.tax ?? taxList[0]);
  const [note, setNote] = useState(service?.note ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const handleSave = () => { onSave?.({ name, sac: showSac ? sac : "", qty, unit, rate, tax, note }); onClose(); };
  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar m-2 bg-white border border-gray-300 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300 sticky top-0 bg-white z-20">
        <h1 className="text-lg font-semibold text-gray-900">{mode === "create" ? "Create Service" : "Edit Service"}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} title="Settings" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={handleSave} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Save</button>
        </div>
      </div>

      <SectionBar title="Details" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
        <FloatField label="Service name *" value={name} onChange={setName} placeholder="Service name" />
        {showSac && <FloatField label="SAC" value={sac} onChange={setSac} placeholder="SAC" />}
      </div>

      <SectionBar title="Quantity" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
        <FloatField label="Quantity" value={qty} onChange={setQty} />
        <div className="relative fl-wrap">
          <label className="fl-label">Unit Type</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldCls}>{unitTypes.map((u) => <option key={u}>{u}</option>)}</select>
        </div>
      </div>

      <SectionBar title="Pricing & Tax" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
        <FloatField label="Rate" value={rate} onChange={setRate} />
        <div className="relative fl-wrap">
          <label className="fl-label">Tax</label>
          <select value={tax} onChange={(e) => setTax(e.target.value)} className={fieldCls}>{taxList.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
      </div>

      <SectionBar title="Description" />
      <div className="px-6 py-5">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes" className="w-full h-28 border border-gray-300 rounded-md p-3 text-sm text-gray-700 outline-none resize-none focus:ring-1 focus:ring-blue-600" />
      </div>
      {settingsOpen && <AppSettingsModal initialTab="Service" onClose={() => setSettingsOpen(false)} />}
    </section>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const Services: React.FC = () => {
  const queryClient = useQueryClient();
  const serviceSettings = useAppSettings("service");
  const showSacDetail = serviceSettings?.sac !== false;
  const [selectedId, setSelectedId] = useState("");
  const [sortBy, setSortBy] = useState("Created On");
  const [sortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();
  const openCreateFromNav = !!(location.state as { openCreate?: boolean } | null)?.openCreate;
  const [mode, setMode] = useState<"view" | "create" | "edit">(openCreateFromNav ? "create" : "view");
  useEffect(() => {
    if (openCreateFromNav) {
      setMode("create");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [openCreateFromNav, location.pathname, navigate]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [sortBy, statusFilter]);

  const { data: listData } = useQuery({
    queryKey: ["services-list", page, search, sortBy, sortDir, statusFilter],
    queryFn: () => fetchServices({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(serviceSortField(sortBy), sortDir),
      isDeleted: statusFilter === "Trash" || undefined,
      isArchive: statusFilter === "Archived" || undefined,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = listData?.pagination;
  const services: Service[] = useMemo(
    () => (listData?.rows ?? []).map(mapServiceRow),
    [listData?.rows],
  );

  const filtered = services;
  const selected = services.find((i) => i.id === selectedId) || services[0];

  useEffect(() => {
    if (services.length > 0 && !services.some((p) => p.id === selectedId)) {
      setSelectedId(services[0].id);
    }
  }, [services, selectedId]);

  const dbServices = useCollection<any>("services", "name");
  const selectedLocal = dbServices.find((s) => String(s._id) === selected?.backendId);
  const checkedItems = services.filter((i) => checked.has(i.id));

  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.id))));
  const checkedBackendIds = useMemo(
    () => services.filter((s) => checked.has(s.id)).map((s) => s.backendId),
    [services, checked],
  );
  const invalidateServicesList = () => void queryClient.invalidateQueries({ queryKey: ["services-list"] });
  const bulkDisabled = checked.size === 0;
  const bulkBtnClass = (disabled: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 ${disabled ? "opacity-40 pointer-events-none" : ""}`;

  const handleBulkArchive = async () => {
    if (bulkDisabled) {
      showToast(statusFilter === "Archived" ? "Select services to unarchive" : "Select services to archive", "warning");
      return;
    }
    try {
      if (statusFilter === "Archived") {
        await Promise.all(checkedBackendIds.map(unarchiveService));
        showToast("Services unarchived", "success");
      } else {
        await archiveServices(checkedBackendIds);
        showToast("Services archived", "success");
      }
      invalidateServicesList();
      exitSelect();
    } catch {
      showToast("Archive failed", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDisabled) {
      showToast("Select services to delete", "warning");
      return;
    }
    try {
      await deleteServices(checkedBackendIds);
      invalidateServicesList();
      exitSelect();
      showToast("Services deleted", "success");
    } catch {
      showToast("Delete failed", "error");
    }
  };

  const bulkMerge = async (survivorId: string) => {
    const mergedIds = checkedBackendIds.filter((id) => id !== survivorId);
    try {
      await mergeServices(survivorId, mergedIds);
      invalidateServicesList();
      exitSelect();
      setMergeOpen(false);
      setMergeConfirm(false);
      setMergeTargetId(null);
      showToast("Services merged", "success");
    } catch {
      showToast("Merge failed", "error");
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const hasActiveFilters = statusFilter !== "All" || !!search.trim();
  if (!selected && mode !== "create" && !hasActiveFilters) return <ListEmptyState title="No services yet" onCreate={() => setMode("create")} createLabel="New Service" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setMode("create")} createTitle="Create Service" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              <button onClick={() => (checked.size < 2 ? showToast("Select at least two services to merge", "warning") : setMergeOpen(true))} className={bulkBtnClass(checked.size < 2)} title="Merge"><Combine className="w-4 h-4" /></button>
              <button type="button" title={statusFilter === "Archived" ? "Unarchive" : "Archive"} onClick={handleBulkArchive} className={bulkBtnClass(bulkDisabled)}><Archive className="w-4 h-4" /></button>
              <button type="button" title="Delete" onClick={handleBulkDelete} className={bulkBtnClass(bulkDisabled)}><Trash2 className="w-4 h-4" /></button>
              <button onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Done"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Services</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Services")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("services"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("services"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search services..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => sortFields.map((o) => (
              <button key={o} onClick={() => { setSortBy(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <Dropdown trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusList.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${s === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{s} {s === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.map((p) => {
            const active = !selectMode && mode === "view" && p.id === selectedId;
            const isChecked = checked.has(p.id);
            return (
              <button key={p.id} onClick={() => (selectMode ? toggleRow(p.id) : (setSelectedId(p.id), setMode("view")))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-center gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                  {p.note && <div className="text-xs text-gray-500 mt-0.5 truncate">{p.note}</div>}
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{p.price}</span>
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter
          total={`${listPagination?.totalData ?? filtered.length}`}
          countLabel="Services"
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {mode === "create" ? (
        <ServiceForm mode="create" onClose={() => setMode("view")} onSave={async (d) => { await repo.add("services", { name: d.name || "Untitled", note: d.note, price: parseMoney(d.rate), sac: d.sac, qty: parseMoney(d.qty) || 1, unit: d.unit, taxId: ({ "new test tax": 1, "Test Tax": 2, VAT: 3, GST: 4 } as Record<string, number>)[d.tax] || 2, status: "Active" }); void queryClient.invalidateQueries({ queryKey: ["services-list"] }); }} />
      ) : mode === "edit" && selected ? (
        <ServiceForm mode="edit" service={selected} onClose={() => setMode("view")} onSave={async (d) => { if (selectedLocal?.id != null) await repo.update("services", selectedLocal.id, { name: d.name, note: d.note, price: parseMoney(d.rate), sac: d.sac, qty: parseMoney(d.qty) || 1, unit: d.unit, taxId: ({ "new test tax": 1, "Test Tax": 2, VAT: 3, GST: 4 } as Record<string, number>)[d.tax] || 2 }); void queryClient.invalidateQueries({ queryKey: ["services-list"] }); }} />
      ) : selected ? (
        <section className="module-detail-panel custom-scrollbar">
          {/* detail header */}
          <div className="module-title-bar">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight truncate">{selected.name}</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Settings"><Settings className="w-4 h-4" /></button>
              <button onClick={() => setMode("edit")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
              <Dropdown align="right" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MoreVertical className="w-4 h-4" /></span>}>
                {(close) => (
                  <>
                    <button onClick={close} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><Copy className="w-4 h-4 text-gray-400" /> Duplicate</button>
                    <button
                      onClick={async () => {
                        if (!selected?.backendId) { close(); return; }
                        try {
                          if (statusFilter === "Archived") {
                            await unarchiveService(selected.backendId);
                            showToast("Service unarchived", "success");
                          } else {
                            await archiveService(selected.backendId);
                            showToast("Service archived", "success");
                          }
                          invalidateServicesList();
                        } catch {
                          showToast("Archive failed", "error");
                        }
                        close();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-gray-50 text-left"
                    ><Archive className="w-4 h-4" /> {statusFilter === "Archived" ? "Unarchive" : "Archive"}</button>
                    <button onClick={async () => { if (selected?.backendId) { try { await deleteService(selected.backendId); invalidateServicesList(); showToast("Service deleted", "success"); } catch { showToast("Delete failed", "error"); } } close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200"><Trash2 className="w-4 h-4" /> Delete</button>
                  </>
                )}
              </Dropdown>
            </div>
          </div>

          {/* ── Details ── */}
          <SectionBar title="Details" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
            <Stat label="Service name *" value={selected.name} />
            {showSacDetail && <Stat label="SAC" value={selected.sac} />}
          </div>

          {/* ── Quantity ── */}
          <SectionBar title="Quantity" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
            <Stat label="Quantity" value={selected.qty} />
            <Stat label="Unit Type" value={selected.unit} />
          </div>

          {/* ── Pricing & Tax ── */}
          <SectionBar title="Pricing & Tax" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
            <Stat label="Rate" value={`$ ${selected.price.replace("$", "")}`} />
            <Stat label="Tax" value={selected.tax} />
          </div>

          {/* ── Description ── */}
          <SectionBar title="Description" />
          <div className="px-6 py-5">
            <div className="text-xs text-gray-500">Notes</div>
            <div className="text-sm text-gray-800 mt-1">{selected.note}</div>
          </div>
        </section>
      ) : null}

      {/* ════════ MODALS ════════ */}
      {(mergeOpen || mergeConfirm) && (
        <MergeModal
          items={checkedItems}
          onClose={() => { setMergeOpen(false); setMergeConfirm(false); setMergeTargetId(null); }}
          onMerge={(id) => { setMergeTargetId(id); setMergeOpen(false); setMergeConfirm(true); }}
        />
      )}
      {mergeConfirm && mergeTargetId != null && (
        <ConfirmAlert
          message="Are you sure want to merge these services?"
          onNo={() => { setMergeConfirm(false); setMergeOpen(true); }}
          onYes={() => void bulkMerge(mergeTargetId)}
        />
      )}
      {settingsOpen && <AppSettingsModal initialTab="Service" onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};

export default Services;
