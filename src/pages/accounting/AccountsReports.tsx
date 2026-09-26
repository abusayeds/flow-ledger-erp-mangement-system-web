/**
 * Accounting Reports — /api/v1/account/reports/*
 */
import React, { useState } from "react";
import { showToast } from "../../utils/toast";
import { fetchAccountReport } from "@/services/accountingApi";
import { Field, inputCls, selectCls } from "../hrm/hrmShared";
import { HrmBreadcrumb } from "../hrm/hrmShared";
import { useNavigate } from "react-router-dom";
import { FileBarChart, Loader2, RefreshCw, Clock, Receipt, Users, Building2, Calculator } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

type ParamKind = "as_of_date" | "date_range" | "as_of_zero" | "none";

const REPORTS = [
  { key: "hub", label: "Summary Hub", path: "/account/reports/", params: "none" as ParamKind, icon: FileBarChart },
  { key: "invoice-aging", label: "Invoice Aging", path: "/account/reports/invoice-aging", params: "as_of_date" as ParamKind, icon: Clock },
  { key: "bill-aging", label: "Bill Aging", path: "/account/reports/bill-aging", params: "as_of_date" as ParamKind, icon: Receipt },
  { key: "tax-summary", label: "Tax Summary", path: "/account/reports/tax-summary", params: "date_range" as ParamKind, icon: Calculator },
  { key: "customer-balance", label: "Customer Balance", path: "/account/reports/customer-balance", params: "as_of_zero" as ParamKind, icon: Users },
  { key: "vendor-balance", label: "Vendor Balance", path: "/account/reports/vendor-balance", params: "as_of_zero" as ParamKind, icon: Building2 },
];

const today = () => new Date().toISOString().slice(0, 10);
const prettyKey = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtCell = (v: any): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return Array.isArray(v) ? `${v.length} item(s)` : "{…}";
  return String(v);
};

const ResultView: React.FC<{ data: any }> = ({ data }) => {
  if (data == null) return <p className="text-sm text-gray-500">No data.</p>;
  if (Array.isArray(data)) {
    if (!data.length) return <p className="text-sm text-gray-500">No rows.</p>;
    if (typeof data[0] !== "object") {
      return <ul className="list-disc pl-5 text-sm space-y-1">{data.map((v, i) => <li key={i}>{fmtCell(v)}</li>)}</ul>;
    }
    const columns = Array.from(new Set(data.flatMap((r) => Object.keys(r))));
    return (
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{columns.map((c) => <th key={c} className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">{prettyKey(c)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((c) => <td key={c} className="px-3 py-2 text-gray-800 whitespace-nowrap">{fmtCell(row[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (typeof data === "object") {
    if (Array.isArray(data.rows) && Array.isArray(data.columns)) {
      return <ResultView data={data.rows} />;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="border border-gray-200 rounded-lg px-3 py-2">
            <div className="text-xs text-gray-500">{prettyKey(k)}</div>
            <div className="text-sm text-gray-900 mt-0.5">{fmtCell(v)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm text-gray-800">{fmtCell(data)}</p>;
};

export const AccountsReports: React.FC = () => {
  const navigate = useNavigate();
  const [reportKey, setReportKey] = useState("invoice-aging");
  const [asOf, setAsOf] = useState(today());
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [showZero, setShowZero] = useState("false");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const def = REPORTS.find((r) => r.key === reportKey) || REPORTS[1];

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const params: Record<string, unknown> = {};
      if (def.params === "as_of_date" || def.params === "as_of_zero") params.as_of_date = asOf;
      if (def.params === "date_range") {
        params.from_date = fromDate;
        params.to_date = toDate;
      }
      if (def.params === "as_of_zero") params.show_zero_balances = showZero;
      const data = await fetchAccountReport(def.path, params);
      setResult(data);
    } catch (e: any) {
      showToast(e?.message || "Report failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-page-shell flex flex-col overflow-hidden p-0">
      <HrmBreadcrumb trail={[{ label: "Dashboard", to: "/" }, { label: "Accounting" }]} current="Reports" onNavigate={navigate} />
      <div className="module-title-bar px-4 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">Accounting Reports</h2>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Report">
            <select value={reportKey} onChange={(e) => setReportKey(e.target.value)} className={selectCls}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </Field>
          {(def.params === "as_of_date" || def.params === "as_of_zero") && (
            <Field label="As of date">
              <AppDatePicker value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputCls} />
            </Field>
          )}
          {def.params === "date_range" && (
            <>
              <Field label="From"><AppDatePicker value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} /></Field>
              <Field label="To"><AppDatePicker value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} /></Field>
            </>
          )}
          {def.params === "as_of_zero" && (
            <Field label="Show zero balances">
              <select value={showZero} onChange={(e) => setShowZero(e.target.value)} className={selectCls}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
          )}
        </div>
        <button type="button" onClick={() => void run()} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Report
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading && <p className="text-sm text-gray-500">Running…</p>}
        {!loading && result != null && <ResultView data={result} />}
        {!loading && result == null && <p className="text-sm text-gray-500">Choose a report and click Run.</p>}
      </div>
    </div>
  );
};
