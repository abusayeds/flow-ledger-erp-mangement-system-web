/**
 * File: src/pages/Settings.tsx
 * Settings page — same real modals as the header gear dropdown.
 */
import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
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
import { SettingsSectionView } from "@/features/settings/SettingsSectionView";

export const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("categories");
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showPdfPrint, setShowPdfPrint] = useState(false);
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const [showProductLibrary, setShowProductLibrary] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [exportModule, setExportModule] = useState<ExportModuleId | null>(null);
  const [importModule, setImportModule] = useState<ImportModuleId | null>(null);

  useEffect(() => {
    if (activeSection === "app-settings") setShowAppSettings(true);
    if (activeSection === "pdf-print") setShowPdfPrint(true);
    if (activeSection === "email-templates") setShowEmailTemplates(true);
    if (activeSection === "product-library") setShowProductLibrary(true);
    if (activeSection === "keyboard-shortcuts") setShowKeyboard(true);
  }, [activeSection]);

  const closeAppSettings = () => {
    setShowAppSettings(false);
    if (activeSection === "app-settings") setActiveSection("categories");
  };
  const closePdfPrint = () => {
    setShowPdfPrint(false);
    if (activeSection === "pdf-print") setActiveSection("categories");
  };
  const closeEmailTemplates = () => {
    setShowEmailTemplates(false);
    if (activeSection === "email-templates") setActiveSection("categories");
  };
  const closeProductLibrary = () => {
    setShowProductLibrary(false);
    if (activeSection === "product-library") setActiveSection("categories");
  };
  const closeKeyboard = () => {
    setShowKeyboard(false);
    if (activeSection === "keyboard-shortcuts") setActiveSection("categories");
  };

  const modalOnly =
    activeSection === "app-settings" ||
    activeSection === "pdf-print" ||
    activeSection === "email-templates" ||
    activeSection === "product-library" ||
    activeSection === "keyboard-shortcuts";

  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      {showAppSettings && <AppSettingsModal onClose={closeAppSettings} />}
      {showPdfPrint && <PdfPrintSettingsModal onClose={closePdfPrint} />}
      {showEmailTemplates && <EmailTemplatesModal onClose={closeEmailTemplates} />}
      {showProductLibrary && (
        <ProductLibraryModal
          open
          onClose={closeProductLibrary}
          onImport={(items) => {
            pushImportQueue(items);
            showToast(
              `Queued ${items.length} product${items.length > 1 ? "s" : ""} — open Generate Barcode`,
              "success",
            );
            closeProductLibrary();
          }}
        />
      )}
      {showKeyboard && <KeyboardShortcutsModal onClose={closeKeyboard} />}
      {exportModule && (
        <ExportDataModal moduleId={exportModule} onClose={() => setExportModule(null)} />
      )}
      {importModule && (
        <ImportDataModal moduleId={importModule} onClose={() => setImportModule(null)} />
      )}

      <ResizableListPanel>
        <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
          <h2 className="text-base font-semibold text-gray-900 tracking-tight">Settings</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {SETTINGS_NAV_ITEMS.map(({ id, label, icon: Icon, hasSubmenu }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm border-b border-gray-300 transition-colors ${
                  active ? "bg-gray-100 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-gray-400"}`} />
                <span className="flex-1">{label}</span>
                {hasSubmenu && <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
            );
          })}
        </div>
      </ResizableListPanel>

      <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
        <div className="h-12 flex items-center px-6 border-b border-gray-300 bg-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {SETTINGS_NAV_ITEMS.find((n) => n.id === activeSection)?.label || "Settings"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {modalOnly ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p className="text-sm text-gray-600">Dialog opened. Use Open again if you closed it.</p>
              <button
                type="button"
                onClick={() => {
                  if (activeSection === "app-settings") setShowAppSettings(true);
                  else if (activeSection === "pdf-print") setShowPdfPrint(true);
                  else if (activeSection === "email-templates") setShowEmailTemplates(true);
                  else if (activeSection === "product-library") setShowProductLibrary(true);
                  else if (activeSection === "keyboard-shortcuts") setShowKeyboard(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                Open again
              </button>
            </div>
          ) : activeSection === "export" ? (
            <ModulePickList
              title="Choose data to export"
              items={EXPORT_MENU_ORDER.map((m) => ({ id: m.id, label: m.label }))}
              onPick={(id) => setExportModule(id as ExportModuleId)}
            />
          ) : activeSection === "import" ? (
            <ModulePickList
              title="Choose data to import"
              items={IMPORT_MENU_ORDER.map((m) => ({ id: m.id, label: m.label }))}
              onPick={(id) => setImportModule(id as ImportModuleId)}
            />
          ) : activeSection === "language" ? (
            <div className="space-y-2 max-w-md">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => showToast(`Language set to ${lang.name}`, "success")}
                  className="w-full px-4 py-3 text-left border border-gray-200 rounded-md hover:bg-gray-50 hover:border-blue-600 transition-colors"
                >
                  <div className="font-medium text-gray-900">{lang.name}</div>
                  <div className="text-sm text-gray-500">{lang.native}</div>
                </button>
              ))}
            </div>
          ) : (
            <SettingsSectionView section={activeSection} />
          )}
        </div>
      </section>
    </div>
  );
};

const ModulePickList: React.FC<{
  title: string;
  items: { id: string; label: string }[];
  onPick: (id: string) => void;
}> = ({ title, items, onPick }) => (
  <div className="max-w-md space-y-2">
    <p className="text-sm text-gray-500 mb-3">{title}</p>
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onPick(item.id)}
        className="w-full flex items-center justify-between px-4 py-3 text-left border border-gray-200 rounded-md hover:bg-gray-50 hover:border-blue-600 text-sm text-gray-900"
      >
        <span>{item.label}</span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>
    ))}
  </div>
);

export default SettingsPage;
