/**
 * File: src/lib/api/index.ts
 * Barrel export for the API layer.
 */

export { api, onUnauthorized } from "./client";
export { createResource } from "./createResource";
export type { ResourceService, CreateResourceOptions } from "./createResource";
export { ApiError, toApiError } from "./ApiError";
export { getToken, setToken, clearToken, onTokenChange } from "./tokenStore";
export type { Entity, ListParams, Paginated } from "./types";
