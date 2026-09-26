/**
 * File: src/lib/db/repo.ts
 * Generic repository over the demo datastore. Pages call these — never Dexie
 * directly — so the whole thing can later be repointed at the real API.
 *
 *   await repo.add("customers", { name, email });   // returns new id
 *   await repo.update("invoices", id, { status });
 *   await repo.remove("bills", id);
 *   const n = await repo.nextNumber("invoices");     // next "#NN" sequence
 */

import { db, type CollectionName } from "./db";
import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/tokenStore";
import { toObject } from "@/services/_http";
import { specFor, resync, numericId } from "./sync";
import { showBusy, hideBusy } from "@/lib/busyOverlay";

const tbl = (name: CollectionName) => (db as any)[name];

/** Backend write config for a collection when it is wired + we're authed. */
function writeSpec(name: CollectionName) {
  if (!getToken()) return undefined;
  return specFor(name)?.write;
}

/** Next free numeric primary key for a collection. */
export async function nextId(name: CollectionName): Promise<number> {
  const rows = await tbl(name).toArray();
  return rows.reduce((m: number, r: any) => Math.max(m, r.id || 0), 0) + 1;
}

/** Next human "#NN" document number (max existing numeric `number` + 1). */
export async function nextNumber(name: CollectionName): Promise<number> {
  const rows = await tbl(name).toArray();
  return rows.reduce((m: number, r: any) => {
    const n = parseInt(String(r.number ?? r.id ?? 0).replace(/[^0-9]/g, ""), 10) || 0;
    return Math.max(m, n);
  }, 0) + 1;
}

/** Insert a record (assigns id + timestamps if missing). Returns the id. */
export async function add(name: CollectionName, data: Record<string, any>): Promise<number> {
  // Write-through: persist to the backend, then re-pull the collection.
  const w = writeSpec(name);
  if (w) {
    const res = await api.raw.post(w.create, await w.reverse(data));
    const created = toObject<any>(res.data);
    const backendId = String(created?._id ?? created?.id ?? "");
    const id = backendId ? numericId(backendId) : await nextId(name);
    await resync(name);
    // List resync can miss a just-created row (pagination/sort). Keep a local
    // copy keyed by the create response so PDF preview/download can resolve `_id`.
    if (backendId) {
      const existing = await tbl(name).get(id);
      if (!existing) {
        const now = new Date().toISOString();
        const mapped = created && specFor(name)?.map ? specFor(name)!.map(created) : {};
        await tbl(name).put({
          createdAt: now,
          updatedAt: now,
          ...data,
          ...mapped,
          _id: backendId,
          id,
        });
      }
    }
    return id;
  }
  const id = data.id ?? (await nextId(name));
  const now = new Date().toISOString();
  await tbl(name).put({ createdAt: now, updatedAt: now, ...data, id });
  return id;
}

/** Patch a record by id. */
export async function update(name: CollectionName, id: number, patch: Record<string, any>): Promise<void> {
  const w = writeSpec(name);
  if (w && w.update) {
    const row = await tbl(name).get(id);
    const backendId = String(row?._id ?? "");
    if (backendId) {
      const method = w.updateMethod ?? "patch";
      await (api.raw as any)[method](w.update(backendId), await w.reverse({ ...row, ...patch }));
      await resync(name);
      return;
    }
  }
  await tbl(name).update(id, { ...patch, updatedAt: new Date().toISOString() });
}

/** Replace a whole record by id. */
export async function put(name: CollectionName, data: Record<string, any>): Promise<void> {
  await tbl(name).put({ ...data, updatedAt: new Date().toISOString() });
}

/** Delete a record by id. */
export async function remove(name: CollectionName, id: number): Promise<void> {
  const w = writeSpec(name);
  if (w) {
    const row = await tbl(name).get(id);
    const backendId = String(row?._id ?? "");
    if (backendId) {
      const method = w.removeMethod ?? "delete";
      if (method === "post") {
        await api.raw.post(w.remove(backendId), w.removeBody ? w.removeBody(backendId) : { id: backendId });
      } else {
        await (api.raw as any)[method](w.remove(backendId));
      }
      await resync(name);
      return;
    }
  }
  await tbl(name).delete(id);
}

/** Delete many records by id. */
export async function removeMany(name: CollectionName, ids: number[]): Promise<void> {
  const w = writeSpec(name);
  if (w) {
    // Show a blocking "Deleting…" indicator so the user knows work is happening
    // (this runs N backend deletes + one resync and isn't instant).
    showBusy(`Deleting ${ids.length} item${ids.length === 1 ? "" : "s"}…`);
    try {
      // Delete every row on the backend first, then resync ONCE. Resyncing after
      // each delete re-pulls the whole collection N times, which makes the list
      // flicker/jump while a multi-select delete is in progress.
      for (const id of ids) {
        const row = await tbl(name).get(id);
        const backendId = String(row?._id ?? "");
        if (!backendId) {
          await tbl(name).delete(id);
          continue;
        }
        const method = w.removeMethod ?? "delete";
        if (method === "post") {
          await api.raw.post(w.remove(backendId), w.removeBody ? w.removeBody(backendId) : { id: backendId });
        } else {
          await (api.raw as any)[method](w.remove(backendId));
        }
      }
      await resync(name);
    } finally {
      hideBusy();
    }
    return;
  }
  await tbl(name).bulkDelete(ids);
}

/** One-shot read (non-reactive) — handy inside event handlers. */
export async function getOne(name: CollectionName, id: number): Promise<any> {
  return tbl(name).get(id);
}
export async function getAll(name: CollectionName): Promise<any[]> {
  return tbl(name).toArray();
}

export const repo = { nextId, nextNumber, add, update, put, remove, removeMany, getOne, getAll };
export default repo;
