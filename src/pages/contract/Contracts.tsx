/**
 * Contracts — /api/v1/contract
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchContracts,
  createContract,
  updateContract,
  deleteContract,
  searchContractTypes,
  CONTRACT_STATUSES,
  type ContractRow,
} from "@/services/contractApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Eye } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STATUS_CHIP: Record<string, string> = {
  Draft: "bg-gray-600 text-white",
  Active: "bg-green-100 text-green-700",
  Expired: "bg-amber-100 text-amber-700",
  Terminated: "bg-red-100 text-red-600",
  Renewed: "bg-blue-100 text-blue-700",
};

const emptyDraft = () => ({
  id: "",
  number: "",
  subject: "",
  partyName: "",
  value: "",
  type: "",
  typeName: "",
  startDate: "",
  endDate: "",
  status: "Draft",
  description: "",
  duration: "",
});

const Contracts: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | "view" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", page, perPage, search, statusFilter, sortAsc],
    queryFn: () =>
      fetchContracts({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["contracts"] });

  const openEdit = (r: ContractRow) => {
    setDraft({
      id: r.id,
      number: r.number,
      subject: r.subject,
      partyName: r.partyName,
      value: String(r.value || ""),
      type: r.type,
      typeName: r.type,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status || "Draft",
      description: r.description,
      duration: String(r.duration || ""),
    });
    setModal("edit");
  };

  const submit = async () => {
    if (!draft.subject.trim()) {
      showToast("Subject is required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      contract_number: draft.number.trim() || undefined,
      subject: draft.subject.trim(),
      party_name: draft.partyName.trim() || undefined,
      value: Number(draft.value) || 0,
      type: draft.type.trim() || draft.typeName.trim() || undefined,
      start_date: draft.startDate || undefined,
      end_date: draft.endDate || undefined,
      status: draft.status,
      description: draft.description.trim() || undefined,
      duration: Number(draft.duration) || 0,
    };
    try {
      if (modal === "edit") {
        await updateContract(draft.id, body);
        showToast("Contract updated", "success");
      } else {
        await createContract(body);
        showToast("Contract created", "success");
      }
      setModal(null);
      await invalidate();
      qc.invalidateQueries({ queryKey: ["contract-types"] });
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContract(deleteTarget.id);
      showToast("Contract deleted", "success");
      setDeleteTarget(null);
      await invalidate();
      qc.invalidateQueries({ queryKey: ["contract-types"] });
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Contract"
        current="Contracts"
        title="Manage Contracts"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search contracts…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...CONTRACT_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Subject <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Number", "Party", "Type", "Value", "Status", "Dates", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.subject || "—"}</td>
                <td className="px-4 py-3.5 font-mono text-gray-600">{r.number || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.partyName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.type || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{r.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3.5">{chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Draft)}</td>
                <td className="px-4 py-3.5 text-gray-600 text-xs whitespace-nowrap">
                  {r.startDate || "—"} → {r.endDate || "—"}
              </td>
              <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { setDraft({ ...emptyDraft(), ...{ id: r.id, number: r.number, subject: r.subject, partyName: r.partyName, value: String(r.value), type: r.type, typeName: r.type, startDate: r.startDate, endDate: r.endDate, status: r.status, description: r.description, duration: String(r.duration) } }); setModal("view"); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50">
                    <Eye className="w-4 h-4" />
                  </button>
                    <button type="button" onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                      <Edit className="w-4 h-4" />
                  </button>
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No contracts found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
        </tbody>
      </table>
      </ListShell>

      {(modal === "create" || modal === "edit") && (
        <ModalShell title={modal === "edit" ? "Edit Contract" : "Create Contract"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
              <Field label="Subject" required>
                <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Contract #">
                <input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Party name">
                <input value={draft.partyName} onChange={(e) => setDraft({ ...draft, partyName: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Type">
                <AsyncSearchSelect
                  value={draft.type}
                  displayName={draft.typeName || draft.type}
                  onChange={(id, opt) => setDraft({ ...draft, type: id || opt?.name || "", typeName: opt?.name || id })}
                  onSearch={async (q) => {
                    const opts = await searchContractTypes(q);
                    if (q.trim() && !opts.some((o) => o.name.toLowerCase() === q.trim().toLowerCase())) {
                      return [{ id: q.trim(), name: q.trim() }, ...opts];
                    }
                    return opts;
                  }}
                  placeholder="Search or type a new type…"
                />
              </Field>
              <Field label="Value">
                <input type="number" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={selectCls}>
                  {CONTRACT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
              </select>
              </Field>
              <Field label="Start date">
                <AppDatePicker value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="End date">
                <AppDatePicker value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Duration (days)">
                <input type="number" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {modal === "view" && (
        <ModalShell title={draft.subject || "Contract"} onClose={() => setModal(null)} onSubmit={() => setModal(null)} submitLabel="Close" wide>
          <div className="space-y-3 text-sm text-gray-700">
            <p><span className="text-gray-500">Number:</span> {draft.number || "—"}</p>
            <p><span className="text-gray-500">Party:</span> {draft.partyName || "—"}</p>
            <p><span className="text-gray-500">Type:</span> {draft.type || "—"}</p>
            <p><span className="text-gray-500">Value:</span> {draft.value || "0"}</p>
            <p><span className="text-gray-500">Status:</span> {draft.status}</p>
            <p><span className="text-gray-500">Dates:</span> {draft.startDate || "—"} → {draft.endDate || "—"}</p>
            <p className="whitespace-pre-wrap border border-gray-200 rounded-md p-3 bg-gray-50">{draft.description || "No description"}</p>
                    </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="contract" name={deleteTarget.subject} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};

export default Contracts;
export { Contracts };
