/**
 * File: src/pages/items/SystemSetup.tsx
 * System Setup page — Categories & Taxes management (Units commented out until
 * the backend exposes a unit endpoint).
 *
 * Categories API:
 *   GET    /category/all       -> list [{ _id, category }]
 *   GET    /category/:id       -> single
 *   POST   /category/create    -> create { category, color }
 *   PATCH  /category/:id       -> update { category, color }
 *   DELETE /category/:id       -> delete
 *
 * Taxes API:
 *   GET    /tax/all            -> list [{ _id, name, rate }]
 *   GET    /tax/:id            -> single
 *   POST   /tax/create         -> create { name, rate }
 *   PATCH  /tax/:id            -> update { name, rate }
 *   DELETE /tax/:id            -> delete
 *
 * Note: the category API does not return `color`, so the swatch shown in the list
 * is derived deterministically from the category name; `color` is still sent on
 * create/update so it persists if the backend starts storing it.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { api } from "../../lib/api/client";
import { ApiError } from "../../lib/api/ApiError";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Tag,
  Percent,
  Loader2,
  /* Ruler, */ // Units: re-enable when the unit endpoint exists
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Tax {
  id: string;
  name: string;
  rate: number;
}

/* Units: re-enable when the unit endpoint exists
interface Unit {
  id: string;
  name: string;
}
*/

interface ApiCategory {
  _id: string;
  category: string;
  color?: string;
}
interface ApiTax {
  _id: string;
  name: string;
  rate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const colorOptions = [
  "#EF4444",
  "#F59E0B",
  "#F97316",
  "#84CC16",
  "#10B981",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#A855F7",
  "#EC4899",
  "#F43F5E",
  "#78716C",
  "#64748B",
  "#1E293B",
];

/** Deterministic swatch colour from a category name (API doesn't return one). */
const colorFor = (key: string): string => {
  const sum = [...(key || "")].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return colorOptions[sum % colorOptions.length];
};

const errMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError && err.message ? err.message : fallback;

// ─── Component ────────────────────────────────────────────────────────────────

export const SystemSetup: React.FC = () => {
  const navigate = useNavigate();

  // Active tab state (units omitted for now)
  const [activeTab, setActiveTab] = useState<"categories" | "taxes">(
    "categories",
  );

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  /* const [units, setUnits] = useState<Unit[]>([]); */

  // Loading / error states
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxError, setTaxError] = useState<string | null>(null);

  // Search states
  const [categorySearch, setCategorySearch] = useState("");
  const [taxSearch, setTaxSearch] = useState("");
  /* const [unitSearch, setUnitSearch] = useState(""); */

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  /* const [showUnitModal, setShowUnitModal] = useState(false); */
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "#3B82F6" });
  const [taxForm, setTaxForm] = useState({ name: "", rate: 0 });
  /* const [unitForm, setUnitForm] = useState({ name: "" }); */

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const data = await api.get<ApiCategory[]>("/category/all");
      setCategories(
        Array.isArray(data)
          ? data.map((c) => ({
              id: c._id,
              name: c.category,
              color: c.color || colorFor(c.category),
            }))
          : [],
      );
    } catch (err) {
      const m = errMessage(err, "Couldn't load categories.");
      setCatError(m);
      showToast(m, "error");
    } finally {
      setCatLoading(false);
    }
  }, []);

  const loadTaxes = useCallback(async () => {
    setTaxLoading(true);
    setTaxError(null);
    try {
      const data = await api.get<ApiTax[]>("/tax/all");
      setTaxes(
        Array.isArray(data)
          ? data.map((t) => ({ id: t._id, name: t.name, rate: t.rate }))
          : [],
      );
    } catch (err) {
      const m = errMessage(err, "Couldn't load taxes.");
      setTaxError(m);
      showToast(m, "error");
    } finally {
      setTaxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadTaxes();
  }, [loadCategories, loadTaxes]);

  // ─── Category CRUD ──────────────────────────────────────────────────────────

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  const openCategoryModal = (category?: Category) => {
    if (category) {
      setIsEditing(true);
      setEditingId(category.id);
      setCategoryForm({ name: category.name, color: category.color });
    } else {
      setIsEditing(false);
      setEditingId(null);
      setCategoryForm({ name: "", color: "#3B82F6" });
    }
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return showToast("Please enter category name", "info");
    const payload = { category: categoryForm.name.trim(), color: categoryForm.color };
    setSaving(true);
    try {
      if (isEditing && editingId) {
        await api.patch(`/category/${editingId}`, payload);
        showToast("Category updated successfully!", "success");
      } else {
        await api.post("/category/create", payload);
        showToast("Category created successfully!", "success");
      }
      setShowCategoryModal(false);
      await loadCategories();
    } catch (err) {
      showToast(errMessage(err, "Couldn't save category."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`/category/${id}`);
      showToast("Category deleted successfully!", "success");
      await loadCategories();
    } catch (err) {
      showToast(errMessage(err, "Couldn't delete category."), "error");
    }
  };

  // ─── Tax CRUD ───────────────────────────────────────────────────────────────

  const filteredTaxes = taxes.filter((t) =>
    t.name.toLowerCase().includes(taxSearch.toLowerCase()),
  );

  const openTaxModal = (tax?: Tax) => {
    if (tax) {
      setIsEditing(true);
      setEditingId(tax.id);
      setTaxForm({ name: tax.name, rate: tax.rate });
    } else {
      setIsEditing(false);
      setEditingId(null);
      setTaxForm({ name: "", rate: 0 });
    }
    setShowTaxModal(true);
  };

  const handleSaveTax = async () => {
    if (!taxForm.name.trim()) return showToast("Please enter tax name", "info");
    if (taxForm.rate <= 0 || taxForm.rate > 100)
      return showToast("Please enter a valid tax rate (1-100)", "info");
    const payload = { name: taxForm.name.trim(), rate: taxForm.rate };
    setSaving(true);
    try {
      if (isEditing && editingId) {
        await api.patch(`/tax/${editingId}`, payload);
        showToast("Tax updated successfully!", "success");
      } else {
        await api.post("/tax/create", payload);
        showToast("Tax created successfully!", "success");
      }
      setShowTaxModal(false);
      await loadTaxes();
    } catch (err) {
      showToast(errMessage(err, "Couldn't save tax."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTax = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tax?")) return;
    try {
      await api.delete(`/tax/${id}`);
      showToast("Tax deleted successfully!", "success");
      await loadTaxes();
    } catch (err) {
      showToast(errMessage(err, "Couldn't delete tax."), "error");
    }
  };

  /* ─── Unit CRUD ─── re-enable when the unit endpoint exists ───────────────────
  const filteredUnits = units.filter((u) =>
    u.name.toLowerCase().includes(unitSearch.toLowerCase()),
  );

  const openUnitModal = (unit?: Unit) => {
    if (unit) {
      setIsEditing(true);
      setEditingId(unit.id);
      setUnitForm({ name: unit.name });
    } else {
      setIsEditing(false);
      setEditingId(null);
      setUnitForm({ name: "" });
    }
    setShowUnitModal(true);
  };

  const handleSaveUnit = () => { ... };
  const handleDeleteUnit = (id: string) => { ... };
  ─────────────────────────────────────────────────────────────────────────── */

  // ─── Render: Categories ─────────────────────────────────────────────────────

  const renderCategoriesTab = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => openCategoryModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Category
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Color</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {catLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-12">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading categories…</span>
                  </div>
                </td>
              </tr>
            ) : catError ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-sm text-red-600">
                  {catError}
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-gray-500">
                  No categories found.
                </td>
              </tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border border-gray-200"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-xs text-gray-500 uppercase">{category.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCategoryModal(category)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── Render: Taxes ──────────────────────────────────────────────────────────

  const renderTaxesTab = () => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search taxes..."
            value={taxSearch}
            onChange={(e) => setTaxSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => openTaxModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Tax
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Tax Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Rate (%)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {taxLoading ? (
              <tr>
                <td colSpan={3} className="px-4 py-12">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading taxes…</span>
                  </div>
                </td>
              </tr>
            ) : taxError ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-sm text-red-600">
                  {taxError}
                </td>
              </tr>
            ) : filteredTaxes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-gray-500">
                  No taxes found.
                </td>
              </tr>
            ) : (
              filteredTaxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{tax.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600">{tax.rate.toFixed(2)}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTaxModal(tax)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTax(tax.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ─── Render: Units ─── re-enable when the unit endpoint exists ───────────────
  const renderUnitsTab = () => ( ... );
  ─────────────────────────────────────────────────────────────────────────── */

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Breadcrumb */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">
            Dashboard
          </button>
          <span>›</span>
          <button onClick={() => navigate("/items/product")} className="hover:text-gray-700">
            Product &amp; Service
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">System Setup</span>
        </div>
      </div>

      {/* Header */}
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">System Setup</h2>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("categories")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "categories"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Category
            </div>
          </button>
          <button
            onClick={() => setActiveTab("taxes")}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "taxes"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Taxes
            </div>
          </button>
          {/* Units tab: re-enable when the unit endpoint exists
          <button onClick={() => setActiveTab("units")} ...>
            <Ruler className="w-4 h-4" /> Units
          </button>
          */}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {activeTab === "categories" && renderCategoriesTab()}
        {activeTab === "taxes" && renderTaxesTab()}
        {/* {activeTab === "units" && renderUnitsTab()} */}
      </div>

      {/* ── Category Modal ── */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Category" : "Create Category"}
              </h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Enter category name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                {/* Custom colour picker + hex input */}
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, color: e.target.value })
                    }
                    title="Pick a custom color"
                    className="w-12 h-10 p-1 border border-gray-300 rounded-md cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={categoryForm.color}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, color: e.target.value })
                    }
                    placeholder="#3B82F6"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div
                    className="w-9 h-9 rounded-full border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: categoryForm.color }}
                  />
                </div>
                {/* Quick preset swatches */}
                <div className="grid grid-cols-8 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, color })}
                      title={color}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        categoryForm.color.toLowerCase() === color.toLowerCase()
                          ? "border-gray-900 scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowCategoryModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Modal ── */}
      {showTaxModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Tax" : "Create Tax"}
              </h2>
              <button
                onClick={() => setShowTaxModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taxForm.name}
                  onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                  placeholder="Enter tax name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={taxForm.rate || ""}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, rate: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="Enter tax rate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowTaxModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTax}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit Modal: re-enable when the unit endpoint exists */}
    </div>
  );
};
