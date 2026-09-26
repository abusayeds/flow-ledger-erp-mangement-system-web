/**
 * Thin paginated GET helper for list endpoints that return { data, pagination }.
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export const FALLBACK_LIST_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

export type ListQueryParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  [key: string]: unknown;
};

export async function fetchPaginatedList<T>(
  path: string,
  params: ListQueryParams = {},
): Promise<{ rows: T[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || key === "limit") continue;
    if (value === undefined || value === null || value === "") continue;
    query[key] = value;
  }
  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_LIST_PAGINATION, totalData: rows.length },
  };
}
