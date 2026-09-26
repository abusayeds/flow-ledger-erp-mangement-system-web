/**
 * File: src/pages/dashboard/ProjectDashboard.tsx
 * Project Dashboard — live API data only (no seed / dummy rows).
 */

import React, { useEffect, useMemo, useState } from "react";
import { showToast } from "@/utils/toast";
import { fetchProjectDashboard } from "@/services/projectApi";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type ChartSlice = { name: string; value: number; color: string };
type MonthPoint = { month: string; tasksCompleted: number; tasksCreated: number };
type TeamRow = { name: string; completed: number; total: number; percentage: number };
type TaskCard = {
  id: string;
  name: string;
  priority: string;
  stage: string;
  stage_color?: string | null;
  project?: string;
};

const emptyStats = {
  total_projects: 0,
  overdue_projects: 0,
  completion_rate: 0,
  completed_tasks: 0,
  total_tasks: 0,
  total_bugs: 0,
  total_users: 0,
  total_clients: 0,
  pending_tasks: 0,
};

const emptyBugStats = { open: 0, resolved: 0 };

const STATUS_COLORS: Record<string, string> = {
  Ongoing: "#3B82F6",
  Finished: "#10B981",
  "On Hold": "#F59E0B",
  Onhold: "#F59E0B",
};
const PRIORITY_COLORS: Record<string, string> = {
  High: "#EF4444",
  Medium: "#F59E0B",
  Low: "#10B981",
};

function withSliceColors(rows: ChartSlice[], palette: Record<string, string>): ChartSlice[] {
  return rows.map((r) => ({
    name: r.name,
    value: Number(r.value) || 0,
    color: r.color || palette[r.name] || "#94A3B8",
  }));
}

function mapTeam(rows: any[]): TeamRow[] {
  return (rows || []).map((m) => {
    const total = Number(m.total ?? m.total_tasks ?? 0) || 0;
    const completed = Number(m.completed ?? m.completed_tasks ?? 0) || 0;
    const percentage =
      Number(m.percentage ?? m.completion_rate ?? (total > 0 ? Math.round((completed / total) * 100) : 0)) || 0;
    return {
      name: String(m.name || "Unknown"),
      completed,
      total,
      percentage,
    };
  });
}

function mapTasks(rows: any[]): TaskCard[] {
  return (rows || []).map((t, i) => ({
    id: String(t.id ?? t._id ?? i),
    name: String(t.name ?? t.title ?? "Untitled task"),
    priority: String(t.priority || "Medium"),
    stage: String(t.stage || "—"),
    stage_color: t.stage_color ?? null,
    project: t.project ? String(t.project) : undefined,
  }));
}

export const ProjectDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [monthlyProgressData, setMonthlyProgressData] = useState<MonthPoint[]>([]);
  const [projectStatusData, setProjectStatusData] = useState<ChartSlice[]>([]);
  const [taskPriorityData, setTaskPriorityData] = useState<ChartSlice[]>([]);
  const [teamPerformanceData, setTeamPerformanceData] = useState<TeamRow[]>([]);
  const [recentTasks, setRecentTasks] = useState<TaskCard[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [bugStats, setBugStats] = useState(emptyBugStats);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchProjectDashboard();
        if (!alive) return;

        setStats({ ...emptyStats, ...(d.stats || {}) });
        setBugStats({
          open: Number(d.bugStats?.open ?? d.stats?.total_bugs ?? 0) || 0,
          resolved: Number(d.bugStats?.resolved ?? 0) || 0,
        });

        setProjectStatusData(
          withSliceColors(Array.isArray(d.projectStatus) ? d.projectStatus : [], STATUS_COLORS),
        );
        setTaskPriorityData(
          withSliceColors(Array.isArray(d.taskPriority) ? d.taskPriority : [], PRIORITY_COLORS),
        );
        setTeamPerformanceData(mapTeam(Array.isArray(d.teamPerformance) ? d.teamPerformance : []));

        const monthRows = Array.isArray(d.monthlyProgress) ? d.monthlyProgress : [];
        setMonthlyProgressData(
          monthRows.map((m) => ({
            month: String(m.month || ""),
            tasksCompleted: Number(m.completed) || 0,
            tasksCreated: Number(m.created) || 0,
          })),
        );

        const taskRows = Array.isArray(d.recentTasks)
          ? d.recentTasks
          : Array.isArray(d.latestTasks)
            ? d.latestTasks
            : [];
        setRecentTasks(mapTasks(taskRows));
      } catch (err: any) {
        if (!alive) return;
        setStats(emptyStats);
        setBugStats(emptyBugStats);
        setProjectStatusData([]);
        setTaskPriorityData([]);
        setTeamPerformanceData([]);
        setMonthlyProgressData([]);
        setRecentTasks([]);
        showToast(err?.message || "Couldn't load project dashboard", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const statusTotal = useMemo(
    () => projectStatusData.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [projectStatusData],
  );
  const priorityTotal = useMemo(
    () => taskPriorityData.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [taskPriorityData],
  );
  const monthHasData = useMemo(
    () => monthlyProgressData.some((m) => m.tasksCompleted > 0 || m.tasksCreated > 0),
    [monthlyProgressData],
  );

  const getPriorityColor = (priority: string) => {
    switch (String(priority).toLowerCase()) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStageColor = (stage: string, stageColor?: string | null) => {
    if (stageColor) return undefined;
    const s = String(stage).toLowerCase();
    if (s.includes("done") || s.includes("complete")) return "bg-green-500";
    if (s.includes("progress")) return "bg-orange-500";
    if (s.includes("todo") || s.includes("to do")) return "bg-blue-500";
    return "bg-gray-500";
  };

  const Empty = ({ message }: { message: string }) => (
    <p className="text-sm text-gray-400 py-8 text-center">{message}</p>
  );

  if (loading) {
    return (
      <div className="dashboard-shell flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading project dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar">
        <h1 className="text-lg font-normal text-gray-900">Project Dashboard</h1>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                label: "Total Projects",
                value: String(stats.total_projects ?? 0),
                sub: `${stats.overdue_projects ?? 0} overdue`,
                color: "text-gray-900",
              },
              {
                label: "Task Completion",
                value: `${stats.completion_rate ?? 0}%`,
                sub: `${stats.completed_tasks ?? 0}/${stats.total_tasks ?? 0} completed`,
                color: "text-green-500",
              },
              {
                label: "Active Bugs",
                value: String(bugStats.open ?? stats.total_bugs ?? 0),
                sub: `${bugStats.resolved ?? 0} resolved`,
                color: "text-red-500",
              },
              {
                label: "Team Members",
                value: String(stats.total_users ?? 0),
                sub: "Staff members",
                color: "text-gray-900",
              },
              {
                label: "Total Clients",
                value: String(stats.total_clients ?? 0),
                sub: "Active clients",
                color: "text-orange-500",
              },
            ].map((c, i, arr) => {
              const cols = 5;
              const col = i % cols;
              const remainder = arr.length % cols;
              const lastRowStart = arr.length - (remainder || cols);
              const isLastRow = i >= lastRowStart;
              return (
                <div
                  key={c.label}
                  className={[
                    "px-3 py-4 text-center border-gray-200",
                    col !== cols - 1 ? "lg:border-r" : "",
                    i % 2 === 0 ? "max-sm:border-r" : "",
                    i % 3 !== 2 ? "max-lg:sm:border-r" : "",
                    !isLastRow ? "border-b" : "",
                  ].join(" ")}
                >
                  <h5 className={`text-xs font-medium mb-2 ${c.color}`}>{c.label}</h5>
                  <div className="text-sm font-semibold text-gray-900">{c.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Company Monthly Progress</h2>
          </div>
          <div className="p-4">
            {monthHasData ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyProgressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />
                  <Line type="monotone" dataKey="tasksCompleted" stroke="#10B981" strokeWidth={2} name="Tasks Completed" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="tasksCreated" stroke="#6B7280" strokeWidth={2} name="Tasks Created" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty message="No monthly task activity yet" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Project Status</h2>
            </div>
            <div className="p-4">
              {statusTotal > 0 ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                          {projectStatusData.map((entry, index) => (
                            <Cell key={`status-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {projectStatusData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-gray-700">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty message="No projects yet" />
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Task Priority</h2>
            </div>
            <div className="p-4">
              {priorityTotal > 0 ? (
                <>
                  <div className="flex items-center justify-center mb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={taskPriorityData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                          {taskPriorityData.map((entry, index) => (
                            <Cell key={`prio-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    {taskPriorityData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-gray-700">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty message="No tasks yet" />
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Team Performance</h2>
            </div>
            <div className="p-4">
              {teamPerformanceData.length > 0 ? (
                <div className="space-y-4">
                  {teamPerformanceData.map((member) => (
                    <div key={member.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{member.name}</span>
                        <span className="text-sm text-gray-500">
                          {member.completed}/{member.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gray-700 h-2 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, member.percentage))}%` }}
                        />
                      </div>
                      <div className="text-right text-xs text-gray-500 mt-1">{member.percentage}% completed</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty message="No assigned team tasks yet" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-900">Recent Company Tasks</h2>
            <span className="text-xs text-gray-500">
              {stats.completed_tasks ?? 0} of {stats.total_tasks ?? 0} tasks completed across all projects
            </span>
          </div>
          <div className="p-4">
            {recentTasks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentTasks.map((task) => {
                  const stageCls = getStageColor(task.stage, task.stage_color);
                  return (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-1 line-clamp-2 text-sm">{task.name}</h3>
                      {task.project && <p className="text-xs text-gray-400 mb-3 truncate">{task.project}</p>}
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Priority</div>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium text-white ${getPriorityColor(
                              task.priority,
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Stage</div>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium text-white ${stageCls || ""}`}
                            style={task.stage_color ? { backgroundColor: task.stage_color } : undefined}
                          >
                            {task.stage}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty message="No recent tasks" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
