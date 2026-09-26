/**
 * File: src/hooks/useResourceData.ts
 * Bridges a ResourceHooks bundle to a page that should keep working even when
 * no backend is connected (e.g. local demo / design preview).
 *
 * - When the API responds, `items` reflects the server and mutations call it.
 * - When the API is unreachable (network error / no backend), it transparently
 *   falls back to an in-memory copy seeded from sample data, and mutations
 *   operate on that copy so the UI stays fully interactive.
 *
 * This keeps the existing sample-data pages alive during incremental migration:
 * just swap `useState(sampleX)` for `useResourceData(xHooks, { seed: sampleX })`.
 */

import { useState } from "react";
import type { Entity, ListParams } from "../lib/api/types";
import type { ResourceHooks } from "./useResource";

function genId(): string {
  return `local_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export interface UseResourceDataResult<T> {
  items: T[];
  isLoading: boolean;
  /** True when running against the in-memory fallback (no backend). */
  offline: boolean;
  error: unknown;
  refetch: () => void;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: string, payload: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function useResourceData<T extends Entity, TInput = Partial<T>>(
  hooks: ResourceHooks<T, TInput>,
  options: { seed: T[]; params?: ListParams },
): UseResourceDataResult<T> {
  const { params } = options;
  // NOTE: the `seed` sample data is intentionally NOT used as display data —
  // the app must show real backend data or nothing (never fabricated rows).
  // `local` is only a scratch buffer for offline create/update/remove so the
  // page stays interactive when the backend is unreachable; it starts empty.
  const list = hooks.useList(params, { retry: 0 });
  const createM = hooks.useCreate();
  const updateM = hooks.useUpdate();
  const removeM = hooks.useRemove();

  const [local, setLocal] = useState<T[]>([]);

  const offline = list.isError || (!list.isLoading && !list.data);
  const items = !offline && list.data ? list.data : local;

  return {
    items,
    isLoading: list.isLoading,
    offline,
    error: list.error,
    refetch: () => list.refetch(),

    create: async (payload) => {
      if (offline) {
        const item = { ...(payload as object), id: genId() } as T;
        setLocal((prev) => [...prev, item]);
        return item;
      }
      return createM.mutateAsync(payload as TInput);
    },

    update: async (id, payload) => {
      if (offline) {
        const updated = { ...(payload as object), id } as T;
        setLocal((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)));
        return updated;
      }
      return updateM.mutateAsync({ id, payload: payload as TInput });
    },

    remove: async (id) => {
      if (offline) {
        setLocal((prev) => prev.filter((it) => it.id !== id));
        return;
      }
      await removeM.mutateAsync(id);
    },
  };
}
