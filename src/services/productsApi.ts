/** Products list — backend pagination via /product/all */
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/env";
import { fetchPaginatedList } from "./paginatedList";
import type { TPartyPagination } from "./customerTypes";

/** Treat empty / placeholder / non-path values as "no product image". */
export function hasProductImage(value: unknown): boolean {
  const src = String(value ?? "").trim();
  if (!src) return false;
  if (/^\{\{.*\}\}$/.test(src)) return false;
  if (/^(null|undefined|n\/a|none|-)$/i.test(src)) return false;
  if (src.includes("file_path_or_url")) return false;
  return true;
}

/** Resolve stored upload path (same rules as HRM files). */
export function resolveProductImageUrl(value: unknown): string {
  if (!hasProductImage(value)) return "";
  return resolveMediaUrl(value);
}

export async function uploadProductImage(file: File): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  formData.append("files", file);
  const uploadRes = await api.raw.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = uploadRes.data?.data ?? uploadRes.data;
  const row = Array.isArray(data) ? data[0] : data;
  const path = String(row?.file_path || row?.path || "");
  if (!path) throw new Error("Upload did not return a file path");
  const url = String(row?.url || "").trim() || resolveProductImageUrl(path);
  return { path, url };
}

export type ProductListRow = {
  _id: string;
  name: string;
  category: string;
  categoryId: string;
  note: string;
  price: number;
  stock: number | null;
  sku: string;
  qty: string;
  unit: string;
  buyPrice: number;
  image: string | null;
  onHand: string;
  committed: string;
  available: string;
  toInvoiced: string;
  toBilled: string;
  currency: string;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const fixed = (v: unknown) => num(v).toFixed(2);

const categoryLabel = (doc: any): { name: string; id: string } => {
  const cat = doc?.category;
  if (cat && typeof cat === "object") {
    return {
      id: text(cat._id),
      name: text(cat.category || cat.name) || "No Category",
    };
  }
  if (typeof cat === "string" && cat) return { id: cat, name: "No Category" };
  return { id: "", name: "No Category" };
};

const mapProduct = (doc: any): ProductListRow => {
  const { name: category, id: categoryId } = categoryLabel(doc);
  const stock = doc?.stock;
  const hasStock = stock != null;
  const onHand = hasStock ? num(stock.onHandStock) : null;
  return {
    _id: String(doc._id),
    name: text(doc.productName) || "—",
    category,
    categoryId,
    note: text(doc.description) || "No Notes",
    price: num(doc?.pricing?.sellPrice ?? doc.sellPrice),
    stock: onHand,
    sku: text(doc.sku) || "—",
    qty: String(doc.quantity ?? 0),
    unit: text(doc.unitType) || "pcs",
    buyPrice: num(doc?.pricing?.buyPrice),
    image: text(doc.image) || null,
    onHand: hasStock ? fixed(stock.onHandStock) : "0.00",
    committed: hasStock ? fixed(stock.committedStock) : "0.00",
    available: hasStock ? fixed(stock.availableForSale) : "0.00",
    toInvoiced: hasStock ? fixed(stock.toBeInvoiced) : "0.00",
    toBilled: hasStock ? fixed(stock.toBeBilled) : "0.00",
    currency: text(doc?.pricing?.currency) || "USD",
  };
};

export async function fetchProducts(params: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  category?: string;
  isDeleted?: boolean;
  isArchive?: boolean;
}): Promise<{ rows: ProductListRow[]; pagination: TPartyPagination }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/product/all", {
    page: params.page,
    limit: params.limit,
    searchTerm: params.searchTerm,
    sort: params.sort,
    category: params.category || undefined,
    isDeleted: params.isDeleted ? "true" : undefined,
    isArchive: params.isArchive ? "true" : undefined,
  });
  return { rows: rows.map(mapProduct), pagination };
}

export async function deleteProduct(id: string): Promise<void> {
  await api.raw.delete(`/product/delete/${id}`);
}

export async function deleteProducts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (ids.length === 1) {
    await deleteProduct(ids[0]);
    return;
  }
  await api.raw.delete(`/product/delete/${ids.join(",")}`);
}

export async function archiveProduct(id: string): Promise<void> {
  await api.raw.patch(`/product/update/${id}`, { isArchive: true });
}

export async function archiveProducts(ids: string[]): Promise<void> {
  await Promise.all(ids.map(archiveProduct));
}

export async function unarchiveProduct(id: string): Promise<void> {
  await api.raw.patch(`/product/update/${id}`, { isArchive: false });
}

export async function restoreProduct(id: string): Promise<void> {
  await api.raw.patch(`/product/restore/${id}`);
}

export async function duplicateProduct(id: string): Promise<void> {
  const doc = await api.get<any>(`/product/single/${id}`);
  const body = {
    productName: `${doc.productName || doc.name || "Product"} (Copy)`,
    sku: doc.sku ? `${doc.sku}-COPY-${Date.now().toString(36).slice(-4)}` : undefined,
    unitType: doc.unitType,
    quantity: doc.quantity ?? 1,
    description: doc.description,
    image: doc.image,
    category: doc.category?._id || doc.category,
    tax: doc.tax?._id || doc.tax,
    pricing: doc.pricing,
    stock: doc.stock,
  };
  await api.raw.post(`/product/create`, body);
}

export async function duplicateProducts(ids: string[]): Promise<void> {
  for (const id of ids) await duplicateProduct(id);
}

export async function mergeProducts(survivorId: string, mergedIds: string[]): Promise<void> {
  await api.raw.post("/product/merge", {
    survivor_id: survivorId,
    merged_ids: mergedIds,
  });
}
