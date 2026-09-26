/**
 * List sidebar toolbar → navbar search / import / export (window events).
 * Pages dispatch; GlobalSearch + DataTransferHost listen once in layout.
 */
import type { GlobalSearchModule } from "@/services/globalSearchApi";
import type { ExportModuleId, ImportModuleId } from "@/features/dataTransfer";

export const FOCUS_GLOBAL_SEARCH_EVENT = "app:focus-global-search";
export const OPEN_IMPORT_EVENT = "app:open-import";
export const OPEN_EXPORT_EVENT = "app:open-export";

export function focusNavbarSearch(module: GlobalSearchModule = "All") {
  window.dispatchEvent(
    new CustomEvent(FOCUS_GLOBAL_SEARCH_EVENT, { detail: { module } }),
  );
}

export function openListImport(moduleId: ImportModuleId) {
  window.dispatchEvent(new CustomEvent(OPEN_IMPORT_EVENT, { detail: { moduleId } }));
}

export function openListExport(moduleId: ExportModuleId) {
  window.dispatchEvent(new CustomEvent(OPEN_EXPORT_EVENT, { detail: { moduleId } }));
}
