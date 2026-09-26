/**
 * File: src/pages/TimeLogs.tsx
 * Time Logs — master/detail layout matching the reference design.
 * Left: list (search, sort, Status/Customer/Date filters) with a "Timer"
 *       header row; logs grouped by month with per-group hour totals.
 * Right: "Time Log Details" — Hours/Date (+ Project/Task when set) + Notes,
 *        with a live start/pause/stop timer in the header.
 * Pencil → inline "Edit Time Log" form (big hh:mm display + In/Out picker,
 *        Date / Project / Task / Notes). FAB & Timer (+) → Create.
 * ⋮ → Mark as Invoiced / Duplicate / Delete.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { useCollection, repo, db } from "@/lib/db";
import { useAppSettings, isTimeLogColumnOn } from "@/lib/db/appSettings";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { PartyFilterPopover } from "@/components/ui/PartyFilterPopover";
import { toIsoDate, todayIso } from "@/lib/dateIso";
import { dateRangeFor } from "@/lib/listDateRange";
import { fetchCustomers } from "@/services/customersApi";
import { showToast } from "@/utils/toast";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Settings,
  Pencil,
  MoreVertical,
  Trash2,
  Copy,
  Play,
  Pause,
  Square,
  Clock,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";
import { useAppTimer, startAppTimer, pauseAppTimer, stopAppTimer, formatAppTimer } from "@/lib/timerStore";
import { setTimelogInvoiced, isTimelogInvoiced } from "@/lib/timelogInvoiced";

/* ── Types & data ──────────────────────────────────────────────── */
interface TLog {
  id: number;
  _id?: string;
  email: string;
  customerId?: number | null;
  project: string;
  task: string;
  hours: string; // "HH:MM"
  month: string; // group key, e.g. "Jun 2026"
  dateLabel: string; // detail Date value
  rowDate: string; // right-aligned date on a project row
  notes: string;
  invoiced: boolean;
  ts: number;
}

/* ── helpers ───────────────────────────────────────────────────── */
const sortFields = ["Date", "Hours", "Customer"];
const statusList = ["All", "Invoiced", "Not Invoiced", "Trash"];
const dateFilters = ["All", "Today", "This Week", "Last Week", "This Month", "Last Month", "Last 30 Days", "This Year"];
const UNIT_TYPES = ["Hour", "Day", "Fixed", "Item"];

/* ── helpers ───────────────────────────────────────────────────── */
const parseHM = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const fmtHM = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const fmtHMS = (sec: number) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, "0")).join(":");

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

const SectionBar: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-6 py-2.5 bg-gray-50 border-y border-gray-200 text-sm font-semibold text-gray-900">{title}</div>
);
const Stat: React.FC<{ label: string; value: string; big?: boolean }> = ({ label, value, big }) => (
  <div><div className="text-xs text-gray-500">{label}</div><div className={`font-semibold text-gray-900 mt-0.5 ${big ? "text-2xl" : "text-sm"}`}>{value}</div></div>
);

/* ── In / Out calendar picker ──────────────────────────────────── */
const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const InOutModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mode, setMode] = useState<"In" | "Out">("In");
  const [view, setView] = useState({ y: 2026, m: 5 }); // June 2026 (0-based)
  const [day, setDay] = useState(21);
  const [time, setTime] = useState("10:15 PM");
  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const monthLong = new Date(view.y, view.m, 1).toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
  const monthShort = new Date(view.y, view.m, 1).toLocaleString("en-US", { month: "short" }).toUpperCase();
  const shift = (d: number) => setView((v) => { const nd = new Date(v.y, v.m + d, 1); return { y: nd.getFullYear(), m: nd.getMonth() }; });
  return (
    <Overlay onClose={onClose}>
      <div className="w-[420px] my-24 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        {/* In/Out toggle + actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex rounded-md overflow-hidden border border-blue-600">
            {(["In", "Out"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-6 py-1.5 text-sm font-medium ${mode === m ? "bg-blue-600 text-white" : "text-blue-600 bg-white"}`}>{m}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={onClose} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Save</button>
          </div>
        </div>
        {/* month nav */}
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-sm font-semibold text-gray-900">{monthLong} <ChevronDown className="inline w-4 h-4" /></span>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-600"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => shift(1)} className="p-1 rounded-full hover:bg-gray-100 text-gray-600"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        {/* weekdays */}
        <div className="grid grid-cols-7 px-5 mt-3 text-center text-xs text-gray-500">{WEEK.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="px-5 mt-2 text-xs text-gray-500">{monthShort}</div>
        {/* days */}
        <div className="grid grid-cols-7 gap-y-2 px-5 py-2 text-center text-sm">
          {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const d = i + 1;
            return (
              <button key={d} onClick={() => setDay(d)} className={`mx-auto w-9 h-9 flex items-center justify-center rounded-full ${d === day ? "bg-blue-600 text-white" : "text-gray-800 hover:bg-gray-100"}`}>{d}</button>
            );
          })}
        </div>
        {/* time */}
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-center">
          <div className="relative w-48">
            <input value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600" />
            <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/* ── Edit / Create Time Log form (replaces detail) ─────────────── */
const parseRoundingMins = (rounding: string | undefined): number => {
  const n = parseInt(String(rounding || "0").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/** Round total minutes up to the nearest step (0 = no rounding). */
const roundMinutes = (totalMins: number, step: number): number => {
  if (!step || step <= 0) return totalMins;
  return Math.ceil(totalMins / step) * step;
};

const fieldCls = "w-full px-3 py-2.5 text-sm bg-transparent text-gray-900 focus:outline-none";

const AddProjectModal: React.FC<{ onClose: () => void; onSaved: (name: string) => void }> = ({ onClose, onSaved }) => {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [rate, setRate] = useState("");
  const [openList, setOpenList] = useState(false);
  const customerWrapRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery({
    queryKey: ["timelog-project-customers", q],
    queryFn: () => fetchCustomers({ page: 1, limit: 50, searchTerm: q.trim() || undefined }),
    staleTime: 20_000,
  });
  const rows = data?.rows ?? [];
  useEffect(() => {
    if (!openList) return;
    const h = (e: MouseEvent) => {
      if (customerWrapRef.current?.contains(e.target as Node)) return;
      setOpenList(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openList]);
  const save = async () => {
    if (!name.trim()) { showToast("Project name is required", "warning"); return; }
    const existing = await db.projects.toArray();
    const id = existing.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
    await db.projects.put({
      id,
      name: name.trim(),
      customerId: customerId || null,
      customerName: customerLabel,
      rate: Number(rate) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    showToast("Project saved", "success");
    onSaved(name.trim());
    onClose();
  };
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg my-16 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-visible">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 rounded-t-lg">
          <h2 className="text-base font-semibold text-gray-900">Add Project</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button type="button" onClick={() => void save()} className="px-5 py-1.5 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900 font-medium">Save</button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="relative fl-wrap">
            <label className="fl-label">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} placeholder=" " />
          </div>
          <div className="relative fl-wrap" ref={customerWrapRef}>
            <label className="fl-label">Customer</label>
            <input
              value={openList ? q : customerLabel}
              onFocus={() => { setOpenList(true); setQ(customerLabel); }}
              onChange={(e) => { setQ(e.target.value); setOpenList(true); setCustomerId(""); setCustomerLabel(e.target.value); }}
              placeholder=" "
              className={fieldCls}
              autoComplete="off"
            />
            {openList && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 min-h-[12rem] max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl">
                {rows.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-400">No customers</div>
                ) : rows.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setCustomerId(c._id); setCustomerLabel(c.name); setQ(c.name); setOpenList(false); }}
                    className={`w-full px-3 py-2.5 text-sm text-left hover:bg-gray-50 ${customerId === c._id ? "bg-gray-50 text-gray-900 font-medium" : "text-gray-800"}`}
                  >
                    <div className="truncate">{c.name}</div>
                    {c.email ? <div className="truncate text-xs text-gray-400 mt-0.5">{c.email}</div> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative fl-wrap">
            <label className="fl-label">Default customer rate</label>
            <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className={fieldCls} placeholder=" " />
          </div>
        </div>
      </div>
    </Overlay>
  );
};

const NewTaskModal: React.FC<{ onClose: () => void; onSaved: (name: string) => void }> = ({ onClose, onSaved }) => {
  const taxes = useCollection<any>("taxes");
  const taxNames = useMemo(() => {
    const names = taxes.map((t) => String(t.name || "")).filter(Boolean);
    return names.length ? ["None", ...names] : ["None", "VAT", "GST"];
  }, [taxes]);
  const [name, setName] = useState("");
  const [sac, setSac] = useState("");
  const [unitType, setUnitType] = useState("Hour");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("");
  const [tax, setTax] = useState("None");
  const [notes, setNotes] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);
  const taxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!unitRef.current?.contains(t)) setUnitOpen(false);
      if (!taxRef.current?.contains(t)) setTaxOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const save = async () => {
    if (!name.trim()) { showToast("Task name is required", "warning"); return; }
    await repo.add("tasks", {
      name: name.trim(),
      sac,
      unitType,
      defaultQuantity: Number(qty) || 1,
      rate: Number(rate) || 0,
      tax,
      notes,
      ts: Date.now(),
    });
    showToast("Task saved", "success");
    onSaved(name.trim());
    onClose();
  };
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-xl my-10 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-visible">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 rounded-t-lg">
          <h2 className="text-base font-semibold text-gray-900">New Task</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button type="button" onClick={() => void save()} className="px-5 py-1.5 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900 font-medium">Save</button>
          </div>
        </div>
        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-900">Details</div>
        <div className="p-5 space-y-5">
          <div className="relative fl-wrap">
            <label className="fl-label text-red-500">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${fieldCls} border-red-400`} placeholder=" " />
          </div>
          <div className="relative fl-wrap">
            <label className="fl-label">SAC</label>
            <input value={sac} onChange={(e) => setSac(e.target.value)} className={fieldCls} placeholder=" " />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative fl-wrap" ref={unitRef}>
              <label className="fl-label">Unit Type</label>
              <input
                readOnly
                value={unitType}
                placeholder=" "
                onClick={() => { setUnitOpen((o) => !o); setTaxOpen(false); }}
                className={`${fieldCls} cursor-pointer pr-9`}
              />
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              {unitOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl">
                  {UNIT_TYPES.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => { setUnitType(u); setUnitOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 ${u === unitType ? "bg-gray-50 font-medium text-gray-900" : "text-gray-800"}`}
                    >
                      {u}
                      {u === unitType && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative fl-wrap">
              <label className="fl-label">Default Quantity</label>
              <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} className={fieldCls} placeholder=" " />
            </div>
          </div>
        </div>
        <div className="px-6 py-2.5 bg-gray-50 border-y border-gray-200 text-sm font-semibold text-gray-900">Pricing & Tax</div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="relative fl-wrap">
            <label className="fl-label">Default Rate</label>
            <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className={fieldCls} placeholder=" " />
          </div>
          <div className="relative fl-wrap" ref={taxRef}>
            <label className="fl-label">Default Taxes</label>
            <input
              readOnly
              value={tax}
              placeholder=" "
              onClick={() => { setTaxOpen((o) => !o); setUnitOpen(false); }}
              className={`${fieldCls} cursor-pointer pr-9`}
            />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            {taxOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl">
                {taxNames.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTax(t); setTaxOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 ${t === tax ? "bg-gray-50 font-medium text-gray-900" : "text-gray-800"}`}
                  >
                    {t}
                    {t === tax && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-2.5 bg-gray-50 border-y border-gray-200 text-sm font-semibold text-gray-900">Description</div>
        <div className="p-5">
          <div className="relative fl-wrap">
            <label className="fl-label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder=" " rows={4} className={`${fieldCls} resize-y`} />
          </div>
        </div>
      </div>
    </Overlay>
  );
};

const SearchPick: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  onAdd: () => void;
}> = ({ value, onChange, options, placeholder, onAdd }) => {
  const [open, setOpen] = useState(false);
  const matches = options.filter((o) => !value.trim() || o.toLowerCase().includes(value.toLowerCase()));
  return (
    <div className="relative flex items-center gap-3">
      <input
        value={value}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
      />
      <button type="button" onClick={onAdd} title={`Add ${placeholder}`} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300">
        <Plus className="w-4 h-4" />
      </button>
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-10 top-full z-20 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-xl py-1">
          {matches.map((o) => (
            <button key={o} type="button" onMouseDown={() => { onChange(o); setOpen(false); }} className="w-full px-3 py-2.5 text-sm text-left text-gray-800 hover:bg-gray-50">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TimeLogForm: React.FC<{
  mode: "create" | "edit";
  log?: TLog;
  projects: string[];
  tasks: string[];
  onClose: () => void;
  onSave?: (d: any) => void | Promise<void>;
}> = ({ mode, log, projects, tasks, onClose, onSave }) => {
  const timeLogSettings = useAppSettings("timeLog");
  const roundingStep = parseRoundingMins(timeLogSettings?.rounding);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inout, setInout] = useState(false);
  const init = (log?.hours ?? "00:00").split(":");
  const [hh, setHh] = useState(init[0] || "00");
  const [mm, setMm] = useState(init[1] || "00");
  const [project, setProject] = useState(log?.project ?? "");
  const [task, setTask] = useState(log?.task ?? "");
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [dateVal, setDateVal] = useState(mode === "edit" ? (toIsoDate(log?.dateLabel) || todayIso()) : todayIso());
  const [projectModal, setProjectModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (saving) return;
    if (!dateVal) {
      showToast("Date is required", "warning");
      return;
    }
    let totalMins = (parseInt(hh, 10) || 0) * 60 + (parseInt(mm, 10) || 0);
    totalMins = roundMinutes(totalMins, roundingStep);
    const rh = String(Math.floor(totalMins / 60)).padStart(2, "0");
    const rm = String(totalMins % 60).padStart(2, "0");
    setSaving(true);
    try {
      await onSave?.({
        project,
        task,
        notes,
        hours: `${rh}:${rm}`,
        date: dateVal,
      });
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save time log";
      showToast(String(msg), "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar m-2 bg-white border border-gray-300 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300 sticky top-0 bg-white z-20">
        <h1 className="text-lg font-semibold text-gray-900">{mode === "create" ? "Create Time Log" : "Edit Time Log"}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Settings"><Settings className="w-4 h-4" /></button>
          <button type="button" onClick={onClose} disabled={saving} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {/* big hh:mm display + In/Out */}
      <div className="relative px-6 py-10 border-b border-gray-200">
        <div className="text-center">
          <div className="text-6xl font-light text-gray-900 tracking-wide">
            <input value={hh} onChange={(e) => setHh(e.target.value.replace(/\D/g, "").slice(0, 2))} className="w-20 text-center bg-transparent outline-none" />
            {" : "}
            <input value={mm} onChange={(e) => setMm(e.target.value.replace(/\D/g, "").slice(0, 2))} className="w-20 text-center bg-transparent outline-none" />
          </div>
          <div className="text-sm text-gray-500 mt-1">hh : mm{roundingStep > 0 ? ` · round ${roundingStep} mins` : ""}</div>
        </div>
        <button onClick={() => setInout(true)} className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300">
          <Clock className="w-4 h-4" /> In/Out
        </button>
      </div>

      <SectionBar title="Details" />
      <div className="px-6 py-6 max-w-2xl space-y-6">
        <AppDatePicker floatingLabel="Date *" value={dateVal} onValueChange={setDateVal} />
        <SearchPick value={project} onChange={setProject} options={projects} placeholder="Project" onAdd={() => setProjectModal(true)} />
        <SearchPick value={task} onChange={setTask} options={tasks} placeholder="Task" onAdd={() => setTaskModal(true)} />
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="w-full h-28 px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none resize-none focus:ring-1 focus:ring-blue-600" />
      </div>
      {projectModal && <AddProjectModal onClose={() => setProjectModal(false)} onSaved={setProject} />}
      {taskModal && <NewTaskModal onClose={() => setTaskModal(false)} onSaved={setTask} />}
      {inout && <InOutModal onClose={() => setInout(false)} />}
      {settingsOpen && <AppSettingsModal initialTab="Time Log" onClose={() => setSettingsOpen(false)} />}
    </section>
  );
};

/* ── Component ──────────────────────────────────────────────────── */
export const TimeLogs: React.FC = () => {
  const dbLogs = useCollection<any>("timelogs");
  const dbCustomers = useCollection<any>("customers");
  const dbProjects = useCollection<any>("projects");
  const dbTasks = useCollection<any>("tasks");
  const timeLogSettings = useAppSettings("timeLog");
  const includeProjectInv = isTimeLogColumnOn(timeLogSettings?.columns, "Include Project in Create Invoice");
  const includeDateInv = isTimeLogColumnOn(timeLogSettings?.columns, "Include Date in Create Invoice");
  const includeNotesInv = isTimeLogColumnOn(timeLogSettings?.columns, "Include Notes in Create Invoice");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const logs: TLog[] = useMemo(() => {
    return [...dbLogs]
      .map((l) => {
        const customer = dbCustomers.find((c) => c.id === l.customerId || String(c._id) === String(l.customerId));
        const rawDate = l.date || l.dateLabel || "";
        const ts = Number(l.ts) || (rawDate ? Date.parse(rawDate) || 0 : 0);
        const month = l.month || (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Unknown");
        const backendKey = l._id || l.id;
        return {
          id: l.id,
          _id: l._id ? String(l._id) : undefined,
          email: customer?.email || customer?.contact || l.email || "—",
          customerId: l.customerId ?? null,
          project: l.project || "",
          task: l.task || "",
          hours: l.hours || "00:00",
          month,
          dateLabel: l.dateLabel || rawDate || "—",
          rowDate: l.rowDate || l.dateLabel || rawDate || "",
          notes: l.notes || "",
          invoiced: !!l.invoiced || isTimelogInvoiced(backendKey),
          ts,
        } satisfies TLog;
      })
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [dbLogs, dbCustomers]);
  const projectNames = useMemo(() => [...new Set(dbProjects.map((p) => String(p.name || "")).filter(Boolean))], [dbProjects]);
  const taskNames = useMemo(() => [...new Set(dbTasks.map((t) => String(t.name || "")).filter(Boolean))], [dbTasks]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("Date");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
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

  const appTimer = useAppTimer();

  const selected = logs.find((l) => l.id === selectedId) || (!selectMode ? logs[0] : undefined);
  const dateRange = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selectedKeys = new Set(customerFilter.map(String));
    const selectedLocalIds = new Set(
      dbCustomers.filter((c) => selectedKeys.has(String(c._id))).map((c) => c.id),
    );
    let list = logs.filter((l) => {
      if (statusFilter === "Invoiced" && !l.invoiced) return false;
      if (statusFilter === "Not Invoiced" && l.invoiced) return false;
      if (customerFilter.length) {
        const matchLocal = selectedLocalIds.has(l.customerId as any);
        const matchDirect = selectedKeys.has(String(l.customerId || ""));
        if (!matchLocal && !matchDirect) return false;
      }
      if (dateRange.dateFrom || dateRange.dateTo) {
        if (!l.ts) return false;
        const iso = new Date(l.ts).toISOString().slice(0, 10);
        if (dateRange.dateFrom && iso < dateRange.dateFrom) return false;
        if (dateRange.dateTo && iso > dateRange.dateTo) return false;
      }
      if (!q) return true;
      return [l.email, l.project, l.task, l.notes, l.dateLabel, l.hours, l.month].some((v) => String(v || "").toLowerCase().includes(q));
    });
    if (sortBy === "Hours") list = [...list].sort((a, b) => parseHM(b.hours) - parseHM(a.hours));
    if (sortBy === "Customer") list = [...list].sort((a, b) => a.email.localeCompare(b.email));
    if (sortBy === "Date") list = [...list].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return list;
  }, [logs, sortBy, statusFilter, search, customerFilter, dateRange, dbCustomers]);

  const groups = useMemo(() => {
    const map = new Map<string, TLog[]>();
    filtered.forEach((l) => {
      const key = l.month || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return [...map.entries()]
      .map(([month, rows]) => ({
        month,
        rows,
        total: fmtHM(rows.reduce((s, l) => s + parseHM(l.hours), 0)),
        ts: Math.max(...rows.map((r) => r.ts || 0)),
      }))
      .sort((a, b) => b.ts - a.ts);
  }, [filtered]);

  const grandTotal = fmtHM(filtered.reduce((s, l) => s + parseHM(l.hours), 0));

  // timer state for the selected log
  const isThis = !!selected && appTimer.logId === selected.id;
  const active = !!isThis && appTimer.running;
  const paused = !!isThis && !appTimer.running && appTimer.seconds > 0;
  const detailHours = isThis && (appTimer.running || appTimer.seconds > 0) ? formatAppTimer(appTimer.seconds) : selected?.hours;

  const startTimerFor = (log?: TLog | null) => {
    const target = log || selected;
    startAppTimer({
      logId: target?.id ?? null,
      label: target ? (target.project || target.email || "Timer") : "Timer",
      reset: !appTimer.logId || (target != null && appTimer.logId !== target.id),
    });
  };
  const pauseTimer = () => pauseAppTimer();
  const stopTimer = () => stopAppTimer();

  const resolveCustomerForLog = (log: TLog) => {
    if (log.customerId == null) return null;
    return dbCustomers.find((c) => c.id === log.customerId || String(c._id) === String(log.customerId)) || null;
  };

  const openInvoiceCreate = (log?: TLog | null) => {
    const target = log || selected;
    const customer = target ? resolveCustomerForLog(target) : null;
    navigate("/sales/sales-invoice", {
      state: {
        openCreate: true,
        prefillCustomer: customer
          ? {
              localId: customer.id,
              backendId: customer._id ? String(customer._id) : undefined,
              name: customer.name || customer.subtitle || "",
              email: customer.email || "",
            }
          : undefined,
        prefillNotes: target?.notes || undefined,
        prefillHours: target?.hours || undefined,
        prefillProject: target?.project || undefined,
        prefillTask: target?.task || undefined,
      },
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setChecked(new Set());
  };
  const toggleRow = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allFilteredIds = filtered.map((l) => l.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => checked.has(id));
  const toggleAll = () => {
    if (allSelected) setChecked(new Set());
    else setChecked(new Set(allFilteredIds));
  };

  const markInvoiced = async (log?: TLog | null) => {
    const target = log || selected;
    if (!target || target.invoiced) return;
    const descParts: string[] = [];
    if (includeProjectInv && target.project) descParts.push(`Project: ${target.project}`);
    if (includeDateInv && target.dateLabel) descParts.push(`Date: ${target.dateLabel}`);
    if (includeNotesInv && target.notes) descParts.push(target.notes);
    const description = descParts.join(" · ") || target.task || "Time log";
    const hrs = target.hours || "00:00";
    const [h, m] = hrs.split(":").map((x) => parseInt(x, 10) || 0);
    const qty = +(h + m / 60).toFixed(2) || 1;
    const n = await repo.nextNumber("invoices");
    const customer = resolveCustomerForLog(target);
    await repo.add("invoices", {
      number: "#" + n,
      customerId: customer?.id ?? null,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      due: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      ts: Date.now(),
      status: "Draft",
      items: [{ id: 1, name: target.task || "Time Log", description, qty, rate: 0, taxId: 1, discount: 0, amount: 0 }],
      subTotal: 0, tax: 0, total: 0, amountPaid: 0, amountDue: 0,
      notes: includeNotesInv ? (target.notes || "") : "",
    });
    setTimelogInvoiced(target._id || target.id, true);
    await db.timelogs.update(target.id, { invoiced: true, updatedAt: new Date().toISOString() });
    showToast("Marked as invoiced", "success");
  };

  const deleteSelected = async () => {
    if (checked.size === 0) {
      showToast("Select time logs to delete", "warning");
      return;
    }
    const ids = [...checked];
    await repo.removeMany("timelogs", ids);
    setChecked(new Set());
    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
    showToast("Time logs deleted", "success");
  };

  const invoiceSelected = () => {
    if (checked.size === 0) {
      showToast("Select a time log", "warning");
      return;
    }
    const firstId = [...checked][0];
    const log = logs.find((l) => l.id === firstId);
    if (!log) return;
    openInvoiceCreate(log);
  };

  const duplicateLog = async () => {
    if (!selected) return;
    const id = await repo.add("timelogs", {
      customerId: selected.customerId ?? null,
      project: selected.project,
      task: selected.task,
      hours: selected.hours,
      month: selected.month,
      date: selected.dateLabel,
      ts: Date.now(),
      dateLabel: selected.dateLabel,
      notes: selected.notes,
      invoiced: false,
    });
    setSelectedId(id);
    showToast("Time log duplicated", "success");
  };

  const deleteLog = async () => {
    if (!selected) return;
    await repo.remove("timelogs", selected.id);
    setSelectedId(null);
    showToast("Time log deleted", "success");
  };

  const ctrlBtn = "w-7 h-7 flex items-center justify-center rounded-full text-white";

  const hasActiveFilters = statusFilter !== "All" || customerFilter.length > 0 || dateFilter !== "All" || !!search.trim();
  if (!selected && mode !== "create" && !hasActiveFilters && !selectMode) return <ListEmptyState title="No time logs yet" onCreate={() => setMode("create")} createLabel="New Time Log" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setMode("create")} createTitle="Create Time Log" hideCreate={selectMode}>
        {/* header */}
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button type="button" onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Delete" onClick={() => void deleteSelected()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button type="button" title="Create invoice" onClick={invoiceSelected} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><FileText className="w-4 h-4" /></button>
              <button type="button" title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Time Logs</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Time Logs")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button type="button" onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("timelogs"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("timelogs"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search time logs…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* toolbar */}
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
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
          <PartyFilterPopover
            kind="customer"
            appliedIds={customerFilter}
            appliedLabels={customerFilterLabels}
            onApply={(ids, labels) => {
              setCustomerFilter(ids);
              setCustomerFilterLabels(labels);
            }}
          />
          <Dropdown trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Date{dateFilter !== "All" ? ` | ${dateFilter}` : ""}</span>}>
            {(close) => dateFilters.map((o) => (
              <button key={o} type="button" onClick={() => { setDateFilter(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* Timer header row */}
        <div className="border-b border-gray-300">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-900">Timer</span>
            <button
              type="button"
              title="Start timer"
              onClick={() => startTimerFor(selected)}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-600"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {(appTimer.running || appTimer.seconds > 0) && (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
              <span className="text-sm text-gray-800 truncate">{appTimer.label || logs.find((l) => l.id === appTimer.logId)?.email || "Timer"}</span>
              <div className="flex items-center gap-2">
                {appTimer.running
                  ? <button type="button" onClick={pauseTimer} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 text-white"><Pause className="w-3.5 h-3.5" /></button>
                  : <button type="button" onClick={() => startAppTimer()} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 text-white"><Play className="w-3.5 h-3.5" /></button>}
                <button type="button" onClick={stopTimer} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-700 text-white"><Square className="w-3 h-3 fill-current" /></button>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatAppTimer(appTimer.seconds)}</span>
              </div>
            </div>
          )}
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
          {groups.map((g) => (
            <div key={g.month}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-sm font-bold text-gray-900">{g.month} ({g.rows.length})</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{g.total}</span>
              </div>
              {g.rows.map((l) => {
                const activeRow = !selectMode && mode === "view" && l.id === selectedId;
                const isChecked = checked.has(l.id);
                const liveHours = appTimer.logId === l.id && (appTimer.running || appTimer.seconds > 0)
                  ? formatAppTimer(appTimer.seconds)
                  : l.hours;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => (selectMode ? toggleRow(l.id) : (setSelectedId(l.id), setMode("view")))}
                    className={`w-full text-left px-4 py-3 border-b border-gray-200 flex items-start gap-3 transition-colors ${
                      l.invoiced
                        ? "bg-amber-50/90 border-l-4 border-l-amber-500"
                        : ""
                    } ${activeRow || (selectMode && isChecked) ? "bg-gray-100" : l.invoiced ? "" : "hover:bg-gray-50"}`}
                  >
                    {selectMode && (
                      <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>
                        {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {l.project ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-semibold truncate ${l.invoiced ? "text-amber-900" : "text-gray-900"}`}>{l.project} - {l.task}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">{l.rowDate}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 truncate">{l.email}</span>
                            <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${l.invoiced ? "text-amber-800" : "text-gray-900"}`}>{liveHours}</span>
                          </div>
                          {l.invoiced && <div className="mt-1"><span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5">Invoiced</span></div>}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${l.invoiced ? "text-amber-900 font-medium" : "text-gray-800"}`}>{l.email}</span>
                            <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${l.invoiced ? "text-amber-800" : "text-gray-900"}`}>{liveHours}</span>
                          </div>
                          {l.invoiced && <div className="mt-1"><span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5">Invoiced</span></div>}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          </div>
        </div>

        {/* footer */}
        <div className="px-4 py-3 border-t border-gray-200 text-center bg-gray-50">
          <div className="text-sm font-semibold text-gray-900">{grandTotal} Hours</div>
          <div className="text-xs text-gray-500">{filtered.length} Time Logs</div>
        </div>
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {mode === "create" ? (
        <TimeLogForm
          mode="create"
          projects={projectNames}
          tasks={taskNames}
          onClose={() => setMode("view")}
          onSave={async (d) => {
            const when = d.date ? new Date(d.date) : new Date();
            const matched = dbProjects.find((p) => String(p.name || "").trim() === String(d.project || "").trim());
            const id = await repo.add("timelogs", {
              customerId: matched?.customerId ?? null,
              projectId: matched?._id || matched?.id || null,
              taskId: null,
              project: d.project,
              task: d.task,
              hours: d.hours || "00:00",
              month: Number.isNaN(when.getTime()) ? "" : when.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              date: d.date,
              ts: Number.isNaN(when.getTime()) ? Date.now() : when.getTime(),
              dateLabel: Number.isNaN(when.getTime()) ? d.date : when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              notes: d.notes,
              invoiced: false,
            });
            setSelectedId(id);
            showToast("Time log saved", "success");
          }}
        />
      ) : mode === "edit" && selected ? (
        <TimeLogForm
          mode="edit"
          log={selected}
          projects={projectNames}
          tasks={taskNames}
          onClose={() => setMode("view")}
          onSave={async (d) => {
            const when = d.date ? new Date(d.date) : null;
            const matched = dbProjects.find((p) => String(p.name || "").trim() === String(d.project || "").trim());
            await repo.update("timelogs", selected.id, {
              project: d.project,
              task: d.task,
              hours: d.hours,
              notes: d.notes,
              projectId: matched?._id || matched?.id || null,
              ...(when && !Number.isNaN(when.getTime())
                ? {
                    date: d.date,
                    ts: when.getTime(),
                    month: when.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
                    dateLabel: when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  }
                : {}),
            });
            showToast("Time log updated", "success");
          }}
        />
      ) : !selected ? (
        <section className="module-empty-panel">
          <p className="text-sm text-gray-500">No time logs match these filters</p>
        </section>
      ) : (
        <section className="module-detail-panel custom-scrollbar">
          <div className="module-title-bar">
            <h1 className="text-lg font-semibold text-gray-900">Time Log Details</h1>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Settings"><Settings className="w-4 h-4" /></button>
              {active ? (
                <button type="button" onClick={pauseTimer} className={`${ctrlBtn} bg-gray-700`} title="Pause"><Pause className="w-3.5 h-3.5" /></button>
              ) : (
                <button type="button" onClick={() => startTimerFor(selected)} className={`${ctrlBtn} bg-green-600`} title="Start"><Play className="w-3.5 h-3.5" /></button>
              )}
              {(active || paused) && (
                <button type="button" onClick={stopTimer} className={`${ctrlBtn} bg-red-600`} title="Stop"><Square className="w-3 h-3 fill-current" /></button>
              )}
              <button type="button" onClick={() => setMode("edit")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button type="button" onClick={() => openInvoiceCreate(selected)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Create invoice"><FileText className="w-4 h-4" /></button>
              <Dropdown align="right" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MoreVertical className="w-4 h-4" /></span>}>
                {(close) => (
                  <>
                    {!selected.invoiced && (
                      <button type="button" onClick={() => { void markInvoiced(selected); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><CheckCircle2 className="w-4 h-4 text-gray-400" /> Mark as Invoiced</button>
                    )}
                    <button type="button" onClick={() => { void duplicateLog(); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><Copy className="w-4 h-4 text-gray-400" /> Duplicate</button>
                    <button type="button" onClick={() => { void deleteLog(); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200"><Trash2 className="w-4 h-4" /> Delete</button>
                  </>
                )}
              </Dropdown>
            </div>
          </div>

          {/* body */}
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">
              {selected.project && <Stat label="Project" value={selected.project} />}
              {selected.project && <Stat label="Task" value={selected.task} />}
              <Stat label="Hours" value={detailHours || selected.hours || "00:00"} big />
              <Stat label="Date" value={selected.dateLabel} />
            </div>
            {selected.invoiced && <span className="inline-block mt-4 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded-full px-3 py-1">Invoiced</span>}
          </div>

          <SectionBar title="Notes" />
          <div className="px-6 py-5 text-sm text-gray-700">{selected.notes || "No Notes"}</div>
        </section>
      )}
      {settingsOpen && <AppSettingsModal initialTab="Time Log" onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};

export default TimeLogs;
