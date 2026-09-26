/**
 * Candidate Onboarding — /api/v1/recruitment/candidate-onboardings
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchCandidateOnboardings,
  createCandidateOnboarding,
  updateCandidateOnboarding,
  deleteCandidateOnboarding,
  searchCandidates,
  searchOnboardingChecklists,
  searchEmployees,
  ONBOARDING_STATUSES,
  type CandidateOnboardingRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  startDate: "",
  status: "Pending",
  candidateId: "",
  candidateName: "",
  checklistId: "",
  checklistName: "",
  buddyEmployeeId: "",
  buddyEmployeeName: "",
});

export const CandidateOnboarding: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<CandidateOnboardingRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-onboardings", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchCandidateOnboardings({
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-onboardings"] });

  const submit = async () => {
    if (!draft.candidateId || !draft.checklistId || !draft.startDate) {
      showToast("Candidate, checklist and start date are required", "error");
      return;
    }
    const body = {
      candidate_id: draft.candidateId,
      checklist_id: draft.checklistId,
      start_date: draft.startDate,
      status: draft.status,
      buddy_employee_id: draft.buddyEmployeeId || undefined,
    };
    try {
      if (modal === "edit") {
        await updateCandidateOnboarding(draft.id, body);
        showToast("Onboarding updated", "success");
      } else {
        await createCandidateOnboarding(body);
        showToast("Onboarding created", "success");
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
      await deleteCandidateOnboarding(deleteTarget.id);
      showToast("Onboarding deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Recruitment"
        current="Candidate Onboarding"
        title="Manage Candidate Onboarding"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search onboarding…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...ONBOARDING_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[1000px]">
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
              {["Checklist", "Buddy", "Start", "Status", "Actions"].map((h) => (
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
                <td className="px-4 py-3.5 text-gray-600">{r.checklistName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.buddyEmployeeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.startDate || "—"}</td>
                <td className="px-4 py-3.5">
                  {chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          startDate: r.startDate,
                          status: r.status || "Pending",
                          candidateId: r.candidateId,
                          candidateName: r.candidateName,
                          checklistId: r.checklistId,
                          checklistName: r.checklistName,
                          buddyEmployeeId: r.buddyEmployeeId,
                          buddyEmployeeName: r.buddyEmployeeName,
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
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No onboarding records found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Onboarding" : "Create Onboarding"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
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
            <Field label="Checklist" required>
              <AsyncSearchSelect
                value={draft.checklistId}
                displayName={draft.checklistName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, checklistId: id, checklistName: opt?.name || "" })
                }
                onSearch={searchOnboardingChecklists}
                placeholder="Search checklists…"
              />
            </Field>
            <Field label="Buddy employee">
              <AsyncSearchSelect
                value={draft.buddyEmployeeId}
                displayName={draft.buddyEmployeeName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, buddyEmployeeId: id, buddyEmployeeName: opt?.name || "" })
                }
                onSearch={searchEmployees}
                placeholder="Search employees…"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start date" required>
                <AppDatePicker
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {ONBOARDING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="onboarding"
          name={deleteTarget.candidateName || deleteTarget.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default CandidateOnboarding;
