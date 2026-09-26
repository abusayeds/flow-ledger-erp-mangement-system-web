/**
 * File: src/pages/dashboard/AccountDashboard.tsx
 * Account Dashboard — live API only; UI borders match root Summary dashboard.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "@/utils/toast";
import { fetchAccountDashboard } from "@/services/accountingApi";
import { Calendar, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

type MonthlyPayment = { month: string; amount: number };
type Txn = { id: string; amount: number; description: string; date: string };

const emptyStats = {
  total_clients: 0,
  total_vendors: 0,
  total_customer_payment: 0,
  total_vendor_payment: 0,
  total_revenue: 0,
  total_expense: 0,
  net_profit: 0,
};

const money = (v: unknown) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);

const yAxisTickFormatter = (value: number) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
};

const mapTxn = (r: any): Txn => ({
  id: String(r.title || r.id || r._id || "—"),
  amount: Number(r.amount) || 0,
  description: String(r.description || ""),
  date: r.date ? String(r.date).slice(0, 10) : "",
});

const Empty = ({ message }: { message: string }) => (
  <p className="text-sm text-gray-400 py-10 text-center">{message}</p>
);

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  subtitle,
  children,
  action,
}) => (
  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
    <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-200">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export const AccountDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(emptyStats);
  const [monthlyCustomerPayments, setMonthlyCustomerPayments] = useState<MonthlyPayment[]>([]);
  const [monthlyVendorPayments, setMonthlyVendorPayments] = useState<MonthlyPayment[]>([]);
  const [recentRevenue, setRecentRevenue] = useState<Txn[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Txn[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await fetchAccountDashboard();
        if (!alive) return;
        setStats({ ...emptyStats, ...(d.stats || {}) });

        const cust = Array.isArray(d.monthlyCustomerPayments)
          ? d.monthlyCustomerPayments
          : Array.isArray(d.monthlyPayments)
            ? d.monthlyPayments
            : [];
        setMonthlyCustomerPayments(
          cust.map((m: any) => ({
            month: String(m.month || ""),
            amount: Number(m.customer_payments ?? m.payments ?? 0) || 0,
          })),
        );

        const vend = Array.isArray(d.monthlyVendorPayments) ? d.monthlyVendorPayments : [];
        setMonthlyVendorPayments(
          vend.map((m: any) => ({
            month: String(m.month || ""),
            amount: Number(m.vendor_payments ?? m.payments ?? 0) || 0,
          })),
        );

        setRecentRevenue(
          Array.isArray(d.recentRevenues) ? d.recentRevenues.map(mapTxn) : [],
        );
        setRecentExpenses(
          Array.isArray(d.recentExpenses) ? d.recentExpenses.map(mapTxn) : [],
        );
      } catch (err: any) {
        if (!alive) return;
        setStats(emptyStats);
        setMonthlyCustomerPayments([]);
        setMonthlyVendorPayments([]);
        setRecentRevenue([]);
        setRecentExpenses([]);
        showToast(err?.message || "Couldn't load account dashboard", "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const chartData = useMemo(() => {
    const months = new Set([
      ...monthlyCustomerPayments.map((m) => m.month),
      ...monthlyVendorPayments.map((m) => m.month),
    ]);
    const vendByMonth = Object.fromEntries(monthlyVendorPayments.map((m) => [m.month, m.amount]));
    const custByMonth = Object.fromEntries(monthlyCustomerPayments.map((m) => [m.month, m.amount]));
    return [...months].filter(Boolean).map((month) => ({
      month,
      customerPayments: custByMonth[month] ?? 0,
      vendorPayments: vendByMonth[month] ?? 0,
    }));
  }, [monthlyCustomerPayments, monthlyVendorPayments]);

  const custHasData = monthlyCustomerPayments.some((m) => m.amount > 0);
  const vendHasData = monthlyVendorPayments.some((m) => m.amount > 0);
  const trendHasData = chartData.some((m) => m.customerPayments > 0 || m.vendorPayments > 0);

  const avgCustomer =
    monthlyCustomerPayments.length > 0
      ? monthlyCustomerPayments.reduce((s, m) => s + m.amount, 0) / monthlyCustomerPayments.length
      : 0;
  const avgVendor =
    monthlyVendorPayments.length > 0
      ? monthlyVendorPayments.reduce((s, m) => s + m.amount, 0) / monthlyVendorPayments.length
      : 0;

  const summaryCells: { label: string; value: string; color: string }[] = [
    { label: "Total Clients", value: String(stats.total_clients ?? 0), color: "text-gray-900" },
    { label: "Total Vendors", value: String(stats.total_vendors ?? 0), color: "text-gray-900" },
    {
      label: "Customer Payment",
      value: money(stats.total_customer_payment),
      color: "text-green-500",
    },
    {
      label: "Vendor Payment",
      value: money(stats.total_vendor_payment),
      color: "text-orange-500",
    },
    { label: "Total Revenue", value: money(stats.total_revenue), color: "text-green-500" },
    { label: "Total Expense", value: money(stats.total_expense), color: "text-red-500" },
  ];

  const footerCells: { label: string; value: string; sub: string }[] = [
    {
      label: "Net Profit",
      value: money(stats.net_profit),
      sub: "Revenue − Expense",
    },
    {
      label: "Avg Customer Payment",
      value: money(avgCustomer),
      sub: "Last 6 months",
    },
    {
      label: "Avg Vendor Payment",
      value: money(avgVendor),
      sub: "Last 6 months",
    },
    {
      label: "Recent Transactions",
      value: String(recentRevenue.length + recentExpenses.length),
      sub: "Shown below",
    },
  ];

  if (loading) {
    return (
      <div className="dashboard-shell flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading account dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar">
        <h1 className="text-lg font-normal text-gray-900">Account Dashboard</h1>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Summary strip — same grid/border pattern as root Dashboard */}
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
                  <div className="text-sm font-semibold text-gray-900 leading-snug">{c.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Monthly Customer Payments" subtitle="Revenue received from customers">
            {custHasData ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlyCustomerPayments}>
                    <defs>
                      <linearGradient id="customerGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#6B7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisTickFormatter} />
                    <Tooltip
                      formatter={(v) => money(Number(v) || 0)}
                      contentStyle={{ backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10B981"
                      strokeWidth={2}
                      fill="url(#customerGradient)"
                      name="Customer Payments"
                      dot={{ r: 3, fill: "#10B981" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total (6 mo)</span>
                  <span className="font-semibold text-gray-900">
                    {money(monthlyCustomerPayments.reduce((s, m) => s + m.amount, 0))}
                  </span>
                </div>
              </>
            ) : (
              <Empty message="No customer payments yet" />
            )}
          </Panel>

          <Panel title="Monthly Vendor Payments" subtitle="Payments made to vendors">
            {vendHasData ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={monthlyVendorPayments}>
                    <defs>
                      <linearGradient id="vendorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6B7280" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="month" stroke="#6B7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisTickFormatter} />
                    <Tooltip
                      formatter={(v) => money(Number(v) || 0)}
                      contentStyle={{ backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#6B7280"
                      strokeWidth={2}
                      fill="url(#vendorGradient)"
                      name="Vendor Payments"
                      dot={{ r: 3, fill: "#6B7280" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total (6 mo)</span>
                  <span className="font-semibold text-gray-900">
                    {money(monthlyVendorPayments.reduce((s, m) => s + m.amount, 0))}
                  </span>
                </div>
              </>
            ) : (
              <Empty message="No vendor payments yet" />
            )}
          </Panel>
        </div>

        <Panel title="Payment Trends Overview" subtitle="Customer vs vendor payments">
          {trendHasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisTickFormatter} />
                <Tooltip
                  formatter={(v) => money(Number(v) || 0)}
                  contentStyle={{ backgroundColor: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                <Line
                  type="monotone"
                  dataKey="customerPayments"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Customer Payments"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="vendorPayments"
                  stroke="#6B7280"
                  strokeWidth={2}
                  name="Vendor Payments"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty message="No payment trend data yet" />
          )}
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Recent Revenue</h2>
                <p className="text-xs text-gray-500 mt-0.5">Latest incoming transactions</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/accounting/revenue")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            </div>
            {recentRevenue.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentRevenue.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.id}</div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description || "—"}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                        <Calendar className="w-3 h-3" />
                        {item.date || "—"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{money(item.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty message="No recent revenue" />
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Recent Expenses</h2>
                <p className="text-xs text-gray-500 mt-0.5">Latest outgoing transactions</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/accounting/expense")}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            </div>
            {recentExpenses.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {recentExpenses.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.id}</div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description || "—"}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                        <Calendar className="w-3 h-3" />
                        {item.date || "—"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{money(item.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty message="No recent expenses" />
            )}
          </div>
        </div>

        {/* Footer metrics — same white + gray border cells, no tinted cards */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {footerCells.map((c, i) => (
              <div
                key={c.label}
                className={[
                  "px-3 py-4 text-center border-gray-200",
                  i % 2 === 0 ? "max-lg:border-r" : "",
                  i < 2 ? "max-lg:border-b" : "",
                  i !== footerCells.length - 1 ? "lg:border-r" : "",
                ].join(" ")}
              >
                <h5 className="text-xs font-medium text-gray-500 mb-2">{c.label}</h5>
                <div className="text-sm font-semibold text-gray-900">{c.value}</div>
                <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
