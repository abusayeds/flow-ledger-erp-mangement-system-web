/**
 * File: src/lib/db/index.ts
 * Barrel for the demo datastore. Pages import from "@/lib/db".
 *
 *   import { useCollection, useDoc, repo, money } from "@/lib/db";
 */

export { db, COLLECTIONS, type CollectionName, type Row } from "./db";
export { useCollection, useDoc, useCount, useWhere } from "./hooks";
export { repo, add, update, put, remove, removeMany, getOne, getAll, nextId, nextNumber } from "./repo";
export { money, parseMoney, sumBy, computeTotals } from "./format";
export { seedIfNeeded, resetDemo, SEED_VERSION } from "./seed";
export { CreateDocModal } from "./CreateDocModal";
export { CreateContactModal } from "./CreateContactModal";
export { CreateDocForm } from "./CreateDocForm";
export { ImportModal } from "./ImportModal";
export { DocPreview } from "./DocPreview";
export { PdfPreviewModal } from "./PdfPreviewModal";
export { downloadDocPdf } from "./pdf";

import { db } from "./db";
import { seedIfNeeded, resetDemo } from "./seed";

/**
 * Boot the datastore: honour a `?reset` URL flag, expose a hidden console
 * reset (window.__resetDemo) — no UI button — then ensure seed data exists.
 * Returns a promise so the app can wait before first paint.
 */
export async function bootDemoData(): Promise<{ ok: boolean; count: number; error?: string; stage?: string }> {
  const result: { ok: boolean; count: number; error?: string; stage?: string } = { ok: false, count: 0 };
  const fail = (stage: string, e: any) => {
    result.stage = stage;
    result.error = (e && (e.stack || e.message)) ? String(e.stack || e.message) : String(e);
    console.error(`[demo] FAILED at ${stage}:`, e);
  };

  // hidden console helpers (no UI)
  (window as any).__resetDemo = async () => { try { await resetDemo(); } finally { location.reload(); } };
  (window as any).__nukeDemo = async () => { try { await db.delete(); } finally { location.reload(); } };

  const params = new URLSearchParams(window.location.search);
  const force = params.has("reset");
  if (force) {
    params.delete("reset");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }

  // 1) open (recreate if the stored DB is corrupt / schema-mismatched)
  try {
    await db.open();
  } catch (e) {
    fail("open", e);
    try { await db.delete(); await db.open(); } catch (e2) { fail("recreate-open", e2); }
  }

  // 2) seed
  try {
    if (force) await resetDemo();
    else await seedIfNeeded();
  } catch (e) {
    fail("seed", e);
    try { await db.delete(); await db.open(); await resetDemo(); } catch (e2) { fail("recreate-seed", e2); }
  }

  // 3) verify + last-resort reseed
  try {
    result.count = await db.customers.count();
    if (result.count === 0) {
      await resetDemo();
      result.count = await db.customers.count();
    }
    result.ok = result.count > 0;
  } catch (e) {
    fail("verify", e);
  }

  (window as any).__demo = result;
  console.info(`[demo] boot done — customers: ${result.count}, ok: ${result.ok}${result.error ? `, error@${result.stage}: ${result.error}` : ""}`);
  return result;
}
