/**
 * Employee Reviews — /api/v1/performance/employee-reviews
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchEmployeeReviews,
  createEmployeeReview,
  updateEmployeeReview,
  deleteEmployeeReview,
  fetchReviewConduct,
  submitReviewConduct,
  searchReviewCycles,
  searchPerformanceUsers,
  REVIEW_STATUSES,
  type EmployeeReviewRow,
} from "@/services/performance";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, ClipboardList } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  employeeId: "",
  employeeName: "",
  reviewerId: "",
  reviewerName: "",
  cycleId: "",
  cycleName: "",
  reviewDate: "",
  status: "pending",
});

const REVIEW_STATUS_CHIP: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const labelStatus = (s: string) =>
  s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const EmployeeReviews: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<EmployeeReviewRow | null>(null);
  const [conductTarget, setConductTarget] = useState<EmployeeReviewRow | null>(null);
  const [conductIndicators, setConductIndicators] = useState<{ id: string; name: string }[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [conductLoading, setConductLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["performance-employee-reviews", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchEmployeeReviews({
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["performance-employee-reviews"] });

  const openConduct = async (row: EmployeeReviewRow) => {
    setConductTarget(row);
    setConductLoading(true);
    setRatings({});
    setPros(row.pros || "");
    setCons(row.cons || "");
    setConductIndicators([]);
    try {
      const res = await fetchReviewConduct(row.id);
      const payload = (res as any)?.data ?? res;
      const indicators = Array.isArray(payload?.indicators)
        ? payload.indicators
        : Array.isArray(payload?.data?.indicators)
          ? payload.data.indicators
          : [];
      const mapped = indicators.map((ind: any) => ({
        id: String(ind.id ?? ind._id ?? ""),
        name: String(ind.name ?? ind.title ?? "Indicator"),
      })).filter((i: { id: string }) => i.id);
      setConductIndicators(mapped);
      const existing: Record<string, number> = {};
      if (payload?.ratings && typeof payload.ratings === "object") {
        for (const [k, v] of Object.entries(payload.ratings)) {
          existing[k] = Number(v) || 0;
        }
      }
      setRatings(existing);
      if (typeof payload?.pros === "string") setPros(payload.pros);
      if (typeof payload?.cons === "string") setCons(payload.cons);
    } catch (e: any) {
      showToast(e?.message || "Failed to load conduct form", "error");
      setConductTarget(null);
    } finally {
      setConductLoading(false);
    }
  };

  const submitConduct = async () => {
    if (!conductTarget) return;
    try {
      await submitReviewConduct(conductTarget.id, {
        ratings,
        pros: pros.trim() || undefined,
        cons: cons.trim() || undefined,
      });
      showToast("Review submitted", "success");
      await invalidate();
      setConductTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to submit review", "error");
    }
  };

  const submit = async () => {
    if (!draft.employeeId || !draft.reviewerId || !draft.cycleId || !draft.reviewDate) {
      showToast("Employee, reviewer, cycle and date are required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      employee_user_id: draft.employeeId,
      reviewer_id: draft.reviewerId,
      review_cycle_id: draft.cycleId,
      review_date: draft.reviewDate,
      status: draft.status || "pending",
    };
    try {
      if (modal === "edit") {
        await updateEmployeeReview(draft.id, body);
        showToast("Review updated", "success");
      } else {
        await createEmployeeReview(body);
        showToast("Review created", "success");
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
      await deleteEmployeeReview(deleteTarget.id);
      showToast("Review deleted", "success");
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
        current="Employee Reviews"
        title="Manage Employee Reviews"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search reviews…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...REVIEW_STATUSES]}
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
                  Employee <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Reviewer", "Cycle", "Date", "Rating", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.employeeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.reviewerName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.cycleName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.reviewDate || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">
                  {r.averageRating > 0 ? r.averageRating.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3.5">
                  {chip(labelStatus(r.status), REVIEW_STATUS_CHIP[r.status] || "bg-gray-100 text-gray-600")}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void openConduct(r)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                      title="Conduct review"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          employeeId: r.employeeId,
                          employeeName: r.employeeName,
                          reviewerId: r.reviewerId,
                          reviewerName: r.reviewerName,
                          cycleId: r.cycleId,
                          cycleName: r.cycleName,
                          reviewDate: r.reviewDate,
                          status: r.status || "pending",
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
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No employee reviews found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Employee Review" : "Create Employee Review"}
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
            <Field label="Reviewer" required>
              <AsyncSearchSelect
                value={draft.reviewerId}
                displayName={draft.reviewerName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, reviewerId: id, reviewerName: opt?.name || "" })
                }
                onSearch={searchPerformanceUsers}
                placeholder="Search reviewers…"
              />
            </Field>
            <Field label="Review Cycle" required>
              <AsyncSearchSelect
                value={draft.cycleId}
                displayName={draft.cycleName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, cycleId: id, cycleName: opt?.name || "" })
                }
                onSearch={searchReviewCycles}
                placeholder="Search review cycles…"
              />
            </Field>
            <Field label="Review Date" required>
              <AppDatePicker
                value={draft.reviewDate}
                onChange={(e) => setDraft({ ...draft, reviewDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Status">
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className={selectCls}
              >
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelStatus(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </ModalShell>
      )}

      {conductTarget && (
        <ModalShell
          title={`Conduct Review — ${conductTarget.employeeName || "Employee"}`}
          onClose={() => setConductTarget(null)}
          onSubmit={submitConduct}
          submitLabel="Submit Review"
        >
          <div className="space-y-4">
            {conductLoading && <p className="text-sm text-gray-500">Loading indicators…</p>}
            {!conductLoading && conductIndicators.length === 0 && (
              <p className="text-sm text-gray-500">No indicators available for this review.</p>
            )}
            {conductIndicators.map((ind) => (
              <Field key={ind.id} label={ind.name} required>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={ratings[ind.id] ?? ""}
                  onChange={(e) =>
                    setRatings({ ...ratings, [ind.id]: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0–10"
                  className={inputCls}
                />
              </Field>
            ))}
            <Field label="Pros">
              <textarea
                value={pros}
                onChange={(e) => setPros(e.target.value)}
                rows={3}
                placeholder="Strengths"
                className={inputCls}
              />
            </Field>
            <Field label="Cons">
              <textarea
                value={cons}
                onChange={(e) => setCons(e.target.value)}
                rows={3}
                placeholder="Areas to improve"
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="employee review"
          name={deleteTarget.employeeName || deleteTarget.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default EmployeeReviews;
