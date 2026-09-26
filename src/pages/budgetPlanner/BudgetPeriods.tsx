/**
 * Manage Budget Periods — /api/v1/budget-planner/budget-periods
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchBudgetPeriods,
  createBudgetPeriod,
  updateBudgetPeriod,
  deleteBudgetPeriod,
  approveBudgetPeriod,
  activateBudgetPeriod,
  closeBudgetPeriod,
  BUDGET_STATUS_FILTERS,
  type BudgetPeriodRow,
} from "@/services/budgetApi";
import { Field, inputCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, CheckCircle2, Play, X } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STATUS_CHIP: Record<string, string> = {
  Draft: "bg-gray-600 text-white",
  Approved: "bg-amber-100 text-amber-700",
  Active: "bg-blue-100 text-blue-700",
  Closed: "bg-red-100 text-red-600",
};

const emptyDraft = () => ({ id: "", name: "", financialYear: "", startDate: "", endDate: "" });

export const BudgetPeriods: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState<"period_name" | "financial_year">("period_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<BudgetPeriodRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["budget-periods", page, perPage, search, sortField, sortAsc, statusFilter],
    queryFn: () =>
      fetchBudgetPeriods({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam(sortField, sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["budget-periods"] });

  const toggleSort = (f: "period_name" | "financial_year") => {
    if (sortField === f) setSortAsc(!sortAsc);
    else {
      setSortField(f);
      setSortAsc(true);
    }
    setPage(1);
  };

  const submit = async () => {
    if (!draft.name || !draft.financialYear || !draft.startDate || !draft.endDate) {
      showToast("Please fill all required fields", "error");
      return;
    }
    try {
      const body = {
        period_name: draft.name.trim(),
        financial_year: draft.financialYear.trim(),
        start_date: draft.startDate,
        end_date: draft.endDate,
      };
      if (modal === "edit") {
        await updateBudgetPeriod(draft.id, body);
        showToast("Budget period updated successfully", "success");
      } else {
        await createBudgetPeriod(body);
        showToast("Budget period created successfully", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save budget period", "error");
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
      await deleteBudgetPeriod(deleteTarget.id);
      showToast("Budget period deleted successfully", "success");
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
        current="Budget Periods"
        title="Manage Budget Periods"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search Budget Periods..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={BUDGET_STATUS_FILTERS}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
      >
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => toggleSort("period_name")} className="flex items-center gap-1 hover:text-gray-900">
                  Period Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => toggleSort("financial_year")} className="flex items-center gap-1 hover:text-gray-900">
                  Financial Year <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Start Date", "End Date", "Status", "Approved By", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3.5 text-gray-600">{p.financialYear}</td>
                <td className="px-4 py-3.5 text-gray-600">{p.startDate}</td>
                <td className="px-4 py-3.5 text-gray-600">{p.endDate}</td>
                <td className="px-4 py-3.5">{chip(p.status, STATUS_CHIP[p.status] || STATUS_CHIP.Draft)}</td>
                <td className="px-4 py-3.5 text-gray-600">{p.approvedBy || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {p.status === "Draft" && (
                      <>
                        <button
                          onClick={() => void runAction(() => approveBudgetPeriod(p.id), "Budget period approved")}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDraft({
                              id: p.id,
                              name: p.name,
                              financialYear: p.financialYear,
                              startDate: p.startDate,
                              endDate: p.endDate,
                            });
                            setModal("edit");
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {p.status === "Approved" && (
                      <button
                        onClick={() => void runAction(() => activateBudgetPeriod(p.id), "Budget period activated")}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="Activate"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {p.status === "Active" && (
                      <button
                        onClick={() =>
                          void runAction(
                            () => closeBudgetPeriod(p.id),
                            "Budget period and all associated budgets closed successfully.",
                          )
                        }
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Close period"
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
                  No budget periods found.
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
          title={modal === "edit" ? "Edit Budget Period" : "Create Budget Period"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Period Name" required>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enter Period Name" className={inputCls} />
            </Field>
            <Field label="Financial Year" required>
              <input
                value={draft.financialYear}
                onChange={(e) => setDraft({ ...draft, financialYear: e.target.value })}
                placeholder="e.g. 2026"
                className={inputCls}
              />
            </Field>
            <Field label="Start Date" required>
              <AppDatePicker value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="End Date" required>
              <AppDatePicker value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="Budget Period" name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};

export default BudgetPeriods;
