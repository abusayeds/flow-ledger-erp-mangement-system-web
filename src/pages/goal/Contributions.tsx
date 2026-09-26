/**
 * Manage Contributions — server-backed via /api/v1/goal/contributions.
 */

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchContributions,
  createContribution,
  updateContribution,
  deleteContribution,
  searchGoals,
  type ContributionRow,
} from "@/services/goalApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "./goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  goal: "",
  goalId: "",
  date: "",
  amount: 0,
  type: "Manual" as ContributionRow["type"],
  notes: "",
});

export const Contributions: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<ContributionRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data } = useQuery({
    queryKey: ["goal-contributions", page, perPage, search, sortAsc, typeFilter],
    queryFn: () =>
      fetchContributions({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("contribution_date", sortAsc ? "Ascending" : "Descending"),
        contribution_type: typeFilter === "All" ? undefined : typeFilter.toLowerCase(),
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const paginated = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["goal-contributions"] });
    await queryClient.invalidateQueries({ queryKey: ["goal-goals"] });
  };

  const submit = async () => {
    if (!draft.goalId || !draft.date || !(Number(draft.amount) > 0)) {
      showToast("Please fill all required fields", "error");
      return;
    }
    const amount = Number(draft.amount);
    try {
      if (modal === "edit") {
        await updateContribution(draft.id, {
          goalId: draft.goalId,
          date: draft.date,
          amount,
          type: draft.type,
          notes: draft.notes,
        });
        showToast("Contribution updated successfully", "success");
      } else {
        await createContribution({
          goalId: draft.goalId,
          date: draft.date,
          amount,
          type: draft.type,
          notes: draft.notes,
        });
        showToast("Contribution created successfully", "success");
      }
      await invalidate();
      setModal(null);
    } catch {
      showToast("Failed to save contribution", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContribution(deleteTarget.id);
      showToast("Contribution deleted successfully", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch {
      showToast("Failed to delete contribution", "error");
    }
  };

  const actions = (c: ContributionRow) => (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => {
          setDraft({
            id: c.id,
            goal: c.goal,
            goalId: c.goalId,
            date: c.date,
            amount: c.amount,
            type: c.type,
            notes: c.notes,
          });
          setModal("edit");
        }}
        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
        title="Edit"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <>
      <ListShell
        module="Goal"
        current="Contributions"
        title="Manage Contributions"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search Contributions..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={["Manual", "Automatic"]}
        filterValue={typeFilter}
        setFilterValue={setTypeFilter}
        filterLabel="Type"
        view={view}
        setView={setView}
      >
        {view === "list" ? (
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Goal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  <button
                    onClick={() => {
                      setSortAsc(!sortAsc);
                      setPage(1);
                    }}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Date <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {["Amount", "Type", "Notes", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3.5 font-medium text-gray-900">{c.goal}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.date}</td>
                  <td className="px-4 py-3.5 text-gray-900">{money(c.amount)}</td>
                  <td className="px-4 py-3.5">{chip(c.type, STATUS_CHIP[c.type])}</td>
                  <td className="px-4 py-3.5 text-gray-600">{c.notes}</td>
                  <td className="px-4 py-3.5">{actions(c)}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No contributions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((c) => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{c.goal}</div>
                    <div className="text-xs text-gray-400">{c.date}</div>
                  </div>
                  {chip(c.type, STATUS_CHIP[c.type])}
                </div>
                <p className="text-xl font-bold text-blue-600 mb-1">{money(c.amount)}</p>
                <p className="text-sm text-gray-500 mb-2">{c.notes}</p>
                <div className="flex justify-end border-t border-gray-100 pt-2">{actions(c)}</div>
              </div>
            ))}
            {paginated.length === 0 && <div className="col-span-full py-12 text-center text-gray-500">No contributions found.</div>}
          </div>
        )}
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Contribution" : "Create Contribution"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"}>
          <div className="space-y-4">
            <Field label="Goal" required>
              <AsyncSearchSelect
                value={draft.goalId}
                displayName={draft.goal}
                onChange={(id, opt) => setDraft({ ...draft, goalId: id, goal: opt?.name || "" })}
                onSearch={searchGoals}
                placeholder="Select Goal"
              />
            </Field>
            <Field label="Date" required>
              <AppDatePicker value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Amount" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={draft.amount || ""}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
            <Field label="Type">
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ContributionRow["type"] })} className={selectCls}>
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Enter notes..." rows={3} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="Contribution" name={`${deleteTarget.goal} · ${money(deleteTarget.amount)}`} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
