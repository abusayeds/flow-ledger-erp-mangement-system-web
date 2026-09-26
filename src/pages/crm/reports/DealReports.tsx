/**
 * File: src/pages/crm/DealReports.tsx
 * Deal Reports – tabs: General Report, Staff Report, Client Report, Pipeline Report
 * Charts: This Week Deal Status, Deal Sources Conversion, Per Month Deal
 * Includes: date range picker, staff list with bar chart, client table, pipeline distribution
 * Design matches provided screenshots using Recharts
 */

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import { toObject } from "@/services/_http";
import { useNavigate } from "react-router-dom";

import {
  Globe,
  BarChart3,
  Users,
  UserCheck,
  GitBranch,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
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
import { showToast } from "@/utils/toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = "general" | "staff" | "client" | "pipeline";

interface WeeklyDealData {
  day: string;
  won: number;
  lost: number;
}

interface SourceData {
  name: string;
  deals: number;
}

interface MonthlyData {
  month: string;
  deals: number;
}

interface StaffData {
  name: string;
  deals: number;
}

interface ClientData {
  name: string;
  deals: number;
}

interface PipelineData {
  name: string;
  value: number;
  color: string;
}

const PIE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 shadow-lg rounded border border-gray-200 text-sm">
        <p className="font-medium">{label}</p>
        {payload.map((p: any, idx: number) => (
          <p key={idx} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const DealReports: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ReportTab>("general");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("Feb 2026");

  const [weeklyData, setWeeklyData] = useState<WeeklyDealData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [clientData, setClientData] = useState<ClientData[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [stageData, setStageData] = useState<PipelineData[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const res: any = await api.get("/crm/reports/deals", { params });
      const d = toObject<any>(res?.data ?? res) || {};
      setWeeklyData(
        (d.weeklyWonLost ?? []).map((w: any) => ({
          day: w.day,
          won: Number(w.won) || 0,
          lost: Number(w.lost) || 0,
        })),
      );
      setSourceData(
        (d.sources ?? []).map((s: any) => ({
          name: s.source,
          deals: Number(s.count) || 0,
        })),
      );
      setMonthlyData(
        (d.monthly ?? []).map((m: any) => ({
          month: m.month,
          deals: Number(m.count) || 0,
        })),
      );
      setStaffData(
        (d.staff ?? []).map((s: any) => ({
          name: s.name,
          deals: Number(s.count) || 0,
        })),
      );
      setClientData(
        (d.client ?? []).map((c: any) => ({
          name: c.name,
          deals: Number(c.count) || 0,
        })),
      );
      setPipelineData(
        (d.pipeline ?? []).map((p: any, i: number) => ({
          name: p.pipeline,
          value: Number(p.total ?? p.count) || 0,
          color: PIE[i % PIE.length],
        })),
      );
      setStageData(
        (d.byStage ?? []).map((s: any, i: number) => ({
          name: s.name,
          value: Number(s.count) || 0,
          color: PIE[i % PIE.length],
        })),
      );
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async () => {
    if (!fromDate || !toDate) {
      showToast("Please select both from and to dates", "info");
      return;
    }
    const ok = await load({ from_date: fromDate, to_date: toDate });
    if (ok) showToast("Report generated successfully!", "success");
    else showToast("Failed to generate report", "error");
  };

  const dateToolbar = (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <AppDatePicker
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <AppDatePicker
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60"
        >
          Generate
        </button>
      </div>
    </div>
  );

  // ─── General Report (matches first screenshot) ─────────────────────────────
  const renderGeneralReport = () => (
    <div className="space-y-8">
      {/* This Week Deal Status - Grouped Bar Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          This Week Deal Status
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={weeklyData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="won" fill="#3b82f6" name="Won" />
            <Bar dataKey="lost" fill="#ef4444" name="Lost" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per Month Deal - Line Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Per Month Deal
          </h3>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {monthlyData.map((m) => (
              <option key={m.month}>{m.month}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={monthlyData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="deals"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Deals"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Sources Conversion - Horizontal Bar Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Deal Sources Conversion
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            layout="vertical"
            data={sourceData}
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={140} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="deals" fill="#f59e0b" name="Deals" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // ─── Staff Report (matches second screenshot) ──────────────────────────────
  const renderStaffReport = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Staff Performance
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Staff List */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                  Staff Member
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                  Deals
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staffData.map((staff) => (
                <tr key={staff.name} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {staff.name}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{staff.deals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Bar Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">
            Deals by Staff
          </h4>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              layout="vertical"
              data={staffData}
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="deals" fill="#8b5cf6" name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Summary Card */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-blue-600">
          {staffData.reduce((a, b) => a + b.deals, 0)}
        </div>
        <div className="text-sm text-gray-600">Total Deals Closed</div>
      </div>
    </div>
  );

  // ─── Client Report (matches third screenshot) ──────────────────────────────
  const renderClientReport = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Client Performance
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                Client Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                Deals
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clientData.map((client) => (
              <tr key={client.name} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">
                  {client.name}
                </td>
                <td className="px-4 py-2 text-gray-600">{client.deals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 bg-green-50 rounded-lg p-4 text-center">
        <div className="text-2xl font-bold text-green-600">
          {clientData.reduce((a, b) => a + b.deals, 0)}
        </div>
        <div className="text-sm text-gray-600">Total Deals</div>
      </div>
    </div>
  );

  // ─── Pipeline Report (matches fourth screenshot) ───────────────────────────
  const renderPipelineReport = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Pipeline Distribution
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Horizontal Bar Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">
            Deals by Pipeline
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              layout="vertical"
              data={pipelineData}
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#3b82f6" name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">
            Proportion by Pipeline
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pipelineData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine
              >
                {pipelineData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE[index % PIE.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {stageData.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-gray-600 mb-3">Stage distribution</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={stageData} margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#8b5cf6" name="Deals" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Stage Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipelineData.map((stage) => (
          <div
            key={stage.name}
            className="border rounded-lg p-4 text-center"
            style={{ borderTopColor: stage.color, borderTopWidth: 4 }}
          >
            <div className="text-lg font-semibold text-gray-900">
              {stage.name}
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {stage.value}
            </div>
            <div className="text-xs text-gray-500">deals</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Breadcrumb */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => navigate("/")}
              className="hover:text-gray-700"
            >
              Dashboard
            </button>
            <span>›</span>
            <button
              onClick={() => navigate("/crm")}
              className="hover:text-gray-700"
            >
              CRM
            </button>
            <span>›</span>
            <button
              onClick={() => navigate("/crm/lead-reports")}
              className="hover:text-gray-700"
            >
              Reports
            </button>
            <span>›</span>
            <span className="text-gray-900 font-medium">Deal Reports</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1 bg-white">
            <Globe className="w-4 h-4" />
            <span>en English</span>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Deal Reports</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-6">
          {[
            { id: "general", label: "General Report", icon: BarChart3 },
            { id: "staff", label: "Staff Report", icon: Users },
            { id: "client", label: "Client Report", icon: UserCheck },
            { id: "pipeline", label: "Pipeline Report", icon: GitBranch },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-full mx-auto">
          {dateToolbar}
          {activeTab === "general" && renderGeneralReport()}
          {activeTab === "staff" && renderStaffReport()}
          {activeTab === "client" && renderClientReport()}
          {activeTab === "pipeline" && renderPipelineReport()}
        </div>
      </div>
    </div>
  );
};

export default DealReports;
