/**
 * File: src/pages/hrm/Events.tsx
 * Complete Events Management page with list view, create/edit modal, and details modal
 * Based on provided screenshots design
 */

import React, { useEffect, useState, useMemo } from "react";
import { refLabel } from "@/services/_http";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  Search,
  Edit,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  X,
  Eye,
  CheckCircle,
  Clock as ClockIcon,
  Flag,
} from "lucide-react";
import { useResourceData } from "@/hooks/useResourceData";
import {
  AsyncSearchSelect,
  CreatePlusButton,
  apiLabel,
  looksLikeId,
  searchEventTypes,
  searchDepartments,
  useHrmSearchListParams,
} from "./hrmShared";
import { eventHooks, hrmStatusActions } from "@/services/hrm";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeptRef {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
  eventTypeId?: string;
  eventType: string;
  departments: DeptRef[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  color: string;
  status: "Pending" | "Approved" | "Cancelled" | "Completed";
  approvedBy: string;
  description: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDepartments(raw: unknown): DeptRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d: unknown) => {
      if (typeof d === "object" && d) {
        const o = d as Record<string, unknown>;
        return {
          id: String(o._id ?? o.id ?? ""),
          name: String(o.department_name ?? o.name ?? ""),
        };
      }
      return { id: String(d), name: "" };
    })
    .filter((d) => d.id);
}

function mapFromApi(p: any): Event {
  const etRef = p.event_type_id;
  const depts = p.department_ids ?? p.departments ?? p.department ?? [];
  return {
    id: String(p.id ?? p._id ?? ""),
    title: p.title ?? "",
    // populated refs carry the title under `event_type` (not `name`);
    // never surface a raw id as the type
    eventTypeId:
      typeof etRef === "object" && etRef !== null
        ? String(etRef._id ?? etRef.id ?? "")
        : String(etRef ?? ""),
    eventType:
      typeof etRef === "object" && etRef !== null
        ? apiLabel(etRef, ["event_type", "name", "title", "type_name", "type"])
        : (() => {
            const s = String(etRef ?? p.eventType ?? "");
            return looksLikeId(s) ? "" : s;
          })(),
    departments: parseDepartments(depts),
    startDate: (p.start_date ?? p.startDate ?? "").slice(0, 10),
    endDate: (p.end_date ?? p.endDate ?? "").slice(0, 10),
    startTime: p.start_time ?? p.startTime ?? "",
    endTime: p.end_time ?? p.endTime ?? "",
    location: p.location ?? "",
    color: p.color ?? "#3b82f6",
    status: p.status ?? "Pending",
    approvedBy: refLabel(p.approved_by ?? p.approvedBy),
    description: p.description ?? "",
    createdAt: (p.created_at ?? p.createdAt ?? "").slice(0, 10),
  };
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return "-";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

type SortField =
  | "title"
  | "eventType"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime"
  | "status"
  | "approvedBy";
type SortDir = "asc" | "desc";

const eventFilterStatuses = ["All", "Pending", "Approved", "Cancelled", "Completed"];
const eventStatusOptions = ["Pending", "Approved", "Cancelled", "Completed"];
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

// ─── Main Component ──────────────────────────────────────────────────────────

export const Events: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const listParams = useHrmSearchListParams(searchQuery);
  const { items: raw, create, update, remove, refetch } = useResourceData(
    eventHooks,
    { seed: [], params: listParams },
  );
  const events = useMemo(() => raw.map(mapFromApi), [raw]);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  // Form state
  const [eventFormData, setEventFormData] = useState({
    title: "",
    eventType: "",
    eventTypeLabel: "",
    departments: [] as DeptRef[],
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    location: "",
    color: "#3b82f6",
    description: "",
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

  useEffect(() => {
    setCurrentPage(1);
  }, [listParams.searchTerm]);

  // ─── Filtered & Sorted ─────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    let result =
      statusFilter === "All" ? [...events] : events.filter((e) => e.status === statusFilter);

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [events, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredEvents.length / perPage);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage,
  );

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetEventForm = () => {
    setEventFormData({
      title: "",
      eventType: "",
      eventTypeLabel: "",
      departments: [],
      startDate: "",
      endDate: "",
      startTime: "",
      endTime: "",
      location: "",
      color: "#3b82f6",
      description: "",
    });
  };

  const openCreateModal = () => {
    resetEventForm();
    setIsEditing(false);
    setShowCreateModal(true);
  };

  const openEditModal = (event: Event) => {
    setSelectedEvent(event);
    setEventFormData({
      title: event.title,
      eventType: event.eventTypeId || "",
      eventTypeLabel: event.eventType,
      departments: [...event.departments],
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      color: event.color,
      description: event.description,
    });
    setIsEditing(true);
    setShowEditModal(true);
  };

  const openViewModal = (event: Event) => {
    setSelectedEvent(event);
    setShowViewModal(true);
  };

  const openStatusModal = (event: Event) => {
    setSelectedEvent(event);
    setNewStatus(event.status);
    setShowStatusModal(true);
  };

  const openDeleteModal = (event: Event) => {
    setSelectedEvent(event);
    setShowDeleteModal(true);
  };

  const handleStatusUpdate = async () => {
    if (selectedEvent && newStatus) {
      try {
        await hrmStatusActions.event(selectedEvent.id, newStatus);
        await refetch();
        showToast(`Event status updated to ${newStatus}!`, "success");
        setShowStatusModal(false);
      } catch {
        showToast("Failed to update status", "error");
      }
    }
  };

  const handleSaveEvent = async () => {
    if (!eventFormData.title) {
      showToast("Please enter title", "info");
      return;
    }
    if (!eventFormData.eventType) {
      showToast("Please select event type", "info");
      return;
    }
    if (eventFormData.departments.length === 0) {
      showToast("Please select at least one department", "info");
      return;
    }
    if (!eventFormData.startDate) {
      showToast("Please select start date", "info");
      return;
    }
    if (!eventFormData.endDate) {
      showToast("Please select end date", "info");
      return;
    }
    if (!eventFormData.startTime) {
      showToast("Please select start time", "info");
      return;
    }
    if (!eventFormData.endTime) {
      showToast("Please select end time", "info");
      return;
    }
    if (eventFormData.startDate > eventFormData.endDate) {
      showToast("Start date cannot be after end date", "error");
      return;
    }

    const toApi = {
      title: eventFormData.title,
      event_type_id: eventFormData.eventType,
      department_ids: eventFormData.departments.map((d) => d.id),
      start_date: eventFormData.startDate,
      end_date: eventFormData.endDate,
      start_time: eventFormData.startTime,
      end_time: eventFormData.endTime,
      location: eventFormData.location,
      color: eventFormData.color,
      description: eventFormData.description,
    };

    try {
      if (isEditing && selectedEvent) {
        await update(selectedEvent.id, toApi);
        showToast("Event updated successfully!", "success");
        setShowEditModal(false);
      } else {
        await create(toApi);
        showToast("Event created successfully!", "success");
        setShowCreateModal(false);
      }
      resetEventForm();
    } catch {
      showToast("Failed to save event", "error");
    }
  };

  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      try {
        await remove(selectedEvent.id);
        showToast("Event deleted successfully!", "success");
        setShowDeleteModal(false);
        setSelectedEvent(null);
      } catch {
        showToast("Failed to delete event", "error");
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-700";
      case "Pending":
        return "bg-yellow-100 text-yellow-700";
      case "Cancelled":
        return "bg-red-100 text-red-700";
      case "Completed":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="w-3 h-3" />;
      case "Pending":
        return <ClockIcon className="w-3 h-3" />;
      case "Cancelled":
        return <X className="w-3 h-3" />;
      case "Completed":
        return <Flag className="w-3 h-3" />;
      default:
        return null;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════════════════════

  const CreateEditModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Event" : "Create Event"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditing ? "Update event information" : "Add a new event"}
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetEventForm();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={eventFormData.title}
              onChange={(e) =>
                setEventFormData({ ...eventFormData, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type *
            </label>
            <AsyncSearchSelect
              value={eventFormData.eventType}
              displayName={eventFormData.eventTypeLabel}
              onChange={(id, opt) =>
                setEventFormData({
                  ...eventFormData,
                  eventType: id,
                  eventTypeLabel: opt?.name ?? "",
                })
              }
              onSearch={searchEventTypes}
              placeholder="Search event type..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departments *
            </label>
            <AsyncSearchSelect
              value=""
              onChange={(id, opt) => {
                if (!id || eventFormData.departments.some((d) => d.id === id)) return;
                setEventFormData({
                  ...eventFormData,
                  departments: [...eventFormData.departments, { id, name: opt?.name ?? id }],
                });
              }}
              onSearch={searchDepartments}
              placeholder="Search to add departments"
            />
            {eventFormData.departments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {eventFormData.departments.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {d.name || d.id}
                    <button
                      type="button"
                      onClick={() =>
                        setEventFormData({
                          ...eventFormData,
                          departments: eventFormData.departments.filter((x) => x.id !== d.id),
                        })
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <AppDatePicker
                value={eventFormData.startDate}
                onChange={(e) =>
                  setEventFormData({
                    ...eventFormData,
                    startDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <AppDatePicker
                value={eventFormData.endDate}
                onChange={(e) =>
                  setEventFormData({
                    ...eventFormData,
                    endDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time *
              </label>
              <select
                value={eventFormData.startTime}
                onChange={(e) =>
                  setEventFormData({
                    ...eventFormData,
                    startTime: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="">Select Time</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time *
              </label>
              <select
                value={eventFormData.endTime}
                onChange={(e) =>
                  setEventFormData({
                    ...eventFormData,
                    endTime: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="">Select Time</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              value={eventFormData.location}
              onChange={(e) =>
                setEventFormData({ ...eventFormData, location: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={eventFormData.color}
                onChange={(e) =>
                  setEventFormData({ ...eventFormData, color: e.target.value })
                }
                className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={eventFormData.color}
                onChange={(e) =>
                  setEventFormData({ ...eventFormData, color: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={eventFormData.description}
              onChange={(e) =>
                setEventFormData({
                  ...eventFormData,
                  description: e.target.value,
                })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-y"
            />
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetEventForm();
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveEvent}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  const StatusModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Update Event Status
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedEvent?.title}
            </p>
          </div>
          <button
            onClick={() => setShowStatusModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {eventStatusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
          <button
            onClick={() => setShowStatusModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStatusUpdate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Update Status
          </button>
        </div>
      </div>
    </div>
  );

  const ViewModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Event Details
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {selectedEvent?.title}
            </p>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {selectedEvent && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Title</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedEvent.title}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedEvent.status)}`}
              >
                {getStatusIcon(selectedEvent.status)}
                {selectedEvent.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Event Type</p>
                <p className="text-sm text-gray-600">
                  {selectedEvent.eventType}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm text-gray-600">
                  {selectedEvent.location}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Start Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedEvent.startDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">End Date</p>
                <p className="text-sm text-gray-600">
                  {formatDate(selectedEvent.endDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Start Time</p>
                <p className="text-sm text-gray-600">
                  {formatTime(selectedEvent.startTime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">End Time</p>
                <p className="text-sm text-gray-600">
                  {formatTime(selectedEvent.endTime)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Departments</p>
                <p className="text-sm text-gray-600">
                  {selectedEvent.departments.map((d) => d.name || d.id).join(", ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Approved By</p>
                <p className="text-sm text-gray-600">
                  {selectedEvent.approvedBy || "-"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-600">
                  {selectedEvent.description}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={() => setShowViewModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => {
              setShowViewModal(false);
              if (selectedEvent) openEditModal(selectedEvent);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );

  const DeleteModal = () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Delete Event
          </h3>
          <p className="text-gray-500 mb-6">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{selectedEvent?.title}</span>? This
            action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteEvent}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => navigate("/")}
            className="hover:text-gray-700"
          >
            Dashboard
          </button>
          <span>›</span>
          <button
            onClick={() => navigate("/hrm")}
            className="hover:text-gray-700"
          >
            HRM
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">Events</span>
        </div>
      </div>
      <div className="module-title-bar px-4 sm:px-6 pr-6 sm:pr-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Manage Events</h2>
          <CreatePlusButton onClick={openCreateModal} title="Create" />
        </div>
      </div>
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Events..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-80 pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  {eventFilterStatuses.map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStatusFilter(st);
                        setCurrentPage(1);
                        setShowFilters(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <SortHeader field="title" label="Title" />
                <SortHeader field="eventType" label="Event Type" />
                <SortHeader field="startDate" label="Start Date" />
                <SortHeader field="endDate" label="End Date" />
                <SortHeader field="startTime" label="Start Time" />
                <SortHeader field="endTime" label="End Time" />
                <SortHeader field="status" label="Status" />
                <SortHeader field="approvedBy" label="Approved By" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedEvents.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openViewModal(event)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {event.title}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{event.eventType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(event.startDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(event.endDate)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatTime(event.startTime)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatTime(event.endTime)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}
                    >
                      {getStatusIcon(event.status)}
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {event.approvedBy || "-"}
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(event)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(event)}
                        className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openStatusModal(event)}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(event)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedEvents.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No events found.
                  </td>{" "}
                </tr>
              )}{" "}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-sm text-gray-500">
            Showing{" "}
            {filteredEvents.length === 0 ? 0 : (currentPage - 1) * perPage + 1}{" "}
            to {Math.min(currentPage * perPage, filteredEvents.length)} of{" "}
            {filteredEvents.length} results
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
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) pageNumber = i + 1;
              else if (currentPage <= 3) pageNumber = i + 1;
              else if (currentPage >= totalPages - 2)
                pageNumber = totalPages - 4 + i;
              else pageNumber = currentPage - 2 + i;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`w-8 h-8 text-sm rounded-md flex items-center justify-center ${currentPage === pageNumber ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {pageNumber}
                </button>
              );
            })}
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
      {(showCreateModal || showEditModal) && CreateEditModal()}
      {showStatusModal && StatusModal()}
      {showViewModal && ViewModal()}
      {showDeleteModal && DeleteModal()}
    </div>
  );
};
