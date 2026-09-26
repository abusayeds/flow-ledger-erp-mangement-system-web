/**
 * Debit Notes — /api/v1/account/debit-notes
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchDebitNotes,
  fetchDebitNote,
  approveDebitNote,
  deleteDebitNote,
  type NoteRow,
} from "@/services/accountingApi";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Eye, Trash2, CheckCircle2 } from "lucide-react";

export const AccountsDebitNotes: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NoteRow | null>(null);
  const [view, setView] = useState<any | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["debit-notes", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchDebitNotes({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["debit-notes"] });

  const openView = async (r: NoteRow) => {
    try {
      setView(await fetchDebitNote(r.id));
    } catch (e: any) {
      showToast(e?.message || "Failed to load", "error");
    }
  };

  const approve = async (r: NoteRow) => {
    try {
      await approveDebitNote(r.id);
      showToast("Approved", "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Approve failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDebitNote(deleteTarget.id);
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
        current="Debit Notes"
        title="Debit Notes"
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search debit notes…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={["Draft", "Approved", "Open", "Partial", "Closed"]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
      >
        <table className="w-full text-sm min-w-[850px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Date <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Number", "Vendor", "Amount", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 text-gray-600">{r.date || "—"}</td>
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.number || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{r.partyName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(r.amount)}</td>
                <td className="px-4 py-3.5">{chip(r.status, "bg-blue-100 text-blue-700")}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => void openView(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50" title="View">
                      <Eye className="w-4 h-4" />
                    </button>
                    {r.status.toLowerCase() === "draft" && (
                      <button type="button" onClick={() => void approve(r)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50" title="Approve">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No debit notes found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {view && (
        <ModalShell title="Debit Note Details" onClose={() => setView(null)} onSubmit={() => setView(null)} submitLabel="Close">
          <div className="space-y-2 text-sm text-gray-700">
            <p><span className="text-gray-500">Number:</span> {view.debit_note_number || view.note_number || "—"}</p>
            <p><span className="text-gray-500">Status:</span> {view.status}</p>
            <p><span className="text-gray-500">Total:</span> {money(view.total ?? view.amount)}</p>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="debit note" name={deleteTarget.number || deleteTarget.partyName} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
