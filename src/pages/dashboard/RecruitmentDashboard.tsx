/**
 * Recruitment Dashboard — live API only; UI borders match root Summary dashboard.
 * Prefers GET /dashboard/recruitment (hub), falls back to /recruitment/dashboard.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchRecruitmentDashboard,
  type RecruitmentDashboardPayload,
} from "@/services/recruitmentApi";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { resolveMediaUrl } from "@/lib/env";

const Empty = ({ message }: { message: string }) => (
  <p className="text-sm text-gray-400 py-8 text-center">{message}</p>
);

const Panel: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}> = ({ title, action, children, bodyClassName = "p-4" }) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
    <div className={bodyClassName}>{children}</div>
  </div>
);

const Avatar: React.FC<{ name: string; src?: string }> = ({ name, src }) => {
  const url = resolveMediaUrl(src);
  return url ? (
    <img src={url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-semibold border border-gray-200">
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
};

export const RecruitmentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["recruitment-dashboard"],
    queryFn: () => fetchRecruitmentDashboard(),
  });

  const empty: RecruitmentDashboardPayload = {
    stats: { total_candidates: 0, open_positions: 0, interviews: 0, hired: 0 },
    statusOverview: [],
    hiringFunnel: [],
    onboardingProgress: [],
    upcomingInterviews: [],
    recentCandidates: [],
    openPositions: [],
  };

  const payload = data ?? empty;
  const {
    stats,
    statusOverview,
    hiringFunnel,
    onboardingProgress,
    upcomingInterviews,
    recentCandidates,
    openPositions,
  } = payload;

  const statusTotal = statusOverview.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const onboardingTotal = onboardingProgress.reduce((s, r) => s + (Number(r.value) || 0), 0);

  const summaryCells: { label: string; value: string; sub: string; color: string }[] = [
    {
      label: "Total Candidates",
      value: String(stats.total_candidates ?? 0),
      sub: "In pipeline",
      color: "text-gray-900",
    },
    {
      label: "Open Positions",
      value: String(stats.open_positions ?? 0),
      sub: "Published jobs",
      color: "text-gray-900",
    },
    {
      label: "Interviews",
      value: String(stats.interviews ?? 0),
      sub: "Scheduled / total",
      color: "text-orange-500",
    },
    {
      label: "Hired",
      value: String(stats.hired ?? 0),
      sub: "Offers accepted",
      color: "text-green-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="dashboard-shell flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading recruitment dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar">
        <h1 className="text-lg font-normal text-gray-900">Recruitment Dashboard</h1>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {isError && (
          <div className="text-sm text-red-600 border border-gray-200 rounded-lg bg-white px-4 py-3">
            {(error as Error)?.message || "Couldn't load recruitment dashboard"}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {summaryCells.map((c, i) => (
              <div
                key={c.label}
                className={[
                  "px-3 py-4 text-center border-gray-200",
                  i % 2 === 0 ? "max-lg:border-r" : "",
                  i < 2 ? "max-lg:border-b" : "",
                  i !== summaryCells.length - 1 ? "lg:border-r" : "",
                ].join(" ")}
              >
                <h5 className={`text-xs font-medium mb-2 ${c.color}`}>{c.label}</h5>
                <div className="text-sm font-semibold text-gray-900">{c.value}</div>
                <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Candidate Status">
            {statusTotal > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusOverview} dataKey="value" nameKey="name" outerRadius={80}>
                      {statusOverview.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No candidate data" />
            )}
          </Panel>

          <Panel title="Onboarding Progress">
            {onboardingTotal > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={onboardingProgress} dataKey="value" nameKey="name" outerRadius={80}>
                      {onboardingProgress.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No onboarding data" />
            )}
          </Panel>
        </div>

        <Panel title="Hiring Funnel">
          {hiringFunnel.length === 0 ? (
            <Empty message="No funnel data" />
          ) : (
            <div className="space-y-3">
              {hiringFunnel.map((f) => (
                <div key={f.stage}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{f.stage}</span>
                    <span className="text-gray-500">
                      {f.candidates} ({f.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-700"
                      style={{
                        width: `${Math.max(Math.min(100, f.percentage), f.candidates > 0 ? 2 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel
            title="Upcoming Interviews"
            action={
              <button
                type="button"
                onClick={() => navigate("/recruitment/interview")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            }
            bodyClassName="p-0"
          >
            {upcomingInterviews.length === 0 ? (
              <Empty message="No upcoming interviews" />
            ) : (
              <ul className="divide-y divide-gray-200">
                {upcomingInterviews.map((iv, i) => (
                  <li key={i} className="px-4 py-3 flex items-center gap-3">
                    <Avatar name={iv.candidate} src={iv.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{iv.candidate}</p>
                      <p className="text-xs text-gray-500 truncate">{iv.position}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500 whitespace-nowrap">
                      <div>{iv.date || "—"}</div>
                      <div>{iv.time || ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent Candidates"
            action={
              <button
                type="button"
                onClick={() => navigate("/recruitment/candidates")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            }
            bodyClassName="p-0"
          >
            {recentCandidates.length === 0 ? (
              <Empty message="No candidates yet" />
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentCandidates.map((c, i) => (
                  <li key={i} className="px-4 py-3 flex items-center gap-3">
                    <Avatar name={c.name} src={c.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.position}</p>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap">
                      <div className="text-gray-700 border border-gray-200 rounded px-2 py-0.5 inline-block">
                        {c.stage}
                      </div>
                      <div className="text-gray-400 mt-1">{c.appliedDate || "—"}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel
          title="Open Positions"
          action={
            <button
              type="button"
              onClick={() => navigate("/recruitment/job-postings")}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </button>
          }
          bodyClassName="p-0"
        >
          {openPositions.length === 0 ? (
            <Empty message="No open positions" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                    <th className="px-4 py-2.5">Title</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Applicants</th>
                    <th className="px-4 py-2.5">Days open</th>
                    <th className="px-4 py-2.5">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {openPositions.map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.title}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.department || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.applicants}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.daysOpen}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default RecruitmentDashboard;
