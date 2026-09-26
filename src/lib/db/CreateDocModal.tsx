/**
 * File: src/lib/db/CreateDocModal.tsx
 * Reusable "create document" modal used by the live demo doc pages
 * (Proforma, Sales Receipt, Credit Note, Delivery Challan, Purchase Order,
 * Purchase Return, Debit Note…). Picks a live customer/vendor + live
 * products/services, computes totals, and persists via the repository — so a
 * doc added here shows up in that collection's list (and anywhere it feeds).
 */

import React, { useEffect, useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { todayIso } from "@/lib/dateIso";
import { useCollection } from "./hooks";
import { repo, nextNumber } from "./repo";
import { money } from "./format";
import type { CollectionName } from "./db";

const TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };

export const CreateDocModal: React.FC<{
  collection: CollectionName;
  title: string;
  party?: "customers" | "vendors";
  partyLabel?: string;
  /** use buy prices for the catalog (purchase-side docs) */
  buy?: boolean;
  onClose: () => void;
  onSaved: (id: number) => void;
}> = ({ collection, title, party = "customers", partyLabel, buy = false, onClose, onSaved }) => {
  const parties = useCollection<any>(party, "name");
  const products = useCollection<any>("products", "name");
  const services = useCollection<any>("services", "name");
  const catalog = useMemo(
    () => [
      ...products.map((p) => ({ key: "p" + p.id, name: p.name, rate: (buy ? p.buyPrice : p.price) || 0, taxId: p.taxId || 1 })),
      ...services.map((s) => ({ key: "s" + s.id, name: s.name, rate: s.price || 0, taxId: s.taxId || 1 })),
    ],
    [products, services, buy],
  );
  const [partyId, setPartyId] = useState<number | "">("");
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<{ key: string; name: string; qty: number; rate: number; taxId: number }[]>([{ key: "", name: "", qty: 1, rate: 0, taxId: 1 }]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const addRow = () => setRows((r) => [...r, { key: "", name: "", qty: 1, rate: 0, taxId: 1 }]);
  const pick = (i: number, key: string) => setRows((r) => r.map((row, idx) => {
    if (idx !== i) return row;
    const it = catalog.find((c) => c.key === key);
    return it ? { ...row, key, name: it.name, rate: it.rate, taxId: it.taxId } : { ...row, key: "", name: "" };
  }));
  const setQty = (i: number, qty: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, qty } : row)));
  const removeRow = (i: number) => setRows((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r));

  const subTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0);
  const taxTotal = rows.reduce((s, r) => s + r.qty * r.rate * ((TAX_RATE[r.taxId] || 0) / 100), 0);
  const totalAmt = subTotal + taxTotal;

  const save = async () => {
    if (partyId === "") return;
    const n = await nextNumber(collection);
    const items = rows.filter((r) => r.name).map((r, i) => ({ id: i + 1, name: r.name, qty: r.qty, rate: r.rate, taxId: r.taxId, amount: +(r.qty * r.rate).toFixed(2) }));
    const partyKey = party === "vendors" ? "vendorId" : "customerId";
    const id = await repo.add(collection, {
      number: "#" + n, [partyKey]: partyId, date, due: date, ts: Date.now(), status: "Draft",
      items, subTotal: +subTotal.toFixed(2), tax: +taxTotal.toFixed(2), shipping: 0,
      total: +totalAmt.toFixed(2), amountPaid: 0, amountDue: +totalAmt.toFixed(2), notes,
    });
    onSaved(id);
    onClose();
  };

  const fc = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
            <button onClick={save} disabled={partyId === ""} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">Save</button>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">{partyLabel || (party === "vendors" ? "Vendor" : "Customer")} *</label>
              <select value={partyId} onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : "")} className={`mt-1 ${fc}`}>
                <option value="">Select {party === "vendors" ? "vendor" : "customer"}</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500">Date</label><AppDatePicker value={date} onValueChange={setDate} className={`mt-1 ${fc}`} /></div>
          </div>
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-gray-500 text-xs"><th className="text-left font-semibold px-3 py-2">Item</th><th className="text-right font-semibold px-2 py-2 w-20">Qty</th><th className="text-right font-semibold px-2 py-2 w-24">Rate</th><th className="text-right font-semibold px-3 py-2 w-28">Amount</th><th className="w-8" /></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-3 py-2"><select value={r.key} onChange={(e) => pick(i, e.target.value)} className="w-full bg-transparent text-sm outline-none"><option value="">Select product / service</option>{catalog.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></td>
                    <td className="px-2 py-2 text-right"><input type="number" min={0} value={r.qty} onChange={(e) => setQty(i, Number(e.target.value))} className="w-16 bg-transparent text-sm text-right outline-none" /></td>
                    <td className="px-2 py-2 text-right text-gray-700">{money(r.rate)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{money(r.qty * r.rate)}</td>
                    <td className="px-2 py-2 text-right"><button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 py-2 border-t border-gray-200"><button onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Item</button></div>
          </div>
          <div className="flex justify-between gap-5">
            <div className="flex-1"><label className="text-xs text-gray-500">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full h-20 border border-gray-200 rounded-md p-2 text-sm outline-none resize-none" /></div>
            <div className="w-56 border border-gray-200 rounded-md overflow-hidden self-start">
              <div className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-600">Sub Total</span><span className="font-semibold text-gray-900">{money(subTotal)}</span></div>
              <div className="flex justify-between px-3 py-2 text-sm border-t border-gray-200"><span className="text-gray-600">Tax</span><span className="text-gray-700">{money(taxTotal)}</span></div>
              <div className="flex justify-between px-3 py-2.5 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{money(totalAmt)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateDocModal;
