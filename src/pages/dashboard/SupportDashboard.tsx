/**
 * Support Dashboard — live API only; UI borders match root Summary dashboard.
 * Prefers GET /dashboard/support, falls back to /support/dashboard.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "@/utils/toast";
import { fetchSupportDashboard, type SupportDashboardPayload } from "@/services/supportApi";
import { Loader2 } from "lucide-react";
import {
  AreaChart,
  Area,
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

const empty: SupportDashboardPayload = {
  stats: {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    todayTickets: 0,
    avgResponseTime: "—",
    categories: 0,
    resolutionRate: 0,
  },
  ticketTrends: [],
  statusDistribution: [],
  categoryDistribution: [],
  recentTickets: [],
};

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

export const SupportDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SupportDashboardPayload>(empty);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchSupportDashboard();
        if (alive) setData(d);
      } catch (err: any) {
        if (!alive) return;
        setData(empty);
        showToast(err?.message || "Couldn't load support dashboard", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { stats, ticketTrends, statusDistribution, categoryDistribution, recentTickets } = data;

  const trendsHasData = useMemo(
    () => ticketTrends.some((m) => m.tickets > 0 || m.resolved > 0),
    [ticketTrends],
  );
  const statusTotal = useMemo(
    () => statusDistribution.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [statusDistribution],
  );
  const categoryTotal = useMemo(
    () => categoryDistribution.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [categoryDistribution],
  );

  const avgLabel =
    typeof stats.avgResponseTime === "number"
      ? `${stats.avgResponseTime}h`
      : String(stats.avgResponseTime || "—");

  const summaryCells = [
    { label: "Total Tickets", value: String(stats.totalTickets), sub: "All time", color: "text-gray-900" },
    { label: "Open Tickets", value: String(stats.openTickets), sub: "Pending resolution", color: "text-orange-500" },
    {
      label: "Closed Tickets",
      value: String(stats.closedTickets),
      sub: `${stats.resolutionRate || 0}% resolution`,
      color: "text-green-500",
    },
    { label: "Today's Tickets", value: String(stats.todayTickets), sub: "Created today", color: "text-gray-900" },
    { label: "Avg Response", value: avgLabel, sub: "Response time", color: "text-gray-900" },
    { label: "Categories", value: String(stats.categories), sub: "Active categories", color: "text-gray-900" },
  ];

  if (loading) {
    return (
      <div className="dashboard-shell flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading support dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar">
        <h1 className="text-lg font-normal text-gray-900">Support Dashboard</h1>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {summaryCells.map((c, i) => {
              const cols = 6;
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

        <Panel title="Ticket Trends">
          {trendsHasData ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticketTrends}>
                  <defs>
                    <linearGradient id="ticketsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6B7280" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="tickets"
                    name="Created"
                    stroke="#6B7280"
                    fill="url(#ticketsGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#10B981"
                    fill="url(#resolvedGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty message="No ticket trend data yet" />
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Status Distribution">
            {statusTotal > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" outerRadius={80}>
                      {statusDistribution.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No status data" />
            )}
          </Panel>

          <Panel title="Category Distribution">
            {categoryTotal > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryDistribution} dataKey="value" nameKey="name" outerRadius={80}>
                      {categoryDistribution.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No category data" />
            )}
          </Panel>
        </div>

        <Panel
          title="Recent Tickets"
          action={
            <button
              type="button"
              onClick={() => navigate("/support-ticket/tickets")}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
            </button>
          }
          bodyClassName="p-0"
        >
          {recentTickets.length === 0 ? (
            <Empty message="No recent tickets" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                    <th className="px-4 py-2.5">Ticket</th>
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5">Requester</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentTickets.map((t) => (
                    <tr key={t.id || t.ticket_id}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{t.ticket_id}</td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[220px] truncate">{t.subject}</td>
                      <td className="px-4 py-2.5 text-gray-600">{t.name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{t.category}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-0.5">
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{t.created_at || "—"}</td>
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

export default SupportDashboard;
