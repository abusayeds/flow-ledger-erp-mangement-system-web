/**
 * Performance Indicators — /api/v1/performance/indicators
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchIndicators,
  createIndicator,
  updateIndicator,
  deleteIndicator,
  searchIndicatorCategories,
  ACTIVE_STATUSES,
  type IndicatorRow,
} from "@/services/performance";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  name: "",
  description: "",
  measurementUnit: "",
  targetValue: "",
  status: "active",
  categoryId: "",
  categoryName: "",
});

const statusLabel = (s: string) => (s === "inactive" ? "Inactive" : "Active");

export const PerformanceIndicators: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<IndicatorRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["performance-indicators", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchIndicators({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["performance-indicators"] });

  const submit = async () => {
    if (!draft.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      measurement_unit: draft.measurementUnit.trim() || undefined,
      target_value: draft.targetValue.trim() || undefined,
      status: draft.status || "active",
    };
    if (draft.categoryId) body.category_id = draft.categoryId;
    try {
      if (modal === "edit") {
        await updateIndicator(draft.id, body);
        showToast("Indicator updated", "success");
      } else {
        await createIndicator(body);
        showToast("Indicator created", "success");
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
      await deleteIndicator(deleteTarget.id);
      showToast("Indicator deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Performance"
        current="Indicators"
        title="Manage Performance Indicators"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search indicators…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...ACTIVE_STATUSES]}
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
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Category", "Unit", "Target", "Status", "Created", "Actions"].map((h) => (
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
                <td className="px-4 py-3.5 text-gray-600">{r.categoryName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.measurementUnit || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.targetValue || "—"}</td>
                <td className="px-4 py-3.5">
                  {chip(statusLabel(r.status), STATUS_CHIP[statusLabel(r.status)] || STATUS_CHIP.Active)}
                </td>
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
                          measurementUnit: r.measurementUnit,
                          targetValue: r.targetValue,
                          status: r.status || "active",
                          categoryId: r.categoryId,
                          categoryName: r.categoryName,
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
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No indicators found.
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
          title={modal === "edit" ? "Edit Indicator" : "Create Indicator"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Enter indicator name"
                className={inputCls}
              />
            </Field>
            <Field label="Category">
              <AsyncSearchSelect
                value={draft.categoryId}
                displayName={draft.categoryName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, categoryId: id, categoryName: opt?.name || "" })
                }
                onSearch={searchIndicatorCategories}
                placeholder="Search categories…"
              />
            </Field>
            <Field label="Measurement Unit">
              <input
                value={draft.measurementUnit}
                onChange={(e) => setDraft({ ...draft, measurementUnit: e.target.value })}
                placeholder="e.g. %, hours, count"
                className={inputCls}
              />
            </Field>
            <Field label="Target Value">
              <input
                value={draft.targetValue}
                onChange={(e) => setDraft({ ...draft, targetValue: e.target.value })}
                placeholder="Enter target value"
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
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className={selectCls}
              >
                {ACTIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="indicator"
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default PerformanceIndicators;
