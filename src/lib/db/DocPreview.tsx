/**
 * File: src/lib/db/DocPreview.tsx
 * Shared white printable document preview that renders REAL data from a stored
 * document (invoice / estimate / proforma / receipt / credit note / challan /
 * bill / PO / purchase invoice / return / debit note / payment). Pages pass the
 * raw record + resolved party name + labels; this draws the live header, meta
 * table, line items and totals.
 */

import React, { useEffect } from "react";
import { Download, Printer, Mail, X } from "lucide-react";
import { money } from "./format";
import { downloadDocPdf } from "./pdf";

const TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };

export interface DocPreviewProps {
  onClose: () => void;
  headerTitle: string;        // dark bar title
  docTitle: string;           // big centered, e.g. "INVOICE"
  partyLabel?: string;        // "Customer:" / "Vendor:" / "Received From:"
  partyName: string;
  party?: any;                // full party record → email/phone/contact lines
  number: string;
  date: string;
  due?: string;
  items?: { name: string; qty?: number; rate?: number; taxId?: number; amount?: number }[];
  subTotal?: number;
  tax?: number;
  total?: number;
  amountDue?: number;
  showAmountDue?: boolean;
  terms?: string;
  notes?: string;
  reason?: string;
  /** for money records (payments): show a big amount instead of items */
  paymentAmount?: number;
  method?: string;
}

export const DocPreview: React.FC<DocPreviewProps> = (p) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [p]);

  const items = p.items || [];
  const isPayment = p.paymentAmount != null;
  const meta: [string, string][] = isPayment
    ? [["Payment #", p.number.replace("#", "")], ["Payment date", p.date], ["Payment Type", p.method || "Cash"], ["Amount", money(p.paymentAmount)]]
    : [
        [p.docTitle.includes("PAYMENT") ? "Payment #" : "Number", p.number.replace("#", "")],
        ["Date", p.date],
        ...(p.due ? ([["Due Date", p.due]] as [string, string][]) : []),
        [p.showAmountDue ? "Amount Due" : "Total", money(p.showAmountDue ? p.amountDue : p.total)],
      ];

  const download = () => downloadDocPdf({
    filename: p.headerTitle,
    docTitle: p.docTitle,
    partyLabel: p.partyLabel,
    partyLines: [p.partyName, p.party?.contact, p.party?.email, p.party?.phone].filter(Boolean) as string[],
    meta,
    ...(isPayment
      ? { bigAmount: { label: `Amount ${p.docTitle.includes("MADE") ? "Paid" : "Received"}`, value: money(p.paymentAmount) } }
      : {
          itemHead: ["Sr. No.", "Items", "Quantity", "Rate", "Tax", "Amount"],
          itemRows: items.map((it, i) => [i + 1, it.name, it.qty ?? 1, money(it.rate), TAX_NAME[it.taxId || 1], money(it.amount ?? (it.qty || 0) * (it.rate || 0))]),
          totals: [["Sub Total", money(p.subTotal)], ...(p.tax ? [["Tax", money(p.tax)]] : []), ["Total", money(p.total)], ...(p.showAmountDue ? [["Amount Due", money(p.amountDue)]] : [])] as [string, string][],
        }),
    note: p.reason != null ? { label: "Reason for Return", value: p.reason || "" } : p.terms != null ? { label: "Terms & Conditions", value: p.terms || "" } : p.notes != null ? { label: "Notes", value: p.notes || "" } : undefined,
  });

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={p.onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
          <h3 className="text-base font-medium">{p.headerTitle}</h3>
          <div className="flex items-center gap-1">
            {[Download, Printer, Mail].map((Ic, i) => (
              <button key={i} onClick={i === 0 ? download : undefined} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><Ic className="w-4 h-4" /></button>
            ))}
            <button onClick={p.onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div style={{ background: "#fff", color: "#111" }} className="p-6">
          <div className="text-right text-sm italic text-gray-500">(Original)</div>
          <div className="border border-gray-300">
            <h1 className="text-center text-2xl font-bold py-3 border-b border-gray-300">{p.docTitle}</h1>
            <div className="flex justify-between gap-6 p-4">
              <div>
                <div className="font-bold text-lg">info</div>
                <div className="text-sm text-gray-700">Bangladesh</div>
                <div className="text-sm text-gray-700">info@inovoic.com</div>
                <div className="font-bold text-sm mt-2">{p.partyLabel || "To:"}</div>
                <div className="text-sm font-semibold">{p.partyName || "—"}</div>
                {p.party?.contact && <div className="text-sm text-gray-700">{p.party.contact}</div>}
                {p.party?.email && <div className="text-sm text-gray-700">{p.party.email}</div>}
                {p.party?.phone && <div className="text-sm text-gray-700">{p.party.phone}</div>}
              </div>
              <table className="text-sm border-collapse">
                <tbody>
                  {meta.map(([k, v]) => (
                    <tr key={k}><td className="border border-gray-300 px-3 py-1.5 font-semibold text-right">{k}</td><td className="border border-gray-300 px-3 py-1.5">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isPayment ? (
              <div className="px-4 py-8 border-t border-gray-300 text-center">
                <div className="text-sm text-gray-600">Amount {p.docTitle.includes("MADE") ? "Paid" : "Received"}</div>
                <div className="text-3xl font-bold mt-1">{money(p.paymentAmount)}</div>
              </div>
            ) : (
              <>
                <table className="w-full text-xs border-t border-gray-300">
                  <thead>
                    <tr>{["Sr. No.", "Items", "Quantity", "Rate", "Tax", "Amount"].map((h) => <th key={h} className="border border-gray-300 px-2 py-1.5 text-left font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={6} className="border border-gray-300 px-2 py-6 text-center text-gray-400">No items</td></tr>
                    ) : items.map((it, i) => (
                      <tr key={i}>
                        <td className="border border-gray-300 px-2 py-1.5">{i + 1}</td>
                        <td className="border border-gray-300 px-2 py-1.5">{it.name}</td>
                        <td className="border border-gray-300 px-2 py-1.5">{it.qty ?? 1}</td>
                        <td className="border border-gray-300 px-2 py-1.5">{money(it.rate)}</td>
                        <td className="border border-gray-300 px-2 py-1.5">{TAX_NAME[it.taxId || 1]}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right">{money(it.amount ?? (it.qty || 0) * (it.rate || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end px-4 py-3 text-sm">
                  <table className="text-right">
                    <tbody>
                      <tr><td className="px-3 py-1 font-bold">Sub Total</td><td className="px-3 py-1">{money(p.subTotal)}</td></tr>
                      {p.tax ? <tr><td className="px-3 py-1 font-bold">Tax</td><td className="px-3 py-1">{money(p.tax)}</td></tr> : null}
                      <tr className="border-t border-gray-300"><td className="px-3 py-1 font-bold">Total</td><td className="px-3 py-1 font-bold">{money(p.total)}</td></tr>
                      {p.showAmountDue ? <tr className="border-t border-gray-300"><td className="px-3 py-1 font-bold">Amount Due</td><td className="px-3 py-1 font-bold">{money(p.amountDue)}</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {(p.reason || p.terms || p.notes) && (
              <div className="px-4 py-3 border-t border-gray-300 text-sm">
                <div className="font-bold">{p.reason != null ? "Reason for Return" : p.terms != null ? "Terms & Conditions" : "Notes"}</div>
                <div className="text-gray-700">{p.reason || p.terms || p.notes || "—"}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocPreview;
