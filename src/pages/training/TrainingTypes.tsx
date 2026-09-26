/**
 * Training Types — /api/v1/training/training-types
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchTrainingTypes,
  createTrainingType,
  updateTrainingType,
  deleteTrainingType,
  searchBranches,
  searchDepartments,
  type TrainingTypeRow,
} from "@/services/training";
import { Field, inputCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  name: "",
  description: "",
  branchId: "",
  branchName: "",
  departmentId: "",
  departmentName: "",
});

const TrainingTypes: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<TrainingTypeRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["training-types", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchTrainingTypes({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["training-types"] });

  const submit = async () => {
    if (!draft.name.trim() || !draft.branchId || !draft.departmentId) {
      showToast("Name, branch and department are required", "error");
      return;
    }
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      branch_id: draft.branchId,
      department_id: draft.departmentId,
    };
    try {
      if (modal === "edit") {
        await updateTrainingType(draft.id, body);
        showToast("Training type updated", "success");
      } else {
        await createTrainingType(body);
        showToast("Training type created", "success");
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
      await deleteTrainingType(deleteTarget.id);
      showToast("Training type deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Training"
        current="Training Type"
        title="Manage Training Type"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search training types…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[900px]">
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
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Description", "Branch", "Department", "Created", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3.5 text-gray-600 max-w-[220px] truncate">{r.description || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.branchName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.departmentName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.createdAt || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          name: r.name,
                          description: r.description,
                          branchId: r.branchId,
                          branchName: r.branchName,
                          departmentId: r.departmentId,
                          departmentName: r.departmentName,
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No training types found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Training Type" : "Create Training Type"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Enter type name"
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                placeholder="Optional description"
                className={inputCls}
              />
            </Field>
            <Field label="Branch" required>
              <AsyncSearchSelect
                value={draft.branchId}
                displayName={draft.branchName}
                onChange={(id, opt) =>
                  setDraft({
                    ...draft,
                    branchId: id,
                    branchName: opt?.name || "",
                    departmentId: "",
                    departmentName: "",
                  })
                }
                onSearch={searchBranches}
                placeholder="Search branches…"
              />
            </Field>
            <Field label="Department" required>
              <AsyncSearchSelect
                value={draft.departmentId}
                displayName={draft.departmentName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, departmentId: id, departmentName: opt?.name || "" })
                }
                onSearch={(q) => searchDepartments(q, draft.branchId || undefined)}
                placeholder="Search departments…"
                disabled={!draft.branchId}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="training type"
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default TrainingTypes;
