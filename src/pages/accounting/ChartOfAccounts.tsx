/**
 * Chart of Accounts — /api/v1/account/chart-of-accounts
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchChartOfAccounts,
  fetchChartOfAccount,
  createChartOfAccount,
  updateChartOfAccount,
  deleteChartOfAccount,
  searchAccountTypes,
  NORMAL_BALANCES,
  type CoaRow,
} from "@/services/accountingApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Eye } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  account_code: "",
  account_name: "",
  account_type_id: "",
  account_type_name: "",
  normal_balance: "debit",
  opening_balance: "" as string | number,
  current_balance: "" as string | number,
  is_active: true,
  description: "",
});

export const ChartOfAccounts: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<CoaRow | null>(null);
  const [viewRow, setViewRow] = useState<any | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["chart-of-accounts", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchChartOfAccounts({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("account_code", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["chart-of-accounts"] });

  const submit = async () => {
    if (!draft.account_code.trim() || !draft.account_name.trim() || !draft.account_type_id || !draft.normal_balance) {
      showToast("Code, name, type and normal balance are required", "error");
      return;
    }
    const body = {
      account_code: draft.account_code.trim(),
      account_name: draft.account_name.trim(),
      account_type_id: draft.account_type_id,
      normal_balance: draft.normal_balance,
      opening_balance: draft.opening_balance === "" ? 0 : Number(draft.opening_balance),
      current_balance: draft.current_balance === "" ? undefined : Number(draft.current_balance),
      is_active: draft.is_active,
      description: draft.description.trim() || undefined,
    };
    try {
      if (modal === "edit") {
        await updateChartOfAccount(draft.id, body);
        showToast("Account updated", "success");
      } else {
        await createChartOfAccount(body);
        showToast("Account created", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const openView = async (r: CoaRow) => {
    try {
      const data = await fetchChartOfAccount(r.id);
      setViewRow(data);
    } catch (e: any) {
      showToast(e?.message || "Failed to load", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteChartOfAccount(deleteTarget.id);
      showToast("Account deleted", "success");
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
        current="Chart of Accounts"
        title="Chart of Accounts"
        onCreate={() => { setDraft(emptyDraft()); setModal("create"); }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search accounts…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[950px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Code <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Name", "Type", "Balance", "Normal", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.accountCode}</td>
                <td className="px-4 py-3.5 text-gray-900">{r.accountName}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.accountTypeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(r.currentBalance)}</td>
                <td className="px-4 py-3.5 text-gray-600 capitalize">{r.normalBalance}</td>
                <td className="px-4 py-3.5">
                  {chip(r.isActive ? "Active" : "Inactive", r.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => void openView(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          account_code: r.accountCode,
                          account_name: r.accountName,
                          account_type_id: r.accountTypeId,
                          account_type_name: r.accountTypeName,
                          normal_balance: r.normalBalance || "debit",
                          opening_balance: r.openingBalance,
                          current_balance: r.currentBalance,
                          is_active: r.isActive,
                          description: r.description,
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
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No accounts found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Account" : "Create Account"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Code" required>
                <input value={draft.account_code} onChange={(e) => setDraft({ ...draft, account_code: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Account Name" required>
                <input value={draft.account_name} onChange={(e) => setDraft({ ...draft, account_name: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Type" required>
                <AsyncSearchSelect
                  value={draft.account_type_id}
                  displayName={draft.account_type_name}
                  onChange={(id, opt) => setDraft({ ...draft, account_type_id: id, account_type_name: opt?.name || "" })}
                  onSearch={searchAccountTypes}
                  placeholder="Search account types…"
                />
              </Field>
              <Field label="Normal Balance" required>
                <select value={draft.normal_balance} onChange={(e) => setDraft({ ...draft, normal_balance: e.target.value })} className={selectCls}>
                  {NORMAL_BALANCES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
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
            <Field label="Status">
              <select value={draft.is_active ? "1" : "0"} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === "1" })} className={selectCls}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {viewRow && (
        <ModalShell title="Account Details" onClose={() => setViewRow(null)} onSubmit={() => setViewRow(null)} submitLabel="Close">
          <div className="space-y-2 text-sm text-gray-700">
            <p><span className="text-gray-500">Code:</span> {viewRow.account_code}</p>
            <p><span className="text-gray-500">Name:</span> {viewRow.account_name}</p>
            <p><span className="text-gray-500">Normal:</span> {viewRow.normal_balance}</p>
            <p><span className="text-gray-500">Opening:</span> {money(viewRow.opening_balance)}</p>
            <p><span className="text-gray-500">Current:</span> {money(viewRow.current_balance)}</p>
            {viewRow.description ? <p><span className="text-gray-500">Description:</span> {viewRow.description}</p> : null}
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="account" name={`${deleteTarget.accountCode} ${deleteTarget.accountName}`} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
