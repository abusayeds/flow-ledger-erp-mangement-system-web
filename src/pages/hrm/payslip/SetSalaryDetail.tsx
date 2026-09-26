/**
 * File: src/pages/hrm/payslip/SetSalaryDetail.tsx
 * Employee Salary Details — matches the ERPGO reference
 * (references/hrm/set salary/set salary detail page.png + add allowance /
 * deduction / loan / overtime modals) in the Qayd blue theme.
 * Salary components load and persist via HRM payroll APIs.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { showToast } from "../../../utils/toast";
import { money } from "@/lib/db";
import { useEmployees, employeeBackendId } from "@/lib/db/hrm";
import {
  payrollApi,
  allowanceTypeHooks,
  deductionTypeHooks,
  loanTypeHooks,
} from "@/services/hrm";
import { Avatar, Chip, Field, inputCls, IdSearchSelect, HrmBreadcrumb, apiLabel } from "../hrmShared";
import {
  ArrowLeft,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Eye,
  X,
  Pencil,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const LIST_PARAMS = { page: 1, limit: 100 };

type AmountKind = "Fixed" | "Percentage";

interface SalaryComponentRow {
  id: string;
  name: string;
  type: AmountKind | string;
  amount: number;
  typeId: string;
}

interface SalaryLoanRow {
  id: string;
  title: string;
  loanType: string;
  loanTypeId: string;
  type: AmountKind | string;
  amount: number;
  startDate: string;
  endDate: string;
  reason: string;
}

interface SalaryOvertimeRow {
  id: string;
  title: string;
  days: number;
  hours: number;
  rate: number;
  startDate: string;
  endDate: string;
  status: string;
  notes: string;
}

interface SalaryView {
  employee: {
    name: string;
    employeeId: string;
    branch: string;
    department: string;
    designation: string;
    basicSalary: number;
  };
  allowances: SalaryComponentRow[];
  deductions: SalaryComponentRow[];
  loans: SalaryLoanRow[];
  overtimes: SalaryOvertimeRow[];
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && (e as { message?: string }).message) {
    return String((e as { message: string }).message);
  }
  return "Request failed";
}

function hday(d: unknown): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function refId(v: unknown): string {
  if (!v) return "";
  if (typeof v === "object" && v !== null && "_id" in v) return String((v as { _id: unknown })._id);
  if (typeof v === "object" && v !== null && "id" in v) return String((v as { id: unknown }).id);
  return String(v);
}

function refName(v: unknown, keys: string[]): string {
  if (!v) return "";
  if (typeof v === "object") return apiLabel(v, keys) || "";
  return "";
}

function capitalizeAmountType(t: unknown): AmountKind | string {
  const s = String(t ?? "").toLowerCase();
  if (s === "percentage") return "Percentage";
  if (s === "fixed") return "Fixed";
  return String(t ?? "");
}

function apiAmountType(ui: string): "fixed" | "percentage" {
  return ui === "Percentage" ? "percentage" : "fixed";
}

function overtimeStatusLabel(s: unknown): string {
  const v = String(s ?? "active").toLowerCase();
  return v === "expired" ? "Inactive" : "Active";
}

function mapSalaryResponse(raw: Record<string, unknown>): SalaryView {
  const emp = (raw.employee ?? raw) as Record<string, unknown>;
  const mapComponent = (
    rows: unknown[],
    typeKey: "allowance_type_id" | "deduction_type_id",
  ): SalaryComponentRow[] =>
    rows.map((row) => {
      const r = row as Record<string, unknown>;
      const typeRef = r[typeKey];
      return {
        id: String(r._id ?? r.id),
        name: refName(typeRef, ["name"]) || apiLabel(r, ["name"]),
        type: capitalizeAmountType(r.type),
        amount: Number(r.amount) || 0,
        typeId: refId(typeRef),
      };
    });

  const loans = ((raw.loans as unknown[]) || []).map((row) => {
    const l = row as Record<string, unknown>;
    const typeRef = l.loan_type_id;
    return {
      id: String(l._id ?? l.id),
      title: String(l.title ?? ""),
      loanType: refName(typeRef, ["name"]) || apiLabel(l, ["name"]),
      loanTypeId: refId(typeRef),
      type: capitalizeAmountType(l.type),
      amount: Number(l.amount) || 0,
      startDate: hday(l.start_date),
      endDate: hday(l.end_date),
      reason: String(l.reason ?? ""),
    };
  });

  const overtimes = ((raw.overtimes as unknown[]) || []).map((row) => {
    const o = row as Record<string, unknown>;
    return {
      id: String(o._id ?? o.id),
      title: String(o.title ?? ""),
      days: Number(o.total_days ?? o.days) || 1,
      hours: Number(o.hours) || 0,
      rate: Number(o.rate) || 0,
      startDate: hday(o.start_date),
      endDate: hday(o.end_date),
      status: overtimeStatusLabel(o.status),
      notes: String(o.notes ?? ""),
    };
  });

  return {
    employee: {
      name: apiLabel(emp, ["employee_user_id", "name"]) || "",
      employeeId: String(emp.employee_id ?? ""),
      branch: refName(emp.branch_id, ["branch_name", "name"]),
      department: refName(emp.department_id, ["department_name", "name"]),
      designation: refName(emp.designation_id, ["designation_name", "name"]),
      basicSalary: Number(emp.basic_salary) || 0,
    },
    allowances: mapComponent((raw.allowances as unknown[]) || [], "allowance_type_id"),
    deductions: mapComponent((raw.deductions as unknown[]) || [], "deduction_type_id"),
    loans,
    overtimes,
  };
}

function typeSelectOptions(items: unknown[] | undefined, labelKeys: string[]) {
  return (items ?? [])
    .map((t) => {
      const rec = t as Record<string, unknown>;
      return {
        id: String(rec._id ?? rec.id),
        name: apiLabel(rec, labelKeys) || "—",
      };
    })
    .filter((o) => o.id);
}

/* ── small building blocks ─────────────────────────────────────── */

function Panel({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          onClick={onAdd}
          className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors shadow-sm"
          title={`Add ${title.toLowerCase()}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const th = "px-5 py-2.5 text-left text-xs font-medium text-gray-500";
const td = "px-5 py-3 text-sm";

function ModalShell({
  title,
  onClose,
  children,
  onSubmit,
  submitLabel,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm">
            Cancel
          </button>
          <button onClick={onSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const fmtAmount = (c: { type: string; amount: number }) =>
  c.type === "Percentage" ? `${c.amount.toFixed(2)}%` : money(c.amount);

/* ── page ──────────────────────────────────────────────────────── */

export const SetSalaryDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams();

  useEmployees();

  const profileId = useMemo(() => {
    if (!routeId) return undefined;
    if (/^\d+$/.test(routeId)) {
      return employeeBackendId(Number(routeId));
    }
    return routeId;
  }, [routeId]);

  const [view, setView] = useState<SalaryView | null>(null);
  const [loading, setLoading] = useState(true);

  const allowanceTypesQ = allowanceTypeHooks.useList(LIST_PARAMS, { retry: 0 });
  const deductionTypesQ = deductionTypeHooks.useList(LIST_PARAMS, { retry: 0 });
  const loanTypesQ = loanTypeHooks.useList(LIST_PARAMS, { retry: 0 });

  const allowanceTypeOptions = useMemo(
    () => typeSelectOptions(allowanceTypesQ.data, ["name", "allowance_type", "type_name"]),
    [allowanceTypesQ.data],
  );
  const deductionTypeOptions = useMemo(
    () => typeSelectOptions(deductionTypesQ.data, ["name", "deduction_type", "type_name"]),
    [deductionTypesQ.data],
  );
  const loanTypeOptions = useMemo(
    () => typeSelectOptions(loanTypesQ.data, ["name", "loan_type", "type_name"]),
    [loanTypesQ.data],
  );

  const loadSalary = useCallback(async () => {
    if (!profileId) {
      setView(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await payrollApi.getSalary(profileId);
      setView(mapSalaryResponse(raw as Record<string, unknown>));
    } catch (e) {
      setView(null);
      showToast(errMsg(e), "error");
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void loadSalary();
  }, [loadSalary]);

  type ModalState =
    | { kind: "allowance" | "deduction"; item?: SalaryComponentRow }
    | { kind: "loan"; item?: SalaryLoanRow }
    | { kind: "overtime"; item?: SalaryOvertimeRow }
    | { kind: "viewLoan"; item: SalaryLoanRow }
    | { kind: "viewOvertime"; item: SalaryOvertimeRow }
    | { kind: "basicSalary" }
    | null;
  const [modal, setModal] = useState<ModalState>(null);

  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const openModal = (m: Exclude<ModalState, null>) => {
    if ("item" in m && m.item) {
      if (m.kind === "allowance" || m.kind === "deduction") {
        const item = m.item;
        setDraft({ id: item.id, typeId: item.typeId, type: item.type, amount: item.amount });
      } else if (m.kind === "loan") {
        const item = m.item;
        setDraft({
          id: item.id,
          title: item.title,
          loanTypeId: item.loanTypeId,
          type: item.type,
          amount: item.amount,
          startDate: item.startDate,
          endDate: item.endDate,
          reason: item.reason,
        });
      } else if (m.kind === "overtime") {
        const item = m.item;
        setDraft({
          id: item.id,
          title: item.title,
          days: item.days,
          hours: item.hours,
          rate: item.rate,
          startDate: item.startDate,
          endDate: item.endDate,
          status: item.status,
          notes: item.notes,
        });
      } else {
        setDraft({ ...m.item });
      }
    } else if (m.kind === "basicSalary") {
      setDraft({ amount: view?.employee.basicSalary ?? 0 });
    } else {
      setDraft({ typeId: "", type: "", amount: "" });
    }
    setModal(m);
  };

  if (!profileId) {
    return (
      <div className="flex-1 bg-[#FAFBFC] flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>Employee not found.</p>
        <button onClick={() => navigate("/hrm/payslip/set-salary")} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">
          Back to Set Salary
        </button>
      </div>
    );
  }

  if (loading && !view) {
    return (
      <div className="flex-1 bg-[#FAFBFC] flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>Loading salary details…</p>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex-1 bg-[#FAFBFC] flex flex-col items-center justify-center gap-3 text-gray-500">
        <p>Could not load employee salary.</p>
        <button onClick={() => navigate("/hrm/payslip/set-salary")} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">
          Back to Set Salary
        </button>
      </div>
    );
  }

  const { employee, allowances, deductions, loans, overtimes } = view;

  /* ── submit handlers ── */

  const submitComponent = async (kind: "allowance" | "deduction") => {
    if (!draft.typeId || !draft.type || !(Number(draft.amount) > 0)) {
      showToast("Please fill all required fields", "error");
      return;
    }
    const body =
      kind === "allowance"
        ? {
            allowance_type_id: draft.typeId,
            type: apiAmountType(String(draft.type)),
            amount: Number(draft.amount),
          }
        : {
            deduction_type_id: draft.typeId,
            type: apiAmountType(String(draft.type)),
            amount: Number(draft.amount),
          };

    try {
      if (draft.id) {
        if (kind === "allowance") await payrollApi.editAllowance(String(draft.id), body);
        else await payrollApi.editDeduction(String(draft.id), body);
      } else {
        if (kind === "allowance") await payrollApi.addAllowance(profileId, body);
        else await payrollApi.addDeduction(profileId, body);
      }
      await loadSalary();
      showToast(`${kind === "allowance" ? "Allowance" : "Deduction"} ${draft.id ? "updated" : "created"} successfully`, "success");
      setModal(null);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const submitLoan = async () => {
    if (
      !draft.title ||
      !draft.loanTypeId ||
      !draft.type ||
      !(Number(draft.amount) > 0) ||
      !draft.startDate ||
      !draft.endDate
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    const body = {
      title: draft.title,
      loan_type_id: draft.loanTypeId,
      type: apiAmountType(String(draft.type)),
      amount: Number(draft.amount),
      start_date: draft.startDate,
      end_date: draft.endDate,
      reason: draft.reason || "",
    };
    try {
      if (draft.id) await payrollApi.editLoan(String(draft.id), body);
      else await payrollApi.addLoan(profileId, body);
      await loadSalary();
      showToast(`Loan ${draft.id ? "updated" : "created"} successfully`, "success");
      setModal(null);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const submitOvertime = async () => {
    if (
      !draft.title ||
      !(Number(draft.days) > 0) ||
      !(Number(draft.hours) > 0) ||
      !(Number(draft.rate) > 0) ||
      !draft.startDate ||
      !draft.endDate
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    const body = {
      title: draft.title,
      total_days: Number(draft.days),
      hours: Number(draft.hours),
      rate: Number(draft.rate),
      start_date: draft.startDate,
      end_date: draft.endDate,
      notes: draft.notes || "",
    };
    try {
      if (draft.id) await payrollApi.editOvertime(String(draft.id), body);
      else await payrollApi.addOvertime(profileId, body);
      await loadSalary();
      showToast(`Overtime ${draft.id ? "updated" : "created"} successfully`, "success");
      setModal(null);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const submitBasicSalary = async () => {
    const amount = Number(draft.amount);
    if (!(amount > 0)) {
      showToast("Enter a valid salary amount", "error");
      return;
    }
    try {
      await payrollApi.updateSalary(profileId, { basic_salary: amount });
      await loadSalary();
      showToast("Basic salary updated", "success");
      setModal(null);
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const removeRow = async (kind: "allowances" | "deductions" | "loans" | "overtimes", rowId: string) => {
    try {
      if (kind === "allowances") await payrollApi.deleteAllowance(rowId);
      else if (kind === "deductions") await payrollApi.deleteDeduction(profileId, rowId);
      else if (kind === "loans") await payrollApi.deleteLoan(profileId, rowId);
      else await payrollApi.deleteOvertime(profileId, rowId);
      await loadSalary();
      showToast("Deleted successfully", "success");
    } catch (e) {
      showToast(errMsg(e), "error");
    }
  };

  const actionBtns = (onView: (() => void) | null, onEdit: () => void, onDelete: () => void) => (
    <div className="flex items-center gap-1.5">
      {onView && (
        <button onClick={onView} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="View">
          <Eye className="w-4 h-4" />
        </button>
      )}
      <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Edit">
        <Edit className="w-4 h-4" />
      </button>
      <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="module-page-shell overflow-y-auto">
      <HrmBreadcrumb
        trail={[{ label: "Dashboard", to: "/" }, { label: "HRM" }, { label: "Set Salary", to: "/hrm/payslip/set-salary" }]}
        current="View Salary"
        onNavigate={navigate}
      />

      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Employee Salary Details</h2>
        <button
          onClick={() => navigate("/hrm/payslip/set-salary")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="px-4 sm:px-6 pb-8 space-y-5">
        {/* header card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={employee.name} size={12} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{employee.name}</h3>
              <p className="text-xs text-gray-500">{employee.employeeId}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Basic Salary</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-blue-600">{money(employee.basicSalary)}</span>
                  <button onClick={() => openModal({ kind: "basicSalary" })} className="text-gray-400 hover:text-blue-600" title="Edit basic salary">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            {(
              [
                ["Branch", employee.branch],
                ["Department", employee.department],
                ["Designation", employee.designation],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{k}</p>
                <p className="text-sm font-semibold text-gray-900">{v || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* panels */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Panel title="Allowances" onAdd={() => openModal({ kind: "allowance" })}>
            <table className="w-full min-w-[420px]">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className={th}>Allowance Type</th>
                  <th className={th}>Type</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allowances.map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} text-gray-900`}>{a.name}</td>
                    <td className={`${td} text-gray-600`}>{a.type}</td>
                    <td className={`${td} text-gray-900`}>{fmtAmount(a)}</td>
                    <td className={td}>{actionBtns(null, () => openModal({ kind: "allowance", item: a }), () => removeRow("allowances", a.id))}</td>
                  </tr>
                ))}
                {allowances.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">No allowances yet.</td></tr>
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="Deductions" onAdd={() => openModal({ kind: "deduction" })}>
            <table className="w-full min-w-[420px]">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className={th}>Deduction Type</th>
                  <th className={th}>Type</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deductions.map((d) => (
                  <tr key={d.id}>
                    <td className={`${td} text-gray-900`}>{d.name}</td>
                    <td className={`${td} text-gray-600`}>{d.type}</td>
                    <td className={`${td} text-gray-900`}>{fmtAmount(d)}</td>
                    <td className={td}>{actionBtns(null, () => openModal({ kind: "deduction", item: d }), () => removeRow("deductions", d.id))}</td>
                  </tr>
                ))}
                {deductions.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">No deductions yet.</td></tr>
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="Loans" onAdd={() => openModal({ kind: "loan" })}>
            <table className="w-full min-w-[480px]">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className={th}>Type</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Start Date</th>
                  <th className={th}>End Date</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td className={`${td} text-gray-900`}>{l.loanType || "—"}</td>
                    <td className={`${td} text-gray-900`}>{fmtAmount(l)}</td>
                    <td className={`${td} text-gray-600`}>{l.startDate || "—"}</td>
                    <td className={`${td} text-gray-600`}>{l.endDate || "—"}</td>
                    <td className={td}>{actionBtns(() => setModal({ kind: "viewLoan", item: l }), () => openModal({ kind: "loan", item: l }), () => removeRow("loans", l.id))}</td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">No loans yet.</td></tr>
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="Overtimes" onAdd={() => openModal({ kind: "overtime" })}>
            <table className="w-full min-w-[480px]">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Days</th>
                  <th className={th}>Hours</th>
                  <th className={th}>Rate</th>
                  <th className={th}>Status</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overtimes.map((o) => (
                  <tr key={o.id}>
                    <td className={`${td} text-gray-900`}>{o.title}</td>
                    <td className={`${td} text-gray-600`}>{o.days}</td>
                    <td className={`${td} text-gray-600`}>{o.hours.toFixed(2)}</td>
                    <td className={`${td} text-gray-600`}>{money(o.rate)}</td>
                    <td className={td}><Chip label={o.status} /></td>
                    <td className={td}>{actionBtns(() => setModal({ kind: "viewOvertime", item: o }), () => openModal({ kind: "overtime", item: o }), () => removeRow("overtimes", o.id))}</td>
                  </tr>
                ))}
                {overtimes.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">No overtimes yet.</td></tr>
                )}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>

      {/* ── modals ── */}

      {modal?.kind === "basicSalary" && (
        <ModalShell title="Edit Basic Salary" onClose={() => setModal(null)} onSubmit={submitBasicSalary} submitLabel="Update">
          <Field label="Basic Salary" required>
            <input type="number" min={0} value={String(draft.amount ?? "")} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Enter basic salary" className={inputCls} />
          </Field>
        </ModalShell>
      )}

      {(modal?.kind === "allowance" || modal?.kind === "deduction") && (
        <ModalShell
          title={`${modal.item ? "Edit" : "Add"} ${modal.kind === "allowance" ? "Allowance" : "Deduction"}`}
          onClose={() => setModal(null)}
          onSubmit={() => submitComponent(modal.kind)}
          submitLabel={modal.item ? "Update" : "Create"}
        >
          <Field label={modal.kind === "allowance" ? "Allowance Type" : "Deduction Type"} required>
            <IdSearchSelect
              value={String(draft.typeId || "")}
              onChange={(v) => setDraft({ ...draft, typeId: v })}
              options={modal.kind === "allowance" ? allowanceTypeOptions : deductionTypeOptions}
              placeholder={`Select ${modal.kind} type`}
            />
          </Field>
          <Field label="Type" required>
            <select value={String(draft.type || "")} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={`keep-box ua-field ${inputCls}`}>
              <option value="">Select type</option>
              <option>Fixed</option>
              <option>Percentage</option>
            </select>
          </Field>
          <Field label="Amount" required>
            <input type="number" min={0} value={String(draft.amount ?? "")} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Enter amount" className={inputCls} />
          </Field>
        </ModalShell>
      )}

      {modal?.kind === "loan" && (
        <ModalShell title={modal.item ? "Edit Loan" : "Add Loan"} onClose={() => setModal(null)} onSubmit={submitLoan} submitLabel={modal.item ? "Update" : "Create"}>
          <Field label="Title" required>
            <input value={String(draft.title || "")} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Enter loan title" className={inputCls} />
          </Field>
          <Field label="Loan Type" required>
            <IdSearchSelect
              value={String(draft.loanTypeId || "")}
              onChange={(v) => setDraft({ ...draft, loanTypeId: v })}
              options={loanTypeOptions}
              placeholder="Select loan type"
            />
          </Field>
          <Field label="Type" required>
            <select value={String(draft.type || "")} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className={`keep-box ua-field ${inputCls}`}>
              <option value="">Select type</option>
              <option>Fixed</option>
              <option>Percentage</option>
            </select>
          </Field>
          <Field label="Amount" required>
            <input type="number" min={0} value={String(draft.amount ?? "")} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="Enter amount" className={inputCls} />
          </Field>
          <Field label="Start Date" required>
            <AppDatePicker value={String(draft.startDate || "")} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputCls} />
          </Field>
          <Field label="End Date" required>
            <AppDatePicker value={String(draft.endDate || "")} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Reason">
            <textarea value={String(draft.reason || "")} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="Enter reason for loan" rows={3} className={inputCls} />
          </Field>
        </ModalShell>
      )}

      {modal?.kind === "overtime" && (
        <ModalShell title={modal.item ? "Edit Overtime" : "Add Overtime"} onClose={() => setModal(null)} onSubmit={submitOvertime} submitLabel={modal.item ? "Update" : "Create"}>
          <Field label="Title" required>
            <input value={String(draft.title || "")} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Enter overtime title" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Total Days" required>
              <input type="number" min={0} value={String(draft.days ?? "")} onChange={(e) => setDraft({ ...draft, days: e.target.value })} placeholder="Enter total days" className={inputCls} />
            </Field>
            <Field label="Hours" required>
              <input type="number" min={0} value={String(draft.hours ?? "")} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} placeholder="Enter hours" className={inputCls} />
            </Field>
          </div>
          <Field label="Rate" required>
            <input type="number" min={0} value={String(draft.rate ?? "")} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="Enter rate" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" required>
              <AppDatePicker value={String(draft.startDate || "")} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="End Date" required>
              <AppDatePicker value={String(draft.endDate || "")} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="Status" required>
            <select value={String(draft.status || "Active")} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={`keep-box ua-field ${inputCls}`}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
          <Field label="Notes">
            <textarea value={String(draft.notes || "")} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Enter notes for overtime" rows={3} className={inputCls} />
          </Field>
        </ModalShell>
      )}

      {modal?.kind === "viewLoan" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Loan Details</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-2.5 text-sm">
              {(
                [
                  ["Title", modal.item.title],
                  ["Loan Type", modal.item.loanType],
                  ["Type", modal.item.type],
                  ["Amount", fmtAmount(modal.item)],
                  ["Start Date", modal.item.startDate || "—"],
                  ["End Date", modal.item.endDate || "—"],
                  ["Reason", modal.item.reason || "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-50 pb-2">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-900 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal?.kind === "viewOvertime" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Overtime Details</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-2.5 text-sm">
              {(
                [
                  ["Title", modal.item.title],
                  ["Total Days", String(modal.item.days)],
                  ["Hours", modal.item.hours.toFixed(2)],
                  ["Rate", money(modal.item.rate)],
                  ["Start Date", modal.item.startDate || "—"],
                  ["End Date", modal.item.endDate || "—"],
                  ["Status", modal.item.status],
                  ["Notes", modal.item.notes || "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-gray-50 pb-2">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-900 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetSalaryDetail;
