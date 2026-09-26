/**
 * File: src/lib/db/hooks.ts
 * Reactive read hooks over the datastore (Dexie liveQuery). Any component that
 * uses these re-renders automatically when the underlying data changes — so a
 * record added in one feature appears instantly in every other feature that
 * lists or references it. This is what makes "add live, see it everywhere" work.
 */

import { useLiveQuery } from "dexie-react-hooks";
import { db, type CollectionName } from "./db";

const tbl = (name: CollectionName) => (db as any)[name];

/** Live array of a whole collection (optionally sorted by a field). */
export function useCollection<T = any>(name: CollectionName, sortBy?: string): T[] {
  return (
    useLiveQuery(async () => {
      const rows: T[] = await tbl(name).toArray();
      if (sortBy) rows.sort((a: any, b: any) => (a[sortBy] > b[sortBy] ? 1 : a[sortBy] < b[sortBy] ? -1 : 0));
      return rows;
    }, [name, sortBy], [] as T[]) ?? ([] as T[])
  );
}

/** Live single record by id (undefined while loading / not found). */
export function useDoc<T = any>(name: CollectionName, id?: number | null): T | undefined {
  return useLiveQuery(() => (id == null ? undefined : tbl(name).get(id)), [name, id], undefined) as T | undefined;
}

/** Live count of a collection. */
export function useCount(name: CollectionName): number {
  return useLiveQuery(() => tbl(name).count(), [name], 0) as number;
}

/** Live array filtered by an indexed equality (e.g. items for one project). */
export function useWhere<T = any>(name: CollectionName, field: string, value: any): T[] {
  return (
    useLiveQuery(
      () => (value == null ? tbl(name).toArray() : tbl(name).where(field).equals(value).toArray()),
      [name, field, value],
      [] as T[],
    ) ?? ([] as T[])
  );
}
