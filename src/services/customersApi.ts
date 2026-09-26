/**
 * File: src/services/customersApi.ts
 * Sales → Customers: server-backed customer list + CRUD.
 *
 * Backend endpoints (Invoice_erp_management_server / customer.rest.route.ts):
 *   GET    /api/v1/customers          → allCustomerFullDB (full docs, paginated)
 *   POST   /api/v1/customers          → create
 *   GET    /api/v1/customers/:id      → singleCustomer
 *   PATCH  /api/v1/customers/:id      → updateCustomer
 *   DELETE /api/v1/customers/:id      → deleteCustomer (soft-delete / trash)
 *   POST   /api/v1/customer/merge     → { survivor_id, merged_ids[] }
 *
 * All list queries are server-side (owner rule 9):
 *   ?page=&limit=&searchTerm=&sort=&isArchive=true
 */

import { api } from "@/lib/api/client";
import { numericId } from "@/lib/db/sync";
import type {
  TBackendParty,
  TPartyPagination,
  TCustomerRow,
  TPartyListResult,
  TBusinessProfile,
  TPartyAddress,
} from "./customerTypes";

export type { TBackendParty, TPartyPagination, TCustomerRow, TPartyListResult } from "./customerTypes";

/* ── Sort map: UI label → backend sort param ───────────────────────────────── */
const SORT_MAP: Record<string, string> = {
  Name: "businessProfile.companyName",
  "First Name": "name",
  "Last Name": "name",
  "Created On": "createdAt",
  Outstanding: "businessProfile.opening_balance",
  Total: "businessProfile.opening_balance",
  Due: "businessProfile.opening_balance",
  Paid: "businessProfile.opening_balance",
};

export function uiSortToBackend(uiSort: string): string {
  return SORT_MAP[uiSort] ?? "businessProfile.companyName";
}

/** Default list direction: newest first for Created On, A→Z otherwise. */
export function uiSortDirection(uiSort: string): "Ascending" | "Descending" {
  return uiSort === "Created On" ? "Descending" : "Ascending";
}

/* ── Date-range filter for "Created On" chip ───────────────────────────────── */
export function createdOnToRange(option: string): { startDate?: string; endDate?: string } {
  if (option === "All") return {};
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (option === "Today") {
    const today = iso(now);
    return { startDate: today, endDate: today };
  }
  if (option === "This Week") {
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now);
    mon.setDate(now.getDate() - day);
    return { startDate: iso(mon), endDate: iso(now) };
  }
  if (option === "This Month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: iso(start), endDate: iso(now) };
  }
  if (option === "This Year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: iso(start), endDate: iso(now) };
  }
  return {};
}

/* ── Map backend doc → UI row ───────────────────────────────────────────────── */
export function backendToRow(doc: TBackendParty): TCustomerRow {
  const profile = doc.businessProfile ?? {};
  const displayName = profile.companyName || doc.name || "(No name)";
  const contact = [doc.name, doc.email].filter(Boolean).join(" · ");
  const openingBalance = typeof profile.opening_balance === "number" ? profile.opening_balance : 0;
  return {
    id: numericId(doc._id),
    _id: doc._id,
    name: displayName,
    contact,
    email: doc.email || "",
    amount: openingBalance,
    status: profile.isArchive ? "Archived" : "Active",
  };
}

/* ── List (server-side pagination + search + sort + filter) ─────────────────── */
export interface CustomerListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sort?: string;          // already mapped to backend field
  isArchive?: boolean;    // true → archived list
  isDeleted?: boolean;    // true → trash list
  startDate?: string;
  endDate?: string;
}

export async function fetchCustomers(params: CustomerListParams): Promise<TPartyListResult> {
  const query: Record<string, unknown> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };
  if (params.searchTerm?.trim()) query.searchTerm = params.searchTerm.trim();
  if (params.sort) query.sort = params.sort;
  if (params.isArchive) query.isArchive = "true";
  if (params.isDeleted) query.isDeleted = "true";
  if (params.startDate) query.startDate = params.startDate;
  if (params.endDate) query.endDate = params.endDate;

  const res = await api.raw.get("/customers", { params: query });
  const body = res.data ?? {};
  const items: TBackendParty[] = Array.isArray(body.data) ? body.data : [];
  const pagination: TPartyPagination = body.pagination ?? {
    totalPage: 1,
    currentPage: 1,
    prevPage: 0,
    nextPage: 0,
    totalData: items.length,
  };
  return {
    rows: items.map(backendToRow),
    pagination,
  };
}

/* ── Single ─────────────────────────────────────────────────────────────────── */
export async function fetchCustomer(id: string): Promise<TBackendParty | null> {
  try {
    const res = await api.raw.get(`/customers/${id}`);
    return res.data?.data ?? null;
  } catch {
    return null;
  }
}

/* ── Map UI form fields → backend create/update payload ─────────────────────── */
export interface CustomerFormData {
  /* Details tab */
  name: string;           // company name → businessProfile.companyName
  firstName: string;
  lastName: string;
  email: string;
  phone: string;          // business phone → businessProfile.business_phone
  mobile: string;         // mobile → top-level phone
  fax: string;
  homePhone: string;
  regNo: string;
  taxId: string;
  birthday: string;
  anniversary: string;
  bank: string;
  // Billing address
  street1: string;
  street2: string;
  zip: string;
  city: string;
  state: string;
  country: string;
  sameAsBilling: boolean;
  // Shipping address
  shipStreet1: string;
  shipStreet2: string;
  shipZip: string;
  shipCity: string;
  shipState: string;
  shipCountry: string;
  /* Settings tab */
  currency: string;
  defaultTaxService: string;   // tax name string or "" — store as name, not id
  defaultTaxProduct: string;
  hourlyRate: string;
  paymentTerms: string;
  openingBalance: string;
  openingBalanceDate: string;
  notes: string;
  paymentReminder: boolean;
  isLoginRequired?: boolean;
}

function buildAddress(
  s1: string, s2: string, zip: string, city: string, state: string, country: string
): TPartyAddress {
  return {
    address_line_1: s1 || undefined,
    address_line_2: s2 || undefined,
    zip_code: zip || undefined,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
  };
}

export function formToPayload(f: CustomerFormData): Record<string, unknown> {
  const contactName = `${f.firstName} ${f.lastName}`.trim();
  const billingAddr = buildAddress(f.street1, f.street2, f.zip, f.city, f.state, f.country);
  const shippingAddr = f.sameAsBilling
    ? billingAddr
    : buildAddress(f.shipStreet1, f.shipStreet2, f.shipZip, f.shipCity, f.shipState, f.shipCountry);

  const payload: Record<string, unknown> = {
    company_name: f.name.trim(),
    name: contactName || undefined,
    currency: f.currency || undefined,
    phone: f.mobile || undefined,            // top-level phone = mobile
    business_phone: f.phone || undefined,
    fax: f.fax || undefined,
    home_phone: f.homePhone || undefined,
    registration_number: f.regNo || undefined,
    tax_number: f.taxId || undefined,
    birthday: f.birthday || undefined,
    anniversary: f.anniversary || undefined,
    bank_details: f.bank || undefined,
    payment_terms: f.paymentTerms || undefined,
    hourly_rate: parseFloat(f.hourlyRate) || undefined,
    opening_balance: parseFloat(f.openingBalance) || undefined,
    opening_balance_date: f.openingBalanceDate || undefined,
    notes: f.notes || undefined,
    payment_reminder: f.paymentReminder,
    is_login_required: f.isLoginRequired ?? false,
    billing_address: billingAddr,
    shipping_address: shippingAddr,
    same_as_billing: f.sameAsBilling,
  };

  // email — only send when non-blank (sparse unique index)
  if (f.email.trim()) payload.email = f.email.trim();

  return payload;
}

/* ── Create ─────────────────────────────────────────────────────────────────── */
export async function createCustomer(f: CustomerFormData): Promise<TBackendParty> {
  const res = await api.raw.post("/customers", formToPayload(f));
  return res.data?.data ?? res.data;
}

/* ── Update ─────────────────────────────────────────────────────────────────── */
export async function updateCustomer(backendId: string, f: CustomerFormData): Promise<TBackendParty> {
  const payload = { ...formToPayload(f), _id: backendId };
  const res = await api.raw.patch(`/customers/${backendId}`, payload);
  return res.data?.data ?? res.data;
}

/* ── Archive (soft) ─────────────────────────────────────────────────────────── */
export async function archiveCustomer(backendId: string): Promise<void> {
  await api.raw.patch(`/customers/${backendId}`, {
    _id: backendId,
    isArchive: true,
    active: false,
  });
}

/* ── Bulk archive ───────────────────────────────────────────────────────────── */
export async function archiveCustomers(backendIds: string[]): Promise<void> {
  await Promise.all(backendIds.map((id) => archiveCustomer(id)));
}

/* ── Delete (trash / soft-delete) ───────────────────────────────────────────── */
export async function deleteCustomer(backendId: string): Promise<void> {
  await api.raw.delete(`/customers/${backendId}`);
}

/* ── Bulk delete (soft → Trash) ─────────────────────────────────────────────── */
export async function deleteCustomers(backendIds: string[]): Promise<void> {
  // Backend supports comma-separated ids in the :id param
  if (backendIds.length === 0) return;
  await api.raw.delete(`/customers/${backendIds.join(",")}`);
}

/** Permanent delete from Trash (supports multiple ids). */
export async function permanentDeleteCustomers(backendIds: string[]): Promise<void> {
  if (backendIds.length === 0) return;
  await api.raw.delete(`/customers/permanent/${backendIds.join(",")}`);
}

export async function permanentDeleteCustomer(backendId: string): Promise<void> {
  await permanentDeleteCustomers([backendId]);
}

/** Restore a trashed customer back to Active. */
export async function restoreCustomer(backendId: string): Promise<void> {
  await api.raw.post(`/customers/restore/${backendId}`);
}

export async function restoreCustomers(backendIds: string[]): Promise<void> {
  if (backendIds.length === 0) return;
  await Promise.all(backendIds.map((id) => restoreCustomer(id)));
}

/* ── Merge ──────────────────────────────────────────────────────────────────── */
export async function mergeCustomers(survivorId: string, mergedIds: string[]): Promise<void> {
  await api.raw.post("/customer/merge", {
    survivor_id: survivorId,
    merged_ids: mergedIds,
  });
}
