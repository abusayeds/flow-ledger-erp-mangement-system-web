/**
 * Checklist Items — /api/v1/recruitment/checklist-items
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  searchOnboardingChecklists,
  ACTIVE_INACTIVE,
  boolFilterValue,
  statusLabel,
  type ChecklistItemRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  taskName: "",
  description: "",
  category: "",
  assignedToRole: "",
  dueDay: "",
  isRequired: false,
  status: true,
  checklistId: "",
  checklistName: "",
});

export const ChecklistItems: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItemRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-checklist-items", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchChecklistItems({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("task_name", sortAsc ? "Ascending" : "Descending"),
        status: boolFilterValue(statusFilter),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-checklist-items"] });

  const submit = async () => {
    if (!draft.taskName.trim() || !draft.checklistId) {
      showToast("Task name and checklist are required", "error");
      return;
    }
    const body = {
      task_name: draft.taskName.trim(),
      checklist_id: draft.checklistId,
      description: draft.description.trim() || undefined,
      category: draft.category.trim() || undefined,
      assigned_to_role: draft.assignedToRole.trim() || undefined,
      due_day: draft.dueDay === "" ? undefined : Number(draft.dueDay),
      is_required: draft.isRequired,
      status: draft.status,
    };
    try {
      if (modal === "edit") {
        await updateChecklistItem(draft.id, body);
        showToast("Checklist item updated", "success");
      } else {
        await createChecklistItem(body);
        showToast("Checklist item created", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteChecklistItem(deleteTarget.id);
      showToast("Checklist item deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Recruitment"
        current="Checklist Items"
        title="Manage Checklist Items"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search checklist items…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...ACTIVE_INACTIVE]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setSortAsc(!sortAsc);
                    setPage(1);
                  }}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Task <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Checklist", "Category", "Due day", "Required", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.taskName}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.checklistName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.category || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.dueDay ?? "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.isRequired ? "Yes" : "No"}</td>
                <td className="px-4 py-3.5">
                  {chip(statusLabel(r.status), STATUS_CHIP[statusLabel(r.status)] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          taskName: r.taskName,
                          description: r.description,
                          category: r.category,
                          assignedToRole: r.assignedToRole,
                          dueDay: r.dueDay == null ? "" : String(r.dueDay),
                          isRequired: r.isRequired,
                          status: r.status,
                          checklistId: r.checklistId,
                          checklistName: r.checklistName,
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No checklist items found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Checklist Item" : "Create Checklist Item"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Checklist" required>
              <AsyncSearchSelect
                value={draft.checklistId}
                displayName={draft.checklistName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, checklistId: id, checklistName: opt?.name || "" })
                }
                onSearch={searchOnboardingChecklists}
                placeholder="Search checklists…"
              />
            </Field>
            <Field label="Task name" required>
              <input
                value={draft.taskName}
                onChange={(e) => setDraft({ ...draft, taskName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category">
                <input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Assigned to role">
                <input
                  value={draft.assignedToRole}
                  onChange={(e) => setDraft({ ...draft, assignedToRole: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Due day">
                <input
                  type="number"
                  value={draft.dueDay}
                  onChange={(e) => setDraft({ ...draft, dueDay: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Required">
                <select
                  value={draft.isRequired ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, isRequired: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={draft.status ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="checklist item"
          name={deleteTarget.taskName}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default ChecklistItems;
