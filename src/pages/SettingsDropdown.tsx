/**
 * Header gear icon → dropdown with left flyout submenus (Import / Export / Language).
 * Flyout list matches product screenshot: Contacts → … → Products.
 */
import React, { useEffect, useRef, useState } from "react";
import { Settings, ChevronRight } from "lucide-react";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { EmailTemplatesModal } from "@/components/modals/EmailTemplatesModal";
import { ProductLibraryModal } from "@/features/barcode";
import { pushImportQueue } from "@/features/barcode/storage";
import {
  ExportDataModal,
  ImportDataModal,
  KeyboardShortcutsModal,
  EXPORT_MENU_ORDER,
  IMPORT_MENU_ORDER,
  type ExportModuleId,
  type ImportModuleId,
} from "@/features/dataTransfer";
import { showToast } from "@/utils/toast";
import {
  LANGUAGE_OPTIONS,
  SETTINGS_NAV_ITEMS,
  type SettingsSectionId,
} from "@/features/settings/settingsConfig";
import { SettingsModalShell } from "@/features/settings/SettingsModalShell";

type Flyout = "import" | "export" | "language" | null;

export const SettingsDropdown: React.FC = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [activePage, setActivePage] = useState<SettingsSectionId | null>(null);
  const [exportModule, setExportModule] = useState<ExportModuleId | null>(null);
  const [importModule, setImportModule] = useState<ImportModuleId | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) {
      setFlyout(null);
      return;
    }
    const onPointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDropdown(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showDropdown]);

  const openSection = (id: SettingsSectionId) => {
    if (id === "import" || id === "export" || id === "language") {
      setFlyout(id);
      return;
    }
    setActivePage(id);
    setShowDropdown(false);
    setFlyout(null);
  };

  const openExport = (id: ExportModuleId) => {
    setExportModule(id);
    setShowDropdown(false);
    setFlyout(null);
  };

  const openImport = (id: ImportModuleId) => {
    setImportModule(id);
    setShowDropdown(false);
    setFlyout(null);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown((s) => !s)}
          className="p-2 hover:bg-gray-100 rounded-md"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-12 z-50 flex items-stretch">
            {/* Left flyout — tall scrollable module list */}
            {flyout === "export" && (
              <TransferSubmenu items={EXPORT_MENU_ORDER} onPick={(id) => openExport(id)} />
            )}
            {flyout === "import" && (
              <TransferSubmenu items={IMPORT_MENU_ORDER} onPick={(id) => openImport(id)} />
            )}
            {flyout === "language" && (
              <div className="mr-1 w-56 max-h-[min(70vh,520px)] overflow-y-auto rounded-md border border-gray-300 bg-gray-100 shadow-xl py-1">
                {LANGUAGE_OPTIONS.map((lang) => (
                <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      showToast(`Language set to ${lang.name}`, "success");
                      setShowDropdown(false);
                      setFlyout(null);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-200"
                  >
                    {lang.name}
                      </button>
                ))}
        </div>
      )}

            {/* Main gear menu */}
            <div className="w-64 rounded-md border border-gray-300 bg-gray-100 shadow-xl py-1">
              {SETTINGS_NAV_ITEMS.map(({ id, label, hasSubmenu }) => (
                <button
                  key={id}
                  type="button"
                  onMouseEnter={() => {
                    if (hasSubmenu) setFlyout(id as Flyout);
                    else setFlyout(null);
                  }}
                  onClick={() => openSection(id)}
                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between ${
                    flyout === id
                      ? "bg-gray-200 text-gray-900"
                      : "text-gray-800 hover:bg-gray-200/80"
                  }`}
                >
                  <span>{label}</span>
                  {hasSubmenu && <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      )}
            </div>

      {activePage === "app-settings" && (
        <AppSettingsModal onClose={() => setActivePage(null)} />
      )}
      {activePage === "pdf-print" && (
        <PdfPrintSettingsModal onClose={() => setActivePage(null)} />
      )}
      {activePage === "email-templates" && (
        <EmailTemplatesModal onClose={() => setActivePage(null)} />
      )}
      {activePage === "product-library" && (
        <ProductLibraryModal
          open
          onClose={() => setActivePage(null)}
          onImport={(items) => {
            pushImportQueue(items);
            showToast(
              `Queued ${items.length} product${items.length > 1 ? "s" : ""} — open Generate Barcode`,
              "success",
            );
            setActivePage(null);
          }}
        />
      )}
      {activePage === "keyboard-shortcuts" && (
        <KeyboardShortcutsModal onClose={() => setActivePage(null)} />
      )}

      {exportModule && (
        <ExportDataModal moduleId={exportModule} onClose={() => setExportModule(null)} />
      )}
      {importModule && (
        <ImportDataModal moduleId={importModule} onClose={() => setImportModule(null)} />
      )}

      {activePage &&
        activePage !== "app-settings" &&
        activePage !== "pdf-print" &&
        activePage !== "email-templates" &&
        activePage !== "product-library" &&
        activePage !== "keyboard-shortcuts" &&
        activePage !== "import" &&
        activePage !== "export" &&
        activePage !== "language" && (
          <SettingsModalShell
            section={activePage}
            onClose={() => setActivePage(null)}
            maxWidthClass={
              activePage === "barcode"
                ? "max-w-7xl"
                : activePage === "categories"
                  ? "max-w-2xl"
                  : "max-w-4xl"
            }
          />
      )}
    </>
  );
};

const TransferSubmenu: React.FC<{
  items: { id: ExportModuleId | ImportModuleId; label: string }[];
  onPick: (id: ExportModuleId) => void;
}> = ({ items, onPick }) => (
  <div className="mr-1 w-56 max-h-[min(72vh,560px)] overflow-y-auto rounded-md border border-gray-300 bg-gray-100 shadow-xl py-1 custom-scrollbar">
    {items.map((m) => (
      <button
        key={m.id}
        type="button"
        onClick={() => onPick(m.id)}
        className="w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-200"
      >
        {m.label}
      </button>
    ))}
  </div>
);

export default SettingsDropdown;
