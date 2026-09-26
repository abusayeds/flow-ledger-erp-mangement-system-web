/**
 * Contract API — /api/v1/contract
 * Note: backend has no Contract Types CRUD; `type` is a free-text field on contracts.
 * Note: GET /all has searchTerm/status but no server pagination — we paginate client-side after fetch.
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type ContractListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  status?: string;
};

export const CONTRACT_STATUSES = ["Draft", "Active", "Expired", "Terminated", "Renewed"] as const;

const FALLBACK_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

const text = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
};

const idOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "_id" in v) return String((v as { _id: unknown })._id);
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export type ContractRow = {
  id: string;
  number: string;
  subject: string;
  partyName: string;
  value: number;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  description: string;
  duration: number;
  createdAt: string;
};

export const mapContract = (d: any): ContractRow => ({
  id: idOf(d),
  number: text(d.contract_number),
  subject: text(d.subject),
  partyName: text(d.party_name),
  value: num(d.value),
  type: text(d.type),
  startDate: day(d.start_date),
  endDate: day(d.end_date),
  status: text(d.status) || "Draft",
  description: text(d.description),
  duration: num(d.duration),
  createdAt: day(d.createdAt),
});

function paginateLocal<T>(rows: T[], page: number, limit: number): { rows: T[]; pagination: TPartyPagination } {
  const totalData = rows.length;
  const totalPage = Math.max(1, Math.ceil(totalData / limit) || 1);
  const currentPage = Math.min(Math.max(1, page), totalPage);
  const start = (currentPage - 1) * limit;
  return {
    rows: rows.slice(start, start + limit),
    pagination: {
      totalData,
      totalPage,
      currentPage,
      prevPage: Math.max(1, currentPage - 1),
      nextPage: Math.min(totalPage, currentPage + 1),
    },
  };
}

/** Fetch all matching contracts from backend, then paginate locally. */
export async function fetchContracts(params: ContractListParams = {}) {
  const query: Record<string, unknown> = {};
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.status && params.status !== "All") query.status = params.status;

  const res = await api.raw.get("/contract/all", { params: query });
  const body = res.data ?? {};
  const raw: any[] = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  let rows = raw.map(mapContract);

  // Optional client sort (backend has no sort param)
  if (params.sort) {
    const primary = String(params.sort).split(",")[0] || "-createdAt";
    const field = primary.replace(/^-/, "");
    const desc = primary.startsWith("-");
    const keyMap: Record<string, keyof ContractRow> = {
      subject: "subject",
      contract_number: "number",
      party_name: "partyName",
      value: "value",
      status: "status",
      createdAt: "createdAt",
      start_date: "startDate",
    };
    const k = keyMap[field] || "createdAt";
    rows = [...rows].sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      if (typeof av === "number" && typeof bv === "number") return desc ? bv - av : av - bv;
      return desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
  }

  return paginateLocal(rows, params.page ?? 1, params.limit ?? 10);
}

export async function fetchContract(id: string) {
  const res = await api.raw.get(`/contract/single/${id}`);
  return mapContract(res.data?.data ?? res.data);
}

export async function createContract(body: Record<string, unknown>) {
  const res = await api.raw.post("/contract/create", body);
  return mapContract(res.data?.data ?? res.data);
}

export async function updateContract(id: string, body: Record<string, unknown>) {
  const res = await api.raw.patch(`/contract/${id}`, body);
  return mapContract(res.data?.data ?? res.data);
}

export async function deleteContract(id: string) {
  await api.raw.delete(`/contract/${id}`);
}

const TYPE_CATALOG_KEY = "erp.contractTypeLabels";

function readTypeCatalog(): string[] {
  try {
    const raw = localStorage.getItem(TYPE_CATALOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function writeTypeCatalog(names: string[]) {
  const unique = [
    ...new Map(
      names
        .map((n) => [n.toLowerCase(), n.trim()] as [string, string])
        .filter(([, n]) => Boolean(n)),
    ).values(),
  ];
  localStorage.setItem(TYPE_CATALOG_KEY, JSON.stringify(unique));
}

/** Persist a new type label (backend has no types CRUD). */
export async function createContractType(name: string) {
  const next = name.trim();
  if (!next) throw new Error("Type name is required");
  const catalog = readTypeCatalog();
  if (catalog.some((n) => n.toLowerCase() === next.toLowerCase())) {
    throw new Error("This type already exists");
  }
  // Also treat types already used on contracts as existing
  const { rows: all } = await fetchContracts({ page: 1, limit: 10000 });
  if (all.some((c) => c.type.toLowerCase() === next.toLowerCase())) {
    throw new Error("This type already exists");
  }
  writeTypeCatalog([...catalog, next]);
  return { id: next, name: next };
}

/** Unique contract type labels: catalog + types used on contracts. */
export async function fetchContractTypes(params: ContractListParams = {}) {
  const { rows: all } = await fetchContracts({
    page: 1,
    limit: 10000,
  });
  const map = new Map<string, { name: string; contracts: string[]; count: number }>();

  for (const label of readTypeCatalog()) {
    map.set(label.toLowerCase(), { name: label, contracts: [], count: 0 });
  }

  for (const c of all) {
    const name = c.type.trim();
    if (!name) continue;
    const cur = map.get(name.toLowerCase()) ?? { name, contracts: [], count: 0 };
    cur.count += 1;
    if (c.number) cur.contracts.push(c.number);
    // Prefer casing from first contract if catalog had different casing
    if (!cur.contracts.length || cur.name !== name) cur.name = name;
    map.set(name.toLowerCase(), cur);
  }

  let rows = [...map.values()].map((t) => ({
    id: t.name,
    name: t.name,
    contracts: t.contracts.slice(0, 8),
    count: t.count,
    active: true,
  }));

  const term = params.searchTerm?.trim().toLowerCase();
  if (term) rows = rows.filter((r) => r.name.toLowerCase().includes(term));

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return paginateLocal(rows, params.page ?? 1, params.limit ?? 10);
}

export async function searchContractTypes(q: string) {
  const { rows } = await fetchContractTypes({ page: 1, limit: 50, searchTerm: q || undefined });
  return rows.map((r) => ({ id: r.name, name: r.name }));
}

/** Rename a type string across all contracts that use it + catalog. */
export async function renameContractType(oldName: string, newName: string) {
  const next = newName.trim();
  if (!next) throw new Error("Type name is required");
  const { rows: all } = await fetchContracts({ page: 1, limit: 10000 });
  const targets = all.filter((c) => c.type === oldName);
  await Promise.all(targets.map((c) => updateContract(c.id, { type: next })));
  writeTypeCatalog(
    readTypeCatalog().map((n) => (n.toLowerCase() === oldName.toLowerCase() ? next : n)),
  );
  if (!readTypeCatalog().some((n) => n.toLowerCase() === next.toLowerCase())) {
    writeTypeCatalog([...readTypeCatalog(), next]);
  }
  return targets.length;
}

/** Remove type from catalog and clear it on contracts. */
export async function clearContractType(name: string) {
  const { rows: all } = await fetchContracts({ page: 1, limit: 10000 });
  const targets = all.filter((c) => c.type === name);
  await Promise.all(targets.map((c) => updateContract(c.id, { type: "" })));
  writeTypeCatalog(readTypeCatalog().filter((n) => n.toLowerCase() !== name.toLowerCase()));
  return targets.length;
}

export { FALLBACK_PAGINATION };
