/**
 * File: src/lib/api/createResource.ts
 * Factory that produces a typed CRUD service for a REST resource.
 *
 * A new entity becomes a one-liner:
 *   export const invoicesService = createResource<Invoice>("/invoices");
 *
 * Every method hits the conventional REST route. Override `paths` if your
 * backend uses a different scheme.
 */

import { api } from "./client";
import type { Entity, ListParams } from "./types";

export interface ResourceService<T extends Entity, TInput = Partial<T>> {
  endpoint: string;
  list: (params?: ListParams) => Promise<T[]>;
  get: (id: string) => Promise<T>;
  create: (payload: TInput) => Promise<T>;
  update: (id: string, payload: TInput) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export interface CreateResourceOptions {
  /** Send PUT instead of PATCH for updates. Default: PATCH. */
  updateMethod?: "put" | "patch";
}

export function createResource<T extends Entity, TInput = Partial<T>>(
  endpoint: string,
  options: CreateResourceOptions = {},
): ResourceService<T, TInput> {
  const base = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const updateMethod = options.updateMethod ?? "patch";

  return {
    endpoint: base,
    list: (params) => api.get<T[]>(base, { params }),
    get: (id) => api.get<T>(`${base}/${id}`),
    create: (payload) => api.post<T>(base, payload),
    update: (id, payload) =>
      updateMethod === "put"
        ? api.put<T>(`${base}/${id}`, payload)
        : api.patch<T>(`${base}/${id}`, payload),
    remove: (id) => api.delete<void>(`${base}/${id}`),
  };
}
