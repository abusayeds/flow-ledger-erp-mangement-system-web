/**
 * Email Templates modal — 3-column layout matching the product screenshot:
 * left type nav · center editor (Cc/Bcc/Subject/Body/PDF name) · right Parameters.
 * Persists via GET/PATCH `/setting/email-templates`.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import {
  DEFAULT_ITEMS,
  DEFAULT_SETTINGS,
  DEFAULT_SIGNATURE,
  DOC_TYPE_LABELS,
  EMAIL_DOC_TYPES,
  NAV_ITEMS,
  emptyItem,
  fetchEmailTemplates,
  mapItem,
  mapSettings,
  paramsForDoc,
  patchEmailTemplateSection,
  type EmailDocType,
  type EmailNavKey,
  type EmailTemplateDoc,
  type EmailTemplateItem,
  type EmailTemplateSettings,
} from "@/services/emailTemplatesApi";

const isDocType = (k: EmailNavKey): k is EmailDocType =>
  (EMAIL_DOC_TYPES as readonly string[]).includes(k);

type FocusField = "cc" | "bcc" | "subject" | "body" | "pdf_file_name" | "signature" | null;

export const EmailTemplatesModal: React.FC<{
  onClose: () => void;
  initialNav?: EmailNavKey;
}> = ({ onClose, initialNav = "invoice" }) => {
  const [nav, setNav] = useState<EmailNavKey>(initialNav);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<EmailTemplateDoc | null>(null);
  const [settings, setSettings] = useState<EmailTemplateSettings>({ ...DEFAULT_SETTINGS });
  const [items, setItems] = useState<Record<EmailDocType, EmailTemplateItem>>(() => {
    const init = {} as Record<EmailDocType, EmailTemplateItem>;
    for (const t of EMAIL_DOC_TYPES) init[t] = { ...DEFAULT_ITEMS[t] };
    return init;
  });
  const [signature, setSignature] = useState(DEFAULT_SIGNATURE);
  const [focusField, setFocusField] = useState<FocusField>("body");
  const fieldRefs = useRef<Partial<Record<Exclude<FocusField, null>, HTMLInputElement | HTMLTextAreaElement>>>({});

  const applyDoc = (raw: EmailTemplateDoc | null) => {
    setDoc(raw);
    setSettings(mapSettings(raw?.settings));
    const next = {} as Record<EmailDocType, EmailTemplateItem>;
    for (const t of EMAIL_DOC_TYPES) {
      next[t] = mapItem(raw?.templates?.[t], DEFAULT_ITEMS[t]);
    }
    setItems(next);
    setSignature(textOr(raw?.signature, DEFAULT_SIGNATURE));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEmailTemplates().then((raw) => {
      if (!alive) return;
      applyDoc(raw);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const currentItem = isDocType(nav) ? items[nav] : emptyItem();
  const params = useMemo(() => (isDocType(nav) ? paramsForDoc(nav) : []), [nav]);

  const setItemField = (key: keyof EmailTemplateItem, value: string) => {
    if (!isDocType(nav)) return;
    setItems((prev) => ({ ...prev, [nav]: { ...prev[nav], [key]: value } }));
  };

  const insertTag = (tag: string) => {
    const field = focusField;
    if (!field || field === "cc" || field === "bcc") {
      if (isDocType(nav)) {
        setItemField("body", `${currentItem.body}${currentItem.body.endsWith("\n") || !currentItem.body ? "" : "\n"}${tag}`);
        setFocusField("body");
      }
      return;
    }
    const el = fieldRefs.current[field];
    if (field === "signature") {
      if (el && typeof el.selectionStart === "number") {
        const start = el.selectionStart;
        const end = el.selectionEnd ?? start;
        const next = signature.slice(0, start) + tag + signature.slice(end);
        setSignature(next);
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + tag.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        setSignature((s) => s + tag);
      }
      return;
    }
    if (!isDocType(nav)) return;
    const key = field as keyof EmailTemplateItem;
    const value = currentItem[key] || "";
    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = value.slice(0, start) + tag + value.slice(end);
      setItemField(key, next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + tag.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setItemField(key, value + tag);
    }
  };

  const resetCurrent = () => {
    if (nav === "settings") {
      setSettings({ ...DEFAULT_SETTINGS });
      showToast("Settings reset to defaults", "info");
      return;
    }
    if (nav === "signature") {
      setSignature(DEFAULT_SIGNATURE);
      showToast("Signature reset to defaults", "info");
      return;
    }
    setItems((prev) => ({ ...prev, [nav]: { ...DEFAULT_ITEMS[nav] } }));
    showToast(`${DOC_TYPE_LABELS[nav]} template reset`, "info");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let data: EmailTemplateSettings | EmailTemplateItem | string;
      if (nav === "settings") data = settings;
      else if (nav === "signature") data = signature;
      else data = items[nav];
      const saved = await patchEmailTemplateSection(nav, data);
      applyDoc(saved);
      showToast("Email template saved", "success");
    } catch (err) {
      showToast(
        err instanceof ApiError && err.message
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save email template",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-3 sm:p-6"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[min(92vh,860px)] bg-white text-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col border border-gray-300"
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Email Templates</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Reset"
              onClick={resetCurrent}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void save()}
              className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600 sm:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="w-10 h-10 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* left nav */}
            <aside className="w-[200px] shrink-0 border-r border-gray-200 overflow-y-auto custom-scrollbar bg-gray-50">
              {NAV_ITEMS.map((item) => {
                const active = nav === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setNav(item.key)}
                    className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-200 transition-colors ${
                      active
                        ? "bg-white text-blue-700 font-semibold border-l-2 border-l-blue-600"
                        : "text-gray-800 hover:bg-gray-100"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </aside>

            {/* center editor */}
            <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-white">
              {nav === "settings" ? (
                <SettingsEditor settings={settings} onChange={setSettings} />
              ) : nav === "signature" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">Signature</label>
                  <textarea
                    ref={(el) => {
                      if (el) fieldRefs.current.signature = el;
                    }}
                    value={signature}
                    onFocus={() => setFocusField("signature")}
                    onChange={(e) => setSignature(e.target.value)}
                    rows={12}
                    className="ua-field keep-box w-full px-3 py-2.5 text-sm focus:outline-none resize-y min-h-[220px]"
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Appended below the email body when sending. You can use parameters like{" "}
                    <span className="text-blue-700 font-medium">&lt;company&gt;</span>.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Cc"
                      value={currentItem.cc}
                      onChange={(v) => setItemField("cc", v)}
                      onFocus={() => setFocusField("cc")}
                      inputRef={(el) => {
                        if (el) fieldRefs.current.cc = el;
                      }}
                    />
                    <Field
                      label="Bcc"
                      value={currentItem.bcc}
                      onChange={(v) => setItemField("bcc", v)}
                      onFocus={() => setFocusField("bcc")}
                      inputRef={(el) => {
                        if (el) fieldRefs.current.bcc = el;
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Subject</label>
                    <input
                      ref={(el) => {
                        if (el) fieldRefs.current.subject = el;
                      }}
                      value={currentItem.subject}
                      onFocus={() => setFocusField("subject")}
                      onChange={(e) => setItemField("subject", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">Body</label>
                    <textarea
                      ref={(el) => {
                        if (el) fieldRefs.current.body = el;
                      }}
                      value={currentItem.body}
                      onFocus={() => setFocusField("body")}
                      onChange={(e) => setItemField("body", e.target.value)}
                      rows={14}
                      className="ua-field keep-box w-full px-3 py-2.5 text-sm font-mono leading-relaxed focus:outline-none resize-y min-h-[260px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">PDF File Name</label>
                    <input
                      ref={(el) => {
                        if (el) fieldRefs.current.pdf_file_name = el;
                      }}
                      value={currentItem.pdf_file_name}
                      onFocus={() => setFocusField("pdf_file_name")}
                      onChange={(e) => setItemField("pdf_file_name", e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </>
              )}
              {!doc && (
                <p className="text-xs text-gray-600">No saved templates yet — defaults shown. Save to create.</p>
              )}
            </div>

            {/* right parameters */}
            {(isDocType(nav) || nav === "signature") && (
              <aside className="w-[240px] shrink-0 border-l border-gray-200 overflow-y-auto custom-scrollbar bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Parameters</h3>
                <ul className="space-y-2.5">
                  {(nav === "signature"
                    ? [
                        { tag: "<company>", label: "Current company name" },
                        { tag: "<customer>", label: "Customer Name" },
                        { tag: "<sign1>", label: "First signature name" },
                        { tag: "<sign2>", label: "Second signature name" },
                      ]
                    : params
                  ).map((p) => (
                    <li key={p.tag}>
                      <button
                        type="button"
                        title={`Insert ${p.tag}`}
                        onClick={() => insertTag(p.tag)}
                        className="text-left w-full group rounded-md px-1.5 py-1 hover:bg-white"
                      >
                        <span className="text-[13px] text-blue-700 group-hover:text-blue-800 font-semibold">
                          {p.tag}
                        </span>
                        <span className="block text-[11px] text-gray-700 leading-snug mt-0.5">
                          {p.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const textOr = (v: unknown, fallback: string) => {
  const s = typeof v === "string" ? v : "";
  return s.trim() ? s : fallback;
};

const fieldClass =
  "ua-field keep-box w-full px-3 py-2 text-sm focus:outline-none";

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}> = ({ label, value, onChange, onFocus, inputRef }) => (
  <div>
    <label className="block text-sm font-medium text-gray-800 mb-1.5">{label}</label>
    <input
      ref={inputRef}
      value={value}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      className={fieldClass}
    />
  </div>
);

const SettingsEditor: React.FC<{
  settings: EmailTemplateSettings;
  onChange: (s: EmailTemplateSettings) => void;
}> = ({ settings, onChange }) => {
  const set = (k: keyof EmailTemplateSettings, v: string) => onChange({ ...settings, [k]: v });
  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">From</label>
        <input
          value={settings.from}
          onChange={(e) => set("from", e.target.value)}
          placeholder="Company display name or email"
          className={fieldClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">Font Style</label>
        <select
          value={settings.font_style}
          onChange={(e) => set("font_style", e.target.value)}
          className={fieldClass}
        >
          {["Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana"].map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">Font Size</label>
        <select
          value={settings.font_size}
          onChange={(e) => set("font_size", e.target.value)}
          className={fieldClass}
        >
          {["12", "13", "14", "15", "16", "18"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">Send copy to salesperson</label>
        <select
          value={settings.send_copy_to_salesperson}
          onChange={(e) => set("send_copy_to_salesperson", e.target.value)}
          className={fieldClass}
        >
          {["Do not send", "Send"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default EmailTemplatesModal;
