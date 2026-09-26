/**
 * Interviews — /api/v1/recruitment/interviews
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  searchCandidates,
  searchInterviewRounds,
  searchInterviewTypes,
  searchEmployees,
  INTERVIEW_STATUSES,
  type InterviewRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  scheduledDate: "",
  scheduledTime: "",
  duration: "60",
  location: "",
  meetingLink: "",
  status: "Scheduled",
  candidateId: "",
  candidateName: "",
  roundId: "",
  roundName: "",
  interviewTypeId: "",
  interviewTypeName: "",
  interviewerId: "",
  interviewerName: "",
});

export const Interviews: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<InterviewRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-interviews", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchInterviews({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("scheduled_date", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-interviews"] });

  const submit = async () => {
    if (!draft.candidateId || !draft.roundId || !draft.interviewTypeId || !draft.scheduledDate || !draft.scheduledTime) {
      showToast("Candidate, round, type, date and time are required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      candidate_id: draft.candidateId,
      round_id: draft.roundId,
      interview_type_id: draft.interviewTypeId,
      scheduled_date: draft.scheduledDate,
      scheduled_time: draft.scheduledTime,
      duration: draft.duration === "" ? undefined : Number(draft.duration),
      location: draft.location.trim() || undefined,
      meeting_link: draft.meetingLink.trim() || undefined,
      status: draft.status,
      interviewer_ids: draft.interviewerId ? [draft.interviewerId] : [],
    };
    try {
      if (modal === "edit") {
        await updateInterview(draft.id, body);
        showToast("Interview updated", "success");
      } else {
        await createInterview(body);
        showToast("Interview created", "success");
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
      await deleteInterview(deleteTarget.id);
      showToast("Interview deleted", "success");
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
        current="Interview"
        title="Manage Interviews"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search interviews…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...INTERVIEW_STATUSES]}
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
                  Date <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Time", "Candidate", "Round", "Type", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.scheduledDate || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.scheduledTime || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.candidateName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.roundName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.interviewTypeName || "—"}</td>
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
                          scheduledDate: r.scheduledDate,
                          scheduledTime: r.scheduledTime,
                          duration: r.duration == null ? "" : String(r.duration),
                          location: r.location,
                          meetingLink: r.meetingLink,
                          status: r.status || "Scheduled",
                          candidateId: r.candidateId,
                          candidateName: r.candidateName,
                          roundId: r.roundId,
                          roundName: r.roundName,
                          interviewTypeId: r.interviewTypeId,
                          interviewTypeName: r.interviewTypeName,
                          interviewerId: r.interviewerIds[0] || "",
                          interviewerName: r.interviewerNames[0] || "",
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
                  No interviews found.
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
          title={modal === "edit" ? "Edit Interview" : "Schedule Interview"}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Round" required>
                <AsyncSearchSelect
                  value={draft.roundId}
                  displayName={draft.roundName}
                  onChange={(id, opt) => setDraft({ ...draft, roundId: id, roundName: opt?.name || "" })}
                  onSearch={searchInterviewRounds}
                  placeholder="Search rounds…"
                />
              </Field>
              <Field label="Interview type" required>
                <AsyncSearchSelect
                  value={draft.interviewTypeId}
                  displayName={draft.interviewTypeName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, interviewTypeId: id, interviewTypeName: opt?.name || "" })
                  }
                  onSearch={searchInterviewTypes}
                  placeholder="Search types…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Date" required>
                <AppDatePicker
                  value={draft.scheduledDate}
                  onChange={(e) => setDraft({ ...draft, scheduledDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Time" required>
                <input
                  type="time"
                  value={draft.scheduledTime}
                  onChange={(e) => setDraft({ ...draft, scheduledTime: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Duration (min)">
                <input
                  type="number"
                  value={draft.duration}
                  onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Interviewer">
              <AsyncSearchSelect
                value={draft.interviewerId}
                displayName={draft.interviewerName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, interviewerId: id, interviewerName: opt?.name || "" })
                }
                onSearch={searchEmployees}
                placeholder="Search employees…"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Location">
                <input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {INTERVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Meeting link">
              <input
                value={draft.meetingLink}
                onChange={(e) => setDraft({ ...draft, meetingLink: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="interview"
          name={`${deleteTarget.candidateName} · ${deleteTarget.scheduledDate}`}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default Interviews;
