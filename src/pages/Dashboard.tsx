/**
 * File: src/pages/Dashboard.tsx
 * Summary dashboard — Summary cards + dynamic chart + Top Products.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import { RecentActivities } from "@/components/ui/RecentActivities";
import {
  ChevronDown,
  ListFilter,
  Info,
  Check,
  BarChart3,
  CircleDot,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  loadDashboardSummaryCards,
  type DashboardSummaryCard,
} from "@/services/dashboardSummaryApi";
import {
  loadDashboardChartView,
  type ChartMetric,
  type ChartTimeUnit,
  type ChartPoint,
  type ChartSeries,
  type DonutSlice,
} from "@/services/dashboardChartApi";

function useOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return ref;
}

const CaretMenu: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
  align?: "left" | "right";
  triggerClass?: string;
  bold?: boolean;
}> = ({ value, options, onChange, align = "left", triggerClass = "", bold }) => {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 text-sm ${
          bold ? "font-semibold text-gray-900" : "text-gray-700"
        } hover:text-gray-900 transition-colors ${triggerClass}`}
      >
        <ChevronDown className="w-4 h-4 text-gray-500" />
        <span>{value}</span>
      </button>
      {open && (
        <div
          className={`absolute z-40 mt-2 min-w-[170px] max-h-[320px] overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-md shadow-xl py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <span>{opt}</span>
              {opt === value && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const LABEL_COLOR: Record<DashboardSummaryCard["color"], string> = {
  red: "text-red-500",
  green: "text-green-500",
  orange: "text-orange-500",
  muted: "text-gray-400",
  profit: "text-gray-900",
};

const filterOptions = [
  "Outstanding",
  "Cash In Hand",
  "Total Bank Balance",
  "Sales",
  "Payments",
  "Expenses",
  "Payable Amount",
  "Payment Made",
  "Purchase Orders",
  "Overdue",
  "Bills",
  "Credit Notes",
  "Debit Notes",
  "Estimates",
  "Net Profit",
  "Draft Invoices",
  "Proforma Invoices",
  "Time Logs",
];

const periodOptions = [
  "Today",
  "This Week",
  "Last Week",
  "This Month",
  "Last 30 Days",
  "Last Month",
  "Last 90 Days",
  "This Quarter",
  "Last Quarter",
  "Last 6 Months",
  "This Year",
  "Last 12 Months",
  "Last Year",
  "This Financial Year",
  "Last Financial Year",
];

export const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState("This Year");
  const [metric, setMetric] = useState<ChartMetric>("Sales");
  const [timeUnit, setTimeUnit] = useState<ChartTimeUnit>("Days");
  const [currency, setCurrency] = useState("$ USD");
  const [chartType, setChartType] = useState<"bar" | "donut">("bar");
  const [custMode, setCustMode] = useState("Top Customers");
  const [activityFilter, setActivityFilter] = useState("All");
  const [custCurrency, setCustCurrency] = useState("All");
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(filterOptions.map((k) => [k, true])),
  );

  const [summaryCards, setSummaryCards] = useState<DashboardSummaryCard[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; amount: string }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; amount: string }[]>([]);
  const [topVendors, setTopVendors] = useState<{ name: string; amount: string }[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartSeries, setChartSeries] = useState<ChartSeries[]>([]);
  const [donutData, setDonutData] = useState<DonutSlice[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const loadSummary = useCallback(async (periodLabel: string) => {
    setSummaryLoading(true);
    try {
      const data = await loadDashboardSummaryCards(periodLabel);
      setSummaryCards(data.cards);
      setTopCustomers(data.topCustomers);
      setTopProducts(data.topProducts);
      setTopVendors(data.topVendors);
    } catch {
      setSummaryCards([]);
      setTopCustomers([]);
      setTopProducts([]);
      setTopVendors([]);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadChart = useCallback(async () => {
    setChartLoading(true);
    try {
      const view = await loadDashboardChartView({
        period,
        metric,
        timeUnit,
        currencyLabel: currency,
      });
      setChartPoints(view.points);
      setChartSeries(view.series);
      setDonutData(view.donut);
    } catch {
      setChartPoints([]);
      setChartSeries([]);
      setDonutData([]);
    } finally {
      setChartLoading(false);
    }
  }, [period, metric, timeUnit, currency]);

  useEffect(() => {
    void loadSummary(period);
  }, [period, loadSummary]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const periodRef = useOutside<HTMLDivElement>(() => setPeriodOpen(false));
  const filterRef = useOutside<HTMLDivElement>(() => setFilterOpen(false));

  const shownCards = summaryCards.filter((c) => visible[c.key] !== false);
  const sideList = custMode === "Top Vendors" ? topVendors : topCustomers;
  const sideEmpty = custMode === "Top Vendors" ? "No vendors yet" : "No customers yet";
  const stackPayments = metric === "Payment Received" || metric === "Payment Made";

  return (
    <div className="dashboard-shell custom-scrollbar">
      <div className="dashboard-title-bar flex items-center justify-between gap-2">
        <h1 className="text-lg font-normal text-gray-900">Summary</h1>
        <div className="flex items-center gap-1">
          <div className="relative" ref={periodRef}>
            <button
              type="button"
              onClick={() => setPeriodOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-blue-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              {period}
            </button>
            {periodOpen && (
              <div className="absolute right-0 mt-2 z-40 w-56 bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {periodOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPeriod(p);
                      setPeriodOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <span>{p}</span>
                    {p === period && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 mt-1">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" /> Date Range
                  </span>
                  <button type="button" className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 rounded">
                    Go
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
              title="Filter cards"
            >
              <ListFilter className="w-5 h-5 text-gray-600" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-2 z-40 w-64 bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Summary
                </div>
                {filterOptions.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 rounded-sm flex items-center justify-center border ${
                        visible[opt] ? "bg-blue-600 border-blue-600" : "border-gray-400"
                      }`}
                    >
                      {visible[opt] && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={!!visible[opt]}
                      onChange={() => setVisible((v) => ({ ...v, [opt]: !v[opt] }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="bg-white border-b border-gray-200">
          {summaryLoading ? (
            <div className="flex justify-center py-16 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {shownCards.map((c, i) => {
                const cols = 6;
                const col = i % cols;
                const remainder = shownCards.length % cols;
                const lastRowStart = shownCards.length - (remainder || cols);
                const isLastRow = i >= lastRowStart;
                return (
                  <div
                    key={c.key}
                    className={[
                      "px-3 py-4 text-center transition-colors hover:bg-gray-200/50 cursor-default border-gray-200",
                      col !== cols - 1 ? "lg:border-r" : "",
                      i % 2 === 0 ? "max-sm:border-r" : "",
                      i % 3 !== 2 ? "max-lg:sm:border-r" : "",
                      !isLastRow ? "border-b" : "",
                    ].join(" ")}
                  >
                    <h5
                      className={`flex items-center justify-center gap-1 text-xs font-medium mb-2 ${LABEL_COLOR[c.color]}`}
                    >
                      {c.label}
                      {c.info && <Info className="w-3.5 h-3.5 text-blue-500" />}
                    </h5>
                    <div className="space-y-0.5">
                      {c.values.map((v) => (
                        <div
                          key={`${c.key}-${v}`}
                          className="text-sm font-semibold text-gray-900 leading-snug"
                        >
                          {v}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
            <CaretMenu
              value={metric}
              onChange={(v) => setMetric(v as ChartMetric)}
              bold
              options={["Sales", "Expenses", "Payment Received", "Payment Made"]}
            />
            <div className="hidden md:flex items-center gap-4 flex-wrap justify-center max-w-[50%]">
              {chartSeries.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
              {!chartLoading && chartSeries.length === 0 && (
                <span className="text-xs text-gray-400">No series</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <CaretMenu
                value={timeUnit}
                onChange={(v) => setTimeUnit(v as ChartTimeUnit)}
                options={["Days", "Weeks", "Months", "Quarters"]}
              />
              <CaretMenu
                value={currency}
                onChange={setCurrency}
                align="right"
                options={["$ USD", "৳ BDT", "All"]}
              />
              <button
                type="button"
                onClick={() => setChartType((t) => (t === "bar" ? "donut" : "bar"))}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-600"
                title="Toggle chart"
              >
                {chartType === "bar" ? <BarChart3 className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="p-3 h-[320px] overflow-hidden rounded-b-lg bg-white">
            {chartLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : chartType === "bar" ? (
              (() => {
                const n = Math.max(chartPoints.length, 1);
                // Only series with data take bar slots (matches SS: empty Sales/Overdue hide).
                const activeSeries = chartSeries.filter((s) =>
                  chartPoints.some((p) => Number(p[s.key] ?? 0) > 0.0001),
                );
                const seriesDraw = activeSeries.length ? activeSeries : chartSeries;
                const seriesN = stackPayments ? 1 : Math.max(seriesDraw.length, 1);
                // Same pillar look as screenshot — shrink only when needed to fit all days.
                const barSize = Math.max(6, Math.min(28, Math.floor(700 / (n * seriesN))));
                const axisTick = { fontSize: 11, fill: "var(--color-gray-500)" };
                const tipStyle = {
                  background: "var(--surface)",
                  border: "1px solid var(--color-gray-300)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-gray-900)",
                };
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartPoints}
                      barGap={2}
                      barCategoryGap={n > 20 ? "16%" : "26%"}
                      margin={{ top: 12, right: 12, left: 4, bottom: timeUnit === "Days" ? 8 : 4 }}
                    >
                      <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--color-gray-200)" />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fontSize: timeUnit === "Days" ? 8 : 10,
                          fill: "var(--color-gray-500)",
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        minTickGap={0}
                        angle={timeUnit === "Days" ? -40 : 0}
                        textAnchor={timeUnit === "Days" ? "end" : "middle"}
                        height={timeUnit === "Days" ? 48 : 28}
                      />
                      <YAxis
                        tick={axisTick}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        tickFormatter={(v) =>
                          Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : String(v)
                        }
                      />
                      <Tooltip
                        cursor={{ fill: "var(--color-gray-100)" }}
                        contentStyle={tipStyle}
                        labelStyle={{ color: "var(--color-gray-700)" }}
                        itemStyle={{ color: "var(--color-gray-900)" }}
                      />
                      {seriesDraw.map((s) => (
                        <Bar
                          key={s.key}
                          dataKey={s.key}
                          name={s.label}
                          stackId={stackPayments ? "pay" : undefined}
                          fill={s.color}
                          barSize={barSize}
                          radius={[2, 2, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--color-gray-300)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--color-gray-900)",
                    }}
                    labelStyle={{ color: "var(--color-gray-700)" }}
                    itemStyle={{ color: "var(--color-gray-900)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <CaretMenu
                value={custMode}
                onChange={setCustMode}
                bold
                options={["Top Customers", "Top Vendors"]}
              />
              <CaretMenu
                value={custCurrency}
                onChange={setCustCurrency}
                align="right"
                options={["All", "$ USD", "৳ BDT"]}
              />
            </div>
            <ul className="divide-y divide-gray-200">
              {(sideList.length ? sideList : [{ name: sideEmpty, amount: "—" }]).map((c) => (
                <li key={c.name} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-800 truncate pr-3">{c.name}</span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">{c.amount}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Top Products</h3>
              <CaretMenu
                value={custCurrency}
                onChange={setCustCurrency}
                align="right"
                options={["All", "$ USD", "৳ BDT"]}
              />
            </div>
            <ul className="divide-y divide-gray-200">
              {(topProducts.length ? topProducts : [{ name: "No products yet", amount: "—" }]).map((p) => (
                <li key={p.name} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-gray-800 truncate pr-3">{p.name}</span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">{p.amount}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Recent Activities</h3>
              <CaretMenu
                value={activityFilter}
                onChange={setActivityFilter}
                align="right"
                options={["All", "Invoices", "Payments", "Products"]}
              />
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <RecentActivities />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
