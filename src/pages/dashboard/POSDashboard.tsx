/**
 * File: src/pages/POSDashboard.tsx
 * Complete POS Dashboard with sales analytics, top products, and recent transactions
 */

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api/client";
import { toObject } from "@/services/_http";
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  MoreVertical,
  Eye,
  CreditCard,
  Smartphone,
  Laptop,
  Watch,
  Headphones,
  Camera,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Sales data for the chart
const salesDataSeed = [
  { name: "Mon", sales: 12450, orders: 145 },
  { name: "Tue", sales: 13820, orders: 162 },
  { name: "Wed", sales: 15240, orders: 178 },
  { name: "Thu", sales: 14890, orders: 169 },
  { name: "Fri", sales: 16780, orders: 195 },
  { name: "Sat", sales: 18920, orders: 212 },
  { name: "Sun", sales: 16270, orders: 188 },
];

// Category sales data
const categorySalesSeed = [
  { name: "Electronics", value: 35, color: "#3B82F6", sales: 58420 },
  { name: "Clothing", value: 25, color: "#10B981", sales: 41730 },
  { name: "Accessories", value: 20, color: "#F59E0B", sales: 33380 },
  { name: "Footwear", value: 12, color: "#8B5CF6", sales: 20030 },
  { name: "Others", value: 8, color: "#EF4444", sales: 13350 },
];

// Top products
const topProductsSeed = [
  {
    id: 1,
    name: "Wireless Headphones",
    category: "Electronics",
    sales: 284,
    revenue: 14200,
    trend: "up",
    image: "🎧",
  },
  {
    id: 2,
    name: "Smart Watch Pro",
    category: "Accessories",
    sales: 192,
    revenue: 11520,
    trend: "up",
    image: "⌚",
  },
  {
    id: 3,
    name: "Premium Backpack",
    category: "Accessories",
    sales: 156,
    revenue: 7800,
    trend: "down",
    image: "🎒",
  },
  {
    id: 4,
    name: "Running Shoes",
    category: "Footwear",
    sales: 148,
    revenue: 8880,
    trend: "up",
    image: "👟",
  },
  {
    id: 5,
    name: "Smartphone X",
    category: "Electronics",
    sales: 124,
    revenue: 24800,
    trend: "up",
    image: "📱",
  },
];

// Recent transactions
const recentTransactionsSeed = [
  {
    id: "TXN-001",
    customer: "John Doe",
    amount: 245.5,
    paymentMethod: "Credit Card",
    status: "completed",
    time: "10:30 AM",
    date: "2024-01-15",
  },
  {
    id: "TXN-002",
    customer: "Jane Smith",
    amount: 128.9,
    paymentMethod: "Cash",
    status: "completed",
    time: "11:15 AM",
    date: "2024-01-15",
  },
  {
    id: "TXN-003",
    customer: "Mike Johnson",
    amount: 89.99,
    paymentMethod: "Mobile Pay",
    status: "pending",
    time: "01:45 PM",
    date: "2024-01-15",
  },
  {
    id: "TXN-004",
    customer: "Sarah Wilson",
    amount: 567.2,
    paymentMethod: "Credit Card",
    status: "completed",
    time: "02:30 PM",
    date: "2024-01-15",
  },
  {
    id: "TXN-005",
    customer: "Robert Brown",
    amount: 45.5,
    paymentMethod: "Cash",
    status: "completed",
    time: "03:20 PM",
    date: "2024-01-15",
  },
];

// Stat cards data
const statCardsSeed = [
  {
    title: "Today's Sales",
    value: "6,421.50",
    change: "+12.5%",
    trend: "up",
    icon: DollarSign,
    color: "blue",
  },
  {
    title: "Today's Orders",
    value: "127",
    change: "+8.2%",
    trend: "up",
    icon: ShoppingBag,
    color: "green",
  },
  {
    title: "Avg Order Value",
    value: "52.75",
    change: "+3.1%",
    trend: "up",
    icon: TrendingUp,
    color: "purple",
  },
  {
    title: "Total Customers",
    value: "1,847",
    change: "+15.3%",
    trend: "up",
    icon: Users,
    color: "orange",
  },
];

// Payment method data
const paymentMethodsSeed = [
  { name: "Credit Card", value: 45, color: "#3B82F6" },
  { name: "Cash", value: 30, color: "#10B981" },
  { name: "Mobile Pay", value: 15, color: "#F59E0B" },
  { name: "Debit Card", value: 10, color: "#8B5CF6" },
];

const PALETTE = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];
const num = (v: unknown) => Number(v) || 0;

export const POSDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState("weekly");

  // Backend-backed dashboard data (falls back to the seed shapes on empty/error).
  const [salesData, setSalesData] = useState(salesDataSeed);
  const [categorySales, setCategorySales] = useState(categorySalesSeed);
  const [topProducts, setTopProducts] = useState<any[]>(topProductsSeed);
  const [recentTransactions, setRecentTransactions] = useState<any[]>(recentTransactionsSeed);
  const [statCards, setStatCards] = useState(statCardsSeed);
  const [paymentMethods, setPaymentMethods] = useState(paymentMethodsSeed);

  useEffect(() => {
    let alive = true;
    api
      .get("/pos/dashboard")
      .then((res: any) => {
        if (!alive) return;
        const d = toObject<any>(res?.data ?? res) || {};
        const stats = d.stats || {};
        const txns = (d.recentTransactions || []).map((t: any) => ({
          id: String(t.id ?? ""),
          customer: t.customer ?? "Walk-in",
          amount: num(t.amount),
          paymentMethod: t.method ?? "Cash",
          status: t.status ?? "completed",
          time: "",
          date: t.date ? String(t.date).slice(0, 10) : "",
        }));
        if (txns.length) setRecentTransactions(txns);

        if (d.salesByDay?.length)
          setSalesData(
            d.salesByDay.map((s: any) => ({
              name: s.label,
              sales: num(s.sales),
              orders: num(s.orders),
            })),
          );

        if (d.salesByCategory?.length)
          setCategorySales(
            d.salesByCategory.map((c: any, i: number) => ({
              name: c.name,
              value: num(c.value),
              color: PALETTE[i % PALETTE.length],
              sales: num(c.value),
            })),
          );

        if (d.topProducts?.length)
          setTopProducts(
            d.topProducts.map((p: any, i: number) => ({
              id: i + 1,
              name: p.name,
              category: p.category ?? "—",
              sales: num(p.sold),
              revenue: num(p.revenue),
              trend: "up",
              image: "📦",
            })),
          );

        if (d.paymentMethods?.length)
          setPaymentMethods(
            d.paymentMethods.map((m: any, i: number) => ({
              name: m.name,
              value: num(m.count),
              color: PALETTE[i % PALETTE.length],
            })),
          );

        if (Object.keys(stats).length) {
          const distinctCustomers = new Set(txns.map((t: any) => t.customer)).size;
          const fmt = (v: number) =>
            new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
          setStatCards((prev) =>
            prev.map((c, i) => ({
              ...c,
              value:
                i === 0
                  ? fmt(num(stats.totalSales))
                  : i === 1
                    ? String(stats.totalOrders ?? 0)
                    : i === 2
                      ? fmt(num(stats.avgOrderValue))
                      : String(distinctCustomers || stats.itemsSold || 0),
            })),
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPaymentIcon = (method: string): React.ReactNode => {
    switch (method) {
      case "Credit Card":
        return <CreditCard className="w-4 h-4" />;
      case "Cash":
        return <DollarSign className="w-4 h-4" />;
      case "Mobile Pay":
        return <Smartphone className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border border-gray-100">
          <p className="text-sm font-semibold text-gray-900 mb-1">{label}</p>
          <p className="text-sm text-blue-600">
            Sales: {formatCurrency(payload[0]?.value || 0)}
          </p>
          <p className="text-sm text-green-600">
            Orders: {payload[1]?.value || 0}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-shell custom-scrollbar p-4 md:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="dashboard-title-bar -mx-4 md:-mx-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 -mt-4 md:-mt-6">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
              POS Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Real-time sales analytics and inventory tracking
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex bg-white border border-gray-200 rounded-lg p-1">
              {["daily", "weekly", "monthly"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === range
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((stat, idx) => {
            const Icon = stat.icon;
            const colorClasses = {
              blue: "bg-blue-50 text-blue-600",
              green: "bg-green-50 text-green-600",
              purple: "bg-purple-50 text-purple-600",
              orange: "bg-orange-50 text-orange-600",
            };
            return (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      colorClasses[stat.color as keyof typeof colorClasses]
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      stat.trend === "up"
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {stat.title === "Today's Sales" ||
                  stat.title === "Avg Order Value"
                    ? formatCurrency(parseFloat(stat.value))
                    : stat.value}
                </div>
                <div className="text-xs text-gray-500 mt-1">{stat.title}</div>
              </div>
            );
          })}
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Sales & Orders Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Sales Overview
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Daily sales and order trends
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-gray-600">Sales</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-xs text-gray-600">Orders</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  stroke="#6B7280"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#6B7280"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#6B7280"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
                <Bar
                  yAxisId="left"
                  dataKey="sales"
                  fill="#3B82F6"
                  name="Sales ($)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="orders"
                  fill="#10B981"
                  name="Orders"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Sales by Category
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categorySales}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categorySales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  //   formatter={(value: number) => [`${value}%`, "Share"]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categorySales.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs text-gray-600">{cat.name}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900">
                    {cat.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products and Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Top Products */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Top Selling Products
              </h2>
              <button className="text-sm text-blue-600 hover:text-blue-700">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {topProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                      {product.image}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {product.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {product.category}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {product.sales} sold
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(product.revenue)}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-xs font-medium ${
                        product.trend === "up"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {product.trend === "up" ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {product.trend === "up" ? "+12%" : "-5%"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Payment Methods
            </h2>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {paymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  //   formatter={(value: number) => [`${value}%`, "Share"]}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {getPaymentIcon(method.name)}
                    <span className="text-sm text-gray-600">{method.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${method.value}%`,
                          backgroundColor: method.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-900">
                      {method.value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Recent Transactions
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Latest sales and payment activities
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">
                      {transaction.id}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {transaction.customer}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {getPaymentIcon(transaction.paymentMethod)}
                        <span className="text-sm text-gray-600">
                          {transaction.paymentMethod}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          transaction.status,
                        )}`}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        {transaction.time}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button className="text-gray-400 hover:text-gray-600">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {recentTransactions.length} of {recentTransactions.length}{" "}
              transactions
            </p>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors">
                Previous
              </button>
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Footer */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="text-xs text-blue-600 font-medium">
              Total Items Sold
            </div>
            <div className="text-xl font-bold text-blue-700">1,247</div>
            <div className="text-xs text-blue-500 mt-1">+18% vs last week</div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
            <div className="text-xs text-green-600 font-medium">
              Avg Daily Sales
            </div>
            <div className="text-xl font-bold text-green-700">
              {formatCurrency(15320)}
            </div>
            <div className="text-xs text-green-500 mt-1">
              +5.2% vs last week
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
            <div className="text-xs text-purple-600 font-medium">
              Conversion Rate
            </div>
            <div className="text-xl font-bold text-purple-700">68%</div>
            <div className="text-xs text-purple-500 mt-1">+3% vs last week</div>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
            <div className="text-xs text-orange-600 font-medium">
              Returning Customers
            </div>
            <div className="text-xl font-bold text-orange-700">42%</div>
            <div className="text-xs text-orange-500 mt-1">+7% vs last week</div>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-4 border border-red-100">
            <div className="text-xs text-red-600 font-medium">Stock Alert</div>
            <div className="text-xl font-bold text-red-700">8 items</div>
            <div className="text-xs text-red-500 mt-1">Need reorder</div>
          </div>
        </div>
      </div>
    </div>
  );
};
