/**
 * File: src/components/modals/AppSettingsModal.tsx
 * Shared App Settings modal (matches the Moon Invoice reference, Qayd theme).
 * Header: title · search (filters tabs) · reset (current tab → defaults) ·
 * Cancel · Save. Left rail: settings tabs (border under Whatsapp). Right pane
 * per tab; document tabs share one pane but each edits its OWN draft/storage
 * row (`app:doc:<key>`) so options never leak between document types.
 * Draft model: all sections load into `drafts` on mount, edits stay local,
 * Save persists every section, Cancel/Esc discards.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, RotateCcw, ChevronDown, X, Pencil, Check } from "lucide-react";
import {
  getAppSettings, saveAppSettings, resetAppSettings, syncAppSettingsFromBackend,
  getExchangeRates, saveExchangeRates, ExchangeRate,
  SECTION_DEFAULTS, DOC_TYPES, MODULE_NAMES, DocSettings,
  CUSTOMER_FIELD_KEYS,
  VENDOR_FIELD_KEYS,
  INVOICE_PAYMENT_KEYS,
  ORDER_GENERAL_KEYS,
  ORDER_COLUMN_KEYS,
  ORDER_SUMMARY_KEYS,
  ORDER_CHECKOUT_KEYS,
  ORDER_PAYMENT_KEYS,
  type OrderSettings,
  DOC_LAYOUTS, TAB_TO_DOC_LAYOUT, type DocLayoutId,
} from "@/lib/db/appSettings";
import { applyTheme } from "@/lib/theme";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import { buildTimezoneOptions } from "@/services/notificationSettingsApi";

const TABS = [
  "General",
  "Modules",
  "Currency & Format",
  "Printer",
  "Whatsapp",
  "Customer",
  "Invoice",
  "Proforma Invoice",
  "Sales Receipt",
  "Estimate",
  "Delivery Challan",
  "Credit Note",
  "Vendor",
  "Order",
  "Purchase Order",
  "Bill",
  "Debit Note",
  "Expense",
  "Product",
  "Service",
  "Time Log",
];
const docKeyForTab = (tab: string) => DOC_TYPES.find((d) => d.label === tab)?.key;
const SECTION_FOR_TAB: Record<string, string> = {
  General: "general",
  Modules: "modules",
  "Currency & Format": "currencyFormat",
  Printer: "printer",
  Whatsapp: "whatsapp",
  Customer: "customer",
  Vendor: "vendor",
  Expense: "expense",
  Product: "product",
  Service: "service",
  "Time Log": "timeLog",
};
const sectionForTab = (tab: string) => SECTION_FOR_TAB[tab] ?? `doc:${docKeyForTab(tab)}`;
const ALL_SECTIONS = TABS.map(sectionForTab);
/** Divider after this tab in the left rail */
const SIDEBAR_BORDER_AFTER = new Set(["Whatsapp"]);

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* ── primitives ────────────────────────────────────────────────── */
const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${on ? "bg-blue-600" : "bg-gray-300"}`}>
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
  </button>
);
const Row: React.FC<{ label: React.ReactNode; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-100 last:border-b-0">
    <span className="text-sm text-gray-700">{label}</span>
    {children}
  </div>
);
const selectCls = "ua-field keep-box text-sm px-2 py-1.5 focus:outline-none";
const Select: React.FC<{ value: string; options: string[]; onChange: (v: string) => void; width?: string }> = ({ value, options, onChange, width = "min-w-[140px]" }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${selectCls} ${width}`}>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);
const Accordion: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, open, onToggle, children }) => (
  <div className="border border-gray-200 rounded-md mb-3 overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
      {title}<ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="border-t border-gray-200">{children}</div>}
  </div>
);

/* ── per-document pane (shared UI, isolated draft) ─────────────── */
const DocSettingsPane: React.FC<{
  draft: DocSettings;
  onChange: (d: DocSettings) => void;
  layoutId?: DocLayoutId | null;
}> = ({ draft, onChange, layoutId = null }) => {
  const [open, setOpen] = useState<string | null>("Field Visibility");
  const patch = (p: Partial<DocSettings>) => onChange({ ...draft, ...p });
  const sec = (title: string, body: React.ReactNode) => (
    <Accordion title={title} open={open === title} onToggle={() => setOpen((o) => (o === title ? null : title))}>{body}</Accordion>
  );
  const layout = layoutId ? DOC_LAYOUTS[layoutId] : null;
  const fvEntries = layout
    ? layout.fieldKeys.map((k) => [k, draft.fieldVisibility?.[k] !== false] as const)
    : Object.entries(draft.fieldVisibility || {});
  const colKeys = layout ? [...layout.columnKeys] : (Object.keys(draft.columns || {}) as string[]);
  const isNameCol = (k: string) =>
    k === "Service Name" || k === "Service name" || k === "Product Name" || k === "Description";
  const nameCols = colKeys.filter(isNameCol);
  const restCols = colKeys.filter((k) => !isNameCol(k));
  const sumBefore = ["Total Quantity", "Round Off", "Negative Value format with ( )"];
  const sumEntries = layout
    ? layout.summaryKeys.map((k) => [k, draft.summary?.[k] !== false] as const)
    : Object.entries(draft.summary || {});
  const sumTop = sumEntries.filter(([k]) => sumBefore.includes(k));
  const sumBottom = sumEntries.filter(([k]) => !sumBefore.includes(k));
  const printEntries = layout
    ? layout.printKeys.map((k) => [k, draft.printEmail?.[k] !== false] as const)
    : Object.entries(draft.printEmail || {});
  const showQuantitySelect = layout ? layout.showQuantitySelect : true;
  const showPublicUrl = layout?.showPublicUrl === true;
  const showPayment = layout?.showPayment === true;
  const showTrackPoStock = layout?.showTrackPurchaseOrdersInStock === true;
  return (
    <div>
      {sec("Field Visibility", fvEntries.map(([k, v]) => (
        <Row key={k} label={k}><Toggle on={!!v} onChange={(nv) => patch({ fieldVisibility: { ...draft.fieldVisibility, [k]: nv } })} /></Row>
      )))}
      {sec("General", (
        <>
          <Row label="Line Option"><Select value={draft.general.lineOption} options={["Both", "Service", "Product"]} onChange={(v) => patch({ general: { ...draft.general, lineOption: v as any } })} /></Row>
          {showTrackPoStock && (
            <Row label="Track Purchase Orders in Stock">
              <Toggle
                on={draft.general.trackPurchaseOrdersInStock !== false}
                onChange={(nv) => patch({ general: { ...draft.general, trackPurchaseOrdersInStock: nv } })}
              />
            </Row>
          )}
          {showPublicUrl && (
            <Row label="Create Public URL in Email">
              <Toggle
                on={draft.general.createPublicUrlInEmail !== false}
                onChange={(nv) => patch({ general: { ...draft.general, createPublicUrlInEmail: nv } })}
              />
            </Row>
          )}
        </>
      ))}
      {sec("Columns", (
        <>
          {nameCols.map((k) => (
            <Row key={k} label={k}><Toggle on={draft.columns?.[k] !== false} onChange={(nv) => patch({ columns: { ...draft.columns, [k]: nv } })} /></Row>
          ))}
          {showQuantitySelect && (
            <Row label="Quantity"><Select value={draft.columnsQuantity} options={["Show for Both", "Show for Product", "Show for Service"]} onChange={(v) => patch({ columnsQuantity: v as any })} width="min-w-[160px]" /></Row>
          )}
          {restCols.map((k) => (
            <Row key={k} label={k}><Toggle on={draft.columns?.[k] !== false} onChange={(nv) => patch({ columns: { ...draft.columns, [k]: nv } })} /></Row>
          ))}
        </>
      ))}
      {sec("Summary", (
        <>
          {sumTop.map(([k, v]) => (
            <Row key={k} label={k}><Toggle on={!!v} onChange={(nv) => patch({ summary: { ...draft.summary, [k]: nv } })} /></Row>
          ))}
          <Row label="Subtotal with tax"><Select value={draft.summarySubtotalWithTax} options={["Default", "Including Tax", "Excluding Tax"]} onChange={(v) => patch({ summarySubtotalWithTax: v as any })} /></Row>
          {sumBottom.map(([k, v]) => (
            <Row key={k} label={k}><Toggle on={!!v} onChange={(nv) => patch({ summary: { ...draft.summary, [k]: nv } })} /></Row>
          ))}
        </>
      ))}
      {sec("Print & Email", (
        <>
          {printEntries.map(([k, v]) => (
            <Row key={k} label={k}><Toggle on={!!v} onChange={(nv) => patch({ printEmail: { ...draft.printEmail, [k]: nv } })} /></Row>
          ))}
          <Row label="Number of Copies on Print">
            <span className="flex items-center gap-2">
              <Select value={draft.printCopies} options={["Single Copy", "Two Copies", "Three Copies"]} onChange={(v) => patch({ printCopies: v as any })} />
              <button type="button" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Pencil className="w-3.5 h-3.5" /></button>
            </span>
          </Row>
        </>
      ))}
      {showPayment && sec("Payment", (
        INVOICE_PAYMENT_KEYS.map((k) => (
          <Row key={k} label={k}>
            <Toggle
              on={!!draft.payment?.[k]}
              onChange={(nv) => patch({ payment: { ...(draft.payment || {}), [k]: nv } })}
            />
          </Row>
        ))
      ))}
    </div>
  );
};

/* ── Exchange Rates modal ──────────────────────────────────────── */
const ExchangeRatesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  useEffect(() => { getExchangeRates().then((r) => { setRates(r.rates); setLastUpdated(r.lastUpdated); }); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  const commit = async (code: string) => {
    const v = parseFloat(editVal);
    if (!Number.isNaN(v) && v > 0) {
      const next = rates.map((r) => (r.code === code ? { ...r, rate: v } : r));
      setRates(next);
      await saveExchangeRates(next);
      setLastUpdated(Date.now());
      showToast("Exchange rate updated", "success");
    }
    setEditing(null);
  };
  const filtered = rates.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Exchange Rates</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>
        {/* base currency (ours: USD) */}
        <div className="mx-5 flex items-center justify-between px-4 py-3 rounded-md bg-amber-400 text-gray-900">
          <span className="text-sm font-semibold">US Dollar ($ USD)</span>
          <span className="text-sm font-semibold">1</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-2">
          {filtered.map((r) => (
            <div key={r.code} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-b-0">
              <span className="text-sm text-gray-800">{r.name} <span className="text-gray-500">({r.symbol} {r.code})</span></span>
              {editing === r.code ? (
                <span className="flex items-center gap-1">
                  <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
                  <button title="Apply" onClick={() => commit(r.code)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-700"><Check className="w-4 h-4" /></button>
                  <button title="Cancel" onClick={() => setEditing(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-700"><X className="w-4 h-4" /></button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-sm text-gray-800">{r.rate}</span>
                  <button title="Edit rate" onClick={() => { setEditing(r.code); setEditVal(String(r.rate)); }} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"><Pencil className="w-3.5 h-3.5" /></button>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 text-center text-xs text-gray-500">
          Last Updates: {new Date(lastUpdated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} {new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

/* ── main modal ────────────────────────────────────────────────── */
export const AppSettingsModal: React.FC<{ initialTab?: string; onClose: () => void }> = ({ initialTab = "General", onClose }) => {
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : "General");
  const [drafts, setDrafts] = useState<Record<string, any> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [ratesOpen, setRatesOpen] = useState(false);
  const [waTemplateOpen, setWaTemplateOpen] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  // Appearance the modal opened with — used to revert the live theme preview on Cancel.
  const persistedAppearance = useRef("Dark");
  useEffect(() => {
    (async () => {
      const synced = await syncAppSettingsFromBackend(true);
      const map: Record<string, any> = {};
      if (synced) {
        for (const s of ALL_SECTIONS) map[s] = synced[s] ?? (await getAppSettings(s));
      } else {
        const entries = await Promise.all(ALL_SECTIONS.map(async (s) => [s, await getAppSettings(s)] as const));
        Object.assign(map, Object.fromEntries(entries));
      }
      persistedAppearance.current = map.general?.appearance || "Dark";
      setDrafts(map);
    })();
  }, []);
  /* Cancel/Esc/backdrop: revert any live Appearance preview to what was saved. */
  const cancel = () => { applyTheme(persistedAppearance.current); onClose(); };
  useEffect(() => {
    // Ignore Escape while the nested Exchange Rates modal owns it, so closing
    // that child doesn't also dismiss the settings modal underneath.
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !ratesOpen) cancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, ratesOpen]);

  const section = sectionForTab(tab);
  const draft = drafts?.[section];
  const setDraft = (v: any) => setDrafts((d) => ({ ...(d || {}), [section]: v }));
  const patch = (p: any) => setDraft({ ...draft, ...p });

  const save = async () => {
    if (!drafts || saving) return;
    setSaving(true);
    try {
      await Promise.all(Object.entries(drafts).map(([s, v]) => saveAppSettings(s, v)));
      persistedAppearance.current = drafts.general?.appearance || "Dark";
      showToast("Settings saved", "success");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.message ? err.message : "Couldn't save settings.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };
  /* Reset only the current tab — backend seed + local draft. */
  const resetCurrent = async () => {
    try {
      await resetAppSettings(section);
      const next = await getAppSettings(section);
      setDraft(clone(next));
      if (section === "general" && next?.appearance) applyTheme(next.appearance);
      showToast(`${tab} settings reset to defaults`, "info");
    } catch (err) {
      setDraft(clone(SECTION_DEFAULTS[section] ?? {}));
      const msg =
        err instanceof ApiError && err.message ? err.message : `${tab} reset locally (offline)`;
      showToast(msg, "info");
    }
  };

  const visibleTabs = TABS.filter((t) => !search.trim() || t.toLowerCase().includes(search.toLowerCase()));
  const today = new Date();
  const fmtShort = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
  const fmtMed = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtLong = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const body = useMemo(() => {
    if (!draft) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
    if (tab === "Order") {
      return <OrderSettingsPane draft={draft as OrderSettings} onChange={setDraft} />;
    }
    const docKey = docKeyForTab(tab);
    if (docKey) {
      const layoutId = TAB_TO_DOC_LAYOUT[tab] ?? null;
      return <DocSettingsPane draft={draft} onChange={setDraft} layoutId={layoutId} />;
    }
    switch (tab) {
      case "General":
        return (
          <div className="border border-gray-200 rounded-md">
            <Row label="Chat"><Toggle on={draft.chat} onChange={(v) => patch({ chat: v })} /></Row>
            <Row label="Create Public URL in Email"><Toggle on={draft.publicUrl} onChange={(v) => patch({ publicUrl: v })} /></Row>
            <Row label="Appearance"><Select value={draft.appearance} options={["Auto", "Light", "Dark"]} onChange={(v) => { patch({ appearance: v }); applyTheme(v); }} /></Row>
            <Row label="Default Mail"><Select value={draft.defaultMail} options={["Qayd Mail Server", "Custom SMTP"]} onChange={(v) => patch({ defaultMail: v })} width="min-w-[170px]" /></Row>
          </div>
        );
      case "Modules":
        return (
          <div className="border border-gray-200 rounded-md">
            {MODULE_NAMES.map((m) => (
              <Row key={m} label={m}><Toggle on={!!draft[m]} onChange={(v) => patch({ [m]: v })} /></Row>
            ))}
          </div>
        );
      case "Currency & Format":
        return (
          <div>
            <div className="border border-gray-200 rounded-md">
              <Row label="Currency"><Select value={draft.currency} options={["$ USD", "€ EUR", "£ GBP", "৳ BDT", "₹ INR"]} onChange={(v) => patch({ currency: v })} /></Row>
              <Row label="Currency Symbol"><Toggle on={draft.currencySymbol} onChange={(v) => patch({ currencySymbol: v })} /></Row>
              <Row label="Currency Code"><Toggle on={draft.currencyCode} onChange={(v) => patch({ currencyCode: v })} /></Row>
              <Row label={<span>Multi Currency Display <button onClick={() => setRatesOpen(true)} className="text-blue-600 hover:text-blue-700 hover:underline ml-1">Exchange Rates</button></span>}>
                <Toggle on={draft.multiCurrency} onChange={(v) => patch({ multiCurrency: v })} />
              </Row>
              <Row label="Decimal Places"><Select value={draft.decimalPlaces} options={["0", "1", "2", "3", "4"]} onChange={(v) => patch({ decimalPlaces: v })} width="min-w-[80px]" /></Row>
              <Row label="Date/Number Format"><Select value={draft.dateFormat} options={["English (United States)", "English (United Kingdom)", "French", "German", "Spanish", "Arabic"]} onChange={(v) => patch({ dateFormat: v })} width="min-w-[200px]" /></Row>
              <Row label="Language"><Select value={draft.language} options={["English", "French", "German", "Spanish", "Arabic", "Bengali"]} onChange={(v) => patch({ language: v })} /></Row>
              <Row label="Timezone"><Select value={draft.timezone} options={buildTimezoneOptions()} onChange={(v) => patch({ timezone: v })} width="min-w-[260px]" /></Row>
            </div>
            {/* preview strip (reference bottom bar) */}
            <div className="flex items-center justify-between px-4 py-3 mt-4 text-xs text-gray-600 border-t border-gray-200">
              <span>{fmtShort} &nbsp;|&nbsp; {fmtMed} &nbsp;|&nbsp; {fmtLong}<br />First Day Of Week - Sunday</span>
              <span className="font-semibold text-gray-800">$ 1,000.00 USD</span>
            </div>
          </div>
        );
      case "Printer":
        return (
          <div className="border border-gray-200 rounded-md">
            <Row label="Print Mode"><Select value={draft.printMode} options={["Normal", "Thermal"]} onChange={(v) => patch({ printMode: v })} width="min-w-[130px]" /></Row>
          </div>
        );
      case "Whatsapp":
        return (
          <div>
            <div className="border border-gray-200 rounded-md mb-3">
              <Row label="WhatsApp"><Toggle on={draft.whatsapp} onChange={(v) => patch({ whatsapp: v })} /></Row>
              <Row label="Send Via"><Select value={draft.sendVia} options={["Qayd", "WhatsApp Business API"]} onChange={(v) => patch({ sendVia: v })} /></Row>
            </div>
            <Accordion title="Template" open={waTemplateOpen} onToggle={() => setWaTemplateOpen((o) => !o)}>
              <Row label="Terms & Conditions"><Toggle on={draft.terms} onChange={(v) => patch({ terms: v })} /></Row>
              <Row label="Notes"><Toggle on={draft.notes} onChange={(v) => patch({ notes: v })} /></Row>
            </Accordion>
          </div>
        );
      case "Customer":
        return <PartySettingsPane draft={draft} onChange={setDraft} orderedKeys={[...CUSTOMER_FIELD_KEYS]} />;
      case "Vendor":
        return <PartySettingsPane draft={draft} onChange={setDraft} orderedKeys={[...VENDOR_FIELD_KEYS]} />;
      case "Expense":
        return (
          <div className="border border-gray-200 rounded-md">
            <Row label="Round Off"><Toggle on={draft.roundOff} onChange={(v) => patch({ roundOff: v })} /></Row>
            <Row label="Payment Type"><Toggle on={draft.paymentType} onChange={(v) => patch({ paymentType: v })} /></Row>
          </div>
        );
      case "Product":
        return <ProductPane draft={draft} patch={patch} />;
      case "Service":
        return (
          <div className="border border-gray-200 rounded-md">
            <Row label="SAC"><Toggle on={draft.sac} onChange={(v) => patch({ sac: v })} /></Row>
          </div>
        );
      case "Time Log":
        return <TimeLogPane draft={draft} patch={patch} />;
      default:
        return null;
    }
  }, [tab, draft, waTemplateOpen]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onMouseDown={cancel}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">App Settings</h3>
          <div className="flex items-center gap-2">
            {searchOpen && (
              <input ref={searchRef} autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search settings" className="w-44 px-3 py-1.5 text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
            )}
            <button title="Search" onClick={() => { setSearchOpen((o) => !o); setSearch(""); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Search className="w-4 h-4" /></button>
            <button title="Reset" onClick={() => void resetCurrent()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={cancel} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={() => void save()} disabled={saving || !drafts} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {/* body */}
        <div className="flex flex-1 min-h-0">
          <div className="w-52 flex-shrink-0 border-r border-gray-200 overflow-y-auto custom-scrollbar py-1">
            {visibleTabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`w-full text-left px-4 py-2.5 text-sm ${
                  SIDEBAR_BORDER_AFTER.has(t) ? "border-b border-gray-300 mb-1" : ""
                } ${t === tab ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">{body}</div>
        </div>
      </div>
      {ratesOpen && <ExchangeRatesModal onClose={() => setRatesOpen(false)} />}
    </div>
  );
};

/* ── Order (POS) settings pane ─────────────────────────────────── */
const OrderSettingsPane: React.FC<{
  draft: OrderSettings;
  onChange: (d: OrderSettings) => void;
}> = ({ draft, onChange }) => {
  const [open, setOpen] = useState<string | null>("General");
  const patch = (p: Partial<OrderSettings>) => onChange({ ...draft, ...p });
  const sec = (title: string, body: React.ReactNode) => (
    <Accordion title={title} open={open === title} onToggle={() => setOpen((o) => (o === title ? null : title))}>{body}</Accordion>
  );
  return (
    <div>
      {sec("General", ORDER_GENERAL_KEYS.map((k) => (
        <Row key={k} label={k}>
          <Toggle
            on={draft.general?.[k] !== false}
            onChange={(nv) => patch({ general: { ...draft.general, [k]: nv } })}
          />
        </Row>
      )))}
      {sec("Columns", ORDER_COLUMN_KEYS.map((k) => (
        <Row key={k} label={k}>
          <Toggle
            on={draft.columns?.[k] !== false}
            onChange={(nv) => patch({ columns: { ...draft.columns, [k]: nv } })}
          />
        </Row>
      )))}
      {sec("Summary", (
        <>
          <Row label="Subtotal with tax">
            <Select
              value={draft.summarySubtotalWithTax || "Default"}
              options={["Default", "Including Tax", "Excluding Tax"]}
              onChange={(v) => patch({ summarySubtotalWithTax: v as OrderSettings["summarySubtotalWithTax"] })}
            />
          </Row>
          {ORDER_SUMMARY_KEYS.map((k) => (
            <Row key={k} label={k}>
              <Toggle
                on={draft.summary?.[k] !== false}
                onChange={(nv) => patch({ summary: { ...draft.summary, [k]: nv } })}
              />
            </Row>
          ))}
        </>
      ))}
      {sec("Print & Email", (
        <>
          <Row label="Default Print">
            <Select
              value={draft.printEmail?.defaultPrint || "KOT"}
              options={["KOT", "Receipt", "Both"]}
              onChange={(v) => patch({
                printEmail: { ...draft.printEmail, defaultPrint: v as OrderSettings["printEmail"]["defaultPrint"] },
              })}
              width="min-w-[120px]"
            />
          </Row>
          <Row label="Delivery Date">
            <Select
              value={draft.printEmail?.deliveryDate || "Show"}
              options={["Show", "Hide"]}
              onChange={(v) => patch({
                printEmail: { ...draft.printEmail, deliveryDate: v as OrderSettings["printEmail"]["deliveryDate"] },
              })}
              width="min-w-[120px]"
            />
          </Row>
          <Row label="Number of Copies on Print">
            <Select
              value={draft.printCopies || "Single Copy"}
              options={["Single Copy", "Two Copies", "Three Copies"]}
              onChange={(v) => patch({ printCopies: v as OrderSettings["printCopies"] })}
            />
          </Row>
        </>
      ))}
      {sec("Checkout", (
        <>
          {ORDER_CHECKOUT_KEYS.map((k) => (
            <Row key={k} label={k}>
              <Toggle
                on={draft.checkout?.keepAmountEditable !== false}
                onChange={(nv) => patch({ checkout: { ...draft.checkout, keepAmountEditable: nv } })}
              />
            </Row>
          ))}
          <Row label="Default Order Type">
            <Select
              value={draft.checkout?.defaultOrderType || "Manual Select"}
              options={["Manual Select", "Dine In", "Takeaway", "Delivery"]}
              onChange={(v) => patch({
                checkout: { ...draft.checkout, defaultOrderType: v as OrderSettings["checkout"]["defaultOrderType"] },
              })}
              width="min-w-[150px]"
            />
          </Row>
        </>
      ))}
      {sec("Payment", ORDER_PAYMENT_KEYS.map((k) => (
        <Row key={k} label={k}>
          <Toggle
            on={!!draft.payment?.[k]}
            onChange={(nv) => patch({ payment: { ...(draft.payment || {}), [k]: nv } })}
          />
        </Row>
      )))}
    </div>
  );
};

/* ── Customer / Vendor field visibility ─────────────────────────── */
const PartySettingsPane: React.FC<{
  draft: any;
  onChange: (d: any) => void;
  /** When set, render toggles in this order (Customer list). */
  orderedKeys?: readonly string[];
}> = ({ draft, onChange, orderedKeys }) => {
  const [open, setOpen] = useState<string | null>("Field Visibility");
  const fields = (draft?.fieldVisibility || {}) as Record<string, boolean>;
  const entries = orderedKeys
    ? orderedKeys.map((k) => [k, fields[k] !== false] as const)
    : Object.entries(fields);
  return (
    <div>
      <Accordion title="Field Visibility" open={open === "Field Visibility"} onToggle={() => setOpen((o) => (o === "Field Visibility" ? null : "Field Visibility"))}>
        {entries.map(([k, v]) => (
          <Row key={k} label={k}>
            <Toggle on={!!v} onChange={(nv) => onChange({ ...draft, fieldVisibility: { ...fields, [k]: nv } })} />
          </Row>
        ))}
      </Accordion>
    </div>
  );
};

/* ── Product tab pane ──────────────────────────────────────────── */
const PRODUCT_FV_KEYS = ["HSN", "Inventory", "MRP"] as const;
const ProductPane: React.FC<{ draft: any; patch: (p: any) => void }> = ({ draft, patch }) => {
  const [open, setOpen] = useState<string | null>("Field Visibility");
  const fv = draft.fieldVisibility || {};
  return (
    <div>
      <Accordion title="Field Visibility" open={open === "Field Visibility"} onToggle={() => setOpen((o) => (o === "Field Visibility" ? null : "Field Visibility"))}>
        {PRODUCT_FV_KEYS.map((k) => (
          <Row key={k} label={k}>
            <Toggle
              on={fv[k] !== false}
              onChange={(nv) => patch({ fieldVisibility: { ...fv, [k]: nv } })}
            />
          </Row>
        ))}
      </Accordion>
      <Accordion title="General" open={open === "General"} onToggle={() => setOpen((o) => (o === "General" ? null : "General"))}>
        <Row label="Product Image on Line Item"><Toggle on={!!draft.productImage} onChange={(v) => patch({ productImage: v })} /></Row>
        <Row label="Allow adding products with zero stock"><Select value={draft.zeroStock || "Yes, Allow"} options={["Yes, Allow", "No, Don't Allow", "Warn Me"]} onChange={(v) => patch({ zeroStock: v })} /></Row>
      </Accordion>
      <Accordion title="Stock" open={open === "Stock"} onToggle={() => setOpen((o) => (o === "Stock" ? null : "Stock"))}>
        <Row label="Product Stock"><Toggle on={draft.productStock !== false} onChange={(v) => patch({ productStock: v })} /></Row>
        <Row label="Out of Stock Items (Online Store)">
          <Select
            value={draft.outOfStockOnlineStore || "Hide"}
            options={["Hide", "Show"]}
            onChange={(v) => patch({ outOfStockOnlineStore: v })}
            width="min-w-[110px]"
          />
        </Row>
      </Accordion>
      <Accordion title="Checkout" open={open === "Checkout"} onToggle={() => setOpen((o) => (o === "Checkout" ? null : "Checkout"))}>
        <Row label="Product Price on Checkout">
          <Toggle
            on={draft.checkout?.productPriceOnCheckout !== false}
            onChange={(v) => patch({ checkout: { ...(draft.checkout || {}), productPriceOnCheckout: v } })}
          />
        </Row>
        <Row label="Product Image Size">
          <Select
            value={draft.checkout?.productImageSize || "Medium"}
            options={["Small", "Medium", "Large"]}
            onChange={(v) => patch({ checkout: { ...(draft.checkout || {}), productImageSize: v } })}
            width="min-w-[120px]"
          />
        </Row>
      </Accordion>
    </div>
  );
};

/* ── Time Log tab pane ─────────────────────────────────────────── */
const TimeLogPane: React.FC<{ draft: any; patch: (p: any) => void }> = ({ draft, patch }) => {
  const [open, setOpen] = useState<string | null>("Columns");
  return (
    <div>
      <Accordion title="Columns" open={open === "Columns"} onToggle={() => setOpen((o) => (o === "Columns" ? null : "Columns"))}>
        {Object.entries(draft.columns as Record<string, boolean>).map(([k, v]) => (
          <Row key={k} label={k}><Toggle on={v} onChange={(nv) => patch({ columns: { ...draft.columns, [k]: nv } })} /></Row>
        ))}
      </Accordion>
      <Accordion title="Summary" open={open === "Summary"} onToggle={() => setOpen((o) => (o === "Summary" ? null : "Summary"))}>
        <Row label="Time Log Rounding"><Select value={draft.rounding} options={["0 mins", "15 mins", "30 mins", "60 mins"]} onChange={(v) => patch({ rounding: v })} width="min-w-[110px]" /></Row>
      </Accordion>
    </div>
  );
};

export default AppSettingsModal;
