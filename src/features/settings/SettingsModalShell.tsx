/**
 * Modal chrome for header SettingsDropdown — wraps shared SettingsSectionView.
 */
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { settingsLabel, type SettingsSectionId } from "./settingsConfig";
import { SettingsSectionView } from "./SettingsSectionView";

export type SettingsModalShellProps = {
  section: SettingsSectionId;
  onClose: () => void;
  maxWidthClass?: string;
};

export const SettingsModalShell: React.FC<SettingsModalShellProps> = ({
  section,
  onClose,
  maxWidthClass = "max-w-4xl",
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-lg w-full ${maxWidthClass} max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-300`}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-300 bg-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{settingsLabel(section)}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-md text-gray-600"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <SettingsSectionView section={section} />
        </div>
      </div>
    </div>
  );
};

export default SettingsModalShell;
