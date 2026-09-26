/**
 * File: src/pages/crm/crmDetailShared.tsx
 * Shared building blocks for the CRM Lead/Deal detail pages: a lightweight
 * rich-text editor (toolbar + contentEditable), a searchable multi-select
 * "Add" picker, the option catalogs, and small helpers. Kept theme-neutral
 * (Qayd blue/dark) so both LeadDetail.tsx and DealDetail.tsx stay in sync.
 */

import React, { useEffect, useRef, useState } from "react";
import { showToast } from "../../utils/toast";
import {
  X,
  Search,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
} from "lucide-react";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const nowStamp = () =>
  new Date().toISOString().slice(0, 16).replace("T", " ");

export const USER_CATALOG = [
  "John Smith",
  "Michael Brown",
  "Robert Taylor",
  "James Garcia",
  "Christopher Lee",
  "Daniel Thompson",
  "David Wilson",
  "Jane Doe",
  "Sarah Wilson",
];
export const SOURCE_CATALOG = [
  "Website Contact Form",
  "Referral Program",
  "Google Ads Campaign",
  "Trade Show Events",
  "LinkedIn Outreach",
  "Content Marketing",
  "Social Media Marketing",
  "Email Marketing",
  "Cold Calling",
  "Networking Events",
];
export const PRODUCT_CATALOG = [
  "Watch",
  "Tailoring Service",
  "Notebook",
  "Cordless Drill Machine",
  "Smartphone",
  "Jewelry Repair Service",
  "Football",
  "Ink Cartridge",
  "Laptop",
  "Light Bulb",
];
export const CLIENT_CATALOG = [
  "Acme Corp",
  "MediaWorks",
  "StartupX",
  "TechCorp",
  "ServiceHub",
  "ConsultCo",
  "PriceWatchers",
  "PartnerInc",
  "DemoCo",
  "Michelle Hall",
];

/* ── Lightweight rich-text editor (toolbar + contentEditable) ───────── */
export const RichEditor: React.FC<{
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}> = ({ value, onChange, minHeight = 180 }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML || "");
  };

  const Btn: React.FC<{ cmd: string; arg?: string; title: string; children: React.ReactNode }> = ({
    cmd,
    arg,
    title,
    children,
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        if (cmd === "createLink") {
          const url = prompt("Enter URL");
          if (url) exec(cmd, url);
        } else exec(cmd, arg);
      }}
      className="p-1.5 rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1.5">
        <Btn cmd="bold" title="Bold"><Bold className="w-4 h-4" /></Btn>
        <Btn cmd="italic" title="Italic"><Italic className="w-4 h-4" /></Btn>
        <Btn cmd="underline" title="Underline"><Underline className="w-4 h-4" /></Btn>
        <Btn cmd="strikeThrough" title="Strikethrough"><Strikethrough className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn cmd="justifyLeft" title="Align left"><AlignLeft className="w-4 h-4" /></Btn>
        <Btn cmd="justifyCenter" title="Align center"><AlignCenter className="w-4 h-4" /></Btn>
        <Btn cmd="justifyRight" title="Align right"><AlignRight className="w-4 h-4" /></Btn>
        <Btn cmd="justifyFull" title="Justify"><AlignJustify className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn cmd="insertUnorderedList" title="Bulleted list"><List className="w-4 h-4" /></Btn>
        <Btn cmd="insertOrderedList" title="Numbered list"><ListOrdered className="w-4 h-4" /></Btn>
        <Btn cmd="formatBlock" arg="blockquote" title="Quote"><Quote className="w-4 h-4" /></Btn>
        <Btn cmd="createLink" title="Insert link"><LinkIcon className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <Btn cmd="undo" title="Undo"><Undo2 className="w-4 h-4" /></Btn>
        <Btn cmd="redo" title="Redo"><Redo2 className="w-4 h-4" /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML || "")}
        className="px-3 py-2 text-sm text-gray-900 outline-none prose-sm"
        style={{ minHeight }}
        suppressContentEditableWarning
      />
    </div>
  );
};

/* ── Searchable multi-select picker (Add Users/Products/Sources/Clients) ── */
export type PickerOption = { id: string; name: string };

export const AddPicker: React.FC<{
  title: string;
  label: string;
  options: PickerOption[];
  existing: string[];
  onClose: () => void;
  onAdd: (items: PickerOption[]) => void;
}> = ({ title, label, options, existing, onClose, onAdd }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const available = options.filter((o) => !existing.includes(o.id));
  const filtered = available.filter((o) =>
    o.name.toLowerCase().includes(query.toLowerCase()),
  );
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-32 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
          <div className="border border-gray-300 rounded-md">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-gray-400">
                  Nothing to add
                </div>
              )}
              {filtered.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    className="accent-blue-600"
                  />
                  {o.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selected.length === 0) {
                showToast("Select at least one", "info");
                return;
              }
              const picked = options.filter((o) => selected.includes(o.id));
              onAdd(picked);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
