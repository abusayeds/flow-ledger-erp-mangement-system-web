/**
 * File: src/lib/db/format.ts
 * Tiny money/number helpers shared by pages wired to the datastore.
 */

export const money = (n: number | undefined | null): string =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const parseMoney = (s: string | number | undefined | null): number =>
  typeof s === "number" ? s : parseFloat(String(s ?? "").replace(/[^0-9.-]/g, "")) || 0;

/** Sum a numeric field across rows. */
export const sumBy = <T,>(rows: T[], pick: (r: T) => number): number =>
  rows.reduce((s, r) => s + (pick(r) || 0), 0);

/** Compute line-item totals for a document's `items` array. */
export function computeTotals(items: { qty?: number; rate?: number; amount?: number; taxId?: number }[], taxRate = 0) {
  const subTotal = items.reduce((s, it) => s + (it.amount ?? (it.qty || 0) * (it.rate || 0)), 0);
  const tax = +(subTotal * (taxRate / 100)).toFixed(2);
  const total = +(subTotal + tax).toFixed(2);
  return { subTotal: +subTotal.toFixed(2), tax, total };
}
