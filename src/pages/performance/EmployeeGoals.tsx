/**
 * Employee Goals — /api/v1/performance/employee-goals
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchEmployeeGoals,
  createEmployeeGoal,
  updateEmployeeGoal,
  deleteEmployeeGoal,
  searchGoalTypes,
  searchPerformanceUsers,
  GOAL_STATUSES,
  type EmployeeGoalRow,
} from "@/services/performance";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  employeeId: "",
  employeeName: "",
  goalTypeId: "",
  goalTypeName: "",
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  target: "",
  progress: "0",
  status: "not_started",
});

const GOAL_STATUS_CHIP: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-600",
};

const labelStatus = (s: string) =>
  s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const EmployeeGoals: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<EmployeeGoalRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["performance-employee-goals", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchEmployeeGoals({
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["performance-employee-goals"] });

  const submit = async () => {
    if (!draft.employeeId || !draft.goalTypeId || !draft.title.trim() || !draft.startDate || !draft.endDate || !draft.target.trim()) {
      showToast("Employee, goal type, title, dates and target are required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      employee_id: draft.employeeId,
      goal_type_id: draft.goalTypeId,
      title: draft.title.trim(),
      start_date: draft.startDate,
      end_date: draft.endDate,
      target: draft.target.trim(),
      description: draft.description.trim() || undefined,
      progress: Number(draft.progress) || 0,
      status: draft.status || "not_started",
    };
    try {
      if (modal === "edit") {
        await updateEmployeeGoal(draft.id, body);
        showToast("Goal updated", "success");
      } else {
        await createEmployeeGoal(body);
        showToast("Goal created", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployeeGoal(deleteTarget.id);
      showToast("Goal deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Performance"
        current="Employee Goals"
        title="Manage Employee Goals"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search goals…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...GOAL_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setSortAsc(!sortAsc);
                    setPage(1);
                  }}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Title <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Employee", "Goal Type", "Period", "Target", "Progress", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.title}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.employeeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.goalTypeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                  {r.startDate || "—"} → {r.endDate || "—"}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.target || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.progress}%</td>
                <td className="px-4 py-3.5">
                  {chip(labelStatus(r.status), GOAL_STATUS_CHIP[r.status] || "bg-gray-100 text-gray-600")}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          employeeId: r.employeeId,
                          employeeName: r.employeeName,
                          goalTypeId: r.goalTypeId,
                          goalTypeName: r.goalTypeName,
                          title: r.title,
                          description: r.description,
                          startDate: r.startDate,
                          endDate: r.endDate,
                          target: r.target,
                          progress: String(r.progress ?? 0),
                          status: r.status || "not_started",
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No employee goals found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Employee Goal" : "Create Employee Goal"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Employee" required>
              <AsyncSearchSelect
                value={draft.employeeId}
                displayName={draft.employeeName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, employeeId: id, employeeName: opt?.name || "" })
                }
                onSearch={searchPerformanceUsers}
                placeholder="Search employees…"
              />
            </Field>
            <Field label="Goal Type" required>
              <AsyncSearchSelect
                value={draft.goalTypeId}
                displayName={draft.goalTypeName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, goalTypeId: id, goalTypeName: opt?.name || "" })
                }
                onSearch={searchGoalTypes}
                placeholder="Search goal types…"
              />
            </Field>
            <Field label="Title" required>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Enter goal title"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start Date" required>
                <AppDatePicker
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="End Date" required>
                <AppDatePicker
                  value={draft.endDate}
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Target" required>
              <input
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                placeholder="Enter target"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Progress (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.progress}
                  onChange={(e) => setDraft({ ...draft, progress: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {GOAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {labelStatus(s)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                placeholder="Optional description"
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="employee goal"
          name={deleteTarget.title}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default EmployeeGoals;
