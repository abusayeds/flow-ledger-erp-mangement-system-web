/**
 * Accounting Vendors — /vendor/all (server pagination)
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../../utils/toast";
import { api } from "@/lib/api/client";
import { buildListSortParam } from "@/lib/listSort";
import { fetchVendors } from "@/services/vendorsApi";
import { Field, inputCls } from "../../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Eye } from "lucide-react";

const emptyForm = () => ({
  name: "",
  email: "",
  phone: "",
  company_name: "",
  password: "",
  tax_number: "",
  payment_terms: "",
  notes: "",
});

export const AccountsVendors: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["account-vendors", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchVendors({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["account-vendors"] });

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      showToast("Name and email are required", "error");
      return;
    }
    if (modal === "create" && !form.password.trim()) {
      showToast("Password is required for new vendors", "error");
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone,
      company_name: form.company_name,
      tax_number: form.tax_number,
      payment_terms: form.payment_terms,
      notes: form.notes,
    };
    if (form.password.trim()) payload.password = form.password;
    try {
      if (modal === "edit" && editingId) await api.post("/vendor/update", { _id: editingId, ...payload });
      else await api.post("/vendor/create", payload);
      showToast(modal === "edit" ? "Vendor updated" : "Vendor created", "success");
      setModal(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Save failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/vendor/delete/${deleteTarget.id}`);
      showToast("Vendor deleted", "success");
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
        current="Vendor"
        title="Vendors"
        onCreate={() => { setEditingId(null); setForm(emptyForm()); setModal("create"); }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search vendors…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Company", "Email", "Phone", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r._id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.company_name || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.email || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.phone || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { setForm({ ...emptyForm(), name: r.name, email: r.email || "", phone: r.phone || "", company_name: r.company_name || "" }); setModal("view"); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50"><Eye className="w-4 h-4" /></button>
                    <button type="button" onClick={() => { setEditingId(r._id); setForm({ ...emptyForm(), name: r.name, email: r.email || "", phone: r.phone || "", company_name: r.company_name || "" }); setModal("edit"); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setDeleteTarget({ id: r._id, name: r.name })} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No vendors found.</td></tr>}
            {isLoading && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>}
          </tbody>
        </table>
      </ListShell>

      {(modal === "create" || modal === "edit") && (
        <ModalShell title={modal === "edit" ? "Edit Vendor" : "Create Vendor"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"}>
          <div className="space-y-4">
            <Field label="Name" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Email" required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Company"><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputCls} /></Field>
            {modal === "create" && <Field label="Password" required><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} /></Field>}
            <Field label="Tax Number"><input value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} className={inputCls} /></Field>
            <Field label="Payment Terms"><input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className={inputCls} /></Field>
            <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} /></Field>
          </div>
        </ModalShell>
      )}

      {modal === "view" && (
        <ModalShell title="Vendor Details" onClose={() => setModal(null)} onSubmit={() => setModal(null)} submitLabel="Close">
          <div className="space-y-2 text-sm text-gray-700">
            <p><span className="text-gray-500">Name:</span> {form.name}</p>
            <p><span className="text-gray-500">Email:</span> {form.email}</p>
            <p><span className="text-gray-500">Phone:</span> {form.phone || "—"}</p>
            <p><span className="text-gray-500">Company:</span> {form.company_name || "—"}</p>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="vendor" name={deleteTarget.name} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
