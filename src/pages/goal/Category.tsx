/**
 * Manage Categories — server-backed via /api/v1/goal/categories.
 */

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchGoalCategories,
  createGoalCategory,
  updateGoalCategory,
  deleteGoalCategory,
  type GoalCategoryRow,
} from "@/services/goalApi";
import { Field, inputCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "./goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({ id: "", name: "", code: "", description: "", active: true });

export const Category: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState<"name" | "code">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<GoalCategoryRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const sortBe = sortField === "code" ? "category_code" : "category_name";

  const { data } = useQuery({
    queryKey: ["goal-categories", page, perPage, search, sortBe, sortAsc, statusFilter],
    queryFn: () =>
      fetchGoalCategories({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam(sortBe, sortAsc ? "Ascending" : "Descending"),
        is_active:
          statusFilter === "All" ? undefined : statusFilter === "Active",
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const paginated = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const toggleSort = (f: "name" | "code") => {
    if (sortField === f) setSortAsc(!sortAsc);
    else {
      setSortField(f);
      setSortAsc(true);
    }
    setPage(1);
  };

  const submit = async () => {
    if (!draft.name || !draft.code) {
      showToast("Please fill all required fields", "error");
      return;
    }
    try {
      if (modal === "edit") {
        await updateGoalCategory(draft.id, {
          name: draft.name,
          code: draft.code,
          description: draft.description,
          active: draft.active,
        });
        showToast("Category updated successfully", "success");
      } else {
        await createGoalCategory({
          name: draft.name,
          code: draft.code,
          description: draft.description,
          active: draft.active,
        });
        showToast("Category created successfully", "success");
      }
      await queryClient.invalidateQueries({ queryKey: ["goal-categories"] });
      setModal(null);
    } catch {
      showToast("Failed to save category", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGoalCategory(deleteTarget.id);
      showToast("Category deleted successfully", "success");
      await queryClient.invalidateQueries({ queryKey: ["goal-categories"] });
      setDeleteTarget(null);
    } catch {
      showToast("Failed to delete category", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Goal"
        current="Categories"
        title="Manage Categories"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search Categories..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={["Active", "Inactive"]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Is Active"
      >
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-gray-900">
                  Category Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button onClick={() => toggleSort("code")} className="flex items-center gap-1 hover:text-gray-900">
                  Category Code <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Is Active</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3.5 text-gray-600">{c.code}</td>
                <td className="px-4 py-3.5 text-gray-600">{c.description || "-"}</td>
                <td className="px-4 py-3.5">{chip(c.active ? "Active" : "Inactive", STATUS_CHIP[c.active ? "Is Active" : "Inactive"])}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setDraft({ id: c.id, name: c.name, code: c.code, description: c.description, active: c.active });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  No categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Category" : "Create Category"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"}>
          <div className="space-y-4">
            <Field label="Category Name" required>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Category Name" className={inputCls} />
            </Field>
            <Field label="Category Code" required>
              <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="Enter Category Code" className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Enter Description" rows={3} className={inputCls} />
            </Field>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, active: !draft.active })}
                className={`relative w-10 h-6 rounded-full transition-colors ${draft.active ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${draft.active ? "left-[18px]" : "left-0.5"}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Is Active</span>
            </label>
          </div>
        </ModalShell>
      )}

      {deleteTarget && <DeleteConfirm what="Category" name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
    </>
  );
};
