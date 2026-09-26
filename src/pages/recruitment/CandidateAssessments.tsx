/**
 * Candidate Assessments — /api/v1/recruitment/candidate-assessments
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchCandidateAssessments,
  createCandidateAssessment,
  updateCandidateAssessment,
  deleteCandidateAssessment,
  searchCandidates,
  searchEmployees,
  ASSESSMENT_PASS_FAIL,
  type CandidateAssessmentRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  assessmentName: "",
  score: "",
  maxScore: "",
  passFailStatus: "Pending",
  comments: "",
  assessmentDate: "",
  candidateId: "",
  candidateName: "",
  conductedById: "",
  conductedByName: "",
});

export const CandidateAssessments: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<CandidateAssessmentRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-assessments", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchCandidateAssessments({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
        pass_fail_status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-assessments"] });

  const submit = async () => {
    if (!draft.assessmentName.trim()) {
      showToast("Assessment name is required", "error");
      return;
    }
    const body = {
      assessment_name: draft.assessmentName.trim(),
      score: draft.score === "" ? undefined : Number(draft.score),
      max_score: draft.maxScore === "" ? undefined : Number(draft.maxScore),
      pass_fail_status: draft.passFailStatus,
      comments: draft.comments.trim() || undefined,
      assessment_date: draft.assessmentDate || undefined,
      candidate_id: draft.candidateId || undefined,
      conducted_by: draft.conductedById || undefined,
    };
    try {
      if (modal === "edit") {
        await updateCandidateAssessment(draft.id, body);
        showToast("Assessment updated", "success");
      } else {
        await createCandidateAssessment(body);
        showToast("Assessment created", "success");
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
      await deleteCandidateAssessment(deleteTarget.id);
      showToast("Assessment deleted", "success");
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
        current="Candidate Assessments"
        title="Manage Candidate Assessments"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search assessments…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...ASSESSMENT_PASS_FAIL]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Result"
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
                  Assessment <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Score", "Result", "Conducted by", "Date", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.assessmentName}</td>
                <td className="px-4 py-3.5 text-gray-600">
                  {r.score == null ? "—" : `${r.score}${r.maxScore != null ? ` / ${r.maxScore}` : ""}`}
                </td>
                <td className="px-4 py-3.5">
                  {chip(r.passFailStatus, STATUS_CHIP[r.passFailStatus] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.conductedByName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.assessmentDate || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          assessmentName: r.assessmentName,
                          score: r.score == null ? "" : String(r.score),
                          maxScore: r.maxScore == null ? "" : String(r.maxScore),
                          passFailStatus: r.passFailStatus || "Pending",
                          comments: r.comments,
                          assessmentDate: r.assessmentDate,
                          candidateId: r.candidateId,
                          candidateName: "",
                          conductedById: r.conductedById,
                          conductedByName: r.conductedByName,
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
                  No assessments found.
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
          title={modal === "edit" ? "Edit Assessment" : "Create Assessment"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Assessment name" required>
              <input
                value={draft.assessmentName}
                onChange={(e) => setDraft({ ...draft, assessmentName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Candidate">
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
              <Field label="Conducted by">
                <AsyncSearchSelect
                  value={draft.conductedById}
                  displayName={draft.conductedByName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, conductedById: id, conductedByName: opt?.name || "" })
                  }
                  onSearch={searchEmployees}
                  placeholder="Search employees…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Score">
                <input
                  type="number"
                  value={draft.score}
                  onChange={(e) => setDraft({ ...draft, score: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Max score">
                <input
                  type="number"
                  value={draft.maxScore}
                  onChange={(e) => setDraft({ ...draft, maxScore: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Result">
                <select
                  value={draft.passFailStatus}
                  onChange={(e) => setDraft({ ...draft, passFailStatus: e.target.value })}
                  className={selectCls}
                >
                  {ASSESSMENT_PASS_FAIL.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Date">
              <AppDatePicker
                value={draft.assessmentDate}
                onChange={(e) => setDraft({ ...draft, assessmentDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Comments">
              <textarea
                value={draft.comments}
                onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
                rows={3}
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="assessment"
          name={deleteTarget.assessmentName}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default CandidateAssessments;
