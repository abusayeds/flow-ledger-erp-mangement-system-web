/**
 * File: src/components/modals/PdfPrintSettingsModal.tsx
 * "PDF & Print Settings" — full rebuild matching the reference design, in the
 * app's light theme. Document-type dropdown + Normal/Thermal print switch,
 * LIVE preview on the left (re-renders on every change), accordion settings on
 * the right, Reset / Preview / Default / Standard toolbar at the bottom.
 * Settings persist per doc-type + print-mode in the datastore (IndexedDB), so
 * every preview / download across the app follows them.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Eye,
  Brush,
  FileStack,
  Check,
  Pencil,
} from "lucide-react";
import {
  PDF_DOC_TYPES,
  DEFAULT_PDF_SETTINGS,
  STANDARD_PDF_SETTINGS,
  getPdfSettings,
  savePdfSettings,
  resetPdfSettings,
  type PdfDocType,
  type PdfSettings,
  type PrintMode,
} from "@/lib/db/pdfSettings";
import { PdfDocPreview } from "@/lib/db/PdfDocPreview";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";

/* ── small controls ────────────────────────────────────────────── */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
  </button>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-700">{label}</span>
    {children}
  </div>
);

const Select: React.FC<{ value: string; options: string[]; onChange: (v: string) => void }> = ({ value, options, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-sm border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-[130px]"
  >
    {options.map((o) => <option key={o}>{o}</option>)}
  </select>
);

const Section: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, open, onToggle, children }) => (
  <div className="border-b border-gray-200">
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100">
      <span className="text-sm font-semibold text-gray-900">{title}</span>
      {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
    </button>
    {open && <div>{children}</div>}
  </div>
);

/* ── margin editor popover ─────────────────────────────────────── */
const MarginRow: React.FC<{ value: PdfSettings["margin"]; onChange: (m: PdfSettings["margin"]) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const num = (v: string) => Math.max(0, Math.min(120, parseInt(v, 10) || 0));
  return (
    <div className="relative px-4 py-2.5 border-b border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-gray-700">Margin</span>
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-sm text-gray-800 border border-gray-300 rounded-md px-2.5 py-1.5 hover:border-gray-400">
          {value.top},{value.bottom},{value.left},{value.right}
          <Pencil className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>
      {open && (
        <div className="absolute right-4 top-full z-30 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-xl p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Margin</div>
          {(["top", "bottom", "left", "right"] as const).map((k) => (
            <label key={k} className="block mb-2">
              <span className="text-[11px] text-gray-500 capitalize">{k}</span>
              <input
                type="number"
                value={draft[k]}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: num(e.target.value) }))}
                className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </label>
          ))}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setDraft(DEFAULT_PDF_SETTINGS.margin)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Reset</button>
            <button onClick={() => { onChange(draft); setOpen(false); }} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── color swatches block ──────────────────────────────────────── */
const ColorsBlock: React.FC<{ s: PdfSettings; set: (k: keyof PdfSettings, v: any) => void }> = ({ s, set }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 border-b border-gray-100">
    {([["textColor", "Text Color"], ["borderColor", "Border Color"], ["fillColor", "Fill Color"], ["fillTextColor", "Fill Text Color"]] as const).map(([k, label]) => (
      <label key={k} className="flex items-center gap-2 cursor-pointer">
        <span className="relative inline-block w-6 h-6 rounded border border-gray-400" style={{ background: s[k] as string }}>
          <input type="color" value={s[k] as string} onChange={(e) => set(k, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </span>
        <span className="text-sm text-gray-700">{label}</span>
      </label>
    ))}
  </div>
);

/* ── settings schema (drives rendering + search) ───────────────── */
type Ctrl =
  | { kind: "colors" }
  | { kind: "margin" }
  | { kind: "toggle"; key: keyof PdfSettings; label: string }
  | { kind: "select"; key: keyof PdfSettings; label: string; options: string[] };

interface SectionDef { title: string; modes: PrintMode[]; rows: (Ctrl & { modes?: PrintMode[] })[] }

const SECTIONS: SectionDef[] = [
  {
    title: "Style", modes: ["normal"],
    rows: [
      { kind: "colors" },
      { kind: "select", key: "font", label: "Font", options: ["Arial", "Helvetica", "Times", "Courier"] },
      { kind: "select", key: "fontSize", label: "Font Size", options: ["Small", "Medium", "Large"] },
      { kind: "select", key: "paper", label: "Paper", options: ["US Paper", "A4 Paper"] },
      { kind: "select", key: "fullPage", label: "Full Page", options: ["Yes", "No"] },
      { kind: "select", key: "horizontalLines", label: "Horizontal Lines", options: ["Show", "Hide"] },
      { kind: "select", key: "verticalLines", label: "Vertical Lines", options: ["Show", "Hide"] },
      { kind: "select", key: "scaling", label: "Scaling", options: ["Aspect To Fit", "Actual Size"] },
      { kind: "select", key: "horizontal", label: "Horizontal", options: ["Left", "Center", "Right"] },
      { kind: "select", key: "vertical", label: "Vertical", options: ["Top", "Center", "Bottom"] },
      { kind: "margin" },
      { kind: "select", key: "outerBorder", label: "Outer Border", options: ["Show", "Hide"] },
      { kind: "toggle", key: "compactMode", label: "Compact Mode" },
    ],
  },
  {
    title: "Header", modes: ["normal", "thermal"],
    rows: [
      { kind: "select", key: "titleAlignment", label: "Title Alignment", options: ["Left", "Center", "Right"] },
      { kind: "select", key: "subTitleAlignment", label: "Sub Title Alignment", options: ["Left", "Center", "Right"], modes: ["normal"] },
      { kind: "toggle", key: "subTitle", label: "Sub Title" },
      { kind: "select", key: "logoSize", label: "Logo Size", options: ["Small", "Medium", "Large"] },
      { kind: "select", key: "dateFormat", label: "Date Format", options: ["Short", "Medium", "Long"] },
      { kind: "toggle", key: "logo", label: "Logo" },
      { kind: "toggle", key: "header", label: "Header" },
      { kind: "toggle", key: "numberNo", label: "Number #" },
      { kind: "toggle", key: "poNo", label: "P.O. No" },
      { kind: "toggle", key: "dueDate", label: "Due Date" },
      { kind: "toggle", key: "documentCopyLabel", label: "Document Copy Label", modes: ["normal"] },
      { kind: "toggle", key: "totalAmount", label: "Total Amount" },
      { kind: "toggle", key: "paidAmount", label: "Paid Amount" },
    ],
  },
  {
    title: "Company", modes: ["normal", "thermal"],
    rows: [
      { kind: "toggle", key: "companyRegNo", label: "Reg. No" },
      { kind: "select", key: "companyRegTaxAlignBelow", label: "Reg. No & Tax ID Align Below", options: ["Name", "Address"] },
      { kind: "toggle", key: "companyTaxId", label: "Tax ID" },
      { kind: "toggle", key: "companyName", label: "Company Name" },
      { kind: "toggle", key: "companyCountry", label: "Country" },
      { kind: "toggle", key: "companyAddress", label: "Address" },
      { kind: "toggle", key: "companyPhone", label: "Phone" },
      { kind: "toggle", key: "companyMobile", label: "Mobile" },
      { kind: "toggle", key: "companyFax", label: "Fax" },
      { kind: "toggle", key: "companyEmail", label: "Email" },
      { kind: "toggle", key: "companyWebsite", label: "Website" },
    ],
  },
  {
    title: "Contact", modes: ["normal", "thermal"],
    rows: [
      { kind: "toggle", key: "contactTaxId", label: "Tax ID" },
      { kind: "toggle", key: "contactRegNo", label: "Reg. No" },
      { kind: "select", key: "contactRegTaxAlignBelow", label: "Reg. No & Tax ID Align Below", options: ["Name", "Address"] },
      { kind: "toggle", key: "contactHomePhone", label: "Home Phone" },
      { kind: "toggle", key: "contactBusinessPhone", label: "Business Phone" },
      { kind: "toggle", key: "contactEmail", label: "Email" },
      { kind: "select", key: "contactEmailBelow", label: "Email Below Contact", options: ["Name", "Address"] },
      { kind: "toggle", key: "contactMobile", label: "Mobile" },
      { kind: "toggle", key: "contactFax", label: "Fax" },
      { kind: "toggle", key: "contactFirstLastName", label: "First/Last Name" },
      { kind: "select", key: "contactMobileBelow", label: "Mobile Below Contact", options: ["Name", "Address"] },
      { kind: "select", key: "contactAddressAlignment", label: "Address Alignment", options: ["Left", "Right"] },
    ],
  },
  {
    title: "Summary", modes: ["normal", "thermal"],
    rows: [
      { kind: "toggle", key: "summaryTotal", label: "Total" },
      { kind: "toggle", key: "summaryAmountUsed", label: "Amount Used", modes: ["thermal"] },
      { kind: "select", key: "summaryTax", label: "Tax", options: ["Individual", "Group"] },
      { kind: "toggle", key: "summaryTaxPercent", label: "Tax % Value" },
      { kind: "toggle", key: "summaryTaxableAmount", label: "Taxable Amount" },
      { kind: "toggle", key: "summaryReturnOrder", label: "Return Order" },
    ],
  },
  {
    title: "Notes & Terms", modes: ["normal", "thermal"],
    rows: [
      { kind: "toggle", key: "showNotes", label: "Notes" },
      { kind: "toggle", key: "showTerms", label: "Terms & Conditions" },
    ],
  },
  {
    title: "Signature", modes: ["normal", "thermal"],
    rows: [
      { kind: "select", key: "companySign", label: "Company Signature", options: ["Company", "None"] },
      { kind: "select", key: "companySignAlignment", label: "Company Signature Alignment", options: ["Left", "Right"], modes: ["normal"] },
      { kind: "toggle", key: "contactSign", label: "Customer Signature" },
      { kind: "select", key: "contactSignAlignment", label: "Customer Signature Alignment", options: ["Left", "Right"], modes: ["normal"] },
      { kind: "select", key: "signatureSize", label: "Signature Size", options: ["Small", "Medium", "Large"], modes: ["normal"] },
    ],
  },
  {
    title: "Footer", modes: ["normal", "thermal"],
    rows: [
      { kind: "toggle", key: "createdHyperlink", label: "Created Qayd Hyperlink" },
      { kind: "select", key: "showTemplateForPages", label: "Show Template for Page(s)", options: ["First", "All"] },
      { kind: "select", key: "pageNumberAlignment", label: "Page Number Alignment", options: ["Left", "Center", "Right"] },
      { kind: "toggle", key: "pageNumber", label: "Page Number" },
    ],
  },
  {
    title: "Payment", modes: ["normal", "thermal"],
    rows: [
      { kind: "toggle", key: "paymentHistory", label: "Payment History", modes: ["normal"] },
      { kind: "select", key: "payNowAlignment", label: "Pay Now Button Alignment", options: ["Up", "Down"], modes: ["normal"] },
      { kind: "select", key: "paymentMethodsAlignment", label: "Payment Methods Alignment", options: ["Below", "Above"], modes: ["normal"] },
      { kind: "select", key: "paymentMethods", label: "Payment Methods", options: ["Show", "Hide"] },
      { kind: "toggle", key: "paymentNote", label: "Payment Note" },
      { kind: "toggle", key: "paymentNumber", label: "Payment #" },
    ],
  },
];

/* ── dropdown (doc type / print mode) ──────────────────────────── */
const HeaderDropdown: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
  align?: "left" | "right";
}> = ({ value, options, onChange, align = "left" }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:text-blue-700">
        {value} <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
      {open && (
        <div className={`absolute z-40 mt-2 min-w-[190px] max-h-[420px] overflow-y-auto bg-white border border-gray-200 rounded-md shadow-xl py-1 ${align === "right" ? "right-0" : "left-0"}`}>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
              {o} {o === value && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── main modal ────────────────────────────────────────────────── */
export const PdfPrintSettingsModal: React.FC<{
  onClose: () => void;
  initialDocType?: PdfDocType;
  initialMode?: PrintMode;
  /** lock the preview to one customer's statement etc. */
  partyId?: number;
}> = ({ onClose, initialDocType = "invoice", initialMode = "normal", partyId }) => {
  const [docChoice, setDocChoice] = useState<string>(PDF_DOC_TYPES.find((d) => d.key === initialDocType)?.label || "Invoice");
  const [mode, setMode] = useState<PrintMode>(initialMode);
  const [draft, setDraft] = useState<PdfSettings>({ ...DEFAULT_PDF_SETTINGS });
  const [saved, setSaved] = useState<PdfSettings>({ ...DEFAULT_PDF_SETTINGS });
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["Style", "Header"]));
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bigPreview, setBigPreview] = useState(false);

  const [saving, setSaving] = useState(false);

  const isAll = docChoice === "All";
  const docType: PdfDocType = (PDF_DOC_TYPES.find((d) => d.label === docChoice)?.key || "invoice") as PdfDocType;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && (bigPreview ? setBigPreview(false) : onClose());
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, bigPreview]);

  /* load the saved settings whenever type or mode changes */
  useEffect(() => {
    let alive = true;
    getPdfSettings(docType, mode).then((s) => { if (alive) { setDraft(s); setSaved(s); } });
    return () => { alive = false; };
  }, [docType, mode]);

  const set = (k: keyof PdfSettings, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isAll) {
        await Promise.all(PDF_DOC_TYPES.map((d) => savePdfSettings(d.key, mode, draft)));
      } else {
        await savePdfSettings(docType, mode, draft);
      }
      setSaved(draft);
      showToast("PDF & Print settings saved", "success");
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.message
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save PDF settings.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const resetToServerDefaults = async () => {
    try {
      if (isAll) {
        const results = await Promise.all(PDF_DOC_TYPES.map((d) => resetPdfSettings(d.key, mode)));
        const next = results[0] || { ...DEFAULT_PDF_SETTINGS };
        setDraft(next);
        setSaved(next);
      } else {
        const next = await resetPdfSettings(docType, mode);
        setDraft(next);
        setSaved(next);
      }
      showToast("PDF settings reset to defaults", "info");
    } catch (err) {
      setDraft({ ...DEFAULT_PDF_SETTINGS });
      showToast(
        err instanceof ApiError && err.message ? err.message : "Reset locally",
        "info",
      );
    }
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECTIONS
      .filter((sec) => sec.modes.includes(mode))
      .map((sec) => ({
        ...sec,
        rows: sec.rows.filter((r) => {
          if (r.modes && !r.modes.includes(mode)) return false;
          if (!q) return true;
          const label = r.kind === "colors" ? "text color border fill" : r.kind === "margin" ? "margin" : r.label.toLowerCase();
          return label.includes(q) || sec.title.toLowerCase().includes(q);
        }),
      }))
      .filter((sec) => sec.rows.length > 0);
  }, [mode, query]);

  const toggleSection = (t: string) => setOpenSections((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  useEffect(() => { if (query.trim()) setOpenSections(new Set(sections.map((s) => s.title))); }, [query, sections]);

  const toolbar: { icon: React.ElementType; label: string; onClick: () => void }[] = [
    { icon: RotateCcw, label: "Reset", onClick: () => void resetToServerDefaults() },
    { icon: Eye, label: "Preview", onClick: () => setBigPreview(true) },
    ...(mode === "normal"
      ? [
          { icon: Brush, label: "Default", onClick: () => setDraft({ ...DEFAULT_PDF_SETTINGS }) },
          { icon: FileStack, label: "Standard", onClick: () => setDraft({ ...STANDARD_PDF_SETTINGS }) },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-6xl h-[92vh] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">PDF &amp; Print Settings</h3>
          <div className="flex items-center gap-2">
            {searchOpen ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => { if (!query) setSearchOpen(false); }}
                  placeholder="Search settings..."
                  className="w-52 pl-8 pr-7 py-1.5 text-sm bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Search className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={() => void save()} disabled={saving} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* doc type + print mode */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 bg-gray-50">
          <HeaderDropdown value={docChoice} options={["All", ...PDF_DOC_TYPES.map((d) => d.label)]} onChange={setDocChoice} />
          <HeaderDropdown value={mode === "normal" ? "Normal Print" : "Thermal Print"} options={["Thermal Print", "Normal Print"]} onChange={(v) => setMode(v.startsWith("Thermal") ? "thermal" : "normal")} align="right" />
        </div>

        {/* body */}
        <div className="flex-1 flex min-h-0">
          {/* preview */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-200/70 p-6">
            <div className="max-w-[640px] mx-auto">
              <PdfDocPreview docType={docType} mode={mode} settings={draft} partyId={partyId} />
            </div>
          </div>
          {/* settings */}
          <div className="w-[370px] flex-shrink-0 border-l border-gray-200 overflow-y-auto custom-scrollbar">
            {sections.map((sec) => (
              <Section key={sec.title} title={sec.title} open={openSections.has(sec.title)} onToggle={() => toggleSection(sec.title)}>
                {sec.rows.map((r, i) => {
                  if (r.kind === "colors") return <ColorsBlock key={i} s={draft} set={set} />;
                  if (r.kind === "margin") return <MarginRow key={i} value={draft.margin} onChange={(m) => set("margin", m)} />;
                  if (r.kind === "toggle") return <Row key={i} label={r.label}><Toggle checked={!!draft[r.key]} onChange={(v) => set(r.key, v)} /></Row>;
                  return <Row key={i} label={r.label}><Select value={String(draft[r.key])} options={r.options} onChange={(v) => set(r.key, v)} /></Row>;
                })}
              </Section>
            ))}
          </div>
        </div>

        {/* bottom toolbar */}
        <div className="flex items-center gap-8 px-8 py-3 border-t border-gray-200 bg-gray-50">
          {toolbar.map((t) => (
            <button key={t.label} onClick={t.onClick} className="flex flex-col items-center gap-1 text-gray-700 hover:text-blue-700">
              <t.icon className="w-5 h-5" />
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* full preview overlay */}
      {bigPreview && (
        <div className="fixed inset-0 z-[95] bg-black/70 flex items-start justify-center p-6 overflow-y-auto" onMouseDown={() => setBigPreview(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl my-4">
            <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white rounded-t-lg">
              <h3 className="text-base font-medium">{docChoice} Preview</h3>
              <button onClick={() => setBigPreview(false)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <PdfDocPreview docType={docType} mode={mode} settings={draft} partyId={partyId} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfPrintSettingsModal;
