/**
 * Dashboard chart view — builds bar/donut series from `/dashboard/summary`
 * plus Payment Received / Payment Made payment-method breakdown (frontend).
 */
import { api } from "@/lib/api/client";
import { fetchPaymentReceived } from "@/services/paymentReceivedApi";
import { fetchVendorPayments } from "@/services/vendorPaymentsApi";

export type ChartTimeUnit = "Days" | "Weeks" | "Months" | "Quarters";
export type ChartMetric = "Sales" | "Expenses" | "Payment Received" | "Payment Made";

export type ChartSeries = { key: string; label: string; color: string };
export type ChartPoint = { name: string; [key: string]: string | number };
export type DonutSlice = { name: string; value: number; color: string };

export type DashboardChartView = {
  points: ChartPoint[];
  series: ChartSeries[];
  donut: DonutSlice[];
};

const METHOD_COLORS = [
  "#007aff",
  "#ff3b30",
  "#34a853",
  "#f5a623",
  "#af52de",
  "#5856d6",
  "#ff2d55",
  "#64d2ff",
  "#ff9500",
  "#30b0c7",
];

const FIXED_COLORS: Record<string, string> = {
  Sales: "#007aff",
  Overdue: "#ff3b30",
  Paid: "#34a853",
  Expenses: "#f5a623",
  Bills: "#8e8e93",
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

const granularityOf = (unit: ChartTimeUnit): "day" | "week" | "month" => {
  if (unit === "Days") return "day";
  if (unit === "Weeks") return "week";
  return "month"; // Months + Quarters (Quarters rolled up on FE)
};

/** Fixed chart windows so the UI never overflows / needs a scrollbar. */
const CHART_BUCKET_LIMIT: Record<ChartTimeUnit, number> = {
  Days: 30,
  Weeks: 4,
  Months: 12, // one year
  Quarters: 4, // one year as 4 quarters
};

/** Chart date range ending at `anchor` (default today), sized for the time unit. */
export function chartRangeForUnit(
  unit: ChartTimeUnit,
  anchor = new Date(),
): { from: Date; to: Date } {
  const to = new Date(anchor);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);

  if (unit === "Days") {
    from.setDate(from.getDate() - (CHART_BUCKET_LIMIT.Days - 1));
  } else if (unit === "Weeks") {
    // Align to week start, then go back 3 more weeks (4 weeks total)
    const day = from.getDay();
    from.setDate(from.getDate() - day);
    from.setDate(from.getDate() - 7 * (CHART_BUCKET_LIMIT.Weeks - 1));
  } else if (unit === "Months") {
    from.setMonth(from.getMonth() - (CHART_BUCKET_LIMIT.Months - 1), 1);
  } else {
    // Quarters: last 4 quarters (one year)
    const qStart = Math.floor(from.getMonth() / 3) * 3;
    from.setMonth(qStart, 1);
    from.setMonth(from.getMonth() - 3 * (CHART_BUCKET_LIMIT.Quarters - 1), 1);
  }
  return { from, to };
}

const takeLastBuckets = (
  labels: string[],
  seriesMap: Record<string, number[]>,
  limit: number,
): { labels: string[]; seriesMap: Record<string, number[]> } => {
  if (labels.length <= limit) return { labels, seriesMap };
  const start = labels.length - limit;
  const nextLabels = labels.slice(start);
  const nextMap: Record<string, number[]> = {};
  for (const [key, arr] of Object.entries(seriesMap)) {
    nextMap[key] = arr.slice(start);
  }
  return { labels: nextLabels, seriesMap: nextMap };
};

const currencyParam = (currencyLabel: string): string | undefined => {
  if (currencyLabel.includes("BDT")) return "BDT";
  if (currencyLabel.includes("USD")) return "USD";
  return undefined;
};

const quarterLabel = (d: Date) => `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;

const monthToQuarterLabel = (label: string): string => {
  // Backend month labels look like "Jan 2026"
  const parsed = new Date(label);
  if (!Number.isNaN(parsed.getTime())) return quarterLabel(parsed);
  const m = label.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return label;
  const idx = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m[1]);
  if (idx < 0) return label;
  return `Q${Math.floor(idx / 3) + 1} ${m[2]}`;
};

const rollupToQuarters = (
  labels: string[],
  seriesMap: Record<string, number[]>,
): { labels: string[]; seriesMap: Record<string, number[]> } => {
  const order: string[] = [];
  const seen = new Set<string>();
  const indexOf: Record<string, number> = {};
  for (const lab of labels) {
    const q = monthToQuarterLabel(lab);
    if (!seen.has(q)) {
      seen.add(q);
      indexOf[q] = order.length;
      order.push(q);
    }
  }
  const out: Record<string, number[]> = {};
  for (const [key, arr] of Object.entries(seriesMap)) {
    out[key] = order.map(() => 0);
    arr.forEach((v, i) => {
      const q = monthToQuarterLabel(labels[i] || "");
      const idx = indexOf[q];
      if (idx != null) out[key][idx] += v || 0;
    });
    out[key] = out[key].map((v) => Math.round(v * 100) / 100);
  }
  return { labels: order, seriesMap: out };
};

const toPoints = (labels: string[], seriesMap: Record<string, number[]>): ChartPoint[] =>
  labels.map((name, i) => {
    const row: ChartPoint = { name };
    for (const [key, arr] of Object.entries(seriesMap)) {
      row[key] = arr[i] ?? 0;
    }
    return row;
  });

const seriesFromKeys = (keys: string[]): ChartSeries[] =>
  keys.map((key, i) => ({
    key,
    label: key,
    color: FIXED_COLORS[key] || METHOD_COLORS[i % METHOD_COLORS.length],
  }));

const donutFromSeries = (series: ChartSeries[], points: ChartPoint[]): DonutSlice[] =>
  series
    .map((s) => ({
      name: s.label,
      color: s.color,
      value: Math.round(points.reduce((sum, p) => sum + num(p[s.key]), 0) * 100) / 100,
    }))
    .filter((d) => d.value > 0.0001);

const bucketKeyForDate = (d: Date, unit: ChartTimeUnit): { key: string; label: string } => {
  if (unit === "Days") {
    const key = d.toISOString().slice(0, 10);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return { key, label: `${dd}/${mm}/${yy}` };
  }
  if (unit === "Weeks") {
    const start = new Date(d);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const key = start.toISOString().slice(0, 10);
    return {
      key,
      label: `${start.toLocaleString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleString("en-US", { month: "short", day: "numeric" })}`,
    };
  }
  if (unit === "Quarters") {
    const label = quarterLabel(d);
    return { key: label, label };
  }
  const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
  return {
    key,
    label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
  };
};

const ensureBucketsInRange = (from: Date, to: Date, unit: ChartTimeUnit): { key: string; label: string }[] => {
  const buckets: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const step = () => {
    if (unit === "Days") cursor.setDate(cursor.getDate() + 1);
    else if (unit === "Weeks") cursor.setDate(cursor.getDate() + 7);
    else if (unit === "Quarters") cursor.setMonth(cursor.getMonth() + 3);
    else cursor.setMonth(cursor.getMonth() + 1);
  };

  // Align quarters/months to start
  if (unit === "Months") cursor.setDate(1);
  if (unit === "Quarters") {
    cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3, 1);
  }
  if (unit === "Weeks") {
    const day = cursor.getDay();
    cursor.setDate(cursor.getDate() - day);
  }

  while (cursor <= end) {
    const b = bucketKeyForDate(cursor, unit);
    if (!seen.has(b.key)) {
      seen.add(b.key);
      buckets.push(b);
    }
    step();
  }
  return buckets;
};

async function fetchAllPaymentReceived() {
  const rows: Awaited<ReturnType<typeof fetchPaymentReceived>>["rows"] = [];
  let page = 1;
  let totalPage = 1;
  do {
    const r = await fetchPaymentReceived({ page, limit: 100, sort: "-date" });
    rows.push(...r.rows);
    totalPage = r.pagination.totalPage || 1;
    page += 1;
  } while (page <= totalPage && page <= 20);
  return rows;
}

async function fetchAllVendorPayments() {
  const rows: Awaited<ReturnType<typeof fetchVendorPayments>>["rows"] = [];
  let page = 1;
  let totalPage = 1;
  do {
    const r = await fetchVendorPayments({ page, limit: 100, sort: "-payment_date" });
    rows.push(...r.rows);
    totalPage = r.pagination.totalPage || 1;
    page += 1;
  } while (page <= totalPage && page <= 20);
  return rows;
}

const buildMethodChart = (
  items: { date: Date | null; amount: number; method: string; currency?: string }[],
  from: Date,
  to: Date,
  unit: ChartTimeUnit,
  currencyFilter?: string,
): DashboardChartView => {
  const filtered = items.filter((it) => {
    if (!it.date || it.date < from || it.date > to) return false;
    if (currencyFilter && it.currency && it.currency.toUpperCase() !== currencyFilter) return false;
    return true;
  });

  const buckets = ensureBucketsInRange(from, to, unit);
  const methods = [...new Set(filtered.map((i) => i.method || "Cash"))];
  if (methods.length === 0) methods.push("Cash");

  const seriesMap: Record<string, number[]> = {};
  for (const m of methods) seriesMap[m] = buckets.map(() => 0);
  const bucketIndex = Object.fromEntries(buckets.map((b, i) => [b.key, i]));

  for (const it of filtered) {
    if (!it.date) continue;
    const b = bucketKeyForDate(it.date, unit);
    const idx = bucketIndex[b.key];
    if (idx == null) continue;
    const method = it.method || "Cash";
    if (!seriesMap[method]) seriesMap[method] = buckets.map(() => 0);
    seriesMap[method][idx] = Math.round((seriesMap[method][idx] + it.amount) * 100) / 100;
  }

  const series = methods.map((m, i) => ({
    key: m,
    label: m,
    color: METHOD_COLORS[i % METHOD_COLORS.length],
  }));
  const points = toPoints(
    buckets.map((b) => b.label),
    seriesMap,
  );
  return { points, series, donut: donutFromSeries(series, points) };
};

export async function loadDashboardChartView(opts: {
  period: string;
  metric: ChartMetric;
  timeUnit: ChartTimeUnit;
  currencyLabel: string;
}): Promise<DashboardChartView> {
  const { metric, timeUnit, currencyLabel } = opts;
  const cur = currencyParam(currencyLabel);
  // Chart window is driven by Days/Weeks/Months/Quarters — not the summary period filter.
  const { from: fromD, to: toD } = chartRangeForUnit(timeUnit);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const params = {
    period: "custom",
    from: iso(fromD),
    to: iso(toD),
    granularity: granularityOf(timeUnit),
    ...(cur ? { currency: cur } : {}),
  };
  const limit = CHART_BUCKET_LIMIT[timeUnit];

  if (metric === "Payment Received") {
    const rows = await fetchAllPaymentReceived();
    const items = rows.map((r) => {
      const methods = Array.isArray(r.payment_method) ? r.payment_method : [];
      const method = text(methods[0]) || "Cash";
      const dateRaw = r.date || r.createdAt;
      return {
        date: dateRaw ? new Date(dateRaw) : null,
        amount: num(r.total),
        method,
        currency: text(r.currency) || undefined,
      };
    });
    const view = buildMethodChart(items, fromD, toD, timeUnit, cur);
    if (view.points.length <= limit) return view;
    return {
      ...view,
      points: view.points.slice(-limit),
      donut: donutFromSeries(view.series, view.points.slice(-limit)),
    };
  }

  if (metric === "Payment Made") {
    const rows = await fetchAllVendorPayments();
    const items = rows.map((r) => ({
      date: r.paymentDateIso ? new Date(r.paymentDateIso) : r.dateLabel && r.dateLabel !== "—" ? new Date(r.dateLabel) : null,
      amount: num(r.amount),
      method: text(r.method) || "Cash",
    }));
    const view = buildMethodChart(
      items.map((it) => ({
        ...it,
        date: it.date && !Number.isNaN(it.date.getTime()) ? it.date : null,
      })),
      fromD,
      toD,
      timeUnit,
      cur,
    );
    if (view.points.length <= limit) return view;
    return {
      ...view,
      points: view.points.slice(-limit),
      donut: donutFromSeries(view.series, view.points.slice(-limit)),
    };
  }

  const res = await api.raw.get("/dashboard/summary", { params });
  const dash = res.data?.data ?? res.data ?? {};
  const chart = dash.chart ?? {};
  let labels: string[] = Array.isArray(chart.labels) ? chart.labels.map(String) : [];

  let seriesMap: Record<string, number[]> = {};
  if (metric === "Sales") {
    seriesMap = {
      Sales: (chart.sales ?? []).map(num),
      Overdue: (chart.overdue ?? []).map(num),
      Paid: (chart.paid ?? []).map(num),
    };
  } else {
    seriesMap = {
      Expenses: (chart.expenses ?? []).map(num),
    };
  }

  if (timeUnit === "Quarters" && labels.length) {
    const rolled = rollupToQuarters(labels, seriesMap);
    labels = rolled.labels;
    seriesMap = rolled.seriesMap;
  }

  const capped = takeLastBuckets(labels, seriesMap, limit);
  labels = capped.labels;
  seriesMap = capped.seriesMap;

  const keys = Object.keys(seriesMap);
  const series = seriesFromKeys(keys);
  const points = toPoints(labels, seriesMap);
  return { points, series, donut: donutFromSeries(series, points) };
}
