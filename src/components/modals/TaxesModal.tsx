/**
 * File: src/components/modals/TaxesModal.tsx
 * Taxes drawer — matches references/companies/tax/*.png (Moon Invoice) in
 * the Qayd blue theme. Wired to the shared Dexie `taxes` collection so taxes
 * created here appear everywhere taxes are used, and persist across reloads.
 * Includes: edit mode (multi-select + archive/delete), FAB menu with
 * New Tax / New Tax Group panels, Active/Inactive filter.
 */

import React, { useMemo, useState } from "react";
import { X, Plus, ChevronDown, Pencil, Trash2, Archive, Check } from "lucide-react";
import { useCollection, repo } from "@/lib/db";
import { showToast } from "../../utils/toast";

interface TaxRow {
  id: number;
  name: string;
  rate: number;
  status?: "Active" | "Inactive";
  defaultService?: boolean;
  defaultProduct?: boolean;
  group?: boolean;
  components?: { name: string; rate: number; base: string }[];
}

export const TaxesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const taxes = (useCollection("taxes") as TaxRow[] | undefined) || [];
  const [sortBy, setSortBy] = useState("Name");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [fabMenu, setFabMenu] = useState(false);
  const [panel, setPanel] = useState<"tax" | "group" | null>(null);
  const [editTax, setEditTax] = useState<TaxRow | null>(null);

  // new tax draft
  const [draft, setDraft] = useState({ name: "", rate: "", defaultService: false, defaultProduct: false });
  // group draft
  const [groupName, setGroupName] = useState("");
  const [groupSel, setGroupSel] = useState<Record<number, { checked: boolean; base: string }>>({});
  const [groupDefaults, setGroupDefaults] = useState({ service: false, product: false });

  const statusOf = (t: TaxRow) => t.status || "Active";
  const filtered = useMemo(() => {
    const rows = taxes.filter((t) => statusFilter === "All" || statusOf(t) === statusFilter);
    rows.sort((a, b) => (sortBy === "Rate" ? a.rate - b.rate : String(a.name).localeCompare(String(b.name))));
    return rows;
  }, [taxes, statusFilter, sortBy]);

  const toggleSelect = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const openNewTax = () => {
    setDraft({ name: "", rate: "", defaultService: false, defaultProduct: false });
    setEditTax(null);
    setPanel("tax");
    setFabMenu(false);
  };
  const openNewGroup = () => {
    setGroupName("");
    setGroupSel({});
    setGroupDefaults({ service: false, product: false });
    setPanel("group");
    setFabMenu(false);
  };

  const saveTax = async () => {
    if (!draft.name.trim() || !(Number(draft.rate) >= 0) || draft.rate === "") {
      showToast("Enter a tax name and rate", "error");
      return;
    }
    if (editTax) {
      await repo.update("taxes", editTax.id, {
        name: draft.name.trim(),
        rate: Number(draft.rate),
        defaultService: draft.defaultService,
        defaultProduct: draft.defaultProduct,
      });
      showToast("Tax updated", "success");
    } else {
      await repo.add("taxes", {
        name: draft.name.trim(),
        rate: Number(draft.rate),
        status: "Active",
        defaultService: draft.defaultService,
        defaultProduct: draft.defaultProduct,
      });
      showToast("Tax created", "success");
    }
    setPanel(null);
  };

  const saveGroup = async () => {
    const parts = taxes.filter((t) => groupSel[t.id]?.checked && !t.group);
    if (!groupName.trim() || parts.length === 0) {
      showToast("Enter a group name and select at least one tax", "error");
      return;
    }
    const rate = parts.reduce((s, t) => s + t.rate, 0);
    await repo.add("taxes", {
      name: groupName.trim(),
      rate,
      status: "Active",
      group: true,
      components: parts.map((t) => ({ name: t.name, rate: t.rate, base: groupSel[t.id]?.base || "Net Amount" })),
      defaultService: groupDefaults.service,
      defaultProduct: groupDefaults.product,
    });
    showToast("Tax group created", "success");
    setPanel(null);
  };

  const archiveSelected = async () => {
    for (const id of selected) await repo.update("taxes", id, { status: "Inactive" });
    showToast(`${selected.length} tax(es) archived`, "success");
    setSelected([]);
    setEditMode(false);
  };
  const deleteSelected = async () => {
    await repo.removeMany("taxes", selected);
    showToast(`${selected.length} tax(es) deleted`, "success");
    setSelected([]);
    setEditMode(false);
  };

  /* ── sub-panels ── */

  if (panel === "tax") {
    return (
      <Overlay>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{editTax ? "Edit Tax" : "New Tax"}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(null)} className="text-sm text-gray-600 hover:text-gray-900 px-2">Cancel</button>
            <button onClick={saveTax} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-blue-600 mb-1">Name</label>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Enter tax name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-600 text-white text-sm rounded flex items-center justify-center shrink-0">%</span>
            <input
              type="number"
              min={0}
              value={draft.rate}
              onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
              placeholder="0"
              className="w-28 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <div className="bg-gray-50 border-y border-gray-100 -mx-6 px-6 py-2.5 text-sm font-semibold text-gray-900 mb-3">Default Tax</div>
            <div className="flex items-center gap-8">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={draft.defaultService} onChange={(e) => setDraft({ ...draft, defaultService: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                Service
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={draft.defaultProduct} onChange={(e) => setDraft({ ...draft, defaultProduct: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                Product
              </label>
            </div>
          </div>
        </div>
      </Overlay>
    );
  }

  if (panel === "group") {
    const singles = taxes.filter((t) => !t.group && statusOf(t) === "Active");
    return (
      <Overlay>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New Tax Group</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(null)} className="text-sm text-gray-600 hover:text-gray-900 px-2">Cancel</button>
            <button onClick={saveGroup} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            <input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group Name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div className="bg-gray-50 border-y border-gray-100 px-6 py-2.5 grid grid-cols-[1fr_auto_60px] gap-4 text-sm font-semibold text-gray-900">
            <span>Tax</span>
            <span>Base Amount</span>
            <span className="text-right">Rate</span>
          </div>
          <div className="divide-y divide-gray-100">
            {singles.map((t) => (
              <div key={t.id} className="px-6 py-3.5 grid grid-cols-[1fr_auto_60px] gap-4 items-center">
                <label className="flex items-center gap-2.5 text-sm text-gray-900 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={groupSel[t.id]?.checked || false}
                    onChange={(e) => setGroupSel({ ...groupSel, [t.id]: { checked: e.target.checked, base: groupSel[t.id]?.base || "Net Amount" } })}
                    className="w-4 h-4 accent-blue-600 shrink-0"
                  />
                  <span className="truncate">{t.name}</span>
                </label>
                <select
                  value={groupSel[t.id]?.base || "Net Amount"}
                  onChange={(e) => setGroupSel({ ...groupSel, [t.id]: { checked: groupSel[t.id]?.checked || false, base: e.target.value } })}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white"
                >
                  <option>Net Amount</option>
                  <option>Gross Amount</option>
                </select>
                <span className="text-sm text-gray-700 text-right">{t.rate}%</span>
              </div>
            ))}
            {singles.length === 0 && <div className="px-6 py-8 text-center text-sm text-gray-400">No active taxes to group.</div>}
          </div>
          <div className="bg-gray-50 border-y border-gray-100 px-6 py-2.5 text-sm font-semibold text-gray-900">Default Tax</div>
          <div className="px-6 py-4 flex items-center gap-8">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={groupDefaults.service} onChange={(e) => setGroupDefaults({ ...groupDefaults, service: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              Service
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={groupDefaults.product} onChange={(e) => setGroupDefaults({ ...groupDefaults, product: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              Product
            </label>
          </div>
        </div>
      </Overlay>
    );
  }

  /* ── main list ── */

  return (
    <Overlay>
      {/* header */}
      <div className="relative flex items-center justify-center px-5 py-4 border-b border-gray-200 shrink-0">
        {editMode ? (
          <>
            <label className="absolute left-4 flex items-center">
              <input
                type="checkbox"
                checked={selected.length === filtered.length && filtered.length > 0}
                onChange={(e) => setSelected(e.target.checked ? filtered.map((t) => t.id) : [])}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
            <h2 className="text-base font-semibold text-gray-900">Taxes</h2>
            <div className="absolute right-4 flex items-center gap-1">
              <button onClick={archiveSelected} disabled={selected.length === 0} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 disabled:opacity-40" title="Archive selected">
                <Archive className="w-5 h-5" />
              </button>
              <button onClick={deleteSelected} disabled={selected.length === 0} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 disabled:opacity-40" title="Delete selected">
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setSelected([]);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-700"
                title="Done"
              >
                <Check className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={onClose} className="absolute left-4 p-1.5 hover:bg-gray-100 rounded-md text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">Taxes</h2>
            <button onClick={() => setEditMode(true)} className="absolute right-4 p-1.5 hover:bg-gray-100 rounded-md text-gray-500" title="Edit taxes">
              <Pencil className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* filter chips */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="relative">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none text-sm text-gray-700 border border-gray-300 rounded-full pl-16 pr-7 py-1.5 bg-white cursor-pointer">
            <option>Name</option>
            <option>Rate</option>
          </select>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">Sort by |</span>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none text-sm text-gray-700 border border-gray-300 rounded-full pl-3 pr-7 py-1.5 bg-white cursor-pointer">
            <option>Active</option>
            <option>Inactive</option>
            <option>All</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* rows */}
      <div className="flex-1 overflow-y-auto relative min-h-[300px]">
        <div className="divide-y divide-gray-100">
          {filtered.map((tax) => (
            <div
              key={tax.id}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                if (editMode) toggleSelect(tax.id);
                else {
                  setEditTax(tax);
                  setDraft({ name: tax.name, rate: String(tax.rate), defaultService: !!tax.defaultService, defaultProduct: !!tax.defaultProduct });
                  setPanel("tax");
                }
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {editMode && (
                  <input type="checkbox" checked={selected.includes(tax.id)} readOnly className="w-4 h-4 accent-blue-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{tax.name}</p>
                  {tax.group && <p className="text-xs text-gray-400">Tax group · {tax.components?.map((c) => c.name).join(", ")}</p>}
                </div>
              </div>
              <span className="text-sm text-gray-700 shrink-0">{tax.rate}%</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-5 py-12 text-center text-sm text-gray-400">No taxes found.</div>}
        </div>

        {/* FAB + menu */}
        {!editMode && (
          <div className="absolute bottom-4 right-4 flex flex-col items-end">
            {fabMenu && (
              <div className="mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <button onClick={openNewTax} className="block w-40 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">New Tax</button>
                <button onClick={openNewGroup} className="block w-40 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100">New Tax Group</button>
              </div>
            )}
            <button
              onClick={() => setFabMenu(!fabMenu)}
              className="w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
              title="Add tax"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="px-5 py-3 border-t border-gray-100 text-center shrink-0">
        <span className="text-sm text-gray-400">{filtered.length === 0 ? "No Records" : `${filtered.length} Tax${filtered.length > 1 ? "es" : ""}`}</span>
      </div>
    </Overlay>
  );
};

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh", minHeight: "480px" }}>
        {children}
      </div>
    </div>
  );
}
