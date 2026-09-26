/**
 * File: src/services/hrm.ts
 * HRM module — the largest surface area in the app.
 *
 *   - Setup masters  : conventional CRUD under /hrm/setup/* (PUT updates)
 *   - Employees      : /hrm/employees (+ generate-id, lookups, eligible-users)
 *   - Leave          : /hrm/leave (+ balances, types, status)
 *   - Attendance     : /hrm/attendances (+ clock, history)
 *   - Payroll        : /hrm/payroll (set-salary, allowances/deductions/loans/
 *                      overtimes, payroll runs, payslip entries)
 *   - Workflow       : holidays, awards, promotions, resignations, terminations,
 *                      warnings, complaints, transfers, events, announcements,
 *                      documents, acknowledgments (most expose /:id/status)
 */

import { createResourceHooks } from "@/hooks/useResource";
import type { Entity } from "@/lib/api/types";
import { api } from "@/lib/api/client";
import {
  makeResource,
  getList,
  getOne,
  postJson,
  putJson,
  patchJson,
  deleteJson,
} from "./_http";

const BASE = "/hrm";

/** Loose master record — masters mostly carry a single name-ish field. */
export interface HrmMaster extends Entity {
  [key: string]: any;
}

/** Setup master with PUT updates and conventional CRUD. */
function setupResource(entity: string) {
  return makeResource<HrmMaster>({ list: `${BASE}/setup/${entity}`, updateMethod: "put" });
}

/** Top-level workflow entity with PUT updates + optional /:id/status. */
function workflowResource(entity: string) {
  return makeResource<HrmMaster>({ list: `${BASE}/${entity}`, updateMethod: "put" });
}

/** Generic status transition: PUT /hrm/{entity}/{id}/status { status, ...extra }. */
function statusAction(entity: string) {
  return (id: string, status: string, extra: Record<string, unknown> = {}) =>
    putJson(`${BASE}/${entity}/${id}/status`, { status, ...extra });
}

// ════════════════════════════════════════════════════════════════════════════
// Setup masters
// ════════════════════════════════════════════════════════════════════════════

export const branchesService = setupResource("branches");
export const departmentsService = setupResource("departments");
export const designationsService = setupResource("designations");
export const shiftsService = setupResource("shifts");
export const employeeDocumentTypesService = setupResource("employee-document-types");
export const awardTypesService = setupResource("award-types");
export const terminationTypesService = setupResource("termination-types");
export const warningTypesService = setupResource("warning-types");
export const complaintTypesService = setupResource("complaint-types");
export const holidayTypesService = setupResource("holiday-types");
export const documentCategoriesService = setupResource("document-categories");
export const announcementCategoriesService = setupResource("announcement-categories");
export const eventTypesService = setupResource("event-types");
export const allowanceTypesService = setupResource("allowance-types");
export const deductionTypesService = setupResource("deduction-types");
export const loanTypesService = setupResource("loan-types");
export const leaveTypesService = setupResource("leave-types");
export const ipRestrictsService = setupResource("ip-restricts");

export const branchHooks = createResourceHooks("hrm-branches", branchesService);
export const departmentHooks = createResourceHooks("hrm-departments", departmentsService);
export const designationHooks = createResourceHooks("hrm-designations", designationsService);
export const shiftHooks = createResourceHooks("hrm-shifts", shiftsService);
export const employeeDocumentTypeHooks = createResourceHooks("hrm-employee-document-types", employeeDocumentTypesService);
export const awardTypeHooks = createResourceHooks("hrm-award-types", awardTypesService);
export const terminationTypeHooks = createResourceHooks("hrm-termination-types", terminationTypesService);
export const warningTypeHooks = createResourceHooks("hrm-warning-types", warningTypesService);
export const complaintTypeHooks = createResourceHooks("hrm-complaint-types", complaintTypesService);
export const holidayTypeHooks = createResourceHooks("hrm-holiday-types", holidayTypesService);
export const documentCategoryHooks = createResourceHooks("hrm-document-categories", documentCategoriesService);
export const announcementCategoryHooks = createResourceHooks("hrm-announcement-categories", announcementCategoriesService);
export const eventTypeHooks = createResourceHooks("hrm-event-types", eventTypesService);
export const allowanceTypeHooks = createResourceHooks("hrm-allowance-types", allowanceTypesService);
export const deductionTypeHooks = createResourceHooks("hrm-deduction-types", deductionTypesService);
export const loanTypeHooks = createResourceHooks("hrm-loan-types", loanTypesService);
export const leaveTypeHooks = createResourceHooks("hrm-leave-types", leaveTypesService);
export const ipRestrictHooks = createResourceHooks("hrm-ip-restricts", ipRestrictsService);

export const hrmSetupExtras = {
  getWorkingDays: () => getOne(`${BASE}/setup/working-days`),
  updateWorkingDays: (working_days: number[]) => putJson(`${BASE}/setup/working-days`, { working_days }),
  toggleIpRestrict: (enabled: boolean) => postJson(`${BASE}/setup/ip-restricts/toggle-setting`, { enabled }),
};

// ════════════════════════════════════════════════════════════════════════════
// Employees
// ════════════════════════════════════════════════════════════════════════════

export interface Employee extends Entity {
  user_id?: string | { _id?: string; name?: string; email?: string };
  employee_id?: string;
  branch_id?: string | { _id?: string; branch_name?: string };
  department_id?: string | { _id?: string; department_name?: string };
  designation_id?: string | { _id?: string; designation_name?: string };
  shift_id?: string | { _id?: string; shift_name?: string };
  date_of_joining?: string;
  basic_salary?: number;
  [key: string]: any;
}

export const employeesService = makeResource<Employee>({ list: `${BASE}/employees`, updateMethod: "put" });
export const employeeHooks = createResourceHooks("hrm-employees", employeesService);

export const employeeApi = {
  generateId: () => getOne<{ employee_id?: string }>(`${BASE}/employees/generate-id`),
  eligibleUsers: () => getList(`${BASE}/employees/eligible-users`),
  lookups: () => getOne(`${BASE}/employees/lookups`),
  shiftsByEmployee: (employeeProfileId: string) => getList(`${BASE}/employees/${employeeProfileId}/shifts`),
  deleteDocument: (employeeProfileId: string, documentId: string) =>
    deleteJson(`${BASE}/employees/${employeeProfileId}/documents/${documentId}`),
};

// ════════════════════════════════════════════════════════════════════════════
// Leave
// ════════════════════════════════════════════════════════════════════════════

export interface LeaveApplication extends Entity {
  employee_id?: string | { _id?: string; name?: string };
  leave_type_id?: string | { _id?: string; name?: string };
  start_date: string;
  end_date: string;
  reason?: string;
  status?: "pending" | "approved" | "rejected" | string;
  approver_comment?: string;
  [key: string]: any;
}

export const leaveService = makeResource<LeaveApplication>({ list: `${BASE}/leave`, updateMethod: "put" });
export const leaveHooks = createResourceHooks("hrm-leave", leaveService);

export const leaveApi = {
  types: () => getList(`${BASE}/leave/types`),
  balance: (employeeId?: string) => getOne(`${BASE}/leave/balance`, employeeId ? { employee_id: employeeId } : undefined),
  balanceAllEmployees: () => getList(`${BASE}/leave/balance/all-employees`),
  balanceSingle: (employeeId: string, leaveTypeId: string) =>
    getOne(`${BASE}/leave/balance/${employeeId}/${leaveTypeId}`),
  typesByEmployee: (employeeId: string) => getList(`${BASE}/leave/types-by-employee/${employeeId}`),
  setStatus: (id: string, status: string, approver_comment?: string) =>
    putJson(`${BASE}/leave/${id}/status`, { status, approver_comment }),
};

// ════════════════════════════════════════════════════════════════════════════
// Attendance
// ════════════════════════════════════════════════════════════════════════════

export interface Attendance extends Entity {
  employee_id?: string | { _id?: string; name?: string };
  shift_id?: string | { _id?: string; shift_name?: string };
  date?: string;
  status?: "present" | "absent" | "late" | string;
  clock_in?: string;
  clock_out?: string;
  [key: string]: any;
}

export const attendancesService = makeResource<Attendance>({ list: `${BASE}/attendances`, updateMethod: "put" });
export const attendanceHooks = createResourceHooks("hrm-attendances", attendancesService);

export const attendanceApi = {
  grid: (params: { year: number; month: number; employee_id?: string; searchTerm?: string }) =>
    getOne<{
      year: number;
      month: number;
      days_in_month: number;
      employees: {
        _id: string;
        employee_user_id: string;
        name: string;
        email: string;
        employee_code: string;
      }[];
      cells: Record<
        string,
        {
          _id: string;
          clock_in: string;
          clock_out: string;
          status: string;
          notes: string;
          total_hour: number;
        }
      >;
    }>(`${BASE}/attendances/grid`, params as any),
  createManual: (body: Record<string, unknown>) =>
    postJson(`${BASE}/attendances`, body),
  updateManual: (id: string, body: Record<string, unknown>) =>
    putJson(`${BASE}/attendances/${id}`, body),
  clockStatus: () => getOne(`${BASE}/attendances/clock-status`),
  clockInOut: () => postJson(`${BASE}/attendances/clock-in-out`),
  history: (body: { from_date: string; to_date: string }) => postJson(`${BASE}/attendances/history`, body),
};

// ════════════════════════════════════════════════════════════════════════════
// Payroll
// ════════════════════════════════════════════════════════════════════════════

export interface Payroll extends Entity {
  title: string;
  payroll_frequency?: string;
  pay_period_start?: string;
  pay_period_end?: string;
  status?: string;
  [key: string]: any;
}

export const payrollService = makeResource<Payroll>({ list: `${BASE}/payroll`, updateMethod: "put" });
export const payrollHooks = createResourceHooks("hrm-payroll", payrollService);

export const payrollApi = {
  // Salary structure
  setSalaryList: (params?: { searchTerm?: string; page?: number; limit?: number }) =>
    getList(`${BASE}/payroll/set-salary`, params),
  getSalary: (employeeProfileId: string) => getOne(`${BASE}/payroll/set-salary/${employeeProfileId}`),
  updateSalary: (employeeProfileId: string, body: { basic_salary: number }) =>
    putJson(`${BASE}/payroll/set-salary/${employeeProfileId}`, body),

  addAllowance: (employeeProfileId: string, body: unknown) =>
    postJson(`${BASE}/payroll/set-salary/${employeeProfileId}/allowances`, body),
  editAllowance: (id: string, body: unknown) => putJson(`${BASE}/payroll/allowances/${id}`, body),
  deleteAllowance: (id: string) => deleteJson(`${BASE}/payroll/allowances/${id}`),

  addDeduction: (employeeProfileId: string, body: unknown) =>
    postJson(`${BASE}/payroll/set-salary/${employeeProfileId}/deductions`, body),
  editDeduction: (id: string, body: unknown) => putJson(`${BASE}/payroll/deductions/${id}`, body),
  deleteDeduction: (employeeProfileId: string, id: string) =>
    deleteJson(`${BASE}/payroll/set-salary/${employeeProfileId}/deductions/${id}`),

  addLoan: (employeeProfileId: string, body: unknown) =>
    postJson(`${BASE}/payroll/set-salary/${employeeProfileId}/loans`, body),
  editLoan: (id: string, body: unknown) => putJson(`${BASE}/payroll/loans/${id}`, body),
  deleteLoan: (employeeProfileId: string, id: string) =>
    deleteJson(`${BASE}/payroll/set-salary/${employeeProfileId}/loans/${id}`),

  addOvertime: (employeeProfileId: string, body: unknown) =>
    postJson(`${BASE}/payroll/set-salary/${employeeProfileId}/overtimes`, body),
  editOvertime: (id: string, body: unknown) => putJson(`${BASE}/payroll/overtimes/${id}`, body),
  deleteOvertime: (employeeProfileId: string, id: string) =>
    deleteJson(`${BASE}/payroll/set-salary/${employeeProfileId}/overtimes/${id}`),

  // Payroll runs
  get: (payrollId: string) => getOne<{ payroll: Record<string, unknown>; entries: Record<string, unknown>[] }>(`${BASE}/payroll/${payrollId}`),
  run: (payrollId: string) => postJson(`${BASE}/payroll/${payrollId}/run`),
  // Payslip entries
  payslipPrintUrl: (entryId: string) => `${BASE}/payroll/entries/${entryId}/print`,
  deletePayslip: (entryId: string) => deleteJson(`${BASE}/payroll/entries/${entryId}`),
  payPayslip: (entryId: string) => patchJson(`${BASE}/payroll/entries/${entryId}/pay`),
};

// ════════════════════════════════════════════════════════════════════════════
// Workflow entities
// ════════════════════════════════════════════════════════════════════════════

export const holidaysService = workflowResource("holidays");
export const awardsService = workflowResource("awards");
export const promotionsService = workflowResource("promotions");
export const resignationsService = workflowResource("resignations");
export const terminationsService = workflowResource("terminations");
export const warningsService = workflowResource("warnings");
export const complaintsService = workflowResource("complaints");
export const employeeTransfersService = workflowResource("employee-transfers");
export const eventsService = workflowResource("events");
export const announcementsService = workflowResource("announcements");
export const documentsService = workflowResource("documents");
export const acknowledgmentsService = workflowResource("acknowledgments");

export const holidayHooks = createResourceHooks("hrm-holidays", holidaysService);
export const awardHooks = createResourceHooks("hrm-awards", awardsService);
export const promotionHooks = createResourceHooks("hrm-promotions", promotionsService);
export const resignationHooks = createResourceHooks("hrm-resignations", resignationsService);
export const terminationHooks = createResourceHooks("hrm-terminations", terminationsService);
export const warningHooks = createResourceHooks("hrm-warnings", warningsService);
export const complaintHooks = createResourceHooks("hrm-complaints", complaintsService);
export const employeeTransferHooks = createResourceHooks("hrm-employee-transfers", employeeTransfersService);
export const eventHooks = createResourceHooks("hrm-events", eventsService);
export const announcementHooks = createResourceHooks("hrm-announcements", announcementsService);
export const documentHooks = createResourceHooks("hrm-documents", documentsService);
export const acknowledgmentHooks = createResourceHooks("hrm-acknowledgments", acknowledgmentsService);

export const hrmStatusActions = {
  promotion: statusAction("promotions"),
  resignation: statusAction("resignations"),
  /** Alternate resignation status route: PUT /resignations/:id/status/:status */
  resignationStatusPath: (id: string, status: string) =>
    putJson(`${BASE}/resignations/${id}/status/${status}`),
  termination: statusAction("terminations"),
  complaint: statusAction("complaints"),
  employeeTransfer: statusAction("employee-transfers"),
  event: statusAction("events"),
  announcement: statusAction("announcements"),
  document: statusAction("documents"),
  acknowledgment: statusAction("acknowledgments"),
  warningResponse: (id: string, employee_response: string) =>
    putJson(`${BASE}/warnings/${id}/response`, { employee_response }),
};

export const hrmExtras = {
  dashboard: () => getOne(`${BASE}/dashboard`),
  dashboardEventCalendar: () => getOne(`${BASE}/dashboard/event-calendar`),
  eventCalendar: () => getList(`${BASE}/events/event-calendar`),
};

/** Normalized HRM dashboard payload for the UI (hub + legacy shapes). */
export type HrmDashboardPayload = {
  stats: {
    total_employees: number;
    present_today: number;
    absent_today: number;
    on_leave: number;
    pending_leaves: number;
    total_branches: number;
    total_departments: number;
    promotions_this_month: number;
    terminations_this_month: number;
  };
  departmentDistribution: { name: string; count: number }[];
  employeesOnLeave: { name: string; type: string; days: number; avatar?: string }[];
  recentLeaveApplications: {
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    status: string;
  }[];
  announcements: { title: string; description: string; date?: string }[];
  teamMembers: {
    name: string;
    role: string;
    department: string;
    attendance?: number;
    avatar?: string;
  }[];
  upcomingBirthdays: { name: string; date: string; role: string; avatar?: string }[];
};

const emptyHrmStats: HrmDashboardPayload["stats"] = {
  total_employees: 0,
  present_today: 0,
  absent_today: 0,
  on_leave: 0,
  pending_leaves: 0,
  total_branches: 0,
  total_departments: 0,
  promotions_this_month: 0,
  terminations_this_month: 0,
};

const fmtDay = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function normalizeHrmDashboard(raw: unknown): HrmDashboardPayload {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const s = (d.stats && typeof d.stats === "object" ? d.stats : {}) as Record<string, any>;

  const deptSrc = Array.isArray(d.departmentDistribution)
    ? d.departmentDistribution
    : Array.isArray(s.department_distribution)
      ? s.department_distribution
      : [];
  const onLeaveSrc = Array.isArray(d.employeesOnLeave)
    ? d.employeesOnLeave
    : Array.isArray(s.employees_on_leave_today)
      ? s.employees_on_leave_today
      : [];
  const leaveAppsSrc = Array.isArray(d.recentLeaveApplications)
    ? d.recentLeaveApplications
    : Array.isArray(s.recent_leave_applications)
      ? s.recent_leave_applications
      : [];
  const annSrc = Array.isArray(d.announcements)
    ? d.announcements
    : Array.isArray(s.recent_announcements)
      ? s.recent_announcements
      : [];
  const bdaySrc = Array.isArray(d.upcomingBirthdays)
    ? d.upcomingBirthdays
    : Array.isArray(s.upcoming_birthdays)
      ? s.upcoming_birthdays
      : [];
  const teamSrc = Array.isArray(d.teamMembers)
    ? d.teamMembers
    : Array.isArray(s.team_members)
      ? s.team_members
      : [];

  return {
    stats: {
      ...emptyHrmStats,
      total_employees: Number(s.total_employees) || 0,
      present_today: Number(s.present_today) || 0,
      absent_today: Number(s.absent_today) || 0,
      on_leave: Number(s.on_leave) || 0,
      pending_leaves: Number(s.pending_leaves) || 0,
      total_branches: Number(s.total_branches) || 0,
      total_departments: Number(s.total_departments) || 0,
      promotions_this_month: Number(s.promotions_this_month ?? s.total_promotions) || 0,
      terminations_this_month: Number(s.terminations_this_month ?? s.terminations) || 0,
    },
    departmentDistribution: deptSrc.map((x: any) => ({
      name: String(x.name || "—"),
      count: Number(x.count ?? x.value) || 0,
    })),
    employeesOnLeave: onLeaveSrc.map((x: any) => ({
      name: String(x.name || "—"),
      type: String(x.type || x.leave_type || "Leave"),
      days: Number(x.days) || 0,
      avatar: x.avatar || x.profile || undefined,
    })),
    recentLeaveApplications: leaveAppsSrc.map((x: any) => ({
      name: String(x.name || x.employee_name || "—"),
      type: String(x.type || x.leave_type || "Leave"),
      startDate: fmtDay(x.startDate ?? x.start_date),
      endDate: fmtDay(x.endDate ?? x.end_date),
      days: Number(x.days ?? x.total_days) || 0,
      status: cap(String(x.status || "pending")),
    })),
    announcements: annSrc.map((x: any) => ({
      title: String(x.title || ""),
      description: String(x.description || ""),
      date: x.date ? fmtDay(x.date) : x.created_at ? fmtDay(x.created_at) : undefined,
    })),
    teamMembers: teamSrc.map((x: any) => ({
      name: String(x.name || "—"),
      role: String(x.role || "—"),
      department: String(x.department || "—"),
      attendance:
        x.attendance != null && Number(x.attendance) > 0 ? Number(x.attendance) : undefined,
      avatar: x.avatar || undefined,
    })),
    upcomingBirthdays: bdaySrc.map((x: any) => ({
      name: String(x.name || x.employee_name || "—"),
      date: String(
        x.date ||
          (x.next_birthday ? fmtDay(x.next_birthday) : "") ||
          (x.days_until != null ? `In ${x.days_until}d` : "—"),
      ),
      role: String(x.role || ""),
      avatar: x.avatar || undefined,
    })),
  };
}

/** Prefer hub `/dashboard/hrm`, fall back to legacy `/hrm/dashboard`. */
export async function fetchHrmDashboard(): Promise<HrmDashboardPayload> {
  try {
    const data = await api.get<unknown>("/dashboard/hrm");
    return normalizeHrmDashboard(data);
  } catch {
    const data = await api.get<unknown>("/hrm/dashboard");
    return normalizeHrmDashboard(data);
  }
}

/** Staff mobile app endpoints (same backend, staff token). */
export const mobileApi = {
  home: () => getOne(`${BASE}/mobile/home`),
  events: (body: { from_date: string; to_date: string }) =>
    postJson(`${BASE}/mobile/events`, body),
  holidaysList: () => getList(`${BASE}/mobile/holidays-list`),
  attendanceHistory: (body: { from_date: string; to_date: string }) =>
    postJson(`${BASE}/mobile/attendance-history`, body),
  clockInOut: () => postJson(`${BASE}/mobile/clock-in-out`),
  leaves: () => getList(`${BASE}/mobile/leaves`),
  leaveRequest: (body: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) => postJson(`${BASE}/mobile/leave-request`, body),
  leaveTypes: () => getList(`${BASE}/mobile/leave-types`),
};

/** Form lookup helpers used by workflow screens. */
export const hrmLookupApi = {
  warningBies: (userId: string) => getList(`${BASE}/users/${userId}/warning-bies`),
  warningTypesForUser: (userId: string) => getList(`${BASE}/users/${userId}/warning-types`),
  eventTypeApprovedBies: (eventTypeId: string) =>
    getList(`${BASE}/event-types/${eventTypeId}/approved-bies`),
};
