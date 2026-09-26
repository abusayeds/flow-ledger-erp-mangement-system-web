/**
 * Interview Rounds — /api/v1/recruitment/interview-rounds
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchInterviewRounds,
  createInterviewRound,
  updateInterviewRound,
  deleteInterviewRound,
  searchJobPostings,
  INTERVIEW_ROUND_STATUSES,
  type InterviewRoundRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  name: "",
  sequenceNumber: "",
  description: "",
  status: "Active",
  jobId: "",
  jobName: "",
});

export const InterviewRounds: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<InterviewRoundRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-interview-rounds", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchInterviewRounds({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-interview-rounds"] });

  const submit = async () => {
    if (!draft.name.trim() || !draft.jobId) {
      showToast("Name and job posting are required", "error");
      return;
    }
    const body = {
      name: draft.name.trim(),
      job_id: draft.jobId,
      sequence_number: draft.sequenceNumber === "" ? undefined : Number(draft.sequenceNumber),
      description: draft.description.trim() || undefined,
      status: draft.status,
    };
    try {
      if (modal === "edit") {
        await updateInterviewRound(draft.id, body);
        showToast("Interview round updated", "success");
      } else {
        await createInterviewRound(body);
        showToast("Interview round created", "success");
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
      await deleteInterviewRound(deleteTarget.id);
      showToast("Interview round deleted", "success");
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
        current="Interview Rounds"
        title="Manage Interview Rounds"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search rounds…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...INTERVIEW_ROUND_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[900px]">
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
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Job", "Sequence", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.jobName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.sequenceNumber ?? "—"}</td>
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
                          name: r.name,
                          sequenceNumber: r.sequenceNumber == null ? "" : String(r.sequenceNumber),
                          description: r.description,
                          status: r.status || "Active",
                          jobId: r.jobId,
                          jobName: r.jobName,
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
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  No interview rounds found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Interview Round" : "Create Interview Round"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Job posting" required>
              <AsyncSearchSelect
                value={draft.jobId}
                displayName={draft.jobName}
                onChange={(id, opt) => setDraft({ ...draft, jobId: id, jobName: opt?.name || "" })}
                onSearch={searchJobPostings}
                placeholder="Search job postings…"
              />
            </Field>
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sequence">
                <input
                  type="number"
                  value={draft.sequenceNumber}
                  onChange={(e) => setDraft({ ...draft, sequenceNumber: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {INTERVIEW_ROUND_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                className={inputCls}
              />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="interview round"
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default InterviewRounds;
