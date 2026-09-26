/**
 * Mounted once in MainLayout. Opens real Import/Export modals when list
 * pages dispatch app:open-import / app:open-export (and legacy demo:import).
 */
import React, { useEffect, useState } from "react";
import {
  ExportDataModal,
  ImportDataModal,
  IMPORT_MENU_ORDER,
  type ExportModuleId,
  type ImportModuleId,
} from "@/features/dataTransfer";
import { OPEN_EXPORT_EVENT, OPEN_IMPORT_EVENT } from "@/lib/listToolbarEvents";
import { showToast } from "@/utils/toast";

const TITLE_TO_IMPORT: Record<string, ImportModuleId> = {
  contacts: "contacts",
  customers: "contacts",
  vendors: "contacts",
  invoices: "invoices",
  "sales receipts": "sales-receipts",
  "proforma invoices": "proforma-invoices",
  estimates: "estimates",
  "delivery challans": "delivery-challans",
  "credit notes": "credit-notes",
  "payment received": "payment-received",
  "purchase orders": "purchase-orders",
  bills: "bills",
  "debit notes": "debit-notes",
  "payment made": "payment-made",
  expenses: "expenses",
  projects: "projects",
  services: "services",
  products: "products",
  "time logs": "timelogs",
  timelogs: "timelogs",
  records: "contacts",
};

const resolveImportId = (raw: unknown): ImportModuleId | null => {
  if (typeof raw === "string" && IMPORT_MENU_ORDER.some((m) => m.id === raw)) {
    return raw as ImportModuleId;
  }
  if (raw && typeof raw === "object" && "moduleId" in raw) {
    const id = String((raw as { moduleId?: unknown }).moduleId || "");
    if (IMPORT_MENU_ORDER.some((m) => m.id === id)) return id as ImportModuleId;
  }
  const title = String(
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "title" in raw
        ? (raw as { title?: unknown }).title
        : "",
  )
    .trim()
    .toLowerCase();
  return TITLE_TO_IMPORT[title] || null;
};

const resolveExportId = (raw: unknown): ExportModuleId | null => {
  // Export supports the full transfer catalog (fields exist for all ids).
  const id =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "moduleId" in raw
        ? String((raw as { moduleId?: unknown }).moduleId || "")
        : "";
  if (IMPORT_MENU_ORDER.some((m) => m.id === id) || id === "timelogs") {
    return id as ExportModuleId;
  }
  const fromTitle = resolveImportId(raw);
  return fromTitle;
};

export const DataTransferHost: React.FC = () => {
  const [importModule, setImportModule] = useState<ImportModuleId | null>(null);
  const [exportModule, setExportModule] = useState<ExportModuleId | null>(null);

  useEffect(() => {
    const onImport = (e: Event) => {
      const id = resolveImportId((e as CustomEvent).detail);
      if (!id) {
        showToast("Import is not available for this section", "info");
        return;
      }
      setExportModule(null);
      setImportModule(id);
    };
    const onExport = (e: Event) => {
      const id = resolveExportId((e as CustomEvent).detail);
      if (!id) {
        showToast("Export is not available for this section", "info");
        return;
      }
      setImportModule(null);
      setExportModule(id);
    };
    // Legacy list pages dispatched demo:import with h2 title
    const onLegacy = (e: Event) => onImport(e);

    window.addEventListener(OPEN_IMPORT_EVENT, onImport);
    window.addEventListener(OPEN_EXPORT_EVENT, onExport);
    window.addEventListener("demo:import", onLegacy);
    return () => {
      window.removeEventListener(OPEN_IMPORT_EVENT, onImport);
      window.removeEventListener(OPEN_EXPORT_EVENT, onExport);
      window.removeEventListener("demo:import", onLegacy);
    };
  }, []);

  return (
    <>
      {importModule ? (
        <ImportDataModal moduleId={importModule} onClose={() => setImportModule(null)} />
      ) : null}
      {exportModule ? (
        <ExportDataModal moduleId={exportModule} onClose={() => setExportModule(null)} />
      ) : null}
    </>
  );
};

export default DataTransferHost;
