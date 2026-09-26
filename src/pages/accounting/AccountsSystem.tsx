/**
 * Accounting System — categories / types / revenue & expense categories
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchAccountCategories,
  createAccountCategory,
  updateAccountCategory,
  deleteAccountCategory,
  fetchAccountTypes,
  createAccountType,
  updateAccountType,
  deleteAccountType,
  fetchRevenueCategories,
  createRevenueCategory,
  updateRevenueCategory,
  deleteRevenueCategory,
  fetchExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  searchAccountCategories,
  searchChartAccounts,
  ACCOUNT_TYPE_KINDS,
  NORMAL_BALANCES,
} from "@/services/accountingApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { Edit, Trash2 } from "lucide-react";

type Tab = "categories" | "types" | "revenue" | "expense";

export const AccountingSystem: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("categories");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

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
  }, [tab]);

  const listParams = {
    page,
    limit: perPage,
    searchTerm: search || undefined,
    sort: buildListSortParam(tab === "revenue" || tab === "expense" ? "category_name" : "name", "Ascending"),
  };

  type SystemListResult = Awaited<
    | ReturnType<typeof fetchAccountCategories>
    | ReturnType<typeof fetchAccountTypes>
    | ReturnType<typeof fetchRevenueCategories>
    | ReturnType<typeof fetchExpenseCategories>
  >;

  const { data, isLoading } = useQuery<SystemListResult>({
    queryKey: ["account-system", tab, page, perPage, search],
    queryFn: async (): Promise<SystemListResult> => {
      if (tab === "categories") return fetchAccountCategories(listParams);
      if (tab === "types") return fetchAccountTypes(listParams);
      if (tab === "revenue") return fetchRevenueCategories(listParams);
      return fetchExpenseCategories(listParams);
    },
    placeholderData: (prev: SystemListResult | undefined) => prev,
  });

  const rows = (data?.rows ?? []) as Array<Record<string, any>>;
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["account-system"] });

  const titles: Record<Tab, string> = {
    categories: "Account Categories",
    types: "Account Types",
    revenue: "Revenue Categories",
    expense: "Expense Categories",
  };

  const openCreate = () => {
    setEditingId(null);
    if (tab === "categories") setDraft({ name: "", code: "", type: "asset", description: "", is_active: true });
    else if (tab === "types") setDraft({ name: "", code: "", category_id: "", category_name: "", normal_balance: "debit", description: "", is_active: true });
    else setDraft({ category_name: "", category_code: "", gl_account_id: "", gl_account_name: "", description: "", is_active: true });
    setModal(true);
  };

  const submit = async () => {
    try {
      if (tab === "categories") {
        if (!draft.name?.trim() || !draft.code?.trim()) return showToast("Name and code required", "error");
        const body = { name: draft.name.trim(), code: draft.code.trim(), type: draft.type, description: draft.description || undefined, is_active: draft.is_active };
        if (editingId) await updateAccountCategory(editingId, body);
        else await createAccountCategory(body);
      } else if (tab === "types") {
        if (!draft.name?.trim() || !draft.code?.trim() || !draft.category_id) return showToast("Name, code and category required", "error");
        const body = { name: draft.name.trim(), code: draft.code.trim(), category_id: draft.category_id, normal_balance: draft.normal_balance, description: draft.description || undefined, is_active: draft.is_active };
        if (editingId) await updateAccountType(editingId, body);
        else await createAccountType(body);
      } else {
        if (!draft.category_name?.trim() || !draft.category_code?.trim()) return showToast("Name and code required", "error");
        const body = { category_name: draft.category_name.trim(), category_code: draft.category_code.trim(), gl_account_id: draft.gl_account_id || undefined, description: draft.description || undefined, is_active: draft.is_active };
        if (tab === "revenue") {
          if (editingId) await updateRevenueCategory(editingId, body);
          else await createRevenueCategory(body);
        } else {
          if (editingId) await updateExpenseCategory(editingId, body);
          else await createExpenseCategory(body);
        }
      }
      showToast(editingId ? "Updated" : "Created", "success");
      setModal(false);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Save failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (tab === "categories") await deleteAccountCategory(deleteTarget.id);
      else if (tab === "types") await deleteAccountType(deleteTarget.id);
      else if (tab === "revenue") await deleteRevenueCategory(deleteTarget.id);
      else await deleteExpenseCategory(deleteTarget.id);
      showToast("Deleted", "success");
      setDeleteTarget(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Accounting"
        current="System"
        title={titles[tab]}
        onCreate={openCreate}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder={`Search ${titles[tab].toLowerCase()}…`}
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-white flex gap-2 flex-wrap">
          {([
            ["categories", "Account Categories"],
            ["types", "Account Types"],
            ["revenue", "Revenue Categories"],
            ["expense", "Expense Categories"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-sm rounded-md border ${tab === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              {(tab === "types"
                ? ["Name", "Code", "Category", "Normal", "Status", "Actions"]
                : tab === "categories"
                  ? ["Name", "Code", "Type", "Status", "Actions"]
                  : ["Name", "Code", "GL Account", "Status", "Actions"]
              ).map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.code}</td>
                {tab === "categories" && <td className="px-4 py-3.5 text-gray-600 capitalize">{r.type || "—"}</td>}
                {tab === "types" && (
                  <>
                    <td className="px-4 py-3.5 text-gray-600">{r.categoryName || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600 capitalize">{r.normalBalance}</td>
                  </>
                )}
                {(tab === "revenue" || tab === "expense") && (
                  <td className="px-4 py-3.5 text-gray-600">{r.glAccountName || "—"}</td>
                )}
                <td className="px-4 py-3.5">
                  {chip(r.isActive ? "Active" : "Inactive", r.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id);
                        if (tab === "categories") setDraft({ name: r.name, code: r.code, type: r.type || "asset", description: r.description, is_active: r.isActive });
                        else if (tab === "types") setDraft({ name: r.name, code: r.code, category_id: r.categoryId, category_name: r.categoryName, normal_balance: r.normalBalance || "debit", description: r.description, is_active: r.isActive });
                        else setDraft({ category_name: r.name, category_code: r.code, gl_account_id: r.glAccountId, gl_account_name: r.glAccountName, description: r.description, is_active: r.isActive });
                        setModal(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget({ id: r.id, name: r.name })} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No records found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={`${editingId ? "Edit" : "Create"} ${titles[tab].slice(0, -1)}`} onClose={() => setModal(false)} onSubmit={submit} submitLabel={editingId ? "Update" : "Create"}>
          <div className="space-y-4">
            {tab === "categories" && (
              <>
                <Field label="Name" required><input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></Field>
                <Field label="Code" required><input value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={inputCls} /></Field>
                <Field label="Type">
                  <select value={draft.type || "asset"} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={selectCls}>
                    {ACCOUNT_TYPE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
              </>
            )}
            {tab === "types" && (
              <>
                <Field label="Name" required><input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} /></Field>
                <Field label="Code" required><input value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={inputCls} /></Field>
                <Field label="Category" required>
                  <AsyncSearchSelect value={draft.category_id || ""} displayName={draft.category_name} onChange={(id, opt) => setDraft({ ...draft, category_id: id, category_name: opt?.name || "" })} onSearch={searchAccountCategories} placeholder="Search categories…" />
                </Field>
                <Field label="Normal Balance">
                  <select value={draft.normal_balance || "debit"} onChange={(e) => setDraft({ ...draft, normal_balance: e.target.value })} className={selectCls}>
                    {NORMAL_BALANCES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </Field>
              </>
            )}
            {(tab === "revenue" || tab === "expense") && (
              <>
                <Field label="Name" required><input value={draft.category_name || ""} onChange={(e) => setDraft({ ...draft, category_name: e.target.value })} className={inputCls} /></Field>
                <Field label="Code" required><input value={draft.category_code || ""} onChange={(e) => setDraft({ ...draft, category_code: e.target.value })} className={inputCls} /></Field>
                <Field label="GL Account">
                  <AsyncSearchSelect value={draft.gl_account_id || ""} displayName={draft.gl_account_name} onChange={(id, opt) => setDraft({ ...draft, gl_account_id: id, gl_account_name: opt?.name || "" })} onSearch={searchChartAccounts} placeholder="Search chart of accounts…" />
                </Field>
              </>
            )}
            <Field label="Description"><textarea value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={inputCls} /></Field>
            <Field label="Status">
              <select value={draft.is_active ? "1" : "0"} onChange={(e) => setDraft({ ...draft, is_active: e.target.value === "1" })} className={selectCls}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="record" name={deleteTarget.name} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
