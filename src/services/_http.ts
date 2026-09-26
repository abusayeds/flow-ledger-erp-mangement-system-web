/**
 * File: src/services/_http.ts
 * Shared helpers for wiring the HRM / Budget / Double-Entry / Performance /
 * Training modules to their REST backends.
 *
 * These backends are NOT uniformly conventional:
 *   - some list endpoints are `/x/all`, detail `/x/single/:id`, create
 *     `/x/create`, edit `/x/edit/:id`, delete `/x/delete/:id`
 *   - some use PUT for updates, others PATCH
 *   - list payloads come back in several different envelope shapes
 *   - documents/entities use Mongo `_id` rather than `id`
 *
 * `makeResource()` produces an object that satisfies the existing
 * `ResourceService<T>` contract (so `createResourceHooks` and
 * `useResourceData` work unchanged) while letting each entity declare its own
 * URL scheme. Extra action endpoints (approve / close / status / …) are added
 * per-service as plain functions.
 */

import { api } from "@/lib/api/client";
import type { Entity, ListParams } from "@/lib/api/types";
import type { ResourceService } from "@/lib/api/createResource";

/**
 * Render a possibly-populated reference (Mongo ref that may come back as a bare
 * id string, or as a populated `{ _id, name, ... }` document) as a safe display
 * string. Never returns an object, so it is always safe as a React child.
 */
export function refLabel(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    return (
      v.name ??
      v.title ??
      v.label ??
      v.full_name ??
      v.employee_name ??
      v.branch_name ??
      v.department_name ??
      v.designation_name ??
      (v.user_id && typeof v.user_id === "object" ? v.user_id.name : undefined) ??
      v.email ??
      ""
    );
  }
  return String(v);
}

/** Copy Mongo `_id` onto `id` so the whole UI can rely on `item.id`. */
export function normalizeId<T = any>(obj: any): T {
  if (obj && typeof obj === "object") {
    if (obj._id && !obj.id) obj.id = String(obj._id);
    else if (obj.id != null) obj.id = String(obj.id);
  }
  return obj as T;
}

/**
 * Pull an array out of whatever envelope the backend used. Handles:
 *   [...]                                  (bare array)
 *   { data: [...] }                        (axios already unwrapped one level)
 *   { data: { data: [...], meta } }        (nested)
 *   { result | results | items | docs }    (common alternates, incl. nested)
 */
export function toArray<T = any>(payload: any): T[] {
  if (Array.isArray(payload)) return payload.map((x) => normalizeId<T>(x));

  if (payload && typeof payload === "object") {
    const direct = [
      payload.data,
      payload.result,
      payload.results,
      payload.items,
      payload.docs,
      payload.rows,
    ];
    for (const c of direct) {
      if (Array.isArray(c)) return c.map((x) => normalizeId<T>(x));
    }
    // one level deeper, e.g. { data: { data: [...] } }
    if (payload.data && typeof payload.data === "object") {
      const nested = [
        payload.data.data,
        payload.data.result,
        payload.data.results,
        payload.data.items,
        payload.data.docs,
        payload.data.rows,
      ];
      for (const c of nested) {
        if (Array.isArray(c)) return c.map((x) => normalizeId<T>(x));
      }
    }
  }
  return [];
}

/** Unwrap a single resource from `{ data }` / `{ data: { data } }` envelopes. */
export function toObject<T = any>(payload: any): T {
  let value = payload;
  if (value && typeof value === "object" && "data" in value && !Array.isArray(value)) {
    value = value.data;
  }
  if (value && typeof value === "object" && "data" in value && !Array.isArray(value) && value.data && typeof value.data === "object") {
    value = value.data;
  }
  return normalizeId<T>(value);
}

/** GET a list endpoint and always return a plain array. */
export async function getList<T = any>(url: string, params?: ListParams): Promise<T[]> {
  const res = await api.raw.get(url, { params });
  return toArray<T>(res.data);
}

/** GET a single endpoint and return the unwrapped, id-normalized object. */
export async function getOne<T = any>(url: string, params?: ListParams): Promise<T> {
  const res = await api.raw.get(url, { params });
  return toObject<T>(res.data);
}

export async function postJson<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await api.raw.post(url, body);
  return toObject<T>(res.data);
}

export async function putJson<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await api.raw.put(url, body);
  return toObject<T>(res.data);
}

export async function patchJson<T = any>(url: string, body?: unknown): Promise<T> {
  const res = await api.raw.patch(url, body);
  return toObject<T>(res.data);
}

export async function deleteJson<T = any>(url: string): Promise<T> {
  const res = await api.raw.delete(url);
  return toObject<T>(res.data);
}

/** Build a query string from optional params (skips null/undefined/empty). */
export function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface ResourcePaths {
  /** GET list URL, e.g. "/hrm/setup/branches" or "/performance/indicators/all" */
  list: string;
  /** GET single URL builder. Defaults to `${list}/${id}`. */
  single?: (id: string) => string;
  /** POST create URL. Defaults to `list`. */
  create?: string;
  /** PUT/PATCH update URL builder. Defaults to `${list}/${id}`. */
  update?: (id: string) => string;
  /** DELETE URL builder. Defaults to `${list}/${id}`. */
  remove?: (id: string) => string;
  /** Update verb. Default "patch". */
  updateMethod?: "put" | "patch";
}

/**
 * Build a ResourceService<T> for an entity with arbitrary URL conventions.
 * The result plugs straight into `createResourceHooks` / `useResourceData`.
 */
export function makeResource<T extends Entity, TInput = Partial<T>>(
  paths: ResourcePaths,
): ResourceService<T, TInput> {
  const {
    list,
    single = (id: string) => `${list}/${id}`,
    create = list,
    update = (id: string) => `${list}/${id}`,
    remove = (id: string) => `${list}/${id}`,
    updateMethod = "patch",
  } = paths;

  return {
    endpoint: list,
    list: (params) => getList<T>(list, params),
    get: (id) => getOne<T>(single(id)),
    create: (payload) => postJson<T>(create, payload),
    update: (id, payload) =>
      updateMethod === "put"
        ? putJson<T>(update(id), payload)
        : patchJson<T>(update(id), payload),
    remove: async (id) => {
      await deleteJson(remove(id));
    },
  } as ResourceService<T, TInput>;
}
