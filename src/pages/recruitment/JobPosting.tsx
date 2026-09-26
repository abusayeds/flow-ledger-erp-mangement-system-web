/**
 * Job Postings — /api/v1/recruitment/job-postings
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchJobPostings,
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  togglePublishJobPosting,
  fetchCustomQuestions,
  searchBranches,
  searchJobTypes,
  searchJobLocations,
  JOB_PRIORITIES,
  JOB_STATUSES,
  JOB_APPLICATION_TYPES,
  type JobPostingRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
  title: "",
  priority: "Medium",
  jobApplication: "existing",
  applicationUrl: "",
  branchId: "",
  branchName: "",
  jobTypeId: "",
  jobTypeName: "",
  locationId: "",
  locationName: "",
  position: "",
  minExperience: "",
  maxExperience: "",
  minSalary: "",
  maxSalary: "",
  description: "",
  requirements: "",
  skillsText: "",
  benefits: "",
  termsCondition: "",
  showTermsCondition: false,
  applicationDeadline: "",
  isFeatured: false,
  status: "Draft",
  customQuestionIds: [] as string[],
});

export const JobPostings: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<JobPostingRow | null>(null);
  const [questionOptions, setQuestionOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!modal) return;
    void fetchCustomQuestions({ page: 1, limit: 100, sort: "sort_order,_id", is_active: true }).then(
      (res) => setQuestionOptions(res.rows.map((r) => ({ id: r.id, name: r.question }))),
    );
  }, [modal]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-job-postings", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchJobPostings({
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-job-postings"] });

  const submit = async () => {
    if (!draft.title.trim() || !draft.branchId || !draft.jobTypeId || !draft.locationId) {
      showToast("Title, branch, job type and location are required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      title: draft.title.trim(),
      priority: draft.priority,
      job_application: draft.jobApplication,
      application_url: draft.applicationUrl.trim() || undefined,
      branch_id: draft.branchId,
      job_type_id: draft.jobTypeId,
      location_id: draft.locationId,
      position: draft.position === "" ? undefined : Number(draft.position),
      min_experience: draft.minExperience === "" ? undefined : Number(draft.minExperience),
      max_experience: draft.maxExperience === "" ? undefined : Number(draft.maxExperience),
      min_salary: draft.minSalary === "" ? undefined : Number(draft.minSalary),
      max_salary: draft.maxSalary === "" ? undefined : Number(draft.maxSalary),
      description: draft.description.trim() || undefined,
      requirements: draft.requirements.trim() || undefined,
      skills: draft.skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      benefits: draft.benefits.trim() || undefined,
      terms_condition: draft.termsCondition.trim() || undefined,
      show_terms_condition: draft.showTermsCondition,
      application_deadline: draft.applicationDeadline || undefined,
      is_featured: draft.isFeatured,
      status: draft.status,
      custom_questions: draft.customQuestionIds,
    };
    try {
      if (modal === "edit") {
        await updateJobPosting(draft.id, body);
        showToast("Job posting updated", "success");
      } else {
        await createJobPosting(body);
        showToast("Job posting created", "success");
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
      await deleteJobPosting(deleteTarget.id);
      showToast("Job posting deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const onTogglePublish = async (row: JobPostingRow) => {
    try {
      await togglePublishJobPosting(row.id);
      showToast(row.isPublished ? "Unpublished" : "Published", "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Toggle failed", "error");
    }
  };

  const openEdit = (r: JobPostingRow) => {
    setDraft({
      id: r.id,
      title: r.title,
      priority: r.priority || "Medium",
      jobApplication: r.jobApplication || "existing",
      applicationUrl: r.applicationUrl,
      branchId: r.branchId,
      branchName: r.branchName,
      jobTypeId: r.jobTypeId,
      jobTypeName: r.jobTypeName,
      locationId: r.locationId,
      locationName: r.locationName,
      position: r.position == null ? "" : String(r.position),
      minExperience: r.minExperience == null ? "" : String(r.minExperience),
      maxExperience: r.maxExperience == null ? "" : String(r.maxExperience),
      minSalary: r.minSalary == null ? "" : String(r.minSalary),
      maxSalary: r.maxSalary == null ? "" : String(r.maxSalary),
      description: r.description,
      requirements: r.requirements,
      skillsText: r.skills.join(", "),
      benefits: r.benefits,
      termsCondition: r.termsCondition,
      showTermsCondition: r.showTermsCondition,
      applicationDeadline: r.applicationDeadline?.slice(0, 10) || "",
      isFeatured: r.isFeatured,
      status: r.status || "Draft",
      customQuestionIds: r.customQuestionIds,
    });
    setModal("edit");
  };

  return (
    <>
      <ListShell
        module="Recruitment"
        current="Job Postings"
        title="Manage Job Postings"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search job postings…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...JOB_STATUSES]}
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
              {["Code", "Type", "Location", "Priority", "Status", "Published", "Actions"].map((h) => (
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
                <td className="px-4 py-3.5 text-gray-600">{r.postingCode || r.code || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.jobTypeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.locationName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.priority}</td>
                <td className="px-4 py-3.5">
                  {chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.isPublished ? "Yes" : "No"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void onTogglePublish(r)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                      title="Toggle publish"
                    >
                      {r.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
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
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No job postings found.
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
          title={modal === "edit" ? "Edit Job Posting" : "Create Job Posting"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <Field label="Title" required>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Branch" required>
                <AsyncSearchSelect
                  value={draft.branchId}
                  displayName={draft.branchName}
                  onChange={(id, opt) => setDraft({ ...draft, branchId: id, branchName: opt?.name || "" })}
                  onSearch={searchBranches}
                  placeholder="Search branches…"
                />
              </Field>
              <Field label="Job type" required>
                <AsyncSearchSelect
                  value={draft.jobTypeId}
                  displayName={draft.jobTypeName}
                  onChange={(id, opt) => setDraft({ ...draft, jobTypeId: id, jobTypeName: opt?.name || "" })}
                  onSearch={searchJobTypes}
                  placeholder="Search job types…"
                />
              </Field>
              <Field label="Location" required>
                <AsyncSearchSelect
                  value={draft.locationId}
                  displayName={draft.locationName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, locationId: id, locationName: opt?.name || "" })
                  }
                  onSearch={searchJobLocations}
                  placeholder="Search locations…"
                />
              </Field>
              <Field label="Priority">
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  className={selectCls}
                >
                  {JOB_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Application type">
                <select
                  value={draft.jobApplication}
                  onChange={(e) => setDraft({ ...draft, jobApplication: e.target.value })}
                  className={selectCls}
                >
                  {JOB_APPLICATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Application URL">
              <input
                value={draft.applicationUrl}
                onChange={(e) => setDraft({ ...draft, applicationUrl: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Min exp">
                <input
                  type="number"
                  value={draft.minExperience}
                  onChange={(e) => setDraft({ ...draft, minExperience: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Max exp">
                <input
                  type="number"
                  value={draft.maxExperience}
                  onChange={(e) => setDraft({ ...draft, maxExperience: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Min salary">
                <input
                  type="number"
                  value={draft.minSalary}
                  onChange={(e) => setDraft({ ...draft, minSalary: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Max salary">
                <input
                  type="number"
                  value={draft.maxSalary}
                  onChange={(e) => setDraft({ ...draft, maxSalary: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Skills" hint="Comma-separated">
              <input
                value={draft.skillsText}
                onChange={(e) => setDraft({ ...draft, skillsText: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                className={inputCls}
              />
            </Field>
            <Field label="Requirements">
              <textarea
                value={draft.requirements}
                onChange={(e) => setDraft({ ...draft, requirements: e.target.value })}
                rows={2}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Deadline">
                <AppDatePicker
                  value={draft.applicationDeadline}
                  onChange={(e) => setDraft({ ...draft, applicationDeadline: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Featured">
                <select
                  value={draft.isFeatured ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, isFeatured: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
            </div>
            <Field label="Custom questions">
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
                {questionOptions.length === 0 && (
                  <p className="text-xs text-gray-400 px-1 py-2">No active questions</p>
                )}
                {questionOptions.map((q) => {
                  const checked = draft.customQuestionIds.includes(q.id);
                  return (
                    <label key={q.id} className="flex items-start gap-2 text-sm text-gray-700 px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            customQuestionIds: checked
                              ? draft.customQuestionIds.filter((id) => id !== q.id)
                              : [...draft.customQuestionIds, q.id],
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>{q.name}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="job posting"
          name={deleteTarget.title}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default JobPostings;
