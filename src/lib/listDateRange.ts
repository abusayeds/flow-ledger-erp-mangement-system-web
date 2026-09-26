/** Shared date-chip presets → backend queryBuilder dateFrom/dateTo. */
export const dateRangeFor = (option: string): { dateFrom?: string; dateTo?: string } => {
  const now = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  if (option === "Today") {
    const today = iso(now);
    return { dateFrom: today, dateTo: today };
  }
  if (option === "This Week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { dateFrom: iso(start), dateTo: iso(now) };
  }
  if (option === "Last Week") {
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { dateFrom: iso(start), dateTo: iso(end) };
  }
  if (option === "This Month") {
    return { dateFrom: iso(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: iso(now) };
  }
  if (option === "Last Month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { dateFrom: iso(start), dateTo: iso(end) };
  }
  if (option === "Last 30 Days") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { dateFrom: iso(start), dateTo: iso(now) };
  }
  if (option === "This Year") {
    return { dateFrom: iso(new Date(now.getFullYear(), 0, 1)), dateTo: iso(now) };
  }
  // All / unknown → no filter
  return {};
};

export const DATE_FILTER_OPTIONS = [
  "All",
  "Today",
  "This Week",
  "This Month",
  "Last 30 Days",
  "This Year",
] as const;
