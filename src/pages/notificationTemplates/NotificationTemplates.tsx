/**
 * File: src/pages/notifications/NotificationTemplates.tsx
 * Notification Templates — exact match for both screenshots:
 *
 * View 1 — Manage Notification Templates (list):
 *   - Slack | Telegram | Twilio tab strip (underline style, no border/bg)
 *   - Search notification templates... + green Search button
 *   - 10 per page dropdown (no Filters button)
 *   - Table: Subject (sortable) | Module (sortable) | Actions (edit pencil only)
 *   - 32 templates across 4 pages (Previous / 1 / 2 / 3 / 4 / Next)
 *
 * View 2 — Edit Notification Template:
 *   - Breadcrumb: Dashboard > Notification Templates > Edit Notification Template
 *   - Page title: "Edit Notification Template : {name}" + ← Back button (top right)
 *   - Left panel (no border, just card): Variables — label: {token} in emerald
 *   - Right panel: GB Content for English header + English dropdown
 *                  Subject* input | Notification Message* textarea | Save Changes button
 */

import React, { useState } from "react";
import {
  Globe,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  ArrowLeft,
  Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifTab = "slack" | "telegram" | "twilio";

interface NotifTemplate {
  id: number;
  subject: string;
  module: string;
  message: string;
  variables: { label: string; token: string }[];
}

// ─── Sample Data (32 templates, 4 pages) ──────────────────────────────────────

const allTemplates: NotifTemplate[] = [
  {
    id: 1,
    subject: "New User",
    module: "general",
    message: "A New User {user_name} has been created by {company_name}",
    variables: [
      { label: "User Name:", token: "{user_name}" },
      { label: "Company Name:", token: "{company_name}" },
    ],
  },
  {
    id: 2,
    subject: "New Sales Invoice",
    module: "general",
    message:
      "A new sales invoice #{invoice_number} has been created for {client_name}",
    variables: [
      { label: "Invoice Number:", token: "{invoice_number}" },
      { label: "Client Name:", token: "{client_name}" },
      { label: "Amount:", token: "{amount}" },
    ],
  },
  {
    id: 3,
    subject: "Sales Invoice Status Updated",
    module: "general",
    message:
      "Sales invoice #{invoice_number} status has been updated to {status}",
    variables: [
      { label: "Invoice Number:", token: "{invoice_number}" },
      { label: "Status:", token: "{status}" },
      { label: "Client Name:", token: "{client_name}" },
    ],
  },
  {
    id: 4,
    subject: "New Sales Proposal",
    module: "general",
    message: "A new sales proposal #{proposal_number} has been created",
    variables: [
      { label: "Proposal Number:", token: "{proposal_number}" },
      { label: "Client Name:", token: "{client_name}" },
    ],
  },
  {
    id: 5,
    subject: "Sales Proposal Status Updated",
    module: "general",
    message: "Sales proposal #{proposal_number} status updated to {status}",
    variables: [
      { label: "Proposal Number:", token: "{proposal_number}" },
      { label: "Status:", token: "{status}" },
    ],
  },
  {
    id: 6,
    subject: "New Purchase",
    module: "general",
    message:
      "A new purchase order #{purchase_number} has been created by {vendor_name}",
    variables: [
      { label: "Purchase Number:", token: "{purchase_number}" },
      { label: "Vendor Name:", token: "{vendor_name}" },
    ],
  },
  {
    id: 7,
    subject: "New Warehouse",
    module: "general",
    message: "A new warehouse {warehouse_name} has been added to the system",
    variables: [
      { label: "Warehouse Name:", token: "{warehouse_name}" },
      { label: "Location:", token: "{location}" },
    ],
  },
  {
    id: 8,
    subject: "New Customer",
    module: "Accounting",
    message: "A new customer {customer_name} has been added by {user_name}",
    variables: [
      { label: "Customer Name:", token: "{customer_name}" },
      { label: "User Name:", token: "{user_name}" },
    ],
  },
  {
    id: 9,
    subject: "New Vendor",
    module: "Accounting",
    message: "A new vendor {vendor_name} has been added to the system",
    variables: [
      { label: "Vendor Name:", token: "{vendor_name}" },
      { label: "Company Name:", token: "{company_name}" },
    ],
  },
  {
    id: 10,
    subject: "New Revenue",
    module: "Accounting",
    message: "A new revenue entry of {amount} has been recorded",
    variables: [
      { label: "Amount:", token: "{amount}" },
      { label: "Category:", token: "{category}" },
    ],
  },
  {
    id: 11,
    subject: "New Expense",
    module: "Accounting",
    message: "A new expense of {amount} has been recorded under {category}",
    variables: [
      { label: "Amount:", token: "{amount}" },
      { label: "Category:", token: "{category}" },
      { label: "Recorded By:", token: "{user_name}" },
    ],
  },
  {
    id: 12,
    subject: "Deal Move",
    module: "CRM",
    message: "Deal {deal_name} has been moved from {old_stage} to {new_stage}",
    variables: [
      { label: "Deal Name:", token: "{deal_name}" },
      { label: "Old Stage:", token: "{old_stage}" },
      { label: "New Stage:", token: "{new_stage}" },
    ],
  },
  {
    id: 13,
    subject: "Deal Assign",
    module: "CRM",
    message: "Deal {deal_name} has been assigned to {assignee_name}",
    variables: [
      { label: "Deal Name:", token: "{deal_name}" },
      { label: "Assignee Name:", token: "{assignee_name}" },
    ],
  },
  {
    id: 14,
    subject: "Lead Move",
    module: "CRM",
    message: "Lead {lead_name} has been moved to {new_stage}",
    variables: [
      { label: "Lead Name:", token: "{lead_name}" },
      { label: "New Stage:", token: "{new_stage}" },
    ],
  },
  {
    id: 15,
    subject: "Lead Assign",
    module: "CRM",
    message: "Lead {lead_name} has been assigned to {assignee_name}",
    variables: [
      { label: "Lead Name:", token: "{lead_name}" },
      { label: "Assignee Name:", token: "{assignee_name}" },
    ],
  },
  {
    id: 16,
    subject: "New Ticket",
    module: "Support",
    message:
      "A new support ticket #{ticket_id} has been created by {customer_name}",
    variables: [
      { label: "Ticket ID:", token: "{ticket_id}" },
      { label: "Customer Name:", token: "{customer_name}" },
    ],
  },
  {
    id: 17,
    subject: "Ticket Reply",
    module: "Support",
    message: "A new reply has been added to ticket #{ticket_id}",
    variables: [
      { label: "Ticket ID:", token: "{ticket_id}" },
      { label: "Reply By:", token: "{reply_by}" },
    ],
  },
  {
    id: 18,
    subject: "Ticket Closed",
    module: "Support",
    message: "Support ticket #{ticket_id} has been closed",
    variables: [
      { label: "Ticket ID:", token: "{ticket_id}" },
      { label: "Customer Name:", token: "{customer_name}" },
    ],
  },
  {
    id: 19,
    subject: "New Project",
    module: "Project",
    message: "A new project {project_name} has been created",
    variables: [
      { label: "Project Name:", token: "{project_name}" },
      { label: "Start Date:", token: "{start_date}" },
    ],
  },
  {
    id: 20,
    subject: "Task Assigned",
    module: "Project",
    message: "Task {task_name} has been assigned to {assignee_name}",
    variables: [
      { label: "Task Name:", token: "{task_name}" },
      { label: "Assignee Name:", token: "{assignee_name}" },
      { label: "Due Date:", token: "{due_date}" },
    ],
  },
  {
    id: 21,
    subject: "Task Completed",
    module: "Project",
    message: "Task {task_name} in project {project_name} has been completed",
    variables: [
      { label: "Task Name:", token: "{task_name}" },
      { label: "Project Name:", token: "{project_name}" },
    ],
  },
  {
    id: 22,
    subject: "Leave Approved",
    module: "HR",
    message:
      "Leave request for {employee_name} from {leave_from} to {leave_to} has been approved",
    variables: [
      { label: "Employee Name:", token: "{employee_name}" },
      { label: "Leave From:", token: "{leave_from}" },
      { label: "Leave To:", token: "{leave_to}" },
    ],
  },
  {
    id: 23,
    subject: "Leave Rejected",
    module: "HR",
    message:
      "Leave request for {employee_name} has been rejected. Reason: {reason}",
    variables: [
      { label: "Employee Name:", token: "{employee_name}" },
      { label: "Reason:", token: "{reason}" },
    ],
  },
  {
    id: 24,
    subject: "New Employee",
    module: "HR",
    message: "A new employee {employee_name} has joined {department}",
    variables: [
      { label: "Employee Name:", token: "{employee_name}" },
      { label: "Department:", token: "{department}" },
    ],
  },
  {
    id: 25,
    subject: "Payroll Processed",
    module: "HR",
    message: "Payroll for {month} has been processed successfully",
    variables: [
      { label: "Month:", token: "{month}" },
      { label: "Total Amount:", token: "{total_amount}" },
    ],
  },
  {
    id: 26,
    subject: "Contract Signed",
    module: "Contracts",
    message: "Contract {contract_name} has been signed by {client_name}",
    variables: [
      { label: "Contract Name:", token: "{contract_name}" },
      { label: "Client Name:", token: "{client_name}" },
    ],
  },
  {
    id: 27,
    subject: "Contract Expiry",
    module: "Contracts",
    message: "Contract {contract_name} is expiring on {expiry_date}",
    variables: [
      { label: "Contract Name:", token: "{contract_name}" },
      { label: "Expiry Date:", token: "{expiry_date}" },
    ],
  },
  {
    id: 28,
    subject: "Application Received",
    module: "Recruitment",
    message:
      "New job application received from {applicant_name} for {job_title}",
    variables: [
      { label: "Applicant Name:", token: "{applicant_name}" },
      { label: "Job Title:", token: "{job_title}" },
    ],
  },
  {
    id: 29,
    subject: "Interview Scheduled",
    module: "Recruitment",
    message: "Interview scheduled for {applicant_name} on {interview_date}",
    variables: [
      { label: "Applicant Name:", token: "{applicant_name}" },
      { label: "Interview Date:", token: "{interview_date}" },
    ],
  },
  {
    id: 30,
    subject: "Offer Letter Sent",
    module: "Recruitment",
    message: "Offer letter for {job_title} has been sent to {applicant_name}",
    variables: [
      { label: "Applicant Name:", token: "{applicant_name}" },
      { label: "Job Title:", token: "{job_title}" },
    ],
  },
  {
    id: 31,
    subject: "Low Stock Alert",
    module: "Inventory",
    message: "Product {product_name} is running low. Current stock: {quantity}",
    variables: [
      { label: "Product Name:", token: "{product_name}" },
      { label: "Quantity:", token: "{quantity}" },
    ],
  },
  {
    id: 32,
    subject: "Stock Transfer",
    module: "Inventory",
    message:
      "Stock transfer of {quantity} units of {product_name} has been processed",
    variables: [
      { label: "Product Name:", token: "{product_name}" },
      { label: "Quantity:", token: "{quantity}" },
      { label: "From Warehouse:", token: "{from_warehouse}" },
    ],
  },
];

// ─── Sort Icon ────────────────────────────────────────────────────────────────

const SortIcon = () => (
  <span className="inline-flex flex-col ml-1 text-gray-400">
    <ChevronUp className="w-3 h-3 -mb-0.5" />
    <ChevronDown className="w-3 h-3" />
  </span>
);

// ─── Edit Notification Template ───────────────────────────────────────────────

const EditNotifTemplate: React.FC<{
  template: NotifTemplate;
  onBack: () => void;
}> = ({ template, onBack }) => {
  const [subject, setSubject] = useState(template.subject);
  const [message, setMessage] = useState(template.message);

  return (
    <div className="flex-1 bg-[#FAFBFC] flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer" onClick={onBack}>
            Dashboard
          </span>
          <span className="text-gray-400">›</span>
          <span className="hover:text-gray-700 cursor-pointer" onClick={onBack}>
            Notification Templates
          </span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">
            Edit Notification Template
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1">
          <Globe className="w-4 h-4" />
          <span>en English</span>
        </div>
      </div>

      {/* Page title + Back */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Edit Notification Template : {template.subject}
        </h1>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex gap-5 items-start">
          {/* ── Left: Variables ── */}
          <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Variables
            </h3>
            <div className="space-y-2.5">
              {template.variables.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5 text-sm">
                  <span className="text-gray-700">{v.label}</span>
                  <button
                    onClick={() => setMessage((prev) => prev + " " + v.token)}
                    className="text-emerald-500 hover:text-emerald-600 font-mono text-xs transition-colors"
                  >
                    {v.token}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Content ── */}
          <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <span className="text-[10px] font-bold text-gray-500 border border-gray-300 rounded px-1.5 py-0.5 leading-none">
                  GB
                </span>
                Content for English
              </div>
              <div className="relative">
                <select className="appearance-none border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm bg-white outline-none focus:border-emerald-500 cursor-pointer">
                  <option>English</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Spanish</option>
                  <option>Arabic</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              {/* Notification Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notification Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm outline-none focus:border-emerald-500 resize-y"
                />
              </div>

              {/* Save Changes */}
              <div className="flex justify-end">
                <button className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium transition-colors">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Notification Templates List ──────────────────────────────────────────────

const NotifTemplatesList: React.FC<{ onEdit: (t: NotifTemplate) => void }> = ({
  onEdit,
}) => {
  const [activeTab, setActiveTab] = useState<NotifTab>("slack");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const filtered = allTemplates.filter(
    (t) =>
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.module.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const tabs: { id: NotifTab; label: string }[] = [
    { id: "slack", label: "Slack" },
    { id: "telegram", label: "Telegram" },
    { id: "twilio", label: "Twilio" },
  ];

  return (
    <div className="flex-1 bg-[#FAFBFC] flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">
            Notification Templates
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1">
          <Globe className="w-4 h-4" />
          <span>en English</span>
        </div>
      </div>

      {/* Page title + Tab strip */}
      <div className="bg-white border-b border-gray-200 px-6 pt-4 pb-0">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">
          Manage Notification Templates
        </h1>
        {/* Tabs — underline style, no pill */}
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-gray-800 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
              <Search className="w-4 h-4 text-gray-400 ml-3" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search notification templates..."
                className="px-3 py-2 text-sm outline-none w-64"
              />
            </div>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium transition-colors">
              Search
            </button>
          </div>

          {/* Per page — no Filters button */}
          <div className="relative">
            <select className="appearance-none border border-gray-200 rounded-md pl-3 pr-8 py-2 text-sm bg-white text-gray-700 outline-none cursor-pointer">
              <option>10 per page</option>
              <option>25 per page</option>
              <option>50 per page</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1 cursor-pointer select-none">
                    Subject <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1 cursor-pointer select-none">
                    Module <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3.5 text-gray-900 text-sm">
                    {t.subject}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-sm">
                    {t.module}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => onEdit(t)}
                      className="text-blue-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-sm text-gray-400"
                  >
                    No templates found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              Showing {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} to{" "}
              {Math.min(page * perPage, filtered.length)} of {filtered.length}{" "}
              results
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-sm rounded transition-colors ${
                    p === page
                      ? "bg-emerald-500 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export const NotificationTemplates: React.FC = () => {
  const [editing, setEditing] = useState<NotifTemplate | null>(null);

  if (editing) {
    return (
      <EditNotifTemplate template={editing} onBack={() => setEditing(null)} />
    );
  }
  return <NotifTemplatesList onEdit={(t) => setEditing(t)} />;
};

export default NotificationTemplates;
