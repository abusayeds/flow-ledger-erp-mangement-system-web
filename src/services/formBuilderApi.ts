/**
 * Form Builder API — /api/v1/form-builder
 */
import { api } from "@/lib/api/client";
import type { TPartyPagination } from "./customerTypes";

export type FormListParams = {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;
  is_active?: boolean | string;
};

const FALLBACK_PAGINATION: TPartyPagination = {
  totalPage: 1,
  currentPage: 1,
  prevPage: 1,
  nextPage: 1,
  totalData: 0,
};

const text = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return "";
};

const idOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "_id" in v) return String((v as { _id: unknown })._id);
  return "";
};

const day = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const bool = (v: unknown, fallback = true): boolean => {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
};

export type FormFieldDto = {
  _id?: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  order?: number;
};

export type FormRow = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  defaultLayout: string;
  fieldCount: number;
  responseCount: number;
  fields: FormFieldDto[];
  createdAt: string;
};

export type FormResponseRow = {
  id: string;
  formId: string;
  responseData: Record<string, unknown>;
  createdAt: string;
};

export const mapForm = (d: any): FormRow => ({
  id: idOf(d),
  name: text(d.name),
  code: text(d.code),
  isActive: bool(d.is_active, true),
  defaultLayout: text(d.default_layout) || "single",
  fieldCount: Array.isArray(d.fields) ? d.fields.length : 0,
  responseCount: typeof d.response_count === "number" ? d.response_count : 0,
  fields: Array.isArray(d.fields)
    ? d.fields.map((f: any) => ({
        _id: idOf(f),
        label: text(f.label),
        type: text(f.type) || "text",
        required: bool(f.required, false),
        placeholder: text(f.placeholder),
        options: Array.isArray(f.options) ? f.options.map(String) : [],
        order: typeof f.order === "number" ? f.order : 0,
      }))
    : [],
  createdAt: day(d.createdAt),
});

export const mapFormResponse = (d: any): FormResponseRow => ({
  id: idOf(d),
  formId: idOf(d.form_id),
  responseData: d.response_data && typeof d.response_data === "object" ? d.response_data : {},
  createdAt: day(d.createdAt) || text(d.createdAt),
});

async function listGet<T>(path: string, params: FormListParams = {}) {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.is_active !== undefined && params.is_active !== "" && params.is_active !== "All") {
    query.is_active = params.is_active;
  }
  const res = await api.raw.get(path, { params: query });
  const body = res.data ?? {};
  const rows: T[] = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    pagination: body.pagination ?? { ...FALLBACK_PAGINATION, totalData: rows.length },
  };
}

export async function fetchForms(params?: FormListParams) {
  const { rows, pagination } = await listGet<any>("/form-builder/forms/all", params);
  return { rows: rows.map(mapForm), pagination };
}

export async function fetchForm(id: string) {
  const res = await api.raw.get(`/form-builder/forms/${id}`);
  return mapForm(res.data?.data ?? {});
}

export async function createForm(body: Record<string, unknown>) {
  return api.post("/form-builder/forms/create", body);
}

export async function updateForm(id: string, body: Record<string, unknown>) {
  return api.patch(`/form-builder/forms/${id}`, body);
}

export async function updateFormFields(id: string, fields: FormFieldDto[]) {
  return api.put(`/form-builder/forms/${id}/fields`, { fields });
}

export async function deleteForm(id: string) {
  return api.delete(`/form-builder/forms/${id}`);
}

export async function fetchFormResponses(formId: string, params?: FormListParams) {
  const { rows, pagination } = await listGet<any>(`/form-builder/forms/${formId}/responses`, params);
  return { rows: rows.map(mapFormResponse), pagination };
}

export async function fetchFormResponse(formId: string, responseId: string) {
  const res = await api.raw.get(`/form-builder/forms/${formId}/responses/${responseId}`);
  return mapFormResponse(res.data?.data ?? {});
}

export async function deleteFormResponse(formId: string, responseId: string) {
  return api.delete(`/form-builder/forms/${formId}/responses/${responseId}`);
}

/** Public (no auth required) — share link uses form `code`. */
export async function fetchPublicForm(code: string) {
  const res = await api.raw.get(`/form-builder/public/${code}`);
  return mapForm(res.data?.data ?? {});
}

export async function submitPublicForm(code: string, responseData: Record<string, unknown>) {
  const res = await api.raw.post(`/form-builder/public/${code}/submit`, responseData);
  return res.data?.data ?? res.data;
}

export function formShareUrl(code: string) {
  if (typeof window === "undefined") return `/f/${code}`;
  return `${window.location.origin}/f/${code}`;
}
