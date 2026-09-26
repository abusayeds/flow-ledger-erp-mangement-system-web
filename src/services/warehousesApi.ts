import { api } from "@/lib/api/client";
import { toArray } from "./_http";
import type { AsyncOption } from "@/components/ui/AsyncSearchSelect";

/** Search purchase warehouses for AsyncSearchSelect (`/purchase/warehouses/all`). */
export async function searchWarehouses(q: string): Promise<AsyncOption[]> {
  const res = await api.raw.get("/purchase/warehouses/all", {
    params: { page: 1, limit: 50, searchTerm: q.trim() || undefined },
  });
  const body = res.data ?? {};
  const rows = Array.isArray(body.data) ? body.data : toArray<Record<string, unknown>>(body);
  return rows
    .map((w: Record<string, unknown>) => {
      const name = String(w.name ?? "").trim();
      const address = String(w.address ?? "").trim();
      const label = address ? `${name} - ${address}` : name;
      return {
        id: String(w._id ?? w.id ?? ""),
        name: label,
      };
    })
    .filter((o: { id: string; name: string }) => o.id && o.name);
}
