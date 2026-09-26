/**
 * File: src/components/ui/ConfirmAlert.tsx
 * Alert confirmation dialog (matches the reference): bold "Alert" title,
 * message, No / Yes actions. Used for merge / archive / delete flows.
 */

import React, { useEffect } from "react";

export const ConfirmAlert: React.FC<{ message: string; onNo: () => void; onYes: () => void }> = ({ message, onNo, onYes }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onNo();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onNo]);
  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4" onMouseDown={onNo}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 pt-4 pb-2 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Alert</h3>
        </div>
        <div className="px-5 py-5 text-sm text-gray-800">{message}</div>
        <div className="flex items-center justify-end gap-2 px-5 pb-4">
          <button onClick={onNo} className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">No</button>
          <button onClick={onYes} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">Yes</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmAlert;
