/**
 * File: src/pages/items/Product.tsx
 * Product — master/detail layout matching the reference design.
 * Left: list (search, sort, status/category filters, selection mode); rows
 *       show price + colored Stock line (red=0, green>0).
 * Right: sectioned read-only view (Details / Quantity / Pricing & Tax /
 *        Stock Status / Description) with an Update Stock button + ⋮ menu.
 *        Pencil → inline Edit Product form; FAB → Create Product.
 * Modals: Update Stock (vendor / qty / buy price + history), Add Variation.
 * Backend not wired (per request) — data is hardcoded to match the design.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useLocation, useNavigate } from "react-router-dom";
import { useCollection, repo, money, parseMoney, db } from "@/lib/db";
import { getAppSettings, useAppSettings, isProductFieldVisible } from "@/lib/db/appSettings";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchProducts,
  deleteProduct,
  deleteProducts,
  archiveProduct,
  archiveProducts,
  unarchiveProduct,
  restoreProduct,
  duplicateProduct,
  duplicateProducts,
  mergeProducts,
  uploadProductImage,
  resolveProductImageUrl,
  hasProductImage,
  type ProductListRow,
} from "@/services/productsApi";
import { searchProductCategories } from "@/services/categoriesApi";
import AsyncSearchSelect from "@/components/ui/AsyncSearchSelect";
import { showToast } from "@/utils/toast";
import { api } from "../../lib/api/client";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import {
  Search,
  Plus,
  ChevronDown,
  Check,
  Settings,
  Pencil,
  MoreVertical,
  X,
  Trash2,
  Copy,
  Archive,
  RotateCcw,
  Barcode,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Combine,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
interface Product {
  id: string;
  backendId: string;
  image?: string | null;
  name: string;
  category: string;
  categoryId: string;
  note: string;
  price: string;
  stock: number | null;
  sku: string;
  qty: string;
  unit: string;
  buyPrice: string;
  buyTax: string;
  sellTax: string;
  onHand: string;
  committed: string;
  available: string;
  toInvoiced: string;
  toBilled: string;
}

const mapProductRow = (row: ProductListRow): Product => ({
  id: row._id,
  backendId: row._id,
  image: row.image,
  name: row.name,
  category: row.category,
  categoryId: row.categoryId,
  note: row.note,
  price: money(row.price),
  stock: row.stock,
  sku: row.sku,
  qty: row.qty,
  unit: row.unit,
  buyPrice: money(row.buyPrice),
  buyTax: "—",
  sellTax: "—",
  onHand: row.onHand,
  committed: row.committed,
  available: row.available,
  toInvoiced: row.toInvoiced,
  toBilled: row.toBilled,
});

const productSortField = (label: string) => {
  if (label === "Price") return "pricing.sellPrice";
  if (label === "Stock") return "stock.onHandStock";
  if (label === "Category") return "category";
  if (label === "Created On") return "createdAt";
  return "productName";
};

const sortFields = ["Name", "Price", "Stock", "Category", "Created On"];
const statusList = ["All", "Active", "Archived", "Trash"];
const unitTypes = ["box", "cm", "kg", "pcs", "ft"];
const taxList = ["Test Tax", "new test tax", "VAT", "GST"];

/* ── Outside-click dropdown ────────────────────────────────────── */
const Dropdown: React.FC<{
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  panelClass?: string;
}> = ({ trigger, children, align = "left", panelClass = "" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && (
        <div className={`absolute z-30 mt-2 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-xl py-1 ${align === "right" ? "right-0" : "left-0"} ${panelClass}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

/* ── Modal shell ───────────────────────────────────────────────── */
const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div>
    </div>
  );
};

/* ── Merge Products modal ──────────────────────────────────────── */
const MergeProductsModal: React.FC<{
  items: Product[];
  onClose: () => void;
  onMerge: (survivorBackendId: string) => void;
}> = ({ items, onClose, onMerge }) => {
  const [pick, setPick] = useState<string | null>(items[0]?.backendId ?? null);
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-xl my-16 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Merge Products</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button
              type="button"
              disabled={!pick}
              onClick={() => pick && onMerge(pick)}
              className={`px-5 py-1.5 text-sm rounded-md font-medium ${!pick ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              Merge
            </button>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {items.map((p) => (
            <button key={p.id} type="button" onClick={() => setPick(p.backendId)} className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-200 hover:bg-gray-50 text-left">
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${pick === p.backendId ? "border-blue-600" : "border-gray-400"}`}>
                {pick === p.backendId && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                {p.sku && p.sku !== "—" && <span className="block text-xs text-gray-500 truncate">SKU: {p.sku}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 text-xs text-gray-500 bg-gray-50">Select the product with which you wish to merge the rest of the products</div>
      </div>
    </Overlay>
  );
};

/* ── Section header bar ─────────────────────────────────────────── */
const SectionBar: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-y border-gray-200">
    <span className="text-sm font-semibold text-gray-900">{title}</span>
    {right}
  </div>
);
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div><div className="text-xs text-gray-500">{label}</div><div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div></div>
);

const fieldCls = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
const FloatField: React.FC<{ label?: string; value?: string; placeholder?: string; icon?: React.ReactNode; onChange?: (v: string) => void }> = ({ label, value, placeholder, icon, onChange }) => (
  <div className="relative fl-wrap">
    {label && <label className="fl-label">{label}</label>}
    <div className="relative">
      <input
        {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : { defaultValue: value })}
        placeholder={placeholder && placeholder !== label ? placeholder : " "} className={fieldCls}
      />
      {icon && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
    </div>
  </div>
);
const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button onClick={onChange} className={`w-9 h-5 rounded-full transition-colors relative ${on ? "bg-blue-600" : "bg-gray-300"}`}>
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
  </button>
);

/* ── Update Stock modal — vendor type-ahead + add rows (references:
   Desktop/update stock*.png). Each added row bumps the product's stock and
   auto-generates a Purchase Order; rows persist in meta `stock:updates:<id>`. */
interface StockRow { id: string; vendor: string; qty: number; unit: string; buyPrice: number; poId?: number }

const UpdateStockModal: React.FC<{ onClose: () => void; product: Product }> = ({ onClose, product }) => {
  const vendors = useCollection<any>("vendors", "name");
  const dbProducts = useCollection<any>("products");
  const poSettings = useAppSettings("doc:purchaseOrder");
  const trackPoStock = poSettings?.general?.trackPurchaseOrdersInStock !== false;
  const localProductId = dbProducts.find((p) => String(p._id) === product.backendId)?.id as number | undefined;
  const metaKey = `stock:updates:${product.id}`;
  const [rows, setRows] = useState<StockRow[]>([]);
  useEffect(() => {
    db.meta.get(metaKey).then((r) => { if (r?.value) setRows(r.value as StockRow[]); });
  }, [metaKey]);
  const saveRows = (list: StockRow[]) => { setRows(list); db.meta.put({ key: metaKey, value: list }); };

  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [venOpen, setVenOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [buyPrice, setBuyPrice] = useState(product.buyPrice.replace(/[^0-9.]/g, ""));
  const [unit, setUnit] = useState(product.unit);
  const venRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (venRef.current && !venRef.current.contains(e.target as Node)) setVenOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const vendorMatches = vendors.filter((v) => v.name.toLowerCase().includes(vendorQuery.toLowerCase()));
  const exactMatch = vendors.some((v) => v.name.toLowerCase() === vendorQuery.trim().toLowerCase());
  const vendorEmpty = !vendorQuery.trim();
  const labelText = !vendorEmpty && !exactMatch ? "New Vendor" : "Vendor";

  const add = async () => {
    if (vendorEmpty) { showToast("Vendor is required", "warning"); return; }
    const qtyN = parseMoney(qty);
    if (qtyN <= 0) { showToast("Enter a quantity greater than 0", "warning"); return; }
    const priceN = parseMoney(buyPrice);
    // resolve or create the vendor from the typed name
    let vid = vendorId;
    if (vid == null) {
      const found = vendors.find((v) => v.name.toLowerCase() === vendorQuery.trim().toLowerCase());
      vid = found ? found.id : ((await repo.add("vendors", { name: vendorQuery.trim(), status: "Active", payable: 0 })) as number);
    }
    const vendorName = vendors.find((v) => v.id === vid)?.name || vendorQuery.trim();
    const poSettings = await getAppSettings("doc:purchaseOrder");
    const trackPo = poSettings?.general?.trackPurchaseOrdersInStock !== false;
    let poId: number | undefined;
    if (trackPo) {
      const total = +(qtyN * priceN).toFixed(2);
      const n = await repo.nextNumber("purchaseOrders");
      const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      poId = (await repo.add("purchaseOrders", {
        number: "#" + n, vendorId: vid, date, due: date, ts: Date.now(), status: "Draft", billStatus: "Not Billed",
        items: [{ id: 1, name: product.name, description: "Stock update", qty: qtyN, rate: priceN, taxId: 1, discount: 0, amount: total }],
        subTotal: total, tax: 0, total, amountPaid: 0, amountDue: total, notes: `Auto-generated by Update Stock (${product.name})`,
      })) as number;
    }
    // bump the product's stock
    if (localProductId != null) {
      await repo.update("products", localProductId, { stock: (product.stock ?? 0) + qtyN, buyPrice: priceN, unit });
    }
    saveRows([...rows, { id: Math.random().toString(36).slice(2, 8), vendor: vendorName, qty: qtyN, unit, buyPrice: priceN, poId }]);
    showToast(
      trackPo && poId
        ? `Stock updated — Purchase Order generated`
        : "Stock updated",
      "success",
    );
    setVendorQuery(""); setVendorId(null); setQty("1");
  };

  const removeRow = async (row: StockRow) => {
    if (localProductId == null) return;
    const current = (await repo.getOne("products", localProductId))?.stock ?? 0;
    await repo.update("products", localProductId, { stock: Math.max(0, current - row.qty) });
    if (row.poId) await repo.remove("purchaseOrders", row.poId);
    saveRows(rows.filter((r) => r.id !== row.id));
    showToast("Stock entry removed", "info");
  };

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-2xl my-12 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Update Stock</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* vendor type-ahead (red until a vendor is typed/picked, per reference) */}
          <div className="relative fl-wrap" ref={venRef}>
            <label className={`fl-label ${vendorEmpty ? "text-red-500" : "text-gray-500"}`}>{labelText}</label>
            <input
              value={vendorQuery}
              onChange={(e) => { setVendorQuery(e.target.value); setVendorId(null); setVenOpen(true); }}
              onFocus={() => setVenOpen(true)}
              placeholder="Vendor"
              className={`${fieldCls} ${vendorEmpty ? "border-red-400 placeholder-red-400" : ""}`}
            />
            {venOpen && vendorMatches.length > 0 && (
              <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-52 overflow-y-auto custom-scrollbar">
                {vendorMatches.map((v) => (
                  <button key={v.id} onClick={() => { setVendorId(v.id); setVendorQuery(v.name); setVenOpen(false); }} className="w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">{v.name}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-end gap-3">
            <FloatField label="Quantity" value={qty} onChange={setQty} />
            <FloatField label="Buy Price" value={buyPrice} onChange={setBuyPrice} />
            <div className="relative fl-wrap min-w-[120px]">
              <label className="fl-label">Unit Type</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldCls}>{unitTypes.map((u) => <option key={u}>{u}</option>)}</select>
            </div>
            <button onClick={add} title="Add stock" className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
          </div>
          {trackPoStock && (
            <p className="text-xs text-gray-500 italic">A Purchase Order will be generated automatically when you add stock.</p>
          )}
          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-200 text-gray-500 text-xs">
                  <th className="text-left font-semibold py-2">Vendor</th>
                  <th className="text-left font-semibold py-2">Qty (Unit)</th>
                  <th className="text-left font-semibold py-2">Buy Price</th>
                  <th className="py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-200">
                    <td className="py-3 text-gray-800">{r.vendor}</td>
                    <td className="py-3 text-gray-800">{r.qty} {r.unit}</td>
                    <td className="py-3 text-gray-800">{money(r.buyPrice)}</td>
                    <td className="py-3 text-right"><button onClick={() => removeRow(r)} title="Remove stock entry" className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"><X className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Overlay>
  );
};

/* ── Product form sections (shared by Edit / Add Variation) ────── */
const ImageBlock: React.FC<{
  editable?: boolean;
  image?: string | null;
  onChange?: (pathOrUrl: string | null) => void;
}> = ({ editable, image, onChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const displaySrc = image?.startsWith("data:") ? image : resolveProductImageUrl(image);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f) return;
    setUploading(true);
    try {
      const { path } = await uploadProductImage(f);
      onChange?.(path);
    } catch {
      showToast("Could not upload that image", "error");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          type="button"
          disabled={!editable || uploading}
          onClick={() => fileRef.current?.click()}
          title={editable ? "Choose product photo" : undefined}
          className={`w-20 h-20 rounded-md border border-gray-300 bg-blue-50 flex items-center justify-center text-blue-500 overflow-hidden ${editable ? "hover:border-blue-400 cursor-pointer" : "cursor-default"}`}
        >
          {hasProductImage(image) && displaySrc ? <img src={displaySrc} alt="Product" className="w-full h-full object-cover" /> : <ImageIcon className="w-7 h-7" />}
        </button>
        {editable && image && (
          <button type="button" title="Remove photo" onClick={() => onChange?.(null)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center hover:bg-red-500"><X className="w-3 h-3" /></button>
        )}
      </div>
      {editable && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50 disabled:opacity-60"><Upload className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload Photo"}</button>
          <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-blue-200 text-blue-600 text-sm font-medium hover:bg-blue-50"><Sparkles className="w-4 h-4" /> Generate Image with AI</button>
        </>
      )}
    </div>
  );
};

/* ── type-ahead suggestion field (floating label + option dropdown) ── */
const SuggestField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ label, value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const q = value.trim().toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(q));
  return (
    <div className="relative fl-wrap" ref={ref}>
      <label className="fl-label">{label}</label>
      <input
        value={value}
        placeholder=" "
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        className={fieldCls}
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-md shadow-xl py-1 max-h-56 overflow-y-auto custom-scrollbar">
          {matches.map((o) => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o}</button>
          ))}
        </div>
      )}
    </div>
  );
};

const ProductForm: React.FC<{ mode: "create" | "edit" | "variation"; product?: Product; title: string; asModal?: boolean; onClose: () => void; onSave?: (data: any) => void }> = ({ mode, product, title, asModal, onClose, onSave }) => {
  const productSettings = useAppSettings("product");
  const showFv = (k: string) => isProductFieldVisible(productSettings?.fieldVisibility, k);
  const showInventory = showFv("Inventory");
  const showHsn = showFv("HSN");
  const showMrp = showFv("MRP");
  const showProductStock = productSettings?.productStock !== false;
  const [inv, setInv] = useState(true);
  const [serial, setSerial] = useState(false);
  const [batch, setBatch] = useState(false);
  const isVariation = mode === "variation";
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product && product.category !== "No Category" ? product.category : "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [sku, setSku] = useState(product && product.sku !== "—" ? product.sku : "");
  const [hsn, setHsn] = useState((product as any)?.hsn ?? "");
  const [mrp, setMrp] = useState((product as any)?.mrp != null ? String((product as any).mrp) : "");
  const [qty, setQty] = useState(product?.qty ?? "1");
  const [unit, setUnit] = useState(product?.unit ?? "box");
  const [buyPrice, setBuyPrice] = useState(product ? product.buyPrice.replace(/[^0-9.]/g, "") : "0");
  const [sellPrice, setSellPrice] = useState(product ? product.price.replace(/[^0-9.]/g, "") : "0");
  const [note, setNote] = useState(product && product.note !== "No Notes" ? product.note : "");
  const [image, setImage] = useState<string | null>(product?.image ?? null);
  const [buyTax, setBuyTax] = useState(product?.buyTax ?? "");
  const [sellTax, setSellTax] = useState(product?.sellTax ?? "");
  const [onHand, setOnHand] = useState(product?.onHand ?? "0.00");
  const [committed, setCommitted] = useState(product?.committed ?? "0.00");
  const [available, setAvailable] = useState(product?.available ?? "0.00");
  const [toInvoiced, setToInvoiced] = useState(product?.toInvoiced ?? "0.00");
  const [toBilled, setToBilled] = useState(product?.toBilled ?? "0.00");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const dbUnits = useCollection<any>("units", "name");
  const dbTaxes = useCollection<any>("taxes", "name");
  const unitOptions = useMemo(() => dbUnits.map((u) => u.name).filter(Boolean), [dbUnits]);
  const taxOptions = dbTaxes.length > 0 ? dbTaxes : taxList.map((name) => ({ name }));

  const handleSave = () => {
    onSave?.({
      name,
      category,
      categoryId,
      sku,
      hsn,
      mrp,
      qty,
      unit,
      buyPrice,
      sellPrice,
      note,
      image,
      buyTax,
      sellTax,
      onHand,
      committed,
      available,
      toInvoiced,
      toBilled,
      inventory: showInventory ? inv : true,
    });
    onClose();
  };
  const body = (
    <>
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300 sticky top-0 bg-white z-20">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} title="Product Settings" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={handleSave} className="px-5 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Save</button>
        </div>
      </div>

      {/* Details */}
      <SectionBar title="Details" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
        <div className="space-y-5">
          {!isVariation && <FloatField label="Product Name *" value={name} onChange={setName} placeholder="Product Name" />}
          {!isVariation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <AsyncSearchSelect
                value={categoryId}
                displayName={category}
                placeholder="Search category..."
                onSearch={searchProductCategories}
                onChange={(id, opt) => {
                  setCategoryId(id);
                  setCategory(opt?.name || "");
                }}
              />
            </div>
          )}
          <FloatField label="SKU" value={sku} onChange={setSku} placeholder="SKU" icon={<Barcode className="w-4 h-4" />} />
          {showHsn && <FloatField label="HSN" value={hsn} onChange={setHsn} placeholder="HSN" />}
          {isVariation && <FloatField label="Variant Size" placeholder="Variant Size" />}
        </div>
        <div className="space-y-4">
          <ImageBlock editable image={image} onChange={setImage} />
          {showInventory && (
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={inv} onChange={() => setInv((v) => !v)} className="accent-blue-600" /> Inventory</label>
          )}
        </div>
      </div>
      {!isVariation && (
        <div className="flex items-center gap-10 px-6 pb-5">
          <div className="flex items-center gap-3"><span className="text-sm text-gray-700">Enable Serialization</span><Toggle on={serial} onChange={() => setSerial((v) => !v)} /></div>
          <div className="flex items-center gap-3"><span className="text-sm text-gray-700">Enable Batching</span><Toggle on={batch} onChange={() => setBatch((v) => !v)} /></div>
        </div>
      )}

      {/* Quantity */}
      <SectionBar title="Quantity" right={<span className="text-xs text-gray-500">Type: Standard</span>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
        <FloatField label="Quantity" value={qty} onChange={setQty} />
        <SuggestField label="Unit Type" value={unit} onChange={setUnit} options={unitOptions} />
      </div>

      {/* Pricing & Tax */}
      <SectionBar title="Pricing & Tax" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
        <FloatField label="Buy Price" value={buyPrice} onChange={setBuyPrice} />
        <div className="relative fl-wrap">
          <label className="fl-label">Buy Price Tax</label>
          <select value={buyTax} onChange={(e) => setBuyTax(e.target.value)} className={fieldCls}>
            <option value="">No Tax</option>
            {taxOptions.map((t: any) => <option key={t.id ?? t.name} value={t.name}>{t.rate != null ? `${t.name} (${t.rate}%)` : t.name}</option>)}
          </select>
        </div>
        <FloatField label="Sell Price" value={sellPrice} onChange={setSellPrice} />
        <div className="relative fl-wrap">
          <label className="fl-label">Sell Price Tax</label>
          <select value={sellTax} onChange={(e) => setSellTax(e.target.value)} className={fieldCls}>
            <option value="">No Tax</option>
            {taxOptions.map((t: any) => <option key={t.id ?? t.name} value={t.name}>{t.rate != null ? `${t.name} (${t.rate}%)` : t.name}</option>)}
          </select>
        </div>
        {showMrp && <FloatField label="MRP" value={mrp} onChange={setMrp} />}
        <FloatField label="Currency" value="$ USD" />
      </div>

      {/* Stock Status — editable, persisted on the product record */}
      {showProductStock && (
        <>
          <SectionBar title="Stock Status" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-5">
            <FloatField label="On Hand Stock" value={onHand} onChange={setOnHand} />
            <FloatField label="Committed Stock" value={committed} onChange={setCommitted} />
            <FloatField label="Available for Sale" value={available} onChange={setAvailable} />
            <FloatField label="To Be Invoiced" value={toInvoiced} onChange={setToInvoiced} />
            <FloatField label="To Be Billed" value={toBilled} onChange={setToBilled} />
          </div>
        </>
      )}

      {/* Description */}
      <SectionBar title="Description" />
      <div className="px-6 py-5">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Description" className="w-full h-28 border border-gray-300 rounded-md p-3 text-sm text-gray-700 outline-none resize-none focus:ring-1 focus:ring-blue-600" />
      </div>

      {settingsOpen && <AppSettingsModal initialTab="Product" onClose={() => setSettingsOpen(false)} />}
    </>
  );

  if (asModal) {
    return (
      <Overlay onClose={onClose}>
        <div className="w-full max-w-4xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">{body}</div>
      </Overlay>
    );
  }
  return <section className="flex-1 overflow-y-auto custom-scrollbar m-2 bg-white border border-gray-300 shadow-sm">{body}</section>;
};

/* ── Component ──────────────────────────────────────────────────── */
export const Product: React.FC = () => {
  const queryClient = useQueryClient();
  const productSettings = useAppSettings("product");
  const showFv = (k: string) => isProductFieldVisible(productSettings?.fieldVisibility, k);
  const showProductStock = productSettings?.productStock !== false;
  const [selectedId, setSelectedId] = useState("");
  const [sortBy, setSortBy] = useState("Created On");
  const [sortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [categoryFilterLabel, setCategoryFilterLabel] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();
  const openCreateFromNav = !!(location.state as { openCreate?: boolean } | null)?.openCreate;
  const [mode, setMode] = useState<"view" | "create" | "edit">(openCreateFromNav ? "create" : "view");
  useEffect(() => {
    if (openCreateFromNav) {
      setMode("create");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [openCreateFromNav, location.pathname, navigate]);
  const [modal, setModal] = useState<null | "stock" | "variation" | "settings">(null);

  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selAction, setSelAction] = useState<null | "merge" | "mergeConfirm">(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [sortBy, statusFilter, categoryFilterId]);

  const { data: listData } = useQuery({
    queryKey: ["products-list", page, search, sortBy, sortDir, statusFilter, categoryFilterId],
    queryFn: () => fetchProducts({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(productSortField(sortBy), sortDir),
      category: categoryFilterId || undefined,
      isDeleted: statusFilter === "Trash" || undefined,
      isArchive: statusFilter === "Archived" || undefined,
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = listData?.pagination;
  const products: Product[] = useMemo(
    () => (listData?.rows ?? []).map(mapProductRow),
    [listData?.rows],
  );

  const filtered = products;
  const selected = products.find((i) => i.id === selectedId) || products[0];

  useEffect(() => {
    if (products.length > 0 && !products.some((p) => p.id === selectedId)) {
      setSelectedId(products[0].id);
    }
  }, [products, selectedId]);

  const dbProducts = useCollection<any>("products", "name");
  const selectedLocal = dbProducts.find((p) => String(p._id) === selected?.backendId);

  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.id));
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.id))));
  const checkedBackendIds = useMemo(
    () => products.filter((p) => checked.has(p.id)).map((p) => p.backendId),
    [products, checked],
  );
  const checkedItems = useMemo(
    () => products.filter((p) => checked.has(p.id)),
    [products, checked],
  );
  const invalidateProductsList = () => void queryClient.invalidateQueries({ queryKey: ["products-list"] });
  const bulkDisabled = checked.size === 0;
  const bulkBtnClass = (disabled: boolean) =>
    `w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 ${disabled ? "opacity-40 pointer-events-none" : ""}`;

  const bulkMerge = async (survivorId: string) => {
    const mergedIds = checkedBackendIds.filter((id) => id !== survivorId);
    try {
      await mergeProducts(survivorId, mergedIds);
      invalidateProductsList();
      exitSelect();
      setSelAction(null);
      setMergeTargetId(null);
      showToast("Products merged", "success");
    } catch {
      showToast("Merge failed", "error");
    }
  };

  const handleBulkArchiveOrRestore = async () => {
    if (bulkDisabled) {
      showToast(statusFilter === "Trash" ? "Select products to restore" : statusFilter === "Archived" ? "Select products to unarchive" : "Select products to archive", "warning");
      return;
    }
    try {
      if (statusFilter === "Trash") {
        await Promise.all(checkedBackendIds.map(restoreProduct));
        showToast("Products restored", "success");
      } else if (statusFilter === "Archived") {
        await Promise.all(checkedBackendIds.map(unarchiveProduct));
        showToast("Products unarchived", "success");
      } else {
        await archiveProducts(checkedBackendIds);
        showToast("Products archived", "success");
      }
      invalidateProductsList();
      exitSelect();
    } catch {
      showToast(statusFilter === "Trash" ? "Restore failed" : "Archive failed", "error");
    }
  };

  const handleBulkDuplicate = async () => {
    if (bulkDisabled) {
      showToast("Select products to duplicate", "warning");
      return;
    }
    try {
      await duplicateProducts(checkedBackendIds);
      invalidateProductsList();
      exitSelect();
      showToast("Products duplicated", "success");
    } catch {
      showToast("Duplicate failed", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDisabled) {
      showToast("Select products to delete", "warning");
      return;
    }
    try {
      await deleteProducts(checkedBackendIds);
      invalidateProductsList();
      exitSelect();
      showToast("Products deleted", "success");
    } catch {
      showToast("Delete failed", "error");
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const hasActiveFilters = statusFilter !== "All" || !!search.trim() || !!categoryFilterId;
  if (!selected && mode !== "create" && !hasActiveFilters) return <ListEmptyState title="No products yet" onCreate={() => setMode("create")} createLabel="New Product" />;

  return (
    <div className="module-workspace">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setMode("create")} createTitle="Create Product" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Merge"
                onClick={() => (checked.size < 2 ? showToast("Select at least two products to merge", "warning") : setSelAction("merge"))}
                className={bulkBtnClass(checked.size < 2)}
              >
                <Combine className="w-4 h-4" />
              </button>
              {statusFilter === "Trash" ? (
                <button type="button" title="Restore" onClick={handleBulkArchiveOrRestore} className={bulkBtnClass(bulkDisabled)}><RotateCcw className="w-4 h-4" /></button>
              ) : (
                <button type="button" title={statusFilter === "Archived" ? "Unarchive" : "Archive"} onClick={handleBulkArchiveOrRestore} className={bulkBtnClass(bulkDisabled)}><Archive className="w-4 h-4" /></button>
              )}
              <button type="button" title="Duplicate" onClick={handleBulkDuplicate} className={bulkBtnClass(bulkDisabled)}><Copy className="w-4 h-4" /></button>
              <button type="button" title="Delete" onClick={handleBulkDelete} className={bulkBtnClass(bulkDisabled)}><Trash2 className="w-4 h-4" /></button>
              <button type="button" title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Products</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Products")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("products"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("products"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search products..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => sortFields.map((o) => (
              <button key={o} onClick={() => { setSortBy(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <Dropdown trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusList.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${s === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{s} {s === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
          <div className="min-w-[180px] flex-1 max-w-xs">
            <AsyncSearchSelect
              value={categoryFilterId}
              displayName={categoryFilterLabel}
              placeholder="All categories"
              onSearch={searchProductCategories}
              onChange={(id, opt) => {
                setCategoryFilterId(id);
                setCategoryFilterLabel(opt?.name || "");
              }}
              className="text-xs"
            />
          </div>
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.map((p) => {
            const active = !selectMode && mode === "view" && p.id === selectedId;
            const isChecked = checked.has(p.id);
            return (
              <button key={p.id} onClick={() => (selectMode ? toggleRow(p.id) : (setSelectedId(p.id), setMode("view")))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.category}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{p.note}</div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">{p.price}</span>
                  {showProductStock && p.stock !== null && (
                    <span className={`text-xs font-medium mt-1 ${p.stock > 0 ? "text-green-600" : "text-red-500"}`}>Stock: {p.stock.toFixed(2)}</span>
                  )}
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <ListSidebarFooter
          total={`${listPagination?.totalData ?? filtered.length}`}
          countLabel="Products"
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {selectMode ? (
        <section className="module-empty-panel">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900">{checked.size} {checked.size === 1 ? "Product" : "Products"} Selected</h2>
          </div>
        </section>
      ) : mode === "create" ? (
        <ProductForm mode="create" title="Create Product" onClose={() => setMode("view")} onSave={async (d) => { await repo.add("products", { name: d.name || "Untitled", category: d.category, categoryId: d.categoryId || "", sku: d.sku, note: d.note, image: d.image ?? null, price: parseMoney(d.sellPrice), buyPrice: parseMoney(d.buyPrice), stock: parseMoney(d.qty) || 0, qty: parseMoney(d.qty) || 1, unit: d.unit, buyTax: d.buyTax, sellTax: d.sellTax, onHand: d.onHand, committed: d.committed, available: d.available, toInvoiced: d.toInvoiced, toBilled: d.toBilled, taxId: 1, status: "Active" }); void queryClient.invalidateQueries({ queryKey: ["products-list"] }); }} />
      ) : mode === "edit" && selected ? (
        <ProductForm mode="edit" product={selected} title="Edit Product" onClose={() => setMode("view")} onSave={async (d) => { if (selectedLocal?.id != null) await repo.update("products", selectedLocal.id, { name: d.name, category: d.category, categoryId: d.categoryId || "", sku: d.sku, note: d.note, image: d.image ?? null, price: parseMoney(d.sellPrice), buyPrice: parseMoney(d.buyPrice), stock: parseMoney(d.qty) || 0, qty: parseMoney(d.qty) || 1, unit: d.unit, buyTax: d.buyTax, sellTax: d.sellTax, onHand: d.onHand, committed: d.committed, available: d.available, toInvoiced: d.toInvoiced, toBilled: d.toBilled }); void queryClient.invalidateQueries({ queryKey: ["products-list"] }); }} />
      ) : selected ? (
        <section className="module-detail-panel custom-scrollbar">
          {/* detail header */}
          <div className="module-title-bar">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight truncate">{selected.name}</h1>
            <div className="flex items-center gap-2">
              {showProductStock && (
                <button onClick={() => setModal("stock")} className="px-4 py-1.5 text-sm bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Update Stock</button>
              )}
              <button onClick={() => setModal("settings")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Settings"><Settings className="w-4 h-4" /></button>
              <button onClick={() => setMode("edit")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
              <Dropdown align="right" trigger={<span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MoreVertical className="w-4 h-4" /></span>}>
                {(close) => (
                  <>
                    <button onClick={() => { setModal("variation"); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><Layers className="w-4 h-4 text-gray-400" /> Add Variation</button>
                    <button
                      onClick={async () => {
                        if (!selected?.backendId) { close(); return; }
                        try {
                          await duplicateProduct(selected.backendId);
                          invalidateProductsList();
                          showToast("Product duplicated", "success");
                        } catch {
                          showToast("Duplicate failed", "error");
                        }
                        close();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    ><Copy className="w-4 h-4 text-gray-400" /> Duplicate</button>
                    <button
                      onClick={async () => {
                        if (!selected?.backendId) { close(); return; }
                        try {
                          if (statusFilter === "Archived") {
                            await unarchiveProduct(selected.backendId);
                            showToast("Product unarchived", "success");
                          } else {
                            await archiveProduct(selected.backendId);
                            showToast("Product archived", "success");
                          }
                          invalidateProductsList();
                        } catch {
                          showToast("Archive failed", "error");
                        }
                        close();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-gray-50 text-left"
                    ><Archive className="w-4 h-4" /> {statusFilter === "Archived" ? "Unarchive" : "Archive"}</button>
                    <button onClick={async () => { if (selected?.backendId) { try { await deleteProduct(selected.backendId); invalidateProductsList(); showToast("Product deleted", "success"); } catch { showToast("Delete failed", "error"); } } close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200"><Trash2 className="w-4 h-4" /> Delete</button>
                  </>
                )}
              </Dropdown>
            </div>
          </div>

          {/* ── Details ── */}
          <SectionBar title="Details" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
            <div className="space-y-5">
              <Stat label="Product Name *" value={selected.name} />
              <Stat label="Category" value={selected.category} />
              <Stat label="SKU" value={selected.sku} />
              {showFv("HSN") && <Stat label="HSN" value={(selected as any).hsn || "—"} />}
            </div>
            <div className="space-y-4">
              <ImageBlock image={selected.image} />
              {showFv("Inventory") && (
                <label className="flex items-center gap-2 text-sm text-gray-500"><input type="checkbox" checked readOnly className="accent-blue-600" /> Inventory</label>
              )}
            </div>
          </div>

          {/* ── Quantity ── */}
          <SectionBar title="Quantity" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
            <Stat label="Quantity" value={selected.qty} />
            <Stat label="Unit Type" value={selected.unit} />
          </div>

          {/* ── Pricing & Tax ── */}
          <SectionBar title="Pricing & Tax" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5 px-6 py-5">
            <Stat label="Buy Price" value={`$ ${selected.buyPrice.replace("$", "")}`} />
            <Stat label="Buy Price Tax" value={selected.buyTax} />
            <Stat label="Sell Price" value={`$ ${selected.price.replace("$", "")}`} />
            <Stat label="Sell Price Tax" value={selected.sellTax} />
            {showFv("MRP") && <Stat label="MRP" value={(selected as any).mrp != null ? String((selected as any).mrp) : "—"} />}
            <Stat label="Currency" value="$ USD" />
            {showProductStock && <Stat label="Stock" value={(selected.stock ?? 0).toFixed(2)} />}
          </div>

          {/* ── Stock Status ── */}
          <SectionBar title="Stock Status" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-6 py-5">
            <Stat label="On Hand Stock" value={selected.onHand} />
            <Stat label="Committed Stock" value={selected.committed} />
            <Stat label="Available for Sale" value={selected.available} />
            <Stat label="To Be Invoiced" value={selected.toInvoiced} />
            <Stat label="To Be Billed" value={selected.toBilled} />
          </div>

          {/* ── Description ── */}
          <SectionBar title="Description" />
          <div className="px-6 py-5">
            <div className="text-xs text-gray-500">Notes</div>
            <div className="text-sm text-gray-800 mt-1">{selected.note === "No Notes" ? "" : selected.note}</div>
          </div>
        </section>
      ) : null}

      {/* ════════ MODALS ════════ */}
      {modal === "stock" && selected && <UpdateStockModal onClose={() => setModal(null)} product={selected} />}
      {modal === "variation" && selected && <ProductForm mode="variation" product={selected} title={selected.name} asModal onClose={() => setModal(null)} />}
      {modal === "settings" && <AppSettingsModal initialTab="Product" onClose={() => setModal(null)} />}
      {(selAction === "merge" || selAction === "mergeConfirm") && (
        <MergeProductsModal
          items={checkedItems}
          onClose={() => { setSelAction(null); setMergeTargetId(null); }}
          onMerge={(id) => { setMergeTargetId(id); setSelAction("mergeConfirm"); }}
        />
      )}
      {selAction === "mergeConfirm" && mergeTargetId != null && (
        <ConfirmAlert
          message="Are you sure want to merge these products?"
          onNo={() => setSelAction("merge")}
          onYes={() => void bulkMerge(mergeTargetId)}
        />
      )}
    </div>
  );
};

export default Product;
