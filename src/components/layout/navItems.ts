/**
 * File: src/components/layout/navItems.ts
 * Main module navigation (single source of truth for the navbar TopNav and
 * the legacy Sidebar): Dashboard · Sales · Purchases · Items · … · Companies.
 * `useVisibleNavItems()` applies App Settings "Modules" toggles, role
 * permissions and the temporarily-hidden list.
 */

import type React from "react";
import { useMemo } from "react";
import { useAppSettings } from "@/lib/db/appSettings";
import useAuth from "@/hooks/useAuth";
import { requiredPermissionsForPath, usePermissionCatalogSet } from "@/auth/navPermissions";
import {
  Home,
  Users,
  FileText,
  Receipt,
  FileSpreadsheet,
  ClipboardList,
  Truck,
  CreditCard,
  ShoppingCart,
  ShoppingBag,
  Box,
  Wrench,
  Clock,
  FolderOpen,
  BarChart3,
  UserCog,
  Building2,
  Landmark,
  Gift,
  HelpCircle,
  LayoutGrid,
  X,
  Scan,
  User,
  Proportions,
  Handshake,
  BanknoteArrowUp,
  Network,
  FileQuestionMark,
  RefreshCcwDot,
  CornerDownLeft,
  FileStack,
  Calculator,
  Goal,
  CircleDollarSign,
  Copy,
  ChartColumnDecreasing,
  TrendingUp,
  BookText,
  Presentation,
  Images,
  MessageCircleMore,
  Mail,
  BellRing,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: NavItem[];
}

/**
 * Nav item label → App Settings "Modules" name. Items whose module is
 * toggled off in App Settings are hidden from the nav. Labels not listed here
 * are never governed by a module and always show (Dashboard, Customers, …).
 */
const LABEL_MODULE: Record<string, string> = {
  Invoices: "Invoice",
  "Proforma Invoices": "Proforma Invoice",
  "Sales Receipts": "Sales Receipt",
  Estimates: "Estimate",
  "Delivery Challans": "Delivery Challan",
  "Credit Notes": "Credit Note",
  "Payment Received": "Payment Received",
  "Purchase Orders": "Purchase Order",
  Bills: "Bill",
  Expenses: "Expense",
  "Payment Made": "Payment Made",
  "Debit Notes": "Debit Note",
  Products: "Product",
  Services: "Service",
  "Time Logs": "Time Log",
  Projects: "Project",
  Reports: "Report",
  Team: "Team",
  Rewards: "Rewards",
  Banking: "Banking",
  "My Documents": "My Documents",
};

/**
 * Nav entries hidden for now (top-level sections OR child items) — definitions
 * kept below and routes intact; re-enable later by removing the label from this set.
 */
const HIDDEN_LABELS = new Set([
  "Documents",
  "Media Library",
  "Messenger",
  "Zoom Meetings",
  "Team",
  "Banking",
  "Quotation",
  "Timesheet",
  "Notification Templates",
]);

export const navigationItems: NavItem[] = [
  /* ── Reference core ──────────────────────────────────────────── */
  {
    label: "Dashboard",
    icon: Home,
    path: "/dashboard",
    children: [
      { label: "Project Dashboard", icon: ClipboardList, path: "/project-dashboard" },
      { label: "Account Dashboard", icon: User, path: "/account-dashboard" },
      { label: "HRM Dashboard", icon: Proportions, path: "/hrm-dashboard" },
      { label: "Recruitment Dashboard", icon: Handshake, path: "/recruitment-dashboard" },
      { label: "CRM Dashboard", icon: Network, path: "/crm-dashboard" },
      { label: "Support Dashboard", icon: FileQuestionMark, path: "/support-dashboard" },
    ],
  },
  {
    label: "Sales",
    icon: Receipt,
    children: [
      { label: "Customers", icon: Users, path: "/sales/customers" },
      { label: "Invoices", icon: FileText, path: "/sales/sales-invoice" },
      { label: "Proforma Invoices", icon: FileSpreadsheet, path: "/sales/proforma-invoices" },
      { label: "Sales Receipts", icon: Receipt, path: "/sales/sales-receipts" },
      { label: "Estimates", icon: ClipboardList, path: "/sales/estimates" },
      { label: "Delivery Challans", icon: Truck, path: "/sales/delivery-challan" },
      { label: "Credit Notes", icon: CreditCard, path: "/sales/credit-notes" },
      { label: "Payment Received", icon: BanknoteArrowUp, path: "/sales/payment-received" },
      { label: "Sales Invoice Returns", icon: CornerDownLeft, path: "/sales/sales-invoice-returns" },
    ],
  },
  {
    label: "Purchases",
    icon: ShoppingBag,
    children: [
      { label: "Vendors", icon: Building2, path: "/purchase/vendors" },
      { label: "Purchase Orders", icon: ShoppingCart, path: "/purchase/purchase-orders" },
      { label: "Bills", icon: FileText, path: "/purchase/bills" },
      { label: "Expenses", icon: Receipt, path: "/purchase/expense" },
      { label: "Payment Made", icon: CircleDollarSign, path: "/purchase/payment-made" },
      { label: "Debit Notes", icon: CreditCard, path: "/purchase/debit-notes" },
      { label: "Purchase Returns", icon: FileStack, path: "/purchase/purchase-returns" },
      { label: "Warehouses", icon: Box, path: "/purchase/warehouses" },
      { label: "Transfers", icon: RefreshCcwDot, path: "/purchase/transfers" },
    ],
  },
  {
    label: "Items",
    icon: ClipboardList,
    children: [
      { label: "Products", icon: Box, path: "/items/product" },
      { label: "Services", icon: Wrench, path: "/items/services" },
      { label: "System Setup", icon: Settings, path: "/items/system-setup" },
    ],
  },
  {
    label: "CRM",
    icon: Network,
    children: [
      { label: "Leads", icon: Handshake, path: "/crm/leads" },
      { label: "Deals", icon: BanknoteArrowUp, path: "/crm/deals" },
      { label: "Systems Setup", icon: Settings, path: "/crm/system-setup" },
      { label: "Leads Reports", icon: BarChart3, path: "/crm/lead-reports" },
      { label: "Deal Reports", icon: BarChart3, path: "/crm/deal-reports" },
    ],
  },
  {
    label: "HRM",
    icon: ChartColumnDecreasing,
    children: [
      { label: "Employees", icon: Users, path: "/hrm/employees" },
      { label: "Set Salary", icon: CircleDollarSign, path: "/hrm/payslip/set-salary" },
      { label: "Payroll", icon: BanknoteArrowUp, path: "/hrm/payslip/payroll" },
      { label: "Shifts", icon: Clock, path: "/hrm/attendance/shifts" },
      { label: "Attendances", icon: ClipboardList, path: "/hrm/attendance/attendances" },
      { label: "Leave Types", icon: FolderOpen, path: "/hrm/leave-management/leave-types" },
      { label: "Leave Applications", icon: FileText, path: "/hrm/leave-management/leave-applications" },
      { label: "Leave Balance", icon: BarChart3, path: "/hrm/leave-management/leave-balance" },
      { label: "Holidays", icon: FolderOpen, path: "/hrm/holidays" },
      { label: "Awards", icon: Gift, path: "/hrm/awards" },
      { label: "Promotions", icon: TrendingUp, path: "/hrm/promotions" },
      { label: "Resignations", icon: CornerDownLeft, path: "/hrm/resignations" },
      { label: "Terminations", icon: X, path: "/hrm/terminations" },
      { label: "Warnings", icon: FileQuestionMark, path: "/hrm/warnings" },
      { label: "Complaints", icon: FileText, path: "/hrm/complaints" },
      { label: "Transfers", icon: RefreshCcwDot, path: "/hrm/transfers" },
      { label: "Documents", icon: FileText, path: "/hrm/documents" },
      { label: "Acknowledgements", icon: FileText, path: "/hrm/acknowledgements" },
      { label: "Announcements", icon: BellRing, path: "/hrm/announcements" },
      { label: "Events", icon: Clock, path: "/hrm/events" },
      { label: "System Setup", icon: Settings, path: "/hrm/system-setup" },
    ],
  },
  {
    label: "POS",
    icon: ShoppingCart,
    children: [
      { label: "Add POS", icon: ShoppingCart, path: "/pos/create" },
      { label: "POS Orders", icon: ClipboardList, path: "/pos/orders" },
      { label: "Print Barcode", icon: Scan, path: "/pos/barcode" },
      { label: "Sales Report", icon: BarChart3, path: "/pos/reports/sales" },
      { label: "Product Report", icon: BarChart3, path: "/pos/reports/products" },
      { label: "Customer Report", icon: BarChart3, path: "/pos/reports/customers" },
    ],
  },
  {
    label: "Goal",
    icon: Goal,
    children: [
      { label: "Goals", icon: Goal, path: "/goal/goals" },
      { label: "Milestones", icon: FolderOpen, path: "/goal/milestones" },
      { label: "Contributions", icon: CircleDollarSign, path: "/goal/contributions" },
      { label: "Tracking", icon: TrendingUp, path: "/goal/tracking" },
      { label: "Category", icon: FolderOpen, path: "/goal/category" },
    ],
  },
  {
    label: "Projects",
    icon: FolderOpen,
    children: [
      { label: "Projects", icon: FolderOpen, path: "/project/projects" },
      { label: "Projects Report", icon: ClipboardList, path: "/project/projects-report" },
      { label: "System Setup", icon: Settings, path: "/project/system-setup" },
    ],
  },
  {
    label: "Budget Planner",
    icon: CircleDollarSign,
    children: [
      { label: "Budget Periods", icon: Clock, path: "/budget-planner/budget-periods" },
      { label: "Budget", icon: CircleDollarSign, path: "/budget-planner/budget" },
      { label: "Budget Allocations", icon: FolderOpen, path: "/budget-planner/budget-allocations" },
      { label: "Budget Monitoring", icon: BarChart3, path: "/budget-planner/budget-monitoring" },
    ],
  },
  {
    label: "Double Entry",
    icon: Copy,
    children: [
      { label: "Ledger Summary", icon: BookText, path: "/double-entry/ledger-summary" },
      { label: "Trial Balance", icon: BookText, path: "/double-entry/trial-balance" },
      { label: "Balance Sheet", icon: BookText, path: "/double-entry/balance-sheet" },
      { label: "Profit & Loss", icon: TrendingUp, path: "/double-entry/profit-loss" },
      { label: "Reports", icon: BarChart3, path: "/double-entry/reports" },
    ],
  },
  { label: "Rewards", icon: Gift, path: "/rewards" },
  {
    label: "Training",
    icon: TrendingUp,
    children: [
      { label: "Training Types", icon: FolderOpen, path: "/training/training-types" },
      { label: "Trainers", icon: Users, path: "/training/trainers" },
      { label: "Training List", icon: ClipboardList, path: "/training/training-list" },
    ],
  },
  { label: "Time Logs", icon: Clock, path: "/time-logs" },
  {
    label: "Documents",
    icon: FileText,
    children: [
      { label: "My Documents", icon: FileText, path: "/documents/my-documents" },
      { label: "Quick Scan", icon: Scan, path: "/documents/quick-scan" },
    ],
  },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "Banking", icon: Landmark, path: "/banking" },

  /* ── Accounting & finance ────────────────────────────────────── */
  {
    label: "Accounting",
    icon: Calculator,
    children: [
      { label: "Bank Accounts", icon: Landmark, path: "/accounting/bank-accounts" },
      { label: "Bank Transaction", icon: RefreshCcwDot, path: "/accounting/bank-transaction" },
      { label: "Bank Transfers", icon: RefreshCcwDot, path: "/accounting/bank-transfers" },
      { label: "Chart of Accounts", icon: BookText, path: "/accounting/chart-of-accounts" },
      { label: "Vendor Payments", icon: CircleDollarSign, path: "/accounting/vendor-payments" },
      { label: "Customer Payments", icon: CircleDollarSign, path: "/accounting/customer-payments" },
      { label: "Revenue", icon: TrendingUp, path: "/accounting/revenue" },
      { label: "Reports", icon: BarChart3, path: "/accounting/reports" },
      { label: "System", icon: Settings, path: "/accounting/system" },
    ],
  },
  /* ── CRM, Support & Contracts ────────────────────────────────── */
  {
    label: "Support Ticket",
    icon: FileQuestionMark,
    children: [
      { label: "Tickets", icon: FileText, path: "/support-ticket/tickets" },
      { label: "Knowledge Base", icon: BookText, path: "/support-ticket/knowledge-base" },
      { label: "FAQ", icon: FileQuestionMark, path: "/support-ticket/faq" },
      { label: "Contacts", icon: Users, path: "/support-ticket/contact" },
      { label: "System Setup", icon: Settings, path: "/support-ticket/system-setup" },
    ],
  },
  {
    label: "Contract",
    icon: BookText,
    children: [
      { label: "Contracts", icon: FileText, path: "/contract/contracts" },
      { label: "Contract Types", icon: FileStack, path: "/contract/contract-types" },
    ],
  },

  /* ── HR suite ────────────────────────────────────────────────── */
  {
    label: "Performance",
    icon: TrendingUp,
    children: [
      { label: "Performance Indicators", icon: BarChart3, path: "/performance/performance-indicators" },
      { label: "Employee Goals", icon: Goal, path: "/performance/employee-goals" },
      { label: "Employee Reviews", icon: FileText, path: "/performance/employee-reviews" },
      { label: "Review Cycles", icon: RefreshCcwDot, path: "/performance/review-cycles" },
      { label: "System Setup", icon: Settings, path: "/performance/system-setup" },
    ],
  },
  {
    label: "Recruitment",
    icon: Handshake,
    children: [
      { label: "Job Locations", icon: FolderOpen, path: "/recruitment/job-locations" },
      { label: "Custom Questions", icon: FileQuestionMark, path: "/recruitment/custom-questions" },
      { label: "Job Postings", icon: FileText, path: "/recruitment/job-postings" },
      { label: "Candidates", icon: Users, path: "/recruitment/candidates" },
      { label: "Interview Rounds", icon: RefreshCcwDot, path: "/recruitment/interview-rounds" },
      { label: "Interview", icon: Presentation, path: "/recruitment/interview" },
      { label: "Interview Feedback", icon: FileText, path: "/recruitment/interview-feedback" },
      { label: "Candidate Assessments", icon: ClipboardList, path: "/recruitment/candidate-assessments" },
      { label: "Offers", icon: Gift, path: "/recruitment/offers" },
      { label: "Checklists Items", icon: ClipboardList, path: "/recruitment/checklist-items" },
      { label: "Candidate Onboarding", icon: Handshake, path: "/recruitment/candidate-onboarding" },
      { label: "System Setup", icon: Settings, path: "/recruitment/system-setup" },
    ],
  },
  {
    label: "User Management",
    icon: UserCog,
    children: [
      { label: "Roles", icon: UserCog, path: "/user-management/user-roles" },
      { label: "User", icon: Network, path: "/user-management/users" },
    ],
  },

  /* ── Tools & extras ──────────────────────────────────────────── */
  { label: "Proposal", icon: RefreshCcwDot, path: "/proposal" },
  { label: "Quotation", icon: Clock, path: "/quotation" },
  { label: "Timesheet", icon: Clock, path: "/timesheet" },
  { label: "Media Library", icon: Images, path: "/media-library" },
  { label: "Messenger", icon: MessageCircleMore, path: "/messenger" },
  { label: "Form Builder", icon: BookText, path: "/form-builder" },
  { label: "Zoom Meetings", icon: Presentation, path: "/zoom-meetings" },
  { label: "Email Templates", icon: Mail, path: "/email-templates" },
  { label: "Notification Templates", icon: BellRing, path: "/notification-templates" },
  { label: "Plan", icon: Building2, path: "/plan" },

  /* Always last */
  { label: "Companies", icon: Building2, path: "/companies" },
];

/** Shown after the modules (was the sidebar footer). */
export const helpNavItem: NavItem = { label: "Get Help", icon: HelpCircle, path: "/get-help" };

/** Nav items filtered by App Settings modules, role permissions and HIDDEN_LABELS. */
export function useVisibleNavItems(): NavItem[] {
  // Live "Modules" toggles from App Settings → hide disabled modules from the nav.
  const modules = useAppSettings("modules");
  // Permission-based visibility: hide a path if the catalog models a
  // permission for it and the user's role doesn't have it. A path with no
  // matching permission anywhere in the catalog stays visible (fail-open).
  const { hasAnyPermission } = useAuth();
  const permissionCatalogSet = usePermissionCatalogSet();

  return useMemo(() => {
    const moduleOn = (label: string) => {
      const m = LABEL_MODULE[label];
      return !m || modules[m] !== false; // ungoverned items and defaults stay visible
    };
    const permissionOn = (path?: string) => {
      const required = requiredPermissionsForPath(path, permissionCatalogSet);
      return required.length === 0 || hasAnyPermission(required);
    };
    return (
      navigationItems
        .filter((item) => !HIDDEN_LABELS.has(item.label)) // temporarily hidden sections
        .map((item) =>
          item.children
            ? {
                ...item,
                children: item.children.filter(
                  (c) => moduleOn(c.label) && permissionOn(c.path) && !HIDDEN_LABELS.has(c.label),
                ),
              }
            : item,
        )
        // drop a governed top-level leaf that's off, and any group left with no children
        .filter((item) =>
          item.children ? item.children.length > 0 : moduleOn(item.label) && permissionOn(item.path),
        )
    );
  }, [modules, permissionCatalogSet, hasAnyPermission]);
}

export const hasPages = (i: NavItem) => !!i.children && i.children.length > 0;

/** Overflowed modules as columns; single pages grouped under "More". */
export function groupModules(items: NavItem[]): NavItem[] {
  const groups = items.filter(hasPages);
  const singles = items.filter((i) => !hasPages(i));
  return singles.length ? [...groups, { label: "More", icon: LayoutGrid, children: singles }] : groups;
}

/** Keep groups whose name matches (all pages) or the pages that match. */
export function filterModuleGroups(groups: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) =>
      g.label.toLowerCase().includes(q)
        ? g
        : { ...g, children: g.children?.filter((c) => c.label.toLowerCase().includes(q)) },
    )
    .filter(hasPages);
}
