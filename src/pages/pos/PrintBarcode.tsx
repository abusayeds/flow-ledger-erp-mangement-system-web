/**
 * File: src/pages/pos/PrintBarcode.tsx
 * Print Barcode — matches references/pos/print barcode page.png in the Qayd
 * blue theme: Product Barcode Generator header (warehouse select + product
 * search), Available Products table with select-all checkboxes, rendered
 * barcode stripes and per-row Copies inputs; Download PDF (N) enables once
 * rows are selected and emits a barcode-label PDF via jsPDF.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { fetchProducts, resolveProductImageUrl, hasProductImage } from "@/services/productsApi";
import { searchWarehouses } from "@/services/warehousesApi";
import AsyncSearchSelect from "@/components/ui/AsyncSearchSelect";
import { code128Modules, warehouseShort } from "@/lib/db/pos";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import { showToast } from "../../utils/toast";
import { QrCode, Package, Search, Download } from "lucide-react";

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  price: number;
  image: string | null;
}

function BarcodeSvg({ sku }: { sku: string }) {
  // real Code 128-B: modules alternate bar/space and must sit back-to-back
  const mods = code128Modules(sku || "SKU");
  const quiet = 10; // quiet zone each side
  let x = quiet;
  const bars = mods.map((w, i) => {
    const bar = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={28} fill="#111" /> : null;
    x += w;
    return bar;
  });
  return (
    <svg viewBox={`0 0 ${x + quiet} 28`} className="h-7 w-44" preserveAspectRatio="none" role="img" aria-label={`Barcode ${sku}`}>
      {bars}
    </svg>
  );
}

export const PrintBarcode: React.FC = () => {
  const navigate = useNavigate();
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, ProductRow>>({});

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: listData } = useQuery({
    queryKey: ["barcode-products", page, search],
    queryFn: () => fetchProducts({ page, limit: 50, searchTerm: search || undefined, sort: "productName" }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });

  const visible: ProductRow[] = useMemo(
    () =>
      (listData?.rows ?? []).map((r) => ({
        id: r._id,
        name: r.name,
        sku: r.sku === "—" ? "" : r.sku,
        price: r.price,
        image: r.image,
      })),
    [listData?.rows],
  );
  const pagination = listData?.pagination;

  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      setSelectedRows({});
    } else {
      setSelected(new Set(visible.map((p) => p.id)));
      setSelectedRows(Object.fromEntries(visible.map((p) => [p.id, p])));
    }
  };
  const toggle = (p: ProductRow) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) {
        next.delete(p.id);
        setSelectedRows((m) => {
          const copy = { ...m };
          delete copy[p.id];
          return copy;
        });
      } else {
        next.add(p.id);
        setSelectedRows((m) => ({ ...m, [p.id]: p }));
      }
      return next;
    });

  const downloadPdf = async () => {
    const rows = Object.values(selectedRows);
    if (rows.length === 0) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Product Barcodes", 105, 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(warehouseName ? warehouseShort(warehouseName) : "Warehouse", 105, 20, { align: "center" });
    let col = 0;
    let y = 32;
    for (const p of rows) {
      const n = copies[p.id] || 1;
      for (let c = 0; c < n; c++) {
        const x = 15 + col * 65;
        doc.setDrawColor(220);
        doc.roundedRect(x, y, 58, 34, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(p.name.slice(0, 24), x + 29, y + 6, { align: "center" });
        // real Code 128-B symbol — modules laid back-to-back, scaled to
        // fit the 44mm printable width (quiet zones at both sides)
        const mods = code128Modules(p.sku || String(p.id));
        const totalModules = mods.reduce((s, w) => s + w, 0);
        const scale = Math.min(0.5, 44 / totalModules);
        let bx = x + 29 - (totalModules * scale) / 2; // centered
        doc.setFillColor(17, 17, 17);
        for (let s = 0; s < mods.length; s++) {
          const w = mods[s] * scale;
          if (s % 2 === 0) doc.rect(bx, y + 9, w, 14, "F");
          bx += w;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(p.sku || "—", x + 29, y + 27, { align: "center" });
        doc.text(money(p.price), x + 29, y + 31.5, { align: "center" });
        col++;
        if (col === 3) {
          col = 0;
          y += 40;
          if (y > 250) {
            doc.addPage();
            y = 20;
          }
        }
      }
    }
    doc.save("product-barcodes.pdf");
    showToast(`Barcode PDF generated for ${rows.length} product${rows.length > 1 ? "s" : ""}`, "success");
  };

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "POS" }]} current="Product Barcode" onNavigate={navigate} />
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Manage Product Barcode</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* generator header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Product Barcode Generator</h3>
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="min-w-64">
              <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse</label>
              <AsyncSearchSelect
                value={warehouseId}
                displayName={warehouseName ? warehouseShort(warehouseName) : ""}
                placeholder="Select warehouse"
                onSearch={searchWarehouses}
                onChange={(id, opt) => {
                  setWarehouseId(id);
                  setWarehouseName(opt?.name || "");
                }}
              />
            </div>
            <div className="flex-1 min-w-56">
              <label className="block text-xs font-medium text-gray-500 mb-1">Search Products</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or SKU..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md"
                />
              </div>
            </div>
            {selected.size > 0 && (
              <button
                onClick={downloadPdf}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-md bg-white hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> Download PDF ({selected.size})
              </button>
            )}
          </div>
        </div>

        {/* products table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Available Products</h3>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">{visible.length}</span>
            </div>
            {selected.size > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-medium">{selected.size} Selected</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all products" className="w-4 h-4 accent-blue-600" />
                  </th>
                  {["Product Name", "SKU", "Price", "Barcode", "Copies"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((p) => {
                  const imgSrc = hasProductImage(p.image) ? resolveProductImageUrl(p.image) : "";
                  return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p)} aria-label={`Select ${p.name}`} className="w-4 h-4 accent-blue-600" />
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        {imgSrc ? (
                          <img src={imgSrc} alt="" className="w-8 h-8 rounded object-cover border border-gray-200" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300" />
                        )}
                        {p.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{p.sku || "—"}</td>
                    <td className="px-4 py-4 font-medium text-blue-600">{money(p.price)}</td>
                    <td className="px-4 py-4"><BarcodeSvg sku={p.sku || String(p.id)} /></td>
                    <td className="px-4 py-4">
                      {selected.has(p.id) ? (
                        <input
                          type="number"
                          min={1}
                          value={copies[p.id] || 1}
                          onChange={(e) => setCopies({ ...copies, [p.id]: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );})}
                {visible.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No products found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPage > 1 && (
            <div className="flex items-center justify-center gap-3 py-4 border-t border-gray-100 text-sm text-gray-600">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span>
                Page {pagination.currentPage} of {pagination.totalPage}
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
