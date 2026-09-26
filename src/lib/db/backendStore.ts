/**
 * File: src/lib/db/backendStore.ts
 * Backend-backed replacement for the old local `db.meta` seed stores. Each store
 * mirrors ONE backend collection (company-scoped by the auth token) and exposes
 * the same `use()` / `save(list)` shape the pages already call, so wiring a
 * module to the backend needs almost no page changes:
 *
 *   - use()          → live list for the logged-in company (undefined while loading)
 *   - save(newList)  → diffs against the current list and issues the matching
 *                      POST (create) / PUT (update) / DELETE (remove) calls
 *
 * Data is cached per auth token, so switching companies (logout → login) always
 * refetches instead of showing the previous tenant's rows. There is NO seed and
 * NO cross-tenant persistence — a fresh company starts empty.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/tokenStore";
import { toArray } from "@/services/_http";

/** A 24-char hex string is a real backend `_id`; anything else is a local temp id. */
export const isBackendId = (id: unknown): boolean =>
  typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);

export interface BackendStoreConfig<F extends { id: string }> {
  /** REST base path, e.g. "/goal/goals". */
  base: string;
  /** Map a backend document → the shape the pages consume. */
  toFrontend: (doc: any) => F;
  /** Map a page item → the create/update request body. */
  toBackend: (item: F) => Record<string, any>;
  /** Did an existing row change enough to warrant a PUT? Defaults to payload compare. */
  changed?: (oldItem: F, newItem: F) => boolean;
  /** Side-effect on every fetch (e.g. refresh a name→id lookup for references). */
  onFetch?: (docs: any[]) => void;
  /** Pull the array out of a non-standard response body (e.g. `{ entries: [...] }`). */
  extract?: (payload: any) => any[];
  /** Which writes the backend supports (report endpoints are often read-only). */
  mutable?: { create?: boolean; update?: boolean; remove?: boolean };
}

export interface BackendStore<F extends { id: string }> {
  use: () => F[] | undefined;
  save: (newList: F[]) => Promise<void>;
  refetch: () => Promise<F[]>;
  peek: () => F[] | undefined;
}

export function makeBackendStore<F extends { id: string }>(
  cfg: BackendStoreConfig<F>,
): BackendStore<F> {
  let cache: F[] | undefined;
  let loadedToken: string | null = null;
  let inFlight: Promise<F[]> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const defaultChanged = (a: F, b: F) =>
    JSON.stringify(cfg.toBackend(a)) !== JSON.stringify(cfg.toBackend(b));
  const changed = cfg.changed ?? defaultChanged;

  async function fetchList(): Promise<F[]> {
    const tok = getToken();
    if (!tok) {
      cache = [];
      loadedToken = null;
      notify();
      return cache;
    }
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const res = await api.raw.get(cfg.base);
      const docs = cfg.extract ? cfg.extract(res.data) : toArray<any>(res.data);
      cfg.onFetch?.(docs);
      cache = docs.map(cfg.toFrontend);
      loadedToken = tok;
      notify();
      return cache;
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function use(): F[] | undefined {
    const [, force] = useState(0);
    useEffect(() => {
      const l = () => force((x) => x + 1);
      listeners.add(l);
      // (Re)fetch when the store hasn't loaded for the current token — this is
      // what makes a company switch drop the previous tenant's cached rows.
      if (getToken() && loadedToken !== getToken()) void fetchList();
      return () => {
        listeners.delete(l);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return loadedToken === getToken() ? cache : undefined;
  }

  const can = { create: true, update: true, remove: true, ...(cfg.mutable ?? {}) };

  async function save(newList: F[]): Promise<void> {
    const old = cache ?? [];
    const newIds = new Set(newList.map((x) => x.id));

    // Deletes: previously-present backend rows dropped from the new list.
    if (can.remove) {
      for (const o of old) {
        if (isBackendId(o.id) && !newIds.has(o.id)) {
          await api.raw.delete(`${cfg.base}/${o.id}`);
        }
      }
    }
    // Creates + updates.
    for (const n of newList) {
      if (!isBackendId(n.id)) {
        if (can.create) await api.raw.post(cfg.base, cfg.toBackend(n));
      } else if (can.update) {
        const o = old.find((x) => x.id === n.id);
        if (o && changed(o, n)) {
          await api.raw.put(`${cfg.base}/${n.id}`, cfg.toBackend(n));
        }
      }
    }
    await fetchList();
  }

  return { use, save, refetch: fetchList, peek: () => cache };
}

/* ── single-object (report) store ──────────────────────────────────
 * For endpoints that return ONE object (e.g. a profit-and-loss report) rather
 * than a list. `save(value)` re-queries the backend with params derived from
 * the value (e.g. a changed date range), so report filters still work.
 */
export interface BackendValueStoreConfig<V> {
  base: string;
  toFrontend: (payload: any) => V;
  /** Turn a saved value into query params for the refetch (e.g. {from,to}). */
  paramsFrom?: (value: V) => Record<string, any>;
}

export interface BackendValueStore<V> {
  use: () => V | undefined;
  save: (value: V) => Promise<void>;
  refetch: () => Promise<V>;
}

export function makeBackendValueStore<V>(cfg: BackendValueStoreConfig<V>): BackendValueStore<V> {
  let cache: V | undefined;
  let loadedToken: string | null = null;
  let params: Record<string, any> = {};
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  async function fetchOne(): Promise<V> {
    const tok = getToken();
    if (!tok) {
      loadedToken = null;
      return cache as V;
    }
    const res = await api.raw.get(cfg.base, { params });
    cache = cfg.toFrontend(res.data);
    loadedToken = tok;
    notify();
    return cache;
  }

  function use(): V | undefined {
    const [, force] = useState(0);
    useEffect(() => {
      const l = () => force((x) => x + 1);
      listeners.add(l);
      if (getToken() && loadedToken !== getToken()) void fetchOne();
      return () => {
        listeners.delete(l);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return loadedToken === getToken() ? cache : undefined;
  }

  async function save(value: V): Promise<void> {
    if (cfg.paramsFrom) params = cfg.paramsFrom(value);
    await fetchOne();
  }

  return { use, save, refetch: fetchOne };
}
