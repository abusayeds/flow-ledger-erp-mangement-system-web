/**
 * Salesperson CRUD — `/api/v1/salesperson`
 */
import { api } from "@/lib/api/client";

export type SalespersonStatus = "Active" | "Inactive";

export interface Salesperson {
  _id: string;
  name: string;
  email?: string;
  status?: SalespersonStatus;
}

export type FetchSalespersonsParams = {
  searchTerm?: string;
  status?: SalespersonStatus | "All" | "";
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

const normalize = (raw: any): Salesperson | null => {
  const id = text(raw?._id || raw?.id);
  const name = text(raw?.name);
  if (!id || !name) return null;
  return {
    _id: id,
    name,
    email: text(raw?.email) || undefined,
    status: (raw?.status === "Inactive" ? "Inactive" : "Active") as SalespersonStatus,
  };
};

export async function fetchSalespersons(params: FetchSalespersonsParams = {}): Promise<Salesperson[]> {
  const query: Record<string, string> = {};
  const search = text(params.searchTerm);
  if (search) query.searchTerm = search;
  const status = text(params.status);
  if (status && status !== "All") query.status = status;
  const res = await api.raw.get("/salesperson/all", { params: query });
  const body = res.data ?? {};
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  return rows.map(normalize).filter(Boolean) as Salesperson[];
}

export async function createSalesperson(payload: {
  name: string;
  email?: string;
  status?: SalespersonStatus;
}): Promise<Salesperson> {
  const res = await api.raw.post("/salesperson/create", payload);
  const row = normalize(res.data?.data ?? res.data);
  if (!row) throw new Error("create-failed");
  return row;
}

export async function updateSalesperson(
  id: string,
  payload: { name?: string; email?: string; status?: SalespersonStatus },
): Promise<Salesperson> {
  const res = await api.raw.patch(`/salesperson/${id}`, payload);
  const row = normalize(res.data?.data ?? res.data);
  if (!row) throw new Error("update-failed");
  return row;
}

export async function deleteSalesperson(id: string): Promise<void> {
  await api.raw.delete(`/salesperson/${id}`);
}
