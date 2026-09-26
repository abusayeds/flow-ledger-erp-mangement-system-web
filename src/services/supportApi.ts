/**
 * Support Ticket API — /api/v1/support/*
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type SupportListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
  category?: string;
  account_type?: string;
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

const nameOf = (v: unknown, fields = ["name", "title", "email"]): string => {
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

async function listGet<T>(
  path: string,
  params: SupportListParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.status && params.status !== "All") query.status = params.status;
  if (params.category) query.category = params.category;
  if (params.account_type) query.account_type = params.account_type;

  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

/* ── Tickets ──────────────────────────────────────────────────── */

export type TicketRow = {
  id: string;
  ticketId: string;
  name: string;
  email: string;
  accountType: string;
  subject: string;
  status: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  createdAt: string;
  updatedAt: string;
};

export const mapTicket = (d: any): TicketRow => ({
  id: idOf(d),
  ticketId: text(d.ticket_id),
  name: text(d.name),
  email: text(d.email),
  accountType: text(d.account_type) || "custom",
  subject: text(d.subject),
  status: text(d.status) || "In Progress",
  categoryId: idOf(d.category),
  categoryName: nameOf(d.category) || "No Category",
  categoryColor: typeof d.category === "object" && d.category?.color ? String(d.category.color) : "#6B7280",
  createdAt: day(d.createdAt),
  updatedAt: day(d.updatedAt),
});

export async function fetchTickets(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/tickets/all", params);
  return { rows: rows.map(mapTicket), pagination };
}

export async function fetchTicket(id: string) {
  return api.get<any>(`/support/tickets/${id}`);
}

export async function fetchTicketRequestData() {
  return api.get<any>("/support/tickets/request-data");
}

export async function createTicket(body: Record<string, unknown>) {
  return api.post("/support/tickets/create", body);
}

export async function updateTicket(id: string, body: Record<string, unknown>) {
  return api.patch(`/support/tickets/${id}`, body);
}

export async function deleteTicket(id: string) {
  return api.delete(`/support/tickets/${id}`);
}

export async function changeTicketStatus(id: string, status: string) {
  return api.patch(`/support/tickets/${id}/status`, { status });
}

export async function storeTicketNote(id: string, note: string) {
  return api.post(`/support/tickets/${id}/note`, { note });
}

export async function addTicketReply(id: string, body: { description: string; attachments?: unknown[] }) {
  return api.post(`/support/tickets/${id}/reply`, body);
}

export const TICKET_STATUSES = ["In Progress", "On Hold", "Closed"] as const;
export const TICKET_ACCOUNT_TYPES = ["custom", "staff", "client", "vendor"] as const;

/* ── Ticket categories ────────────────────────────────────────── */

export type TicketCategoryRow = {
  id: string;
  name: string;
  color: string;
};

export const mapTicketCategory = (d: any): TicketCategoryRow => ({
  id: idOf(d),
  name: text(d.name),
  color: text(d.color) || "#6B7280",
});

export async function fetchTicketCategories(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/ticket-categories/all", params);
  return { rows: rows.map(mapTicketCategory), pagination };
}

export async function createTicketCategory(body: { name: string; color?: string }) {
  return api.post("/support/ticket-categories/create", body);
}

export async function updateTicketCategory(id: string, body: { name?: string; color?: string }) {
  return api.patch(`/support/ticket-categories/${id}`, body);
}

export async function deleteTicketCategory(id: string) {
  return api.delete(`/support/ticket-categories/${id}`);
}

export async function searchTicketCategories(q: string) {
  const { rows } = await fetchTicketCategories({ page: 1, limit: 30, searchTerm: q || undefined, sort: "name,_id" });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

/* ── Knowledge ────────────────────────────────────────────────── */

export type KnowledgeRow = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  createdAt: string;
};

export const mapKnowledge = (d: any): KnowledgeRow => ({
  id: idOf(d),
  title: text(d.title),
  description: text(d.description),
  categoryId: idOf(d.category),
  categoryName: nameOf(d.category, ["title", "name"]),
  createdAt: day(d.createdAt),
});

export async function fetchKnowledgeArticles(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/knowledge/all", params);
  return { rows: rows.map(mapKnowledge), pagination };
}

export async function createKnowledgeArticle(body: { title: string; description?: string; category?: string }) {
  return api.post("/support/knowledge/create", body);
}

export async function updateKnowledgeArticle(id: string, body: Record<string, unknown>) {
  return api.patch(`/support/knowledge/${id}`, body);
}

export async function deleteKnowledgeArticle(id: string) {
  return api.delete(`/support/knowledge/${id}`);
}

/* ── Knowledge categories ─────────────────────────────────────── */

export type KnowledgeCategoryRow = { id: string; title: string };

export const mapKnowledgeCategory = (d: any): KnowledgeCategoryRow => ({
  id: idOf(d),
  title: text(d.title),
});

export async function fetchKnowledgeCategories(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/knowledge-categories/all", params);
  return { rows: rows.map(mapKnowledgeCategory), pagination };
}

export async function createKnowledgeCategory(body: { title: string }) {
  return api.post("/support/knowledge-categories/create", body);
}

export async function updateKnowledgeCategory(id: string, body: { title: string }) {
  return api.patch(`/support/knowledge-categories/${id}`, body);
}

export async function deleteKnowledgeCategory(id: string) {
  return api.delete(`/support/knowledge-categories/${id}`);
}

export async function searchKnowledgeCategories(q: string) {
  const { rows } = await fetchKnowledgeCategories({ page: 1, limit: 30, searchTerm: q || undefined, sort: "title,_id" });
  return rows.map((r) => ({ id: r.id, name: r.title }));
}

/* ── FAQ ──────────────────────────────────────────────────────── */

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
};

export const mapFaq = (d: any): FaqRow => ({
  id: idOf(d),
  question: text(d.title),
  answer: text(d.description),
  createdAt: day(d.createdAt),
});

export async function fetchFaqs(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/faq/all", params);
  return { rows: rows.map(mapFaq), pagination };
}

export async function createFaq(body: { title: string; description?: string }) {
  return api.post("/support/faq/create", body);
}

export async function updateFaq(id: string, body: { title?: string; description?: string }) {
  return api.patch(`/support/faq/${id}`, body);
}

export async function deleteFaq(id: string) {
  return api.delete(`/support/faq/${id}`);
}

/* ── Contacts (submissions) ───────────────────────────────────── */

export type ContactRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
};

export const mapContact = (d: any): ContactRow => ({
  id: idOf(d),
  name: text(d.name) || [text(d.first_name), text(d.last_name)].filter(Boolean).join(" "),
  email: text(d.email),
  subject: text(d.subject),
  message: text(d.message),
  createdAt: day(d.createdAt),
});

export async function fetchContacts(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/contact/all", params);
  return { rows: rows.map(mapContact), pagination };
}

export async function fetchContact(id: string) {
  return api.get<any>(`/support/contact/${id}`);
}

export async function deleteContact(id: string) {
  return api.delete(`/support/contact/${id}`);
}

/* ── Quick links ──────────────────────────────────────────────── */

export type QuickLinkRow = {
  id: string;
  title: string;
  link: string;
  icon: string;
  order: number;
};

export const mapQuickLink = (d: any): QuickLinkRow => ({
  id: idOf(d),
  title: text(d.title),
  link: text(d.link),
  icon: text(d.icon),
  order: Number(d.order) || 0,
});

export async function fetchQuickLinks(params?: SupportListParams) {
  const { rows, pagination } = await listGet<any>("/support/quick-links/all", params);
  return { rows: rows.map(mapQuickLink), pagination };
}

export async function createQuickLink(body: { title: string; link: string; icon?: string; order?: number }) {
  return api.post("/support/quick-links/create", body);
}

export async function updateQuickLink(id: string, body: Record<string, unknown>) {
  return api.patch(`/support/quick-links/${id}`, body);
}

export async function deleteQuickLink(id: string) {
  return api.delete(`/support/quick-links/${id}`);
}

/* ── Ticket fields ────────────────────────────────────────────── */

export async function fetchTicketFields(params?: SupportListParams) {
  return listGet<any>("/support/ticket-fields/all", params);
}

export async function createTicketField(body: Record<string, unknown>) {
  return api.post("/support/ticket-fields/create", body);
}

export async function updateTicketField(id: string, body: Record<string, unknown>) {
  return api.patch(`/support/ticket-fields/${id}`, body);
}

export async function deleteTicketField(id: string) {
  return api.delete(`/support/ticket-fields/${id}`);
}

/* ── Custom pages ─────────────────────────────────────────────── */

export async function fetchCustomPages(params?: SupportListParams) {
  return listGet<any>("/support/custom-pages/all", params);
}

export async function updateCustomPage(id: string, body: Record<string, unknown>) {
  return api.patch(`/support/custom-pages/${id}`, body);
}

/* ── Setup (singleton JSON sections) ──────────────────────────── */

export const getBrandSettings = () => api.get<any>("/support/setup/brand-settings");
export const updateBrandSettings = (body: unknown) => api.patch("/support/setup/brand-settings", body);
export const getTitleSections = () => api.get<any>("/support/setup/title-sections");
export const saveTitleSections = (body: unknown) => api.patch("/support/setup/title-sections", body);
export const getCtaSections = () => api.get<any>("/support/setup/cta-sections");
export const saveCtaSections = (body: unknown) => api.patch("/support/setup/cta-sections", body);
export const getSupportInformation = () => api.get<any>("/support/setup/support-information");
export const saveSupportInformation = (body: unknown) => api.patch("/support/setup/support-information", body);
export const getContactInformation = () => api.get<any>("/support/setup/contact-information");
export const saveContactInformation = (body: unknown) => api.patch("/support/setup/contact-information", body);

export type SupportDashboardPayload = {
  stats: {
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    todayTickets: number;
    avgResponseTime: number | string;
    categories: number;
    resolutionRate: number;
  };
  ticketTrends: { month: string; tickets: number; resolved: number }[];
  statusDistribution: { name: string; value: number; color: string }[];
  categoryDistribution: { name: string; value: number; color: string }[];
  recentTickets: {
    id: string;
    ticket_id: string;
    subject: string;
    name: string;
    status: string;
    category: string;
    created_at: string;
  }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS_COLORS: Record<string, string> = {
  Closed: "#10B981",
  "In Progress": "#3B82F6",
  "On Hold": "#F59E0B",
  Open: "#EF4444",
};

function normalizeSupportDashboard(raw: unknown): SupportDashboardPayload {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const s = (d.stats && typeof d.stats === "object" ? d.stats : {}) as Record<string, any>;

  // Legacy shape with statCards / ticketTrends
  if (Array.isArray(d.statCards) || Array.isArray(d.ticketTrends)) {
    const cards = Array.isArray(d.statCards) ? d.statCards : [];
    const num = (i: number) => {
      const v = cards[i]?.value;
      if (v == null) return 0;
      const n = Number(String(v).replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    return {
      stats: {
        totalTickets: num(0),
        openTickets: num(1),
        closedTickets: num(2),
        todayTickets: num(3),
        avgResponseTime: cards[4]?.value ?? "—",
        categories: num(5),
        resolutionRate: 0,
      },
      ticketTrends: Array.isArray(d.ticketTrends) ? d.ticketTrends : [],
      statusDistribution: Array.isArray(d.statusDistribution) ? d.statusDistribution : [],
      categoryDistribution: (Array.isArray(d.categoryDistribution) ? d.categoryDistribution : []).map(
        (x: any) => ({
          name: String(x.name || "—"),
          value: Number(x.value ?? x.count) || 0,
          color: String(x.color || "#6B7280"),
        }),
      ),
      recentTickets: (Array.isArray(d.recentTickets) ? d.recentTickets : []).map((t: any) => ({
        id: String(t.id || t._id || t.ticket_id || ""),
        ticket_id: String(t.ticket_id || t.id || "—"),
        subject: String(t.subject || "—"),
        name: String(t.name || "—"),
        status: String(t.status || "—"),
        category: String(t.category || "—"),
        created_at: String(t.created_at || t.date || "").slice(0, 16),
      })),
    };
  }

  // Hub /dashboard/support
  const monthly = (d.monthlyData && typeof d.monthlyData === "object" ? d.monthlyData : {}) as Record<
    string,
    { created?: number; resolved?: number }
  >;
  const ticketTrends = MONTHS.map((month) => ({
    month,
    tickets: Number(monthly[month]?.created) || 0,
    resolved: Number(monthly[month]?.resolved) || 0,
  }));

  const statusDistribution = (Array.isArray(d.statusData) ? d.statusData : []).map((x: any) => ({
    name: String(x.name || "—"),
    value: Number(x.value) || 0,
    color: String(x.color || STATUS_COLORS[String(x.name)] || "#6B7280"),
  }));

  const categoryDistribution = (Array.isArray(d.chartData) ? d.chartData : [])
    .filter((x: any) => x?.name !== "No Data")
    .map((x: any) => ({
      name: String(x.name || "—"),
      value: Number(x.value) || 0,
      color: String(x.color || "#6B7280"),
    }));

  return {
    stats: {
      totalTickets: Number(s.totalTickets) || 0,
      openTickets: Number(s.openTickets) || 0,
      closedTickets: Number(s.closedTickets) || 0,
      todayTickets: Number(s.todayTickets) || 0,
      avgResponseTime: s.avgResponseTime != null ? Number(s.avgResponseTime) || 0 : "—",
      categories: Number(s.categories) || 0,
      resolutionRate: Number(s.resolutionRate) || 0,
    },
    ticketTrends,
    statusDistribution,
    categoryDistribution,
    recentTickets: (Array.isArray(d.recentTickets) ? d.recentTickets : []).map((t: any) => ({
      id: String(t.id || t._id || t.ticket_id || ""),
      ticket_id: String(t.ticket_id || t.id || "—"),
      subject: String(t.subject || "—"),
      name: String(t.name || "—"),
      status: String(t.status || "—"),
      category: String(t.category || "—"),
      created_at: String(t.created_at || "").slice(0, 16),
    })),
  };
}

/** Prefer hub `/dashboard/support`, fall back to legacy `/support/dashboard`. */
export async function fetchSupportDashboard(): Promise<SupportDashboardPayload> {
  try {
    const data = await api.get<unknown>("/dashboard/support");
    return normalizeSupportDashboard(data);
  } catch {
    const data = await api.get<unknown>("/support/dashboard");
    return normalizeSupportDashboard(data);
  }
}
