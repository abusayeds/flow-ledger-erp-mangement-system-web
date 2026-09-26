/**
 * File: src/components/ui/RecentActivities.tsx
 * Live "Recent Activities" feed — composed from the datastore, so every
 * record added / edited anywhere in the app shows up here instantly.
 *
 * Scope: pass `customerId` (Customers page) or `vendorId` (Vendors page) to
 * limit the feed to one party; pass neither for the global Dashboard feed.
 *
 * Blue entity references (#16, customer / vendor / company names, bill #)
 * are clickable and open that record: they navigate to the owning page with
 * `state.selectedId`, which the pages read to select the row.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, MoreHorizontal } from "lucide-react";
import { useCollection } from "@/lib/db";

const EMAIL = "info@inovoic.com";

type Kind = "Created" | "Updated";
interface Part { text: string; to?: string; id?: number }
interface Item { key: string; kind: Kind; ts: number; parts: Part[] }

/** Best-known event time: createdAt/updatedAt (repo-written) → seed ts → 0. */
const when = (r: any, updated = false): number => {
  const iso = updated ? r.updatedAt : r.createdAt;
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isNaN(t)) return t;
  return r.ts || (r.date ? Date.parse(r.date) || 0 : 0);
};

const dateLabel = (ts: number): string => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? "Today " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const RecentActivities: React.FC<{
  customerId?: number;
  vendorId?: number;
  filter?: string;
  /** initial number of rows (More Activity reveals more) */
  limit?: number;
}> = ({ customerId, vendorId, filter = "All", limit = 7 }) => {
  const navigate = useNavigate();
  const customers = useCollection<any>("customers");
  const vendors = useCollection<any>("vendors");
  const invoices = useCollection<any>("invoices");
  const paymentsReceived = useCollection<any>("paymentsReceived");
  const bills = useCollection<any>("bills");
  const paymentsMade = useCollection<any>("paymentsMade");
  const [shown, setShown] = useState(limit);

  const global = customerId == null && vendorId == null;

  const items = useMemo(() => {
    const out: Item[] = [];

    if (global || customerId != null) {
      invoices
        .filter((i) => global || i.customerId === customerId)
        .forEach((i) => out.push({
          key: `inv-${i.id}`, kind: "Created", ts: when(i),
          parts: [{ text: "New Invoice " }, { text: i.number || `#${i.id}`, to: "/sales/sales-invoice", id: i.id }, { text: " created." }],
        }));
      paymentsReceived
        .filter((p) => global || p.customerId === customerId)
        .forEach((p) => out.push({
          key: `payr-${p.id}`, kind: "Created", ts: when(p),
          parts: [{ text: "Payment " }, { text: p.number || `#${p.id}`, to: "/sales/payment-received", id: p.id }, { text: " received." }],
        }));
      customers
        .filter((c) => global || c.id === customerId)
        .forEach((c) => {
          const created = when(c);
          if (created) out.push({
            key: `cus-${c.id}`, kind: "Created", ts: created,
            parts: [{ text: "New Customer " }, { text: c.name, to: "/sales/customers", id: c.id }, { text: " created." }],
          });
          const upd = c.updatedAt && c.updatedAt !== c.createdAt ? when(c, true) : 0;
          if (upd) out.push({
            key: `cusu-${c.id}`, kind: "Updated", ts: upd,
            parts: [{ text: "Customer " }, { text: c.name, to: "/sales/customers", id: c.id }, { text: " updated." }],
          });
        });
    }

    if (global || vendorId != null) {
      bills
        .filter((b) => global || b.vendorId === vendorId)
        .forEach((b) => out.push({
          key: `bill-${b.id}`, kind: "Created", ts: when(b),
          parts: [{ text: "New Bill " }, { text: b.number || `#${b.id}`, to: "/purchase/bills", id: b.id }, { text: " created." }],
        }));
      paymentsMade
        .filter((p) => global || p.vendorId === vendorId)
        .forEach((p) => out.push({
          key: `paym-${p.id}`, kind: "Created", ts: when(p),
          parts: [{ text: "Payment " }, { text: p.number || `#${p.id}`, to: "/purchase/payment-made", id: p.id }, { text: " made." }],
        }));
      vendors
        .filter((v) => global || v.id === vendorId)
        .forEach((v) => {
          const created = when(v);
          if (created) out.push({
            key: `ven-${v.id}`, kind: "Created", ts: created,
            parts: [{ text: "New Vendor " }, { text: v.name, to: "/purchase/vendors", id: v.id }, { text: " created." }],
          });
          const upd = v.updatedAt && v.updatedAt !== v.createdAt ? when(v, true) : 0;
          if (upd) out.push({
            key: `venu-${v.id}`, kind: "Updated", ts: upd,
            parts: [{ text: "Vendor " }, { text: v.name, to: "/purchase/vendors", id: v.id }, { text: " updated." }],
          });
        });
    }

    const wantKind = filter === "All" ? null : filter === "Created" || filter === "Updated" ? filter : "∅";
    return out
      .filter((it) => !wantKind || it.kind === wantKind)
      .sort((a, b) => b.ts - a.ts);
  }, [global, customerId, vendorId, filter, customers, vendors, invoices, paymentsReceived, bills, paymentsMade]);

  const open = (p: Part) => {
    if (!p.to || p.id == null) return;
    navigate(p.to, { state: { selectedId: p.id } });
  };

  const visible = items.slice(0, shown);

  return (
    <div className="space-y-4">
      {visible.length === 0 && <div className="text-sm text-gray-400 py-2">No activities</div>}
      {visible.map((a) => (
        <div key={a.key} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
            {a.kind === "Updated" ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm text-gray-800 leading-snug">
              {a.parts.map((p, i) =>
                p.to ? (
                  <span key={i} onClick={() => open(p)} className="text-blue-500 hover:text-blue-600 hover:underline cursor-pointer">{p.text}</span>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </h4>
            <h5 className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
              <span>{dateLabel(a.ts)}</span>
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              <span>{EMAIL}</span>
            </h5>
          </div>
        </div>
      ))}
      {items.length > shown && (
        <div className="flex items-center gap-3 pt-1">
          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0">
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <button onClick={() => setShown((s) => s + 10)} className="text-sm font-medium text-blue-500 hover:text-blue-600">
            More Activity
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentActivities;
