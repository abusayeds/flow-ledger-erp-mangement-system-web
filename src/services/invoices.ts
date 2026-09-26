/**
 * File: src/services/invoices.ts
 * Invoice resource: API service + React Query hooks.
 */

import { createResource } from "@/lib/api/createResource";
import { createResourceHooks } from "@/hooks/useResource";
import type { Entity } from "@/lib/api/types";

export interface InvoiceItem {
  srNo: number;
  item: string;
  description?: string;
  rate: number;
  quantity: number;
  tax: number;
  discount: number;
  amount: number;
}

export interface Invoice extends Entity {
  invoiceNumber: string;
  customerName: string;
  customerSubtitle: string;
  status: "Draft" | "Approved" | "Cancelled";
  amount: number;
  invoiceDate: string;
  dueDate: string;
  date: string;
  billingAddress: string;
  billingCity: string;
  billingZip: string;
  shippingMethod: string;
  subTitle: string;
  poNumber: string;
  currency: string;
  items: InvoiceItem[];
  termsAndConditions: string;
  notes: string;
  internalNotes: string;
  subTotal: number;
  shippingCost: number;
  salesTax: number;
  total: number;
  paid: number;
  due: number;
}

export const invoicesService = createResource<Invoice>("/invoices");
export const invoiceHooks = createResourceHooks("invoices", invoicesService);
