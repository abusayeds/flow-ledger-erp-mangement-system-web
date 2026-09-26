/**
 * File: src/components/layout/Sidebar.tsx
 * Sidebar structured to match the reference design:
 *   Dashboard · Sales · Purchases · Items · Time Logs · Projects ·
 *   Documents · Reports · Team · Rewards · Banking · … · Companies (last)
 * All existing modules are kept and grouped below the reference core.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
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
  Package,
  Box,
  Wrench,
  Clock,
  FolderOpen,
  BarChart3,
  UserCog,
  Building2,
  Landmark,
  Gift,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Menu,
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
import Logo from "../../assets/logo.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: NavItem[];
}

/**
 * Sidebar item label → App Settings "Modules" name. Items whose module is
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

const navigationItems: NavItem[] = [
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

  /* Last item — always at the bottom of the main sidebar */
  { label: "Companies", icon: Building2, path: "/companies" },
];

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const COLLAPSED_WIDTH = 60;
const DEFAULT_WIDTH = 260;

export const Sidebar: React.FC<SidebarProps> = ({
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const location = useLocation();
  // Live "Modules" toggles from App Settings → hide disabled modules from the nav.
  const modules = useAppSettings("modules");
  const moduleOn = (label: string) => {
    const m = LABEL_MODULE[label];
    return !m || modules[m] !== false; // ungoverned items and defaults stay visible
  };
  // Permission-based visibility: hide a path if the catalog models a
  // permission for it and the user's role doesn't have it. A path with no
  // matching permission anywhere in the catalog stays visible (fail-open).
  const { hasAnyPermission } = useAuth();
  const permissionCatalogSet = usePermissionCatalogSet();
  const permissionOn = (path?: string) => {
    const required = requiredPermissionsForPath(path, permissionCatalogSet);
    return required.length === 0 || hasAnyPermission(required);
  };
  const visibleItems = useMemo(
    () =>
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
        ),
    [modules, permissionCatalogSet, hasAnyPermission],
  );
  const [expandedItems, setExpandedItems] = useState<string[]>(["Sales"]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 1024px)").matches,
  );

  // Sidebar width is now driven purely by collapsed state (toggled via the
  // burger icon) — no drag-to-resize. Only the middle list panel is resizable.
  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : DEFAULT_WIDTH;

  // Track desktop vs. mobile so the collapse behaviour (a desktop-only
  // feature) never leaks into the mobile slide-in drawer.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // On mobile the drawer is always full-width/expanded, regardless of the width
  // the user dragged to or collapsed on desktop.
  const collapsed = isDesktop && isCollapsed;

  const toggleCollapse = () => setIsCollapsed((c) => !c);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isParentActive = (children?: NavItem[]) => {
    if (!children) return false;
    return children.some((child) => location.pathname === child.path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          h-screen w-72 max-w-[85vw] lg:max-w-none flex flex-col
          transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
        {/* Logo Header */}
        <div className="h-16 flex-shrink-0 flex items-center justify-between px-4 bg-white border-b border-gray-200">
          {!collapsed && (
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
              {/* Logo Icon */}
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                <img src={Logo} alt="Qayd Logo" />
              </div>
              {/* Logo Text */}
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Qayd
              </h1>
            </Link>
          )}

          {collapsed && (
            <div className="flex items-center justify-center w-full">
              <button
                className="hidden lg:flex p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                onClick={toggleCollapse}
                title="Expand sidebar"
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          )}

          {/* Mobile Close / Desktop Menu Toggle */}
          {!collapsed && (
            <>
              <button
                className="lg:hidden p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
              <button
                className="hidden lg:block p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                onClick={toggleCollapse}
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>
            </>
          )}
        </div>

        {/* Menu & Footer Container */}
        <div className="sidebar-nav-shell flex-1 overflow-hidden flex flex-col my-2 ml-2 border border-r-0 shadow-sm">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 hover-scrollbar">
          <ul className="">
            {visibleItems.map((item) => (
              <li key={item.label}>
                {/* Parent with Children */}
                {item.children && item.children.length > 0 ? (
                  <>
                    <button
                      onClick={() => !collapsed && toggleExpand(item.label)}
                      className={`
                        sidebar-nav-item w-full flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2.5 py-2
                         font-normal transition-all duration-150 border-y border-transparent
                        ${
                          isParentActive(item.children)
                            ? "is-active bg-blue-600 shadow-sm"
                            : "hover:bg-black/10"
                        }
                      `}
                      title={collapsed ? item.label : ""}
                    >
                      <div
                        className={`flex items-center ${collapsed ? "" : "gap-2.5"}`}
                      >
                        <item.icon
                          className="w-[16px] h-[16px]"
                          strokeWidth={1.8}
                        />
                        {!collapsed && (
                          <span className="tracking-tight">{item.label}</span>
                        )}
                      </div>
                      {!collapsed &&
                        (expandedItems.includes(item.label) ? (
                          <ChevronDown
                            className="w-3.5 h-3.5 opacity-70"
                            strokeWidth={2}
                          />
                        ) : (
                          <ChevronRight
                            className="w-3.5 h-3.5 opacity-70"
                            strokeWidth={2}
                          />
                        ))}
                    </button>

                    {/* Children - icon + label */}
                    {!collapsed && expandedItems.includes(item.label) && (
                      <ul className="sidebar-nav-children mt-0.5 space-y-0.5 ml-5 border-l border-current/15">
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <Link
                              to={child.path || "#"}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`
                                sidebar-nav-item flex items-center gap-2.5 px-2.5 py-2
                                 transition-all duration-150
                                ${
                                  isActive(child.path)
                                    ? "is-active bg-blue-600 font-medium shadow-sm"
                                    : "hover:bg-black/10"
                                }
                              `}
                            >
                              <child.icon
                                className="w-[15px] h-[15px] flex-shrink-0"
                                strokeWidth={1.8}
                              />
                              <span className="tracking-tight">
                                {child.label}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  /* Single Item */
                  <Link
                    to={item.path || "#"}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      sidebar-nav-item flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-2.5 py-2
                       font-normal transition-all duration-150
                      ${
                        isActive(item.path)
                          ? "is-active bg-blue-600 font-medium shadow-sm"
                          : "hover:bg-black/10"
                      }
                    `}
                    title={collapsed ? item.label : ""}
                  >
                    <item.icon
                      className="w-[16px] h-[16px]"
                      strokeWidth={1.8}
                    />
                    {!collapsed && (
                      <span className="tracking-tight">{item.label}</span>
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Get Help Footer */}
        <div className="sidebar-nav-footer border-t border-current/15 p-2">
          <Link
            to="/get-help"
            className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-2.5 py-2 rounded-md hover:bg-black/10 transition-all duration-150`}
            title={collapsed ? "Get Help" : ""}
          >
            <HelpCircle className="w-[16px] h-[16px]" strokeWidth={1.8} />
            {!collapsed && <span className="tracking-tight">Get Help</span>}
          </Link>
        </div>
        </div>
      </div>
    </>
  );
};
