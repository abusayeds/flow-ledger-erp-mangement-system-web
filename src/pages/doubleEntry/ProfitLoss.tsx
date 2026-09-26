/**
 * Profit & Loss — GET /double-entry/profit-loss?from_date&to_date
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { money } from "@/lib/db";
import { fetchProfitLoss, type PLRow } from "@/services/doubleEntry";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import { SummaryCard, DateField, ReportTitle, downloadTablePdf, yearDefaults } from "./deShared";
import { showToast } from "../../utils/toast";
import { Search, Download } from "lucide-react";

function PLColumn({ heading, rows, totalLabel, total }: { heading: string; rows: PLRow[]; totalLabel: string; total: number }) {
  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-2">{heading}</h4>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.id || r.code} className="flex items-center justify-between py-3">
            <p className="text-sm text-gray-900">
              <span className="text-blue-600 font-medium">{r.code}</span> - {r.name}
            </p>
            <p className="text-sm text-gray-900">{money(r.amount)}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-400 py-4">No accounts</p>}
      </div>
      <div className="flex items-center justify-between py-3.5 border-t border-gray-300 mt-2">
        <p className="text-sm font-semibold text-gray-900">{totalLabel}</p>
        <p className="text-sm font-semibold text-gray-900">{money(total)}</p>
      </div>
    </div>
  );
}

export const ProfitLoss: React.FC = () => {
  const navigate = useNavigate();
  const defaults = yearDefaults();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [applied, setApplied] = useState({ from: defaults.from, to: defaults.to });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["profit-loss", applied.from, applied.to],
    queryFn: () => fetchProfitLoss({ from_date: applied.from, to_date: applied.to }),
  });

  const revenue = data?.revenue ?? [];
  const expenses = data?.expenses ?? [];
  const totalRevenue = data?.totalRevenue ?? 0;
  const totalExpenses = data?.totalExpenses ?? 0;
  const net = data?.net ?? totalRevenue - totalExpenses;
  const isLoss = net < 0;

  const generate = async () => {
    setApplied({ from, to });
    await refetch();
    showToast("Profit & loss statement generated", "success");
  };

  const downloadPdf = () =>
    downloadTablePdf(
      "profit-loss.pdf",
      "Profit & Loss Statement",
      `${applied.from} - ${applied.to}`,
      ["Account", "Type", "Amount"],
      [
        ...revenue.map((r) => [`${r.code} - ${r.name}`, "Revenue", money(r.amount)]),
        ...expenses.map((r) => [`${r.code} - ${r.name}`, "Expense", money(r.amount)]),
        ["Total Revenue", "", money(totalRevenue)],
        ["Total Expenses", "", money(totalExpenses)],
        [isLoss ? "Net Loss" : "Net Profit", "", money(Math.abs(net))],
      ],
    );

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "Double Entry" }]} current="Profit & Loss" onNavigate={navigate} />
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Profit & Loss Statement</h2>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <ReportTitle title="Profit & Loss Statement" subtitle={`${applied.from} - ${applied.to}`} />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Revenue" value={money(totalRevenue)} tone="green" />
            <SummaryCard label="Total Expenses" value={money(totalExpenses)} tone="red" />
            <SummaryCard label={isLoss ? "Net Loss" : "Net Profit"} value={money(Math.abs(net))} tone={isLoss ? "orange" : "green"} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {isLoading ? (
            <p className="text-center text-gray-500 py-10">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                <PLColumn heading="Revenue" rows={revenue} totalLabel="Total Revenue" total={totalRevenue} />
                <PLColumn heading="Expenses" rows={expenses} totalLabel="Total Expenses" total={totalExpenses} />
              </div>
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-300">
                <p className="text-base font-semibold text-gray-900">{isLoss ? "Net Loss" : "Net Profit"}</p>
                <p className={`text-base font-bold ${isLoss ? "text-red-500" : "text-green-600"}`}>{money(Math.abs(net))}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;
