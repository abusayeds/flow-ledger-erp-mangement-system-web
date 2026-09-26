/**
 * File: src/pages/pos/PosOrders.tsx
 * POS Orders — searchable, paginated list of completed POS sales.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { getToken } from "@/lib/api/tokenStore";
import { posOrderStore, orderTotal, warehouseShort } from "@/lib/db/pos";
import { fetchPosOrders } from "@/services/posOrdersApi";
import { searchWarehouses } from "@/services/warehousesApi";
import { ListShell } from "../goal/goalShared";
import { ArrowUpDown, Eye } from "lucide-react";

export const PosOrders: React.FC = () => {
  const navigate = useNavigate();
  const cachedOrders = posOrderStore.use();
  useEffect(() => {
    if (cachedOrders === null) void posOrderStore.save([]);
  }, [cachedOrders]);
  useEffect(() => {
    if (getToken()) void posOrderStore.hydrate();
  }, []);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const useBackend = !!getToken();

  const { data: warehouseList = [] } = useQuery({
    queryKey: ["pos-warehouse-options"],
    queryFn: () => searchWarehouses(""),
    enabled: useBackend,
    staleTime: 60_000,
  });

  const warehouseFilterOptions = useMemo(() => {
    const shorts = warehouseList.map((w) => warehouseShort(w.name));
    const fromOrders = (cachedOrders || []).map((o) => warehouseShort(o.warehouse)).filter(Boolean);
    return ["All", ...Array.from(new Set([...shorts, ...fromOrders]))];
  }, [warehouseList, cachedOrders]);

  const warehouseFullByShort = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouseList) m.set(warehouseShort(w.name), w.name);
    for (const o of cachedOrders || []) {
      const short = warehouseShort(o.warehouse);
      if (short && o.warehouse) m.set(short, o.warehouse);
    }
    return m;
  }, [warehouseList, cachedOrders]);

  const backendWarehouse =
    warehouseFilter !== "All" ? warehouseFullByShort.get(warehouseFilter) ?? warehouseFilter : undefined;

  const { data: apiData, isFetching } = useQuery({
    queryKey: ["pos-orders", page, perPage, search, backendWarehouse],
    queryFn: () =>
      fetchPosOrders({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        warehouse: backendWarehouse,
      }),
    enabled: useBackend,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const filteredLocal = useMemo(() => {
    const q = search.toLowerCase();
    const out = (cachedOrders || []).filter(
      (o) =>
        (warehouseFilter === "All" || warehouseShort(o.warehouse) === warehouseFilter) &&
        (o.number.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.warehouse.toLowerCase().includes(q)),
    );
    out.sort((a, b) => (sortAsc ? a.number.localeCompare(b.number) : b.number.localeCompare(a.number)));
    return out;
  }, [cachedOrders, search, warehouseFilter, sortAsc]);

  const apiRows = useMemo(() => {
    const rows = apiData?.rows ?? [];
    return [...rows].sort((a, b) => (sortAsc ? a.number.localeCompare(b.number) : b.number.localeCompare(a.number)));
  }, [apiData?.rows, sortAsc]);

  const paginated = useBackend ? apiRows : filteredLocal.slice((page - 1) * perPage, page * perPage);

  const total = useBackend ? (apiData?.pagination.totalData ?? apiRows.length) : filteredLocal.length;

  return (
    <ListShell
      module="POS"
      current="POS Orders"
      title="POS Orders"
      search={searchInput}
      setSearch={setSearchInput}
      searchPlaceholder="Search by order number, customer, warehouse..."
      perPage={perPage}
      setPerPage={(n) => {
        setPerPage(n);
        setPage(1);
      }}
      page={page}
      setPage={setPage}
      total={total}
      filterOptions={warehouseFilterOptions}
      filterValue={warehouseFilter}
      setFilterValue={(v) => {
        setWarehouseFilter(v);
        setPage(1);
      }}
      filterLabel="Warehouse"
    >
      {isFetching && useBackend && (
        <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">Loading orders…</div>
      )}
      <table className="w-full text-sm min-w-[820px]">
        <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
              <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-1 hover:text-gray-900">
                Sale Number <ArrowUpDown className="w-3 h-3" />
              </button>
            </th>
            {["Customer", "Warehouse", "Total", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {paginated.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50">
              <td className="px-4 py-3.5">
                <button onClick={() => navigate(`/pos/orders/${o.id}`)} className="text-blue-600 font-medium hover:underline">
                  {o.number}
                </button>
              </td>
              <td className="px-4 py-3.5 text-gray-900">{o.customer}</td>
              <td className="px-4 py-3.5 text-gray-600">{warehouseShort(o.warehouse)}</td>
              <td className="px-4 py-3.5 font-medium text-gray-900">{money(orderTotal(o))}</td>
              <td className="px-4 py-3.5">
                <button
                  onClick={() => navigate(`/pos/orders/${o.id}`)}
                  title={`View ${o.number}`}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          {paginated.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                No POS orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ListShell>
  );
};
