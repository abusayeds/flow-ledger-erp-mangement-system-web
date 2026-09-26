/**
 * Offers — /api/v1/recruitment/offers
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  updateOfferApproval,
  sendOfferEmail,
  convertOfferToEmployee,
  searchCandidates,
  searchJobPostings,
  searchDepartments,
  OFFER_STATUSES,
  type OfferRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Mail, Check, UserPlus } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  candidateId: "",
  candidateName: "",
  jobId: "",
  jobName: "",
  departmentId: "",
  departmentName: "",
  offerDate: "",
  position: "",
  salary: "",
  bonus: "",
  equity: "",
  benefits: "",
  startDate: "",
  expirationDate: "",
  status: "Pending",
});

export const Offers: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<OfferRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-offers", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchOffers({
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-offers"] });

  const submit = async () => {
    if (
      !draft.candidateId ||
      !draft.offerDate ||
      !draft.position.trim() ||
      !draft.salary ||
      !draft.startDate ||
      !draft.expirationDate
    ) {
      showToast("Candidate, position, salary and dates are required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      candidate_id: draft.candidateId,
      job_id: draft.jobId || undefined,
      department_id: draft.departmentId || undefined,
      offer_date: draft.offerDate,
      position: draft.position.trim(),
      salary: Number(draft.salary),
      bonus: draft.bonus === "" ? undefined : Number(draft.bonus),
      equity: draft.equity.trim() || undefined,
      benefits: draft.benefits.trim() || undefined,
      start_date: draft.startDate,
      expiration_date: draft.expirationDate,
      status: draft.status,
    };
    try {
      if (modal === "edit") {
        await updateOffer(draft.id, body);
        showToast("Offer updated", "success");
      } else {
        await createOffer(body);
        showToast("Offer created", "success");
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
      await deleteOffer(deleteTarget.id);
      showToast("Offer deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      showToast(label, "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Action failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Recruitment"
        current="Offers"
        title="Manage Offers"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search offers…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...OFFER_STATUSES]}
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
                  Candidate <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Position", "Salary", "Status", "Approval", "Start", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.candidateName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.position}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.salary.toLocaleString()}</td>
                <td className="px-4 py-3.5">
                  {chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.approvalStatus}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.startDate || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      title="Approve"
                      onClick={() =>
                        void runAction("Offer approved", () => updateOfferApproval(r.id, "Approved"))
                      }
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Send email"
                      onClick={() => void runAction("Offer email sent", () => sendOfferEmail(r.id))}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    {!r.convertedToEmployee && (
                      <button
                        type="button"
                        title="Convert to employee"
                        onClick={() =>
                          void runAction("Converted to employee", () => convertOfferToEmployee(r.id))
                        }
                        className="p-1.5 text-gray-400 hover:text-violet-600 rounded hover:bg-violet-50"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          candidateId: r.candidateId,
                          candidateName: r.candidateName,
                          jobId: r.jobId,
                          jobName: r.jobName,
                          departmentId: r.departmentId,
                          departmentName: r.departmentName,
                          offerDate: r.offerDate,
                          position: r.position,
                          salary: String(r.salary || ""),
                          bonus: r.bonus == null ? "" : String(r.bonus),
                          equity: r.equity,
                          benefits: r.benefits,
                          startDate: r.startDate,
                          expirationDate: r.expirationDate,
                          status: r.status || "Pending",
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
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
                  No offers found.
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
          title={modal === "edit" ? "Edit Offer" : "Create Offer"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <Field label="Candidate" required>
              <AsyncSearchSelect
                value={draft.candidateId}
                displayName={draft.candidateName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, candidateId: id, candidateName: opt?.name || "" })
                }
                onSearch={searchCandidates}
                placeholder="Search candidates…"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Job posting">
                <AsyncSearchSelect
                  value={draft.jobId}
                  displayName={draft.jobName}
                  onChange={(id, opt) => setDraft({ ...draft, jobId: id, jobName: opt?.name || "" })}
                  onSearch={searchJobPostings}
                  placeholder="Search jobs…"
                />
              </Field>
              <Field label="Department">
                <AsyncSearchSelect
                  value={draft.departmentId}
                  displayName={draft.departmentName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, departmentId: id, departmentName: opt?.name || "" })
                  }
                  onSearch={searchDepartments}
                  placeholder="Search departments…"
                />
              </Field>
            </div>
            <Field label="Position" required>
              <input
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Salary" required>
                <input
                  type="number"
                  value={draft.salary}
                  onChange={(e) => setDraft({ ...draft, salary: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Bonus">
                <input
                  type="number"
                  value={draft.bonus}
                  onChange={(e) => setDraft({ ...draft, bonus: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {OFFER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Offer date" required>
                <AppDatePicker
                  value={draft.offerDate}
                  onChange={(e) => setDraft({ ...draft, offerDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Start date" required>
                <AppDatePicker
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Expiration" required>
                <AppDatePicker
                  value={draft.expirationDate}
                  onChange={(e) => setDraft({ ...draft, expirationDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Equity">
              <input
                value={draft.equity}
                onChange={(e) => setDraft({ ...draft, equity: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Benefits">
              <textarea
                value={draft.benefits}
                onChange={(e) => setDraft({ ...draft, benefits: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="offer"
          name={`${deleteTarget.candidateName} · ${deleteTarget.position}`}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default Offers;
