/**
 * Trial Balance — GET /double-entry/trial-balance?from_date&to_date
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { fetchTrialBalance } from "@/services/doubleEntry";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import { SummaryCard, DateField, ReportTitle, downloadTablePdf, yearDefaults } from "./deShared";
import { showToast } from "../../utils/toast";
import { Search, Download, AlertTriangle } from "lucide-react";

export const TrialBalance: React.FC = () => {
  const navigate = useNavigate();
  const defaults = yearDefaults();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [applied, setApplied] = useState({ from: defaults.from, to: defaults.to });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["trial-balance", applied.from, applied.to],
    queryFn: () => fetchTrialBalance({ from_date: applied.from, to_date: applied.to }),
  });

  const list = data?.accounts ?? [];
  const totalDebit = data?.totalDebit ?? 0;
  const totalCredit = data?.totalCredit ?? 0;
  const balanced = data?.balanced ?? true;
  const amt = (n: number) => (n ? money(n) : "—");

  const generate = async () => {
    setApplied({ from, to });
    await refetch();
    showToast("Trial balance generated", "success");
  };

  const downloadPdf = () =>
    downloadTablePdf(
      "trial-balance.pdf",
      "Trial Balance",
      `${applied.from} - ${applied.to}`,
      ["Account Code", "Account Name", "Debit", "Credit"],
      [...list.map((r) => [r.code, r.name, amt(r.debit), amt(r.credit)]), ["", "Total", money(totalDebit), money(totalCredit)]],
    );

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "Double Entry" }]} current="Trial Balance" onNavigate={navigate} />
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Trial Balance</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <ReportTitle title="Trial Balance" subtitle={`${applied.from} - ${applied.to}`} />
            <div className="flex items-end gap-3 flex-wrap">
              <DateField label="From Date" value={from} onChange={setFrom} />
              <DateField label="To Date" value={to} onChange={setTo} />
              <button
                onClick={() => void generate()}
                disabled={isFetching}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Search className="w-4 h-4" /> {isFetching ? "Generating…" : "Generate"}
              </button>
              <button
                onClick={downloadPdf}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SummaryCard label="Total Debit" value={money(totalDebit)} tone="green" />
            <SummaryCard label="Total Credit" value={money(totalCredit)} tone="blue" />
          </div>

          {!balanced && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm font-medium text-red-600">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Warning: Trial balance is not balanced!
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900">Account Code</th>
                  <th className="px-6 py-3.5 text-left text-sm font-semibold text-gray-900">Account Name</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-gray-900">Debit</th>
                  <th className="px-6 py-3.5 text-right text-sm font-semibold text-gray-900">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((r) => (
                  <tr key={r.id || r.code} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 text-blue-600 font-medium">{r.code}</td>
                    <td className="px-6 py-3.5 text-gray-900">{r.name}</td>
                    <td className="px-6 py-3.5 text-right text-gray-900">{amt(r.debit)}</td>
                    <td className="px-6 py-3.5 text-right text-gray-900">{amt(r.credit)}</td>
                  </tr>
                ))}
                {!isLoading && list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No balances in this period. Click Generate.
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-6 py-3.5" />
                  <td className="px-6 py-3.5 font-semibold text-gray-900">Total</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{money(totalDebit)}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{money(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBalance;
