/**
 * File: src/lib/db/doubleEntry.ts
 * Double Entry module data — journal entries (with per-entry debit/credit
 * lines), trial balance rows, profit & loss statement and generated balance
 * sheets, persisted in the Dexie `meta` table (no schema bump) with the same
 * liveQuery store pattern as lib/db/goal.ts. Keys:
 *   de:journal / de:trialBalance / de:profitLoss / de:balanceSheets
 * The Ledger Summary page derives its rows from the journal lines.
 */

import { makeBackendStore, makeBackendValueStore } from "./backendStore";

/* ── types ─────────────────────────────────────────────────────── */

export interface JournalLine {
  code: string;
  name: string;
  description: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  number: string; // JE-2026-139
  date: string; // yyyy-mm-dd
  reference: string; // expense | vendor_payment | ...
  description: string;
  status: "Posted" | "Draft";
  lines: JournalLine[];
}

export interface TrialRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
}

export interface PLRow {
  code: string;
  name: string;
  amount: number;
}

export interface ProfitLossData {
  from: string;
  to: string;
  revenue: PLRow[];
  expenses: PLRow[];
}

export interface BalanceSheetRec {
  id: string;
  date: string; // as-of date yyyy-mm-dd
  year: string; // financial year
  status: "Draft" | "Finalized";
  notes: string[];
}

/* ── backend wiring ─────────────────────────────────────────────
 * Double-entry pages are report views over the company's real ledger. Journal
 * entries + trial balance are read-only reports; profit & loss is a single
 * date-ranged report object; balance sheets are a real list (create only —
 * the backend has no per-sheet update/delete route).
 */

const day = (d?: string) => (d ? String(d).slice(0, 10) : "");

export const journalStore = makeBackendStore<JournalEntry>({
  base: "/double-entry/reports/journal-entry",
  extract: (p) => p?.data?.entries || p?.entries || [],
  mutable: { create: false, update: false, remove: false },
  toFrontend: (e) => ({
    id: String(e._id),
    number: e.journal_number || "",
    date: day(e.date),
    reference: e.reference_type || "",
    description: e.description || "",
    status: e.status === "posted" ? "Posted" : "Draft",
    lines: (e.items || []).map((it: any) => ({
      code: it.account_code || "",
      name: it.account_name || "",
      description: it.description || "",
      debit: it.debit || 0,
      credit: it.credit || 0,
    })),
  }),
  toBackend: () => ({}),
});

export const trialBalanceStore = makeBackendStore<TrialRow & { id: string }>({
  base: "/double-entry/trial-balance",
  extract: (p) => p?.data?.accounts || p?.accounts || [],
  mutable: { create: false, update: false, remove: false },
  toFrontend: (a) => ({
    id: String(a._id || a.account_code),
    code: a.account_code || "",
    name: a.account_name || "",
    debit: a.debit || 0,
    credit: a.credit || 0,
  }),
  toBackend: () => ({}),
});

export const profitLossStore = makeBackendValueStore<ProfitLossData>({
  base: "/double-entry/profit-loss",
  paramsFrom: (v) => ({ from: v.from, to: v.to }),
  toFrontend: (payload) => {
    const d = payload?.data || payload || {};
    const rows = (arr: any[]): PLRow[] =>
      (arr || []).map((r) => ({ code: r.account_code || "", name: r.account_name || "", amount: r.balance || 0 }));
    return {
      from: d.from_date || "",
      to: d.to_date || "",
      revenue: rows(d.revenue),
      expenses: rows(d.expenses),
    };
  },
});

export const balanceSheetStore = makeBackendStore<BalanceSheetRec>({
  base: "/double-entry/balance-sheets",
  mutable: { create: true, update: false, remove: false },
  toFrontend: (d) => ({
    id: String(d._id),
    date: day(d.balance_sheet_date),
    year: d.financial_year || "",
    status: d.status === "finalized" ? "Finalized" : "Draft",
    notes: Array.isArray(d.notes) ? d.notes : [],
  }),
  toBackend: (b) => ({
    balance_sheet_date: b.date ? new Date(b.date).toISOString() : undefined,
    financial_year: b.year,
    status: (b.status || "Draft").toLowerCase(),
  }),
});

/* ── seeds: journal entries (references/double entry/report.png) ── */

const L = (code: string, name: string, description: string, debit: number, credit: number): JournalLine => ({
  code,
  name,
  description,
  debit,
  credit,
});

export const SEED_JOURNAL: JournalEntry[] = [
  {
    id: "je139",
    number: "JE-2026-139",
    date: "2026-07-07",
    reference: "expense",
    description: "Expense Entry - #EXP-2026-01-007",
    status: "Posted",
    lines: [
      L("5400", "Utilities Expense", "Expense incurred", 120.5, 0),
      L("1000", "Cash", "Payment made", 0, 120.5),
    ],
  },
  {
    id: "je138",
    number: "JE-2026-138",
    date: "2026-07-07",
    reference: "expense",
    description: "Expense Entry - #EXP-2026-01-006",
    status: "Posted",
    lines: [
      L("5320", "Marketing Expense", "Expense incurred", 850, 0),
      L("1010", "Bank Account - Main", "Payment made", 0, 850),
    ],
  },
  {
    id: "je137",
    number: "JE-2026-137",
    date: "2026-07-07",
    reference: "expense",
    description: "Expense Entry - #EXP-2026-01-009",
    status: "Posted",
    lines: [
      L("5300", "Rent Expense", "Expense incurred", 2500, 0),
      L("1000", "Cash", "Payment made", 0, 2500),
    ],
  },
  {
    id: "je136",
    number: "JE-2026-136",
    date: "2026-07-07",
    reference: "expense",
    description: "Expense Entry - #EXP-2026-07-001",
    status: "Posted",
    lines: [
      L("5500", "Interest Expense", "Expense incurred", 10000, 0),
      L("1000", "Cash", "Payment made", 0, 10000),
    ],
  },
  {
    id: "je134",
    number: "JE-2026-134",
    date: "2026-07-07",
    reference: "vendor_payment",
    description: "Vendor Payment #VP-2026-07-001",
    status: "Posted",
    lines: [
      L("2000", "Accounts Payable", "Payment to Sam Supplier", 14218.1, 0),
      L("1000", "Cash", "Payment from Business Checking Account", 0, 14218.1),
    ],
  },
  {
    id: "je133",
    number: "JE-2026-133",
    date: "2026-07-07",
    reference: "purchase_invoice",
    description: "Bill #BILL-2026-07-002",
    status: "Posted",
    lines: [
      L("1200", "Inventory", "Goods purchased", 9530, 0),
      L("1500", "Tax Receivable (VAT/GST Input)", "Input tax on purchase", 500, 0),
      L("2000", "Accounts Payable", "Payable to Sam Supplier", 0, 10030),
    ],
  },
  {
    id: "je132",
    number: "JE-2026-132",
    date: "2026-07-07",
    reference: "credit_note_cogs",
    description: "COGS Reversal for Credit Note #CN-2026-07-001",
    status: "Posted",
    lines: [
      L("1200", "Inventory", "Stock returned to inventory", 120, 0),
      L("5100", "Cost of Goods Sold", "COGS reversal", 0, 120),
    ],
  },
  {
    id: "je131",
    number: "JE-2026-131",
    date: "2026-07-07",
    reference: "credit_note",
    description: "Credit Note #CN-2026-07-001",
    status: "Posted",
    lines: [
      L("4100", "Sales Revenue", "Revenue reversal", 295, 0),
      L("1100", "Accounts Receivable", "Receivable reduced", 0, 295),
    ],
  },
  {
    id: "je130",
    number: "JE-2026-130",
    date: "2026-07-07",
    reference: "credit_note_cogs",
    description: "COGS Reversal for Credit Note #CN-2026-07-002",
    status: "Posted",
    lines: [
      L("1200", "Inventory", "Stock returned to inventory", 85, 0),
      L("5100", "Cost of Goods Sold", "COGS reversal", 0, 85),
    ],
  },
  {
    id: "je129",
    number: "JE-2026-129",
    date: "2026-07-07",
    reference: "credit_note",
    description: "Credit Note #CN-2026-07-002",
    status: "Posted",
    lines: [
      L("4100", "Sales Revenue", "Revenue reversal", 177, 0),
      L("1100", "Accounts Receivable", "Receivable reduced", 0, 177),
    ],
  },
  {
    id: "je128",
    number: "JE-2026-128",
    date: "2026-07-07",
    reference: "customer_payment",
    description: "Customer Payment #CP-2026-07-003",
    status: "Posted",
    lines: [
      L("1000", "Cash", "Payment received", 177, 0),
      L("1100", "Accounts Receivable", "Receivable settled", 0, 177),
    ],
  },
  {
    id: "je127",
    number: "JE-2026-127",
    date: "2026-07-07",
    reference: "sales_invoice_cogs",
    description: "COGS for Sales Invoice #SI-2026-07-004",
    status: "Posted",
    lines: [
      L("5100", "Cost of Goods Sold", "Cost of goods sold", 85, 0),
      L("1200", "Inventory", "Stock reduced", 0, 85),
    ],
  },
];

export const JOURNAL_REFERENCES = [
  "expense",
  "vendor_payment",
  "purchase_invoice",
  "credit_note",
  "credit_note_cogs",
  "customer_payment",
  "sales_invoice_cogs",
];

export const entryTotal = (e: JournalEntry) => e.lines.reduce((s, l) => s + l.debit, 0);

/** Ledger Summary rows — journal lines flattened (payment line first, per reference). */
export interface LedgerRow extends JournalLine {
  id: string;
  date: string;
  reference: string;
}
export const ledgerRows = (entries: JournalEntry[]): LedgerRow[] =>
  entries.flatMap((e) =>
    [...e.lines]
      .reverse()
      .map((l, i) => ({ ...l, id: `${e.id}-${i}`, date: e.date, reference: e.reference })),
  );

/* ── seeds: trial balance (references/double entry/trial balance.png)
   Totals come out to $599,901.01 debit vs $599,901.02 credit — the one-cent
   imbalance drives the reference's red warning banner. ── */

const T = (code: string, name: string, debit: number, credit: number): TrialRow => ({ code, name, debit, credit });

export const SEED_TRIAL_BALANCE: TrialRow[] = [
  T("1000", "Cash", 302303.38, 0),
  T("1005", "Petty Cash", 122351.91, 0),
  T("1010", "Bank Account - Main", 40538.94, 0),
  T("1020", "Bank Account - Savings", 0, 476526.65),
  T("1100", "Accounts Receivable", 7565.95, 0),
  T("1200", "Inventory", 15011.0, 0),
  T("1500", "Tax Receivable (VAT/GST Input)", 6935.55, 0),
  T("2000", "Accounts Payable", 0, 12753.95),
  T("2210", "VAT Payable (Sales Tax Output)", 0, 5657.41),
  T("4010", "Product Sales", 0, 450.0),
  T("4030", "Consulting Revenue", 0, 2400.0),
  T("4040", "Subscription Revenue", 0, 42.5),
  T("4100", "Sales Revenue", 0, 44930.51),
  T("4110", "Commission Income", 0, 890.0),
  T("4120", "Rental Income", 0, 2000.0),
  T("4130", "Maintenance Income", 0, 1200.0),
  T("4200", "Service Revenue", 0, 53050.0),
  T("5100", "Cost of Goods Sold", 11157.0, 0),
  T("5200", "Salaries Expense", 76209.78, 0),
  T("5300", "Rent Expense", 2500.0, 0),
  T("5310", "Office Supplies", 585.0, 0),
  T("5320", "Marketing Expense", 3350.0, 0),
  T("5330", "Travel Expense", 750.0, 0),
  T("5400", "Utilities Expense", 330.5, 0),
  T("5500", "Interest Expense", 10000.0, 0),
  T("5510", "Bank Charges", 312.0, 0),
];

/* ── seeds: profit & loss (references/double entry/profit loss.png) ── */

const P = (code: string, name: string, amount: number): PLRow => ({ code, name, amount });

export const SEED_PROFIT_LOSS: ProfitLossData = {
  from: "2026-01-01",
  to: "2026-12-31",
  revenue: [
    P("4100", "Sales Revenue", 44930.51),
    P("4010", "Product Sales", 450.0),
    P("4200", "Service Revenue", 53050.0),
    P("4030", "Consulting Revenue", 2400.0),
    P("4040", "Subscription Revenue", 42.5),
    P("4110", "Commission Income", 890.0),
    P("4120", "Rental Income", 2000.0),
    P("4130", "Maintenance Income", 1200.0),
  ],
  expenses: [
    P("5100", "Cost of Goods Sold", 11157.0),
    P("5200", "Salaries Expense", 76209.78),
    P("5300", "Rent Expense", 2500.0),
    P("5310", "Office Supplies", 585.0),
    P("5320", "Marketing Expense", 3350.0),
    P("5330", "Travel Expense", 750.0),
    P("5400", "Utilities Expense", 330.5),
    P("5500", "Interest Expense", 10000.0),
    P("5510", "Bank Charges", 312.0),
  ],
};

/* ── seeds: balance sheets (references/double entry/balance sheet.png)
   Sheet amounts are the fixed as-of dataset below; the generated sheets
   list records date / financial year / draft-finalized status / notes. ── */

export interface BsLine {
  code: string;
  name: string;
  amount: number;
}
export interface BsGroup {
  label: string;
  lines: BsLine[];
}

export const BS_ASSET_GROUPS: BsGroup[] = [
  {
    label: "Current Assets",
    lines: [
      { code: "1000", name: "Cash", amount: 328729.0 },
      { code: "1005", name: "Petty Cash", amount: 121847.72 },
      { code: "1010", name: "Bank Account - Main", amount: 41388.94 },
      { code: "1020", name: "Bank Account - Savings", amount: -476526.65 },
      { code: "1100", name: "Accounts Receivable", amount: 7909.26 },
      { code: "1200", name: "Inventory", amount: 5062.0 },
    ],
  },
  {
    label: "Other Assets",
    lines: [{ code: "1500", name: "Tax Receivable (VAT/GST Input)", amount: 4831.95 }],
  },
];

export const BS_LIABILITY_GROUPS: BsGroup[] = [
  {
    label: "Current Liabilities",
    lines: [
      { code: "2000", name: "Accounts Payable", amount: 13910.45 },
      { code: "2210", name: "VAT Payable (Sales Tax Output)", amount: 5353.48 },
    ],
  },
];

export const BS_EQUITY_LINES: BsLine[] = [{ code: "", name: "Retained Earnings", amount: 13978.29 }];

export const SEED_BALANCE_SHEETS: BalanceSheetRec[] = [
  { id: "bs1", date: "2026-12-31", year: "2026", status: "Draft", notes: [] },
];

export const deUid = () => "de" + Math.random().toString(36).slice(2, 8);
