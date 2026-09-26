/**
 * Manage Budget Allocations — /api/v1/budget-planner/budget-allocations
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchAllocations,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  searchBudgets,
  searchBudgetAccounts,
  type AllocationRow,
} from "@/services/budgetApi";
import { Field, inputCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  budgetId: "",
  budgetName: "",
  accountId: "",
  accountName: "",
  allocated: 0,
});

export const BudgetAllocations: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [budgetFilterId, setBudgetFilterId] = useState("");
  const [budgetFilterName, setBudgetFilterName] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<AllocationRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["budget-allocations", page, perPage, search, budgetFilterId],
    queryFn: () =>
      fetchAllocations({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        budget_id: budgetFilterId || undefined,
        sort: buildListSortParam("createdAt", "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budget-allocations"] });
    qc.invalidateQueries({ queryKey: ["budgets"] });
    qc.invalidateQueries({ queryKey: ["budget-monitoring"] });
  };

  const submit = async () => {
    if (!draft.budgetId || !draft.accountId || !(Number(draft.allocated) > 0)) {
      showToast("Please fill all required fields", "error");
      return;
    }
    try {
      const body = {
        budget_id: draft.budgetId,
        account_id: draft.accountId,
        allocated_amount: Number(draft.allocated),
      };
      if (modal === "edit") {
        await updateAllocation(draft.id, body);
        showToast("Budget allocation updated successfully", "success");
      } else {
        await createAllocation(body);
        showToast("Budget allocation created successfully", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save allocation", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAllocation(deleteTarget.id);
      showToast("Budget allocation deleted successfully", "success");
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
        current="Budget Allocations"
        title="Manage Budget Allocations"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search by budget or account..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter by Budget</span>
          <div className="w-full sm:w-72">
            <AsyncSearchSelect
              value={budgetFilterId}
              displayName={budgetFilterName}
              onChange={(id, opt) => {
                setBudgetFilterId(id);
                setBudgetFilterName(opt?.name || "");
                setPage(1);
              }}
              onSearch={searchBudgets}
              placeholder="All budgets…"
            />
          </div>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              {["Budget", "Account", "Allocated Amount", "Spent Amount", "Remaining Amount", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{a.budgetName}</td>
                <td className="px-4 py-3.5 text-gray-600">{a.accountName}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(a.allocated)}</td>
                <td className="px-4 py-3.5 text-gray-600">{money(a.spent)}</td>
                <td className="px-4 py-3.5 text-gray-900 font-medium">{money(a.remaining)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setDraft({
                          id: a.id,
                          budgetId: a.budgetId,
                          budgetName: a.budgetName,
                          accountId: a.accountId,
                          accountName: a.accountName,
                          allocated: a.allocated,
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(a)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No budget allocations found.
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
          title={modal === "edit" ? "Edit Budget Allocation" : "Create Budget Allocation"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Budget" required>
              <AsyncSearchSelect
                value={draft.budgetId}
                displayName={draft.budgetName}
                onChange={(id, opt) => setDraft({ ...draft, budgetId: id, budgetName: opt?.name || "" })}
                onSearch={searchBudgets}
                placeholder="Search budgets…"
              />
            </Field>
            <Field label="Account" required>
              <AsyncSearchSelect
                value={draft.accountId}
                displayName={draft.accountName}
                onChange={(id, opt) => setDraft({ ...draft, accountId: id, accountName: opt?.name || "" })}
                onSearch={searchBudgetAccounts}
                placeholder="Search chart of accounts…"
              />
            </Field>
            <Field label="Allocated Amount" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={draft.allocated || ""}
                  onChange={(e) => setDraft({ ...draft, allocated: Number(e.target.value) })}
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="Budget Allocation"
          name={`${deleteTarget.budgetName} · ${deleteTarget.accountName}`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default BudgetAllocations;
