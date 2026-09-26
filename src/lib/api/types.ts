/**
 * File: src/lib/api/types.ts
 * Shared API primitives.
 */

/** Every persisted entity has a string id. */
export interface Entity {
  id: string;
}

/** Standard list query params understood by createResource(). */
export interface ListParams {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** Any additional backend-specific filters. */
  [key: string]: unknown;
}

/** Shape returned by a paginated list endpoint. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}
