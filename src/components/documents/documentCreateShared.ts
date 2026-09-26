import type { CollectionName } from "@/lib/db/db";
import type { EmailDocType, EmailNavKey } from "@/services/emailTemplatesApi";

/** Bordered fields in create forms — theme-aware via `keep-box ua-field`. */
export const DOC_FIELD =
  "keep-box ua-field w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600";

export const RECURRING_OPTIONS = ["None", "Daily", "Weekly", "Monthly", "Yearly"] as const;

export const isRecurringActive = (value: string) =>
  value !== "None" && value !== "Off" && value.trim() !== "";

export const COLLECTION_EMAIL_DOC: Partial<Record<CollectionName, EmailDocType>> = {
  invoices: "invoice",
  proformas: "proforma_invoice",
  estimates: "estimate",
  salesReceipts: "sales_receipt",
  deliveryChallans: "delivery_challan",
  creditNotes: "credit_note",
  purchaseOrders: "purchase_order",
  bills: "bill",
  debitNotes: "debit_note",
};

export const emailNavForCollection = (collection: CollectionName): EmailNavKey =>
  COLLECTION_EMAIL_DOC[collection] ?? "invoice";
