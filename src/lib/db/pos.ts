/**
 * File: src/lib/db/pos.ts
 * POS module data — completed sales persisted in the Dexie `meta` table
 * (key `pos:orders`), same liveQuery store pattern as lib/db/goal.ts.
 * Products/prices come from the shared Dexie `products` collection
 * (Items > Products), per the reference instruction. GST is 18%.
 */

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/tokenStore";
import { toArray } from "@/services/_http";

/* ── types ─────────────────────────────────────────────────────── */

export interface PosItem {
  /** Backend product Mongo _id (or legacy seed id as string). */
  productId: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
  taxRate: number; // percent
  image?: string | null;
}

export interface PosOrder {
  id: string;
  number: string; // #POS00040
  date: string; // yyyy-mm-dd
  customer: string;
  customerId?: string;
  warehouse: string;
  warehouseId?: string;
  bankAccount: string;
  bankAccountId?: string;
  items: PosItem[];
  discount: number;
  status: "Completed";
  createdAt: number;
}

/* ── store ─────────────────────────────────────────────────────── */

const KEY = "pos:orders";

/* ── backend mapping (source of truth once authenticated) ──────────── */

const ymd = (v: unknown): string => {
  if (!v) return new Date().toISOString().slice(0, 10);
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

/** Backend POS order → the UI PosOrder shape. `id` carries the Mongo _id. */
export const mapPosOrder = (d: any): PosOrder => ({
  id: String(d._id ?? d.id ?? ""),
  number: String(d.order_number ?? ""),
  date: ymd(d.date ?? d.createdAt),
  customer: String(d.customer_name ?? "Walk-in Customer"),
  customerId: d.customer_id ? String(d.customer_id) : undefined,
  warehouse: String(d.warehouse ?? ""),
  warehouseId: d.warehouse_id ? String(d.warehouse_id) : undefined,
  bankAccount: String(d.bank_account ?? ""),
  bankAccountId: d.bank_account_id ? String(d.bank_account_id) : undefined,
  items: (d.items ?? []).map((i: any) => ({
    productId: String(i.product_id ?? i.product_id_num ?? ""),
    name: String(i.name ?? ""),
    sku: String(i.sku ?? ""),
    qty: Number(i.quantity) || 0,
    price: Number(i.price) || 0,
    taxRate: Number(i.tax_rate) || 0,
  })),
  discount: Number(d.discount) || 0,
  status: "Completed",
  createdAt: new Date(d.createdAt ?? d.date ?? Date.now()).getTime(),
});

const mongoId = (v?: string) => (v && /^[a-f0-9]{24}$/i.test(v) ? v : undefined);

/** UI PosOrder → backend create body. */
export const reversePosOrder = (o: PosOrder) => ({
  order_number: o.number,
  customer_name: o.customer,
  ...(mongoId(o.customerId) ? { customer_id: mongoId(o.customerId) } : {}),
  warehouse: o.warehouse,
  ...(mongoId(o.warehouseId) ? { warehouse_id: mongoId(o.warehouseId) } : {}),
  bank_account: o.bankAccount,
  ...(mongoId(o.bankAccountId) ? { bank_account_id: mongoId(o.bankAccountId) } : {}),
  discount: o.discount || 0,
  date: new Date(o.date + "T00:00:00").toISOString(),
  items: o.items.map((i) => ({
    ...(mongoId(i.productId) ? { product_id: i.productId } : {}),
    name: i.name,
    sku: i.sku,
    quantity: i.qty,
    price: i.price,
    tax_rate: i.taxRate,
  })),
});

export const posOrderStore = {
  save: async (orders: PosOrder[]) => {
    await db.meta.put({ key: KEY, value: orders });
  },
  use: (): PosOrder[] | null | undefined =>
    useLiveQuery(async () => {
      const row = await db.meta.get(KEY);
      return row === undefined ? null : (row.value as PosOrder[]);
    }, []),
  /** Pull orders from the backend into the local cache (called on login). */
  hydrate: async () => {
    if (!getToken()) return;
    try {
      const rows: PosOrder[] = [];
      let page = 1;
      for (;;) {
        const res = await api.raw.get("/pos/order/all", { params: { page, limit: 500 } });
        const body = res.data ?? {};
        const batch = Array.isArray(body.data) ? body.data : toArray<any>(body);
        rows.push(...batch.map(mapPosOrder));
        const totalPage = Number(body.pagination?.totalPage) || 1;
        if (batch.length === 0 || page >= totalPage) break;
        page += 1;
      }
      await db.meta.put({ key: KEY, value: rows });
    } catch {
      /* keep whatever is cached locally */
    }
  },
  /** Persist a completed sale — backend when authed, else local-only. */
  create: async (order: PosOrder) => {
    if (getToken()) {
      try {
        await api.raw.post("/pos/order/create", reversePosOrder(order));
        await posOrderStore.hydrate();
        return;
      } catch {
        /* fall through to local cache so the sale isn't lost */
      }
    }
    const row = await db.meta.get(KEY);
    const cur = (row?.value as PosOrder[]) || [];
    await db.meta.put({ key: KEY, value: [order, ...cur] });
  },
};

/* ── catalogs / helpers ────────────────────────────────────────── */

export const GST_RATE = 18;

export const warehouseShort = (w: string) => w.split(" - ")[0];

export const orderSubtotal = (o: Pick<PosOrder, "items">) =>
  o.items.reduce((s, i) => s + i.qty * i.price, 0);
export const orderTax = (o: Pick<PosOrder, "items">) =>
  +o.items.reduce((s, i) => s + (i.qty * i.price * i.taxRate) / 100, 0).toFixed(2);
export const orderTotal = (o: Pick<PosOrder, "items" | "discount">) =>
  +(orderSubtotal(o) + orderTax(o) - (o.discount || 0)).toFixed(2);

/** Next sale number: seeds end at #POS00039, new sales continue from there. */
export const nextPosNumber = (orders: PosOrder[]) => {
  const max = orders.reduce((m, o) => Math.max(m, parseInt(o.number.replace(/\D/g, ""), 10) || 0), 0);
  return `#POS${String(max + 1).padStart(5, "0")}`;
};

export const posUid = () => "pos" + Math.random().toString(36).slice(2, 8);

/* ── barcode helper: real Code 128 (code set B) ─────────────────── */

/** Code 128 bar/space patterns, values 0–106 (103–105 = start A/B/C,
 *  106 = stop). Each digit is a module width; entries alternate
 *  bar,space,bar,space,… starting with a bar. */
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

/** Encode text as a real, scannable Code 128-B symbol.
 *  Returns module widths alternating bar,space,bar,… (starts and ends
 *  with a bar). Renderers must lay these out back-to-back with NO
 *  extra gaps or the symbol stops being decodable. */
export function code128Modules(text: string): number[] {
  const values = [104]; // Start Code B
  for (const ch of text || "SKU") {
    const c = ch.charCodeAt(0);
    values.push(c >= 32 && c <= 126 ? c - 32 : 0); // unsupported → space
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103); // checksum symbol
  values.push(106); // stop
  const out: number[] = [];
  for (const v of values) for (const d of CODE128_PATTERNS[v]) out.push(Number(d));
  return out;
}
