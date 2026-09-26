/**
 * Manage Goals — server-backed via /api/v1/goal/goals.
 */

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  activateGoal,
  searchGoalCategories,
  searchGoalAccounts,
  type GoalRow,
} from "@/services/goalApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, PRIORITY_CHIP, STATUS_CHIP } from "./goalShared";
import { ArrowUpDown, Eye, Edit, Trash2, CheckCircle2, X } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const GOAL_TYPES = ["savings", "expense reduction", "debt reduction"] as const;
const GOAL_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const emptyDraft = () => ({
  id: "",
  name: "",
  category: "",
  categoryId: "",
  type: "savings",
  targetAmount: 0,
  currentAmount: 0,
  startDate: "",
  targetDate: "",
  priority: "Medium" as GoalRow["priority"],
  status: "Draft" as GoalRow["status"],
  chartOfAccount: "",
  accountId: "",
  description: "",
});

const pct = (g: Pick<GoalRow, "targetAmount" | "currentAmount">) =>
  g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;

const goalStatusFilter = (label: string) => {
  if (label === "All") return undefined;
  return label.toLowerCase();
};

export const Goals: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewGoal, setViewGoal] = useState<GoalRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data } = useQuery({
    queryKey: ["goal-goals", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchGoals({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("goal_name", sortAsc ? "Ascending" : "Descending"),
        status: goalStatusFilter(statusFilter),
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const paginated = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["goal-goals"] });

  const submit = async () => {
    if (!draft.name || !draft.categoryId || !(Number(draft.targetAmount) > 0) || !draft.startDate || !draft.targetDate) {
      showToast("Please fill all required fields (including category)", "error");
      return;
    }
    try {
      if (modal === "edit") {
        await updateGoal(draft.id, {
          name: draft.name,
          categoryId: draft.categoryId || undefined,
          type: draft.type,
          targetAmount: Number(draft.targetAmount),
          startDate: draft.startDate,
          targetDate: draft.targetDate,
          priority: draft.priority,
          accountId: draft.accountId,
          description: draft.description,
        });
        showToast("Goal updated successfully", "success");
      } else {
        await createGoal({
          name: draft.name,
          categoryId: draft.categoryId,
          type: draft.type,
          targetAmount: Number(draft.targetAmount),
          startDate: draft.startDate,
          targetDate: draft.targetDate,
          priority: draft.priority,
          accountId: draft.accountId || undefined,
          description: draft.description,
        });
        showToast("Goal created successfully", "success");
      }
      await invalidate();
      setModal(null);
    } catch {
      showToast("Failed to save goal", "error");
    }
  };

  const activate = async (g: GoalRow) => {
    try {
      await activateGoal(g.id);
      showToast("Goal activated", "success");
      await invalidate();
    } catch {
      showToast("Failed to activate goal", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGoal(deleteTarget.id);
      showToast("Goal deleted successfully", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch {
      showToast("Failed to delete goal", "error");
    }
  };

  const openEdit = (g: GoalRow) => {
    setDraft({
      id: g.id,
      name: g.name,
      category: g.category,
      categoryId: g.categoryId,
      type: g.type,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      startDate: g.startDate,
      targetDate: g.targetDate,
      priority: g.priority,
      status: g.status,
      chartOfAccount: g.chartOfAccount,
      accountId: g.accountId,
      description: g.description,
    });
    setModal("edit");
  };

  const actions = (g: GoalRow) => (
    <div className="flex items-center gap-1.5">
      {g.status === "Draft" ? (
        <button onClick={() => activate(g)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50" title="Activate">
          <CheckCircle2 className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-7 h-7" />
      )}
      <button onClick={() => setViewGoal(g)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
        <Eye className="w-4 h-4" />
      </button>
      {g.status === "Draft" ? (
        <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Edit">
          <Edit className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-7 h-7" />
      )}
      <button onClick={() => setDeleteTarget(g)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const progressBar = (g: GoalRow) => (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct(g)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8">{pct(g)}%</span>
    </div>
  );

  return (
    <>
      <ListShell
        module="Goal"
        current="Goals"
        title="Manage Goals"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search Goals..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={["Active", "Draft", "Completed", "Paused", "Cancelled"]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        view={view}
        setView={setView}
      >
        {view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    <button
                      onClick={() => {
                        setSortAsc(!sortAsc);
                        setPage(1);
                      }}
                      className="flex items-center gap-1 hover:text-gray-900"
                    >
                      Goal Name <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  {["Category", "Type", "Target Amount", "Current Amount", "Progress", "Target Date", "Priority", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewGoal(g)}>
                    <td className="px-4 py-3.5 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-3.5 text-gray-600">{g.category}</td>
                    <td className="px-4 py-3.5 text-gray-600">{g.type}</td>
                    <td className="px-4 py-3.5 text-gray-900">{money(g.targetAmount)}</td>
                    <td className="px-4 py-3.5 text-gray-600">{money(g.currentAmount)}</td>
                    <td className="px-4 py-3.5">{progressBar(g)}</td>
                    <td className="px-4 py-3.5 text-gray-600">{g.targetDate}</td>
                    <td className="px-4 py-3.5">{chip(g.priority, PRIORITY_CHIP[g.priority])}</td>
                    <td className="px-4 py-3.5">{chip(g.status, STATUS_CHIP[g.status])}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {actions(g)}
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      No goals found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((g) => (
              <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{g.name}</div>
                    <div className="text-xs text-gray-400">
                      {g.category} · {g.type}
                    </div>
                  </div>
                  {chip(g.status, STATUS_CHIP[g.status])}
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Target</span>
                  <span className="font-medium text-gray-900">{money(g.targetAmount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Current</span>
                  <span className="text-gray-700">{money(g.currentAmount)}</span>
                </div>
                {progressBar(g)}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  {chip(g.priority, PRIORITY_CHIP[g.priority])}
                  {actions(g)}
                </div>
              </div>
            ))}
            {paginated.length === 0 && <div className="col-span-full py-12 text-center text-gray-500">No goals found.</div>}
          </div>
        )}
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Goal" : "Create Goal"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Goal Name" required>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Goal Name" className={inputCls} />
            </Field>
            <Field label="Category">
              <AsyncSearchSelect
                value={draft.categoryId}
                displayName={draft.category}
                onChange={(id, opt) => setDraft({ ...draft, categoryId: id, category: opt?.name || "" })}
                onSearch={searchGoalCategories}
                placeholder="Select Category"
              />
            </Field>
            <Field label="Goal Type">
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={`${selectCls} capitalize`}>
                {GOAL_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as GoalRow["priority"] })} className={selectCls}>
                {GOAL_PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Target Amount" required className="md:col-span-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={draft.targetAmount || ""}
                  onChange={(e) => setDraft({ ...draft, targetAmount: Number(e.target.value) })}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
            <Field label="Start Date" required>
              <AppDatePicker value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Target Date" required>
              <AppDatePicker value={draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Chart of Account" className="md:col-span-2">
              <AsyncSearchSelect
                value={draft.accountId}
                displayName={draft.chartOfAccount}
                onChange={(id, opt) => setDraft({ ...draft, accountId: id, chartOfAccount: opt?.name || "" })}
                onSearch={searchGoalAccounts}
                placeholder="None"
              />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Enter Description" rows={3} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {viewGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900">Goal Details - {viewGoal.name}</h3>
              <button onClick={() => setViewGoal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="border border-gray-200 rounded-xl px-5 py-4">
                <h4 className="text-base font-semibold text-gray-900 mb-4">Goal Information</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {(
                    [
                      ["Goal Name", viewGoal.name],
                      ["Category", viewGoal.category || "—"],
                      ["Goal Type", viewGoal.type],
                      ["Priority", null],
                      ["Status", null],
                      ["Chart of Account", viewGoal.chartOfAccount ? viewGoal.chartOfAccount.replace(/^\d+ - /, "") : "None"],
                      ["Start Date", viewGoal.startDate],
                      ["Target Date", viewGoal.targetDate],
                    ] as [string, string | null][]
                  ).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-gray-500 mb-1">{k}</p>
                      {k === "Priority" ? (
                        chip(viewGoal.priority, PRIORITY_CHIP[viewGoal.priority])
                      ) : k === "Status" ? (
                        chip(viewGoal.status, STATUS_CHIP[viewGoal.status])
                      ) : (
                        <p className="font-semibold text-gray-900">{v}</p>
                      )}
                    </div>
                  ))}
                </div>
                {viewGoal.description && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-1.5">Description</p>
                    <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700">{viewGoal.description}</div>
                  </div>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl px-5 py-4">
                <h4 className="text-base font-semibold text-gray-900 mb-4">Financial Progress</h4>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Target Amount</p>
                    <p className="text-2xl font-bold text-blue-600">{money(viewGoal.targetAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Current Amount</p>
                    <p className="text-2xl font-bold text-green-600">{money(viewGoal.currentAmount)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-700">Progress</span>
                  <span className="text-gray-500">{((viewGoal.currentAmount / (viewGoal.targetAmount || 1)) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct(viewGoal)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && <DeleteConfirm what="Goal" name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
    </>
  );
};
