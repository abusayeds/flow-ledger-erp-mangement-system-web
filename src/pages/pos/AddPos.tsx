/**
 * File: src/pages/pos/AddPos.tsx
 * Add POS — matches references/pos/add pos*.png in the Qayd blue theme:
 * product grid fed by the shared Items > Products collection (name, SKU,
 * price, stock all come from there), category chips, customer/warehouse
 * selects, add-to-cart-by-SKU, shopping cart sidebar with GST 18% +
 * discount, Process Payment modal and the receipt modal after Complete
 * Sale. Completed sales persist in meta row `pos:orders` and product
 * stock is decremented in the products collection.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { getToken } from "@/lib/api/tokenStore";
import { fetchProducts, resolveProductImageUrl, hasProductImage } from "@/services/productsApi";
import { fetchCustomers } from "@/services/customersApi";
import { searchProductCategories } from "@/services/categoriesApi";
import { searchWarehouses } from "@/services/warehousesApi";
import AsyncSearchSelect from "@/components/ui/AsyncSearchSelect";
import type { AsyncOption } from "@/components/ui/AsyncSearchSelect";
import {
  posOrderStore,
  PosOrder,
  PosItem,
  GST_RATE,
  orderSubtotal,
  orderTax,
  orderTotal,
  nextPosNumber,
  posUid,
  warehouseShort,
} from "@/lib/db/pos";
import { useAppSettings, isOrderSettingOn } from "@/lib/db/appSettings";
import { searchBankAccounts } from "@/pages/hrm/hrmShared";
import { showToast } from "../../utils/toast";
import {
  Home,
  Search,
  Barcode,
  ShoppingCart,
  Package,
  Trash2,
  Minus,
  Plus,
  X,
  CreditCard,
  CheckCircle2,
  Download,
  Printer,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const QAYD_ADDRESS = ["B-102, Orbit Heights, Lakeview Lane", "Ahmedabad, Gujarat", "India - 380015"];

const WALK_IN: AsyncOption = { id: "", name: "Walk-in Customer" };

async function searchPosCustomers(q: string): Promise<AsyncOption[]> {
  const term = q.trim().toLowerCase();
  const showWalkIn =
    !term || term.includes("walk") || "walk-in customer".includes(term) || term.startsWith("walk-in");
  const { rows } = await fetchCustomers({ page: 1, limit: 50, searchTerm: q.trim() || undefined });
  const opts = rows.map((c) => ({ id: c._id, name: c.name }));
  return showWalkIn ? [WALK_IN, ...opts] : opts;
}

interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  price: number;
  stock: number;
  image: string | null;
}

export const AddPos: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orders = posOrderStore.use();
  useEffect(() => {
    if (orders === null) void posOrderStore.save([]);
  }, [orders]);
  useEffect(() => {
    if (getToken()) void posOrderStore.hydrate();
  }, []);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCatalogPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data: catalogData, isFetching: catalogLoading } = useQuery({
    queryKey: ["pos-product-catalog", catalogPage, search, categoryId],
    queryFn: () =>
      fetchProducts({
        page: catalogPage,
        limit: 24,
        searchTerm: search || undefined,
        category: categoryId || undefined,
        sort: "productName",
      }),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });

  const catalog: CatalogProduct[] = useMemo(
    () =>
      (catalogData?.rows ?? []).map((r) => ({
        id: r._id,
        name: r.name,
        sku: r.sku === "—" ? "" : r.sku,
        categoryId: r.categoryId,
        price: r.price,
        stock: r.stock ?? 0,
        image: r.image,
      })),
    [catalogData?.rows],
  );

  const catalogById = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const catalogPagination = catalogData?.pagination;
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState(WALK_IN.name);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccountLabel, setBankAccountLabel] = useState("");
  const [sku, setSku] = useState("");
  const [cart, setCart] = useState<PosItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [modal, setModal] = useState<"payment" | "receipt" | null>(null);
  const [receipt, setReceipt] = useState<PosOrder | null>(null);
  const [shippingAddress, setShippingAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [orderType, setOrderType] = useState("Manual Select");
  const [editableAmount, setEditableAmount] = useState("");
  const [cashDenomination, setCashDenomination] = useState("");
  const [roundOff, setRoundOff] = useState(0);

  const orderSettings = useAppSettings("doc:order");
  const productSettings = useAppSettings("product");
  const showGen = (k: string) => isOrderSettingOn(orderSettings?.general, k);
  const showCol = (k: string) => isOrderSettingOn(orderSettings?.columns, k);
  const showSum = (k: string) => isOrderSettingOn(orderSettings?.summary, k);
  const discountBeforeTax = showGen("Apply discount before tax");
  const showShipping = showGen("Shipping Address");
  const showTotalQty = showCol("Total Quantity");
  const fullWidthDesc = showCol("Line description full width");
  const showTaxCol = showCol("Tax");
  const showDiscountCol = showCol("Discount");
  const showInlineDiscount = showSum("Inline Discount");
  const showLineTotalWithTax = showSum("Show Line Total with Tax");
  const parenNegatives = showSum("Negative Value format with ( )");
  const showRoundOff = showSum("Round Off");
  const subtotalMode = orderSettings?.summarySubtotalWithTax || "Default";
  const showDeliveryDate = (orderSettings?.printEmail?.deliveryDate || "Show") !== "Hide";
  const defaultPrint = orderSettings?.printEmail?.defaultPrint || "KOT";
  const keepAmountEditable = orderSettings?.checkout?.keepAmountEditable !== false;
  const defaultOrderType = orderSettings?.checkout?.defaultOrderType || "Manual Select";
  const showCashDenom = !!orderSettings?.payment?.["Cash Received Denomination"];
  const zeroStockMode = productSettings?.zeroStock || "Yes, Allow";
  const showLineItemImage = !!productSettings?.productImage;
  const showCheckoutPrice = productSettings?.checkout?.productPriceOnCheckout !== false;
  const productImageSize = productSettings?.checkout?.productImageSize || "Medium";
  const imgH = productImageSize === "Small" ? "h-24" : productImageSize === "Large" ? "h-48" : "h-36";
  const hideOutOfStockOnline = (productSettings?.outOfStockOnlineStore || "Hide") === "Hide";

  useEffect(() => {
    if (defaultOrderType !== "Manual Select") setOrderType(defaultOrderType);
  }, [defaultOrderType]);

  const fmtMoney = (n: number) => {
    if (parenNegatives && n < 0) return `(${money(Math.abs(n))})`;
    return money(n);
  };

  const stockFor = useCallback(
    (productId: string) => catalogById.get(productId)?.stock ?? 0,
    [catalogById],
  );

  const addToCart = (p: CatalogProduct) => {
    const stock = p.stock ?? 0;
    if (stock <= 0) {
      if (zeroStockMode === "No, Don't Allow") {
        showToast(`${p.name} is out of stock`, "error");
        return;
      }
      if (zeroStockMode === "Warn Me") {
        showToast(`${p.name} is out of stock`, "warning");
      }
      // Yes, Allow → continue
    }
    setCart((prev) => {
      const found = prev.find((i) => i.productId === p.id);
      if (found) {
        const maxStock = stockFor(p.id) || p.stock;
        if (maxStock > 0 && found.qty >= maxStock && zeroStockMode === "No, Don't Allow") {
          showToast(`Only ${maxStock} in stock for ${p.name}`, "error");
          return prev;
        }
        return prev.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku || "",
          qty: 1,
          price: p.price,
          taxRate: GST_RATE,
          image: p.image,
        },
      ];
    });
  };

  const addBySku = async () => {
    const term = sku.trim();
    if (!term) return;
    try {
      const { rows } = await fetchProducts({ page: 1, limit: 20, searchTerm: term });
      const p = rows.find((x) => (x.sku || "").toLowerCase() === term.toLowerCase()) ?? rows[0];
      if (!p) {
        showToast(`No product with SKU "${term}"`, "error");
        return;
      }
      addToCart({
        id: p._id,
        name: p.name,
        sku: p.sku === "—" ? "" : p.sku,
        categoryId: p.categoryId,
        price: p.price,
        stock: p.stock ?? 0,
        image: p.image,
      });
      setSku("");
    } catch {
      showToast(`No product with SKU "${term}"`, "error");
    }
  };

  const setQty = (productId: string, qty: number) => {
    const maxStock = stockFor(productId);
    const p = catalogById.get(productId);
    if (qty > 0 && maxStock > 0 && qty > maxStock) {
      showToast(`Only ${maxStock} in stock for ${p?.name ?? "product"}`, "error");
      return;
    }
    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, qty } : i)),
    );
  };

  const draft = { items: cart, discount };
  const rawSubtotal = orderSubtotal(draft);
  const rawTax = (() => {
    if (!discountBeforeTax || !discount) return orderTax(draft);
    if (rawSubtotal <= 0) return 0;
    const ratio = Math.max(0, rawSubtotal - discount) / rawSubtotal;
    return +cart.reduce((s, i) => s + (i.qty * i.price * i.taxRate) / 100 * ratio, 0).toFixed(2);
  })();
  const displaySubtotal =
    subtotalMode === "Including Tax"
      ? rawSubtotal + rawTax
      : subtotalMode === "Excluding Tax"
        ? rawSubtotal
        : rawSubtotal;
  const appliedDiscount = showDiscountCol ? discount : 0;
  const preRound =
    discountBeforeTax
      ? rawSubtotal - appliedDiscount + (showTaxCol ? rawTax : 0)
      : rawSubtotal + (showTaxCol ? rawTax : 0) - appliedDiscount;
  const roundOffNum = showRoundOff ? roundOff : 0;
  const computedTotal = +(preRound + roundOffNum).toFixed(2);
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const posNumber = nextPosNumber(orders || []);
  const today = new Date().toISOString().slice(0, 10);

  const checkout = () => {
    if (cart.length === 0) {
      showToast("Your cart is empty", "error");
      return;
    }
    if (!bankAccountLabel) {
      showToast("Select a bank account first", "error");
      return;
    }
    if (!warehouseName) {
      showToast("Select a warehouse first", "error");
      return;
    }
    setEditableAmount(String(computedTotal));
    setModal("payment");
  };

  const completeSale = async () => {
    const order: PosOrder = {
      id: posUid(),
      number: posNumber,
      date: today,
      customer: customerName || WALK_IN.name,
      customerId: customerId || undefined,
      warehouse: warehouseName,
      warehouseId: warehouseId || undefined,
      bankAccount: bankAccountLabel,
      bankAccountId: bankAccountId || undefined,
      items: cart,
      discount: appliedDiscount,
      status: "Completed",
      createdAt: Date.now(),
    };
    await posOrderStore.create(order);
    void queryClient.invalidateQueries({ queryKey: ["pos-product-catalog"] });
    void queryClient.invalidateQueries({ queryKey: ["products-list"] });
    setReceipt(order);
    setModal("receipt");
    setCart([]);
    setDiscount(0);
    setShippingAddress("");
    setDeliveryDate("");
    setCashDenomination("");
    setRoundOff(0);
    setEditableAmount("");
    if (defaultOrderType === "Manual Select") setOrderType("Manual Select");
  };

  const inputCls = "px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="module-page-shell overflow-hidden flex p-0">
      {/* ── product side ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* toolbar */}
        <div className="module-title-bar px-4 py-3 h-auto flex-wrap gap-3">
          <button onClick={() => navigate("/")} title="Home" className="p-2 border border-gray-300 rounded-md text-gray-500 hover:bg-gray-50">
            <Home className="w-4 h-4" />
          </button>
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search products..." className={`${inputCls} w-full pl-9`} />
          </div>
          <div className="w-full max-w-[11rem]">
            <AsyncSearchSelect
              value={customerId}
              displayName={customerName}
              placeholder="Walk-in Customer"
              onSearch={searchPosCustomers}
              onChange={(id, opt) => {
                setCustomerId(id);
                setCustomerName(opt?.name || WALK_IN.name);
              }}
            />
          </div>
          <div className="w-full max-w-[14rem]">
            <AsyncSearchSelect
              value={warehouseId}
              displayName={warehouseName ? warehouseShort(warehouseName) : ""}
              placeholder="Warehouse"
              onSearch={searchWarehouses}
              onChange={(id, opt) => {
                setWarehouseId(id);
                setWarehouseName(opt?.name || "");
              }}
            />
          </div>
          <div className="relative min-w-44">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBySku()}
              placeholder="Add To Cart by SKU"
              className={`${inputCls} w-full pl-9`}
            />
          </div>
        </div>

        {/* category — searchable API dropdown */}
        <div className="bg-white border-b border-gray-300 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="w-full max-w-xs">
            <AsyncSearchSelect
              value={categoryId}
              displayName={categoryLabel}
              placeholder="All categories"
              onSearch={searchProductCategories}
              onChange={(id, opt) => {
                setCategoryId(id);
                setCategoryLabel(opt?.name || "");
                setCatalogPage(1);
              }}
            />
          </div>
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {catalog.map((p) => {
              if (hideOutOfStockOnline && (p.stock ?? 0) <= 0) return null;
              const imgSrc = hasProductImage(p.image) ? resolveProductImageUrl(p.image) : "";
              return (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md text-left overflow-hidden transition-all"
              >
                <div className={`${imgH} bg-gray-50 flex items-center justify-center overflow-hidden`}>
                  {imgSrc ? <img src={imgSrc} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-12 h-12 text-blue-200" />}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{p.sku || "—"}</p>
                  <div className="flex items-center justify-between mt-2">
                    {showCheckoutPrice ? (
                      <span className="text-sm font-bold text-blue-600">{money(p.price)}</span>
                    ) : (
                      <span />
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.stock > 0 ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-600"}`}>
                      {p.stock ?? 0}
                    </span>
                  </div>
                </div>
              </button>
            );})}
          </div>
          {catalog.length === 0 && !catalogLoading && (
            <div className="text-center text-sm text-gray-400 py-16">No products match your search.</div>
          )}
          {catalogPagination && catalogPagination.totalPage > 1 && (
            <div className="flex items-center justify-center gap-3 py-4 text-sm text-gray-600">
              <button
                type="button"
                disabled={catalogPage <= 1}
                onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <span>
                Page {catalogPagination.currentPage} of {catalogPagination.totalPage}
              </span>
              <button
                type="button"
                disabled={catalogPage >= catalogPagination.totalPage}
                onClick={() => setCatalogPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── cart sidebar ── */}
      <div className="w-80 xl:w-96 bg-white border-l border-gray-200 flex flex-col shrink-0">
        <div className="px-4 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bank Account <span className="text-red-500">*</span>
          </label>
          <AsyncSearchSelect
            value={bankAccountId}
            displayName={bankAccountLabel}
            placeholder="Select Bank Account"
            onSearch={searchBankAccounts}
            onChange={(id, opt) => {
              setBankAccountId(id);
              setBankAccountLabel(opt?.name || "");
            }}
          />
        </div>
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 mt-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-600" />
            <h3 className="text-base font-semibold text-gray-900">Shopping Cart</h3>
          </div>
          <div className="flex items-center gap-2">
            {showTotalQty && cart.length > 0 && (
              <span className="text-xs text-gray-500">Qty {totalQty}</span>
            )}
            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs flex items-center justify-center font-medium">
              {totalQty}
            </span>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} title="Clear cart" className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <ShoppingCart className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-700">Your cart is empty</p>
              <p className="text-xs text-gray-400 mt-1">Add products to get started</p>
            </div>
          ) : (
            cart.map((i) => {
              const lineTax = +(i.qty * i.price * i.taxRate / 100).toFixed(2);
              const lineBase = i.qty * i.price;
              const lineTotal = showLineTotalWithTax ? lineBase + lineTax : lineBase;
              return (
              <div key={i.productId} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start gap-3">
                  {showLineItemImage && (
                    <div className="w-9 h-9 rounded-md bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {(() => {
                        const raw = i.image ?? catalogById.get(i.productId)?.image;
                        const src = hasProductImage(raw) ? resolveProductImageUrl(raw) : "";
                        return src ? <img src={src} alt={i.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-blue-300" />;
                      })()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold text-gray-900 ${fullWidthDesc ? "whitespace-normal break-words" : "truncate"}`}>{i.name}</p>
                    <p className="text-xs text-blue-600">{fmtMoney(i.price)} each</p>
                    {showTaxCol && (
                      <p className="text-xs text-gray-400">GST ({i.taxRate.toFixed(2)}%)</p>
                    )}
                  </div>
                  <button onClick={() => setQty(i.productId, 0)} title={`Remove ${i.name}`} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(i.productId, i.qty - 1)} className="w-7 h-7 border border-gray-300 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-50">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{i.qty}</span>
                    <button onClick={() => setQty(i.productId, i.qty + 1)} className="w-7 h-7 border border-gray-300 rounded-md flex items-center justify-center text-gray-600 hover:bg-gray-50">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{fmtMoney(lineTotal)}</span>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* totals */}
        <div className="border-t border-gray-200 px-4 py-4 space-y-2 text-sm">
          {(showShipping || showDeliveryDate || defaultOrderType === "Manual Select") && (
            <div className="space-y-2 pb-2 mb-1 border-b border-gray-100">
              {defaultOrderType === "Manual Select" && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Order Type</span>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
                  >
                    {["Manual Select", "Dine In", "Takeaway", "Delivery"].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}
              {showDeliveryDate && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600">Delivery Date</span>
                  <AppDatePicker
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
              )}
              {showShipping && (
                <div>
                  <label className="text-xs text-gray-500">Shipping Address</label>
                  <textarea
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    rows={2}
                    placeholder="Shipping address"
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                  />
                </div>
              )}
            </div>
          )}
          {showTotalQty && (
            <div className="flex items-center justify-between text-gray-600">
              <span>Total Quantity</span>
              <span className="text-gray-900">{totalQty}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-gray-600">
            <span>{subtotalMode === "Including Tax" ? "Subtotal (incl. tax)" : subtotalMode === "Excluding Tax" ? "Subtotal (excl. tax)" : "Subtotal"}</span>
            <span className="text-gray-900">{fmtMoney(displaySubtotal)}</span>
          </div>
          {showTaxCol && (
            <div className="flex items-center justify-between text-gray-600">
              <span>GST ({GST_RATE.toFixed(2)}%)</span>
              <span className="text-gray-900">{fmtMoney(rawTax)}</span>
            </div>
          )}
          {showDiscountCol && (
            <div className="flex items-center justify-between text-gray-600">
              <span>Discount{showInlineDiscount ? "" : ""}</span>
              <input
                type="number"
                min={0}
                value={discount || ""}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 px-2 py-1 text-right text-sm border border-gray-300 rounded-md"
              />
            </div>
          )}
          {showRoundOff && (
            <div className="flex items-center justify-between text-gray-600">
              <span>Round Off</span>
              <input
                type="number"
                value={roundOff || ""}
                placeholder="0"
                onChange={(e) => setRoundOff(Number(e.target.value) || 0)}
                className="w-20 px-2 py-1 text-right text-sm border border-gray-300 rounded-md"
              />
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-base font-semibold text-gray-900">Total</span>
            <span className="text-lg font-bold text-blue-600">{fmtMoney(computedTotal)}</span>
          </div>
          <button
            onClick={checkout}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <CreditCard className="w-4 h-4" /> Checkout
          </button>
        </div>
      </div>

      {/* ── process payment modal ── */}
      {modal === "payment" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Process Payment</h3>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto">
              <div className="flex justify-between gap-6 text-sm">
                <div className="space-y-1.5">
                  <p><span className="text-gray-500">POS Number:</span> <span className="font-semibold text-gray-900">{posNumber}</span></p>
                  <p><span className="text-gray-500">Date:</span> <span className="text-gray-900">{today}</span></p>
                  <p><span className="text-gray-500">Customer:</span> <span className="text-gray-900">{customerName}</span></p>
                  <p><span className="text-gray-500">Warehouse:</span> <span className="text-gray-900">{warehouseShort(warehouseName)}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-gray-900">Qayd</p>
                  {QAYD_ADDRESS.map((l) => (
                    <p key={l} className="text-gray-500">{l}</p>
                  ))}
                </div>
              </div>

              <div className="mt-5 border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Product", "Qty", "Price", ...(showTaxCol ? ["Taxes", "Tax Amount"] : []), "Total"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((i) => {
                      const lineTax = +(i.qty * i.price * i.taxRate / 100).toFixed(2);
                      const lineBase = i.qty * i.price;
                      const lineTotal = showLineTotalWithTax ? lineBase + lineTax : lineBase;
                      return (
                        <tr key={i.productId}>
                          <td className={`px-3 py-2.5 ${fullWidthDesc ? "" : ""}`}>
                            <p className={`font-medium text-gray-900 ${fullWidthDesc ? "whitespace-normal break-words" : ""}`}>{i.name}</p>
                            <p className="text-xs text-gray-400">{i.sku}</p>
                          </td>
                          <td className="px-3 py-2.5 text-gray-900">{i.qty}</td>
                          <td className="px-3 py-2.5 text-gray-900">{fmtMoney(i.price)}</td>
                          {showTaxCol && (
                            <>
                              <td className="px-3 py-2.5 text-gray-600">GST ({i.taxRate.toFixed(2)}%)</td>
                              <td className="px-3 py-2.5 text-gray-900">{fmtMoney(lineTax)}</td>
                            </>
                          )}
                          <td className="px-3 py-2.5 font-medium text-gray-900">{fmtMoney(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 border border-gray-200 rounded-lg px-4 py-3 space-y-1.5 text-sm">
                {showTotalQty && (
                  <div className="flex justify-between text-gray-600"><span>Total Quantity:</span><span className="text-gray-900">{totalQty}</span></div>
                )}
                <div className="flex justify-between text-gray-600"><span>Subtotal:</span><span className="text-gray-900">{fmtMoney(displaySubtotal)}</span></div>
                {showTaxCol && (
                  <div className="flex justify-between text-gray-600"><span>Tax:</span><span className="text-gray-900">{fmtMoney(rawTax)}</span></div>
                )}
                {showDiscountCol && (
                  <div className="flex justify-between text-gray-600"><span>Discount:</span><span className="text-gray-900">-{fmtMoney(discount)}</span></div>
                )}
                {showRoundOff && roundOffNum !== 0 && (
                  <div className="flex justify-between text-gray-600"><span>Round Off:</span><span className="text-gray-900">{fmtMoney(roundOffNum)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-100 items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">Total:</span>
                  {keepAmountEditable ? (
                    <input
                      type="number"
                      value={editableAmount}
                      onChange={(e) => setEditableAmount(e.target.value)}
                      className="w-32 px-2 py-1 text-right text-base font-bold text-blue-600 border border-gray-300 rounded-md"
                    />
                  ) : (
                    <span className="text-base font-bold text-blue-600">{fmtMoney(computedTotal)}</span>
                  )}
                </div>
                {showCashDenom && (
                  <div className="pt-2">
                    <label className="text-xs text-gray-500">Cash Received Denomination</label>
                    <input
                      value={cashDenomination}
                      onChange={(e) => setCashDenomination(e.target.value)}
                      placeholder="e.g. 500 x 2, 100 x 1"
                      className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                )}
                {orderType && orderType !== "Manual Select" && (
                  <div className="flex justify-between text-gray-600"><span>Order Type:</span><span className="text-gray-900">{orderType}</span></div>
                )}
                {showDeliveryDate && deliveryDate && (
                  <div className="flex justify-between text-gray-600"><span>Delivery Date:</span><span className="text-gray-900">{deliveryDate}</span></div>
                )}
                {showShipping && shippingAddress && (
                  <div className="pt-1 text-gray-600">
                    <span className="text-xs text-gray-500">Shipping:</span>
                    <p className="text-gray-900 whitespace-pre-wrap">{shippingAddress}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={completeSale} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">Complete Sale</button>
            </div>
          </div>
        </div>
      )}

      {/* ── receipt modal ── */}
      {modal === "receipt" && receipt && (
        <ReceiptModal
          order={receipt}
          onClose={() => setModal(null)}
          printLabel={defaultPrint === "KOT" ? "Print KOT" : defaultPrint === "Both" ? "Print KOT / Receipt" : "Print"}
        />
      )}
    </div>
  );
};

/* ── receipt modal (also used after Complete Sale) ─────────────── */

export function ReceiptModal({
  order,
  onClose,
  printLabel = "Print",
}: {
  order: PosOrder;
  onClose: () => void;
  printLabel?: string;
}) {
  const subtotal = orderSubtotal(order);
  const tax = orderTax(order);
  const total = orderTotal(order);

  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: [80, 160 + order.items.length * 30] });
    let y = 10;
    const c = (t: string, size = 9, bold = false) => {
      doc.setFont("courier", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.text(t, 40, y, { align: "center" });
      y += size * 0.55;
    };
    const lr = (l: string, r: string, bold = false) => {
      doc.setFont("courier", bold ? "bold" : "normal");
      doc.setFontSize(8);
      doc.text(l, 6, y);
      doc.text(r, 74, y, { align: "right" });
      y += 4.5;
    };
    const hr = () => { c("-".repeat(32), 8); };
    c("Qayd", 12, true);
    QAYD_ADDRESS.forEach((l) => c(l, 8));
    hr();
    lr("Receipt:", order.number, true);
    lr("Date:", order.date);
    lr("Customer:", order.customer.replace(" Customer", ""));
    hr();
    for (const i of order.items) {
      lr(i.name, "", true);
      lr("Qty:", String(i.qty));
      lr("Price:", money(i.price));
      lr("Tax:", `GST (${i.taxRate.toFixed(2)}%)`);
      lr("Tax Amount:", money(+(i.qty * i.price * i.taxRate / 100).toFixed(2)));
      lr("Sub Total:", money(i.qty * i.price), true);
      y += 1.5;
    }
    hr();
    lr("Subtotal:", money(subtotal));
    lr("Tax:", money(tax));
    lr("Discount:", `-${money(order.discount)}`);
    lr("Total:", money(total), true);
    hr();
    c("* Thank you for your business! *", 8);
    doc.save(`${order.number.replace("#", "")}-receipt.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-[#FAFBFC] rounded-xl border border-gray-200 shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-semibold text-green-600">Sale Completed Successfully!</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">
          <div className="rounded-lg border border-gray-200 px-4 py-3 text-center mb-4">
            <p className="text-sm text-gray-700">Your transaction has been processed successfully.</p>
            <p className="text-sm font-semibold text-green-700 mt-1">Receipt Number: {order.number}</p>
          </div>
          <div className="border border-gray-200 rounded-lg px-5 py-4 font-mono text-xs text-gray-800 space-y-0.5">
            <p className="text-center font-bold text-sm">Qayd</p>
            {QAYD_ADDRESS.map((l) => (
              <p key={l} className="text-center">{l}</p>
            ))}
            <p className="text-center text-gray-400">{"-".repeat(34)}</p>
            <div className="flex justify-between"><span>Receipt:</span><span className="font-bold">{order.number}</span></div>
            <div className="flex justify-between"><span>Date:</span><span>{order.date}</span></div>
            <div className="flex justify-between"><span>Customer:</span><span>{order.customer.replace(" Customer", "")}</span></div>
            <p className="text-center text-gray-400">{"-".repeat(34)}</p>
            {order.items.map((i) => (
              <div key={i.productId} className="pt-1">
                <p className="font-bold">{i.name}</p>
                <div className="flex justify-between"><span>Qty:</span><span>{i.qty}</span></div>
                <div className="flex justify-between"><span>Price:</span><span>{money(i.price)}</span></div>
                <div className="flex justify-between"><span>Tax:</span><span>GST ({i.taxRate.toFixed(2)}%)</span></div>
                <div className="flex justify-between"><span>Tax Amount:</span><span>{money(+(i.qty * i.price * i.taxRate / 100).toFixed(2))}</span></div>
                <div className="flex justify-between font-bold"><span>Sub Total:</span><span>{money(i.qty * i.price)}</span></div>
              </div>
            ))}
            <p className="text-center text-gray-400">{"-".repeat(34)}</p>
            <div className="flex justify-between"><span>Discount:</span><span>-{money(order.discount)}</span></div>
            <div className="flex justify-between font-bold text-sm pt-1"><span>Total:</span><span>{money(total)}</span></div>
            <p className="text-center text-gray-400">{"-".repeat(34)}</p>
            <p className="text-center">* Thank you for your business! *</p>
            <p className="text-center text-gray-400">{new Date(order.createdAt).toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-center gap-3">
          <button onClick={downloadPdf} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50">
            <Printer className="w-4 h-4" /> {printLabel}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}
