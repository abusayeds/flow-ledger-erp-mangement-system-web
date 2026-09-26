/**
 * Manage Salesperson modal — list / search / Active filter / FAB add / edit form.
 * Layout matches reference screenshots; colors follow the app light theme.
 */
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MoreVertical, Plus, Search, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import {
  createSalesperson,
  deleteSalesperson,
  fetchSalespersons,
  updateSalesperson,
  type Salesperson,
  type SalespersonStatus,
} from "@/services/salespersonApi";

type Draft = { id: string | null; name: string; email: string };

const EMPTY: Draft = { id: null, name: "", email: "" };

export const ManageSalespersonModal: React.FC<{
  onClose: () => void;
  onPicked?: (sp: Salesperson) => void;
}> = ({ onClose, onPicked }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive" | "All">("Active");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: filtered = [], isLoading } = useQuery({
    queryKey: ["salespersons", "manage", debouncedSearch, statusFilter],
    queryFn: () =>
      fetchSalespersons({
        searchTerm: debouncedSearch || undefined,
        status: statusFilter,
      }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["salespersons"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("no-draft");
      const name = draft.name.trim();
      if (!name) throw new Error("name-required");
      const payload = {
        name,
        email: draft.email.trim() || undefined,
        status: "Active" as SalespersonStatus,
      };
      if (draft.id) return updateSalesperson(draft.id, payload);
      return createSalesperson(payload);
    },
    onSuccess: async (sp) => {
      await invalidate();
      showToast(draft?.id ? "Salesperson updated" : "Salesperson created", "success");
      setDraft(null);
      onPicked?.(sp);
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === "name-required") {
        showToast("Name is required", "warning");
        return;
      }
      showToast("Could not save salesperson", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSalesperson(id),
    onSuccess: async () => {
      await invalidate();
      showToast("Salesperson deleted", "success");
      setMenuId(null);
    },
    onError: () => showToast("Could not delete salesperson", "error"),
  });

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saveMutation.isPending) saveMutation.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, saveMutation]);

  useEffect(() => {
    const h = () => setMenuId(null);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const openCreate = () => setDraft({ ...EMPTY });
  const openEdit = (sp: Salesperson) => {
    setMenuId(null);
    setDraft({ id: sp._id, name: sp.name, email: sp.email || "" });
  };

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ maxHeight: "85vh", minHeight: "420px" }}
      >
        {/* List header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Manage Salesperson</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + status */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 shrink-0">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Salesperson"
              className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-blue-600"
            />
          </div>
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none focus:border-blue-600"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="All">All</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          </div>
        </div>

        {/* Table */}
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr_1.2fr_56px] gap-2 border-b border-gray-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Name</span>
            <span>Email</span>
            <span className="text-right">Action</span>
          </div>
          {isLoading && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">Loading…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">No salesperson found</div>
          )}
          <div className="divide-y divide-gray-100">
            {filtered.map((sp) => (
              <div
                key={sp._id}
                className="grid grid-cols-[1fr_1.2fr_56px] gap-2 items-center px-5 py-3 hover:bg-gray-50"
              >
                <button
                  type="button"
                  className="truncate text-left text-sm font-medium text-gray-900"
                  onClick={() => {
                    onPicked?.(sp);
                    onClose();
                  }}
                >
                  {sp.name}
                </button>
                <span className="truncate text-sm text-gray-600">{sp.email || "—"}</span>
                <div className="relative flex justify-end">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setMenuId((id) => (id === sp._id ? null : sp._id))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === sp._id && (
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute right-0 top-8 z-20 min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={() => openEdit(sp)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(sp._id)}
                        className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* FAB */}
          <button
            type="button"
            onClick={openCreate}
            className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600"
            title="Add salesperson"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Add / Edit overlay */}
        {draft && (
          <div className="absolute inset-0 z-30 flex flex-col bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Manage Salesperson</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <div className="relative group">
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                    className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Save
                  </button>
                  <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[11px] text-white group-hover:block">
                    Save (ctrl + s)
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="relative">
                <label className="absolute -top-2 left-2 z-10 bg-white px-1 text-[11px] text-gray-500">
                  Name<span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600"
                />
              </div>
              <div className="relative">
                <label className="absolute -top-2 left-2 z-10 bg-white px-1 text-[11px] text-gray-500">Email</label>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageSalespersonModal;
