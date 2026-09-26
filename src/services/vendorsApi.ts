/** Vendors — backend via /api/v1/vendor/* */
import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "./paginatedList";
import type { TPartyPagination, TBackendParty } from "./customerTypes";
import { formToPayload, type CustomerFormData } from "./customersApi";

export type VendorListRow = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  opening_balance?: number;
  isArchive?: boolean;
  isDeleted?: boolean;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

const mapVendor = (doc: any): VendorListRow => ({
  _id: String(doc._id),
  name: text(doc?.businessProfile?.companyName) || text(doc?.company_name) || text(doc?.name) || "—",
  email: text(doc?.email) || undefined,
  phone: text(doc?.phone) || undefined,
  company_name: text(doc?.businessProfile?.companyName) || text(doc?.company_name) || undefined,
  opening_balance: typeof doc?.opening_balance === "number" ? doc.opening_balance : Number(doc?.opening_balance) || 0,
  isArchive: !!doc?.isArchive,
  isDeleted: !!doc?.isDeleted,
});

export async function fetchVendors(params: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  isArchive?: boolean;
  isDeleted?: boolean;
  startDate?: string;
  endDate?: string;
}): Promise<{ rows: VendorListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/vendor/all", {
    page: params.page,
    limit: params.limit,
    searchTerm: params.searchTerm,
    sort: params.sort,
    isArchive: params.isArchive ? "true" : undefined,
    isDeleted: params.isDeleted ? "true" : undefined,
    startDate: params.startDate || undefined,
    endDate: params.endDate || undefined,
  });
  return { rows: rows.map(mapVendor), pagination };
}

export async function fetchVendor(id: string): Promise<TBackendParty | null> {
  try {
    const res = await api.raw.get(`/vendor/single/${id}`);
    return (res.data?.data ?? res.data) as TBackendParty;
  } catch {
    return null;
  }
}

export async function createVendor(f: CustomerFormData | Record<string, unknown>): Promise<TBackendParty> {
  const payload = "name" in f && "firstName" in f ? formToPayload(f as CustomerFormData) : f;
  const res = await api.raw.post("/vendor/create", payload);
  return (res.data?.data ?? res.data) as TBackendParty;
}

export async function updateVendor(id: string, f: CustomerFormData | Record<string, unknown>): Promise<TBackendParty> {
  const base = "name" in f && "firstName" in f ? formToPayload(f as CustomerFormData) : f;
  const res = await api.raw.post("/vendor/update", { ...base, _id: id });
  return (res.data?.data ?? res.data) as TBackendParty;
}

export async function archiveVendor(id: string): Promise<void> {
  await api.raw.post("/vendor/update", { _id: id, isArchive: true });
}

export async function archiveVendors(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => archiveVendor(id)));
}

export async function deleteVendor(id: string): Promise<void> {
  await api.raw.delete(`/vendor/delete/${id}`);
}

export async function deleteVendors(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api.raw.delete(`/vendor/delete/${ids.join(",")}`);
}

export async function mergeVendors(survivorId: string, mergedIds: string[]): Promise<void> {
  await api.raw.post("/vendor/merge", {
    survivor_id: survivorId,
    merged_ids: mergedIds,
  });
}
