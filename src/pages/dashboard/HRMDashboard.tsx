/**
 * File: src/pages/dashboard/HRMDashboard.tsx
 * HRM Dashboard — live API only; UI borders match root Summary dashboard.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "@/utils/toast";
import { fetchHrmDashboard, type HrmDashboardPayload } from "@/services/hrm";
import {
  PlusCircle,
  CheckSquare,
  FileText,
  DollarSign,
  TrendingUp,
  UserMinus,
  Bell,
  Clock,
  Gift,
  Briefcase,
  Loader2,
} from "lucide-react";
import { resolveMediaUrl } from "@/lib/env";

const emptyStats: HrmDashboardPayload["stats"] = {
  total_employees: 0,
  present_today: 0,
  absent_today: 0,
  on_leave: 0,
  total_branches: 0,
  total_departments: 0,
  promotions_this_month: 0,
  pending_leaves: 0,
  terminations_this_month: 0,
};

const Empty = ({ message }: { message: string }) => (
  <p className="text-sm text-gray-400 py-8 text-center">{message}</p>
);

const Panel: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}> = ({ title, subtitle, action, children, bodyClassName = "p-4" }) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className={bodyClassName}>{children}</div>
  </div>
);

export const HRMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(emptyStats);
  const [departmentDistribution, setDepartmentDistribution] = useState<
    HrmDashboardPayload["departmentDistribution"]
  >([]);
  const [employeesOnLeave, setEmployeesOnLeave] = useState<HrmDashboardPayload["employeesOnLeave"]>([]);
  const [recentLeaveApplications, setRecentLeaveApplications] = useState<
    HrmDashboardPayload["recentLeaveApplications"]
  >([]);
  const [announcements, setAnnouncements] = useState<HrmDashboardPayload["announcements"]>([]);
  const [teamMembers, setTeamMembers] = useState<HrmDashboardPayload["teamMembers"]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<HrmDashboardPayload["upcomingBirthdays"]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchHrmDashboard();
        if (!alive) return;
        setStats(d.stats);
        setDepartmentDistribution(d.departmentDistribution);
        setEmployeesOnLeave(d.employeesOnLeave);
        setRecentLeaveApplications(d.recentLeaveApplications);
        setAnnouncements(d.announcements);
        setTeamMembers(d.teamMembers);
        setUpcomingBirthdays(d.upcomingBirthdays);
      } catch (err: any) {
        if (!alive) return;
        setStats(emptyStats);
        setDepartmentDistribution([]);
        setEmployeesOnLeave([]);
        setRecentLeaveApplications([]);
        setAnnouncements([]);
        setTeamMembers([]);
        setUpcomingBirthdays([]);
        showToast(err?.message || "Couldn't load HRM dashboard", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const summaryCells: { label: string; value: string; sub: string; color: string }[] = [
    {
      label: "Total Employees",
      value: String(stats.total_employees ?? 0),
      sub: "Active employees",
      color: "text-gray-900",
    },
    {
      label: "Present Today",
      value: String(stats.present_today ?? 0),
      sub: "Clocked in",
      color: "text-green-500",
    },
    {
      label: "Absent Today",
      value: String(stats.absent_today ?? 0),
      sub: "Marked absent",
      color: "text-red-500",
    },
    {
      label: "On Leave",
      value: String(stats.on_leave ?? 0),
      sub: `${stats.pending_leaves ?? 0} pending`,
      color: "text-orange-500",
    },
    {
      label: "Branches",
      value: String(stats.total_branches ?? 0),
      sub: "Active branches",
      color: "text-gray-900",
    },
    {
      label: "Departments",
      value: String(stats.total_departments ?? 0),
      sub: "Across branches",
      color: "text-gray-900",
    },
    {
      label: "Promotions",
      value: String(stats.promotions_this_month ?? 0),
      sub: "This month",
      color: "text-gray-900",
    },
    {
      label: "Terminations",
      value: String(stats.terminations_this_month ?? 0),
      sub: "This month",
      color: "text-red-500",
    },
  ];

  const quickActions = [
    { name: "Add Employee", icon: PlusCircle, to: "/hrm/employees" },
    { name: "Attendance", icon: CheckSquare, to: "/hrm/attendance/attendances" },
    { name: "Leave Apps", icon: FileText, to: "/hrm/leave-management/leave-applications" },
    { name: "Payroll", icon: DollarSign, to: "/hrm/payslip/payroll" },
    { name: "Promotions", icon: TrendingUp, to: "/hrm/promotions" },
    { name: "Resignations", icon: UserMinus, to: "/hrm/resignations" },
  ];

  if (loading) {
    return (
      <div className="dashboard-shell flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading HRM dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar">
        <h1 className="text-lg font-normal text-gray-900">HRM Dashboard</h1>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            {summaryCells.map((c, i) => {
              const cols = 8;
              const col = i % cols;
              const remainder = summaryCells.length % cols;
              const lastRowStart = summaryCells.length - (remainder || cols);
              const isLastRow = i >= lastRowStart;
              return (
                <div
                  key={c.label}
                  className={[
                    "px-3 py-4 text-center border-gray-200",
                    col !== cols - 1 ? "lg:border-r" : "",
                    i % 2 === 0 ? "max-sm:border-r" : "",
                    i % 4 !== 3 ? "max-lg:sm:border-r" : "",
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

        <Panel title="Team Members" subtitle="Workforce snapshot">
          {teamMembers.length === 0 ? (
            <Empty message="No team members listed yet" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {teamMembers.map((member, idx) => (
                <div key={`${member.name}-${idx}`} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    {member.avatar ? (
                      <img
                        src={resolveMediaUrl(member.avatar)}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-semibold border border-gray-200">
                        {(member.name || "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm truncate">{member.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{member.role}</p>
                    </div>
                  </div>
                  {member.attendance != null && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Attendance</span>
                        <span className="text-xs font-medium text-gray-700">{member.attendance}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-gray-700 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, member.attendance))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {member.department && (
                    <div className="pt-2 border-t border-gray-200 flex items-center gap-1.5 text-xs text-gray-500">
                      <Briefcase className="w-3 h-3" />
                      <span className="truncate">{member.department}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel title="Department Distribution">
            {departmentDistribution.length === 0 ? (
              <Empty message="No department data" />
            ) : (
              <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto -mx-4 -my-4">
                {departmentDistribution.map((dept, idx) => (
                  <div key={`${dept.name}-${idx}`} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-700 truncate pr-2">{dept.name}</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{dept.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.name}
                    type="button"
                    onClick={() => navigate(action.to)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">{action.name}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Employees on Leave"
            action={
              <button
                type="button"
                onClick={() => navigate("/hrm/leave-management/leave-applications")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            }
          >
            {employeesOnLeave.length === 0 ? (
              <Empty message="No employees on leave" />
            ) : (
              <div className="divide-y divide-gray-200 -mx-4 -my-4">
                {employeesOnLeave.map((employee, idx) => (
                  <div key={`${employee.name}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {employee.avatar ? (
                        <img
                          src={resolveMediaUrl(employee.avatar)}
                          alt={employee.name}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-semibold border border-gray-200">
                          {(employee.name || "?").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{employee.name}</div>
                        <div className="text-xs text-gray-500 truncate">{employee.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {employee.days}d
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel
            title="Recent Leave Applications"
            action={
              <button
                type="button"
                onClick={() => navigate("/hrm/leave-management/leave-applications")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            }
            bodyClassName="p-0"
          >
            {recentLeaveApplications.length === 0 ? (
              <Empty message="No recent leave applications" />
            ) : (
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {recentLeaveApplications.map((leave, idx) => (
                  <div key={`${leave.name}-${idx}`} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {leave.name}
                        <span className="text-xs font-normal text-gray-500 ml-2">{leave.type}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {leave.startDate || "—"} – {leave.endDate || "—"} ({leave.days} days)
                      </div>
                    </div>
                    <span className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap">
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Upcoming Birthdays"
            action={<Gift className="w-4 h-4 text-gray-400" />}
            bodyClassName="p-0"
          >
            {upcomingBirthdays.length === 0 ? (
              <Empty message="No upcoming birthdays" />
            ) : (
              <div className="divide-y divide-gray-200">
                {upcomingBirthdays.map((birthday, idx) => (
                  <div key={`${birthday.name}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{birthday.name}</div>
                      {birthday.role && <div className="text-xs text-gray-500 truncate">{birthday.role}</div>}
                    </div>
                    <div className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap">
                      {birthday.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Announcements"
          action={
            <button
              type="button"
              onClick={() => navigate("/hrm/announcements")}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </button>
          }
          bodyClassName="p-0"
        >
          {announcements.length === 0 ? (
            <Empty message="No announcements" />
          ) : (
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {announcements.map((announcement, idx) => (
                <div key={`${announcement.title}-${idx}`} className="px-4 py-3 flex items-start gap-3">
                  <Bell className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 text-sm mb-0.5">{announcement.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                      {announcement.description || "—"}
                    </p>
                    {announcement.date && (
                      <div className="text-xs text-gray-400 mt-1.5">{announcement.date}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
