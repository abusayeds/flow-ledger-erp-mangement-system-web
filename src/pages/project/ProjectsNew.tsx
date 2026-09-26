/**
 * File: src/pages/projects/Projects.tsx
 * Complete Projects Management page with list view, create modal, and details page
 * Based on provided screenshots design
 */

import React, { useState, useMemo } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  X,
  Calendar,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  PauseCircle,
  FileText,
  Upload,
  Download,
  Link as LinkIcon,
  UserPlus,
  Briefcase,
  Target,
  Activity,
  FolderOpen,
  Paperclip,
  Image,
  File,
  Archive,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  title: string;
  cost: number;
  startDate: string;
  endDate: string;
  status: "Incomplete" | "Ongoing" | "Completed";
  progress: number;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadDate: string;
}

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  date: string;
  link: string;
}

interface Project {
  id: string;
  name: string;
  users: TeamMember[];
  budget: number;
  startDate: string;
  endDate: string;
  status: "Ongoing" | "Onhold" | "Completed" | "Planning";
  description: string;
  clients: Client[];
  milestones: Milestone[];
  activities: Activity[];
  files: ProjectFile[];
  totalTasks: number;
  totalBugs: number;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const sampleProjects: Project[] = [
  {
    id: "1",
    name: "sdasdsa",
    users: [],
    budget: 0,
    startDate: "2026-05-12",
    endDate: "2026-05-19",
    status: "Ongoing",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "2",
    name: "Blockchain Payment Gateway",
    users: [],
    budget: 80000,
    startDate: "2026-02-01",
    endDate: "2026-05-12",
    status: "Onhold",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "3",
    name: "Virtual Event Platform",
    users: [],
    budget: 46000,
    startDate: "2026-01-22",
    endDate: "2026-04-22",
    status: "Onhold",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "4",
    name: "Warehouse Automation System",
    users: [],
    budget: 70000,
    startDate: "2026-01-17",
    endDate: "2026-04-27",
    status: "Onhold",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "5",
    name: "Cloud Migration Project",
    users: [
      { id: "u1", name: "Robert Taylor", role: "Lead", avatar: "RT" },
      { id: "u2", name: "James Garcia", role: "Developer", avatar: "JG" },
      { id: "u3", name: "Matthew Clark", role: "Analyst", avatar: "MC" },
    ],
    budget: 60000,
    startDate: "2026-01-12",
    endDate: "2026-05-12",
    status: "Onhold",
    description:
      "Migration of legacy systems to cloud infrastructure with security enhancements.",
    clients: [
      { id: "c1", name: "Maria Rodriguez", email: "maria@example.com" },
      {
        id: "c2",
        name: "Global Solutions Ltd",
        email: "contact@globalsolutions.com",
      },
    ],
    milestones: [
      {
        id: "m1",
        title: "Project Initiation & Planning",
        cost: 8500,
        startDate: "2026-01-12",
        endDate: "2026-01-23",
        status: "Incomplete",
        progress: 69,
      },
      {
        id: "m2",
        title: "Frontend Development Phase 1",
        cost: 22000,
        startDate: "2026-02-11",
        endDate: "2026-02-20",
        status: "Ongoing",
        progress: 33,
      },
      {
        id: "m3",
        title: "Production Deployment",
        cost: 8000,
        startDate: "2026-03-13",
        endDate: "2026-03-24",
        status: "Incomplete",
        progress: 0,
      },
    ],
    activities: [
      {
        id: "a1",
        user: "Company",
        action: "Create new Milestone",
        target: "Production Deployment",
        date: "2026-01-19",
        link: "/milestone/creation",
      },
      {
        id: "a2",
        user: "James Garcia",
        action: "Create new Task",
        target: "Resource Planning",
        date: "2026-01-18",
        link: "/task/planning",
      },
      {
        id: "a3",
        user: "David Wilson",
        action: "Create new Task",
        target: "Project Charter Creation",
        date: "2026-01-17",
        link: "/task/charter",
      },
      {
        id: "a4",
        user: "Mark Allen",
        action: "Upload new file",
        target: "project_charter.pdf",
        date: "2026-01-14",
        link: "/file/upload",
      },
      {
        id: "a5",
        user: "Company",
        action: "Share Project with Client",
        target: "Jennifer Martinez",
        date: "2026-01-13",
        link: "/client/collaboration",
      },
      {
        id: "a6",
        user: "Robert Taylor",
        action: "Create new Task",
        target: "Risk Assessment",
        date: "2026-01-19",
        link: "/task/risk",
      },
      {
        id: "a7",
        user: "Company",
        action: "Create new Milestone",
        target: "Frontend Development Phase 1",
        date: "2026-01-17",
        link: "/milestone/frontend",
      },
      {
        id: "a8",
        user: "Company",
        action: "Create new Milestone",
        target: "Project Initiation & Planning",
        date: "2026-01-15",
        link: "/milestone/initiation",
      },
      {
        id: "a9",
        user: "Company",
        action: "Invite new User",
        target: "Michael Brown",
        date: "2026-01-13",
        link: "/user/invitation",
      },
      {
        id: "a10",
        user: "Company",
        action: "Invite new User",
        target: "John Smith",
        date: "2026-01-12",
        link: "/user/invitation",
      },
    ],
    files: [
      {
        id: "f1",
        name: "project-requirements.pdf",
        type: "PDF",
        size: "2.4 MB",
        uploadedBy: "Admin",
        uploadDate: "2026-01-10",
      },
      {
        id: "f2",
        name: "technical-specifications.docx",
        type: "DOCX",
        size: "1.8 MB",
        uploadedBy: "Admin",
        uploadDate: "2026-01-11",
      },
      {
        id: "f3",
        name: "design-mockups.zip",
        type: "ZIP",
        size: "15.3 MB",
        uploadedBy: "Designer",
        uploadDate: "2026-01-12",
      },
      {
        id: "f4",
        name: "database-schema.sql",
        type: "SQL",
        size: "256 KB",
        uploadedBy: "DBA",
        uploadDate: "2026-01-13",
      },
    ],
    totalTasks: 8,
    totalBugs: 0,
  },
  {
    id: "6",
    name: "Smart IoT Home Automation",
    users: [],
    budget: 65000,
    startDate: "2026-01-02",
    endDate: "2026-05-02",
    status: "Onhold",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "7",
    name: "Customer Feedback Portal",
    users: [],
    budget: 28000,
    startDate: "2025-12-23",
    endDate: "2026-03-18",
    status: "Ongoing",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "8",
    name: "Security Audit & Compliance",
    users: [],
    budget: 25000,
    startDate: "2025-12-18",
    endDate: "2026-03-13",
    status: "Ongoing",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
  {
    id: "9",
    name: "Online Ticket Booking System",
    users: [],
    budget: 42000,
    startDate: "2025-12-08",
    endDate: "2026-03-23",
    status: "Ongoing",
    description: "",
    clients: [],
    milestones: [],
    activities: [],
    files: [],
    totalTasks: 0,
    totalBugs: 0,
  },
];

const teamMembersList = [
  "Robert Taylor",
  "James Garcia",
  "Matthew Clark",
  "David Wilson",
  "Mark Allen",
  "Michael Brown",
  "John Smith",
  "Sarah Johnson",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (val: number) => {
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted}$`;
};

type SortField = "name" | "budget" | "startDate" | "endDate" | "status";
type SortDir = "asc" | "desc";

// ─── Main Projects Component ──────────────────────────────────────────────────

export const ProjectsNew: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(sampleProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    budget: 0,
    description: "",
    selectedUsers: [] as string[],
  });

  // ─── Sorting ────────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // ─── Filtered & Sorted ─────────────────────────────────────────────────────

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === "budget") {
        aVal = a.budget;
        bVal = b.budget;
      }
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [projects, searchQuery, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredProjects.length / perPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Status Badge ───────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ongoing":
        return "bg-green-100 text-green-700 border border-green-200";
      case "Onhold":
        return "bg-yellow-100 text-yellow-700 border border-yellow-200";
      case "Completed":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "Planning":
        return "bg-purple-100 text-purple-700 border border-purple-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Ongoing":
        return <Activity className="w-3 h-3" />;
      case "Onhold":
        return <PauseCircle className="w-3 h-3" />;
      case "Completed":
        return <CheckCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  // ─── Create Project ─────────────────────────────────────────────────────────

  const handleCreateProject = () => {
    if (!formData.name) {
      showToast("Please enter project name", "info");
      return;
    }
    if (!formData.startDate) {
      showToast("Please select start date", "info");
      return;
    }
    if (!formData.endDate) {
      showToast("Please select end date", "info");
      return;
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: formData.name,
      users: formData.selectedUsers.map((name, idx) => ({
        id: `u${idx}`,
        name,
        role: "Member",
        avatar: name
          .split(" ")
          .map((n) => n[0])
          .join(""),
      })),
      budget: formData.budget,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: "Planning",
      description: formData.description,
      clients: [],
      milestones: [],
      activities: [],
      files: [],
      totalTasks: 0,
      totalBugs: 0,
    };
    setProjects([newProject, ...projects]);
    setShowCreateModal(false);
    setFormData({
      name: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      budget: 0,
      description: "",
      selectedUsers: [],
    });
    showToast("Project created successfully!", "success");
  };

  // Toggle user selection
  const toggleUserSelection = (userName: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userName)
        ? prev.selectedUsers.filter((u) => u !== userName)
        : [...prev.selectedUsers, userName],
    }));
  };

  // Navigate to project details
  const viewProjectDetails = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  // Delete project
  const handleDeleteProject = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      showToast("Project deleted successfully!", "success");
    }
  };

  // ─── Sort Header ────────────────────────────────────────────────────────────

  const SortHeader: React.FC<{ field: SortField; label: string }> = ({
    field,
    label,
  }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-50 whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${sortField === field ? "text-gray-900" : "text-gray-400"}`}
        />
      </div>
    </th>
  );

  // ─── Create Project Modal ───────────────────────────────────────────────────

  const CreateProjectModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Create Project
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Add a new project to your portfolio
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter project name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <AppDatePicker
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <AppDatePicker
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Users
              </label>
              <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {teamMembersList.map((member) => (
                    <label
                      key={member}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedUsers.includes(member)}
                        onChange={() => toggleUserSelection(member)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      {member}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min={0}
                  value={formData.budget || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      budget: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter project description"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
              />
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateProject}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Breadcrumb */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => navigate("/")}
            className="hover:text-gray-700"
          >
            Dashboard
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">Projects</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Manage Projects
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-9 h-9 flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
            title="Create Project"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              onClick={() => showToast("Search applied", "info")}
              className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600"
            >
              Search
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
            >
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>

            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Filters</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-3 pb-1.5 mb-1 border-b border-gray-100">
                    <span className="text-xs font-medium text-gray-500">
                      Status
                    </span>
                  </div>
                  {["All", "Ongoing", "Onhold", "Completed", "Planning"].map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setStatusFilter(st);
                          setCurrentPage(1);
                          setShowFilters(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${statusFilter === st ? "text-blue-600 font-medium bg-blue-50" : "text-gray-700"}`}
                      >
                        {st}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="name" label="Name" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Users
                </th>
                <SortHeader field="budget" label="Budget" />
                <SortHeader field="startDate" label="Start Date" />
                <SortHeader field="endDate" label="End Date" />
                <SortHeader field="status" label="Status" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedProjects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => viewProjectDetails(project.id)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">
                      {project.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2">
                      {project.users.slice(0, 3).map((user, idx) => (
                        <div
                          key={user.id}
                          className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center border-2 border-white"
                        >
                          {user.avatar}
                        </div>
                      ))}
                      {project.users.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 text-xs flex items-center justify-center border-2 border-white">
                          +{project.users.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {fmtCurrency(project.budget)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {project.startDate}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{project.endDate}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}
                    >
                      {getStatusIcon(project.status)}
                      {project.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleDeleteProject(project.id, project.name)
                        }
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedProjects.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-sm text-gray-500">
            Showing{" "}
            {filteredProjects.length === 0
              ? 0
              : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredProjects.length)} of{" "}
            {filteredProjects.length} results
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 text-sm rounded-md flex items-center justify-center ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && CreateProjectModal()}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DETAILS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ProjectDetailsProps {
  projectId: string;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  projectId,
}) => {
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  React.useEffect(() => {
    // Find project by ID
    const found = sampleProjects.find((p) => p.id === projectId);
    setProject(found || null);
  }, [projectId]);

  if (!project) {
    return (
      <div className="module-page-shell flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Project not found
          </h2>
          <button
            onClick={() => navigate("/project/projects")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ongoing":
        return "bg-green-100 text-green-700";
      case "Onhold":
        return "bg-yellow-100 text-yellow-700";
      case "Completed":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getMilestoneStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-700";
      case "Ongoing":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="module-page-shell overflow-auto">
      {/* Breadcrumb */}
      <div className="dashboard-title-bar -mx-4 md:-mx-6 -mt-4 md:-mt-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => navigate("/")}
            className="hover:text-gray-700"
          >
            Dashboard
          </button>
          <span>›</span>
          <button
            onClick={() => navigate("/project/projects")}
            className="hover:text-gray-700"
          >
            Projects
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">{project.name}</span>
        </div>
      </div>

      <div className="p-6">
        {/* Project Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {project.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(project.status)}`}
            >
              {project.status}
            </span>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Start Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {project.startDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">End Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {project.endDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Budget</p>
                <p className="text-sm font-medium text-gray-900">
                  {fmtCurrency(project.budget)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Total Tasks</p>
                <p className="text-sm font-medium text-gray-900">
                  {project.totalTasks} Tasks
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">{project.description}</p>
            </div>
          )}
        </div>

        {/* Team Members & Clients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Team Members */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">
                Team Members
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {project.users.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                    {member.avatar}
                  </div>
                  <span className="text-sm text-gray-700">{member.name}</span>
                </div>
              ))}
              {project.users.length === 0 && (
                <p className="text-sm text-gray-500">
                  No team members assigned
                </p>
              )}
            </div>
          </div>

          {/* Clients */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Clients</h2>
            </div>
            <div className="space-y-2">
              {project.clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-900">{client.name}</span>
                  <span className="text-xs text-gray-500">{client.email}</span>
                </div>
              ))}
              {project.clients.length === 0 && (
                <p className="text-sm text-gray-500">No clients assigned</p>
              )}
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Milestones
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Title
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Cost
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Start Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    End Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Progress
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {project.milestones.map((milestone) => (
                  <tr key={milestone.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {milestone.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmtCurrency(milestone.cost)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {milestone.startDate}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {milestone.endDate}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getMilestoneStatusColor(milestone.status)}`}
                      >
                        {milestone.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${milestone.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {milestone.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-xs">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {project.milestones.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No milestones created yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Project Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Tasks</p>
                <p className="text-xl font-bold text-gray-900">
                  {project.totalTasks}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Bugs</p>
                <p className="text-xl font-bold text-gray-900">
                  {project.totalBugs}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Budget</p>
                <p className="text-xl font-bold text-gray-900">
                  {fmtCurrency(project.budget)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">
              Recent Activity
            </h2>
          </div>
          <div className="space-y-3">
            {project.activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.user}</span>{" "}
                    {activity.action}{" "}
                    <span className="font-medium">{activity.target}</span>
                  </p>
                  <button className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                    Link to {activity.target} Page
                  </button>
                </div>
                <span className="text-xs text-gray-400">{activity.date}</span>
              </div>
            ))}
            {project.activities.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No recent activity
              </p>
            )}
          </div>
        </div>

        {/* Files */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Files</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {project.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                {file.type === "PDF" && (
                  <FileText className="w-8 h-8 text-red-500" />
                )}
                {file.type === "DOCX" && (
                  <FileText className="w-8 h-8 text-blue-500" />
                )}
                {file.type === "ZIP" && (
                  <Archive className="w-8 h-8 text-yellow-500" />
                )}
                {file.type === "SQL" && (
                  <File className="w-8 h-8 text-green-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">{file.size}</p>
                </div>
              </div>
            ))}
            {project.files.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4 col-span-full">
                No files uploaded
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ROUTING WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

export const ProjectsRoutes: React.FC = () => {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (projectId) {
    return <ProjectDetails projectId={projectId} />;
  }

  return <ProjectsNew />;
};
