/**
 * Taxes — `/api/v1/tax` (same list managed in System Setup / Taxes).
 */
import { api } from "@/lib/api/client";
import { numericId } from "@/lib/db/sync";

export type TaxType = "product" | "service" | "both";

export interface TaxOption {
  _id: string;
  /** Stable numeric key used by local line-item `taxId` fields. */
  localId: number;
  name: string;
  rate: number;
  type: TaxType;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalize = (raw: any): TaxOption | null => {
  const id = text(raw?._id || raw?.id);
  const name = text(raw?.name);
  if (!id || !name) return null;
  const typeRaw = text(raw?.type).toLowerCase();
  const type: TaxType =
    typeRaw === "product" || typeRaw === "service" ? typeRaw : "both";
  return {
    _id: id,
    localId: numericId(id),
    name,
    rate: num(raw?.rate),
    type,
  };
};

export async function fetchTaxes(params: { searchTerm?: string } = {}): Promise<TaxOption[]> {
  const query: Record<string, string> = {};
  const search = text(params.searchTerm);
  if (search) query.searchTerm = search;
  const res = await api.raw.get("/tax/all", { params: query });
  const body = res.data ?? {};
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  return rows.map(normalize).filter(Boolean) as TaxOption[];
}

/** Prefer taxes matching line kind (product/service); always include `both`. */
export function filterTaxesForKind(taxes: TaxOption[], kind?: "product" | "service"): TaxOption[] {
  if (!kind) return taxes;
  return taxes.filter((t) => t.type === "both" || t.type === kind);
}
