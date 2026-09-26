/**
 * File: src/components/modals/ActivityLogModal.tsx
 * "Activity Log" modal (matches the reference): centered dialog with an
 * icon-tagged timeline — send / print / plus icons, blue #number references,
 * "Today 08:49 AM • info@inovoic.com" stamps. Reads the record's persisted
 * `activity` array plus a synthesized "created" event.
 */

import React, { useEffect } from "react";
import { X, Plus, Send, Printer } from "lucide-react";

export const ActivityLogModal: React.FC<{
  docLabel: string;
  record: any;
  onClose: () => void;
}> = ({ docLabel, record, onClose }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  const label = (ts?: number) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toDateString() === new Date().toDateString()
      ? "Today " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const rows = [
    ...([...(record.activity || [])].reverse()),
    { kind: "created", text: `New ${docLabel} ${record.number} created.`, ts: record.ts },
  ];
  const iconFor = (kind?: string) =>
    kind === "sent" ? <Send className="w-4 h-4" /> : kind === "printed" ? <Printer className="w-4 h-4" /> : <Plus className="w-4 h-4" />;
  const renderText = (text: string) => {
    const num = record.number || "";
    const i = num ? text.indexOf(num) : -1;
    if (i === -1) return text;
    return (<>{text.slice(0, i)}<span className="text-blue-500">{num}</span>{text.slice(i + num.length)}</>);
  };
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {rows.map((r: any, i: number) => (
            <div key={i} className="relative flex items-start gap-3 pb-6 last:pb-0">
              {i < rows.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />}
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0 z-10">{iconFor(r.kind)}</div>
              <div>
                <div className="text-sm text-gray-900">{renderText(r.text)}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.dateLabel || label(r.ts)} • info@inovoic.com</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogModal;
