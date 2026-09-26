/**
 * Customer / Vendor statement export config modal.
 * Matches the Statement design: floating-label selects, message placement, export.
 */

import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { dateRangeFor } from "@/lib/listDateRange";

export const STATEMENT_DATE_RANGES = [
  "Today",
  "All",
  "This Week",
  "Last Week",
  "This Month",
  "Last Month",
  "Last 30 Days",
] as const;

export const STATEMENT_DATA_TYPES = ["All Transactions", "Outstanding"] as const;

export const STATEMENT_EXPORT_FORMATS = ["PDF", "CSV", "XLSX", "XLS", "Excel"] as const;

export type StatementPartyKind = "customer" | "vendor";

export type StatementConfig = {
  dateRange: (typeof STATEMENT_DATE_RANGES)[number];
  dataType: (typeof STATEMENT_DATA_TYPES)[number];
  status: "Sales" | "Purchases";
  exportFormat: (typeof STATEMENT_EXPORT_FORMATS)[number];
  messagePlacement: "bottom" | "top";
  message: string;
  /** Resolved ISO range for API / preview (empty when All). */
  dateFrom?: string;
  dateTo?: string;
};

type Props = {
  party: StatementPartyKind;
  onClose: () => void;
  onExport: (config: StatementConfig) => void;
};

const FloatSelect: React.FC<{
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="relative fl-wrap">
    <label className="fl-label">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none px-3 py-2.5 pr-9 text-sm bg-transparent text-gray-900 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
  </div>
);

export const PartyStatementModal: React.FC<Props> = ({ party, onClose, onExport }) => {
  const statusDefault: "Sales" | "Purchases" = party === "customer" ? "Sales" : "Purchases";
  const [dateRange, setDateRange] = useState<(typeof STATEMENT_DATE_RANGES)[number]>("Today");
  const [dataType, setDataType] = useState<(typeof STATEMENT_DATA_TYPES)[number]>("All Transactions");
  const [status, setStatus] = useState<"Sales" | "Purchases">(statusDefault);
  const [exportFormat, setExportFormat] = useState<(typeof STATEMENT_EXPORT_FORMATS)[number]>("PDF");
  const [messagePlacement, setMessagePlacement] = useState<"bottom" | "top">("bottom");
  const [message, setMessage] = useState("");

  const statusOptions = party === "customer" ? (["Sales"] as const) : (["Purchases"] as const);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleExport = () => {
    const range = dateRangeFor(dateRange);
    onExport({
      dateRange,
      dataType,
      status,
      exportFormat,
      messagePlacement,
      message: message.trim(),
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="my-16 w-full max-w-md overflow-hidden rounded-lg border border-gray-300 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-3.5">
          <h3 className="text-base font-semibold text-gray-900">Statement</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded-md border border-gray-300 bg-gray-200 px-4 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-300"
            >
              Export
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <FloatSelect
            label="Date Range"
            value={dateRange}
            options={STATEMENT_DATE_RANGES}
            onChange={(v) => setDateRange(v as (typeof STATEMENT_DATE_RANGES)[number])}
          />

          <div className="grid grid-cols-2 gap-3">
            <FloatSelect
              label="Data Type"
              value={dataType}
              options={STATEMENT_DATA_TYPES}
              onChange={(v) => setDataType(v as (typeof STATEMENT_DATA_TYPES)[number])}
            />
            <FloatSelect
              label="Status"
              value={status}
              options={statusOptions}
              onChange={(v) => setStatus(v as "Sales" | "Purchases")}
            />
          </div>

          <FloatSelect
            label="Export Format"
            value={exportFormat}
            options={STATEMENT_EXPORT_FORMATS}
            onChange={(v) => setExportFormat(v as (typeof STATEMENT_EXPORT_FORMATS)[number])}
          />

          <div>
            <p className="mb-2.5 text-sm font-medium text-gray-800">Message Placement</p>
            <div className="flex flex-wrap items-center gap-6">
              {(
                [
                  ["bottom", "Bottom of Statement"],
                  ["top", "Top of Statement"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="statement-message-placement"
                    checked={messagePlacement === value}
                    onChange={() => setMessagePlacement(value)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="relative fl-wrap">
            <label className="fl-label">Statement Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder=" "
              rows={5}
              className="w-full resize-y bg-transparent px-3 py-2.5 text-sm text-gray-900 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartyStatementModal;
