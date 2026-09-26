/**
 * File: src/services/customerTypes.ts
 * Shared types for the server-backed Sales → Customers integration.
 * Mirrors the backend party contract (see
 * Invoice_erp_management_server/src/utils/partyUser.ts + queryBuilder.ts).
 */

/** Pagination meta returned by the backend's queryBuilder.calculatePagination. */
export interface TPartyPagination {
  totalPage: number;
  currentPage: number;
  prevPage: number;
  nextPage: number;
  totalData: number;
}

/** One row of the backend list (toPartyListItem shape). */
export interface TPartyListItem {
  _id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  company_name?: string | null;
  opening_balance?: number;
  opening_balance_date?: string | null;
  active?: boolean;
  isArchive?: boolean;
}

/** Backend party address sub-document. */
export interface TPartyAddress {
  name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  zip_code?: string;
}

/** businessProfile sub-document on the full party document. */
export interface TBusinessProfile {
  companyName?: string;
  registration_number?: string;
  tax_number?: string;
  business_phone?: string;
  fax?: string;
  home_phone?: string;
  birthday?: string;
  anniversary?: string;
  bank_details?: string;
  payment_terms?: string;
  default_tax_service_id?: { _id: string; name?: string; rate?: number } | string;
  default_tax_product_id?: { _id: string; name?: string; rate?: number } | string;
  hourly_rate?: number;
  opening_balance?: number;
  opening_balance_date?: string;
  payment_reminder?: boolean;
  is_login_required?: boolean;
  billing_address?: TPartyAddress;
  shipping_address?: TPartyAddress;
  same_as_billing?: boolean;
  notes?: string;
  active?: boolean;
  isArchive?: boolean;
}

/** Full backend party document (GET /customers list rows, GET /customers/:id). */
export interface TBackendParty {
  _id: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  currency?: string;
  role?: string;
  companyId?: string;
  isDeleted?: boolean;
  isArchive?: boolean;
  businessProfile?: TBusinessProfile;
  createdAt?: string;
  updatedAt?: string;
}

/** UI list-row shape the Customers page renders (unchanged from the local rows). */
export interface TCustomerRow {
  id: number;
  _id: string;
  name: string;
  contact: string;
  email?: string;
  /** negative = customer owes us (opening balance) */
  amount: number;
  status: string;
}

/** Result of the server list call: rows + backend pagination meta. */
export interface TPartyListResult {
  rows: TCustomerRow[];
  pagination: TPartyPagination;
}
