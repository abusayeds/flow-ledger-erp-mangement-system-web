/**
 * Contract Types — derived from contract.type (no dedicated types API on backend).
 * Manage labels used across contracts: list / rename / clear.
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import {
  fetchContractTypes,
  createContractType,
  renameContractType,
  clearContractType,
} from "@/services/contractApi";
import { Field, inputCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const ContractTypes: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [editingOld, setEditingOld] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["contract-types", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchContractTypes({
        page,
        limit: perPage,
        searchTerm: search || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  let rows = data?.rows ?? [];
  if (!sortAsc) rows = [...rows].reverse();
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contract-types"] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const submit = async () => {
    const next = name.trim();
    if (!next) {
      showToast("Type name is required", "error");
      return;
    }
    try {
      if (modal === "edit") {
        if (editingOld === next) {
          setModal(null);
          return;
        }
        const n = await renameContractType(editingOld, next);
        showToast(n > 0 ? `Type renamed (${n} contract(s) updated)` : "Type renamed", "success");
      } else {
        await createContractType(next);
        showToast("Contract type created", "success");
      }
      setModal(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const n = await clearContractType(deleteTarget.name);
      showToast(`Cleared type from ${n} contract(s)`, "success");
      setDeleteTarget(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Contract"
        current="Contract Types"
        title="Contract Types"
        onCreate={() => {
          setName("");
          setEditingOld("");
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search types…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 hover:text-gray-900">
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Contracts", "Count", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3.5 text-gray-600">
                  {r.contracts.length === 0 ? "—" : r.contracts.map((n) => (
                    <span key={n} className="inline-block mr-1 mb-1 px-2 py-0.5 rounded bg-gray-100 text-xs font-mono">{n}</span>
                  ))}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.count}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOld(r.name);
                        setName(r.name);
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
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
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">No types yet — add a type on a contract.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit type" : "Add type"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"}>
          <Field label="Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Software License Agreement" />
          </Field>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="type"
          name={`${deleteTarget.name} (${deleteTarget.count} contracts)`}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default ContractTypes;
export { ContractTypes };
