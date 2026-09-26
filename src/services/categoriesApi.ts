/**
 * Settings Categories — product categories (`/category`) +
 * account expense categories (`/account/expense-categories`).
 */
import { api } from "@/lib/api/client";
import { fetchPaginatedList } from "./paginatedList";

export const PARENT_CATEGORY_OPTIONS = [
  "No Parent Category",
  "Fees",
  "Marketing",
  "Meals and Entertainment",
  "Advertising and Promotion",
  "Depreciation",
  "Supplies",
  "Interest",
  "Taxes",
  "Travel",
  "Insurance",
  "Utilities",
  "Training",
  "Maintenance",
  "Wages",
] as const;

export type CategoryKind = "product" | "expense";

export type SettingsCategory = {
  id: string;
  kind: CategoryKind;
  name: string;
  /** Product categories only */
  parentCategory?: string;
  type?: string;
  /** Expense categories only */
  code?: string;
  description?: string;
  isActive?: boolean;
};

export type ProductCategoryPayload = {
  category: string;
  parentCategory?: string;
  type?: string;
};

export type ExpenseCategoryPayload = {
  category_name: string;
  category_code: string;
  description?: string;
  is_active?: boolean;
  gl_account_id?: string;
};

const text = (v: unknown) =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";

export function codeFromCategoryName(name: string): string {
  const raw = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (raw || "CAT").slice(0, 24);
}

function mapProduct(doc: any): SettingsCategory {
  return {
    id: String(doc._id ?? doc.id),
    kind: "product",
    name: text(doc.category) || text(doc.name) || "—",
    parentCategory: text(doc.parentCategory) || "No Parent Category",
    type: text(doc.type) || undefined,
  };
}

function mapExpense(doc: any): SettingsCategory {
  return {
    id: String(doc._id ?? doc.id),
    kind: "expense",
    name: text(doc.category_name) || text(doc.name) || "—",
    code: text(doc.category_code),
    description: text(doc.description),
    isActive: doc.is_active !== false,
  };
}

/** Product / item categories (used by Products module). */
export async function fetchProductCategories(searchTerm?: string): Promise<SettingsCategory[]> {
  const data = await api.get<any[]>("/category/all", {
    params: searchTerm?.trim() ? { searchTerm: searchTerm.trim() } : undefined,
  });
  return Array.isArray(data) ? data.map(mapProduct) : [];
}

/** AsyncSearchSelect helper — backend searchTerm on `/category/all`. */
export async function searchProductCategories(query: string): Promise<{ id: string; name: string }[]> {
  const rows = await fetchProductCategories(query);
  return rows.map((c) => ({ id: c.id, name: c.name }));
}

export async function fetchProductCategory(id: string): Promise<SettingsCategory | null> {
  const data = await api.get<any>(`/category/${id}`);
  if (!data || typeof data !== "object") return null;
  return mapProduct(data);
}

export async function createProductCategory(payload: ProductCategoryPayload): Promise<void> {
  await api.post("/category/create", payload);
}

export async function updateProductCategory(
  id: string,
  payload: Partial<ProductCategoryPayload>,
): Promise<void> {
  await api.patch(`/category/${id}`, payload);
}

export async function deleteProductCategory(id: string): Promise<void> {
  await api.delete(`/category/${id}`);
}

/** Accounting expense categories. */
export async function fetchExpenseCategories(): Promise<SettingsCategory[]> {
  const { rows } = await fetchPaginatedList<any>("/account/expense-categories/all", {
    page: 1,
    limit: 500,
    sort: "-createdAt",
  });
  return rows.map(mapExpense);
}

export async function createExpenseCategory(payload: ExpenseCategoryPayload): Promise<void> {
  await api.post("/account/expense-categories/create", payload);
}

export async function updateExpenseCategory(
  id: string,
  payload: Partial<ExpenseCategoryPayload>,
): Promise<void> {
  await api.patch(`/account/expense-categories/edit/${id}`, payload);
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await api.delete(`/account/expense-categories/delete/${id}`);
}

export async function fetchAllSettingsCategories(): Promise<SettingsCategory[]> {
  const [products, expenses] = await Promise.all([
    fetchProductCategories(),
    fetchExpenseCategories().catch(() => [] as SettingsCategory[]),
  ]);
  return [...products, ...expenses];
}
