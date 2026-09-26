/**
 * File: src/pages/crm/LeadReports.tsx
 * Lead Reports – using Recharts for exact chart styling as screenshots
 * Tabs: General Report, Staff Report, Pipeline Report
 * Includes: date range picker, bar/line charts, source conversion, pipeline distribution
 */

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import { toObject } from "@/services/_http";
import { useNavigate } from "react-router-dom";

import {
  Globe,
  BarChart3,
  Users,
  GitBranch,
  Calendar,
  TrendingUp,
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
  Cell,
  PieChart,
  Pie,
  Sector,
} from "recharts";
import { showToast } from "@/utils/toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportTab = "general" | "staff" | "pipeline";

interface DayData {
  day: string;
  leads: number;
  conversions: number;
}

interface SourceData {
  name: string;
  leads: number;
}

interface StaffData {
  name: string;
  leads: number;
  conversions: number;
}

interface PipelineData {
  name: string;
  value: number;
  color: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];
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

export const LeadReports: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ReportTab>("general");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("February");

  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; leads: number }[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [staffData, setStaffData] = useState<StaffData[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [stageData, setStageData] = useState<PipelineData[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const res: any = await api.get("/crm/reports/leads", { params });
      const d = toObject<any>(res?.data ?? res) || {};
      setWeeklyData(
        (d.weeklyDetailed ?? []).map((w: any) => ({
          day: w.day,
          leads: Number(w.leads) || 0,
          conversions: Number(w.conversions) || 0,
        })),
      );
      setMonthlyData(
        (d.monthly ?? []).map((m: any) => ({
          month: m.month,
          leads: Number(m.count) || 0,
        })),
      );
      setSourceData(
        (d.sources ?? []).map((s: any) => ({
          name: s.source,
          leads: Number(s.count) || 0,
        })),
      );
      setStaffData(
        (d.staffDetailed ?? []).map((s: any) => ({
          name: s.name,
          leads: Number(s.leads) || 0,
          conversions: Number(s.conversions) || 0,
        })),
      );
      setPipelineData(
        (d.pipeline ?? []).map((p: any, i: number) => ({
          name: p.pipeline,
          value: Number(p.total ?? p.count ?? p.leads) || 0,
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

  // ─── General Report ────────────────────────────────────────────────────────
  const renderGeneralReport = () => (
    <div className="space-y-8">
      {/* This Week Leads & Conversions - Grouped Bar Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          This Week Leads & Conversions
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
            <Bar dataKey="leads" fill="#3b82f6" name="Leads" />
            <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per Month Lead - Line Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Per Month Lead
          </h3>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option>January</option>
            <option>February</option>
            <option>March</option>
            <option>April</option>
            <option>May</option>
            <option>June</option>
            <option>July</option>
            <option>August</option>
            <option>September</option>
            <option>October</option>
            <option>November</option>
            <option>December</option>
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
              dataKey="leads"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Leads"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sources Conversion - Horizontal Bar Chart (using BarChart with layout vertical but rotated) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Sources Conversion
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            layout="vertical"
            data={sourceData}
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="leads" fill="#f59e0b" name="Leads" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // ─── Staff Report ──────────────────────────────────────────────────────────
  const renderStaffReport = () => (
    <div className="space-y-6">
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Staff Performance
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                Staff Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                Leads Assigned
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                Conversions
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                Conversion Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staffData.map((staff) => (
              <tr key={staff.name} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {staff.name}
                </td>
                <td className="px-4 py-3 text-gray-600">{staff.leads}</td>
                <td className="px-4 py-3 text-gray-600">{staff.conversions}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {Math.round((staff.conversions / staff.leads) * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {staffData.reduce((a, b) => a + b.leads, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Leads</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {staffData.reduce((a, b) => a + b.conversions, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Conversions</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(
              (staffData.reduce((a, b) => a + b.conversions, 0) /
                staffData.reduce((a, b) => a + b.leads, 0)) *
                100,
            )}
            %
          </div>
          <div className="text-sm text-gray-600">Conversion Rate</div>
        </div>
      </div>
    </div>
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h4 className="text-sm font-medium text-gray-600 mb-3">Staff leads & conversions</h4>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={staffData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="leads" fill="#3b82f6" name="Leads" />
          <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
        </BarChart>
      </ResponsiveContainer>
    </div>
    </div>
  );

  // ─── Pipeline Report ───────────────────────────────────────────────────────
  const renderPipelineReport = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Pipeline Distribution
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Horizontal Bar Chart for Pipeline */}
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-3">
            Leads by Pipeline
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              layout="vertical"
              data={pipelineData}
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#3b82f6" name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Pie Chart */}
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
                labelLine={true}
              >
                {pipelineData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
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
              <Bar dataKey="value" fill="#8b5cf6" name="Leads" />
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
            <div className="text-xs text-gray-500">leads</div>
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
            <span className="text-gray-900 font-medium">Lead Reports</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1 bg-white">
            <Globe className="w-4 h-4" />
            <span>ga English</span>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Lead Reports</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-6">
          {[
            { id: "general", label: "General Report", icon: BarChart3 },
            { id: "staff", label: "Staff Report", icon: Users },
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
          {activeTab === "pipeline" && renderPipelineReport()}
        </div>
      </div>
    </div>
  );
};

export default LeadReports;
