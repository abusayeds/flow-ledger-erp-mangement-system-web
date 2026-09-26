/**
 * Expenses — /api/v1/account/expenses
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveExpense,
  postExpense,
  searchExpenseCategories,
  searchBankAccounts,
  searchChartAccounts,
  EXPENSE_STATUSES,
  type ExpenseRow,
} from "@/services/accountingApi";
import { Field, inputCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, CheckCircle2, Send } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STATUS_CHIP: Record<string, string> = {
  Draft: "bg-gray-600 text-white",
  Approved: "bg-amber-100 text-amber-700",
  Posted: "bg-green-100 text-green-700",
};

const emptyDraft = () => ({
  id: "",
  expense_date: new Date().toISOString().slice(0, 10),
  category_id: "",
  category_name: "",
  bank_account_id: "",
  bank_account_name: "",
  chart_of_account_id: "",
  chart_of_account_name: "",
  amount: "" as string | number,
  description: "",
  reference_number: "",
});

export const Expense: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["account-expenses", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchExpenses({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("expense_date", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["account-expenses"] });

  const submit = async () => {
    if (!draft.expense_date || !draft.category_id || !draft.bank_account_id || !draft.chart_of_account_id) {
      showToast("Date, category, bank account and GL account are required", "error");
      return;
    }
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    const body = {
      expense_date: draft.expense_date,
      category_id: draft.category_id,
      bank_account_id: draft.bank_account_id,
      chart_of_account_id: draft.chart_of_account_id,
      amount,
      description: draft.description.trim() || undefined,
      reference_number: draft.reference_number.trim() || undefined,
    };
    try {
      if (modal === "edit") {
        await updateExpense(draft.id, body);
        showToast("Expense updated", "success");
      } else {
        await createExpense(body);
        showToast("Expense created", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
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
      await deleteExpense(deleteTarget.id);
      showToast("Expense deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Accounting"
        current="Expense"
        title="Manage Expenses"
        onCreate={() => { setDraft(emptyDraft()); setModal("create"); }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search expenses…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...EXPENSE_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
      >
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Date <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Number", "Category", "Amount", "Bank", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 text-gray-600">{r.date}</td>
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.number || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.categoryName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(r.amount)}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.bankAccountName || "—"}</td>
                <td className="px-4 py-3.5">{chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Draft)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {r.status === "Draft" && (
                      <>
                        <button type="button" onClick={() => void run(() => approveExpense(r.id), "Approved")} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50" title="Approve">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraft({
                              id: r.id,
                              expense_date: r.date,
                              category_id: r.categoryId,
                              category_name: r.categoryName,
                              bank_account_id: r.bankAccountId,
                              bank_account_name: r.bankAccountName,
                              chart_of_account_id: r.chartAccountId,
                              chart_of_account_name: r.chartAccountName,
                              amount: r.amount,
                              description: r.description,
                              reference_number: r.reference,
                            });
                            setModal("edit");
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {r.status === "Approved" && (
                      <button type="button" onClick={() => void run(() => postExpense(r.id), "Posted")} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Post">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No expenses found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Expense" : "Create Expense"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="space-y-4">
            <Field label="Date" required>
              <AppDatePicker value={draft.expense_date} onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Category" required>
              <AsyncSearchSelect value={draft.category_id} displayName={draft.category_name} onChange={(id, opt) => setDraft({ ...draft, category_id: id, category_name: opt?.name || "" })} onSearch={searchExpenseCategories} placeholder="Search categories…" />
            </Field>
            <Field label="Bank Account" required>
              <AsyncSearchSelect value={draft.bank_account_id} displayName={draft.bank_account_name} onChange={(id, opt) => setDraft({ ...draft, bank_account_id: id, bank_account_name: opt?.name || "" })} onSearch={searchBankAccounts} placeholder="Search bank accounts…" />
            </Field>
            <Field label="GL Account" required>
              <AsyncSearchSelect value={draft.chart_of_account_id} displayName={draft.chart_of_account_name} onChange={(id, opt) => setDraft({ ...draft, chart_of_account_id: id, chart_of_account_name: opt?.name || "" })} onSearch={searchChartAccounts} placeholder="Search chart of accounts…" />
            </Field>
            <Field label="Amount" required>
              <input type="number" min={0} step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Reference">
              <input value={draft.reference_number} onChange={(e) => setDraft({ ...draft, reference_number: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="expense" name={deleteTarget.number || deleteTarget.date} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
