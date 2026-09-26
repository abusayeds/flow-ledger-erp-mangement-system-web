/**
 * File: src/lib/db/db.ts
 * The demo datastore — a real IndexedDB database (via Dexie).
 *
 * This is the single source of truth for the live presentation build: every
 * page reads/writes these collections, so a record added in one feature shows
 * up everywhere it is referenced (shared `customers`/`vendors`/`products`/…).
 *
 * Primary key is an explicit numeric `id` (we assign it, so seeded records keep
 * stable ids that documents can reference). Foreign keys + common filter fields
 * are indexed. Line items are embedded arrays on each document (not indexed).
 *
 * After the presentation, swap the repository layer (repo.ts) for the real
 * axios API — pages talk to `useCollection`/`repo`, never to Dexie directly.
 */

import Dexie, { type Table } from "dexie";

export type Row = { id: number;[key: string]: any };

class DemoDB extends Dexie {
  // meta / config
  meta!: Table<{ key: string; value: any }, string>;
  company!: Table<Row, number>;

  // shared reference entities
  customers!: Table<Row, number>;
  vendors!: Table<Row, number>;
  products!: Table<Row, number>;
  services!: Table<Row, number>;
  taxes!: Table<Row, number>;
  categories!: Table<Row, number>;
  units!: Table<Row, number>;

  // sales documents
  invoices!: Table<Row, number>;
  estimates!: Table<Row, number>;
  proformas!: Table<Row, number>;
  salesReceipts!: Table<Row, number>;
  creditNotes!: Table<Row, number>;
  deliveryChallans!: Table<Row, number>;
  paymentsReceived!: Table<Row, number>;

  // purchase documents
  bills!: Table<Row, number>;
  purchaseOrders!: Table<Row, number>;
  purchaseReturns!: Table<Row, number>;
  paymentsMade!: Table<Row, number>;
  debitNotes!: Table<Row, number>;
  expenses!: Table<Row, number>;

  // projects & time
  projects!: Table<Row, number>;
  tasks!: Table<Row, number>;
  timelogs!: Table<Row, number>;

  // hr / people
  employees!: Table<Row, number>;

  // misc
  forms!: Table<Row, number>;

  constructor() {
    super("invoiceDemoDB");
    this.version(1).stores({
      meta: "key",
      company: "id",

      customers: "id, name, email, status",
      vendors: "id, name, email, status",
      products: "id, name, category, status",
      services: "id, name, status",
      taxes: "id, name",
      categories: "id, name",
      units: "id, name",

      invoices: "id, number, customerId, status, date, due",
      estimates: "id, number, customerId, status, date",
      proformas: "id, number, customerId, status, date",
      salesReceipts: "id, number, customerId, date",
      creditNotes: "id, number, customerId, status, date",
      deliveryChallans: "id, number, customerId, status, date",
      paymentsReceived: "id, number, customerId, invoiceId, date",

      bills: "id, number, vendorId, status, date",
      purchaseOrders: "id, number, vendorId, status, date",
      purchaseInvoices: "id, number, vendorId, status, date",
      purchaseReturns: "id, number, vendorId, status, date, invoiceId",
      paymentsMade: "id, number, vendorId, billId, date",
      debitNotes: "id, number, vendorId, status, date",
      expenses: "id, number, vendorId, category, date",

      projects: "id, name, customerId",
      tasks: "id, name, projectId",
      timelogs: "id, customerId, projectId, taskId, date, month",

      employees: "id, name, department",

      forms: "id, name",
    });
    // Drop unused purchaseInvoices table (feature removed — same as Bills).
    this.version(2).stores({
      purchaseInvoices: null,
    });
  }
}

export const db = new DemoDB();

/** Every collection name, for generic tooling / reset. */
export const COLLECTIONS = [
  "company",
  "customers", "vendors", "products", "services", "taxes", "categories", "units",
  "invoices", "estimates", "proformas", "salesReceipts", "creditNotes", "deliveryChallans", "paymentsReceived",
  "bills", "purchaseOrders", "purchaseReturns", "paymentsMade", "debitNotes", "expenses",
  "projects", "tasks", "timelogs",
  "employees", "forms",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];
