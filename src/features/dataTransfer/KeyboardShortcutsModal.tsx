import React, { useEffect } from "react";
import { X } from "lucide-react";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl + S", action: "Save current form" },
  { keys: "Ctrl + N", action: "Create new document" },
  { keys: "Ctrl + P", action: "Print / PDF preview" },
  { keys: "Ctrl + F", action: "Focus list search" },
  { keys: "Esc", action: "Close modal / cancel" },
  { keys: "?", action: "Open keyboard shortcuts" },
];

type Props = { onClose: () => void };

export const KeyboardShortcutsModal: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">Keyboard Shortcuts</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="divide-y divide-gray-200">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="text-sm text-gray-700">{s.action}</span>
              <kbd className="text-xs font-medium px-2 py-1 rounded border border-gray-300 bg-gray-50 text-gray-800 whitespace-nowrap">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
