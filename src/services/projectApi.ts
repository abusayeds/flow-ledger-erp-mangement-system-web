/**
 * Project module API — /api/v1/project/*
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type ProjectListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
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
  return "";
};

const budgetNum = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function listGet<T>(
  path: string,
  params: Record<string, unknown> = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const res = await api.raw.get(path, { params });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

export type ProjectUser = { id: string; name: string; email: string };

export type ProjectListRow = {
  id: string;
  name: string;
  status: string;
  description: string;
  budget: number;
  totalTasks: number;
  startDate: string;
  endDate: string;
  members: ProjectUser[];
  clients: ProjectUser[];
};

export type ProjectMilestone = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  cost: number;
  progress: number;
  summary: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  description: string;
  budget: number;
  startDate: string;
  endDate: string;
  daysLeft: number;
  totalTasks: number;
  totalBugs: number;
  members: ProjectUser[];
  clients: ProjectUser[];
  milestones: ProjectMilestone[];
};

export type StageRow = {
  id: string;
  name: string;
  color: string;
  complete: boolean;
  order: number;
};

export type BoardTask = {
  id: string;
  title: string;
  description: string;
  priority: string;
  startDate: string;
  endDate: string;
  stageId: string;
  assignees: ProjectUser[];
};

export type TaskBoardColumn = StageRow & { tasks: BoardTask[] };

export type BoardBug = {
  id: string;
  title: string;
  description: string;
  priority: string;
  stageId: string;
  assignees: ProjectUser[];
};

const mapUser = (u: any): ProjectUser => ({
  id: idOf(u),
  name: text(u?.name) || text(u?.email) || "User",
  email: text(u?.email),
});

export const mapProjectList = (d: any): ProjectListRow => ({
  id: idOf(d),
  name: text(d.name),
  status: text(d.status) || "Ongoing",
  description: text(d.description),
  budget: budgetNum(d.budget),
  totalTasks: Number(d.total_task) || 0,
  startDate: text(d.start_date),
  endDate: text(d.end_date),
  members: Array.isArray(d.members) ? d.members.map(mapUser) : [],
  clients: Array.isArray(d.clients) ? d.clients.map(mapUser) : [],
});

export const mapProjectDetail = (d: any): ProjectDetail => ({
  id: idOf(d),
  name: text(d.name),
  status: text(d.status) || "Ongoing",
  description: text(d.description),
  budget: budgetNum(d.budget),
  startDate: text(d.start_date),
  endDate: text(d.end_date),
  daysLeft: Number(d.daysleft) || 0,
  totalTasks: Number(d.total_task) || 0,
  totalBugs: Number(d.total_bug) || 0,
  members: Array.isArray(d.members) ? d.members.map(mapUser) : [],
  clients: Array.isArray(d.clients) ? d.clients.map(mapUser) : [],
  milestones: Array.isArray(d.milestones)
    ? d.milestones.map((m: any) => ({
        id: idOf(m),
        title: text(m.title),
        startDate: text(m.start_date),
        endDate: text(m.end_date),
        status: text(m.status),
        cost: budgetNum(m.cost),
        progress: Number(m.progress) || 0,
        summary: text(m.summary),
      }))
    : [],
});

const mapStage = (s: any): StageRow => ({
  id: idOf(s),
  name: text(s.name),
  color: text(s.color) || "#3B82F6",
  complete: !!s.complete,
  order: Number(s.order) || 0,
});

const mapBoardTask = (t: any, stageId: string): BoardTask => ({
  id: idOf(t),
  title: text(t.title),
  description: text(t.description),
  priority: text(t.priority) || "Medium",
  startDate: text(t.start_date),
  endDate: text(t.end_date),
  stageId: idOf(t.current_stage) || stageId,
  assignees: Array.isArray(t.assigned_users) ? t.assigned_users.map(mapUser) : [],
});

const mapBug = (b: any): BoardBug => ({
  id: idOf(b),
  title: text(b.title),
  description: text(b.description),
  priority: text(b.priority) || "Medium",
  stageId: idOf(b.stage_id),
  assignees: Array.isArray(b.assigned_users) ? b.assigned_users.map(mapUser) : [],
});

export async function fetchProjects(params: ProjectListParams = {}) {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status;
  const { rows, pagination } = await listGet<any>("/project/all", query);
  return { rows: rows.map(mapProjectList), pagination };
}

export async function fetchProjectDetail(id: string) {
  const data = await api.get<any>(`/project/single/${id}`);
  return mapProjectDetail(data);
}

export async function fetchProjectActivity(projectId: string) {
  const data = await api.get<any[]>(`/project/activity/${projectId}`);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((a) => ({
    id: idOf(a),
    text: text(a.remark),
    time: text(a.time),
  }));
}

export async function createOrUpdateProject(body: {
  project_id?: string;
  name: string;
  description?: string;
  budget?: number;
  start_date: string;
  end_date: string;
  status: string;
  user_ids: string[];
}) {
  return api.post("/project/create-update", body);
}

export async function deleteProject(projectId: string) {
  return api.post("/project/delete", { project_id: projectId });
}

export async function duplicateProject(projectId: string) {
  return api.post("/project/duplicate", { project_id: projectId });
}

export async function fetchProjectUsers(): Promise<ProjectUser[]> {
  const data = await api.get<any[]>("/project/users");
  return (Array.isArray(data) ? data : []).map(mapUser);
}

export async function searchProjectUsers(query: string): Promise<{ id: string; name: string }[]> {
  const users = await fetchProjectUsers();
  const q = query.trim().toLowerCase();
  return users
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .map((u) => ({ id: u.id, name: u.email ? `${u.name} (${u.email})` : u.name }));
}

export async function inviteMembers(projectId: string, userIds: string[]) {
  return api.post("/project/invite-member", { project_id: projectId, user_ids: userIds });
}

export async function removeMember(projectId: string, userId: string) {
  return api.post("/project/delete-member", { project_id: projectId, user_id: userId });
}

export async function inviteClients(projectId: string, clientIds: string[]) {
  return api.post("/project/invite-client", { project_id: projectId, client_ids: clientIds });
}

export async function removeClient(projectId: string, clientId: string) {
  return api.post("/project/delete-client", { project_id: projectId, client_id: clientId });
}

export async function createMilestone(body: Record<string, unknown>) {
  return api.post("/project/milestone/create", body);
}

export async function updateMilestone(body: Record<string, unknown>) {
  return api.post("/project/milestone/update", body);
}

export async function deleteMilestone(milestoneId: string) {
  return api.post("/project/milestone/delete", { milestone_id: milestoneId });
}

/* ── Tasks / Taskboard ─────────────────────────────────────────── */

export async function fetchTaskboard(projectId: string): Promise<TaskBoardColumn[]> {
  const data = await api.get<any[]>(`/project/taskboard/${projectId}`);
  const cols = Array.isArray(data) ? data : [];
  return cols.map((c) => {
    const stage = mapStage(c);
    return {
      ...stage,
      tasks: Array.isArray(c.tasks) ? c.tasks.map((t: any) => mapBoardTask(t, stage.id)) : [],
    };
  });
}

export async function createOrUpdateTask(body: {
  task_id?: string;
  project_id: string;
  title: string;
  description?: string;
  priority?: string;
  duration?: string;
  stage_id?: string;
  milestone_id?: string;
  assigned_to: string[];
}) {
  return api.post("/project/task/create-update", body);
}

export async function deleteTask(taskId: string) {
  return api.post("/project/task/delete", { task_id: taskId });
}

export async function moveTaskStage(taskId: string, stageId: string) {
  return api.post("/project/task/stage-update", { task_id: taskId, stage_id: stageId });
}

/* ── Bugs / Issues ─────────────────────────────────────────────── */

export async function fetchBugs(projectId: string, params: ProjectListParams = {}) {
  const query: Record<string, unknown> = {
    project_id: projectId,
    page: params.page ?? 1,
    limit: params.limit ?? 200,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  const { rows, pagination } = await listGet<any>("/project/bug/all", query);
  return { rows: rows.map(mapBug), pagination };
}

export async function createOrUpdateBug(body: {
  bug_id?: string;
  project_id: string;
  title: string;
  description?: string;
  priority?: string;
  stage_id?: string;
  assigned_to?: string[];
}) {
  return api.post("/project/bug/create-update", body);
}

export async function deleteBug(bugId: string) {
  return api.post("/project/bug/delete", { bug_id: bugId });
}

export async function moveBugStage(bugId: string, stageId: string) {
  return api.post("/project/bug/stage-update", { bug_id: bugId, stage_id: stageId });
}

/* ── Stages (System Setup) ─────────────────────────────────────── */

export async function fetchTaskStages(): Promise<StageRow[]> {
  const data = await api.get<any[]>("/project/task-stage/all");
  return (Array.isArray(data) ? data : []).map(mapStage);
}

export async function createTaskStage(body: { name: string; color: string }) {
  return api.post("/project/task-stage/create", body);
}

export async function updateTaskStage(id: string, body: { name: string; color: string }) {
  return api.put(`/project/task-stage/update/${id}`, body);
}

export async function deleteTaskStage(id: string) {
  return api.delete(`/project/task-stage/delete/${id}`);
}

export async function reorderTaskStages(ids: string[]) {
  return api.post("/project/task-stage/reorder", { ids });
}

export async function fetchBugStages(): Promise<StageRow[]> {
  const data = await api.get<any[]>("/project/bug-stage/all");
  return (Array.isArray(data) ? data : []).map(mapStage);
}

export async function createBugStage(body: { name: string; color: string }) {
  return api.post("/project/bug-stage/create", body);
}

export async function updateBugStage(id: string, body: { name: string; color: string }) {
  return api.put(`/project/bug-stage/update/${id}`, body);
}

export async function deleteBugStage(id: string) {
  return api.delete(`/project/bug-stage/delete/${id}`);
}

export async function reorderBugStages(ids: string[]) {
  return api.post("/project/bug-stage/reorder", { ids });
}

/** Company / staff / client project dashboard hub. */
export type ProjectDashboardPayload = {
  stats?: Record<string, number>;
  bugStats?: { open?: number; resolved?: number };
  projectStatus?: { name: string; value: number; color: string }[];
  taskPriority?: { name: string; value: number; color: string }[];
  teamPerformance?: {
    name: string;
    total_tasks?: number;
    completed_tasks?: number;
    completion_rate?: number;
    total?: number;
    completed?: number;
    percentage?: number;
  }[];
  monthlyProgress?: { month: string; created?: number; completed?: number }[];
  recentTasks?: Record<string, unknown>[];
  latestTasks?: Record<string, unknown>[];
  projectProgress?: Record<string, unknown>[];
  clientProjects?: Record<string, unknown>[];
  staffProjects?: Record<string, unknown>[];
};

export async function fetchProjectDashboard(): Promise<ProjectDashboardPayload> {
  try {
    const data = await api.get<ProjectDashboardPayload>("/dashboard/project");
    return (data && typeof data === "object" ? data : {}) as ProjectDashboardPayload;
  } catch {
    // Legacy company-only endpoint (same payload shape).
    const data = await api.get<ProjectDashboardPayload>("/project/dashboard/home");
    return (data && typeof data === "object" ? data : {}) as ProjectDashboardPayload;
  }
}
