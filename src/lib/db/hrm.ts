/**
 * File: src/lib/db/hrm.ts
 * HRM module data — employees, per-employee salary structure (allowances /
 * deductions / loans / overtimes) and payrolls, persisted in the Dexie `meta`
 * table (no schema bump). Keys:
 *   hrm:employees        — HrmEmployee[]  (the full employee register)
 *   hrm:salary:<empId>   — SalaryData     (per-employee salary components)
 *   hrm:payrolls         — PayrollRecord[]
 * Everything is liveQuery-backed so edits re-render every consumer.
 */

import { useState as useReactState, useEffect as useReactEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { makeBackendStore } from "./backendStore";
import { numericId } from "./sync";
import { api } from "@/lib/api/client";
import { getToken as getHrmToken } from "@/lib/api/tokenStore";
import { toArray } from "@/services/_http";
import { fetchPaginatedList } from "@/services/paginatedList";

/* ── backend reference lookups (name → _id) for writes ─────────── */
const holidayTypeNameToId = new Map<string, string>();
const leaveTypeNameToId = new Map<string, string>();
const employeeNameToId = new Map<string, string>();
const branchNameToId = new Map<string, string>();
const deptNameToId = new Map<string, string>();
const designationNameToId = new Map<string, string>();
const shiftNameToId = new Map<string, string>();
const userNameToId = new Map<string, string>();

const hcap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const hiso = (d?: string) => (d ? new Date(d).toISOString() : undefined);
const hday = (d?: string) => (d ? String(d).slice(0, 10) : "");

/* ── types ─────────────────────────────────────────────────────── */

export interface HrmDocument {
  id: string;
  type: string;
  fileName: string;
  /** Server path from /upload — use with resolveHrmFileUrl / HrmDocumentLink */
  path?: string;
  url?: string;
}

export interface HrmEmployee {
  id: number;
  employeeId: string; // EMP20260001
  name: string;
  dob: string;
  gender: "Male" | "Female" | "Other";
  shift: string;
  dateOfJoining: string;
  employmentType: "Full Time" | "Part Time" | "Contract" | "Temporary";
  branch: string;
  department: string;
  designation: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyNumber: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  bankCode: string;
  bankBranch: string;
  taxPayerId: string;
  basicSalary: number;
  hoursPerDay: number;
  daysPerWeek: number;
  ratePerHour: number;
  documents: HrmDocument[];
}

export interface SalaryComponent {
  id: string;
  name: string; // allowance / deduction type
  type: "Fixed" | "Percentage";
  amount: number; // $ when Fixed, % when Percentage
}

export interface SalaryLoan {
  id: string;
  title: string;
  loanType: string;
  type: "Fixed" | "Percentage";
  amount: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface SalaryOvertime {
  id: string;
  title: string;
  days: number;
  hours: number;
  rate: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive";
  notes?: string;
}

export interface SalaryData {
  allowances: SalaryComponent[];
  deductions: SalaryComponent[];
  loans: SalaryLoan[];
  overtimes: SalaryOvertime[];
}

export interface PayrollRecord {
  id: string;
  title: string;
  frequency: "Weekly" | "Monthly";
  periodStart: string;
  periodEnd: string;
  payDate: string;
  bankAccountId?: string;
  bankAccount?: string;
  notes?: string;
  status: "Draft" | "Completed";
  totalNet?: number;
  employeeCount?: number;
  paid: number[]; // employee ids marked paid
  excluded: number[]; // employee ids removed from this run
}

/* ── seeds (match the ERPGO reference data) ────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 9);

export const SEED_EMPLOYEES: HrmEmployee[] = [
  ["John Smith", "Sales Office", "Customer Service", "Senior Consultant", "Part Time", "2023-05-10", 53966.48],
  ["Michael Brown", "Regional Office", "Finance & Accounting", "Assistant Manager", "Temporary", "2023-03-21", 76552.41],
  ["David Wilson", "Regional Office", "Human Resources", "Officer", "Full Time", "2023-02-10", 69649.95],
  ["Robert Taylor", "North Branch", "Procurement", "Analyst", "Part Time", "2024-09-15", 70011.43],
  ["James Garcia", "Customer Service Center", "Legal & Compliance", "Officer", "Contract", "2025-01-13", 72940.89],
  ["Christopher Lee", "South Branch", "Finance & Accounting", "Director", "Full Time", "2024-04-18", 65651.24],
  ["Daniel Thompson", "Downtown Branch", "Quality Assurance", "Analyst", "Part Time", "2024-01-29", 51912.3],
  ["Matthew Clark", "South Branch", "Finance & Accounting", "Team Lead", "Part Time", "2024-03-11", 42024.53],
  ["Anthony Walker", "Downtown Branch", "Quality Assurance", "Executive", "Contract", "2024-01-31", 39727.77],
  ["Mark Allen", "South Branch", "Finance & Accounting", "Team Lead", "Part Time", "2024-09-30", 42986.94],
].map(([name, branch, department, designation, employmentType, doj, salary], i) => ({
  id: i + 1,
  employeeId: `EMP2026${String(i + 1).padStart(4, "0")}`,
  name: name as string,
  dob: "1990-04-1" + (i % 9),
  gender: "Male" as const,
  shift: "Morning",
  dateOfJoining: doj as string,
  employmentType: employmentType as HrmEmployee["employmentType"],
  branch: branch as string,
  department: department as string,
  designation: designation as string,
  address1: "221B Corporate Park",
  address2: "",
  city: "New York",
  state: "NY",
  country: "United States",
  postalCode: "10001",
  emergencyName: "Family Contact",
  emergencyRelation: "Spouse",
  emergencyNumber: "+12025550147",
  bankName: "Bank of America",
  accountHolder: name as string,
  accountNumber: "0045" + String(72910 + i * 37),
  bankCode: "BOFAUS3N",
  bankBranch: "Manhattan Main",
  taxPayerId: "",
  basicSalary: salary as number,
  hoursPerDay: 8,
  daysPerWeek: 5,
  ratePerHour: Math.round(((salary as number) / (52 * 5 * 8)) * 100) / 100,
  documents: [],
}));

/** Default salary structure — the reference set shown for John Smith. */
export function defaultSalaryFor(empId: number): SalaryData {
  const base: SalaryData = {
    allowances: [
      { id: "a1", name: "Transport Allowance", type: "Percentage", amount: 25 },
      { id: "a2", name: "Mobile Allowance", type: "Fixed", amount: 7500 },
      { id: "a3", name: "Performance Bonus", type: "Fixed", amount: 1600 },
      { id: "a4", name: "Medical Allowance", type: "Fixed", amount: 3000 },
    ],
    deductions: [
      { id: "d1", name: "Provident Fund (PF)", type: "Fixed", amount: 200 },
      { id: "d2", name: "Uniform Charges", type: "Fixed", amount: 350 },
      { id: "d3", name: "Loan Deduction", type: "Fixed", amount: 100 },
      { id: "d4", name: "Late Coming Fine", type: "Percentage", amount: 3 },
    ],
    loans: [],
    overtimes: [],
  };
  if (empId === 1) {
    base.loans = [
      { id: "l1", title: "Medical Loan", loanType: "Medical Loan", type: "Fixed", amount: 1500, startDate: "2026-01-12", endDate: "2027-02-12", reason: "Medical treatment" },
      { id: "l2", title: "Personal Loan", loanType: "Personal Loan", type: "Percentage", amount: 2, startDate: "2025-12-21", endDate: "2026-12-21", reason: "" },
      { id: "l3", title: "Festival Advance", loanType: "Festival Advance", type: "Percentage", amount: 3, startDate: "2026-01-12", endDate: "2026-07-12", reason: "" },
      { id: "l4", title: "Education Loan", loanType: "Education Loan", type: "Percentage", amount: 4, startDate: "2026-01-10", endDate: "2027-08-10", reason: "" },
    ];
    base.overtimes = [
      { id: "o1", title: "System Maintenance", days: 3, hours: 24, rate: 20, startDate: "2026-06-01", endDate: "2026-06-04", status: "Active", notes: "" },
    ];
  }
  return base;
}

export const SEED_PAYROLLS: PayrollRecord[] = [
  ["p9", "Fugiat vitae culpa", "Monthly", "2026-07-09", "2026-07-29", "2026-08-01", "Completed"],
  ["p8", "TEST", "Weekly", "2026-07-01", "2026-07-06", "2026-07-07", "Completed"],
  ["p7", "January 2026 Payroll", "Monthly", "2026-01-01", "2026-01-31", "2026-02-07", "Completed"],
  ["p6", "December 2025 Payroll", "Monthly", "2025-12-01", "2025-12-31", "2026-01-10", "Completed"],
  ["p5", "November 2025 Payroll", "Monthly", "2025-11-01", "2025-11-30", "2025-12-10", "Completed"],
  ["p4", "July 2025 Payroll", "Monthly", "2025-07-01", "2025-07-31", "2025-08-05", "Completed"],
  ["p3", "August 2025 Payroll", "Monthly", "2025-08-01", "2025-08-31", "2025-09-05", "Completed"],
  ["p2", "September 2025 Payroll", "Monthly", "2025-09-01", "2025-09-30", "2025-10-05", "Draft"],
  ["p1", "October 2025 Payroll", "Monthly", "2025-10-01", "2025-10-31", "2025-11-05", "Completed"],
].map(([id, title, frequency, periodStart, periodEnd, payDate, status]) => ({
  id: id as string,
  title: title as string,
  frequency: frequency as PayrollRecord["frequency"],
  periodStart: periodStart as string,
  periodEnd: periodEnd as string,
  payDate: payDate as string,
  bankAccount: "Bank of America #004572910",
  notes: "",
  status: status as PayrollRecord["status"],
  paid: [],
  excluded: [],
}));

/* ── meta persistence ──────────────────────────────────────────── */

const salaryKey = (id: number | string) => `hrm:salary:${id}`;

/* Employees → /hrm/employees (company-scoped). Numeric UI id (stable hash of
 * _id) so per-employee salary/attendance keys keep working; the real _id is
 * tracked for deletes + name→id resolution used by leave/promotion writes. */
const empNumToBackendId = new Map<number, string>();

export function employeeBackendId(uiId: number): string | undefined {
  return empNumToBackendId.get(uiId);
}

export function mapEmployee(d: any): HrmEmployee {
  const backendId = String(d._id);
  const num = numericId(backendId);
  empNumToBackendId.set(num, backendId);
  const name = d.employee_user_id?.name || d.name || "";
  if (name) employeeNameToId.set(name, backendId);
  return {
    id: num,
    employeeId: d.employee_id || "",
    name,
    dob: hday(d.date_of_birth),
    gender: (d.gender as HrmEmployee["gender"]) || "Male",
    shift: d.shift_id?.shift_name || "",
    dateOfJoining: hday(d.date_of_joining),
    employmentType: (d.employment_type as any) || "Full Time",
    branch: d.branch_id?.branch_name || "",
    department: d.department_id?.department_name || "",
    designation: d.designation_id?.designation_name || "",
    address1: d.address_line_1 || "", address2: d.address_line_2 || "",
    city: d.city || "", state: d.state || "", country: d.country || "", postalCode: d.postal_code || "",
    emergencyName: d.emergency_contact_name || "", emergencyRelation: d.emergency_contact_relation || "",
    emergencyNumber: d.emergency_contact_number || "",
    bankName: d.bank_name || "", accountHolder: d.account_holder_name || "", accountNumber: d.account_number || "",
    bankCode: d.bank_code || "", bankBranch: d.bank_branch || "", taxPayerId: d.tax_payer_id || "",
    basicSalary: d.basic_salary ?? 0,
    hoursPerDay: d.hours_per_day ?? 0, daysPerWeek: d.days_per_week ?? 0, ratePerHour: d.rate_per_hour ?? 0,
    documents: [],
  };
}

let _empCache: HrmEmployee[] | undefined;
let _empToken: string | null = null;
let _empInFlight: Promise<HrmEmployee[]> | null = null;
const _empListeners = new Set<() => void>();
async function _fetchEmployees(): Promise<HrmEmployee[]> {
  const tok = getHrmToken();
  if (!tok) { _empCache = []; _empToken = null; return _empCache; }
  if (_empInFlight) return _empInFlight;
  _empInFlight = (async () => {
    const res = await api.raw.get("/hrm/employees");
    const docs = toArray<any>(res.data);
    _empCache = docs.map(mapEmployee);
    _empToken = tok;
    _empListeners.forEach((l) => l());
    return _empCache;
  })().finally(() => { _empInFlight = null; });
  return _empInFlight;
}
export async function fetchEmployeeListPage(params: {
  page?: number;
  limit?: number;
  searchTerm?: string;
  branch_id?: string;
}): Promise<{ rows: HrmEmployee[]; total: number; totalPages: number }> {
  const { rows, pagination } = await fetchPaginatedList<any>("/hrm/employees", params);
  const mapped = rows.map(mapEmployee);
  const total = pagination.totalData ?? mapped.length;
  const totalPages = Math.max(1, pagination.totalPage ?? Math.ceil(total / (params.limit || 10)));
  return { rows: mapped, total, totalPages };
}

export function useEmployees(): HrmEmployee[] | null | undefined {
  const [, force] = useReactState(0);
  useReactEffect(() => {
    const l = () => force((x) => x + 1);
    _empListeners.add(l);
    if (getHrmToken() && _empToken !== getHrmToken()) void _fetchEmployees();
    return () => { _empListeners.delete(l); };
  }, []);
  return _empToken === getHrmToken() ? _empCache : undefined;
}
/** Map a UI employee → backend create/update body (refs resolved by name). */
function employeeToBackend(e: HrmEmployee): Record<string, any> {
  return {
    ...(e.employeeId?.trim() ? { employee_id: e.employeeId.trim() } : {}),
    employee_user_id: userNameToId.get(e.name),
    gender: e.gender,
    date_of_birth: e.dob ? new Date(e.dob).toISOString() : undefined,
    date_of_joining: e.dateOfJoining ? new Date(e.dateOfJoining).toISOString() : undefined,
    employment_type: e.employmentType,
    shift_id: shiftNameToId.get(e.shift),
    branch_id: branchNameToId.get(e.branch),
    department_id: deptNameToId.get(e.department),
    designation_id: designationNameToId.get(e.designation),
    address_line_1: e.address1, address_line_2: e.address2,
    city: e.city, state: e.state, country: e.country, postal_code: e.postalCode,
    emergency_contact_name: e.emergencyName, emergency_contact_relation: e.emergencyRelation,
    emergency_contact_number: e.emergencyNumber,
    bank_name: e.bankName, account_holder_name: e.accountHolder, account_number: e.accountNumber,
    bank_code: e.bankCode, bank_branch: e.bankBranch, tax_payer_id: e.taxPayerId,
    basic_salary: Number(e.basicSalary) || 0,
    hours_per_day: Number(e.hoursPerDay) || 0, days_per_week: Number(e.daysPerWeek) || 0,
    rate_per_hour: Number(e.ratePerHour) || 0,
  };
}

/** Backend-backed employee CRUD: create (POST) / edit (PUT) / delete, resolving
 *  the register's name fields to the real branch/department/designation/shift/
 *  user ids fetched by useHrmLookups(). */
export async function saveEmployees(list: HrmEmployee[]): Promise<void> {
  const old = _empCache ?? [];
  const newIds = new Set(list.map((e) => e.id));
  for (const o of old) {
    const bid = empNumToBackendId.get(o.id);
    if (bid && !newIds.has(o.id)) await api.raw.delete(`/hrm/employees/${bid}`);
  }
  for (const e of list) {
    const bid = empNumToBackendId.get(e.id);
    if (bid) {
      const prev = old.find((o) => o.id === e.id);
      if (prev && JSON.stringify(prev) !== JSON.stringify(e)) {
        await api.raw.put(`/hrm/employees/${bid}`, employeeToBackend(e));
      }
    } else {
      await api.raw.post("/hrm/employees", employeeToBackend(e));
    }
  }
  await _fetchEmployees();
}

/* ── HRM lookups (branches / departments / designations / shifts / eligible
 *  users) for the employee form — real, company-scoped; also fills the name→id
 *  maps the employee writes resolve against. */
export interface HrmLookups {
  branches: string[];
  departments: string[];
  designations: string[];
  shifts: string[];
  users: string[];
}
let _lkCache: HrmLookups | undefined;
let _lkToken: string | null = null;
let _lkInFlight: Promise<HrmLookups> | null = null;
const _lkListeners = new Set<() => void>();
async function _fetchLookups(): Promise<HrmLookups> {
  const tok = getHrmToken();
  if (!tok) { _lkCache = { branches: [], departments: [], designations: [], shifts: [], users: [] }; _lkToken = null; return _lkCache; }
  if (_lkInFlight) return _lkInFlight;
  _lkInFlight = (async () => {
    const [lkRes, usersRes, shiftsRes] = await Promise.all([
      api.raw.get("/hrm/employees/lookups"),
      api.raw.get("/hrm/employees/eligible-users"),
      api.raw.get("/hrm/setup/shifts"),
    ]);
    const lk = (lkRes.data?.data ?? lkRes.data) || {};
    const users = toArray<any>(usersRes.data);
    const shifts = toArray<any>(shiftsRes.data);
    branchNameToId.clear(); deptNameToId.clear(); designationNameToId.clear(); userNameToId.clear();
    for (const b of lk.branches || []) if (b?.branch_name) branchNameToId.set(b.branch_name, String(b._id));
    for (const d of lk.departments || []) if (d?.department_name) deptNameToId.set(d.department_name, String(d._id));
    for (const g of lk.designations || []) if (g?.designation_name) designationNameToId.set(g.designation_name, String(g._id));
    for (const u of users) if (u?.name) userNameToId.set(u.name, String(u._id));
    for (const s of shifts) if (s?.shift_name) shiftNameToId.set(s.shift_name, String(s._id));
    _lkCache = {
      branches: [...branchNameToId.keys()],
      departments: [...deptNameToId.keys()],
      designations: [...designationNameToId.keys()],
      shifts: [...shiftNameToId.keys()],
      users: [...userNameToId.keys()],
    };
    _lkToken = tok;
    _lkListeners.forEach((l) => l());
    return _lkCache;
  })().finally(() => { _lkInFlight = null; });
  return _lkInFlight;
}
export function useHrmLookups(): HrmLookups {
  const [, force] = useReactState(0);
  useReactEffect(() => {
    const l = () => force((x) => x + 1);
    _lkListeners.add(l);
    if (getHrmToken() && _lkToken !== getHrmToken()) void _fetchLookups();
    return () => { _lkListeners.delete(l); };
  }, []);
  return _lkToken === getHrmToken() && _lkCache
    ? _lkCache
    : { branches: [], departments: [], designations: [], shifts: [], users: [] };
}

export async function saveSalary(empId: number, data: SalaryData) {
  await db.meta.put({ key: salaryKey(empId), value: data });
}
export function useSalary(empId: number | null): SalaryData | null | undefined {
  return useLiveQuery(async () => {
    if (empId == null) return undefined;
    const row = await db.meta.get(salaryKey(empId));
    return (row?.value as SalaryData) || null;
  }, [empId]);
}
export async function getSalaryOrDefault(empId: number): Promise<SalaryData> {
  const row = await db.meta.get(salaryKey(empId));
  return (row?.value as SalaryData) || defaultSalaryFor(empId);
}

/* Payrolls → /hrm/payroll (company-scoped). */
const payrollStore = makeBackendStore<PayrollRecord>({
  base: "/hrm/payroll",
  toFrontend: (d) => {
    const ba = d.bank_account_id;
    const bankAccountId =
      typeof ba === "object" && ba
        ? String(ba._id ?? ba.id ?? "")
        : ba
          ? String(ba)
          : undefined;
    const bankAccount =
      typeof ba === "object" && ba
        ? String(ba.account_name || ba.bank_name || "")
        : "";
    const entries = Array.isArray(d.entries) ? d.entries : [];
    return {
      id: String(d._id),
      title: d.title || "",
      frequency: d.payroll_frequency === "weekly" ? "Weekly" : "Monthly",
      periodStart: hday(d.pay_period_start),
      periodEnd: hday(d.pay_period_end),
      payDate: hday(d.pay_date || d.pay_period_end),
      bankAccountId: bankAccountId || undefined,
      bankAccount: bankAccount || undefined,
      notes: d.notes || "",
      status: d.status === "completed" || d.is_payroll_paid === "paid" ? "Completed" : "Draft",
      totalNet: d.total_net_pay != null ? Number(d.total_net_pay) : undefined,
      employeeCount:
        d.employee_count != null
          ? Number(d.employee_count)
          : entries.length > 0
            ? entries.length
            : 0,
      paid: [],
      excluded: [],
    };
  },
  toBackend: (p) => ({
    title: p.title,
    payroll_frequency: (p.frequency || "Monthly").toLowerCase(),
    pay_period_start: hiso(p.periodStart),
    pay_period_end: hiso(p.periodEnd),
    pay_date: hiso(p.payDate),
    notes: p.notes || "",
    ...(p.bankAccountId ? { bank_account_id: p.bankAccountId } : {}),
  }),
});
export const usePayrolls = payrollStore.use;
export const savePayrolls = payrollStore.save;

export const nextEmployeeId = (list: HrmEmployee[]) =>
  list.reduce((m, e) => Math.max(m, e.id), 0) + 1;

export const newUid = uid;

/* ── payroll math ──────────────────────────────────────────────── */

export interface EmployeePay {
  employee: HrmEmployee;
  salary: SalaryData;
  basic: number;
  allowances: number;
  manualOT: number;
  attendanceOT: number;
  deductions: number;
  loans: number;
  gross: number;
  net: number;
}

export function computePay(employee: HrmEmployee, salary: SalaryData): EmployeePay {
  const pct = (p: number) => (employee.basicSalary * p) / 100;
  const val = (c: { type: string; amount: number }) =>
    c.type === "Percentage" ? pct(c.amount) : c.amount;
  const allowances = salary.allowances.reduce((s, a) => s + val(a), 0);
  const deductions = salary.deductions.reduce((s, d) => s + val(d), 0);
  const loans = salary.loans.reduce((s, l) => s + val(l), 0);
  const manualOT = 0;
  const attendanceOT = 0;
  const gross = employee.basicSalary + allowances + manualOT + attendanceOT;
  const net = gross - deductions - loans;
  return { employee, salary, basic: employee.basicSalary, allowances, manualOT, attendanceOT, deductions, loans, gross, net };
}

/** Live rows + totals for a payroll run (all employees minus excluded). */
export function usePayrollPay(excluded: number[] = []): EmployeePay[] | undefined {
  const employees = useEmployees(); // backend-backed register
  const key = (employees || []).map((e) => e.id).join(",") + "|" + excluded.join(",");
  return useLiveQuery(async () => {
    const list = (employees || []).filter((e) => !excluded.includes(e.id));
    return Promise.all(list.map(async (e) => computePay(e, await getSalaryOrDefault(e.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Weekdays (Mon–Fri) between two ISO dates, inclusive. */
export function workingDays(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let n = 0;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

/* ── option catalogs (shared across HRM forms) ─────────────────── */

export const HRM_BRANCHES = ["Sales Office", "Regional Office", "North Branch", "South Branch", "Downtown Branch", "Customer Service Center"];
export const HRM_DEPARTMENTS = ["Customer Service", "Finance & Accounting", "Human Resources", "Procurement", "Legal & Compliance", "Quality Assurance"];
export const HRM_DESIGNATIONS = ["Senior Consultant", "Assistant Manager", "Officer", "Analyst", "Director", "Team Lead", "Executive"];
export const HRM_SHIFTS = ["Morning", "Evening", "Night"];
export const HRM_USERS = ["John Smith", "Michael Brown", "David Wilson", "Robert Taylor", "James Garcia", "Christopher Lee", "Daniel Thompson", "Matthew Clark", "Anthony Walker", "Mark Allen", "Emily Davis", "Sarah Johnson", "Kevin Martin"];
export const DOCUMENT_TYPES = ["Resume", "ID Proof", "Address Proof", "Offer Letter", "Certificate", "Photo"];
export const HOLIDAY_TYPES = ["National Holiday", "Regional Holiday", "International Holiday", "Traditional Holiday", "Festival Holiday", "Independence Holiday", "Memorial Holiday", "Seasonal Holiday", "Cultural Holiday", "Local Holiday", "State Holiday", "Religious Holiday"];
export const ALLOWANCE_TYPES = ["House Rent Allowance (HRA)", "Medical Allowance", "Transport Allowance", "Food Allowance", "Mobile Allowance", "Education Allowance", "Performance Bonus", "Overtime Allowance", "Shift Allowance", "Travel Allowance"];
export const DEDUCTION_TYPES = ["Income Tax", "Provident Fund (PF)", "Employee State Insurance (ESI)", "Professional Tax", "Loan Deduction", "Late Coming Fine", "Absence Deduction", "Canteen Charges", "Insurance Premium", "Uniform Charges"];
export const LOAN_TYPES = ["Personal Loan", "Home Loan", "Vehicle Loan", "Education Loan", "Medical Loan", "Salary Advance", "Festival Advance", "Travel Loan", "Equipment Loan", "Emergency Loan"];
export const BANK_ACCOUNTS = ["Bank of America #004572910", "Chase Business #118250071", "Cash"];

/* ════════════════════════════════════════════════════════════════
   Attendance / Shifts / Holidays / Leave / Promotions (added for the
   remaining HRM reference redesign). Same meta-row persistence style.
   ════════════════════════════════════════════════════════════════ */

/* ── shifts ────────────────────────────────────────────────────── */

export interface Shift {
  id: string;
  name: string;
  start: string; // "09:00"
  end: string;
  breakStart: string;
  breakEnd: string;
  night: boolean;
  createdBy: string;
  createdAt: string;
}

export const SEED_SHIFTS: Shift[] = [
  ["s1", "Morning Shift", "09:00", "17:00", false],
  ["s2", "Evening Shift", "14:00", "22:00", false],
  ["s3", "Night Shift", "22:00", "06:00", true],
  ["s4", "Early Morning Shift", "06:00", "14:00", false],
  ["s5", "Flexible Shift", "10:00", "18:00", false],
  ["s6", "Weekend Shift", "08:00", "16:00", false],
].map(([id, name, start, end, night]) => ({
  id: id as string,
  name: name as string,
  start: start as string,
  end: end as string,
  breakStart: "12:00",
  breakEnd: "13:00",
  night: night as boolean,
  createdBy: "Company",
  createdAt: "2026-01-19",
}));

/* Shifts → /hrm/setup/shifts (company-scoped). */
const shiftStore = makeBackendStore<Shift>({
  base: "/hrm/setup/shifts",
  onFetch: (docs) => {
    shiftNameToId.clear();
    for (const d of docs) if (d?.shift_name) shiftNameToId.set(d.shift_name, String(d._id));
  },
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.shift_name || "",
    start: d.start_time || "",
    end: d.end_time || "",
    breakStart: d.break_start_time || d.break_start || "",
    breakEnd: d.break_end_time || d.break_end || "",
    night: !!d.is_night_shift,
    createdBy: "Company",
    createdAt: hday(d.createdAt),
  }),
  toBackend: (s) => ({
    shift_name: s.name,
    start_time: s.start,
    end_time: s.end,
    break_start_time: s.breakStart,
    break_end_time: s.breakEnd,
    is_night_shift: !!s.night,
  }),
});
export const useShifts = shiftStore.use;
export const saveShifts = shiftStore.save;

/* ── holidays ──────────────────────────────────────────────────── */

export interface Holiday {
  id: string;
  name: string;
  start: string;
  end: string;
  type: string;
  description: string;
  paid: boolean;
  syncGoogle: boolean;
  syncOutlook: boolean;
}

export const SEED_HOLIDAYS: Holiday[] = ([
  ["International Volunteer Day - Community Service", "2025-12-20", "2025-12-20", "Regional Holiday", true, true, false, "International recognition day celebrating volunteers and their contributions to communities through service and charitable activities."],
  ["World AIDS Day - Health Awareness", "2025-12-15", "2025-12-16", "International Holiday", true, false, false, "Global health awareness day dedicated to raising awareness of the AIDS pandemic and supporting those living with HIV."],
  ["International Human Rights Day - Justice", "2025-12-10", "2025-12-10", "Traditional Holiday", true, true, true, "Commemorates the adoption of the Universal Declaration of Human Rights."],
  ["World Teachers Day - Education Honor", "2025-12-05", "2025-12-05", "Festival Holiday", false, false, false, "Honoring teachers and their vital role in education and society."],
  ["International Peace Day - Global Unity", "2025-11-30", "2025-11-30", "Independence Holiday", false, false, false, "A day devoted to strengthening the ideals of peace among nations and peoples."],
  ["World Environment Day - Sustainability", "2025-11-25", "2025-11-28", "Memorial Holiday", true, true, false, "Encouraging awareness and action for the protection of the environment."],
  ["International Workers Day - Labor Rights", "2025-11-20", "2025-11-20", "Seasonal Holiday", true, false, true, "Celebration of labourers and the working classes."],
  ["World Health Day - Wellness Focus", "2025-11-15", "2025-11-15", "Cultural Holiday", true, false, false, "Global health awareness day promoting wellness and healthy living."],
  ["Earth Day - Environmental Awareness", "2025-11-10", "2025-11-10", "Local Holiday", false, false, false, "Demonstrating support for environmental protection."],
  ["International Womens Day - Recognition", "2025-11-05", "2025-11-06", "State Holiday", true, true, false, "Celebrating the social, economic, cultural and political achievements of women."],
  ["Thanksgiving Celebration - Gratitude Day", "2025-10-28", "2025-10-28", "National Holiday", true, false, false, "A day of giving thanks and celebrating the harvest."],
  ["Founders Day - Company Anniversary", "2025-10-15", "2025-10-15", "Religious Holiday", true, false, false, "Celebrating the founding anniversary of the company."],
] as [string, string, string, string, boolean, boolean, boolean, string][]).map(
  ([name, start, end, type, paid, syncGoogle, syncOutlook, description], i) => ({
    id: `h${i + 1}`,
    name, start, end, type, paid, syncGoogle, syncOutlook, description,
  }),
);

/* Holiday types → build a name→id map for the holiday picker + writes. */
const holidayTypeStore = makeBackendStore<{ id: string; name: string }>({
  base: "/hrm/setup/holiday-types",
  onFetch: (docs) => {
    holidayTypeNameToId.clear();
    for (const d of docs) if (d?.holiday_type) holidayTypeNameToId.set(d.holiday_type, String(d._id));
  },
  toFrontend: (d) => ({ id: String(d._id), name: d.holiday_type || "" }),
  toBackend: (t) => ({ holiday_type: t.name }),
});
export const useHolidayTypes = holidayTypeStore.use;

/* Holidays → /hrm/holidays (company-scoped). */
const holidayStore = makeBackendStore<Holiday>({
  base: "/hrm/holidays",
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.name || "",
    start: hday(d.start_date),
    end: hday(d.end_date),
    type: d.holiday_type_id?.holiday_type || "",
    description: d.description || "",
    paid: d.is_paid !== false,
    syncGoogle: !!d.is_sync_google_calendar,
    syncOutlook: !!d.is_sync_outlook_calendar,
  }),
  toBackend: (h) => ({
    name: h.name,
    start_date: hiso(h.start),
    end_date: hiso(h.end),
    holiday_type_id: holidayTypeNameToId.get(h.type),
    description: h.description,
    is_paid: !!h.paid,
    is_sync_google_calendar: !!h.syncGoogle,
    is_sync_outlook_calendar: !!h.syncOutlook,
  }),
});
export const useHolidays = holidayStore.use;
export const saveHolidays = holidayStore.save;

/* ── leave types ───────────────────────────────────────────────── */

export interface LeaveType {
  id: string;
  name: string;
  maxDays: number;
  paid: boolean;
  color: string;
  description: string;
}

export const SEED_LEAVE_TYPES: LeaveType[] = ([
  ["Annual Leave", 21, true, "#10B981", "Yearly vacation leave for employees to rest and recharge."],
  ["Sick Leave", 10, true, "#EF4444", "Leave for illness or medical conditions."],
  ["Maternity Leave", 90, true, "#F59E0B", "Leave for expecting and new mothers."],
  ["Paternity Leave", 15, true, "#3B82F6", "Leave for new fathers to support their family."],
  ["Personal Leave", 5, false, "#8B5CF6", "Unpaid leave for personal matters."],
  ["Bereavement Leave", 7, true, "#6B7280", "Leave following the loss of a family member."],
  ["Study Leave", 30, false, "#06B6D4", "Unpaid leave for education and professional development."],
  ["Emergency Leave", 3, true, "#EF4444", "Short-notice leave for emergencies."],
] as [string, number, boolean, string, string][]).map(([name, maxDays, paid, color, description], i) => ({
  id: `lt${i + 1}`,
  name, maxDays, paid, color, description,
}));

/* Leave types → /hrm/setup/leave-types (company-scoped). */
const leaveTypeStore = makeBackendStore<LeaveType>({
  base: "/hrm/setup/leave-types",
  onFetch: (docs) => {
    leaveTypeNameToId.clear();
    for (const d of docs) if (d?.name) leaveTypeNameToId.set(d.name, String(d._id));
  },
  toFrontend: (d) => ({
    id: String(d._id),
    name: d.name || "",
    maxDays: d.max_days_per_year ?? 0,
    paid: d.is_paid !== false,
    color: d.color || "#3B82F6",
    description: d.description || "",
  }),
  toBackend: (t) => ({
    name: t.name,
    max_days_per_year: Number(t.maxDays) || 0,
    is_paid: !!t.paid,
    color: t.color,
    description: t.description,
  }),
});
export const useLeaveTypes = leaveTypeStore.use;
export const saveLeaveTypes = leaveTypeStore.save;

/* ── leave applications ────────────────────────────────────────── */

export interface LeaveApplication {
  id: string;
  employee: string;
  /** User `_id` sent as `employee_id` on create (not employee profile id). */
  employeeUserId?: string;
  leaveType: string;
  leaveTypeId?: string;
  start: string;
  end: string;
  days: number;
  status: "Pending" | "Approved" | "Rejected";
  appliedOn: string;
  reason: string;
  document?: string;
  approvedBy?: string;
  approvedAt?: string;
  comment?: string;
}

export const SEED_LEAVE_APPS: LeaveApplication[] = ([
  ["Daniel Thompson", "Personal Leave", "2025-10-09", "2025-10-13", 3, "Rejected", "Medical appointment and health checkup scheduled"],
  ["Daniel Thompson", "Paternity Leave", "2025-10-13", "2025-10-13", 1, "Pending", "Supporting family after newborn arrival"],
  ["Daniel Thompson", "Bereavement Leave", "2025-10-17", "2025-10-20", 2, "Approved", "Attending family funeral out of town"],
  ["Matthew Clark", "Study Leave", "2025-10-01", "2025-10-01", 1, "Approved", "Professional certification exam"],
  ["Matthew Clark", "Personal Leave", "2025-10-06", "2025-10-07", 2, "Rejected", "Personal family matters to attend"],
  ["Matthew Clark", "Study Leave", "2025-10-09", "2025-10-13", 3, "Pending", "Attending professional development workshop"],
  ["Matthew Clark", "Bereavement Leave", "2025-10-13", "2025-10-13", 1, "Approved", "Memorial service attendance"],
  ["Matthew Clark", "Emergency Leave", "2025-10-17", "2025-10-20", 2, "Rejected", "Urgent household emergency repair"],
  ["Anthony Walker", "Personal Leave", "2025-10-01", "2025-10-01", 1, "Rejected", "Bank and legal documentation work"],
  ["Anthony Walker", "Annual Leave", "2025-10-06", "2025-10-10", 5, "Approved", "Planned family vacation"],
  ["John Smith", "Sick Leave", "2025-10-02", "2025-10-03", 2, "Approved", "Recovering from seasonal flu"],
  ["James Garcia", "Annual Leave", "2025-10-20", "2025-10-24", 5, "Pending", "Year-end family travel plans"],
] as [string, string, string, string, number, LeaveApplication["status"], string][]).map(
  ([employee, leaveType, start, end, days, status, reason], i) => ({
    id: `la${i + 1}`,
    employee, leaveType, start, end, days, status, reason,
    appliedOn: "2026-01-19",
    document: "leave-request.pdf",
    approvedBy: status === "Approved" ? "Company" : undefined,
    approvedAt: status === "Approved" ? "2026-01-20" : undefined,
  }),
);

/* Leave applications → /hrm/leave (company-scoped). Employee + leave type are
 * resolved by name (dropdowns come from the wired employee/leave-type stores). */
const leaveAppStore = makeBackendStore<LeaveApplication>({
  base: "/hrm/leave",
  toFrontend: (d) => {
    const emp = d.employee_id;
    const lt = d.leave_type_id;
    const employeeUserId =
      typeof emp === "object" && emp
        ? String(emp._id ?? emp.id ?? "")
        : emp
          ? String(emp)
          : "";
    const leaveTypeId =
      typeof lt === "object" && lt ? String(lt._id ?? lt.id ?? "") : lt ? String(lt) : "";
    return {
      id: String(d._id),
      employee:
        (typeof emp === "object" && emp
          ? emp.name || emp.employee_user_id?.name
          : undefined) || "",
      employeeUserId,
      leaveType: (typeof lt === "object" && lt ? lt.name : undefined) || "",
      leaveTypeId,
      start: hday(d.start_date),
      end: hday(d.end_date),
      days: d.total_days ?? 0,
      status: (hcap(d.status) as LeaveApplication["status"]) || "Pending",
      appliedOn: hday(d.createdAt),
      reason: d.reason || "",
      approvedBy: d.approved_by?.name,
      approvedAt: hday(d.approved_at),
      comment: d.approver_comment || d.comment || "",
    };
  },
  toBackend: (a) => ({
    employee_id:
      a.employeeUserId ||
      employeeNameToId.get(a.employee) ||
      undefined,
    leave_type_id: a.leaveTypeId || leaveTypeNameToId.get(a.leaveType),
    start_date: hiso(a.start),
    end_date: hiso(a.end),
    reason: a.reason || "",
  }),
});
export const useLeaveApps = leaveAppStore.use;
export const saveLeaveApps = leaveAppStore.save;

/* ── promotions ────────────────────────────────────────────────── */

export interface Promotion {
  id: string;
  employee: string;
  prevBranch: string;
  prevDepartment: string;
  prevDesignation: string;
  branch: string;
  department: string;
  designation: string;
  effectiveDate: string;
  reason: string;
  document?: string;
  status: "Pending" | "Approved";
  approvedBy?: string;
}

export const SEED_PROMOTIONS: Promotion[] = ([
  ["Mark Allen", "Customer Service Center", "Legal & Compliance", "Senior Associate", "Main Office", "Sales & Marketing", "Senior Analyst", "2025-12-20", "Approved", "Mega Distributors"],
  ["Anthony Walker", "Customer Service Center", "Quality Assurance", "Junior Associate", "Customer Service Center", "Quality Assurance", "Associate", "2025-12-15", "Pending", ""],
  ["Matthew Clark", "Customer Service Center", "Finance & Accounting", "Associate", "Customer Service Center", "Finance & Accounting", "Specialist", "2025-12-10", "Approved", "Global Solutions Ltd"],
  ["Daniel Thompson", "Sales Office", "Quality Assurance", "Analyst", "Customer Service Center", "Quality Assurance", "Team Lead", "2025-12-05", "Pending", ""],
  ["Christopher Lee", "Sales Office", "Finance & Accounting", "Consultant", "Sales Office", "Finance & Accounting", "Senior Consultant", "2025-11-30", "Approved", "David Wilson"],
  ["James Garcia", "Sales Office", "Legal & Compliance", "Officer", "Sales Office", "Legal & Compliance", "Supervisor", "2025-11-25", "Approved", "Lisa Anderson"],
  ["Robert Taylor", "Regional Office", "Procurement", "Analyst", "Sales Office", "Procurement", "Senior Analyst", "2025-11-20", "Pending", ""],
  ["David Wilson", "Regional Office", "Human Resources", "Officer", "Regional Office", "Human Resources", "Manager", "2025-11-15", "Approved", "Daniel Thompson"],
  ["Michael Brown", "Regional Office", "Finance & Accounting", "Trainee", "Regional Office", "Finance & Accounting", "Assistant", "2025-11-10", "Pending", ""],
  ["John Smith", "Corporate Headquarters", "Customer Service", "Junior Officer", "Regional Office", "Customer Service", "Officer", "2025-11-05", "Approved", "Mega Distributors"],
] as [string, string, string, string, string, string, string, string, Promotion["status"], string][]).map(
  ([employee, prevBranch, prevDepartment, prevDesignation, branch, department, designation, effectiveDate, status, approvedBy], i) => ({
    id: `pr${i + 1}`,
    employee, prevBranch, prevDepartment, prevDesignation, branch, department, designation, effectiveDate, status,
    approvedBy: approvedBy || undefined,
    reason: "Outstanding commitment, consistent target achievement and demonstrated leadership; promotion recognizes sustained high performance.",
    document: "",
  }),
);

/* Promotions → /hrm/promotions (company-scoped, read-only here — creating a
 * promotion needs branch/department/designation refs resolved server-side). */
const promotionStore = makeBackendStore<Promotion>({
  base: "/hrm/promotions",
  mutable: { create: false, update: false, remove: true },
  toFrontend: (d) => ({
    id: String(d._id),
    employee: d.employee_id?.name || d.employee_id?.employee_user_id?.name || "",
    prevBranch: d.previous_branch_id?.branch_name || "",
    prevDepartment: d.previous_department_id?.department_name || "",
    prevDesignation: d.previous_designation_id?.designation_name || "",
    branch: d.new_branch_id?.branch_name || d.branch_id?.branch_name || "",
    department: d.new_department_id?.department_name || d.department_id?.department_name || "",
    designation: d.new_designation_id?.designation_name || d.designation_id?.designation_name || "",
    effectiveDate: hday(d.effective_date || d.promotion_date),
    reason: d.reason || "",
    document: d.document || "",
    status: (hcap(d.status) as Promotion["status"]) || "Pending",
    approvedBy: d.approved_by?.name,
  }),
  toBackend: () => ({}),
});
export const usePromotions = promotionStore.use;
export const savePromotions = promotionStore.save;

/* ── attendance (deterministic generator + edit overrides) ─────── */

export type AttendanceStatus = "present" | "absent" | "half" | "leave" | "dayoff" | "future";
export interface AttendanceCell {
  status: AttendanceStatus;
  late: boolean;
  early: boolean;
  overtime: boolean;
}

/** Deterministic pseudo-random in [0,1) from integers. */
function det(...nums: number[]): number {
  let h = 2166136261;
  for (const n of nums) {
    h ^= n + 0x9e3779b9;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Attendance for one employee on one calendar day (deterministic). */
export function attendanceCell(empId: number, year: number, month: number, day: number): AttendanceCell {
  const date = new Date(year, month - 1, day);
  const none = { late: false, early: false, overtime: false };
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return { status: "dayoff", ...none };
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) return { status: "future", ...none };
  const r = det(empId, year, month, day, 1);
  let status: AttendanceStatus = "present";
  if (r < 0.14) status = "absent";
  else if (r < 0.26) status = "half";
  else if (r < 0.36) status = "leave";
  if (status === "absent" || status === "leave") return { status, ...none };
  return {
    status,
    late: det(empId, year, month, day, 2) < 0.3,
    early: det(empId, year, month, day, 3) < 0.3,
    overtime: det(empId, year, month, day, 4) < 0.28,
  };
}

export function monthWorkingDays(year: number, month: number): number {
  const last = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

export interface AttendanceEdit {
  clockIn: string;
  clockOut: string;
  notes: string;
}
const ATT_EDITS_KEY = "hrm:attendanceEdits";
export async function saveAttendanceEdits(map: Record<string, AttendanceEdit>) {
  await db.meta.put({ key: ATT_EDITS_KEY, value: map });
}
export function useAttendanceEdits(): Record<string, AttendanceEdit> | null | undefined {
  return useLiveQuery(async () => {
    const row = await db.meta.get(ATT_EDITS_KEY);
    return (row?.value as Record<string, AttendanceEdit>) || null;
  }, []);
}
