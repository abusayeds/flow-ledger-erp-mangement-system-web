/**
 * File: src/services/superAdminApi.ts
 * Superadmin-only company list + block/unblock, backed by the existing
 * `/user/all-user` and `/user/block-user` endpoints (both already
 * superadmin-gated on the backend). No new backend routes.
 */
import { api } from "@/lib/api/client";
import { fetchPaginatedList, type ListQueryParams } from "./paginatedList";

export type TSuperAdminCompanyRow = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: "active" | "blocked";
  login?: boolean;
  createdAt?: string;
};

export function fetchCompanies(params: ListQueryParams = {}) {
  return fetchPaginatedList<TSuperAdminCompanyRow>("/user/all-user", params);
}

export async function toggleCompanyBlock(userId: string): Promise<void> {
  await api.post("/user/block-user", { userId });
}
