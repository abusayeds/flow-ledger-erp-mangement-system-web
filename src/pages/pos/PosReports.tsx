/**
 * File: src/pages/pos/PosReports.tsx
 * POS Reports — Sales / Product / Customer reports matching
 * references/pos/product report/*.png in the Qayd blue theme: four stat
 * cards, a Top-10 bar chart, a distribution pie chart and a performance
 * table. All figures derive live from the persisted `pos:orders` sales.
 */

import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { money } from "@/lib/db";
import { getToken } from "@/lib/api/tokenStore";
import {
  posOrderStore,
  PosOrder,
  orderTax,
  orderTotal,
} from "@/lib/db/pos";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Package, DollarSign, Clock4, BarChart3, Users, ShoppingCart, TrendingUp } from "lucide-react";

const PIE_COLORS = ["#007aff", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#64748b", "#f97316", "#06b6d4"];

/* ── shared bits ───────────────────────────────────────────────── */

const CARD_TONES = {
  blue: "bg-blue-50 border-blue-100 text-blue-600",
  green: "bg-green-50 border-green-100 text-green-600",
  purple: "bg-purple-50 border-purple-100 text-purple-600",
  orange: "bg-orange-50 border-orange-100 text-orange-500",
} as const;

const PLAIN_CARD_TONES = {
  blue: "text-blue-600",
  green: "text-green-600",
  purple: "text-purple-600",
  orange: "text-orange-500",
} as const;

function StatCard({
  value,
  label,
  tone,
  icon: Icon,
  plain = false,
}: {
  value: string;
  label: string;
  tone: keyof typeof CARD_TONES;
  icon: React.ElementType;
  plain?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border px-5 py-5 text-center ${
        plain ? `border-gray-200 ${PLAIN_CARD_TONES[tone]}` : CARD_TONES[tone]
      }`}
    >
      <Icon className="absolute top-3 right-3 w-4 h-4 opacity-60" />
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-gray-600" />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="h-72">{children}</div>
    </div>
  );
}

function ReportShell({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "POS" }]} current={title} onNavigate={navigate} />
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-4 sm:p-6 space-y-6">{children}</div>
    </div>
  );
}

function useOrders(): PosOrder[] {
  const orders = posOrderStore.use();
  useEffect(() => {
    if (orders === null) void posOrderStore.save([]);
  }, [orders]);
  useEffect(() => {
    if (getToken()) void posOrderStore.hydrate();
  }, []);
  return useMemo(() => orders || [], [orders]);
}

function PerfTable({ title, icon: Icon, head, rows }: { title: string; icon: React.ElementType; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-gray-600" />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {r.map((c, j) => (
                  <td key={j} className={`px-4 py-3.5 ${j === 0 ? "font-medium text-gray-900" : "text-gray-600"}`}>{c}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={head.length} className="px-4 py-10 text-center text-gray-500">No data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tooltipStyle = { fontSize: 12, borderRadius: 8 };

/* ── Product Report ────────────────────────────────────────────── */

export const ProductReport: React.FC = () => {
  const orders = useOrders();

  const perProduct = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; qty: number; revenue: number; orders: number }>();
    for (const o of orders) {
      for (const i of o.items) {
        const rec = map.get(i.sku || i.name) || { name: i.name, sku: i.sku, qty: 0, revenue: 0, orders: 0 };
        rec.qty += i.qty;
        rec.revenue += i.qty * i.price * (1 + i.taxRate / 100);
        rec.orders += 1;
        map.set(i.sku || i.name, rec);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const totalRevenue = perProduct.reduce((s, p) => s + p.revenue, 0);
  const totalQty = perProduct.reduce((s, p) => s + p.qty, 0);
  const distinctProducts = perProduct.length;

  return (
    <ReportShell title="Product Report">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard value={String(distinctProducts)} label="Products Sold" tone="blue" icon={Package} plain />
        <StatCard value={money(totalRevenue)} label="Total Revenue" tone="green" icon={TrendingUp} plain />
        <StatCard value={String(totalQty)} label="Total Quantity" tone="purple" icon={Clock4} plain />
        <StatCard value={String(orders.length)} label="Total Orders" tone="orange" icon={BarChart3} plain />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Top 10 Products by Revenue" icon={BarChart3}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perProduct.slice(0, 10).map((p) => ({ name: p.name, value: +p.revenue.toFixed(2) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v) || 0)} />
              <Bar dataKey="value" fill="#007aff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Quantity Distribution" icon={Clock4}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={perProduct.slice(0, 10).map((p) => ({ name: p.name, value: p.qty }))} dataKey="value" nameKey="name" outerRadius="75%">
                {perProduct.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <PerfTable
        title="Product Performance Report"
        icon={Package}
        head={["Product Name", "SKU", "Quantity Sold", "Total Revenue", "Orders"]}
        rows={perProduct.map((p) => [p.name, p.sku || "—", p.qty, money(p.revenue), p.orders])}
      />
    </ReportShell>
  );
};

/* ── Customer Report ───────────────────────────────────────────── */

export const CustomerReport: React.FC = () => {
  const orders = useOrders();

  const perCustomer = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; spent: number; last: string }>();
    for (const o of orders) {
      const rec = map.get(o.customer) || { name: o.customer, orders: 0, spent: 0, last: "" };
      rec.orders += 1;
      rec.spent += orderTotal(o);
      if (o.date > rec.last) rec.last = o.date;
      map.set(o.customer, rec);
    }
    return Array.from(map.values()).sort((a, b) => b.spent - a.spent);
  }, [orders]);

  const totalRevenue = perCustomer.reduce((s, c) => s + c.spent, 0);
  const avg = orders.length ? totalRevenue / orders.length : 0;

  return (
    <ReportShell title="Customer Report">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard value={String(perCustomer.length)} label="Total Customers" tone="blue" icon={Users} plain />
        <StatCard value={money(totalRevenue)} label="Total Revenue" tone="green" icon={DollarSign} plain />
        <StatCard value={String(orders.length)} label="Total Orders" tone="purple" icon={ShoppingCart} plain />
        <StatCard value={money(avg)} label="Avg Order Value" tone="orange" icon={TrendingUp} plain />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard title="Top 10 Customers by Spending" icon={DollarSign}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perCustomer.slice(0, 10).map((c) => ({ name: c.name, value: +c.spent.toFixed(2) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v) || 0)} />
              <Bar dataKey="value" fill="#007aff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Order Distribution" icon={Users}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={perCustomer.map((c) => ({ name: c.name, value: c.orders }))} dataKey="value" nameKey="name" outerRadius="75%">
                {perCustomer.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <PerfTable
        title="Customer Performance Report"
        icon={Users}
        head={["Customer", "Total Orders", "Total Spent", "Avg Order Value", "Last Order"]}
        rows={perCustomer.map((c) => [c.name, c.orders, money(c.spent), money(c.spent / c.orders), c.last])}
      />
    </ReportShell>
  );
};

/* ── Sales Report ──────────────────────────────────────────────── */

export const SalesReport: React.FC = () => {
  const orders = useOrders();

  const byDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.date, (map.get(o.date) || 0) + orderTotal(o));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ name: date.slice(5), value: +value.toFixed(2) }));
  }, [orders]);

  const totalRevenue = orders.reduce((s, o) => s + orderTotal(o), 0);
  const taxCollected = orders.reduce((s, o) => s + orderTax(o), 0);
  const avg = orders.length ? totalRevenue / orders.length : 0;

  return (
    <ReportShell title="Sales Report">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard value={String(orders.length)} label="Total Sales" tone="blue" icon={ShoppingCart} plain />
        <StatCard value={money(totalRevenue)} label="Total Revenue" tone="green" icon={DollarSign} plain />
        <StatCard value={money(taxCollected)} label="Tax Collected" tone="purple" icon={BarChart3} plain />
        <StatCard value={money(avg)} label="Avg Order Value" tone="orange" icon={TrendingUp} plain />
      </div>

      <ChartCard title="Revenue by Day" icon={BarChart3}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byDate}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v) || 0)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="value" name="Revenue" fill="#007aff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <PerfTable
        title="Sales Performance Report"
        icon={ShoppingCart}
        head={["Sale Number", "Date", "Customer", "Items", "Tax", "Total"]}
        rows={orders.map((o) => [o.number, o.date, o.customer, o.items.length, money(orderTax(o)), money(orderTotal(o))])}
      />
    </ReportShell>
  );
};
