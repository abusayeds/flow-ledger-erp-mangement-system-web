/**
 * File: src/services/customers.ts
 * Customer resource: API service + React Query hooks.
 *
 * This is the canonical example of wiring an entity to the data layer.
 * Point it at a real backend by ensuring `/customers` exists; until then,
 * pages using useResourceData fall back to local sample data automatically.
 */

import { createResource } from "@/lib/api/createResource";
import { createResourceHooks } from "@/hooks/useResource";
import type { Entity } from "@/lib/api/types";

export interface Customer extends Entity {
  name: string;
  companyName: string;
  email: string;
  businessPhone: string;
  taxId: string;
  mobile: string;
  billingAddress: string;
  billingCity: string;
  billingCountry: string;
  shippingAddress: string;
  currency: string;
  paymentTerms: string;
  notes: string;
  outstanding: number;
  netProfit: number;
  sales: number;
  profit: number;
}

export const customersService = createResource<Customer>("/customers");
export const customerHooks = createResourceHooks("customers", customersService);
