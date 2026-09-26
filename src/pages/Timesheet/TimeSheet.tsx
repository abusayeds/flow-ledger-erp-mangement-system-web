/**
 * File: src/pages/timesheet/ManageTimesheet.tsx
 * Manage Timesheet:
 *   List: Name(sort) | Project | Task | Type badge | Date(sort) | Hours(sort) | Minutes(sort) | Actions
 *   - Search timesheets + List/Grid toggle + 10 per page + Filters
 *   - Type badges: Project (green), Manual (gray), Clock In/Out (light blue/teal pill)
 *   - Project/Task show "-" when not applicable
 *   - Hours displayed as 2-digit zero-padded (05, 06, 08...)
 *   - Edit modal: Type radio (Clock In/Out | Project | Manual), User dropdown (emerald border),
 *                 Project dropdown, Task Optional dropdown, Date picker, Hours* input + Minutes dropdown, Notes textarea
 *   - Create modal: same fields, Manual pre-selected, no Project/Task when Manual/Clock
 *   - Delete confirmation
 *   - Pagination: Previous / 1 / 2 / 3 / Next — 30 total results
 */

import React, { useState } from "react";
import {
  Globe,
  Plus,
  Search,
  List,
  Grid3X3,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Calendar,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryType = "Project" | "Manual" | "Clock In/Out";

interface TimesheetEntry {
  id: number;
  name: string;
  project: string;
  task: string;
  type: EntryType;
  date: string;
  hours: number;
  minutes: number;
  notes: string;
}

type ModalMode = "add" | "edit" | null;

// ─── Sample Data (30 rows, 3 pages) ──────────────────────────────────────────

const initialEntries: TimesheetEntry[] = [
  {
    id: 1,
    name: "David Wilson",
    project: "Mobile App for Healthcare",
    task: "Security Audit",
    type: "Project",
    date: "2026-02-10",
    hours: 5,
    minutes: 30,
    notes: "Conduct comprehensive security assessment.",
  },
  {
    id: 2,
    name: "Michael Brown",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-02-06",
    hours: 6,
    minutes: 30,
    notes: "General administrative work.",
  },
  {
    id: 3,
    name: "Anthony Walker",
    project: "Learning Management System",
    task: "Core API Development",
    type: "Project",
    date: "2026-02-03",
    hours: 8,
    minutes: 30,
    notes: "Developed core API endpoints.",
  },
  {
    id: 4,
    name: "Mark Allen",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-02-03",
    hours: 9,
    minutes: 45,
    notes: "",
  },
  {
    id: 5,
    name: "Matthew Clark",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-02-02",
    hours: 9,
    minutes: 45,
    notes: "",
  },
  {
    id: 6,
    name: "Mark Allen",
    project: "Security Audit & Compliance",
    task: "Risk Assessment",
    type: "Project",
    date: "2026-01-29",
    hours: 5,
    minutes: 0,
    notes: "Risk assessment completed.",
  },
  {
    id: 7,
    name: "Matthew Clark",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-29",
    hours: 5,
    minutes: 45,
    notes: "",
  },
  {
    id: 8,
    name: "James Garcia",
    project: "Project Portfolio Dashboard",
    task: "Requirements Documentation",
    type: "Project",
    date: "2026-01-29",
    hours: 5,
    minutes: 15,
    notes: "Documented project requirements.",
  },
  {
    id: 9,
    name: "James Garcia",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-01-23",
    hours: 7,
    minutes: 45,
    notes: "",
  },
  {
    id: 10,
    name: "Anthony Walker",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-21",
    hours: 3,
    minutes: 30,
    notes: "",
  },
  {
    id: 11,
    name: "David Wilson",
    project: "E-commerce Platform",
    task: "Frontend Development",
    type: "Project",
    date: "2026-01-20",
    hours: 7,
    minutes: 0,
    notes: "Built product listing pages.",
  },
  {
    id: 12,
    name: "Sarah Johnson",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-01-19",
    hours: 8,
    minutes: 30,
    notes: "",
  },
  {
    id: 13,
    name: "Michael Brown",
    project: "CRM Integration",
    task: "Database Schema Design",
    type: "Project",
    date: "2026-01-18",
    hours: 6,
    minutes: 15,
    notes: "Designed CRM database schema.",
  },
  {
    id: 14,
    name: "Emily Davis",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-17",
    hours: 4,
    minutes: 0,
    notes: "Documentation review.",
  },
  {
    id: 15,
    name: "James Garcia",
    project: "AI Analytics Platform",
    task: "Model Training",
    type: "Project",
    date: "2026-01-16",
    hours: 10,
    minutes: 0,
    notes: "Trained ML model on dataset.",
  },
  {
    id: 16,
    name: "Mark Allen",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-01-15",
    hours: 8,
    minutes: 45,
    notes: "",
  },
  {
    id: 17,
    name: "Anthony Walker",
    project: "Mobile App for Healthcare",
    task: "UI Design",
    type: "Project",
    date: "2026-01-14",
    hours: 6,
    minutes: 30,
    notes: "Completed UI mockups.",
  },
  {
    id: 18,
    name: "Matthew Clark",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-13",
    hours: 3,
    minutes: 15,
    notes: "Team meetings.",
  },
  {
    id: 19,
    name: "Sarah Johnson",
    project: "Blockchain Supply Chain",
    task: "Smart Contract Dev",
    type: "Project",
    date: "2026-01-12",
    hours: 7,
    minutes: 30,
    notes: "Developed supply chain contracts.",
  },
  {
    id: 20,
    name: "David Wilson",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-01-11",
    hours: 9,
    minutes: 0,
    notes: "",
  },
  {
    id: 21,
    name: "Emily Davis",
    project: "Cloud Migration",
    task: "Infrastructure Setup",
    type: "Project",
    date: "2026-01-10",
    hours: 8,
    minutes: 0,
    notes: "Set up cloud infrastructure.",
  },
  {
    id: 22,
    name: "Michael Brown",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-09",
    hours: 2,
    minutes: 30,
    notes: "Code review sessions.",
  },
  {
    id: 23,
    name: "James Garcia",
    project: "Financial Trading Platform",
    task: "API Integration",
    type: "Project",
    date: "2026-01-08",
    hours: 9,
    minutes: 15,
    notes: "Integrated third-party trading API.",
  },
  {
    id: 24,
    name: "Mark Allen",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-01-07",
    hours: 8,
    minutes: 0,
    notes: "",
  },
  {
    id: 25,
    name: "Anthony Walker",
    project: "HR Management System",
    task: "Payroll Module",
    type: "Project",
    date: "2026-01-06",
    hours: 7,
    minutes: 45,
    notes: "Built payroll calculation module.",
  },
  {
    id: 26,
    name: "Matthew Clark",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-05",
    hours: 4,
    minutes: 30,
    notes: "Sprint planning.",
  },
  {
    id: 27,
    name: "Sarah Johnson",
    project: "IoT Fleet Management",
    task: "GPS Integration",
    type: "Project",
    date: "2026-01-04",
    hours: 6,
    minutes: 0,
    notes: "Integrated GPS tracking system.",
  },
  {
    id: 28,
    name: "David Wilson",
    project: "",
    task: "",
    type: "Clock In/Out",
    date: "2026-01-03",
    hours: 8,
    minutes: 30,
    notes: "",
  },
  {
    id: 29,
    name: "Emily Davis",
    project: "Enterprise ERP",
    task: "Module Configuration",
    type: "Project",
    date: "2026-01-02",
    hours: 5,
    minutes: 45,
    notes: "Configured ERP modules.",
  },
  {
    id: 30,
    name: "Michael Brown",
    project: "",
    task: "",
    type: "Manual",
    date: "2026-01-01",
    hours: 3,
    minutes: 0,
    notes: "Year-end documentation.",
  },
];

const USERS = [
  "David Wilson",
  "Michael Brown",
  "Anthony Walker",
  "Mark Allen",
  "Matthew Clark",
  "James Garcia",
  "Sarah Johnson",
  "Emily Davis",
];
const PROJECTS = [
  "Mobile App for Healthcare",
  "Learning Management System",
  "Security Audit & Compliance",
  "Project Portfolio Dashboard",
  "E-commerce Platform",
  "CRM Integration",
  "AI Analytics Platform",
  "Blockchain Supply Chain",
  "Cloud Migration",
  "Financial Trading Platform",
  "HR Management System",
  "IoT Fleet Management",
  "Enterprise ERP",
];
const TASKS = [
  "Security Audit",
  "Core API Development",
  "Risk Assessment",
  "Requirements Documentation",
  "Frontend Development",
  "Database Schema Design",
  "Model Training",
  "UI Design",
  "Smart Contract Dev",
  "Infrastructure Setup",
  "API Integration",
  "Payroll Module",
  "GPS Integration",
  "Module Configuration",
];
const MINUTES_OPTIONS = ["00", "15", "30", "45"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

const SortIcon = () => (
  <span className="inline-flex flex-col ml-1 text-gray-400">
    <ChevronUp className="w-3 h-3 -mb-0.5" />
    <ChevronDown className="w-3 h-3" />
  </span>
);

// Type badge
const TypeBadge: React.FC<{ type: EntryType }> = ({ type }) => {
  if (type === "Project")
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        Project
      </span>
    );
  if (type === "Clock In/Out")
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-500 border border-blue-200">
        Clock In/Out
      </span>
    );
  return (
    <span className="inline-flex items-center text-xs text-gray-500">
      Manual
    </span>
  );
};

// Radio button
const Radio: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-1.5 cursor-pointer select-none">
    <button
      onClick={onChange}
      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? "border-emerald-500" : "border-gray-300"}`}
    >
      {checked && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
    </button>
    <span className="text-sm text-gray-700">{label}</span>
  </label>
);

// ─── Edit / Create Modal ──────────────────────────────────────────────────────

interface ModalProps {
  mode: ModalMode;
  entry: TimesheetEntry | null;
  onClose: () => void;
  onSave: (data: Partial<TimesheetEntry>) => void;
}

const TimesheetModal: React.FC<ModalProps> = ({
  mode,
  entry,
  onClose,
  onSave,
}) => {
  const today = new Date().toISOString().split("T")[0];
  const [type, setType] = useState<EntryType>(entry?.type ?? "Manual");
  const [user, setUser] = useState(entry?.name ?? "");
  const [project, setProject] = useState(entry?.project ?? "");
  const [task, setTask] = useState(entry?.task ?? "");
  const [date, setDate] = useState(entry?.date ?? today);
  const [hours, setHours] = useState(entry?.hours ?? 0);
  const [minutes, setMinutes] = useState(entry?.minutes ?? 0);
  const [notes, setNotes] = useState(entry?.notes ?? "");

  if (!mode) return null;
  const isEdit = mode === "edit";
  const showProjectTask = type === "Project";

  const handleSubmit = () => {
    if (!user) return;
    onSave({
      name: user,
      project: showProjectTask ? project : "",
      task: showProjectTask ? task : "",
      type,
      date,
      hours,
      minutes,
      notes,
    });
    onClose();
  };

  // Format date for display
  const displayDate = (() => {
    try {
      return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return date;
    }
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? "Edit Timesheet" : "Create Timesheet"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Type radio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <div className="flex items-center gap-5">
              <Radio
                label="Clock In/Out"
                checked={type === "Clock In/Out"}
                onChange={() => setType("Clock In/Out")}
              />
              <Radio
                label="Project"
                checked={type === "Project"}
                onChange={() => setType("Project")}
              />
              <Radio
                label="Manual"
                checked={type === "Manual"}
                onChange={() => setType("Manual")}
              />
            </div>
          </div>

          {/* User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              User
            </label>
            <div className="relative">
              <select
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full border border-emerald-500 rounded-md px-3 py-2 text-sm outline-none bg-white appearance-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value=""></option>
                {USERS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Project (only for Project type) */}
          {showProjectTask && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Project
              </label>
              <div className="relative">
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white appearance-none focus:border-emerald-500"
                >
                  <option value=""></option>
                  {PROJECTS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Task (only for Project type) */}
          {showProjectTask && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Task{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white appearance-none focus:border-emerald-500"
                >
                  <option value=""></option>
                  {TASKS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date
            </label>
            <div className="relative">
              <div className="flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:border-emerald-500">
                <span className="px-3 py-2 text-gray-400">
                  <Calendar className="w-4 h-4" />
                </span>
                <AppDatePicker
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 py-2 pr-3 text-sm outline-none bg-white text-gray-700"
                />
              </div>
            </div>
          </div>

          {/* Hours + Minutes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Hours <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={24}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Minutes
              </label>
              <div className="relative">
                <select
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white appearance-none focus:border-emerald-500"
                >
                  {MINUTES_OPTIONS.map((m) => (
                    <option key={m} value={Number(m)}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Enter notes"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none resize-y focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium transition-colors"
          >
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────────────────

const DeleteModal: React.FC<{
  entry: TimesheetEntry | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ entry, onClose, onConfirm }) => {
  if (!entry) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Delete Timesheet
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete the timesheet entry for{" "}
          <span className="font-medium text-gray-900">{entry.name}</span> on{" "}
          {entry.date}?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Timesheet: React.FC = () => {
  const [entries, setEntries] = useState<TimesheetEntry[]>(initialEntries);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editEntry, setEditEntry] = useState<TimesheetEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<TimesheetEntry | null>(null);

  const filtered = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.project.toLowerCase().includes(search.toLowerCase()) ||
      e.task.toLowerCase().includes(search.toLowerCase()) ||
      e.type.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => {
    setEditEntry(null);
    setModalMode("add");
  };
  const openEdit = (e: TimesheetEntry) => {
    setEditEntry(e);
    setModalMode("edit");
  };

  const handleSave = (data: Partial<TimesheetEntry>) => {
    if (modalMode === "add") {
      setEntries((prev) => [
        {
          id: Date.now(),
          name: "",
          project: "",
          task: "",
          type: "Manual",
          date: "",
          hours: 0,
          minutes: 0,
          notes: "",
          ...data,
        },
        ...prev,
      ]);
    } else if (editEntry) {
      setEntries((prev) =>
        prev.map((e) => (e.id === editEntry.id ? { ...e, ...data } : e)),
      );
    }
    setPage(1);
  };

  const handleDelete = () => {
    if (!deleteEntry) return;
    setEntries((prev) => prev.filter((e) => e.id !== deleteEntry.id));
    setDeleteEntry(null);
    const newTotal = filtered.length - 1;
    if (page > Math.ceil(newTotal / perPage))
      setPage((p) => Math.max(1, p - 1));
  };

  return (
    <div className="flex-1 bg-[#FAFBFC] flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">Timesheet</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1">
          <Globe className="w-4 h-4" />
          <span>en English</span>
        </div>
      </div>

      {/* Page title */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Manage Timesheet
        </h1>
        <button
          onClick={openAdd}
          className="w-9 h-9 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center justify-center transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
              <Search className="w-4 h-4 text-gray-400 ml-3" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search timesheets..."
                className="px-3 py-2 text-sm outline-none w-52"
              />
            </div>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium transition-colors">
              Search
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* List / Grid toggle */}
            <div className="flex border border-gray-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-emerald-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-emerald-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <select className="appearance-none border border-gray-200 rounded-md pl-3 pr-8 py-2 text-sm bg-white text-gray-700 outline-none cursor-pointer">
                <option>10 per page</option>
                <option>25 per page</option>
                <option>50 per page</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" /> Filters{" "}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1 cursor-pointer select-none">
                    Name <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Task
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1 cursor-pointer select-none">
                    Date <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1 cursor-pointer select-none">
                    Hours <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  <span className="flex items-center gap-1 cursor-pointer select-none">
                    Minutes <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3.5 text-gray-900 text-sm font-medium">
                    {entry.name}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-sm">
                    {entry.project || "-"}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-sm">
                    {entry.task || "-"}
                  </td>
                  <td className="px-4 py-3.5">
                    <TypeBadge type={entry.type} />
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-sm">
                    {entry.date}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 text-sm font-medium">
                    {pad(entry.hours)}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 text-sm font-medium">
                    {pad(entry.minutes)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(entry)}
                        className="text-blue-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteEntry(entry)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-gray-400"
                  >
                    No timesheet entries found.
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
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-sm rounded transition-colors ${p === page ? "bg-emerald-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <TimesheetModal
        mode={modalMode}
        entry={editEntry}
        onClose={() => {
          setModalMode(null);
          setEditEntry(null);
        }}
        onSave={handleSave}
      />
      <DeleteModal
        entry={deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Timesheet;
