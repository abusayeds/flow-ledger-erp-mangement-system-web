/**
 * Manage Tracking — server-backed via /api/v1/goal/tracking.
 */

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchTracking,
  createTracking,
  updateTracking,
  deleteTracking,
  searchGoals,
  type TrackingRow,
} from "@/services/goalApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "./goalShared";
import { ArrowUpDown, Eye, Edit, Trash2, X } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const TRACK_FILTER_BE: Record<string, string> = {
  "On track": "on_track",
  Behind: "behind",
  Ahead: "ahead",
  Critical: "critical",
};

const TRACK_STATUSES = ["On track", "Behind", "Ahead", "Critical"] as const;

const emptyDraft = () => ({
  id: "",
  goal: "",
  goalId: "",
  date: "",
  previousAmount: 0,
  contribution: 0,
  currentAmount: 0,
  progress: 0,
  daysLeft: 0,
  projectedDate: "",
  status: "On track" as TrackingRow["status"],
});

export const Tracking: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [viewRow, setViewRow] = useState<TrackingRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrackingRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data } = useQuery({
    queryKey: ["goal-tracking", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchTracking({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("tracking_date", sortAsc ? "Ascending" : "Descending"),
        on_track_status: statusFilter === "All" ? undefined : TRACK_FILTER_BE[statusFilter],
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const paginated = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const submit = async () => {
    if (!draft.goalId || !draft.date) {
      showToast("Please fill all required fields", "error");
      return;
    }
    try {
      const payload = {
        goalId: draft.goalId,
        date: draft.date,
        contribution: Number(draft.contribution) || 0,
        currentAmount: Number(draft.currentAmount) || 0,
        progress: Number(draft.progress) || 0,
        daysLeft: Number(draft.daysLeft) || 0,
        projectedDate: draft.projectedDate || undefined,
        status: draft.status,
      };
      if (modal === "edit") {
        await updateTracking(draft.id, payload);
        showToast("Tracking updated successfully", "success");
      } else {
        await createTracking(payload);
        showToast("Tracking created successfully", "success");
      }
      await queryClient.invalidateQueries({ queryKey: ["goal-tracking"] });
      setModal(null);
    } catch {
      showToast("Failed to save tracking entry", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTracking(deleteTarget.id);
      showToast("Tracking deleted successfully", "success");
      await queryClient.invalidateQueries({ queryKey: ["goal-tracking"] });
      setDeleteTarget(null);
    } catch {
      showToast("Failed to delete tracking entry", "error");
    }
  };

  const actions = (t: TrackingRow) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setViewRow(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          setDraft({
            id: t.id,
            goal: t.goal,
            goalId: t.goalId,
            date: t.date,
            previousAmount: t.currentAmount - t.contribution,
            contribution: t.contribution,
            currentAmount: t.currentAmount,
            progress: t.progress,
            daysLeft: t.daysLeft,
            projectedDate: t.projectedDate,
            status: t.status,
          });
          setModal("edit");
        }}
        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
        title="Edit"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <>
      <ListShell
        module="Goal"
        current="Tracking"
        title="Manage Tracking"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search Goals..."
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={["On track", "Behind", "Ahead", "Critical"]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        view={view}
        setView={setView}
      >
        {view === "list" ? (
          <table className="w-full text-sm min-w-[1000px]">
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
                {["Contribution", "Current Amount", "Progress", "Days Left", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginated.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3.5 font-medium text-gray-900">{t.goal}</td>
                  <td className="px-4 py-3.5 text-gray-600">{t.date}</td>
                  <td className="px-4 py-3.5 text-gray-900">{money(t.contribution)}</td>
                  <td className="px-4 py-3.5 text-gray-600">{money(t.currentAmount)}</td>
                  <td className="px-4 py-3.5 text-gray-600">{t.progress.toFixed(2)}%</td>
                  <td className="px-4 py-3.5 text-gray-600">{t.daysLeft}</td>
                  <td className="px-4 py-3.5">{chip(t.status, STATUS_CHIP[t.status])}</td>
                  <td className="px-4 py-3.5">{actions(t)}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No tracking entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-gray-900">{t.goal}</div>
                    <div className="text-xs text-gray-400">{t.date}</div>
                  </div>
                  {chip(t.status, STATUS_CHIP[t.status])}
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Contribution</span>
                  <span className="text-gray-900">{money(t.contribution)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Current</span>
                  <span className="text-gray-900">{money(t.currentAmount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Days Left</span>
                  <span className="text-gray-900">{t.daysLeft}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, t.progress)}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{t.progress.toFixed(1)}%</span>
                </div>
                <div className="flex justify-end border-t border-gray-100 pt-2 mt-3">{actions(t)}</div>
              </div>
            ))}
            {paginated.length === 0 && <div className="col-span-full py-12 text-center text-gray-500">No tracking entries found.</div>}
          </div>
        )}
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Tracking" : "Create Tracking"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Goal" className="md:col-span-2" required>
              <AsyncSearchSelect
                value={draft.goalId}
                displayName={draft.goal}
                onChange={(id, opt) => setDraft({ ...draft, goalId: id, goal: opt?.name || "" })}
                onSearch={searchGoals}
                placeholder="Select Goal"
              />
            </Field>
            <Field label="Tracking Date" required className="md:col-span-2">
              <AppDatePicker value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Previous Amount" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={draft.previousAmount || ""}
                  onChange={(e) => {
                    const prev = Number(e.target.value);
                    setDraft({ ...draft, previousAmount: prev, currentAmount: prev + Number(draft.contribution || 0) });
                  }}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
            <Field label="Contribution Amount" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={draft.contribution || ""}
                  onChange={(e) => {
                    const contribution = Number(e.target.value);
                    setDraft({ ...draft, contribution, currentAmount: Number(draft.previousAmount || 0) + contribution });
                  }}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
            <Field label="Current Amount" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={draft.currentAmount || ""}
                  onChange={(e) => setDraft({ ...draft, currentAmount: Number(e.target.value) })}
                  placeholder="0"
                  className={`${inputCls} pl-7`}
                />
              </div>
            </Field>
            <Field label="Progress Percentage" required>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={draft.progress || ""}
                onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label="Days Remaining" required>
              <input type="number" min={0} value={draft.daysLeft || ""} onChange={(e) => setDraft({ ...draft, daysLeft: Number(e.target.value) })} placeholder="0" className={inputCls} />
            </Field>
            <Field label="Projected Completion Date">
              <AppDatePicker value={draft.projectedDate} onChange={(e) => setDraft({ ...draft, projectedDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Status" className="md:col-span-2">
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TrackingRow["status"] })} className={selectCls}>
                {TRACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "On track" ? "On Track" : s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </ModalShell>
      )}

      {viewRow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Tracking Details</h3>
              <button onClick={() => setViewRow(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-2.5 text-sm">
              {(
                [
                  ["Goal", viewRow.goal],
                  ["Date", viewRow.date],
                  ["Contribution", money(viewRow.contribution)],
                  ["Current Amount", money(viewRow.currentAmount)],
                  ["Progress", viewRow.progress.toFixed(2) + "%"],
                  ["Days Left", String(viewRow.daysLeft)],
                  ["Projected Completion", viewRow.projectedDate || "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-50 pb-2">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-900 text-right">{v}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 pt-1">
                <span className="text-gray-500">Status</span>
                {chip(viewRow.status, STATUS_CHIP[viewRow.status])}
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirm what="Tracking Entry" name={`${deleteTarget.goal} · ${deleteTarget.date}`} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
