/**
 * Settings → Categories — fully backend-driven.
 * Products tab → /category
 * Expenses tab → /account/expense-categories
 * All → both
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Loader2, Plus, Trash2, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import { ApiError } from "@/lib/api/ApiError";
import {
  PARENT_CATEGORY_OPTIONS,
  codeFromCategoryName,
  createExpenseCategory,
  createProductCategory,
  deleteExpenseCategory,
  deleteProductCategory,
  fetchAllSettingsCategories,
  fetchExpenseCategories,
  fetchProductCategories,
  fetchProductCategory,
  updateExpenseCategory,
  updateProductCategory,
  type CategoryKind,
  type SettingsCategory,
} from "@/services/categoriesApi";

type TabId = "all" | "product" | "expense";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All Category" },
  { id: "product", label: "Products" },
  { id: "expense", label: "Expenses" },
];

const errMsg = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? "bg-blue-600" : "bg-gray-200"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

type FormState = {
  kind: CategoryKind;
  name: string;
  parentCategory: string;
  code: string;
  description: string;
  isActive: boolean;
};

const emptyForm = (kind: CategoryKind): FormState => ({
  kind,
  name: "",
  parentCategory: "No Parent Category",
  code: "",
  description: "",
  isActive: true,
});

export const CategoriesSettingsPanel: React.FC = () => {
  const [tab, setTab] = useState<TabId>("all");
  const [rows, setRows] = useState<SettingsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm("product"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: SettingsCategory[];
      if (tab === "product") data = await fetchProductCategories();
      else if (tab === "expense") data = await fetchExpenseCategories();
      else data = await fetchAllSettingsCategories();
      setRows(data);
    } catch (err) {
      setRows([]);
      showToast(errMsg(err, "Couldn't load categories."), "error");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => r.kind === (tab === "product" ? "product" : "expense"));
  }, [rows, tab]);

  const openCreate = () => {
    const kind: CategoryKind = tab === "expense" ? "expense" : "product";
    setEditingId(null);
    setForm(emptyForm(kind));
    setMode("create");
  };

  const openEdit = async (row: SettingsCategory) => {
    setEditingId(row.id);
    if (row.kind === "product") {
      setSaving(true);
      try {
        const full = await fetchProductCategory(row.id);
        setForm({
          kind: "product",
          name: full?.name || row.name,
          parentCategory: full?.parentCategory || row.parentCategory || "No Parent Category",
          code: "",
          description: "",
          isActive: true,
        });
        setMode("edit");
      } catch (err) {
        showToast(errMsg(err, "Couldn't load category."), "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    setForm({
      kind: "expense",
      name: row.name,
      parentCategory: "No Parent Category",
      code: row.code || "",
      description: row.description || "",
      isActive: row.isActive !== false,
    });
    setMode("edit");
  };

  const closeForm = () => {
    setMode("list");
    setEditingId(null);
    setForm(emptyForm(tab === "expense" ? "expense" : "product"));
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast("Please enter a category name", "info");
      return;
    }
    setSaving(true);
    try {
      if (form.kind === "product") {
        if (mode === "edit" && editingId) {
          await updateProductCategory(editingId, {
            category: name,
            parentCategory: form.parentCategory || "No Parent Category",
          });
          showToast("Category updated!", "success");
        } else {
          await createProductCategory({
            category: name,
            parentCategory: form.parentCategory || "No Parent Category",
            type: "Products",
          });
          showToast("Category created!", "success");
        }
      } else {
        const code = (form.code.trim() || codeFromCategoryName(name)).slice(0, 24);
        const payload = {
          category_name: name,
          category_code: code,
          description: form.description.trim() || undefined,
          is_active: form.isActive,
        };
        if (mode === "edit" && editingId) {
          await updateExpenseCategory(editingId, payload);
          showToast("Expense category updated!", "success");
        } else {
          await createExpenseCategory(payload);
          showToast("Expense category created!", "success");
        }
      }
      closeForm();
      await load();
    } catch (err) {
      showToast(errMsg(err, "Couldn't save category."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SettingsCategory) => {
    if (!confirm(`Delete category "${row.name}"?`)) return;
    try {
      if (row.kind === "product") await deleteProductCategory(row.id);
      else await deleteExpenseCategory(row.id);
      showToast("Category deleted!", "success");
      if (editingId === row.id) closeForm();
      await load();
    } catch (err) {
      showToast(errMsg(err, "Couldn't delete category."), "error");
    }
  };

  if (mode === "create" || mode === "edit") {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === "edit" ? "Edit Category" : "Add Category"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {form.kind === "product" ? "Product category" : "Expense category"}
            </p>
          </div>
          <button type="button" onClick={closeForm} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="max-w-md border border-gray-200 rounded-lg p-5 bg-gray-50 space-y-4">
          {tab === "all" && mode === "create" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kind: e.target.value as CategoryKind }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="product" className="bg-white text-gray-900">
                  Products
                </option>
                <option value="expense" className="bg-white text-gray-900">
                  Expenses
                </option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  code:
                    f.kind === "expense" && (!f.code || f.code === codeFromCategoryName(f.name))
                      ? codeFromCategoryName(name)
                      : f.code,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Category name"
            />
          </div>

          {form.kind === "product" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Parent Category</label>
              <select
                value={form.parentCategory}
                onChange={(e) => setForm((f) => ({ ...f, parentCategory: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                style={{ colorScheme: "light" }}
              >
                {PARENT_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-white text-gray-900">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g. UTILITIES"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Active</span>
                <Toggle
                  checked={form.isActive}
                  onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          <p className="text-sm text-gray-500 mt-0.5">Organise products and expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 border border-gray-300 text-sm rounded-md text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            title="Add category"
            aria-label="Add category"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-md hover:bg-orange-600 transition-colors"
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMode("list");
            }}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "text-gray-900 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading categories…
        </div>
      ) : visible.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg">
          No categories yet. Use the + button above to add one.
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {visible.map((category) => (
            <div
              key={`${category.kind}-${category.id}`}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-900 truncate">{category.name}</span>
                  {tab === "all" && (
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        category.kind === "product"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {category.kind === "product" ? "Product" : "Expense"}
                    </span>
                  )}
                </div>
                {category.kind === "expense" && category.code ? (
                  <p className="text-xs text-gray-500 mt-0.5">{category.code}</p>
                ) : null}
                {category.kind === "product" &&
                category.parentCategory &&
                category.parentCategory !== "No Parent Category" ? (
                  <p className="text-xs text-gray-500 mt-0.5">Parent: {category.parentCategory}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void openEdit(category)}
                  className="p-1.5 hover:bg-gray-100 rounded"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(category)}
                  className="p-1.5 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoriesSettingsPanel;
