import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "./paginatedList";
import { mapPosOrder, type PosOrder } from "@/lib/db/pos";
import type { TPartyPagination } from "./customerTypes";

export { mapPosOrder };

export async function fetchPosOrders(params: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  warehouse?: string;
}): Promise<{ rows: PosOrder[]; pagination: TPartyPagination }> {
  const query: Record<string, unknown> = {
    page: params.page,
    limit: params.limit,
    searchTerm: params.searchTerm,
    sort: "-createdAt",
  };
  if (params.warehouse?.trim()) query.warehouse = params.warehouse.trim();

  const { rows, pagination } = await fetchPaginatedList<any>("/pos/order/all", query);
  return { rows: rows.map(mapPosOrder), pagination };
}

export async function fetchPosOrder(id: string): Promise<PosOrder | null> {
  try {
    const res = await api.raw.get(`/pos/order/single/${id}`);
    const doc = res.data?.data;
    return doc ? mapPosOrder(doc) : null;
  } catch {
    return null;
  }
}
