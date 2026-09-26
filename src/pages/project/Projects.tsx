/**
 * Project module — list, detail, and Issue (bug) board.
 * All data from /api/v1/project/* (no Dexie / dummy rows).
 * Task board lives in ProjectTasks.tsx (task stages, not bug stages).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Search, Plus, Copy, Eye, Edit, Trash2, ChevronLeft,
  ArrowUpDown, X, Bug as BugIcon, ListChecks,
  Clock, DollarSign, Flag, Activity, Check,
} from "lucide-react";
import { buildListSortParam } from "@/lib/listSort";
import { showToast } from "../../utils/toast";
import {
  fetchProjects,
  fetchProjectDetail,
  fetchProjectActivity,
  createOrUpdateProject,
  deleteProject,
  duplicateProject,
  fetchProjectUsers,
  inviteMembers,
  removeMember,
  inviteClients,
  removeClient,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  fetchBugs,
  fetchBugStages,
  createOrUpdateBug,
  deleteBug,
  moveBugStage,
  type ProjectListRow,
  type ProjectDetail as ProjectDetailType,
  type ProjectMilestone,
  type ProjectUser,
  type BoardBug,
  type StageRow,
} from "@/services/projectApi";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const fmt = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const AVA_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"];
const avaColor = (name: string) => AVA_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVA_COLORS.length];

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 28 }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full text-white font-medium ring-2 ring-[var(--surface,#1a212a)] ${avaColor(name)}`}
    style={{ width: size, height: size, fontSize: size * 0.4 }}
    title={name}
  >
    {initials(name)}
  </span>
);
const AvatarStack: React.FC<{ names: string[]; max?: number }> = ({ names, max = 3 }) => (
  <div className="flex items-center -space-x-2">
    {names.slice(0, max).map((n, i) => <Avatar key={i} name={n} />)}
    {names.length > max && (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-xs font-medium ring-2 ring-[var(--surface,#1a212a)]">
        +{names.length - max}
      </span>
    )}
    {names.length === 0 && <span className="text-xs text-gray-400">—</span>}
  </div>
);

const PROJECT_STATUS = ["Ongoing", "Onhold", "Finished"] as const;
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    Ongoing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Onhold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Finished: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return map[s] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
};
const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    High: "bg-red-500/15 text-red-400",
    Medium: "bg-amber-500/15 text-amber-400",
    Low: "bg-emerald-500/15 text-emerald-400",
    Critical: "bg-red-500/20 text-red-500",
  };
  return map[p] || "bg-gray-500/15 text-gray-400";
};

const field =
  "keep-box ua-field w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600";
const label = "block text-sm font-medium text-gray-700 mb-1";

const Modal: React.FC<{
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}> = ({ title, onClose, children, footer, wide }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh] ${wide ? "max-w-2xl" : "max-w-md"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

const UserMultiSelect: React.FC<{
  options: ProjectUser[]; value: string[]; onChange: (v: string[]) => void; placeholder: string;
}> = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const filtered = options.filter(
    (o) => !q.trim() || o.name.toLowerCase().includes(q.toLowerCase()) || o.email.toLowerCase().includes(q.toLowerCase()),
  );
  const selectedNames = options.filter((o) => value.includes(o.id)).map((o) => o.name);
  return (
    <div ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${field} text-left`}>
        <span className={value.length ? "text-gray-900" : "text-gray-400"}>
          {value.length ? `${value.length} selected` : placeholder}
        </span>
      </button>
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedNames.map((n, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs">{n}</span>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-2 border border-gray-200 rounded-md overflow-hidden bg-white ua-dropdown-panel">
          <div className="p-2 border-b border-gray-100 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="keep-box ua-field w-full pl-8 pr-3 py-1.5 text-sm" />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((o) => (
              <button key={o.id} type="button" onClick={() => toggle(o.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 text-left">
                <span>{o.name}{o.email ? <span className="text-gray-400 text-xs ml-1">({o.email})</span> : null}</span>
                {value.includes(o.id) && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-gray-400">No results</div>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Create / Edit Project ───────────────────────────────────────── */
const CreateProjectModal: React.FC<{
  initial?: ProjectListRow | ProjectDetailType | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ initial, onClose, onSaved }) => {
  const { data: users = [] } = useQuery({ queryKey: ["project-users"], queryFn: fetchProjectUsers, staleTime: 60_000 });
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [budget, setBudget] = useState(String(initial?.budget ?? ""));
  const [status, setStatus] = useState(initial?.status && PROJECT_STATUS.includes(initial.status as any) ? initial.status : "Ongoing");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(initial?.members?.map((m) => m.id) ?? []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return showToast("Please enter a project name", "info");
    if (!startDate || !endDate) return showToast("Please select start and end dates", "info");
    if (!memberIds.length) return showToast("Select at least one team member", "info");
    setSaving(true);
    try {
      await createOrUpdateProject({
        project_id: initial?.id,
        name: name.trim(),
        description,
        budget: Number(budget) || 0,
        start_date: startDate,
        end_date: endDate,
        status,
        user_ids: memberIds,
      });
      showToast(initial?.id ? "Project updated" : "Project created", "success");
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial?.id ? "Edit Project" : "Create Project"}
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm">Cancel</button>
          <button disabled={saving} onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : initial?.id ? "Save" : "Create"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={label}>Name *</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Start *</label>
            <AppDatePicker className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={label}>End *</label>
            <AppDatePicker className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Budget</label>
            <input className={field} value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              {PROJECT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Team Members *</label>
          <UserMultiSelect options={users} value={memberIds} onChange={setMemberIds} placeholder="Search & select members" />
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea className={`${field} resize-y`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

/* ══════════════════════════════════════════════════════════════════
   LIST
   ══════════════════════════════════════════════════════════════════ */
type SortField = "name" | "budget" | "start_date" | "end_date" | "status";

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectListRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", page, perPage, search, sortField, sortAsc, statusFilter],
    queryFn: () =>
      fetchProjects({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam(sortField, sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projects"] });

  const sortToggle = (f: SortField) => {
    if (sortField === f) setSortAsc((a) => !a);
    else { setSortField(f); setSortAsc(true); }
    setPage(1);
  };

  const del = async (p: ProjectListRow) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteProject(p.id);
      showToast("Project deleted", "success");
      invalidate();
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const dup = async (p: ProjectListRow) => {
    try {
      await duplicateProject(p.id);
      showToast("Project duplicated", "success");
      invalidate();
    } catch (e: any) {
      showToast(e?.message || "Duplicate failed", "error");
    }
  };

  const SortH: React.FC<{ f: SortField; label: string }> = ({ f, label: lbl }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none" onClick={() => sortToggle(f)}>
      <div className="flex items-center gap-1">{lbl}<ArrowUpDown className={`w-3 h-3 ${sortField === f ? "text-blue-500" : "text-gray-400"}`} /></div>
    </th>
  );

  return (
    <div className="module-page-shell overflow-y-auto p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button>
          <span>›</span><span className="text-gray-900 font-medium">Projects</span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">Manage Projects</h1>
          <button onClick={() => setCreateOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Create Project">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search projects..."
                className="keep-box ua-field w-56 sm:w-72 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={`${field} w-auto`}
            >
              <option value="All">All Status</option>
              {PROJECT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              className={`${field} w-auto`}
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortH f="name" label="Name" />
                  <SortH f="status" label="Status" />
                  <SortH f="budget" label="Budget" />
                  <SortH f="start_date" label="Start" />
                  <SortH f="end_date" label="End" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/project/projects/${p.id}`)} className="font-semibold text-gray-900 hover:text-blue-500 text-left">
                        {p.name}
                      </button>
                      <div className="text-xs text-gray-400">{p.totalTasks} tasks</div>
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(p.status)}`}>{p.status}</span></td>
                    <td className="px-4 py-3 text-gray-800">{fmt(p.budget)}</td>
                    <td className="px-4 py-3 text-gray-600">{p.startDate || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{p.endDate || "—"}</td>
                    <td className="px-4 py-3"><AvatarStack names={p.members.map((m) => m.name)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/project/projects/${p.id}`)} title="View" className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setEditProject(p)} title="Edit" className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/10"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => void dup(p)} title="Duplicate" className="p-1.5 rounded-md text-purple-400 hover:bg-purple-500/10"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => void del(p)} title="Delete" className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No projects found.</td></tr>
                )}
                {isLoading && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm">
            <span className="text-gray-500">
              Showing {total === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40">‹ Previous</button>
              <span className="px-2 text-gray-600">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40">Next ›</button>
            </div>
          </div>
        </div>
      </div>

      {createOpen && <CreateProjectModal onClose={() => setCreateOpen(false)} onSaved={invalidate} />}
      {editProject && <CreateProjectModal initial={editProject} onClose={() => setEditProject(null)} onSaved={invalidate} />}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   DETAIL
   ══════════════════════════════════════════════════════════════════ */
export const ProjectDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editMilestone, setEditMilestone] = useState<ProjectMilestone | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: () => fetchProjectDetail(String(id)),
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["project-activity", id],
    queryFn: () => fetchProjectActivity(String(id)),
    enabled: !!id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["project-users"],
    queryFn: fetchProjectUsers,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-detail", id] });
    qc.invalidateQueries({ queryKey: ["project-activity", id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  if (isLoading) return <div className="module-page-shell flex items-center justify-center text-gray-500">Loading…</div>;
  if (!project) {
    return (
      <div className="module-page-shell flex items-center justify-center text-gray-500">
        Project not found. <button onClick={() => navigate("/project/projects")} className="ml-2 text-blue-500">Back</button>
      </div>
    );
  }

  const progressData = project.milestones.length
    ? project.milestones.map((m, i) => ({ name: `M${i + 1}`, value: m.progress }))
    : [{ name: "Start", value: 0 }, { name: "Now", value: 0 }];

  const StatTile: React.FC<{
    value: string; label: string; tint: string; icon: React.ReactNode; onClick?: () => void;
  }> = ({ value, label: lbl, tint, icon, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl p-4 border ${tint} flex flex-col text-left ${onClick ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between w-full">
        <div className="text-2xl font-bold">{value}</div>
        {icon}
      </div>
      <div className="text-xs mt-1 opacity-80">{lbl}</div>
    </button>
  );

  const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className || ""}`}>{children}</div>
  );

  return (
    <div className="module-page-shell overflow-y-auto p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button><span>›</span>
          <button onClick={() => navigate("/project/projects")} className="hover:text-gray-700">Project</button><span>›</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/project/projects")} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => navigate(`/project/projects/${project.id}/tasks`)}
              title="Task Board"
              className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <ListChecks className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/project/projects/${project.id}/bugs`)}
              title="Issue Board"
              className="flex items-center justify-center w-9 h-9 rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              <BugIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Flag className="w-4 h-4 text-blue-500" /> Project Details</h2>
              <button onClick={() => setEditOpen(true)} className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/10"><Edit className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Status</span><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(project.status)}`}>{project.status}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Start Date</span><span className="text-gray-900">{project.startDate || "—"}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">End Date</span><span className="text-red-400">{project.endDate || "—"}</span></div>
              <div><div className="text-gray-500 mb-1">Description</div><div className="text-gray-800">{project.description || "—"}</div></div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-blue-500" /> Project Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatTile
                value={String(project.totalTasks)}
                label="Tasks"
                tint="bg-blue-500/10 border-blue-500/20 text-blue-300"
                icon={<ListChecks className="w-5 h-5 text-blue-400" />}
                onClick={() => navigate(`/project/projects/${project.id}/tasks`)}
              />
              <StatTile
                value={String(project.totalBugs)}
                label="Issues"
                tint="bg-red-500/10 border-red-500/20 text-red-300"
                icon={<BugIcon className="w-5 h-5 text-red-400" />}
                onClick={() => navigate(`/project/projects/${project.id}/bugs`)}
              />
              <StatTile value={String(project.daysLeft)} label="Days Left" tint="bg-emerald-500/10 border-emerald-500/20 text-emerald-300" icon={<Clock className="w-5 h-5 text-emerald-400" />} />
              <StatTile value={fmt(project.budget)} label="Budget" tint="bg-amber-500/10 border-amber-500/20 text-amber-300" icon={<DollarSign className="w-5 h-5 text-amber-400" />} />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
              <button onClick={() => setTeamOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {project.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-100 hover:bg-gray-50">
                  <div className="flex items-center gap-2"><Avatar name={m.name} size={24} /><span className="text-sm text-gray-800">{m.name}</span></div>
                  <button
                    onClick={async () => {
                      try {
                        await removeMember(project.id, m.id);
                        invalidate();
                      } catch (e: any) {
                        showToast(e?.message || "Failed", "error");
                      }
                    }}
                    className="text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {project.members.length === 0 && <div className="text-sm text-gray-400 py-2">No team members yet.</div>}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Clients</h2>
              <button onClick={() => setClientOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {project.clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-gray-100 hover:bg-gray-50">
                  <div className="flex items-center gap-2"><Avatar name={c.name} size={24} /><span className="text-sm text-gray-800">{c.name}</span></div>
                  <button
                    onClick={async () => {
                      try {
                        await removeClient(project.id, c.id);
                        invalidate();
                      } catch (e: any) {
                        showToast(e?.message || "Failed", "error");
                      }
                    }}
                    className="text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {project.clients.length === 0 && <div className="text-sm text-gray-400 py-2">No clients yet.</div>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Progress</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                  <XAxis dataKey="name" stroke="#8b96a5" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8b96a5" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#1a212a", border: "1px solid #2a333d", borderRadius: 8, color: "#fff" }} />
                  <Line type="monotone" dataKey="value" stroke="#007aff" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Milestones</h2>
            <button onClick={() => { setEditMilestone(null); setMilestoneOpen(true); }} className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Title", "Cost", "Start Date", "End Date", "Status", "Progress", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {project.milestones.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.title}</td>
                    <td className="px-4 py-3 text-gray-800">{fmt(m.cost)}</td>
                    <td className="px-4 py-3 text-gray-600">{m.startDate}</td>
                    <td className="px-4 py-3 text-red-400">{m.endDate}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${m.status === "Complete" || m.status === "Completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"}`}>{m.status || "—"}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-gray-500/20 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${m.progress}%` }} /></div>
                        <span className="text-xs text-gray-500">{m.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditMilestone(m); setMilestoneOpen(true); }} className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/10"><Edit className="w-4 h-4" /></button>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete milestone?")) return;
                            try {
                              await deleteMilestone(m.id);
                              invalidate();
                            } catch (e: any) {
                              showToast(e?.message || "Failed", "error");
                            }
                          }}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {project.milestones.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No milestones yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-blue-500" /> Recent Activity</h2>
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-gray-700">{a.text}</span>
                <span className="text-xs text-gray-400 ml-auto">{a.time}</span>
              </div>
            ))}
            {activities.length === 0 && <div className="text-sm text-gray-400">No activity yet.</div>}
          </div>
        </Card>
      </div>

      {editOpen && <CreateProjectModal initial={project} onClose={() => setEditOpen(false)} onSaved={invalidate} />}
      {teamOpen && (
        <InviteModal
          title="Add Team Members"
          options={users.filter((u) => !project.members.some((m) => m.id === u.id))}
          onClose={() => setTeamOpen(false)}
          onSave={async (ids) => {
            await inviteMembers(project.id, ids);
            invalidate();
          }}
        />
      )}
      {clientOpen && (
        <InviteModal
          title="Share To Client"
          options={users.filter((u) => !project.clients.some((c) => c.id === u.id))}
          onClose={() => setClientOpen(false)}
          onSave={async (ids) => {
            await inviteClients(project.id, ids);
            invalidate();
          }}
        />
      )}
      {milestoneOpen && (
        <MilestoneModal
          projectId={project.id}
          initial={editMilestone}
          onClose={() => setMilestoneOpen(false)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
};

const InviteModal: React.FC<{
  title: string;
  options: ProjectUser[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}> = ({ title, options, onClose, onSave }) => {
  const [ids, setIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm">Cancel</button>
          <button
            disabled={saving || !ids.length}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(ids);
                showToast("Saved", "success");
                onClose();
              } catch (e: any) {
                showToast(e?.message || "Failed", "error");
              } finally {
                setSaving(false);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
          >
            Save
          </button>
        </>
      }
    >
      <UserMultiSelect options={options} value={ids} onChange={setIds} placeholder="Search users…" />
    </Modal>
  );
};

const MilestoneModal: React.FC<{
  projectId: string;
  initial: ProjectMilestone | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ projectId, initial, onClose, onSaved }) => {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [cost, setCost] = useState(String(initial?.cost ?? ""));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [status, setStatus] = useState(initial?.status || "Incomplete");
  const [progress, setProgress] = useState(String(initial?.progress ?? 0));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return showToast("Enter milestone title", "info");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        project_id: projectId,
        title: title.trim(),
        cost: Number(cost) || 0,
        start_date: startDate,
        end_date: endDate,
        status,
        progress: Number(progress) || 0,
        summary,
      };
      if (initial?.id) {
        body.milestone_id = initial.id;
        await updateMilestone(body);
      } else {
        await createMilestone(body);
      }
      showToast(initial?.id ? "Milestone updated" : "Milestone created", "success");
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e?.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? "Edit Milestone" : "Create Milestone"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm">Cancel</button>
          <button disabled={saving} onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div><label className={label}>Title *</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className={label}>Cost</label><input className={field} value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Start</label><AppDatePicker className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className={label}>End</label><AppDatePicker className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Status</label>
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Incomplete">Incomplete</option>
              <option value="Complete">Complete</option>
            </select>
          </div>
          <div><label className={label}>Progress %</label><input className={field} value={progress} onChange={(e) => setProgress(e.target.value)} /></div>
        </div>
        <div><label className={label}>Summary</label><textarea className={`${field} resize-y`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
      </div>
    </Modal>
  );
};

/* ══════════════════════════════════════════════════════════════════
   ISSUE / BUG BOARD (bug stages — NOT task stages)
   ══════════════════════════════════════════════════════════════════ */
export const ProjectBugs: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const [createStageId, setCreateStageId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: () => fetchProjectDetail(String(id)),
    enabled: !!id,
  });

  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["bug-stages"],
    queryFn: fetchBugStages,
  });

  const { data: bugData, isLoading: loadingBugs } = useQuery({
    queryKey: ["project-bugs", id],
    queryFn: () => fetchBugs(String(id), { page: 1, limit: 500 }),
    enabled: !!id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["project-users"],
    queryFn: fetchProjectUsers,
    staleTime: 60_000,
  });

  const bugs = bugData?.rows ?? [];

  const byStage = useMemo(() => {
    const map: Record<string, BoardBug[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const b of bugs) {
      const sid = b.stageId || stages[0]?.id;
      if (!sid) continue;
      if (!map[sid]) map[sid] = [];
      map[sid].push(b);
    }
    return map;
  }, [bugs, stages]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-bugs", id] });
    qc.invalidateQueries({ queryKey: ["project-detail", id] });
  };

  const move = async (bugId: string, stageId: string) => {
    try {
      await moveBugStage(bugId, stageId);
      invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed to move issue", "error");
    }
  };

  if (loadingProject || loadingStages || loadingBugs) {
    return <div className="module-page-shell flex items-center justify-center text-gray-500">Loading issue board…</div>;
  }
  if (!project) {
    return (
      <div className="module-page-shell flex items-center justify-center text-gray-500">
        Project not found. <button onClick={() => navigate("/project/projects")} className="ml-2 text-blue-500">Back</button>
      </div>
    );
  }

  return (
    <div className="module-page-shell overflow-y-auto p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button><span>›</span>
          <button onClick={() => navigate("/project/projects")} className="hover:text-gray-700">Project</button><span>›</span>
          <button onClick={() => navigate(`/project/projects/${project.id}`)} className="hover:text-gray-700">{project.name}</button><span>›</span>
          <span className="text-gray-900 font-medium">Issues</span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">{project.name} — Issues</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/project/projects/${project.id}`)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setCreateStageId(stages[0]?.id || null)}
              disabled={!stages.length}
              className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!stages.length ? (
          <div className="text-center text-gray-500 py-16">
            No bug stages yet. Configure them in{" "}
            <button onClick={() => navigate("/project/system-setup")} className="text-blue-500 underline">System Setup → Bug Stage</button>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {stages.map((col: StageRow) => {
              const colBugs = byStage[col.id] || [];
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) { void move(dragId, col.id); setDragId(null); } }}
                  className="rounded-xl border min-h-[420px] flex flex-col bg-red-500/[0.04] border-red-500/20"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-sm font-semibold text-gray-900">{col.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 text-xs">{colBugs.length}</span>
                    </div>
                    <button onClick={() => setCreateStageId(col.id)} className="text-gray-400 hover:text-blue-500"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-1 p-3 space-y-3">
                    {colBugs.map((b) => (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={() => setDragId(b.id)}
                        className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-gray-900 text-sm">{b.title}</div>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityBadge(b.priority)}`}>{b.priority}</span>
                        </div>
                        {b.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{b.description}</div>}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex -space-x-2">{b.assignees.map((a) => <Avatar key={a.id} name={a.name} size={22} />)}</div>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete issue?")) return;
                              try {
                                await deleteBug(b.id);
                                invalidate();
                              } catch (e: any) {
                                showToast(e?.message || "Failed", "error");
                              }
                            }}
                            className="text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {colBugs.length === 0 && <div className="text-center text-xs text-gray-400 py-8">Drop issues here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createStageId && (
        <CreateBugModal
          projectId={project.id}
          stageId={createStageId}
          users={users}
          onClose={() => setCreateStageId(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
};

const CreateBugModal: React.FC<{
  projectId: string;
  stageId: string;
  users: ProjectUser[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ projectId, stageId, users, onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return showToast("Enter issue title", "info");
    setSaving(true);
    try {
      await createOrUpdateBug({
        project_id: projectId,
        title: title.trim(),
        description,
        priority,
        stage_id: stageId,
        assigned_to: assignees,
      });
      showToast("Issue created", "success");
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e?.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create Issue"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm">Cancel</button>
          <button disabled={saving} onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">{saving ? "Saving…" : "Create"}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div><label className={label}>Title *</label><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <label className={label}>Priority</label>
          <select className={field} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {["Low", "Medium", "High", "Critical"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Assignees</label>
          <UserMultiSelect options={users} value={assignees} onChange={setAssignees} placeholder="Search users…" />
        </div>
        <div><label className={label}>Description</label><textarea className={`${field} resize-y`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
    </Modal>
  );
};

export default Projects;
