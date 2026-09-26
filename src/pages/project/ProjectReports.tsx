/**
 * File: src/pages/project/ProjectReports.tsx
 * Projects Report (ERPGo reference) in the Qayd dark theme.
 *   ProjectReports        -> list: per-project Tasks / Bugs / Milestones counts
 *   ProjectReportDetail   -> summary cards + Task Status pie + Priority bar +
 *                            Users table + Milestones table. All derived from
 *                            the Dexie project record (front-end only).
 */

import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Search, Filter, ChevronDown, ChevronLeft, ChevronRight, ArrowUpDown, Eye,
  Check, CalendarDays, ListChecks, TrendingUp, Users as UsersIcon,
} from "lucide-react";
import { useCollection } from "@/lib/db";
import {
  normalizeProject, reportMetrics, type ProjectRecord,
} from "@/lib/db/projectStore";

const fmt = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    Ongoing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Onhold: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Planning: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return map[s] || "bg-gray-500/10 text-gray-400 border-gray-500/20";
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className || ""}`}>{children}</div>
);

/* ══════════════════════════════════════════════════════════════════
   LIST
   ══════════════════════════════════════════════════════════════════ */
type SortField = "name" | "startDate" | "endDate" | "status";

export const ProjectReports: React.FC = () => {
  const navigate = useNavigate();
  const raw = useCollection<any>("projects", "name");
  const projects = useMemo(() => raw.map(normalizeProject), [raw]);

  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  const sortToggle = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
  };
  const filtered = useMemo(() => {
    let r = projects.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (statusFilter !== "All") r = r.filter((p) => p.status === statusFilter);
    r = [...r].sort((a, b) => {
      let av: any = a[sortField], bv: any = b[sortField];
      if (typeof av === "string") { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
      return av < bv ? (sortDir === "asc" ? -1 : 1) : av > bv ? (sortDir === "asc" ? 1 : -1) : 0;
    });
    return r;
  }, [projects, search, statusFilter, sortField, sortDir]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const SortH: React.FC<{ f: SortField; label: string }> = ({ f, label }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap" onClick={() => sortToggle(f)}>
      <div className="flex items-center gap-1">{label}<ArrowUpDown className={`w-3 h-3 ${sortField === f ? "text-blue-500" : "text-gray-400"}`} /></div>
    </th>
  );

  return (
    <div className="module-page-shell overflow-y-auto">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button><span>›</span>
          <button onClick={() => navigate("/project/projects")} className="hover:text-gray-700">Project</button><span>›</span>
          <span className="text-gray-900 font-medium">Project Reports</span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-5">Manage Project Reports</h1>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search projects..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white">
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n} per page</option>)}
              </select>
              <div className="relative">
                <button onClick={() => setShowFilters((s) => !s)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"><Filter className="w-4 h-4" /> Filters <ChevronDown className="w-3.5 h-3.5" /></button>
                {showFilters && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-xl z-20 py-1">
                    <div className="px-3 py-1.5 text-xs text-gray-500">Status</div>
                    {["All", "Planning", "Ongoing", "Onhold", "Completed"].map((s) => (
                      <button key={s} onClick={() => { setStatusFilter(s); setPage(1); setShowFilters(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${statusFilter === s ? "text-blue-600" : "text-gray-700"}`}>{s}{statusFilter === s && <Check className="w-4 h-4" />}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortH f="name" label="Project Name" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tasks</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Issues</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Milestones</th>
                  <SortH f="startDate" label="Start Date" />
                  <SortH f="endDate" label="End Date" />
                  <SortH f="status" label="Status" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paged.map((p) => {
                  const m = reportMetrics(p);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 text-gray-700">{m.done}/{m.total}</td>
                      <td className="px-4 py-3 text-gray-700">{m.bugResolved}/{m.bugTotal}</td>
                      <td className="px-4 py-3 text-gray-700">{m.msComplete}/{m.msTotal}</td>
                      <td className="px-4 py-3 text-gray-600">{p.startDate || "—"}</td>
                      <td className="px-4 py-3 text-red-400">{p.endDate || "—"}</td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(p.status)}`}>{p.status}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/project/projects-report/${p.id}`)} title="View report" className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No projects found.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to {Math.min(page * perPage, filtered.length)} of {filtered.length} results</div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"><ChevronLeft className="w-4 h-4" />Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 text-sm rounded-md ${page === n ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Next<ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   DETAIL
   ══════════════════════════════════════════════════════════════════ */
const PIE_COLORS = ["#22c55e", "#3b9dff"];
const tooltipStyle = { background: "#1a212a", border: "1px solid #2a333d", borderRadius: 8, color: "#fff" };

export const ProjectReportDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const raw = useCollection<any>("projects", "name");
  const project: ProjectRecord | null = useMemo(() => {
    const rec = raw.find((p) => String(p.id) === String(id));
    return rec ? normalizeProject(rec) : null;
  }, [raw, id]);

  if (!project) return (
    <div className="module-page-shell flex items-center justify-center text-gray-500">
      Project not found. <button onClick={() => navigate("/project/projects-report")} className="ml-2 text-blue-500">Back</button>
    </div>
  );
  const m = reportMetrics(project);
  const pieData = [{ name: "Done", value: m.done }, { name: "Todo", value: m.todo }];
  const barData = [
    { name: "High", value: m.priorities.High },
    { name: "Medium", value: m.priorities.Medium },
    { name: "Low", value: m.priorities.Low },
  ];

  const SummaryCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">{icon}{title}</div>
      {children}
    </Card>
  );

  return (
    <div className="module-page-shell overflow-y-auto">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button><span>›</span>
          <button onClick={() => navigate("/project/projects")} className="hover:text-gray-700">Project</button><span>›</span>
          <button onClick={() => navigate("/project/projects-report")} className="hover:text-gray-700">Project Report</button><span>›</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Project Report: {project.name}</h1>
          <button onClick={() => navigate("/project/projects-report")} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /> Back</button>
        </div>

        {/* summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard title={project.name} icon={<ListChecks className="w-4 h-4 text-blue-500" />}>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><span className="text-gray-500">Status:</span><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge(project.status)}`}>{project.status}</span></div>
              <div className="text-gray-700">Budget : {fmt(project.budget)}</div>
            </div>
          </SummaryCard>
          <SummaryCard title="Timeline" icon={<CalendarDays className="w-4 h-4 text-blue-500" />}>
            <div className="space-y-1.5 text-sm text-gray-700">
              <div>Start : {project.startDate || "—"}</div>
              <div>End : <span className="text-red-400">{project.endDate || "—"}</span></div>
            </div>
          </SummaryCard>
          <SummaryCard title="Tasks" icon={<ListChecks className="w-4 h-4 text-blue-500" />}>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total :</span><span className="text-gray-900 font-medium">{m.total}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Completed :</span><span className="text-emerald-400 font-medium">{m.done}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">In Progress :</span><span className="text-orange-400 font-medium">{m.todo}</span></div>
            </div>
          </SummaryCard>
          <SummaryCard title="Progress" icon={<TrendingUp className="w-4 h-4 text-blue-500" />}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Team Member :</span><span className="text-gray-900 font-medium">{project.members.length}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Complete :</span><span className="text-gray-900 font-medium">{m.completePct}%</span></div>
              <div className="h-2 rounded-full bg-gray-500/20 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${m.completePct}%` }} /></div>
            </div>
          </SummaryCard>
        </div>

        {/* charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="text-base font-semibold text-gray-900 mb-4">Task Status Distribution</div>
            <div className="flex items-center gap-4">
              <div className="h-56 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={90} stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 w-32">
                <div className="flex items-center justify-between px-3 py-2 rounded-md bg-emerald-500/10"><span className="flex items-center gap-2 text-sm text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Done</span><span className="font-semibold text-gray-900">{m.done}</span></div>
                <div className="flex items-center justify-between px-3 py-2 rounded-md bg-blue-500/10"><span className="flex items-center gap-2 text-sm text-blue-400"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Todo</span><span className="font-semibold text-gray-900">{m.todo}</span></div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-base font-semibold text-gray-900 mb-4">Task Priority Distribution</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
                  <XAxis dataKey="name" stroke="#8b96a5" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#8b96a5" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff10" }} />
                  <Bar dataKey="value" fill="#3b9dff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Users + Milestones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3"><UsersIcon className="w-4 h-4 text-blue-500" /> Users</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">NAME</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">ASSIGNED TASKS</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">DONE TASKS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {m.users.map((u) => (
                    <tr key={u.name}>
                      <td className="px-2 py-2.5 text-gray-900">{u.name}</td>
                      <td className="px-2 py-2.5 text-gray-700">{u.assigned}</td>
                      <td className="px-2 py-2.5 text-gray-700">{u.done}</td>
                    </tr>
                  ))}
                  {m.users.length === 0 && <tr><td colSpan={3} className="px-2 py-6 text-center text-gray-400">No users.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-base font-semibold text-gray-900 mb-3">Milestones</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="border-b border-gray-200">
                  <tr>
                    {["NAME", "PROGRESS", "COST", "STATUS", "START DATE", "END DATE"].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {project.milestones.map((ms) => (
                    <tr key={ms.id}>
                      <td className="px-2 py-2.5 text-gray-900">{ms.title}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-500/20 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${ms.progress}%` }} /></div>
                          <span className="text-xs text-gray-500">{ms.progress}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-gray-700">{fmt(ms.cost)}</td>
                      <td className="px-2 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ms.status === "Complete" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{ms.status}</span></td>
                      <td className="px-2 py-2.5 text-gray-600 whitespace-nowrap">{ms.startDate}</td>
                      <td className="px-2 py-2.5 text-red-400 whitespace-nowrap">{ms.endDate}</td>
                    </tr>
                  ))}
                  {project.milestones.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400">No milestones.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProjectReports;
