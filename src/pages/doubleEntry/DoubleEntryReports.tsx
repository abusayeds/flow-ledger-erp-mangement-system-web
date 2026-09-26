/**
 * Double Entry Reports — tabs call matching /double-entry/reports/* endpoints.
 */
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { doubleEntryReports, searchChartAccounts } from "@/services/doubleEntry";
import { HrmBreadcrumb, AsyncSearchSelect } from "../hrm/hrmShared";
import { chip } from "../goal/goalShared";
import { DateField, downloadTablePdf, deFieldCls, yearDefaults } from "./deShared";
import { showToast } from "../../utils/toast";
import { ChevronRight, Download } from "lucide-react";

const TABS = [
  "Journal Entry",
  "General Ledger",
  "Account Statement",
  "Account Balance",
  "Cash Flow",
  "Expense Report",
] as const;
type Tab = (typeof TABS)[number];

const th = "px-4 py-3 text-left text-xs font-medium text-gray-600";
const thRight = "px-4 py-3 text-right text-xs font-medium text-gray-600";
const td = "px-4 py-3.5 text-sm";
const amt = (n: number) => (n ? money(n) : "—");
const day = (v: unknown) => {
  if (!v) return "";
  const s = typeof v === "string" ? v : new Date(v as Date).toISOString();
  return s.slice(0, 10);
};

export const DoubleEntryReports: React.FC = () => {
  const navigate = useNavigate();
  const defaults = yearDefaults();

  const [tab, setTab] = useState<Tab>("Journal Entry");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [status, setStatus] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [asOf, setAsOf] = useState(defaults.to);
  const [applied, setApplied] = useState({
    from: defaults.from,
    to: defaults.to,
    status: "",
    accountId: "",
    asOf: defaults.to,
    tab: "Journal Entry" as Tab,
    nonce: 0,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const needsAccount = tab === "General Ledger" || tab === "Account Statement";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["de-reports", applied],
    queryFn: async () => {
      const p = {
        from_date: applied.from || undefined,
        to_date: applied.to || undefined,
        status: applied.status || undefined,
        account_id: applied.accountId || undefined,
        as_of_date: applied.asOf || undefined,
      };
      switch (applied.tab) {
        case "Journal Entry":
          return { kind: "journal" as const, data: await doubleEntryReports.journalEntry(p) };
        case "General Ledger":
          return { kind: "ledger" as const, data: await doubleEntryReports.generalLedger(p) };
        case "Account Statement":
          return { kind: "statement" as const, data: await doubleEntryReports.accountStatement(p) };
        case "Account Balance":
          return { kind: "balances" as const, data: await doubleEntryReports.accountBalance(p) };
        case "Cash Flow":
          return { kind: "cash" as const, data: await doubleEntryReports.cashFlow(p) };
        case "Expense Report":
          return { kind: "expense" as const, data: await doubleEntryReports.expenseReport(p) };
        default:
          return { kind: "journal" as const, data: null };
      }
    },
  });

  const journalEntries = useMemo(() => {
    if (data?.kind !== "journal") return [];
    return Array.isArray(data.data?.entries) ? data.data.entries : [];
  }, [data]);

  const ledgerTx = useMemo(() => {
    if (data?.kind !== "ledger" && data?.kind !== "statement") return [];
    const ledger = data.data?.ledger ?? data.data?.statement ?? data.data;
    return Array.isArray(ledger?.transactions) ? ledger.transactions : [];
  }, [data]);

  const ledgerMeta = useMemo(() => {
    if (data?.kind !== "ledger" && data?.kind !== "statement") return null;
    const ledger = data.data?.ledger ?? data.data?.statement ?? data.data;
    return ledger
      ? {
          opening: Number(ledger.opening_balance) || 0,
          closing: Number(ledger.closing_balance) || 0,
        }
      : null;
  }, [data]);

  const balanceGroups = useMemo(() => {
    if (data?.kind !== "balances") return [] as Array<{ type: string; accounts: any[]; subtotal_net: number }>;
    const grouped = data.data?.grouped ?? {};
    return Object.entries(grouped).map(([type, g]: [string, any]) => ({
      type,
      accounts: Array.isArray(g?.accounts) ? g.accounts : [],
      subtotal_net: Number(g?.subtotal_net) || 0,
    }));
  }, [data]);

  const cash = data?.kind === "cash" ? data.data : null;
  const expenses = data?.kind === "expense" ? (Array.isArray(data.data?.expenses) ? data.data.expenses : []) : [];
  const expenseTotal = data?.kind === "expense" ? Number(data.data?.total_expenses) || 0 : 0;

  const generate = () => {
    if (needsAccount && !accountId) {
      showToast("Select an account first", "info");
      return;
    }
    setApplied({
      from,
      to,
      status,
      accountId,
      asOf,
      tab,
      nonce: applied.nonce + 1,
    });
    showToast("Report generated", "success");
  };

  const clear = () => {
    setFrom(defaults.from);
    setTo(defaults.to);
    setStatus("");
    setAccountId("");
    setAccountName("");
    setAsOf(defaults.to);
    setApplied({
      from: defaults.from,
      to: defaults.to,
      status: "",
      accountId: "",
      asOf: defaults.to,
      tab,
      nonce: applied.nonce + 1,
    });
    showToast("Filters cleared", "info");
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const downloadPdf = () => {
    const subtitle = `${applied.from} - ${applied.to}`;
    if (tab === "Journal Entry") {
      void downloadTablePdf(
        "journal-entries.pdf",
        "Journal Entry Report",
        subtitle,
        ["Journal #", "Date", "Reference", "Description", "Total Debit", "Total Credit", "Status"],
        journalEntries.map((e: any) => [
          e.journal_number,
          day(e.date),
          e.reference_type,
          e.description,
          money(e.total_debit),
          money(e.total_credit),
          e.status,
        ]),
      );
    } else if (tab === "General Ledger" || tab === "Account Statement") {
      void downloadTablePdf(
        "ledger.pdf",
        tab,
        subtitle,
        ["Date", "Description", "Debit", "Credit", "Balance"],
        ledgerTx.map((t: any) => [day(t.date), t.description, amt(t.debit), amt(t.credit), money(t.balance)]),
      );
    } else if (tab === "Account Balance") {
      const rows: (string | number)[][] = [];
      for (const g of balanceGroups) {
        for (const a of g.accounts) rows.push([g.type, a.account_code, a.account_name, money(a.net_balance)]);
      }
      void downloadTablePdf("account-balance.pdf", "Account Balance", applied.asOf, ["Type", "Code", "Name", "Balance"], rows);
    } else if (tab === "Cash Flow") {
      void downloadTablePdf(
        "cash-flow.pdf",
        "Cash Flow",
        subtitle,
        ["Item", "Amount"],
        [
          ["Beginning Cash", money(cash?.beginning_cash)],
          ["Operating", money(cash?.operating)],
          ["Investing", money(cash?.investing)],
          ["Financing", money(cash?.financing)],
          ["Net Cash Flow", money(cash?.net_cash_flow)],
          ["Ending Cash", money(cash?.ending_cash)],
        ],
      );
    } else {
      void downloadTablePdf(
        "expense-report.pdf",
        "Expense Report",
        subtitle,
        ["Code", "Account", "Amount"],
        [...expenses.map((e: any) => [e.account_code, e.account_name, money(e.amount)]), ["", "Total", money(expenseTotal)]],
      );
    }
  };

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "Double Entry" }]} current="Reports" onNavigate={navigate} />
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
      </div>

      <div className="p-4 sm:p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 pt-4">
            <div className="bg-gray-100 rounded-lg p-1 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setApplied((a) => ({ ...a, tab: t, nonce: a.nonce + 1 }));
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap ${
                    tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-4 flex items-end gap-3 flex-wrap">
            {tab !== "Account Balance" && (
              <>
                <DateField label="From Date" value={from} onChange={setFrom} />
                <DateField label="To Date" value={to} onChange={setTo} />
              </>
            )}
            {tab === "Account Balance" && <DateField label="As of Date" value={asOf} onChange={setAsOf} />}
            {tab === "Journal Entry" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${deFieldCls} min-w-40`}>
                  <option value="">All Status</option>
                  <option value="posted">Posted</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            )}
            {needsAccount && (
              <div className="w-full sm:w-72">
                <label className="block text-xs font-medium text-gray-500 mb-1">Account *</label>
                <AsyncSearchSelect
                  value={accountId}
                  displayName={accountName}
                  onChange={(id, opt) => {
                    setAccountId(id);
                    setAccountName(opt?.name || "");
                  }}
                  onSearch={searchChartAccounts}
                  placeholder="Search account…"
                />
              </div>
            )}
            <button
              onClick={generate}
              disabled={isFetching}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isFetching ? "Generating…" : "Generate"}
            </button>
            <button onClick={clear} className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50">
              Clear
            </button>
            <button onClick={downloadPdf} className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          <div className="overflow-x-auto border-t border-gray-100">
            {isLoading && <p className="px-4 py-12 text-center text-sm text-gray-500">Loading…</p>}

            {!isLoading && tab === "Journal Entry" && (
              <table className="w-full min-w-[980px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-10" />
                    <th className={th}>Journal #</th>
                    <th className={th}>Date</th>
                    <th className={th}>Reference</th>
                    <th className={th}>Description</th>
                    <th className={thRight}>Total Debit</th>
                    <th className={thRight}>Total Credit</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {journalEntries.map((e: any) => {
                    const id = String(e._id);
                    const open = expanded.has(id);
                    return (
                      <React.Fragment key={id}>
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggle(id)}>
                          <td className="px-2 text-center">
                            <ChevronRight className={`w-4 h-4 text-gray-400 inline transition-transform ${open ? "rotate-90" : ""}`} />
                          </td>
                          <td className={`${td} text-blue-600 font-medium`}>{e.journal_number}</td>
                          <td className={`${td} text-gray-600`}>{day(e.date)}</td>
                          <td className={`${td} text-gray-600`}>{e.reference_type || "—"}</td>
                          <td className={`${td} text-gray-900`}>{e.description || "—"}</td>
                          <td className={`${td} text-right`}>{money(e.total_debit)}</td>
                          <td className={`${td} text-right`}>{money(e.total_credit)}</td>
                          <td className={td}>{chip(String(e.status || "").replace(/^\w/, (c: string) => c.toUpperCase()), e.status === "posted" ? "bg-green-100 text-green-700" : "bg-gray-600 text-white")}</td>
                        </tr>
                        {open &&
                          (e.items || []).map((item: any, i: number) => (
                            <tr key={`${id}-${i}`} className="bg-gray-50/80">
                              <td />
                              <td className={`${td} text-gray-400`} colSpan={2}>
                                <span className="text-blue-600 font-medium">{item.account_code}</span> {item.account_name}
                              </td>
                              <td className={`${td} text-gray-500`} colSpan={2}>
                                {item.description || "—"}
                              </td>
                              <td className={`${td} text-right`}>{amt(item.debit)}</td>
                              <td className={`${td} text-right`}>{amt(item.credit)}</td>
                              <td />
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
                  {journalEntries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500">
                        No journal entries in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {!isLoading && (tab === "General Ledger" || tab === "Account Statement") && (
              <div>
                {ledgerMeta && (
                  <div className="px-4 py-3 text-sm text-gray-600 flex gap-6 border-b border-gray-100">
                    <span>
                      Opening: <strong className="text-gray-900">{money(ledgerMeta.opening)}</strong>
                    </span>
                    <span>
                      Closing: <strong className="text-gray-900">{money(ledgerMeta.closing)}</strong>
                    </span>
                  </div>
                )}
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className={th}>Date</th>
                      <th className={th}>Reference</th>
                      <th className={th}>Description</th>
                      <th className={thRight}>Debit</th>
                      <th className={thRight}>Credit</th>
                      <th className={thRight}>Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ledgerTx.map((t: any, i: number) => (
                      <tr key={String(t._id || i)} className="hover:bg-gray-50">
                        <td className={`${td} text-gray-600`}>{day(t.date)}</td>
                        <td className={`${td} text-gray-600`}>{t.reference_type || "—"}</td>
                        <td className={`${td} text-gray-900`}>{t.description || "—"}</td>
                        <td className={`${td} text-right`}>{amt(t.debit)}</td>
                        <td className={`${td} text-right`}>{amt(t.credit)}</td>
                        <td className={`${td} text-right font-medium`}>{money(t.balance)}</td>
                      </tr>
                    ))}
                    {ledgerTx.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                          {needsAccount && !applied.accountId ? "Select an account and Generate." : "No transactions."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!isLoading && tab === "Account Balance" && (
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className={th}>Type</th>
                    <th className={th}>Account Code</th>
                    <th className={th}>Account Name</th>
                    <th className={thRight}>Debit</th>
                    <th className={thRight}>Credit</th>
                    <th className={thRight}>Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {balanceGroups.flatMap((g) =>
                    g.accounts.map((a: any) => (
                      <tr key={`${g.type}-${a.account_code}`} className="hover:bg-gray-50">
                        <td className={`${td} text-gray-500`}>{g.type}</td>
                        <td className={`${td} text-blue-600 font-medium`}>{a.account_code}</td>
                        <td className={`${td} text-gray-900`}>{a.account_name}</td>
                        <td className={`${td} text-right`}>{amt(a.debit)}</td>
                        <td className={`${td} text-right`}>{amt(a.credit)}</td>
                        <td className={`${td} text-right font-medium`}>{money(a.net_balance)}</td>
                      </tr>
                    )),
                  )}
                  {balanceGroups.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                        No balances.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {!isLoading && tab === "Cash Flow" && (
              <div className="p-6 space-y-3 max-w-lg">
                {[
                  ["Beginning Cash", cash?.beginning_cash],
                  ["Operating", cash?.operating],
                  ["Investing", cash?.investing],
                  ["Financing", cash?.financing],
                  ["Net Cash Flow", cash?.net_cash_flow],
                  ["Ending Cash", cash?.ending_cash],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="text-sm font-semibold text-gray-900">{money(Number(value) || 0)}</span>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && tab === "Expense Report" && (
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className={th}>Account Code</th>
                    <th className={th}>Account Name</th>
                    <th className={thRight}>Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((e: any) => (
                    <tr key={e.account_code} className="hover:bg-gray-50">
                      <td className={`${td} text-blue-600 font-medium`}>{e.account_code}</td>
                      <td className={`${td} text-gray-900`}>{e.account_name}</td>
                      <td className={`${td} text-right`}>{money(e.amount)}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm text-gray-500">
                        No expenses in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className={td} />
                    <td className={`${td} font-semibold`}>Total</td>
                    <td className={`${td} text-right font-semibold`}>{money(expenseTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoubleEntryReports;
