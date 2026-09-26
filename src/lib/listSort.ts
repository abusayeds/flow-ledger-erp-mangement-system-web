/**
 * Build a backend `sort` query value so newest records stay on top when
 * Direction is Descending. Always includes `_id` as a stable tie-breaker
 * (Mongo ObjectIds increase over time).
 *
 * Backend queryBuilder accepts comma-separated fields and joins them with spaces.
 */
export type ListSortDir = "Ascending" | "Descending";

export function buildListSortParam(field: string, dir: ListSortDir = "Descending"): string {
  const clean = String(field || "createdAt").replace(/^-/, "").trim() || "createdAt";
  if (dir === "Ascending") return `${clean},_id`;
  return `-${clean},-_id`;
}
