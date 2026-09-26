/**
 * Bank Accounts — /api/v1/account/bank-accounts
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  searchChartAccounts,
  BANK_ACCOUNT_TYPES,
  type BankAccountRow,
} from "@/services/accountingApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  account_number: "",
  account_name: "",
  bank_name: "",
  branch_name: "",
  account_type: "checking",
  opening_balance: "" as string | number,
  current_balance: "" as string | number,
  is_active: true,
  gl_account_id: "",
  gl_account_name: "",
});

export const BankAccounts: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<BankAccountRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["bank-accounts", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchBankAccounts({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("account_name", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["bank-accounts"] });

  const submit = async () => {
    if (!draft.account_name.trim() || !draft.account_number.trim() || !draft.bank_name.trim() || !draft.account_type) {
      showToast("Account name, number, bank name and type are required", "error");
      return;
    }
    const body = {
      account_number: draft.account_number.trim(),
      account_name: draft.account_name.trim(),
      bank_name: draft.bank_name.trim(),
      branch_name: draft.branch_name.trim() || undefined,
      account_type: draft.account_type,
      opening_balance: draft.opening_balance === "" ? 0 : Number(draft.opening_balance),
      current_balance: draft.current_balance === "" ? undefined : Number(draft.current_balance),
      is_active: draft.is_active,
      gl_account_id: draft.gl_account_id || undefined,
    };
    try {
      if (modal === "edit") {
        await updateBankAccount(draft.id, body);
        showToast("Bank account updated", "success");
      } else {
        await createBankAccount(body);
        showToast("Bank account created", "success");
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
      await deleteBankAccount(deleteTarget.id);
      showToast("Bank account deleted", "success");
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
        current="Bank Accounts"
        title="Manage Bank Accounts"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search bank accounts…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Account <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Bank", "Type", "Balance", "GL Account", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5">
                  <div className="font-medium text-gray-900">{r.accountName}</div>
                  <div className="text-xs text-gray-500">{r.accountNumber}</div>
                </td>
                <td className="px-4 py-3.5 text-gray-600">
                  {r.bankName}
                  {r.branchName ? <div className="text-xs text-gray-400">{r.branchName}</div> : null}
                </td>
                <td className="px-4 py-3.5 text-gray-600 capitalize">{r.accountType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(r.currentBalance)}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.glAccountName || "—"}</td>
                <td className="px-4 py-3.5">
                  {chip(r.isActive ? "Active" : "Inactive", r.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          account_number: r.accountNumber,
                          account_name: r.accountName,
                          bank_name: r.bankName,
                          branch_name: r.branchName,
                          account_type: r.accountType || "checking",
                          opening_balance: r.openingBalance,
                          current_balance: r.currentBalance,
                          is_active: r.isActive,
                          gl_account_id: r.glAccountId,
                          gl_account_name: r.glAccountName,
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
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No bank accounts found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Bank Account" : "Create Bank Account"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Name" required>
                <input value={draft.account_name} onChange={(e) => setDraft({ ...draft, account_name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Account Number" required>
                <input value={draft.account_number} onChange={(e) => setDraft({ ...draft, account_number: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bank Name" required>
                <input value={draft.bank_name} onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Branch">
                <input value={draft.branch_name} onChange={(e) => setDraft({ ...draft, branch_name: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Type" required>
                <select value={draft.account_type} onChange={(e) => setDraft({ ...draft, account_type: e.target.value })} className={selectCls}>
                  {BANK_ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={draft.is_active ? "1" : "0"} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === "1" })} className={selectCls}>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Opening Balance">
                <input type="number" value={draft.opening_balance} onChange={(e) => setDraft({ ...draft, opening_balance: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Current Balance">
                <input type="number" value={draft.current_balance} onChange={(e) => setDraft({ ...draft, current_balance: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="GL Account">
              <AsyncSearchSelect
                value={draft.gl_account_id}
                displayName={draft.gl_account_name}
                onChange={(id, opt) => setDraft({ ...draft, gl_account_id: id, gl_account_name: opt?.name || "" })}
                onSearch={searchChartAccounts}
                placeholder="Search chart of accounts…"
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="bank account" name={deleteTarget.accountName} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
