/**
 * Bank Transfers — /api/v1/account/bank-transfers
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchBankTransfers,
  createBankTransfer,
  updateBankTransfer,
  deleteBankTransfer,
  processBankTransfer,
  searchBankAccounts,
  TRANSFER_STATUSES,
  type BankTransferRow,
} from "@/services/accountingApi";
import { Field, inputCls, AsyncSearchSelect } from "../../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Send } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STATUS_CHIP: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Completed: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-600",
};

const emptyDraft = () => ({
  id: "",
  transfer_date: new Date().toISOString().slice(0, 10),
  from_account_id: "",
  from_account_name: "",
  to_account_id: "",
  to_account_name: "",
  transfer_amount: "" as string | number,
  transfer_charges: "" as string | number,
  reference_number: "",
  description: "",
});

export const BankTransfers: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<BankTransferRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["bank-transfers", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchBankTransfers({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("transfer_date", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["bank-transfers"] });

  const submit = async () => {
    if (!draft.from_account_id || !draft.to_account_id || !draft.transfer_date || !draft.description.trim()) {
      showToast("From/to accounts, date and description are required", "error");
      return;
    }
    if (draft.from_account_id === draft.to_account_id) {
      showToast("From and to accounts must differ", "error");
      return;
    }
    const amount = Number(draft.transfer_amount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid transfer amount", "error");
      return;
    }
    const body = {
      transfer_date: draft.transfer_date,
      from_account_id: draft.from_account_id,
      to_account_id: draft.to_account_id,
      transfer_amount: amount,
      transfer_charges: draft.transfer_charges === "" ? 0 : Number(draft.transfer_charges),
      reference_number: draft.reference_number.trim() || undefined,
      description: draft.description.trim(),
    };
    try {
      if (modal === "edit") {
        await updateBankTransfer(draft.id, body);
        showToast("Transfer updated", "success");
      } else {
        await createBankTransfer(body);
        showToast("Transfer created", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const process = async (t: BankTransferRow) => {
    try {
      await processBankTransfer(t.id);
      showToast("Transfer processed", "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Process failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBankTransfer(deleteTarget.id);
      showToast("Transfer deleted", "success");
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
        current="Bank Transfers"
        title="Manage Bank Transfers"
        onCreate={() => { setDraft(emptyDraft()); setModal("create"); }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search transfers…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...TRANSFER_STATUSES]}
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
              {["From → To", "Amount", "Reference", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5">
                  <div className="font-medium text-gray-900">{r.transferDate}</div>
                  <div className="text-xs text-gray-500">{r.transferNumber}</div>
                </td>
                <td className="px-4 py-3.5 text-gray-600">
                  {r.fromAccountName || "—"} → {r.toAccountName || "—"}
                  {r.description ? <div className="text-xs text-gray-400 truncate max-w-[240px]">{r.description}</div> : null}
                </td>
                <td className="px-4 py-3.5 text-gray-900">
                  {money(r.transferAmount)}
                  {r.transferCharges > 0 ? <div className="text-xs text-gray-400">Charges {money(r.transferCharges)}</div> : null}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.referenceNumber || "—"}</td>
                <td className="px-4 py-3.5">{chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Pending)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {r.status === "Pending" && (
                      <>
                        <button type="button" onClick={() => void process(r)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50" title="Process">
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraft({
                              id: r.id,
                              transfer_date: r.transferDate,
                              from_account_id: r.fromAccountId,
                              from_account_name: r.fromAccountName,
                              to_account_id: r.toAccountId,
                              to_account_name: r.toAccountName,
                              transfer_amount: r.transferAmount,
                              transfer_charges: r.transferCharges,
                              reference_number: r.referenceNumber,
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No transfers found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Transfer" : "Create Transfer"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="space-y-4">
            <Field label="Transfer Date" required>
              <AppDatePicker value={draft.transfer_date} onChange={(e) => setDraft({ ...draft, transfer_date: e.target.value })} className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="From Account" required>
                <AsyncSearchSelect
                  value={draft.from_account_id}
                  displayName={draft.from_account_name}
                  onChange={(id, opt) => setDraft({ ...draft, from_account_id: id, from_account_name: opt?.name || "" })}
                  onSearch={searchBankAccounts}
                  placeholder="Search bank accounts…"
                />
              </Field>
              <Field label="To Account" required>
                <AsyncSearchSelect
                  value={draft.to_account_id}
                  displayName={draft.to_account_name}
                  onChange={(id, opt) => setDraft({ ...draft, to_account_id: id, to_account_name: opt?.name || "" })}
                  onSearch={searchBankAccounts}
                  placeholder="Search bank accounts…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount" required>
                <input type="number" min={0.01} step="0.01" value={draft.transfer_amount} onChange={(e) => setDraft({ ...draft, transfer_amount: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Charges">
                <input type="number" min={0} step="0.01" value={draft.transfer_charges} onChange={(e) => setDraft({ ...draft, transfer_charges: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Reference">
              <input value={draft.reference_number} onChange={(e) => setDraft({ ...draft, reference_number: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Description" required>
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="transfer" name={deleteTarget.transferNumber || deleteTarget.description} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
