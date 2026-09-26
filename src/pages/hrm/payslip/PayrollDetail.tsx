/**
 * File: src/pages/hrm/payslip/PayrollDetail.tsx
 * Payroll Details — matches the ERPGO reference
 * (references/hrm/payroll/payroll details.png + view payslip.png) in the
 * Qayd blue theme: header card, stat tiles, employee salary breakdown table,
 * payslip modal and jsPDF download. Pay rows load from GET /hrm/payroll/:id.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { money } from "@/lib/db";
import { usePayrolls, type PayrollRecord } from "@/lib/db/hrm";
import { payrollApi } from "@/services/hrm";
import { Chip, HrmBreadcrumb } from "../hrmShared";
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  Calculator,
  CreditCard,
  Download,
  Eye,
  Trash2,
  X,
  User,
  CalendarDays,
} from "lucide-react";

interface BreakdownLine {
  name: string;
  amount: number;
}

export interface PayrollEntryRow {
  entryId: string;
  employeeUserId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  basic: number;
  allowances: number;
  manualOT: number;
  attendanceOT: number;
  deductions: number;
  loans: number;
  gross: number;
  net: number;
  isPaid: boolean;
  workingDays: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  paidLeaveDays: number;
  allowancesBreakdown: BreakdownLine[];
  deductionsBreakdown: BreakdownLine[];
}

function mapEntry(raw: Record<string, unknown>): PayrollEntryRow {
  const emp = raw.employee_id as Record<string, unknown> | string | undefined;
  const name =
    typeof emp === "object" && emp ? String(emp.name ?? "") : "";
  const email =
    typeof emp === "object" && emp ? String(emp.email ?? "") : "";
  const employeeUserId =
    typeof emp === "object" && emp
      ? String(emp._id ?? emp.id ?? "")
      : emp
        ? String(emp)
        : "";

  const mapBreakdown = (rows: unknown): BreakdownLine[] => {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        name: String(o.name ?? o.title ?? o.type ?? "Item"),
        amount: Number(o.amount ?? o.value ?? 0),
      };
    });
  };

  return {
    entryId: String(raw._id ?? raw.id ?? ""),
    employeeUserId,
    name,
    email,
    department: "",
    designation: "",
    basic: Number(raw.basic_salary ?? 0),
    allowances: Number(raw.total_allowances ?? 0),
    manualOT: Number(raw.total_manual_overtimes ?? 0),
    attendanceOT: Number(raw.attendance_overtime_amount ?? 0),
    deductions: Number(raw.total_deductions ?? 0),
    loans: Number(raw.total_loans ?? 0),
    gross: Number(raw.gross_pay ?? 0),
    net: Number(raw.net_pay ?? 0),
    isPaid: String(raw.status ?? "").toLowerCase() === "paid",
    workingDays: Number(raw.working_days ?? 0),
    presentDays: Number(raw.present_days ?? 0),
    halfDays: Number(raw.half_days ?? 0),
    absentDays: Number(raw.absent_days ?? 0),
    paidLeaveDays: Number(raw.paid_leave_days ?? 0),
    allowancesBreakdown: mapBreakdown(raw.allowances_breakdown),
    deductionsBreakdown: mapBreakdown(raw.deductions_breakdown),
  };
}

async function downloadPayslip(payroll: PayrollRecord, row: PayrollEntryRow) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 18;
  const line = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.text(label, 20, y);
    doc.text(value, 190, y, { align: "right" });
    y += 7;
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Payslip", 105, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${payroll.title} · ${payroll.periodStart} - ${payroll.periodEnd}`, 105, y, { align: "center" });
  y += 12;
  line("Employee", `${row.name}`);
  if (row.email) line("Email", row.email);
  line("Pay Date", payroll.payDate);
  y += 4;
  doc.setDrawColor(200);
  doc.line(20, y, 190, y);
  y += 8;
  line("Basic Salary", money(row.basic));
  for (const a of row.allowancesBreakdown) {
    line(`  ${a.name}`, money(a.amount));
  }
  if (row.allowancesBreakdown.length === 0 && row.allowances > 0) {
    line("  Allowances", money(row.allowances));
  }
  line("Gross Pay", money(row.gross), true);
  y += 4;
  for (const d of row.deductionsBreakdown) {
    line(`  ${d.name}`, "-" + money(d.amount));
  }
  if (row.loans > 0) line("  Loan Repayments", "-" + money(row.loans));
  y += 4;
  doc.line(20, y, 190, y);
  y += 8;
  line("Net Pay", money(row.net), true);
  doc.save(`payslip-${row.employeeUserId || row.entryId}.pdf`);
}

const PayrollDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const payrolls = usePayrolls();
  const payroll = (payrolls || []).find((p) => p.id === id);

  const [rows, setRows] = useState<PayrollEntryRow[] | undefined>(undefined);
  const [payslip, setPayslip] = useState<PayrollEntryRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PayrollEntryRow | null>(null);

  const loadEntries = useCallback(async () => {
    if (!id) return;
    try {
      const data = await payrollApi.get(id);
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      setRows(entries.map((e) => mapEntry(e as Record<string, unknown>)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't load payroll entries";
      showToast(msg, "error");
      setRows([]);
    }
  }, [id]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  if (payrolls !== undefined && !payroll) {
    return (
      <div className="flex-1 bg-[#FAFBFC] flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>Payroll not found.</p>
        <button onClick={() => navigate("/hrm/payslip/payroll")} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">
          Back to Payrolls
        </button>
      </div>
    );
  }
  if (!payroll) return null;

  const gross = (rows || []).reduce((s, r) => s + r.gross, 0);
  const dedu = (rows || []).reduce((s, r) => s + r.deductions + r.loans, 0);
  const net = (rows || []).reduce((s, r) => s + r.net, 0);

  const markPaid = async (row: PayrollEntryRow) => {
    if (row.isPaid) {
      showToast("Already marked as paid", "info");
      return;
    }
    try {
      await payrollApi.payPayslip(row.entryId);
      await loadEntries();
      showToast(`Marked ${row.name} as paid`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't mark as paid";
      showToast(msg, "error");
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await payrollApi.deletePayslip(removeTarget.entryId);
      await loadEntries();
      showToast(`${removeTarget.name} removed from this payroll`, "success");
      setRemoveTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't remove entry";
      showToast(msg, "error");
    }
  };

  const statCards = [
    { label: "Employees", value: String((rows || []).length), icon: Users, cls: "bg-blue-50 border-blue-100", iconCls: "text-blue-600 bg-blue-100", valueCls: "text-blue-700" },
    { label: "Gross Pay", value: money(gross), icon: DollarSign, cls: "bg-green-50 border-green-100", iconCls: "text-green-600 bg-green-100", valueCls: "text-green-700" },
    { label: "Deductions", value: money(dedu), icon: Calculator, cls: "bg-red-50 border-red-100", iconCls: "text-red-500 bg-red-100", valueCls: "text-red-600" },
    { label: "Net Pay", value: money(net), icon: DollarSign, cls: "bg-purple-50 border-purple-100", iconCls: "text-purple-600 bg-purple-100", valueCls: "text-purple-700" },
  ];

  const th = "px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap";

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb
        trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }, { label: "Payrolls", to: "/hrm/payslip/payroll" }]}
        current={payroll.title}
        onNavigate={navigate}
      />

      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Payroll Details</h2>
        <button
          onClick={() => navigate("/hrm/payslip/payroll")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="px-4 sm:px-6 pb-8 space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{payroll.title}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-0.5">
                  <span>{payroll.periodStart} - {payroll.periodEnd}</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Pay Date: <span className="text-gray-700">{payroll.payDate}</span>
                  </span>
                  <span>
                    Frequency: <span className="text-gray-700">{payroll.frequency}</span>
                  </span>
                </div>
              </div>
            </div>
            <Chip label={payroll.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((c) => (
              <div key={c.label} className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${c.cls}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.iconCls}`}>
                  <c.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className={`text-lg font-bold truncate ${c.valueCls}`}>{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Employee Salary Details</h3>
              <p className="text-xs text-gray-500">Detailed breakdown of employee salaries and deductions</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <th className={th}>Employee</th>
                  <th className={th}>Basic Salary</th>
                  <th className={th}>Allowances</th>
                  <th className={th}>Manual OT</th>
                  <th className={th}>Attendance OT</th>
                  <th className={th}>Deductions</th>
                  <th className={th}>Loans</th>
                  <th className={th}>Gross Pay</th>
                  <th className={th}>Net Pay</th>
                  <th className={th}>Status</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(rows || []).map((r) => (
                  <tr key={r.entryId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{money(r.basic)}</td>
                    <td className="px-4 py-3 text-gray-700">{money(r.allowances)}</td>
                    <td className="px-4 py-3 text-gray-500">{money(r.manualOT)}</td>
                    <td className="px-4 py-3 text-gray-500">{money(r.attendanceOT)}</td>
                    <td className="px-4 py-3 text-gray-700">{money(r.deductions)}</td>
                    <td className="px-4 py-3 text-gray-700">{money(r.loans)}</td>
                    <td className="px-4 py-3 font-medium text-green-600">{money(r.gross)}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{money(r.net)}</td>
                    <td className="px-4 py-3"><Chip label={r.isPaid ? "Paid" : "Unpaid"} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => markPaid(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Mark as paid">
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button onClick={() => downloadPayslip(payroll, r)} className="p-1.5 text-gray-400 hover:text-orange-500 rounded hover:bg-orange-50" title="Download payslip">
                          <Download className="w-4 h-4" />
                        </button>
                        <button onClick={() => setPayslip(r)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View payslip">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setRemoveTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Remove from payroll">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows !== undefined && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      No employees in this payroll.
                    </td>
                  </tr>
                )}
                {rows === undefined && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      Loading payroll entries…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {payslip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Payslip - {payslip.name}</h3>
              </div>
              <button onClick={() => setPayslip(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              <div className="border border-gray-200 rounded-lg px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{payslip.name}</p>
                  <p className="text-sm text-gray-500">{payslip.email || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{payroll.title}</p>
                  <p className="text-sm text-gray-500">{payroll.periodStart} - {payroll.periodEnd}</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-5 h-5 text-gray-600" />
                  <h4 className="text-base font-semibold text-gray-900">Attendance Summary</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(
                    [
                      ["Working Days", String(payslip.workingDays), "bg-blue-50 text-blue-700"],
                      ["Present Days", payslip.presentDays.toFixed(2), "bg-green-50 text-green-700"],
                      ["Half Days", payslip.halfDays.toFixed(2), "bg-yellow-50 text-yellow-700"],
                      ["Absent Days", payslip.absentDays.toFixed(2), "bg-red-50 text-red-600"],
                      ["Manual OT Hours", "—", "bg-purple-50 text-purple-700"],
                      ["Paid Leave Days", payslip.paidLeaveDays.toFixed(2), "bg-blue-50 text-blue-700"],
                    ] as const
                  ).map(([label, value, cls]) => (
                    <div key={label} className={`rounded-lg px-3 py-3 text-center ${cls.split(" ")[0]}`}>
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className={`text-lg font-bold ${cls.split(" ")[1]}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <h4 className="text-base font-semibold text-green-600">Earnings</h4>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-700">Basic Salary</span>
                  <span className="font-semibold text-gray-900">{money(payslip.basic)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-700">Allowances</span>
                  <span className="font-semibold text-gray-900">{money(payslip.allowances)}</span>
                </div>
                <div className="pl-4 space-y-1 pb-2">
                  {payslip.allowancesBreakdown.map((a) => (
                    <div key={a.name} className="flex justify-between text-sm text-gray-500">
                      <span>• {a.name}</span>
                      <span>{money(a.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between py-2 border-t border-gray-100 text-sm">
                  <span className="font-medium text-gray-900">Gross Pay</span>
                  <span className="font-bold text-green-600">{money(payslip.gross)}</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-5 h-5 text-red-500" />
                  <h4 className="text-base font-semibold text-red-500">Deductions</h4>
                </div>
                <div className="pl-1 space-y-1 pb-2">
                  {payslip.deductionsBreakdown.map((d) => (
                    <div key={d.name} className="flex justify-between text-sm text-gray-500">
                      <span>• {d.name}</span>
                      <span>-{money(d.amount)}</span>
                    </div>
                  ))}
                  {payslip.loans > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>• Loan Repayments</span>
                      <span>-{money(payslip.loans)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between py-2 border-t border-gray-100 text-sm">
                  <span className="font-medium text-gray-900">Total Deductions</span>
                  <span className="font-bold text-red-500">-{money(payslip.deductions + payslip.loans)}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-4 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Net Pay</span>
                <span className="text-xl font-bold text-blue-700">{money(payslip.net)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setPayslip(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
                Close
              </button>
              <button
                onClick={() => downloadPayslip(payroll, payslip)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Remove from payroll?</h3>
              <p className="text-sm text-gray-500 mb-5">
                <span className="font-medium text-gray-700">{removeTarget.name}</span> will be excluded from this payroll run only.
              </p>
              <div className="flex gap-3">
                <button onClick={confirmRemove} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  Remove
                </button>
                <button onClick={() => setRemoveTarget(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollDetail;
