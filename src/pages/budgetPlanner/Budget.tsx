/**
 * Manage Budget — /api/v1/budget-planner/budgets
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  approveBudget,
  activateBudget,
  closeBudget,
  searchActiveBudgetPeriods,
  BUDGET_STATUS_FILTERS,
  BUDGET_TYPES,
  type BudgetRow,
} from "@/services/budgetApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, CheckCircle2, Play, X } from "lucide-react";

const STATUS_CHIP: Record<string, string> = {
  Draft: "bg-gray-600 text-white",
  Approved: "bg-amber-100 text-amber-700",
  Active: "bg-blue-100 text-blue-700",
  Closed: "bg-red-100 text-red-600",
};
const TYPE_CHIP: Record<string, string> = {
  Capital: "bg-orange-100 text-orange-600",
  Operational: "bg-purple-100 text-purple-700",
  "Cash Flow": "bg-cyan-100 text-cyan-700",
};

const emptyDraft = () => ({
  id: "",
  name: "",
  periodId: "",
  periodName: "",
  type: "" as string,
});

export const Budget: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<BudgetRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["budgets", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchBudgets({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("budget_name", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budgets"] });
    qc.invalidateQueries({ queryKey: ["budget-allocations"] });
  };

  const submit = async () => {
    if (!draft.name || !draft.periodId || !draft.type) {
      showToast("Please fill all required fields", "error");
      return;
    }
    try {
      if (modal === "edit") {
        await updateBudget(draft.id, {
          budget_name: draft.name.trim(),
          period_id: draft.periodId,
          budget_type: draft.type,
        });
        showToast("Budget updated successfully", "success");
      } else {
        await createBudget({
          budget_name: draft.name.trim(),
          period_id: draft.periodId,
          budget_type: draft.type,
        });
        showToast("Budget created successfully", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save budget", "error");
    }
  };

  const runAction = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast(ok, "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Action failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBudget(deleteTarget.id);
      showToast("Budget deleted successfully", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Budget Planner"
        current="Budget"
        title="Manage Budget"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search Budgets..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={BUDGET_STATUS_FILTERS}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
      >
        <table className="w-full text-sm min-w-[950px]">
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
                  Budget Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Period", "Type", "Amount", "Status", "Approved By", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{b.name}</td>
                <td className="px-4 py-3.5 text-gray-600">{b.periodName || "—"}</td>
                <td className="px-4 py-3.5">{chip(b.type, TYPE_CHIP[b.type] || TYPE_CHIP.Operational)}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(b.amount)}</td>
                <td className="px-4 py-3.5">{chip(b.status, STATUS_CHIP[b.status] || STATUS_CHIP.Draft)}</td>
                <td className="px-4 py-3.5 text-gray-600">{b.approvedBy || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {b.status === "Draft" && (
                      <>
                        <button
                          onClick={() => void runAction(() => approveBudget(b.id), "Budget approved")}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDraft({
                              id: b.id,
                              name: b.name,
                              periodId: b.periodId,
                              periodName: b.periodName,
                              type: b.type,
                            });
                            setModal("edit");
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(b)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {b.status === "Approved" && (
                      <button
                        onClick={() => void runAction(() => activateBudget(b.id), "Budget activated")}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="Activate"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {b.status === "Active" && (
                      <button
                        onClick={() => void runAction(() => closeBudget(b.id), "Budget closed")}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No budgets found.
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
          title={modal === "edit" ? "Edit Budget" : "Create Budget"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Budget Name" required>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Budget Name" className={inputCls} />
            </Field>
            <Field label="Budget Period (Active)" required hint="Only active periods can be used">
              <AsyncSearchSelect
                value={draft.periodId}
                displayName={draft.periodName}
                onChange={(id, opt) => setDraft({ ...draft, periodId: id, periodName: opt?.name || "" })}
                onSearch={searchActiveBudgetPeriods}
                placeholder="Search active periods…"
              />
            </Field>
            <Field label="Budget Type" required>
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={selectCls}>
                <option value="">Select Budget Type</option>
                {BUDGET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && <DeleteConfirm what="Budget" name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}
    </>
  );
};

export default Budget;
