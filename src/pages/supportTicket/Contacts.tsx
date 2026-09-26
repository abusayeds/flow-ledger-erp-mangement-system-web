/**
 * Contact submissions — /api/v1/support/contact
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import { fetchContacts, fetchContact, deleteContact, type ContactRow } from "@/services/supportApi";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Eye, Trash2 } from "lucide-react";

const Contact: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);
  const [view, setView] = useState<ContactRow | null>(null);
  const [viewBody, setViewBody] = useState<any>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["support-contacts", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchContacts({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["support-contacts"] });

  const openView = async (r: ContactRow) => {
    setView(r);
    try {
      setViewBody(await fetchContact(r.id));
    } catch {
      setViewBody(r);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContact(deleteTarget.id);
      showToast("Contact deleted", "success");
      setDeleteTarget(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Support Ticket"
        current="Contacts"
        title="Contact Submissions"
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search contacts…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[850px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Email", "Subject", "Date", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.email || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600 max-w-[200px] truncate">{r.subject || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.createdAt || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => void openView(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No submissions found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {view && (
        <ModalShell title="Contact Message" onClose={() => { setView(null); setViewBody(null); }} onSubmit={() => { setView(null); setViewBody(null); }} submitLabel="Close">
          <div className="space-y-2 text-sm text-gray-700">
            <p><span className="text-gray-500">From:</span> {viewBody?.name || view.name} ({viewBody?.email || view.email})</p>
            <p><span className="text-gray-500">Subject:</span> {viewBody?.subject || view.subject || "—"}</p>
            <p className="whitespace-pre-wrap border border-gray-200 rounded-md p-3 bg-gray-50">{viewBody?.message || view.message || "—"}</p>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="submission" name={deleteTarget.email || deleteTarget.name} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};

export default Contact;
