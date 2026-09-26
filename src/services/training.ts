/**
 * Training module API — /api/v1/training/*
 * Goal-style list helpers with searchTerm / sort / page / limit.
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type TrainingListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  branch_id?: string;
  department_id?: string;
  training_type_id?: string;
  trainer_id?: string;
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

const nameOf = (v: unknown, fields: string[] = ["name", "branch_name", "department_name", "title"]): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    for (const f of fields) {
      if (typeof o[f] === "string" && o[f]) return String(o[f]);
    }
  }
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");

async function listGet<T>(
  path: string,
  params: TrainingListParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status.toLowerCase();
  if (params.branch_id) query.branch_id = params.branch_id;
  if (params.department_id) query.department_id = params.department_id;
  if (params.training_type_id) query.training_type_id = params.training_type_id;
  if (params.trainer_id) query.trainer_id = params.trainer_id;

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

/* ── HRM searchable helpers ───────────────────────────────────── */

export async function searchBranches(q: string) {
  const { rows } = await listGet<any>("/hrm/setup/branches", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    sort: "branch_name,_id",
  });
  return rows.map((b) => ({
    id: idOf(b),
    name: text(b.branch_name) || text(b.name),
  }));
}

export async function searchDepartments(q: string, branchId?: string) {
  const { rows } = await listGet<any>("/hrm/setup/departments", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
    branch_id: branchId,
    sort: "department_name,_id",
  });
  return rows.map((d) => ({
    id: idOf(d),
    name: text(d.department_name) || text(d.name),
  }));
}

export async function searchEmployees(q: string) {
  const { rows } = await listGet<any>("/hrm/employees", {
    page: 1,
    limit: 30,
    searchTerm: q || undefined,
  });
  return rows
    .map((e) => {
      const userId =
        idOf(e.employee_user_id) ||
        idOf(e.user_id) ||
        (typeof e.employee_user_id === "string" ? e.employee_user_id : "") ||
        idOf(e);
      const name =
        nameOf(e.employee_user_id) ||
        nameOf(e.user_id) ||
        text(e.name) ||
        text(e.employee_name) ||
        text(e.email);
      return { id: userId, name: name || "Employee" };
    })
    .filter((r) => r.id);
}

/* ── Training Types ───────────────────────────────────────────── */

export type TrainingTypeRow = {
  id: string;
  name: string;
  description: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  createdAt: string;
};

export const mapTrainingType = (d: any): TrainingTypeRow => ({
  id: idOf(d),
  name: text(d.name),
  description: text(d.description),
  branchId: idOf(d.branch_id),
  branchName: nameOf(d.branch_id, ["branch_name", "name"]),
  departmentId: idOf(d.department_id),
  departmentName: nameOf(d.department_id, ["department_name", "name"]),
  createdAt: day(d.createdAt),
});

export async function fetchTrainingTypes(params?: TrainingListParams) {
  const { rows, pagination } = await listGet<any>("/training/training-types/all", params);
  return { rows: rows.map(mapTrainingType), pagination };
}

export async function createTrainingType(body: {
  name: string;
  description?: string;
  branch_id: string;
  department_id: string;
}) {
  return api.post("/training/training-types/create", body);
}

export async function updateTrainingType(
  id: string,
  body: Partial<{ name: string; description: string; branch_id: string; department_id: string }>,
) {
  return api.patch(`/training/training-types/edit/${id}`, body);
}

export async function deleteTrainingType(id: string) {
  return api.delete(`/training/training-types/delete/${id}`);
}

export async function searchTrainingTypes(q: string) {
  const { rows } = await fetchTrainingTypes({ page: 1, limit: 30, searchTerm: q || undefined, sort: "name,_id" });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Trainers ─────────────────────────────────────────────────── */

export type TrainerRow = {
  id: string;
  name: string;
  email: string;
  contact: string;
  experience: string;
  expertise: string;
  qualification: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  createdAt: string;
};

export const mapTrainer = (d: any): TrainerRow => ({
  id: idOf(d),
  name: text(d.name),
  email: text(d.email),
  contact: text(d.contact),
  experience: text(d.experience),
  expertise: text(d.expertise),
  qualification: text(d.qualification),
  branchId: idOf(d.branch_id),
  branchName: nameOf(d.branch_id, ["branch_name", "name"]),
  departmentId: idOf(d.department_id),
  departmentName: nameOf(d.department_id, ["department_name", "name"]),
  createdAt: day(d.createdAt),
});

export async function fetchTrainers(params?: TrainingListParams) {
  const { rows, pagination } = await listGet<any>("/training/trainers/all", params);
  return { rows: rows.map(mapTrainer), pagination };
}

export async function createTrainer(body: {
  name: string;
  contact: string;
  email: string;
  experience: string;
  branch_id: string;
  department_id: string;
  expertise?: string;
  qualification?: string;
}) {
  return api.post("/training/trainers/create", body);
}

export async function updateTrainer(
  id: string,
  body: Partial<{
    name: string;
    contact: string;
    email: string;
    experience: string;
    branch_id: string;
    department_id: string;
    expertise: string;
    qualification: string;
  }>,
) {
  return api.patch(`/training/trainers/edit/${id}`, body);
}

export async function deleteTrainer(id: string) {
  return api.delete(`/training/trainers/delete/${id}`);
}

export async function searchTrainers(q: string) {
  const { rows } = await fetchTrainers({ page: 1, limit: 30, searchTerm: q || undefined, sort: "name,_id" });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Trainings ────────────────────────────────────────────────── */

export type TrainingStatus = "Scheduled" | "Ongoing" | "Completed" | "Cancelled";

export type TrainingRow = {
  id: string;
  title: string;
  description: string;
  typeId: string;
  typeName: string;
  trainerId: string;
  trainerName: string;
  branchId: string;
  branchName: string;
  departmentId: string;
  departmentName: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  maxParticipants: number;
  cost: number;
  status: TrainingStatus;
  createdAt: string;
};

const STATUS_FE: Record<string, TrainingStatus> = {
  scheduled: "Scheduled",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_BE: Record<string, string> = {
  Scheduled: "scheduled",
  Ongoing: "ongoing",
  Completed: "completed",
  Cancelled: "cancelled",
};

export const mapTraining = (d: any): TrainingRow => ({
  id: idOf(d),
  title: text(d.title),
  description: text(d.description),
  typeId: idOf(d.training_type_id),
  typeName: nameOf(d.training_type_id),
  trainerId: idOf(d.trainer_id),
  trainerName: nameOf(d.trainer_id),
  branchId: idOf(d.branch_id),
  branchName: nameOf(d.branch_id, ["branch_name", "name"]),
  departmentId: idOf(d.department_id),
  departmentName: nameOf(d.department_id, ["department_name", "name"]),
  startDate: day(d.start_date),
  endDate: day(d.end_date),
  startTime: text(d.start_time),
  endTime: text(d.end_time),
  location: text(d.location),
  maxParticipants: num(d.max_participants),
  cost: num(d.cost),
  status: STATUS_FE[text(d.status).toLowerCase()] || "Scheduled",
  createdAt: day(d.createdAt),
});

export async function fetchTrainings(params?: TrainingListParams) {
  const { rows, pagination } = await listGet<any>("/training/trainings/all", params);
  return { rows: rows.map(mapTraining), pagination };
}

export async function createTraining(body: {
  title: string;
  description?: string;
  training_type_id: string;
  trainer_id: string;
  branch_id: string;
  department_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location?: string;
  max_participants?: number;
  cost?: number;
  status?: string;
}) {
  return api.post("/training/trainings/create", {
    ...body,
    status: body.status ? STATUS_BE[body.status] || body.status.toLowerCase() : undefined,
  });
}

export async function updateTraining(
  id: string,
  body: Partial<{
    title: string;
    description: string;
    training_type_id: string;
    trainer_id: string;
    branch_id: string;
    department_id: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    location: string;
    max_participants: number;
    cost: number;
    status: string;
  }>,
) {
  const payload = { ...body };
  if (body.status) payload.status = STATUS_BE[body.status] || body.status.toLowerCase();
  return api.patch(`/training/trainings/edit/${id}`, payload);
}

export async function deleteTraining(id: string) {
  return api.delete(`/training/trainings/delete/${id}`);
}

/* ── Tasks ────────────────────────────────────────────────────── */

export type TrainingTaskRow = {
  id: string;
  trainingId: string;
  title: string;
  description: string;
  dueDate: string;
  assignedToId: string;
  assignedToName: string;
  status: string;
};

export const mapTask = (d: any): TrainingTaskRow => ({
  id: idOf(d),
  trainingId: idOf(d.training_id),
  title: text(d.title),
  description: text(d.description),
  dueDate: day(d.due_date),
  assignedToId: idOf(d.assigned_to),
  assignedToName: nameOf(d.assigned_to),
  status: titleCase(text(d.status) || "pending"),
});

export async function fetchTrainingTasks(trainingId: string, params?: TrainingListParams) {
  const { rows, pagination } = await listGet<any>(`/training/trainings/${trainingId}/tasks/all`, params);
  return { rows: rows.map(mapTask), pagination };
}

export async function createTrainingTask(
  trainingId: string,
  body: { title: string; description?: string; due_date?: string; assigned_to: string },
) {
  return api.post(`/training/trainings/${trainingId}/tasks/create`, body);
}

export async function updateTrainingTask(
  taskId: string,
  body: Partial<{ title: string; description: string; due_date: string; assigned_to: string }>,
) {
  return api.patch(`/training/tasks/edit/${taskId}`, body);
}

export async function completeTrainingTask(taskId: string) {
  return api.patch(`/training/tasks/complete/${taskId}`);
}

export async function deleteTrainingTask(taskId: string) {
  return api.delete(`/training/tasks/delete/${taskId}`);
}

/* ── Feedbacks ────────────────────────────────────────────────── */

export async function fetchTaskFeedbacks(taskId: string, params?: TrainingListParams) {
  return listGet<any>(`/training/tasks/${taskId}/feedbacks/all`, params);
}

export async function createTaskFeedback(taskId: string, body: { rating: number; comments?: string }) {
  return api.post(`/training/tasks/${taskId}/feedbacks/create`, body);
}

export const TRAINING_STATUSES = ["Scheduled", "Ongoing", "Completed", "Cancelled"] as const;
