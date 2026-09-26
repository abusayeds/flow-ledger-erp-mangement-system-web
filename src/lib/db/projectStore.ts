/**
 * File: src/lib/db/projectStore.ts
 * Rich project records for the ERPGo-style Project module (list, detail,
 * bug kanban). Everything persists in the Dexie `projects` collection; a
 * one-time V2 seed (guarded by a meta flag) loads the reference projects
 * with milestones/team/clients so the redesigned pages have real data.
 */

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { repo } from "./repo";

export type ProjectStatus = "Ongoing" | "Onhold" | "Completed" | "Planning";
export type MilestoneStatus = "Complete" | "Incomplete";
export type BugPriority = "Low" | "Medium" | "High";
export type BugStatus =
  | "Unconfirmed"
  | "Confirmed"
  | "In Progress"
  | "Resolved"
  | "Verified";

export interface Milestone {
  id: string;
  title: string;
  cost: number;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;
  progress: number;
  summary?: string;
}

export interface Bug {
  id: string;
  title: string;
  priority: BugPriority;
  assignees: string[];
  status: BugStatus;
  description: string;
}

export interface ProjectActivity {
  id: string;
  text: string;
  ts: number;
}

export interface ProjectRecord {
  id: number;
  name: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  description: string;
  members: string[];
  clients: string[];
  milestones: Milestone[];
  bugs: Bug[];
  activities: ProjectActivity[];
  totalTasks: number;
  completedTasks: number;
}

/** Team members available to assign (ERPGo demo user pool). */
export const TEAM_POOL = [
  "John Smith", "Michael Brown", "David Wilson", "Robert Taylor",
  "James Garcia", "Matthew Clark", "Christopher Lee", "Daniel Thompson",
  "Sarah Johnson", "Emily Davis",
];

export const BUG_STATUSES: BugStatus[] = [
  "Unconfirmed", "Confirmed", "In Progress", "Resolved", "Verified",
];

const uid = () => Math.random().toString(36).slice(2, 10);

const ms = (
  title: string, cost: number, startDate: string, endDate: string,
  status: MilestoneStatus, progress: number,
): Milestone => ({ id: uid(), title, cost, startDate, endDate, status, progress });

type SeedInput = Omit<ProjectRecord, "id" | "activities" | "bugs"> & {
  bugs?: Bug[];
};

const REFERENCE_PROJECTS: SeedInput[] = [
  {
    name: "Blockchain Payment Gateway", budget: 80000,
    startDate: "2026-01-09", endDate: "2026-04-19", status: "Onhold",
    description: "Secure blockchain-based gateway for digital transactions.",
    members: ["Christopher Lee", "Daniel Thompson"],
    clients: ["Lisa Anderson", "Innovative Corp"],
    totalTasks: 11, completedTasks: 3,
    milestones: [
      ms("Project Initiation & Planning", 8500, "2026-01-09", "2026-01-15", "Complete", 100),
      ms("System Architecture Design", 15000, "2026-01-25", "2026-01-31", "Incomplete", 0),
      ms("Backend Development Phase 1", 25000, "2026-02-10", "2026-02-21", "Incomplete", 0),
      ms("User Training & Documentation", 9000, "2026-02-26", "2026-03-04", "Incomplete", 0),
      ms("Production Deployment", 8000, "2026-03-14", "2026-03-25", "Incomplete", 0),
    ],
  },
  {
    name: "Virtual Event Platform", budget: 46000,
    startDate: "2025-12-30", endDate: "2026-03-30", status: "Onhold",
    description: "Scalable platform for hosting large virtual conferences and expos.",
    members: ["Michael Brown", "David Wilson"], clients: ["Sarah Johnson"], totalTasks: 5, completedTasks: 1,
    milestones: [ms("Discovery & Requirements", 6000, "2025-12-30", "2026-01-10", "Complete", 100)],
  },
  {
    name: "Warehouse Automation System", budget: 70000,
    startDate: "2025-12-25", endDate: "2026-04-04", status: "Onhold",
    description: "Robotics and IoT driven warehouse fulfilment automation.",
    members: ["Robert Taylor", "James Garcia"], clients: ["Innovative Corp"], totalTasks: 10, completedTasks: 3,
    milestones: [ms("Hardware Procurement", 20000, "2025-12-25", "2026-01-15", "Complete", 100)],
  },
  {
    name: "Data Analytics Dashboard", budget: 40000,
    startDate: "2025-10-31", endDate: "2026-03-05", status: "Ongoing",
    description: "Unified analytics dashboard with real-time KPIs and reporting.",
    members: ["John Smith", "Emily Davis", "David Wilson"], clients: ["Emily Davis"], totalTasks: 12, completedTasks: 8,
    milestones: [ms("Data Pipeline", 12000, "2025-10-31", "2025-11-20", "Complete", 100)],
  },
  {
    name: "Cloud Migration Project", budget: 60000,
    startDate: "2025-12-20", endDate: "2026-04-19", status: "Onhold",
    description: "Lift-and-shift plus re-architecture of legacy systems to the cloud.",
    members: ["Matthew Clark", "Michael Brown"], clients: ["Lisa Anderson"], totalTasks: 6, completedTasks: 3,
    milestones: [ms("Assessment", 10000, "2025-12-20", "2026-01-05", "Complete", 100)],
  },
  {
    name: "Smart IoT Home Automation", budget: 65000,
    startDate: "2025-12-10", endDate: "2026-04-09", status: "Onhold",
    description: "Connected home automation suite across lighting, climate and security.",
    members: ["Christopher Lee", "Robert Taylor"], clients: ["Sarah Johnson"], totalTasks: 10, completedTasks: 2,
    milestones: [ms("Prototype", 9000, "2025-12-10", "2025-12-28", "Complete", 100)],
  },
  {
    name: "Customer Feedback Portal", budget: 28000,
    startDate: "2025-11-30", endDate: "2026-02-23", status: "Ongoing",
    description: "Portal to collect, triage and act on customer feedback.",
    members: ["Emily Davis", "James Garcia"], clients: ["Emily Davis"], totalTasks: 8, completedTasks: 6,
    milestones: [ms("UX Research", 5000, "2025-11-30", "2025-12-12", "Complete", 100)],
  },
  {
    name: "Security Audit & Compliance", budget: 25000,
    startDate: "2025-11-25", endDate: "2026-02-18", status: "Ongoing",
    description: "SOC2 readiness audit and compliance remediation program.",
    members: ["David Wilson", "Matthew Clark", "John Smith"], clients: ["Innovative Corp"], totalTasks: 6, completedTasks: 3,
    milestones: [ms("Gap Analysis", 6000, "2025-11-25", "2025-12-10", "Complete", 100)],
  },
  {
    name: "Online Ticket Booking System", budget: 42000,
    startDate: "2025-11-15", endDate: "2026-02-28", status: "Ongoing",
    description: "High-throughput ticketing with seat maps and payments.",
    members: ["John Smith", "Michael Brown", "Daniel Thompson"], clients: ["Sarah Johnson"], totalTasks: 5, completedTasks: 1,
    milestones: [ms("Core Booking Flow", 14000, "2025-11-15", "2025-12-10", "Complete", 100)],
  },
  {
    name: "AI Chatbot Development", budget: 45000,
    startDate: "2025-11-10", endDate: "2026-03-15", status: "Ongoing",
    description: "Retrieval-augmented conversational assistant for support.",
    members: ["Emily Davis", "James Garcia"], clients: ["Emily Davis"], totalTasks: 6, completedTasks: 4,
    milestones: [ms("Intent Model", 11000, "2025-11-10", "2025-12-01", "Complete", 100)],
  },
];

/** Seed the reference projects (idempotent by name) + one-time patch of the
 *  report task metrics onto them. Safe to call on every mount. */
export async function seedProjectsV2(): Promise<void> {
  const existing = await repo.getAll("projects");
  const names = new Set(existing.map((p: any) => p.name));
  for (const p of REFERENCE_PROJECTS) {
    if (names.has(p.name)) continue;
    await repo.add("projects", {
      ...p,
      bugs: p.bugs ?? [],
      activities: [{ id: uid(), text: `Project "${p.name}" created`, ts: Date.now() }],
    });
  }
  await db.meta.put({ key: "project:seededV2", value: true });

  // Patch task metrics onto already-seeded reference projects (idempotent).
  const patched = await db.meta.get("project:reportDataV1");
  if (!patched?.value) {
    const fresh = await repo.getAll("projects");
    for (const ref of REFERENCE_PROJECTS) {
      const rec = fresh.find((p: any) => p.name === ref.name);
      if (rec) await repo.update("projects", rec.id, { totalTasks: ref.totalTasks, completedTasks: ref.completedTasks });
    }
    await db.meta.put({ key: "project:reportDataV1", value: true });
  }
}

/** Fill in defaults for any legacy/partial project record. */
export function normalizeProject(p: any): ProjectRecord {
  return {
    id: p.id,
    name: p.name ?? "Untitled Project",
    budget: Number(p.budget ?? 0),
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    status: (p.status as ProjectStatus) ?? "Planning",
    description: p.description ?? p.subtitle ?? "",
    members: Array.isArray(p.members) ? p.members : [],
    clients: Array.isArray(p.clients) ? p.clients : [],
    milestones: Array.isArray(p.milestones) ? p.milestones : [],
    bugs: Array.isArray(p.bugs) ? p.bugs : [],
    activities: Array.isArray(p.activities) ? p.activities : [],
    totalTasks: Number(p.totalTasks ?? 0),
    completedTasks: Number(p.completedTasks ?? 0),
  };
}

/* ── Derived report metrics (front-end only, deterministic) ──────── */
export interface ReportMetrics {
  total: number; done: number; todo: number;
  priorities: { High: number; Medium: number; Low: number };
  users: { name: string; assigned: number; done: number }[];
  bugTotal: number; bugResolved: number;
  msTotal: number; msComplete: number;
  completePct: number;
}
export function reportMetrics(p: ProjectRecord): ReportMetrics {
  const total = p.totalTasks;
  const done = Math.min(total, p.completedTasks);
  const todo = total - done;
  const high = Math.round(total * 0.45);
  const medium = Math.round(total * 0.45);
  const low = Math.max(0, total - high - medium);
  const members = p.members.length ? p.members : ["Unassigned"];
  const users = members.map((name, i) => {
    const assigned = Math.round(total / members.length) + (i === 0 ? total % members.length : 0);
    const doneN = Math.min(assigned, Math.round(done / members.length) + (i === 0 ? done % members.length : 0));
    return { name, assigned, done: doneN };
  });
  const bugResolved = p.bugs.filter((b) => b.status === "Resolved" || b.status === "Verified").length;
  const msComplete = p.milestones.filter((m) => m.status === "Complete").length;
  return {
    total, done, todo,
    priorities: { High: high, Medium: medium, Low: low },
    users,
    bugTotal: p.bugs.length, bugResolved,
    msTotal: p.milestones.length, msComplete,
    completePct: total ? Math.round((done / total) * 100) : 0,
  };
}

/* ── System Setup: task & bug stages (Dexie meta) ────────────────── */
export interface Stage { id: string; name: string; color: string; isDone?: boolean }

const DEFAULT_TASK_STAGES: Stage[] = [
  { id: uid(), name: "Todo", color: "#3B82F6" },
  { id: uid(), name: "In Progress", color: "#374151" },
  { id: uid(), name: "Review", color: "#06B6D4" },
  { id: uid(), name: "Done", color: "#22C55E", isDone: true },
];
const DEFAULT_BUG_STAGES: Stage[] = [
  { id: uid(), name: "Unconfirmed", color: "#60A5FA" },
  { id: uid(), name: "Confirmed", color: "#7C3AED" },
  { id: uid(), name: "In Progress", color: "#06B6D4" },
  { id: uid(), name: "Resolved", color: "#22C55E" },
  { id: uid(), name: "Verified", color: "#374151", isDone: true },
];

const STAGE_KEY = { task: "project:taskStages", bug: "project:bugStages" } as const;
export type StageKind = keyof typeof STAGE_KEY;

export async function getStages(kind: StageKind): Promise<Stage[]> {
  const row = await db.meta.get(STAGE_KEY[kind]);
  if (row?.value) return row.value as Stage[];
  const seed = kind === "task" ? DEFAULT_TASK_STAGES : DEFAULT_BUG_STAGES;
  await db.meta.put({ key: STAGE_KEY[kind], value: seed });
  return seed;
}
export async function saveStages(kind: StageKind, stages: Stage[]): Promise<void> {
  await db.meta.put({ key: STAGE_KEY[kind], value: stages });
}
export function useStages(kind: StageKind): Stage[] | undefined {
  const row = useLiveQuery(() => db.meta.get(STAGE_KEY[kind]), [kind]);
  useEffect(() => { getStages(kind); }, [kind]);
  return row?.value as Stage[] | undefined;
}

export const newBugId = uid;
export const newMilestoneId = uid;
export const newStageId = uid;
