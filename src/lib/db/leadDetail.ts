/**
 * File: src/lib/db/leadDetail.ts
 * Per-lead CRM detail data (tasks, users, products, sources, calls, emails,
 * discussions, notes) persisted in the Dexie `meta` table under one row per
 * lead — `crm:lead:<id>`. Mirrors the meta-based persistence pattern used by
 * appSettings.ts (no schema bump needed) so a lead's sub-data survives reload.
 */

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { api } from "@/lib/api/client";
import { isBackendId } from "./backendStore";

export interface LeadTask {
  id: string;
  name: string;
  date: string;
  time: string;
  priority: "Low" | "Medium" | "High";
  status: "On Going" | "Complete";
}
export interface LeadCall {
  id: string;
  subject: string;
  callType: "Inbound" | "Outbound";
  duration: string;
  assignee: string;
  description?: string;
  result?: string;
}
export interface LeadUser {
  id: string;
  name: string;
}
export interface LeadNamed {
  id: string;
  name: string;
}
export interface LeadEmail {
  id: string;
  to: string;
  subject: string;
  description: string;
  date: string;
}
export interface LeadDiscussion {
  id: string;
  author: string;
  message: string;
  date: string;
}
export interface LeadActivity {
  id: string;
  kind: "sources" | "email" | "call" | "products" | "task" | "user";
  label: string;
  date: string;
}

export interface LeadFile {
  id: string;
  name: string;
  url?: string;
}

export interface LeadDetailData {
  notes: string;
  tasks: LeadTask[];
  users: LeadUser[];
  products: LeadNamed[];
  sources: LeadNamed[];
  files?: LeadFile[];
  calls: LeadCall[];
  emails: LeadEmail[];
  discussions: LeadDiscussion[];
  activity: LeadActivity[];
  clients?: LeadNamed[]; // deals only
  status?: string; // deals only — editable Active/Won/Loss
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const metaKey = (id: string | number) => `crm:lead:${id}`;
const dealKey = (id: string | number) => `crm:deal:${id}`;

/* ── backend mapping ────────────────────────────────────────────
 * The CRM lead/deal document embeds its sub-collections (tasks, calls, emails,
 * discussions) and references (assigned users/products/sources). Build the
 * page's LeadDetailData straight from that real, company-scoped document so a
 * fresh company starts empty instead of seeing demo rows.
 */
const nm = (v: any): string => (v && typeof v === "object" ? v.name ?? v.productName ?? v.product_name ?? v.source_name ?? "" : String(v ?? ""));
const sid = (v: any): string => String(v?._id ?? v?.id ?? Math.random().toString(36).slice(2, 10));
const named = (arr: any[]): LeadNamed[] => (arr || []).map((x) => ({ id: sid(x), name: nm(x) })).filter((x) => x.name);
const stampOf = (d: any): string => (d ? String(d).slice(0, 16).replace("T", " ") : "");

export function leadDetailFromApi(l: any): LeadDetailData {
  return {
    notes: l?.notes ?? "",
    tasks: (l?.tasks || []).map((t: any) => ({
      id: sid(t),
      name: t.name ?? t.title ?? "",
      date: t.date ? String(t.date).slice(0, 10) : "",
      time: t.time ?? "",
      priority: (t.priority ? t.priority[0].toUpperCase() + t.priority.slice(1) : "Medium") as LeadTask["priority"],
      status: t.status === "complete" || t.status === "Complete" ? "Complete" : "On Going",
    })),
    users: named(l?.assigned_users ?? l?.users),
    products: named(l?.assigned_products ?? l?.products),
    sources: named(l?.assigned_sources ?? l?.sources),
    calls: (l?.calls || []).map((c: any) => ({
      id: sid(c),
      subject: c.subject ?? "",
      callType: (c.call_type ?? c.callType ?? "Outbound") as LeadCall["callType"],
      duration: c.duration ?? "",
      assignee: nm(c.assignee) || "",
      description: c.description ?? "",
      result: c.result ?? "",
    })),
    emails: (l?.emails || []).map((e: any) => ({
      id: sid(e),
      to: e.to ?? "",
      subject: e.subject ?? "",
      description: e.description ?? e.body ?? "",
      date: stampOf(e.date ?? e.createdAt),
    })),
    discussions: (l?.discussions || []).map((d: any) => ({
      id: sid(d),
      author: nm(d.author) || d.author || "Company",
      message: d.message ?? "",
      date: stampOf(d.date ?? d.createdAt),
    })),
    files: (l?.files || []).map((f: any) => ({
      id: sid(f),
      name: f.file_name ?? f.name ?? "",
      url: f.file_path ?? f.url ?? f.path ?? "",
    })).filter((f: LeadFile) => f.name || f.url),
    activity: [],
    clients: named(l?.assigned_clients ?? l?.clients),
    status: l?.status,
  };
}

/** Seed a freshly-opened lead with a small, reference-like starter set. */
export function seedLeadDetail(lead: {
  assignedTo?: string[];
}): LeadDetailData {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace("T", " ");
  const assignee = lead.assignedTo?.[0] || "David Wilson";
  return {
    notes: "",
    tasks: [],
    users: [
      { id: "company", name: "Company" },
      { id: "u-assignee", name: assignee },
    ],
    products: [
      { id: "p1", name: "Football" },
      { id: "p2", name: "Ink Cartridge" },
      { id: "p3", name: "Laptop" },
      { id: "p4", name: "Light Bulb" },
    ],
    sources: [
      { id: "s1", name: "Social Media Marketing" },
      { id: "s2", name: "Email Marketing" },
      { id: "s3", name: "Cold Calling" },
    ],
    calls: [],
    emails: [],
    discussions: [{ id: "d1", author: "Company", message: "200", date: stamp }],
    activity: [
      { id: "a1", kind: "sources", label: "Update Sources", date: stamp },
    ],
  };
}

export async function getLeadDetail(
  id: string | number,
  seed: LeadDetailData,
): Promise<LeadDetailData> {
  try {
    const row = await db.meta.get(metaKey(id));
    if (row?.value) return { ...clone(seed), ...row.value };
  } catch {
    /* fall through to seed */
  }
  return clone(seed);
}

export async function saveLeadDetail(
  id: string | number,
  value: LeadDetailData,
): Promise<void> {
  await db.meta.put({ key: metaKey(id), value });
}

/* ── backend sub-item sync (tasks/calls/emails/discussions + notes/status) ──
 * The detail pages build the whole LeadDetailData and call commit(next); we
 * diff it against the previous value and push each add/remove/update to the
 * matching /crm/(leads|deals)/:id/<sub> endpoint, then refresh from the server.
 */
async function syncCrmDetail(
  base: string,
  id: string,
  prev: LeadDetailData,
  next: LeadDetailData,
): Promise<void> {
  const jobs: Promise<any>[] = [];
  if ((prev.notes || "") !== (next.notes || "")) jobs.push(api.raw.patch(`${base}/${id}`, { notes: next.notes }));
  if (next.status && prev.status !== next.status) jobs.push(api.raw.patch(`${base}/${id}/status`, { status: next.status }));

  const syncSub = (
    sub: string,
    prevArr: any[] = [],
    nextArr: any[] = [],
    toBody: (x: any) => Record<string, any>,
    canUpdate = false,
  ) => {
    const nextIds = new Set(nextArr.map((x) => x.id));
    for (const n of nextArr) {
      if (!isBackendId(n.id)) jobs.push(api.raw.post(`${base}/${id}/${sub}`, toBody(n)));
      else if (canUpdate) {
        const p = prevArr.find((x) => x.id === n.id);
        if (p && JSON.stringify(p) !== JSON.stringify(n)) jobs.push(api.raw.patch(`${base}/${id}/${sub}/${n.id}`, toBody(n)));
      }
    }
    for (const p of prevArr) {
      if (isBackendId(p.id) && !nextIds.has(p.id)) jobs.push(api.raw.delete(`${base}/${id}/${sub}/${p.id}`));
    }
  };

  syncSub("tasks", prev.tasks, next.tasks, (t: LeadTask) => ({
    name: t.name, date: t.date, time: t.time, priority: t.priority,
    status: t.status === "Complete" ? "Completed" : t.status,
  }), true);
  syncSub("calls", prev.calls, next.calls, (c: LeadCall) => ({
    subject: c.subject, call_type: (c.callType || "Outbound").toLowerCase(),
    duration: c.duration, description: c.description, call_result: c.result,
  }), true);
  syncSub("emails", prev.emails, next.emails, (e: LeadEmail) => ({ to: e.to, subject: e.subject, description: e.description }));
  syncSub("discussions", prev.discussions, next.discussions, (d: LeadDiscussion) => ({ comment: d.message }));

  const syncRefs = (
    prevArr: LeadNamed[],
    nextArr: LeadNamed[],
    assignPath: string,
    deleteSegment: string,
    bodyKey: string,
  ) => {
    const prevIds = new Set(prevArr.map((x) => x.id));
    const nextIds = new Set(nextArr.map((x) => x.id));
    for (const n of nextArr) {
      if (!prevIds.has(n.id) && isBackendId(n.id)) {
        jobs.push(api.raw.post(`${base}/${id}/${assignPath}`, { [bodyKey]: n.id }));
      }
    }
    for (const p of prevArr) {
      if (!nextIds.has(p.id) && isBackendId(p.id)) {
        jobs.push(api.raw.delete(`${base}/${id}/${deleteSegment}/${p.id}`));
      }
    }
  };

  syncRefs(prev.users, next.users, "assign-users", "users", "user_id");
  syncRefs(prev.products, next.products, "assign-products", "products", "product_id");
  syncRefs(prev.sources, next.sources, "assign-sources", "sources", "source_id");
  if (next.clients !== undefined || prev.clients !== undefined) {
    syncRefs(prev.clients ?? [], next.clients ?? [], "assign-clients", "clients", "client_id");
  }

  syncSub(
    "files",
    prev.files ?? [],
    next.files ?? [],
    (f: LeadFile) => ({ file_name: f.name, file_path: f.url ?? "" }),
  );

  await Promise.all(jobs);
}

/** Push a lead's detail changes to the backend, then mirror the server truth locally. */
export async function syncLeadDetail(id: string, prev: LeadDetailData, next: LeadDetailData): Promise<void> {
  try {
    await syncCrmDetail("/crm/leads", id, prev, next);
    const res = await api.raw.get(`/crm/leads/${id}`);
    await saveLeadDetail(id, leadDetailFromApi((res.data?.data ?? res.data) as any));
  } catch {
    await saveLeadDetail(id, next); // offline / failure → keep the optimistic edit
  }
}

/** Push a deal's detail changes to the backend, then mirror the server truth locally. */
export async function syncDealDetail(id: string, prev: LeadDetailData, next: LeadDetailData): Promise<void> {
  try {
    await syncCrmDetail("/crm/deals", id, prev, next);
    const res = await api.raw.get(`/crm/deals/${id}`);
    await saveDealDetail(id, leadDetailFromApi((res.data?.data ?? res.data) as any));
  } catch {
    await saveDealDetail(id, next);
  }
}

/** Live per-lead detail (re-renders on save). Returns undefined until loaded. */
export function useLeadDetail(
  id: string | number | undefined,
): LeadDetailData | undefined {
  return useLiveQuery(async () => {
    if (id == null) return undefined;
    const row = await db.meta.get(metaKey(id));
    return (row?.value as LeadDetailData) || null;
  }, [id]) as LeadDetailData | undefined;
}

/* ── Deals share the same detail shape (+clients, +status) ── */
export function seedDealDetail(deal: {
  clients?: string[];
  sources?: string[];
  products?: string[];
  status?: string;
  creator?: string;
}): LeadDetailData {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return {
    notes: "",
    tasks: [],
    users: [{ id: "company", name: deal.creator || "Company" }],
    products: (deal.products || []).map((n) => ({ id: uidLike(), name: n })),
    sources: (deal.sources || []).map((n) => ({ id: uidLike(), name: n })),
    clients: (deal.clients || []).map((n) => ({ id: uidLike(), name: n })),
    calls: [],
    emails: [],
    discussions: [],
    activity: [
      { id: uidLike(), kind: "sources", label: "Deal created", date: stamp },
    ],
    status: deal.status || "Active",
  };
}

const uidLike = () => Math.random().toString(36).slice(2, 10);

export async function saveDealDetail(
  id: string | number,
  value: LeadDetailData,
): Promise<void> {
  await db.meta.put({ key: dealKey(id), value });
}

/** Live per-deal detail (re-renders on save). Returns undefined until loaded. */
export function useDealDetail(
  id: string | number | undefined,
): LeadDetailData | undefined {
  return useLiveQuery(async () => {
    if (id == null) return undefined;
    const row = await db.meta.get(dealKey(id));
    return (row?.value as LeadDetailData) || null;
  }, [id]) as LeadDetailData | undefined;
}
