/**
 * CRM Dashboard — live API only; UI borders match root Summary dashboard.
 * Prefers GET /dashboard/crm, falls back to /crm/dashboard.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "@/utils/toast";
import { fetchCrmDashboard, type CrmDashboardPayload } from "@/services/crmApi";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
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

const empty: CrmDashboardPayload = {
  stats: { total_deals: 0, total_leads: 0, total_users: 0, total_clients: 0 },
  dealsByStage: [],
  callsByDay: [],
  dealCallsChart: [],
  recentDeals: [],
  recentLeads: [],
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

export const CRMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CrmDashboardPayload>(empty);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchCrmDashboard();
        if (alive) setData(d);
      } catch (err: any) {
        if (!alive) return;
        setData(empty);
        showToast(err?.message || "Couldn't load CRM dashboard", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { stats, dealsByStage, callsByDay, dealCallsChart, recentDeals, recentLeads } = data;
  const stageTotal = useMemo(
    () => dealsByStage.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [dealsByStage],
  );
  const callsHasData = useMemo(
    () => callsByDay.some((d) => d.calls > 0 || d.leads > 0),
    [callsByDay],
  );
  const dealCallsTotal = useMemo(
    () => dealCallsChart.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [dealCallsChart],
  );

  const summaryCells = [
    { label: "Total Deals", value: String(stats.total_deals), sub: "All pipelines", color: "text-gray-900" },
    { label: "Total Leads", value: String(stats.total_leads), sub: "In CRM", color: "text-gray-900" },
    { label: "Team Users", value: String(stats.total_users), sub: "Staff assigned", color: "text-gray-900" },
    { label: "Clients", value: String(stats.total_clients), sub: "Linked clients", color: "text-orange-500" },
  ];

  if (loading) {
    return (
      <div className="dashboard-shell flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading CRM dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar">
        <h1 className="text-lg font-normal text-gray-900">CRM Dashboard</h1>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
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
          <Panel title="Deals by Stage">
            {stageTotal > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dealsByStage} dataKey="value" nameKey="name" outerRadius={85}>
                      {dealsByStage.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No deals by stage yet" />
            )}
          </Panel>

          <Panel title={callsHasData ? "Calls & Leads by Day" : "Deal & Lead Calls"}>
            {callsHasData ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="calls" name="Deal calls" fill="#6B7280" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="leads" name="Leads" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : dealCallsTotal > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dealCallsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Calls" fill="#6B7280" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty message="No call activity yet" />
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel
            title="Recent Deals"
            action={
              <button
                type="button"
                onClick={() => navigate("/crm/deals")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            }
            bodyClassName="p-0"
          >
            {recentDeals.length === 0 ? (
              <Empty message="No recent deals" />
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentDeals.map((deal, i) => (
                  <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{deal.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{deal.date || "—"}</p>
                    </div>
                    <span className="text-xs text-gray-700 border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap">
                      {deal.stage}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent Leads"
            action={
              <button
                type="button"
                onClick={() => navigate("/crm/leads")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            }
            bodyClassName="p-0"
          >
            {recentLeads.length === 0 ? (
              <Empty message="No recent leads" />
            ) : (
              <ul className="divide-y divide-gray-200">
                {recentLeads.map((lead, i) => (
                  <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                      <p className="text-xs text-gray-500 truncate">{lead.project}</p>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{lead.date || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default CRMDashboard;
