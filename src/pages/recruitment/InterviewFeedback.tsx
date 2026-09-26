/**
 * Interview Feedback — /api/v1/recruitment/interview-feedbacks
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchInterviewFeedbacks,
  createInterviewFeedback,
  updateInterviewFeedback,
  deleteInterviewFeedback,
  searchInterviews,
  FEEDBACK_RECOMMENDATIONS,
  type InterviewFeedbackRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  interviewId: "",
  interviewName: "",
  technicalRating: "3",
  communicationRating: "3",
  culturalFitRating: "3",
  overallRating: "3",
  strengths: "",
  weaknesses: "",
  comments: "",
  recommendation: "Maybe",
});

export const InterviewFeedback: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [recFilter, setRecFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<InterviewFeedbackRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-interview-feedbacks", page, perPage, search, sortAsc, recFilter],
    queryFn: () =>
      fetchInterviewFeedbacks({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
        recommendation: recFilter === "All" ? undefined : recFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-interview-feedbacks"] });

  const submit = async () => {
    if (!draft.interviewId || !draft.recommendation) {
      showToast("Interview and recommendation are required", "error");
      return;
    }
    const body = {
      interview_id: draft.interviewId,
      technical_rating: Number(draft.technicalRating),
      communication_rating: Number(draft.communicationRating),
      cultural_fit_rating: Number(draft.culturalFitRating),
      overall_rating: Number(draft.overallRating),
      strengths: draft.strengths.trim() || undefined,
      weaknesses: draft.weaknesses.trim() || undefined,
      comments: draft.comments.trim() || undefined,
      recommendation: draft.recommendation,
    };
    try {
      if (modal === "edit") {
        await updateInterviewFeedback(draft.id, body);
        showToast("Feedback updated", "success");
      } else {
        await createInterviewFeedback(body);
        showToast("Feedback created", "success");
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
      await deleteInterviewFeedback(deleteTarget.id);
      showToast("Feedback deleted", "success");
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
        current="Interview Feedback"
        title="Manage Interview Feedback"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search feedback…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...FEEDBACK_RECOMMENDATIONS]}
        filterValue={recFilter}
        setFilterValue={setRecFilter}
        filterLabel="Recommendation"
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
              {["Job", "Overall", "Recommendation", "Interviewers", "Actions"].map((h) => (
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
                <td className="px-4 py-3.5 text-gray-600">{r.jobName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.overallRating ?? "—"}</td>
                <td className="px-4 py-3.5">{chip(r.recommendation, "bg-blue-50 text-blue-700")}</td>
                <td className="px-4 py-3.5 text-gray-600 max-w-[180px] truncate">
                  {r.interviewerNames.join(", ") || "—"}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          interviewId: r.interviewId,
                          interviewName: [r.candidateName, r.jobName].filter(Boolean).join(" · "),
                          technicalRating: String(r.technicalRating ?? 3),
                          communicationRating: String(r.communicationRating ?? 3),
                          culturalFitRating: String(r.culturalFitRating ?? 3),
                          overallRating: String(r.overallRating ?? 3),
                          strengths: r.strengths,
                          weaknesses: r.weaknesses,
                          comments: r.comments,
                          recommendation: r.recommendation || "Maybe",
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
                  No feedback found.
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
          title={modal === "edit" ? "Edit Feedback" : "Create Feedback"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Interview" required>
              <AsyncSearchSelect
                value={draft.interviewId}
                displayName={draft.interviewName}
                onChange={(id, opt) =>
                  setDraft({ ...draft, interviewId: id, interviewName: opt?.name || "" })
                }
                onSearch={searchInterviews}
                placeholder="Search interviews…"
              />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(
                [
                  ["technicalRating", "Technical"],
                  ["communicationRating", "Communication"],
                  ["culturalFitRating", "Culture fit"],
                  ["overallRating", "Overall"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
            <Field label="Recommendation" required>
              <select
                value={draft.recommendation}
                onChange={(e) => setDraft({ ...draft, recommendation: e.target.value })}
                className={selectCls}
              >
                {FEEDBACK_RECOMMENDATIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Strengths">
              <textarea
                value={draft.strengths}
                onChange={(e) => setDraft({ ...draft, strengths: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Weaknesses">
              <textarea
                value={draft.weaknesses}
                onChange={(e) => setDraft({ ...draft, weaknesses: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="Comments">
              <textarea
                value={draft.comments}
                onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="feedback"
          name={deleteTarget.candidateName || deleteTarget.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default InterviewFeedback;
