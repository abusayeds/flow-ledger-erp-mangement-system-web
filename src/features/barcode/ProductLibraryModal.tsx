/**
 * Product Library modal — left categories, right products with qty/price,
 * multi-select → Import (N) into Generate Barcode.
 * Products & categories come from backend APIs (no local catalogue).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { fetchProductCategories } from "@/services/categoriesApi";
import { fetchProducts, type ProductListRow } from "@/services/productsApi";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import { formatMoney, type LibraryImportItem } from "./types";

const fieldClass = "ua-field keep-box w-full px-3 py-2 text-sm focus:outline-none";
const PAGE_SIZE = 30;

type CatRow = { id: string; name: string; count: number };

type DraftSel = {
  quantity: number;
  price: number;
  name: string;
  sku: string;
  currency: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImport: (items: LibraryImportItem[]) => void;
};

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

export const ProductLibraryModal: React.FC<Props> = ({ open, onClose, onImport }) => {
  const [categories, setCategories] = useState<CatRow[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [showCatSearch, setShowCatSearch] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "count">("name");
  const [activeCatId, setActiveCatId] = useState<string>("");

  const [products, setProducts] = useState<ProductListRow[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodQuery, setProdQuery] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [showProdSearch, setShowProdSearch] = useState(false);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Record<string, DraftSel>>({});

  const activeCat = categories.find((c) => c.id === activeCatId) || categories[0];

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const rows = await fetchProductCategories();
      const mapped: CatRow[] = rows.map((c) => ({ id: c.id, name: c.name, count: 0 }));
      setCategories(mapped);
      setActiveCatId((prev) => {
        if (prev && mapped.some((c) => c.id === prev)) return prev;
        return mapped[0]?.id || "";
      });

      // Lightweight totals (page=1, limit=1) — backend pagination.totalData
      const counts = await Promise.all(
        mapped.map(async (c) => {
          try {
            const { pagination } = await fetchProducts({ page: 1, limit: 1, category: c.id });
            return { id: c.id, count: pagination.totalData ?? 0 };
          } catch {
            return { id: c.id, count: 0 };
          }
        }),
      );
      const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]));
      setCategories((prev) => prev.map((c) => ({ ...c, count: countMap[c.id] ?? c.count })));
    } catch (err) {
      showToast(errMsg(err, "Couldn't load categories"), "error");
      setCategories([]);
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!activeCatId) {
      setProducts([]);
      setProductTotal(0);
      return;
    }
    setProdLoading(true);
    try {
      const { rows, pagination } = await fetchProducts({
        page,
        limit: PAGE_SIZE,
        category: activeCatId,
        searchTerm: prodSearch || undefined,
        sort: "productName",
      });
      setProducts(rows);
      setProductTotal(pagination.totalData ?? rows.length);
      setCategories((prev) =>
        prev.map((c) => (c.id === activeCatId ? { ...c, count: pagination.totalData ?? c.count } : c)),
      );
    } catch (err) {
      showToast(errMsg(err, "Couldn't load products"), "error");
      setProducts([]);
      setProductTotal(0);
    } finally {
      setProdLoading(false);
    }
  }, [activeCatId, page, prodSearch]);

  useEffect(() => {
    if (!open) return;
    setSelected({});
    setCatQuery("");
    setProdQuery("");
    setProdSearch("");
    setPage(1);
    void loadCategories();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !activeCatId) return;
    void loadProducts();
  }, [open, activeCatId, page, prodSearch, loadProducts]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setProdSearch(prodQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [prodQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredCats = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    let list = categories;
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    const sorted = [...list];
    if (sortBy === "count") sorted.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [categories, catQuery, sortBy]);

  const selectedCount = Object.keys(selected).length;
  const allOnPageSelected =
    products.length > 0 && products.every((p) => selected[p._id]);

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = { ...prev };
        for (const p of products) delete next[p._id];
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (!next[p._id]) {
          next[p._id] = {
            quantity: 1,
            price: p.price,
            name: p.name,
            sku: p.sku,
            currency: p.currency || "BDT",
          };
        }
      }
      return next;
    });
  };

  const toggleOne = (p: ProductListRow) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p._id]) delete next[p._id];
      else {
        next[p._id] = {
          quantity: 1,
          price: p.price,
          name: p.name,
          sku: p.sku,
          currency: p.currency || "BDT",
        };
      }
      return next;
    });
  };

  const patchSel = (id: string, patch: Partial<DraftSel>, product: ProductListRow) => {
    setSelected((prev) => {
      const cur = prev[id] || {
        quantity: 1,
        price: product.price,
        name: product.name,
        sku: product.sku,
        currency: product.currency || "BDT",
      };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const handleImport = () => {
    const items: LibraryImportItem[] = [];
    for (const [id, draft] of Object.entries(selected)) {
      items.push({
        productId: id,
        name: draft.name,
        sku: draft.sku,
        quantity: Math.max(1, draft.quantity || 1),
        price: draft.price,
        currency: draft.currency || "BDT",
        header: draft.name,
        line1: formatMoney(draft.price, draft.currency || "BDT"),
      });
    }
    if (!items.length) {
      showToast("Select at least one product", "info");
      return;
    }
    onImport(items);
    onClose();
  };

  if (!open) return null;

  const padCount = String(selectedCount).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="w-full max-w-6xl max-h-[92vh] rounded-lg border border-gray-300 bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-300 bg-gray-100 px-4 sm:px-5 py-3 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">Product Library</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Import ({padCount})
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Categories */}
          <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex flex-col max-h-[40vh] lg:max-h-none">
            <div className="px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">Categories</span>
                <button
                  type="button"
                  onClick={() => setShowCatSearch((s) => !s)}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                  title="Search categories"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              {showCatSearch && (
                <input
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder="Search categories..."
                  className={`${fieldClass} mb-2`}
                />
              )}
              <select
                className={fieldClass}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "count")}
              >
                <option value="name">Sort by Name</option>
                <option value="count">Sort by Count</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {catLoading && !categories.length ? (
                <div className="flex justify-center py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filteredCats.length === 0 ? (
                <p className="text-sm text-gray-500 px-2 py-4">No categories</p>
              ) : (
                filteredCats.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCatId(cat.id);
                      setPage(1);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-left mb-0.5 ${
                      cat.id === activeCatId
                        ? "bg-blue-600/20 text-blue-800"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    <span className="text-sm truncate">{cat.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{cat.count}</span>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500 shrink-0">
              {categories.length} Categories
            </div>
          </aside>

          {/* Products */}
          <section className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h4 className="text-base font-semibold text-gray-900">{activeCat?.name || "Products"}</h4>
                <p className="text-sm text-gray-500">{productTotal} Products</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProdSearch((s) => !s)}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                title="Search products"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {showProdSearch && (
              <div className="px-4 sm:px-5 pb-3 shrink-0">
                <input
                  value={prodQuery}
                  onChange={(e) => setProdQuery(e.target.value)}
                  placeholder="Search products..."
                  className={fieldClass}
                />
              </div>
            )}
            <div className="flex-1 overflow-auto px-4 sm:px-5 pb-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden min-h-[240px]">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 w-10">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleAll}
                          className="rounded border-gray-400"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900">Products</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 w-28">Quantity</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-900 w-36">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-16 text-center text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin inline-block" />
                        </td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-16 text-center text-sm text-gray-500 bg-gray-50">
                          No products in this category.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => {
                        const isOn = !!selected[p._id];
                        const draft = selected[p._id] || {
                          quantity: 1,
                          price: p.price,
                          name: p.name,
                          sku: p.sku,
                          currency: p.currency || "BDT",
                        };
                        return (
                          <tr key={p._id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={isOn}
                                onChange={() => toggleOne(p)}
                                className="rounded border-gray-400"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-sm text-gray-900">{p.name}</td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                min={1}
                                value={draft.quantity}
                                disabled={!isOn}
                                onChange={(e) =>
                                  patchSel(
                                    p._id,
                                    { quantity: Math.max(1, Number(e.target.value) || 1) },
                                    p,
                                  )
                                }
                                className={`${fieldClass} disabled:opacity-50`}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                  {p.currency?.toUpperCase() === "BDT" ? "৳" : p.currency || "৳"}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={draft.price}
                                  disabled={!isOn}
                                  onChange={(e) =>
                                    patchSel(p._id, { price: Number(e.target.value) || 0 }, p)
                                  }
                                  className={`${fieldClass} pl-6 disabled:opacity-50`}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {productTotal > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <span>
                    Page {page} / {Math.max(1, Math.ceil(productTotal / PAGE_SIZE))}
                  </span>
                  <button
                    type="button"
                    disabled={page * PAGE_SIZE >= productTotal}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProductLibraryModal;
