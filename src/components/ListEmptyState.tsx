/**
 * File: src/components/ListEmptyState.tsx
 * Shared empty state for the master-detail list pages. Shown when a collection
 * has no records (e.g. after deleting them all) so the page never goes blank —
 * it keeps a clear message and a working "create" action.
 */
import { FileText, Plus } from "lucide-react";

export function ListEmptyState({
  title,
  subtitle = "Create your first one to get started.",
  onCreate,
  createLabel = "New",
}: {
  title: string;
  subtitle?: string;
  onCreate: () => void;
  createLabel?: string;
}) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center bg-[#FAFBFC] p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <FileText className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 mb-5 text-sm text-gray-500">{subtitle}</p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
      >
        <Plus className="h-4 w-4" /> {createLabel}
      </button>
    </div>
  );
}
