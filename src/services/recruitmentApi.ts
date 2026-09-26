/**
 * Recruitment API — /api/v1/recruitment/*
 * Server search (searchTerm), filter, sort, page/limit on every list.
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";
import { searchBranches, searchDepartments, searchEmployees } from "./training";

export type RecListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string | boolean;
  is_active?: string | boolean;
  [key: string]: unknown;
};

const FALLBACK_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

const text = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
};

const idOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "_id" in v) return String((v as { _id: unknown })._id);
  if (typeof v === "object" && v !== null && "id" in v) return String((v as { id: unknown }).id);
  return "";
};

const nameOf = (
  v: unknown,
  fields: string[] = ["name", "title", "branch_name", "department_name", "first_name", "question", "task_name"],
): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    for (const f of fields) {
      if (typeof o[f] === "string" && o[f]) return String(o[f]);
    }
    // candidate-style: first + last
    const fn = text(o.first_name);
    const ln = text(o.last_name);
    if (fn || ln) return `${fn} ${ln}`.trim();
  }
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const bool = (v: unknown, fallback = true): boolean => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

async function listGet<T>(
  path: string,
  params: RecListParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status !== undefined && params.status !== "" && params.status !== "All") {
    query.status = params.status;
  }
  if (params.is_active !== undefined && params.is_active !== "" && params.is_active !== "All") {
    query.is_active = params.is_active;
  }
  for (const [k, v] of Object.entries(params)) {
    if (["page", "limit", "searchTerm", "sort", "status", "is_active"].includes(k)) continue;
    if (v !== undefined && v !== null && v !== "" && v !== "All") query[k] = v;
  }

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

export { searchBranches, searchDepartments, searchEmployees };

export const ACTIVE_INACTIVE = ["Active", "Inactive"] as const;
export const JOB_PRIORITIES = ["Low", "Medium", "High"] as const;
export const JOB_STATUSES = ["Draft", "Active", "Closed"] as const;
export const JOB_APPLICATION_TYPES = ["existing", "custom"] as const;
export const CANDIDATE_STATUSES = ["New", "Shortlisted", "Interview", "Offer", "Hired", "Rejected"] as const;
export const INTERVIEW_STATUSES = ["Scheduled", "Completed", "Cancelled"] as const;
export const INTERVIEW_ROUND_STATUSES = ["Active", "Inactive"] as const;
export const ASSESSMENT_PASS_FAIL = ["Pending", "Pass", "Fail"] as const;
export const FEEDBACK_RECOMMENDATIONS = [
  "Strong Hire",
  "Hire",
  "No Hire",
  "Maybe",
  "Reject",
  "Strong Reject",
] as const;
export const OFFER_STATUSES = ["Pending", "Sent", "Accepted", "Declined"] as const;
export const OFFER_APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export const ONBOARDING_STATUSES = ["Pending", "In Progress", "Completed"] as const;
export const QUESTION_TYPES = ["text", "textarea", "select", "radio", "checkbox", "date", "number"] as const;

/** Map Active/Inactive filter UI → boolean query value */
export const boolFilterValue = (label: string): boolean | undefined => {
  if (label === "Active") return true;
  if (label === "Inactive") return false;
  return undefined;
};

export const statusLabel = (active: boolean) => (active ? "Active" : "Inactive");

/* ── Job Locations ─────────────────────────────────────────────── */

export type JobLocationRow = {
  id: string;
  name: string;
  remoteWork: boolean;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  status: boolean;
  createdAt: string;
};

export const mapJobLocation = (d: any): JobLocationRow => ({
  id: idOf(d),
  name: text(d.name),
  remoteWork: bool(d.remote_work, false),
  address: text(d.address),
  city: text(d.city),
  state: text(d.state),
  country: text(d.country),
  postalCode: text(d.postal_code),
  status: bool(d.status, true),
  createdAt: day(d.createdAt),
});

export async function fetchJobLocations(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/job-locations/all", params);
  return { rows: rows.map(mapJobLocation), pagination };
}

export async function createJobLocation(body: Record<string, unknown>) {
  return api.post("/recruitment/job-locations/create", body);
}

export async function updateJobLocation(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/job-locations/edit/${id}`, body);
}

export async function deleteJobLocation(id: string) {
  return api.delete(`/recruitment/job-locations/delete/${id}`);
}

export async function searchJobLocations(q: string) {
  const { rows } = await fetchJobLocations({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
    status: true,
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Job Types ─────────────────────────────────────────────────── */

export type JobTypeRow = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

export const mapJobType = (d: any): JobTypeRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  isActive: bool(d.is_active, true),
  createdAt: day(d.createdAt),
});

export async function fetchJobTypes(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/job-types/all", params);
  return { rows: rows.map(mapJobType), pagination };
}

export async function createJobType(body: { name: string; description?: string; is_active?: boolean }) {
  return api.post("/recruitment/job-types/create", body);
}

export async function updateJobType(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/job-types/edit/${id}`, body);
}

export async function deleteJobType(id: string) {
  return api.delete(`/recruitment/job-types/delete/${id}`);
}

export async function searchJobTypes(q: string) {
  const { rows } = await fetchJobTypes({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
    is_active: true,
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Candidate Sources ─────────────────────────────────────────── */

export type CandidateSourceRow = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

export const mapCandidateSource = (d: any): CandidateSourceRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  isActive: bool(d.is_active, true),
  createdAt: day(d.createdAt),
});

export async function fetchCandidateSources(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/candidate-sources/all", params);
  return { rows: rows.map(mapCandidateSource), pagination };
}

export async function createCandidateSource(body: { name: string; description?: string; is_active?: boolean }) {
  return api.post("/recruitment/candidate-sources/create", body);
}

export async function updateCandidateSource(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/candidate-sources/edit/${id}`, body);
}

export async function deleteCandidateSource(id: string) {
  return api.delete(`/recruitment/candidate-sources/delete/${id}`);
}

export async function searchCandidateSources(q: string) {
  const { rows } = await fetchCandidateSources({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
    is_active: true,
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Interview Types ───────────────────────────────────────────── */

export type InterviewTypeRow = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
};

export const mapInterviewType = (d: any): InterviewTypeRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  isActive: bool(d.is_active, true),
  createdAt: day(d.createdAt),
});

export async function fetchInterviewTypes(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/interview-types/all", params);
  return { rows: rows.map(mapInterviewType), pagination };
}

export async function createInterviewType(body: { name: string; description?: string; is_active?: boolean }) {
  return api.post("/recruitment/interview-types/create", body);
}

export async function updateInterviewType(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/interview-types/edit/${id}`, body);
}

export async function deleteInterviewType(id: string) {
  return api.delete(`/recruitment/interview-types/delete/${id}`);
}

export async function searchInterviewTypes(q: string) {
  const { rows } = await fetchInterviewTypes({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
    is_active: true,
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Custom Questions ──────────────────────────────────────────── */

export type CustomQuestionRow = {
  id: string;
  question: string;
  type: string;
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: string;
};

export const mapCustomQuestion = (d: any): CustomQuestionRow => ({
  id: idOf(d),
  question: text(d.question),
  type: text(d.type) || "text",
  options: Array.isArray(d.options) ? d.options.map(String) : [],
  isRequired: bool(d.is_required, false),
  isActive: bool(d.is_active, true),
  sortOrder: d.sort_order == null ? null : num(d.sort_order),
  createdAt: day(d.createdAt),
});

export async function fetchCustomQuestions(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/custom-questions/all", params);
  return { rows: rows.map(mapCustomQuestion), pagination };
}

export async function createCustomQuestion(body: Record<string, unknown>) {
  return api.post("/recruitment/custom-questions/create", body);
}

export async function updateCustomQuestion(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/custom-questions/edit/${id}`, body);
}

export async function deleteCustomQuestion(id: string) {
  return api.delete(`/recruitment/custom-questions/delete/${id}`);
}

export async function searchCustomQuestions(q: string) {
  const { rows } = await fetchCustomQuestions({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "sort_order,_id",
    is_active: true,
  });
  return rows.map((r) => ({ id: r.id, name: r.question }));
}

/* ── Interview Rounds ──────────────────────────────────────────── */

export type InterviewRoundRow = {
  id: string;
  name: string;
  sequenceNumber: number | null;
  description: string;
  status: string;
  jobId: string;
  jobName: string;
  createdAt: string;
};

export const mapInterviewRound = (d: any): InterviewRoundRow => {
  const job = d.job_id ?? d.job_posting;
  return {
    id: idOf(d),
    name: text(d.name),
    sequenceNumber: d.sequence_number == null ? null : num(d.sequence_number),
    description: text(d.description),
    status: text(d.status) || "Active",
    jobId: idOf(job),
    jobName: nameOf(job, ["title", "name"]) || nameOf(d.job_posting),
    createdAt: day(d.createdAt),
  };
};

export async function fetchInterviewRounds(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/interview-rounds/all", params);
  return { rows: rows.map(mapInterviewRound), pagination };
}

export async function createInterviewRound(body: Record<string, unknown>) {
  return api.post("/recruitment/interview-rounds/create", body);
}

export async function updateInterviewRound(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/interview-rounds/edit/${id}`, body);
}

export async function deleteInterviewRound(id: string) {
  return api.delete(`/recruitment/interview-rounds/delete/${id}`);
}

export async function searchInterviewRounds(q: string) {
  const { rows } = await fetchInterviewRounds({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "sequence_number,_id",
  });
  return rows.map((r) => ({ id: r.id, name: r.jobName ? `${r.name} (${r.jobName})` : r.name }));
}

/* ── Onboarding Checklists ─────────────────────────────────────── */

export type OnboardingChecklistRow = {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  status: boolean;
  createdAt: string;
};

export const mapOnboardingChecklist = (d: any): OnboardingChecklistRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  isDefault: bool(d.is_default, false),
  status: bool(d.status, true),
  createdAt: day(d.createdAt),
});

export async function fetchOnboardingChecklists(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/onboarding-checklists/all", params);
  return { rows: rows.map(mapOnboardingChecklist), pagination };
}

export async function createOnboardingChecklist(body: Record<string, unknown>) {
  return api.post("/recruitment/onboarding-checklists/create", body);
}

export async function updateOnboardingChecklist(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/onboarding-checklists/edit/${id}`, body);
}

export async function deleteOnboardingChecklist(id: string) {
  return api.delete(`/recruitment/onboarding-checklists/delete/${id}`);
}

export async function searchOnboardingChecklists(q: string) {
  const { rows } = await fetchOnboardingChecklists({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "name,_id",
    status: true,
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Checklist Items ───────────────────────────────────────────── */

export type ChecklistItemRow = {
  id: string;
  taskName: string;
  description: string;
  category: string;
  assignedToRole: string;
  dueDay: number | null;
  isRequired: boolean;
  status: boolean;
  checklistId: string;
  checklistName: string;
  createdAt: string;
};

export const mapChecklistItem = (d: any): ChecklistItemRow => {
  const cl = d.checklist_id;
  return {
    id: idOf(d),
    taskName: text(d.task_name),
    description: text(d.description),
    category: text(d.category),
    assignedToRole: text(d.assigned_to_role),
    dueDay: d.due_day == null ? null : num(d.due_day),
    isRequired: bool(d.is_required, false),
    status: bool(d.status, true),
    checklistId: idOf(cl),
    checklistName: nameOf(cl),
    createdAt: day(d.createdAt),
  };
};

export async function fetchChecklistItems(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/checklist-items/all", params);
  return { rows: rows.map(mapChecklistItem), pagination };
}

export async function createChecklistItem(body: Record<string, unknown>) {
  return api.post("/recruitment/checklist-items/create", body);
}

export async function updateChecklistItem(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/checklist-items/edit/${id}`, body);
}

export async function deleteChecklistItem(id: string) {
  return api.delete(`/recruitment/checklist-items/delete/${id}`);
}

/* ── Job Postings ──────────────────────────────────────────────── */

export type JobPostingRow = {
  id: string;
  code: string;
  postingCode: string;
  title: string;
  position: number | null;
  priority: string;
  jobApplication: string;
  applicationUrl: string;
  branchId: string;
  branchName: string;
  jobTypeId: string;
  jobTypeName: string;
  locationId: string;
  locationName: string;
  minExperience: number | null;
  maxExperience: number | null;
  minSalary: number | null;
  maxSalary: number | null;
  description: string;
  requirements: string;
  skills: string[];
  benefits: string;
  termsCondition: string;
  showTermsCondition: boolean;
  applicationDeadline: string;
  isPublished: boolean;
  publishDate: string;
  isFeatured: boolean;
  status: string;
  customQuestionIds: string[];
  createdAt: string;
};

export const mapJobPosting = (d: any): JobPostingRow => {
  const branch = d.branch_id;
  const jt = d.job_type_id;
  const loc = d.location_id;
  const cqs = Array.isArray(d.custom_questions) ? d.custom_questions : [];
  return {
    id: idOf(d),
    code: text(d.code),
    postingCode: text(d.posting_code),
    title: text(d.title),
    position: d.position == null ? null : num(d.position),
    priority: text(d.priority) || "Medium",
    jobApplication: text(d.job_application) || "existing",
    applicationUrl: text(d.application_url),
    branchId: idOf(branch),
    branchName: nameOf(branch, ["branch_name", "name"]),
    jobTypeId: idOf(jt),
    jobTypeName: nameOf(jt),
    locationId: idOf(loc),
    locationName: nameOf(loc),
    minExperience: d.min_experience == null ? null : num(d.min_experience),
    maxExperience: d.max_experience == null ? null : num(d.max_experience),
    minSalary: d.min_salary == null ? null : num(d.min_salary),
    maxSalary: d.max_salary == null ? null : num(d.max_salary),
    description: text(d.description),
    requirements: text(d.requirements),
    skills: Array.isArray(d.skills) ? d.skills.map(String) : [],
    benefits: text(d.benefits),
    termsCondition: text(d.terms_condition),
    showTermsCondition: bool(d.show_terms_condition, false),
    applicationDeadline: text(d.application_deadline) || day(d.application_deadline),
    isPublished: bool(d.is_published, false),
    publishDate: text(d.publish_date) || day(d.publish_date),
    isFeatured: bool(d.is_featured, false),
    status: text(d.status) || "Draft",
    customQuestionIds: cqs.map((q: any) => idOf(q)).filter(Boolean),
    createdAt: day(d.createdAt),
  };
};

export async function fetchJobPostings(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/job-postings/all", params);
  return { rows: rows.map(mapJobPosting), pagination };
}

export async function createJobPosting(body: Record<string, unknown>) {
  return api.post("/recruitment/job-postings/create", body);
}

export async function updateJobPosting(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/job-postings/edit/${id}`, body);
}

export async function deleteJobPosting(id: string) {
  return api.delete(`/recruitment/job-postings/delete/${id}`);
}

export async function togglePublishJobPosting(id: string) {
  return api.patch(`/recruitment/job-postings/toggle-publish/${id}`, {});
}

export async function searchJobPostings(q: string) {
  const { rows } = await fetchJobPostings({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "title,_id",
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.postingCode ? `${r.title} (${r.postingCode})` : r.title,
  }));
}

/* ── Candidates ────────────────────────────────────────────────── */

export type CandidateRow = {
  id: string;
  trackingId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dob: string;
  country: string;
  state: string;
  city: string;
  currentCompany: string;
  currentPosition: string;
  experienceYears: number | null;
  currentSalary: number | null;
  expectedSalary: number | null;
  noticePeriod: string;
  skills: string;
  education: string;
  portfolioUrl: string;
  linkedinUrl: string;
  status: string;
  applicationDate: string;
  jobId: string;
  jobName: string;
  sourceId: string;
  sourceName: string;
  createdAt: string;
};

export const mapCandidate = (d: any): CandidateRow => {
  const job = d.job_id;
  const source = d.source_id;
  const firstName = text(d.first_name);
  const lastName = text(d.last_name);
  return {
    id: idOf(d),
    trackingId: text(d.tracking_id),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: text(d.email),
    phone: text(d.phone),
    gender: text(d.gender),
    dob: day(d.dob),
    country: text(d.country),
    state: text(d.state),
    city: text(d.city),
    currentCompany: text(d.current_company),
    currentPosition: text(d.current_position),
    experienceYears: d.experience_years == null ? null : num(d.experience_years),
    currentSalary: d.current_salary == null ? null : num(d.current_salary),
    expectedSalary: d.expected_salary == null ? null : num(d.expected_salary),
    noticePeriod: text(d.notice_period),
    skills: text(d.skills),
    education: text(d.education),
    portfolioUrl: text(d.portfolio_url),
    linkedinUrl: text(d.linkedin_url),
    status: text(d.status) || "New",
    applicationDate: day(d.application_date),
    jobId: idOf(job),
    jobName: nameOf(job, ["title", "name"]),
    sourceId: idOf(source),
    sourceName: nameOf(source),
    createdAt: day(d.createdAt),
  };
};

export async function fetchCandidates(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/candidates/all", params);
  return { rows: rows.map(mapCandidate), pagination };
}

export async function createCandidate(body: Record<string, unknown>) {
  return api.post("/recruitment/candidates/create", body);
}

export async function updateCandidate(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/candidates/edit/${id}`, body);
}

export async function updateCandidateStatus(id: string, status: string) {
  return api.patch(`/recruitment/candidates/update-status/${id}`, { status });
}

export async function deleteCandidate(id: string) {
  return api.delete(`/recruitment/candidates/delete/${id}`);
}

export async function searchCandidates(q: string) {
  const { rows } = await fetchCandidates({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "first_name,_id",
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.trackingId ? `${r.fullName} (${r.trackingId})` : r.fullName || r.email,
  }));
}

/* ── Interviews ────────────────────────────────────────────────── */

export type InterviewRow = {
  id: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number | null;
  location: string;
  meetingLink: string;
  status: string;
  feedbackSubmitted: boolean;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobName: string;
  roundId: string;
  roundName: string;
  interviewTypeId: string;
  interviewTypeName: string;
  interviewerIds: string[];
  interviewerNames: string[];
  createdAt: string;
};

export const mapInterview = (d: any): InterviewRow => {
  const candidate = d.candidate_id;
  const job = d.job_id;
  const round = d.round_id;
  const itype = d.interview_type_id;
  const interviewers = Array.isArray(d.interviewer_ids) ? d.interviewer_ids : [];
  return {
    id: idOf(d),
    scheduledDate: text(d.scheduled_date) || day(d.scheduled_date),
    scheduledTime: text(d.scheduled_time),
    duration: d.duration == null ? null : num(d.duration),
    location: text(d.location),
    meetingLink: text(d.meeting_link),
    status: text(d.status) || "Scheduled",
    feedbackSubmitted: bool(d.feedback_submitted, false),
    candidateId: idOf(candidate),
    candidateName: nameOf(candidate) || nameOf(candidate, ["first_name"]),
    jobId: idOf(job),
    jobName: nameOf(job, ["title", "name"]),
    roundId: idOf(round),
    roundName: nameOf(round),
    interviewTypeId: idOf(itype),
    interviewTypeName: nameOf(itype),
    interviewerIds: interviewers.map((u: any) => idOf(u)).filter(Boolean),
    interviewerNames: interviewers.map((u: any) => nameOf(u)).filter(Boolean),
    createdAt: day(d.createdAt),
  };
};

export async function fetchInterviews(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/interviews/all", params);
  return { rows: rows.map(mapInterview), pagination };
}

export async function createInterview(body: Record<string, unknown>) {
  return api.post("/recruitment/interviews/create", body);
}

export async function updateInterview(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/interviews/edit/${id}`, body);
}

export async function deleteInterview(id: string) {
  return api.delete(`/recruitment/interviews/delete/${id}`);
}

export async function searchInterviews(q: string) {
  const { rows } = await fetchInterviews({
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "-scheduled_date,_id",
  });
  return rows.map((r) => ({
    id: r.id,
    name: [r.candidateName, r.scheduledDate, r.scheduledTime].filter(Boolean).join(" · ") || r.id,
  }));
}

/* ── Interview Feedback ────────────────────────────────────────── */

export type InterviewFeedbackRow = {
  id: string;
  technicalRating: number | null;
  communicationRating: number | null;
  culturalFitRating: number | null;
  overallRating: number | null;
  strengths: string;
  weaknesses: string;
  comments: string;
  recommendation: string;
  interviewId: string;
  candidateName: string;
  jobName: string;
  interviewerNames: string[];
  createdAt: string;
};

export const mapInterviewFeedback = (d: any): InterviewFeedbackRow => {
  const interview = d.interview ?? {};
  const cand = interview.candidate;
  const job = interview.job_posting;
  return {
    id: idOf(d),
    technicalRating: d.technical_rating == null ? null : num(d.technical_rating),
    communicationRating: d.communication_rating == null ? null : num(d.communication_rating),
    culturalFitRating: d.cultural_fit_rating == null ? null : num(d.cultural_fit_rating),
    overallRating: d.overall_rating == null ? null : num(d.overall_rating),
    strengths: text(d.strengths),
    weaknesses: text(d.weaknesses),
    comments: text(d.comments),
    recommendation: text(d.recommendation),
    interviewId: idOf(d.interview_id),
    candidateName: cand
      ? `${text(cand.first_name)} ${text(cand.last_name)}`.trim()
      : "",
    jobName: nameOf(job),
    interviewerNames: Array.isArray(d.interviewer_names) ? d.interviewer_names.map(String) : [],
    createdAt: day(d.createdAt),
  };
};

export async function fetchInterviewFeedbacks(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/interview-feedbacks/all", params);
  return { rows: rows.map(mapInterviewFeedback), pagination };
}

export async function createInterviewFeedback(body: Record<string, unknown>) {
  return api.post("/recruitment/interview-feedbacks/create", body);
}

export async function updateInterviewFeedback(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/interview-feedbacks/edit/${id}`, body);
}

export async function deleteInterviewFeedback(id: string) {
  return api.delete(`/recruitment/interview-feedbacks/delete/${id}`);
}

/* ── Candidate Assessments ─────────────────────────────────────── */

export type CandidateAssessmentRow = {
  id: string;
  assessmentName: string;
  score: number | null;
  maxScore: number | null;
  passFailStatus: string;
  comments: string;
  assessmentDate: string;
  candidateId: string;
  conductedById: string;
  conductedByName: string;
  createdAt: string;
};

export const mapCandidateAssessment = (d: any): CandidateAssessmentRow => {
  const conducted = d.conducted_by;
  return {
    id: idOf(d),
    assessmentName: text(d.assessment_name),
    score: d.score == null ? null : num(d.score),
    maxScore: d.max_score == null ? null : num(d.max_score),
    passFailStatus: text(d.pass_fail_status) || "Pending",
    comments: text(d.comments),
    assessmentDate: day(d.assessment_date),
    candidateId: idOf(d.candidate_id),
    conductedById: idOf(conducted),
    conductedByName: nameOf(conducted),
    createdAt: day(d.createdAt),
  };
};

export async function fetchCandidateAssessments(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/candidate-assessments/all", params);
  return { rows: rows.map(mapCandidateAssessment), pagination };
}

export async function createCandidateAssessment(body: Record<string, unknown>) {
  return api.post("/recruitment/candidate-assessments/create", body);
}

export async function updateCandidateAssessment(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/candidate-assessments/edit/${id}`, body);
}

export async function deleteCandidateAssessment(id: string) {
  return api.delete(`/recruitment/candidate-assessments/delete/${id}`);
}

/* ── Offers ────────────────────────────────────────────────────── */

export type OfferRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobName: string;
  offerDate: string;
  position: string;
  departmentId: string;
  departmentName: string;
  salary: number;
  bonus: number | null;
  equity: string;
  benefits: string;
  startDate: string;
  expirationDate: string;
  status: string;
  approvalStatus: string;
  convertedToEmployee: boolean;
  downloadUrl: string;
  createdAt: string;
};

export const mapOffer = (d: any): OfferRow => {
  const cand = d.candidate_id;
  const job = d.job_id;
  const dept = d.department_id;
  return {
    id: idOf(d),
    candidateId: idOf(cand),
    candidateName: nameOf(cand),
    jobId: idOf(job),
    jobName: nameOf(job, ["title", "name"]),
    offerDate: day(d.offer_date),
    position: text(d.position),
    departmentId: idOf(dept),
    departmentName: nameOf(dept, ["department_name", "name"]),
    salary: num(d.salary),
    bonus: d.bonus == null ? null : num(d.bonus),
    equity: text(d.equity),
    benefits: text(d.benefits),
    startDate: day(d.start_date),
    expirationDate: day(d.expiration_date),
    status: text(d.status) || "Pending",
    approvalStatus: text(d.approval_status) || "Pending",
    convertedToEmployee: bool(d.converted_to_employee, false),
    downloadUrl: text(d.download_url),
    createdAt: day(d.createdAt),
  };
};

export async function fetchOffers(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/offers/all", params);
  return { rows: rows.map(mapOffer), pagination };
}

export async function createOffer(body: Record<string, unknown>) {
  return api.post("/recruitment/offers/create", body);
}

export async function updateOffer(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/offers/edit/${id}`, body);
}

export async function deleteOffer(id: string) {
  return api.delete(`/recruitment/offers/delete/${id}`);
}

export async function updateOfferApproval(id: string, approval_status: string) {
  return api.patch(`/recruitment/offers/approval-status/${id}`, { approval_status });
}

export async function sendOfferEmail(id: string) {
  return api.post(`/recruitment/offers/send-email/${id}`, {});
}

export async function convertOfferToEmployee(id: string, body: Record<string, unknown> = {}) {
  return api.post(`/recruitment/offers/convert-to-employee/${id}`, body);
}

/* ── Candidate Onboarding ──────────────────────────────────────── */

export type CandidateOnboardingRow = {
  id: string;
  startDate: string;
  status: string;
  candidateId: string;
  candidateName: string;
  checklistId: string;
  checklistName: string;
  buddyEmployeeId: string;
  buddyEmployeeName: string;
  createdAt: string;
};

export const mapCandidateOnboarding = (d: any): CandidateOnboardingRow => {
  const cand = d.candidate_id;
  const cl = d.checklist_id;
  const buddy = d.buddy_employee_id;
  return {
    id: idOf(d),
    startDate: day(d.start_date),
    status: text(d.status) || "Pending",
    candidateId: idOf(cand),
    candidateName: nameOf(cand),
    checklistId: idOf(cl),
    checklistName: nameOf(cl),
    buddyEmployeeId: idOf(buddy),
    buddyEmployeeName: nameOf(buddy),
    createdAt: day(d.createdAt),
  };
};

export async function fetchCandidateOnboardings(params?: RecListParams) {
  const { rows, pagination } = await listGet<any>("/recruitment/candidate-onboardings/all", params);
  return { rows: rows.map(mapCandidateOnboarding), pagination };
}

export async function createCandidateOnboarding(body: Record<string, unknown>) {
  return api.post("/recruitment/candidate-onboardings/create", body);
}

export async function updateCandidateOnboarding(id: string, body: Record<string, unknown>) {
  return api.patch(`/recruitment/candidate-onboardings/edit/${id}`, body);
}

export async function deleteCandidateOnboarding(id: string) {
  return api.delete(`/recruitment/candidate-onboardings/delete/${id}`);
}

/* ── Settings ──────────────────────────────────────────────────── */

async function getSetting(path: string) {
  const res = await api.raw.get(`/recruitment/settings/${path}`);
  return res.data?.data ?? null;
}

async function saveSetting(path: string, body: unknown) {
  return api.post(`/recruitment/settings/${path}`, body);
}

export const getBrandSettings = () => getSetting("brand-settings");
export const saveBrandSettings = (body: unknown) => saveSetting("brand-settings", body);
export const getAboutCompany = () => getSetting("about-company");
export const saveAboutCompany = (body: unknown) => saveSetting("about-company", body);
export const getApplicationTips = () => getSetting("application-tips");
export const saveApplicationTips = (body: unknown) => saveSetting("application-tips", body);
export const getWhatHappensNext = () => getSetting("what-happens-next");
export const saveWhatHappensNext = (body: unknown) => saveSetting("what-happens-next", body);
export const getNeedHelp = () => getSetting("need-help");
export const saveNeedHelp = (body: unknown) => saveSetting("need-help", body);
export const getTrackingFaq = () => getSetting("tracking-faq");
export const saveTrackingFaq = (body: unknown) => saveSetting("tracking-faq", body);
export const getOfferLetterTemplate = () => getSetting("offer-letter-template");
export const saveOfferLetterTemplate = (body: unknown) => saveSetting("offer-letter-template", body);
export const getOfferLetterPlaceholders = () => getSetting("offer-letter-placeholders");

export async function fetchRecruitmentDashboard(): Promise<RecruitmentDashboardPayload> {
  try {
    const data = await api.get<unknown>("/dashboard/recruitment");
    return normalizeRecruitmentDashboard(data);
  } catch {
    const res = await api.raw.get("/recruitment/dashboard");
    return normalizeRecruitmentDashboard(res.data?.data ?? res.data ?? null);
  }
}

export type RecruitmentDashboardPayload = {
  stats: {
    total_candidates: number;
    open_positions: number;
    interviews: number;
    hired: number;
  };
  statusOverview: { name: string; value: number; color: string }[];
  hiringFunnel: { stage: string; candidates: number; percentage: number; color: string }[];
  onboardingProgress: { name: string; value: number; color: string }[];
  upcomingInterviews: {
    candidate: string;
    position: string;
    date: string;
    time: string;
    status: string;
    avatar?: string;
  }[];
  recentCandidates: {
    name: string;
    position: string;
    stage: string;
    appliedDate: string;
    avatar?: string;
  }[];
  openPositions: {
    title: string;
    department: string;
    applicants: number;
    daysOpen: number;
    priority: string;
  }[];
};

const emptyRecruitmentStats: RecruitmentDashboardPayload["stats"] = {
  total_candidates: 0,
  open_positions: 0,
  interviews: 0,
  hired: 0,
};

const fmtDay = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

function normalizeRecruitmentDashboard(raw: unknown): RecruitmentDashboardPayload {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const overview = (d.overview && typeof d.overview === "object" ? d.overview : {}) as Record<string, any>;
  const byStatus = (d.candidatesByStatus && typeof d.candidatesByStatus === "object"
    ? d.candidatesByStatus
    : {}) as Record<string, any>;
  const onb = (d.onboardingStatus && typeof d.onboardingStatus === "object"
    ? d.onboardingStatus
    : {}) as Record<string, any>;
  const funnelObj = (d.hiringFunnel && typeof d.hiringFunnel === "object" && !Array.isArray(d.hiringFunnel)
    ? d.hiringFunnel
    : null) as Record<string, any> | null;
  const activities = (d.recentActivities && typeof d.recentActivities === "object"
    ? d.recentActivities
    : {}) as Record<string, any>;

  // Already UI-shaped (legacy /recruitment/dashboard)
  if (d.stats || Array.isArray(d.statusOverview) || Array.isArray(d.hiringFunnel)) {
    const s = (d.stats && typeof d.stats === "object" ? d.stats : {}) as Record<string, any>;
    return {
      stats: {
        ...emptyRecruitmentStats,
        total_candidates: Number(s.total_candidates) || 0,
        open_positions: Number(s.open_positions) || 0,
        interviews: Number(s.interviews) || 0,
        hired: Number(s.hired) || 0,
      },
      statusOverview: Array.isArray(d.statusOverview) ? d.statusOverview : [],
      hiringFunnel: Array.isArray(d.hiringFunnel) ? d.hiringFunnel : [],
      onboardingProgress: Array.isArray(d.onboardingProgress) ? d.onboardingProgress : [],
      upcomingInterviews: Array.isArray(d.upcomingInterviews) ? d.upcomingInterviews : [],
      recentCandidates: Array.isArray(d.recentCandidates) ? d.recentCandidates : [],
      openPositions: Array.isArray(d.openPositions) ? d.openPositions : [],
    };
  }

  // Hub /dashboard/recruitment (company)
  const applied = Number(byStatus.applied) || 0;
  const shortlisted = Number(byStatus.shortlisted) || 0;
  const interviewScheduled = Number(byStatus.interviewScheduled) || 0;
  const hired = Number(byStatus.hired) || 0;
  const rejected = Number(byStatus.rejected) || 0;
  const total =
    Number(overview.totalCandidates) ||
    applied + shortlisted + interviewScheduled + hired + rejected;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const statusOverview = [
    { name: "Applied", value: applied, color: "#3B82F6" },
    { name: "Shortlisted", value: shortlisted, color: "#10B981" },
    { name: "Interview", value: interviewScheduled, color: "#F59E0B" },
    { name: "Hired", value: hired, color: "#6B7280" },
    ...(rejected ? [{ name: "Rejected", value: rejected, color: "#EF4444" }] : []),
  ];

  const hiringFunnel = funnelObj
    ? [
        {
          stage: "Applications",
          candidates: Number(funnelObj.applications) || total,
          percentage: 100,
          color: "#3B82F6",
        },
        {
          stage: "Shortlisted",
          candidates: Number(funnelObj.shortlisted) || shortlisted,
          percentage: pct(Number(funnelObj.shortlisted) || shortlisted),
          color: "#10B981",
        },
        {
          stage: "Interviewed",
          candidates: Number(funnelObj.interviewed) || interviewScheduled,
          percentage: pct(Number(funnelObj.interviewed) || interviewScheduled),
          color: "#F59E0B",
        },
        {
          stage: "Hired",
          candidates: Number(funnelObj.hired) || hired,
          percentage: pct(Number(funnelObj.hired) || hired),
          color: "#6B7280",
        },
      ]
    : [];

  const onboardingProgress = [
    { name: "Completed", value: Number(onb.completed) || 0, color: "#10B981" },
    { name: "In Progress", value: Number(onb.inProgress) || 0, color: "#3B82F6" },
    { name: "Pending", value: Number(onb.pending) || 0, color: "#F59E0B" },
  ];

  const upcomingSrc = Array.isArray(activities.upcomingInterviews)
    ? activities.upcomingInterviews
    : Array.isArray(d.calendarEvents)
      ? d.calendarEvents
      : [];
  const upcomingInterviews = upcomingSrc.map((iv: any) => ({
    candidate: String(iv.candidate || iv.candidate_name || iv.title || "Candidate"),
    position: String(iv.position || iv.role || iv.job_title || "—"),
    date: fmtDay(iv.date ?? iv.scheduled_date),
    time: String(iv.time || iv.scheduled_time || ""),
    status: String(iv.status || "scheduled").toLowerCase(),
    avatar: iv.avatar || undefined,
  }));

  const recentSrc = Array.isArray(activities.latestCandidates) ? activities.latestCandidates : [];
  const recentCandidates = recentSrc.map((c: any) => ({
    name: String(c.name || "—"),
    position: String(c.position || "—"),
    stage: String(c.status || c.stage || "New"),
    appliedDate: fmtDay(c.date ?? c.appliedDate ?? c.application_date),
    avatar: c.avatar || undefined,
  }));

  const jobsSrc = Array.isArray(d.jobPostings) ? d.jobPostings : [];
  const openPositions = jobsSrc.map((p: any) => ({
    title: String(p.title || "—"),
    department: String(p.department || "—"),
    applicants: Number(p.applicants) || 0,
    daysOpen: Number(p.daysOpen) || 0,
    priority: String(p.priority || "Low"),
  }));

  return {
    stats: {
      total_candidates: total,
      open_positions: Number(overview.activeJobPostings) || openPositions.length,
      interviews: Number(overview.pendingInterviews) || upcomingInterviews.length,
      hired,
    },
    statusOverview,
    hiringFunnel,
    onboardingProgress,
    upcomingInterviews,
    recentCandidates,
    openPositions,
  };
}
