/**
 * Performance System Setup — Indicator Categories + Goal Types
 * Other tabs kept empty (no backend for KPI / feedback templates).
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchIndicatorCategories,
  createIndicatorCategory,
  updateIndicatorCategory,
  deleteIndicatorCategory,
  fetchGoalTypes,
  createGoalType,
  updateGoalType,
  deleteGoalType,
  ACTIVE_STATUSES,
  type IndicatorCategoryRow,
  type GoalTypeRow,
} from "@/services/performance";
import { Field, inputCls, selectCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

type SetupTab = "indicatorCategories" | "goalTypes" | "kpis" | "feedbackTemplates";

const emptyDraft = () => ({
  id: "",
  name: "",
  description: "",
  status: "active",
});

const statusLabel = (s: string) => (s === "inactive" ? "Inactive" : "Active");

const TABS: { id: SetupTab; label: string }[] = [
  { id: "indicatorCategories", label: "Indicator Categories" },
  { id: "goalTypes", label: "Goal Types" },
  { id: "kpis", label: "KPI Templates" },
  { id: "feedbackTemplates", label: "Feedback Templates" },
];

const PerformanceSystemSetup: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<SetupTab>("indicatorCategories");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
    setStatusFilter("All");
    setModal(null);
    setDeleteTarget(null);
  }, [tab]);

  const isCategories = tab === "indicatorCategories";
  const isGoalTypes = tab === "goalTypes";
  const hasBackend = isCategories || isGoalTypes;

  const categoriesQuery = useQuery({
    queryKey: ["performance-indicator-categories", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchIndicatorCategories({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    enabled: isCategories,
    placeholderData: (prev) => prev,
  });

  const goalTypesQuery = useQuery({
    queryKey: ["performance-goal-types", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchGoalTypes({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    enabled: isGoalTypes,
    placeholderData: (prev) => prev,
  });

  const activeQuery = isCategories ? categoriesQuery : goalTypesQuery;
  const rows: (IndicatorCategoryRow | GoalTypeRow)[] = hasBackend ? activeQuery.data?.rows ?? [] : [];
  const total = hasBackend ? activeQuery.data?.pagination?.totalData ?? 0 : 0;
  const isLoading = hasBackend && activeQuery.isLoading;

  const invalidate = () => {
    if (isCategories) qc.invalidateQueries({ queryKey: ["performance-indicator-categories"] });
    if (isGoalTypes) qc.invalidateQueries({ queryKey: ["performance-goal-types"] });
  };

  const entityLabel = isCategories ? "indicator category" : "goal type";
  const title = isCategories
    ? "Manage Indicator Categories"
    : isGoalTypes
      ? "Manage Goal Types"
      : tab === "kpis"
        ? "KPI Templates"
        : "Feedback Templates";

  const submit = async () => {
    if (!draft.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      status: draft.status || "active",
    };
    try {
      if (modal === "edit") {
        if (isCategories) await updateIndicatorCategory(draft.id, body);
        else await updateGoalType(draft.id, body);
        showToast(`${isCategories ? "Category" : "Goal type"} updated`, "success");
      } else {
        if (isCategories) await createIndicatorCategory(body);
        else await createGoalType(body);
        showToast(`${isCategories ? "Category" : "Goal type"} created`, "success");
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
      if (isCategories) await deleteIndicatorCategory(deleteTarget.id);
      else await deleteGoalType(deleteTarget.id);
      showToast("Deleted successfully", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 pt-3 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hasBackend ? (
        <div className="module-page-shell flex flex-col p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
          <p className="text-sm text-gray-500">
            No backend API exists for this section yet. KPI and feedback templates will be
            available once the performance APIs are added.
          </p>
        </div>
      ) : (
        <ListShell
          module="Performance"
          current="System Setup"
          title={title}
          onCreate={() => {
            setDraft(emptyDraft());
            setModal("create");
          }}
          search={searchInput}
          setSearch={setSearchInput}
          searchPlaceholder={`Search ${isCategories ? "categories" : "goal types"}…`}
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
          <table className="w-full text-sm min-w-[800px]">
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
                {["Description", "Status", "Created", "Actions"].map((h) => (
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
                  <td className="px-4 py-3.5 text-gray-600 max-w-[280px] truncate">{r.description || "—"}</td>
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
                            status: r.status || "active",
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
                        onClick={() => setDeleteTarget({ id: r.id, name: r.name })}
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
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No {isCategories ? "categories" : "goal types"} found.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ListShell>
      )}

      {modal && hasBackend && (
        <ModalShell
          title={
            modal === "edit"
              ? `Edit ${isCategories ? "Category" : "Goal Type"}`
              : `Create ${isCategories ? "Category" : "Goal Type"}`
          }
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Enter name"
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
          what={entityLabel}
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default PerformanceSystemSetup;
