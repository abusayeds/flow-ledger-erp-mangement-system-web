/**
 * Candidates — /api/v1/recruitment/candidates
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchCandidates,
  createCandidate,
  updateCandidate,
  updateCandidateStatus,
  deleteCandidate,
  searchJobPostings,
  searchCandidateSources,
  CANDIDATE_STATUSES,
  type CandidateRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const emptyDraft = () => ({
  id: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  gender: "",
  dob: "",
  country: "",
  state: "",
  city: "",
    currentCompany: "",
    currentPosition: "",
  experienceYears: "",
  currentSalary: "",
  expectedSalary: "",
    noticePeriod: "",
  skills: "",
    education: "",
    portfolioUrl: "",
    linkedinUrl: "",
  status: "New",
  applicationDate: "",
  jobId: "",
  jobName: "",
  sourceId: "",
  sourceName: "",
});

export const Candidates: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<CandidateRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-candidates", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchCandidates({
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
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-candidates"] });

  const submit = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.email.trim() || !draft.jobId || !draft.sourceId) {
      showToast("Name, email, job and source are required", "error");
      return;
    }
    const body: Record<string, unknown> = {
      first_name: draft.firstName.trim(),
      last_name: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim() || undefined,
      gender: draft.gender.trim() || undefined,
      dob: draft.dob || undefined,
      country: draft.country.trim() || undefined,
      state: draft.state.trim() || undefined,
      city: draft.city.trim() || undefined,
      current_company: draft.currentCompany.trim() || undefined,
      current_position: draft.currentPosition.trim() || undefined,
      experience_years: draft.experienceYears === "" ? undefined : Number(draft.experienceYears),
      current_salary: draft.currentSalary === "" ? undefined : Number(draft.currentSalary),
      expected_salary: draft.expectedSalary === "" ? undefined : Number(draft.expectedSalary),
      notice_period: draft.noticePeriod.trim() || undefined,
      skills: draft.skills.trim() || undefined,
      education: draft.education.trim() || undefined,
      portfolio_url: draft.portfolioUrl.trim() || undefined,
      linkedin_url: draft.linkedinUrl.trim() || undefined,
      status: draft.status,
      application_date: draft.applicationDate || undefined,
      job_id: draft.jobId,
      source_id: draft.sourceId,
    };
    try {
      if (modal === "edit") {
        await updateCandidate(draft.id, body);
        showToast("Candidate updated", "success");
      } else {
        await createCandidate(body);
        showToast("Candidate created", "success");
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
      await deleteCandidate(deleteTarget.id);
      showToast("Candidate deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const onStatusChange = async (row: CandidateRow, status: string) => {
    try {
      await updateCandidateStatus(row.id, status);
      showToast("Status updated", "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Status update failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Recruitment"
        current="Candidates"
        title="Manage Candidates"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search candidates…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...CANDIDATE_STATUSES]}
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
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Tracking", "Email", "Job", "Source", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.fullName}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.trackingId || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.email}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.jobName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.sourceName || "—"}</td>
                <td className="px-4 py-3.5">
                  <select
                    value={r.status}
                    onChange={(e) => void onStatusChange(r, e.target.value)}
                    className={`${selectCls} py-1 text-xs min-w-[8rem]`}
                  >
                    {CANDIDATE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          firstName: r.firstName,
                          lastName: r.lastName,
                          email: r.email,
                          phone: r.phone,
                          gender: r.gender,
                          dob: r.dob,
                          country: r.country,
                          state: r.state,
                          city: r.city,
                          currentCompany: r.currentCompany,
                          currentPosition: r.currentPosition,
                          experienceYears: r.experienceYears == null ? "" : String(r.experienceYears),
                          currentSalary: r.currentSalary == null ? "" : String(r.currentSalary),
                          expectedSalary: r.expectedSalary == null ? "" : String(r.expectedSalary),
                          noticePeriod: r.noticePeriod,
                          skills: r.skills,
                          education: r.education,
                          portfolioUrl: r.portfolioUrl,
                          linkedinUrl: r.linkedinUrl,
                          status: r.status,
                          applicationDate: r.applicationDate,
                          jobId: r.jobId,
                          jobName: r.jobName,
                          sourceId: r.sourceId,
                          sourceName: r.sourceName,
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
                    No candidates found.
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
          title={modal === "edit" ? "Edit Candidate" : "Create Candidate"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First name" required>
                <input
                  value={draft.firstName}
                  onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Last name" required>
                <input
                  value={draft.lastName}
                  onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" required>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className={inputCls}
                />
              </Field>
        </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Job posting" required>
                <AsyncSearchSelect
                  value={draft.jobId}
                  displayName={draft.jobName}
                  onChange={(id, opt) => setDraft({ ...draft, jobId: id, jobName: opt?.name || "" })}
                  onSearch={searchJobPostings}
                  placeholder="Search jobs…"
                />
              </Field>
              <Field label="Source" required>
                <AsyncSearchSelect
                  value={draft.sourceId}
                  displayName={draft.sourceName}
                  onChange={(id, opt) => setDraft({ ...draft, sourceId: id, sourceName: opt?.name || "" })}
                  onSearch={searchCandidateSources}
                  placeholder="Search sources…"
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {CANDIDATE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Application date">
                <AppDatePicker
                  value={draft.applicationDate}
                  onChange={(e) => setDraft({ ...draft, applicationDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
      </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Gender">
                <input
                  value={draft.gender}
                  onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="DOB">
                <AppDatePicker
                  value={draft.dob}
                  onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Experience (years)">
                <input
                  type="number"
                  value={draft.experienceYears}
                  onChange={(e) => setDraft({ ...draft, experienceYears: e.target.value })}
                  className={inputCls}
                />
              </Field>
          </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Country">
                <input
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <input
                  value={draft.state}
                  onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="City">
                <input
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  className={inputCls}
                />
              </Field>
        </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Current company">
                <input
                  value={draft.currentCompany}
                  onChange={(e) => setDraft({ ...draft, currentCompany: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Current position">
                <input
                  value={draft.currentPosition}
                  onChange={(e) => setDraft({ ...draft, currentPosition: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Current salary">
                <input
                  type="number"
                  value={draft.currentSalary}
                  onChange={(e) => setDraft({ ...draft, currentSalary: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Expected salary">
                <input
                  type="number"
                  value={draft.expectedSalary}
                  onChange={(e) => setDraft({ ...draft, expectedSalary: e.target.value })}
                  className={inputCls}
                />
              </Field>
      </div>
            <Field label="Skills">
              <input
                value={draft.skills}
                onChange={(e) => setDraft({ ...draft, skills: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Education">
              <input
                value={draft.education}
                onChange={(e) => setDraft({ ...draft, education: e.target.value })}
                className={inputCls}
              />
            </Field>
    </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="candidate"
          name={deleteTarget.fullName}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default Candidates;
