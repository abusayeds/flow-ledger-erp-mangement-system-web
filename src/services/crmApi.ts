/**
 * CRM API — leads, deals, pipelines, stages, labels, sources.
 */
import { api } from "@/lib/api/client";
import { toArray, toObject } from "@/services/_http";

export type CrmNamed = { _id: string; name: string; color?: string; pipeline_id?: string; order?: number };

const idOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "_id" in v) return String((v as { _id: unknown })._id);
  return String(v);
};

const nameOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "name" in v) return String((v as { name: unknown }).name ?? "");
  return "";
};

const mapNamed = (doc: any): CrmNamed => ({
  _id: String(doc._id),
  name: String(doc.name ?? ""),
  color: doc.color ? String(doc.color) : undefined,
  pipeline_id: idOf(doc.pipeline_id) || undefined,
  order: typeof doc.order === "number" ? doc.order : undefined,
});

async function list(path: string): Promise<CrmNamed[]> {
  const res = await api.raw.get(path);
  return toArray<any>(res.data).map(mapNamed);
}

export const fetchCrmPipelines = () => list("/crm/pipelines/all");
export const fetchCrmLeadStages = (pipelineId?: string) =>
  api.raw
    .get("/crm/lead-stages/all", { params: pipelineId ? { pipeline_id: pipelineId } : undefined })
    .then((res) => toArray<any>(res.data).map(mapNamed));
export const fetchCrmDealStages = (pipelineId?: string) =>
  api.raw
    .get("/crm/deal-stages/all", { params: pipelineId ? { pipeline_id: pipelineId } : undefined })
    .then((res) => toArray<any>(res.data).map(mapNamed));
export const fetchCrmLabels = () => list("/crm/labels/all");
export const fetchCrmSources = () => list("/crm/sources/all");

export async function fetchCrmUsers(searchTerm?: string): Promise<{ _id: string; name: string }[]> {
  try {
    const res = await api.raw.get("/user/all-user-for-company", {
      params: searchTerm ? { searchTerm } : undefined,
    });
    return toArray<any>(res.data).map((u: any) => ({
      _id: String(u._id ?? u.id),
      name: String(u.name ?? u.email ?? "User"),
    }));
  } catch {
    return [];
  }
}

export async function searchCrmNamed(
  path: string,
  searchTerm = "",
): Promise<CrmNamed[]> {
  const res = await api.raw.get(path, {
    params: { page: 1, limit: 50, ...(searchTerm ? { searchTerm } : {}) },
  });
  return toArray<any>(res.data).map(mapNamed);
}

export type CrmLeadRow = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  date: string;
  stageId: string;
  stageName: string;
  pipelineId: string;
  assignedUsers: { _id: string; name: string }[];
  createdAt: string;
};

export function mapCrmLead(doc: any): CrmLeadRow {
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    phone: String(doc.phone ?? ""),
    subject: String(doc.subject ?? ""),
    date: doc.date ? String(doc.date).slice(0, 10) : "",
    stageId: idOf(doc.stage_id),
    stageName: nameOf(doc.stage_id) || "—",
    pipelineId: idOf(doc.pipeline_id),
    assignedUsers: (doc.assigned_users ?? []).map((u: any) => ({
      _id: idOf(u),
      name: nameOf(u) || String(u),
    })),
    createdAt: doc.createdAt ? String(doc.createdAt) : "",
  };
}

export async function fetchCrmLeads(): Promise<CrmLeadRow[]> {
  const res = await api.raw.get("/crm/leads/all");
  return toArray<any>(res.data).map(mapCrmLead);
}

export async function createCrmLead(payload: Record<string, unknown>) {
  const res = await api.raw.post("/crm/leads/create", payload);
  return mapCrmLead(toObject(res.data) || res.data?.data || res.data);
}

export async function updateCrmLead(id: string, payload: Record<string, unknown>) {
  const res = await api.raw.patch(`/crm/leads/${id}`, payload);
  return mapCrmLead(toObject(res.data) || res.data?.data || res.data);
}

export async function deleteCrmLead(id: string) {
  await api.raw.delete(`/crm/leads/${id}`);
}

export type CrmDealRow = {
  _id: string;
  name: string;
  price: number;
  phone: string;
  notes: string;
  status: string;
  stageId: string;
  stageName: string;
  pipelineId: string;
  pipelineName: string;
  clients: { _id: string; name: string }[];
  sources: { _id: string; name: string }[];
  products: { _id: string; name: string }[];
  tasksTotal: number;
  tasksDone: number;
  createdAt: string;
};

export function mapCrmDeal(doc: any): CrmDealRow {
  const tasks = doc.tasks ?? [];
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ""),
    price: Number(doc.price) || 0,
    phone: String(doc.phone ?? ""),
    notes: String(doc.notes ?? ""),
    status: String(doc.status ?? "Active"),
    stageId: idOf(doc.stage_id),
    stageName: nameOf(doc.stage_id) || "—",
    pipelineId: idOf(doc.pipeline_id),
    pipelineName: nameOf(doc.pipeline_id) || "—",
    clients: (doc.clients ?? []).map((c: any) => ({ _id: idOf(c), name: nameOf(c) || String(c) })),
    sources: (doc.sources ?? []).map((s: any) => ({ _id: idOf(s), name: nameOf(s) || String(s) })),
    products: (doc.products ?? []).map((p: any) => ({
      _id: idOf(p),
      name: String(p?.productName ?? p?.name ?? p),
    })),
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t: any) => t.status === "completed" || t.completed || t.status === "Complete").length,
    createdAt: doc.createdAt ? String(doc.createdAt) : "",
  };
}

export async function fetchCrmDeals(): Promise<CrmDealRow[]> {
  const res = await api.raw.get("/crm/deals/all");
  return toArray<any>(res.data).map(mapCrmDeal);
}

export async function createCrmDeal(payload: Record<string, unknown>) {
  const res = await api.raw.post("/crm/deals/create", payload);
  return mapCrmDeal(toObject(res.data) || res.data?.data || res.data);
}

export async function updateCrmDeal(id: string, payload: Record<string, unknown>) {
  const res = await api.raw.patch(`/crm/deals/${id}`, payload);
  return mapCrmDeal(toObject(res.data) || res.data?.data || res.data);
}

export async function deleteCrmDeal(id: string) {
  await api.raw.delete(`/crm/deals/${id}`);
}

/* ── System setup CRUD ─────────────────────────────────────────── */

export async function createCrmPipeline(name: string) {
  const res = await api.raw.post("/crm/pipelines/create", { name });
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function updateCrmPipeline(id: string, name: string) {
  const res = await api.raw.patch(`/crm/pipelines/${id}`, { name });
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function deleteCrmPipeline(id: string) {
  await api.raw.delete(`/crm/pipelines/${id}`);
}

export async function createCrmLeadStage(payload: { name: string; pipeline_id: string; order?: number }) {
  const res = await api.raw.post("/crm/lead-stages/create", payload);
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function updateCrmLeadStage(id: string, payload: Record<string, unknown>) {
  const res = await api.raw.patch(`/crm/lead-stages/${id}`, payload);
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function deleteCrmLeadStage(id: string) {
  await api.raw.delete(`/crm/lead-stages/${id}`);
}

export async function createCrmDealStage(payload: { name: string; pipeline_id: string; order?: number }) {
  const res = await api.raw.post("/crm/deal-stages/create", payload);
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function updateCrmDealStage(id: string, payload: Record<string, unknown>) {
  const res = await api.raw.patch(`/crm/deal-stages/${id}`, payload);
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function deleteCrmDealStage(id: string) {
  await api.raw.delete(`/crm/deal-stages/${id}`);
}

export async function createCrmLabel(payload: { name: string; color?: string; pipeline_id?: string }) {
  const res = await api.raw.post("/crm/labels/create", payload);
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function updateCrmLabel(id: string, payload: Record<string, unknown>) {
  const res = await api.raw.patch(`/crm/labels/${id}`, payload);
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function deleteCrmLabel(id: string) {
  await api.raw.delete(`/crm/labels/${id}`);
}

export async function createCrmSource(name: string) {
  const res = await api.raw.post("/crm/sources/create", { name });
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function updateCrmSource(id: string, name: string) {
  const res = await api.raw.patch(`/crm/sources/${id}`, { name });
  return mapNamed(toObject(res.data) || res.data?.data || res.data);
}
export async function deleteCrmSource(id: string) {
  await api.raw.delete(`/crm/sources/${id}`);
}

export async function fetchCrmSetupBundle() {
  const [pipelines, leadStages, dealStages, labels, sources] = await Promise.all([
    fetchCrmPipelines(),
    fetchCrmLeadStages(),
    fetchCrmDealStages(),
    fetchCrmLabels(),
    fetchCrmSources(),
  ]);
  return { pipelines, leadStages, dealStages, labels, sources };
}

export type CrmDashboardPayload = {
  stats: {
    total_deals: number;
    total_leads: number;
    total_users: number;
    total_clients: number;
  };
  dealsByStage: { name: string; value: number; color: string }[];
  callsByDay: { day: string; calls: number; leads: number }[];
  dealCallsChart: { name: string; value: number }[];
  recentDeals: { name: string; stage: string; date: string }[];
  recentLeads: { name: string; project: string; date: string }[];
};

const CRM_STAGE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#6B7280", "#EF4444", "#06B6D4"];

const fmtDay = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

function normalizeCrmDashboard(raw: unknown): CrmDashboardPayload {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const s = (d.stats && typeof d.stats === "object" ? d.stats : {}) as Record<string, any>;

  const stageSrc = Array.isArray(d.dealsByStage)
    ? d.dealsByStage
    : Array.isArray(d.dealStageChart)
      ? d.dealStageChart
      : [];

  const dealsByStage = stageSrc.map((x: any, i: number) => ({
    name: String(x.name || "—"),
    value: Number(x.value ?? x.deals) || 0,
    color: String(x.color || CRM_STAGE_COLORS[i % CRM_STAGE_COLORS.length]),
  }));

  const callsByDay = Array.isArray(d.callsByDay)
    ? d.callsByDay.map((x: any) => ({
        day: String(x.day || ""),
        calls: Number(x.calls) || 0,
        leads: Number(x.leads) || 0,
      }))
    : [];

  const dealCallsChart = Array.isArray(d.dealCallsChart)
    ? d.dealCallsChart.map((x: any) => ({
        name: String(x.name || "—"),
        value: Number(x.value) || 0,
      }))
    : [];

  const recentDeals = (Array.isArray(d.recentDeals) ? d.recentDeals : []).map((x: any) => ({
    name: String(x.name || "—"),
    stage: String(
      (typeof x.stage === "object" && x.stage?.name) || x.stage || x.status || "—",
    ),
    date: fmtDay(x.date ?? x.created_at),
  }));

  const recentLeads = (Array.isArray(d.recentLeads) ? d.recentLeads : []).map((x: any) => ({
    name: String(x.name || "—"),
    project: String(x.project || x.subject || "—"),
    date: fmtDay(x.date ?? x.created_at),
  }));

  return {
    stats: {
      total_deals: Number(s.total_deals) || 0,
      total_leads: Number(s.total_leads) || 0,
      total_users: Number(s.total_users) || 0,
      total_clients: Number(s.total_clients) || 0,
    },
    dealsByStage,
    callsByDay,
    dealCallsChart,
    recentDeals,
    recentLeads,
  };
}

/** Prefer hub `/dashboard/crm`, fall back to legacy `/crm/dashboard`. */
export async function fetchCrmDashboard(): Promise<CrmDashboardPayload> {
  try {
    const data = await api.get<unknown>("/dashboard/crm");
    return normalizeCrmDashboard(data);
  } catch {
    const data = await api.get<unknown>("/crm/dashboard");
    return normalizeCrmDashboard(data);
  }
}
