/**
 * Ledger Summary — GET /double-entry/ledger-summary (search + pagination)
 */
import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { fetchLedgerSummary, searchChartAccounts } from "@/services/doubleEntry";
import { AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell } from "../goal/goalShared";
import { DateField, yearDefaults } from "./deShared";
import { ArrowUpDown } from "lucide-react";

export const LedgerSummary: React.FC = () => {
  const defaults = yearDefaults();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ledger-summary", page, perPage, search, from, to, accountId, sortAsc],
    queryFn: () =>
      fetchLedgerSummary({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        from_date: from || undefined,
        to_date: to || undefined,
        account_id: accountId || undefined,
        sort: sortAsc ? "journal_date,_id" : "-journal_date,-_id",
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const amt = (n: number) => (n ? money(n) : "—");

  return (
    <ListShell
      module="Double Entry"
      current="Ledger Summary"
      title="Ledger Summary"
      search={searchInput}
      setSearch={setSearchInput}
      searchPlaceholder="Search account, reference, description..."
      perPage={perPage}
      setPerPage={setPerPage}
      page={page}
      setPage={setPage}
      total={total}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-end gap-3">
        <DateField
          label="From Date"
          value={from}
          onChange={(v) => {
            setFrom(v);
            setPage(1);
          }}
        />
        <DateField
          label="To Date"
          value={to}
          onChange={(v) => {
            setTo(v);
            setPage(1);
          }}
        />
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
          <AsyncSearchSelect
            value={accountId}
            displayName={accountName}
            onChange={(id, opt) => {
              setAccountId(id);
              setAccountName(opt?.name || "");
              setPage(1);
            }}
            onSearch={searchChartAccounts}
            placeholder="All accounts…"
          />
        </div>
        {isFetching && <span className="text-xs text-gray-400 pb-2">Refreshing…</span>}
      </div>

      <table className="w-full text-sm min-w-[980px]">
        <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
              <button
                type="button"
                onClick={() => {
                  setSortAsc(!sortAsc);
                  setPage(1);
                }}
                className="flex items-center gap-1 hover:text-gray-900"
              >
                Date <ArrowUpDown className="w-3 h-3" />
              </button>
            </th>
            {["Account Code", "Account Name", "Reference", "Description", "Debit", "Credit"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3.5 text-gray-600">{r.date}</td>
              <td className="px-4 py-3.5 text-gray-900">{r.code}</td>
              <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
              <td className="px-4 py-3.5 text-gray-600">{r.reference || "—"}</td>
              <td className="px-4 py-3.5 text-gray-600">{r.description || "—"}</td>
              <td className="px-4 py-3.5 text-gray-900">{amt(r.debit)}</td>
              <td className="px-4 py-3.5 text-gray-900">{amt(r.credit)}</td>
            </tr>
          ))}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                No ledger entries found.
              </td>
            </tr>
          )}
          {isLoading && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ListShell>
  );
};

export default LedgerSummary;
