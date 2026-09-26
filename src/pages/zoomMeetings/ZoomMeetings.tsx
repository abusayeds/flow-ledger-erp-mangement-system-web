/**
 * File: src/pages/zoom/ManageZoomMeetings.tsx
 * Manage Zoom Meetings — exact match for all 4 screenshots:
 *
 * List: Title(sort) | Start Time | Duration | Host Name (avatar+name) |
 *       Participants (stacked avatars) | Status (dropdown badge) | Actions
 *
 * Status dropdown badge: Started(green) | Scheduled(blue) | Ended(gray) | Cancelled(red-pill)
 *   — clicking the badge opens an inline dropdown to change status (Scheduled/Started/Ended/Cancelled)
 *
 * Actions per row (vary by status):
 *   Started   → external-link(pink) | play(pink) | eye(teal) | delete(red)
 *   Scheduled → external-link(pink) | play(pink) | eye(teal) | edit(blue) | delete(red)
 *   Ended     → eye(teal) | delete(red)
 *   Cancelled → eye(teal) | delete(red)
 *   (Join Meeting tooltip on play/external-link icons)
 *
 * Meeting Details modal (eye icon):
 *   Title | Meeting ID | Password | Start Time | Duration | Status badge | Host | Description |
 *   Participants (avatar+name pills) | Host Video / Participant Video / Waiting Room / Recording toggles |
 *   Meeting Links (Join URL + Start URL with copy buttons) | Copy Join URL button
 *
 * Create Zoom Meeting modal (+ button):
 *   Title* | Description | Meeting Password | Start Time* | Duration* |
 *   Host Video/Participant Video/Waiting Room/Recording toggles |
 *   Status* radio (Scheduled | Started | Ended | Cancelled) |
 *   Participants dropdown | Host dropdown | Cancel + Create
 */

import React, { useState, useRef, useEffect } from "react";
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
  Eye,
  Trash2,
  X,
  ExternalLink,
  Play,
  Pencil,
  Calendar,
  Copy,
  Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MeetingStatus = "Started" | "Scheduled" | "Ended" | "Cancelled";

interface Participant {
  id: number;
  name: string;
  avatar: string; // initials or color
  color: string;
}

interface ZoomMeeting {
  id: number;
  title: string;
  meetingId: string;
  password: string;
  startTime: string;
  duration: number;
  host: Participant;
  participants: Participant[];
  status: MeetingStatus;
  description: string;
  hostVideo: boolean;
  participantVideo: boolean;
  waitingRoom: boolean;
  recording: boolean;
  joinUrl: string;
  startUrl: string;
}

// ─── Avatar data helpers ──────────────────────────────────────────────────────

const COLORS = [
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#2dd4bf",
  "#818cf8",
  "#4ade80",
];

const makeParticipant = (id: number, name: string): Participant => ({
  id,
  name,
  avatar: name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
  color: COLORS[id % COLORS.length],
});

const HOSTS: Participant[] = [
  makeParticipant(1, "Amanda White"),
  makeParticipant(2, "Alex Vendor"),
  makeParticipant(3, "Sam Supplier"),
  makeParticipant(4, "Michelle Hall"),
  makeParticipant(5, "David Wilson"),
  makeParticipant(6, "Michael Brown"),
  makeParticipant(7, "Christopher Lee"),
  makeParticipant(8, "Anthony Walker"),
  makeParticipant(9, "Prime Materials Ltd"),
  makeParticipant(10, "Professional Services"),
  makeParticipant(11, "James Garcia"),
  makeParticipant(12, "Mark Allen"),
];

// ─── Sample Data (15 rows, 2 pages) ──────────────────────────────────────────

const initialMeetings: ZoomMeeting[] = [
  {
    id: 1,
    title: "Client Presentation Review - Final Pitch Preparation Meeting",
    meetingId: "857-4980-5148",
    password: "40HMFW",
    startTime: "2025-09-24 17:30",
    duration: 120,
    host: makeParticipant(1, "Amanda White"),
    participants: [
      makeParticipant(1, "Amanda White"),
      makeParticipant(9, "Prime Materials Ltd"),
      makeParticipant(10, "Professional Services"),
    ],
    status: "Started",
    description:
      "Critical review session to finalize all client presentation materials before the upcoming pitch meeting. We will rehearse key talking points, review slide content, practice demonstrations, and ensure all team members are prepared for client questions.",
    hostVideo: true,
    participantVideo: false,
    waitingRoom: true,
    recording: false,
    joinUrl: "https://zoom.us/j/857-4980-5148",
    startUrl: "https://zoom.us/s/857-4980-5148",
  },
  {
    id: 2,
    title: "Sales Pipeline Review - Opportunity Assessment & Strategy",
    meetingId: "234-5678-9012",
    password: "SALES24",
    startTime: "2026-03-27 13:00",
    duration: 30,
    host: makeParticipant(2, "Alex Vendor"),
    participants: [
      makeParticipant(2, "Alex Vendor"),
      makeParticipant(5, "David Wilson"),
      makeParticipant(6, "Michael Brown"),
      makeParticipant(11, "James Garcia"),
    ],
    status: "Ended",
    description:
      "Weekly sales pipeline review to assess current opportunities, discuss conversion strategies, and align on quarterly targets.",
    hostVideo: false,
    participantVideo: false,
    waitingRoom: false,
    recording: true,
    joinUrl: "https://zoom.us/j/234-5678-9012",
    startUrl: "https://zoom.us/s/234-5678-9012",
  },
  {
    id: 3,
    title: "Annual Budget Planning Meeting - Resource Allocation Strategy",
    meetingId: "345-6789-0123",
    password: "BUDGET1",
    startTime: "2025-11-16 09:30",
    duration: 60,
    host: makeParticipant(3, "Sam Supplier"),
    participants: [
      makeParticipant(3, "Sam Supplier"),
      makeParticipant(6, "Michael Brown"),
    ],
    status: "Started",
    description:
      "Annual budget planning session to review departmental resource requests and finalize allocation strategy for the upcoming fiscal year.",
    hostVideo: true,
    participantVideo: true,
    waitingRoom: true,
    recording: true,
    joinUrl: "https://zoom.us/j/345-6789-0123",
    startUrl: "https://zoom.us/s/345-6789-0123",
  },
  {
    id: 4,
    title: "Performance Review Discussion - Goal Setting & Development",
    meetingId: "456-7890-1234",
    password: "PERF25",
    startTime: "2025-08-19 11:30",
    duration: 120,
    host: makeParticipant(4, "Michelle Hall"),
    participants: [
      makeParticipant(4, "Michelle Hall"),
      makeParticipant(1, "Amanda White"),
      makeParticipant(5, "David Wilson"),
      makeParticipant(8, "Anthony Walker"),
    ],
    status: "Scheduled",
    description:
      "Quarterly performance review to discuss goal achievements, development opportunities, and set targets for the next quarter.",
    hostVideo: true,
    participantVideo: false,
    waitingRoom: true,
    recording: false,
    joinUrl: "https://zoom.us/j/456-7890-1234",
    startUrl: "https://zoom.us/s/456-7890-1234",
  },
  {
    id: 5,
    title: "Marketing Strategy Discussion - Campaign Planning & Execution",
    meetingId: "567-8901-2345",
    password: "MKTG99",
    startTime: "2026-03-14 13:30",
    duration: 30,
    host: makeParticipant(5, "David Wilson"),
    participants: [
      makeParticipant(5, "David Wilson"),
      makeParticipant(1, "Amanda White"),
      makeParticipant(6, "Michael Brown"),
      makeParticipant(12, "Mark Allen"),
    ],
    status: "Cancelled",
    description:
      "Marketing strategy session to plan Q2 campaigns, review performance metrics, and align on execution timelines.",
    hostVideo: false,
    participantVideo: false,
    waitingRoom: false,
    recording: false,
    joinUrl: "https://zoom.us/j/567-8901-2345",
    startUrl: "https://zoom.us/s/567-8901-2345",
  },
  {
    id: 6,
    title: "Q4 Project Planning Session - Strategic Roadmap Development",
    meetingId: "678-9012-3456",
    password: "Q4PLAN",
    startTime: "2025-11-16 14:00",
    duration: 60,
    host: makeParticipant(6, "Michael Brown"),
    participants: [
      makeParticipant(6, "Michael Brown"),
      makeParticipant(8, "Anthony Walker"),
    ],
    status: "Ended",
    description:
      "Q4 strategic planning session to develop project roadmaps, set milestones, and align cross-functional teams.",
    hostVideo: true,
    participantVideo: false,
    waitingRoom: true,
    recording: true,
    joinUrl: "https://zoom.us/j/678-9012-3456",
    startUrl: "https://zoom.us/s/678-9012-3456",
  },
  {
    id: 7,
    title: "Innovation Brainstorming Session - Creative Solution Workshop",
    meetingId: "789-0123-4567",
    password: "INNOV8",
    startTime: "2025-10-04 11:00",
    duration: 30,
    host: makeParticipant(7, "Christopher Lee"),
    participants: [
      makeParticipant(7, "Christopher Lee"),
      makeParticipant(1, "Amanda White"),
      makeParticipant(4, "Michelle Hall"),
    ],
    status: "Ended",
    description:
      "Creative workshop to brainstorm innovative solutions for current product challenges and identify new growth opportunities.",
    hostVideo: true,
    participantVideo: true,
    waitingRoom: false,
    recording: false,
    joinUrl: "https://zoom.us/j/789-0123-4567",
    startUrl: "https://zoom.us/s/789-0123-4567",
  },
  {
    id: 8,
    title: "Quarterly Business Review - Performance Analysis & Strategy",
    meetingId: "890-1234-5678",
    password: "QBR2025",
    startTime: "2025-10-18 11:30",
    duration: 30,
    host: makeParticipant(6, "Michael Brown"),
    participants: [
      makeParticipant(6, "Michael Brown"),
      makeParticipant(8, "Anthony Walker"),
      makeParticipant(5, "David Wilson"),
      makeParticipant(12, "Mark Allen"),
    ],
    status: "Cancelled",
    description:
      "Quarterly business review analyzing performance metrics, revenue trends, and strategic adjustments for the remaining quarter.",
    hostVideo: false,
    participantVideo: false,
    waitingRoom: true,
    recording: false,
    joinUrl: "https://zoom.us/j/890-1234-5678",
    startUrl: "https://zoom.us/s/890-1234-5678",
  },
  {
    id: 9,
    title: "Risk Assessment Review - Mitigation Strategy Development",
    meetingId: "901-2345-6789",
    password: "RISK25",
    startTime: "2025-09-02 16:00",
    duration: 60,
    host: makeParticipant(8, "Anthony Walker"),
    participants: [
      makeParticipant(8, "Anthony Walker"),
      makeParticipant(9, "Prime Materials Ltd"),
    ],
    status: "Started",
    description:
      "Risk assessment review to identify organizational risks, evaluate impact levels, and develop targeted mitigation strategies.",
    hostVideo: true,
    participantVideo: false,
    waitingRoom: true,
    recording: true,
    joinUrl: "https://zoom.us/j/901-2345-6789",
    startUrl: "https://zoom.us/s/901-2345-6789",
  },
  {
    id: 10,
    title: "Quality Assurance Meeting - Process Improvement Review",
    meetingId: "012-3456-7890",
    password: "QA2026",
    startTime: "2026-02-01 10:00",
    duration: 120,
    host: makeParticipant(9, "Prime Materials Ltd"),
    participants: [
      makeParticipant(9, "Prime Materials Ltd"),
      makeParticipant(1, "Amanda White"),
      makeParticipant(4, "Michelle Hall"),
    ],
    status: "Scheduled",
    description:
      "QA meeting to review process improvement initiatives, analyze defect metrics, and plan corrective actions.",
    hostVideo: true,
    participantVideo: true,
    waitingRoom: true,
    recording: true,
    joinUrl: "https://zoom.us/j/012-3456-7890",
    startUrl: "https://zoom.us/s/012-3456-7890",
  },
  {
    id: 11,
    title: "Product Roadmap Planning - Feature Prioritization Workshop",
    meetingId: "111-2222-3333",
    password: "PROD26",
    startTime: "2026-04-10 14:00",
    duration: 90,
    host: makeParticipant(11, "James Garcia"),
    participants: [
      makeParticipant(11, "James Garcia"),
      makeParticipant(5, "David Wilson"),
      makeParticipant(7, "Christopher Lee"),
    ],
    status: "Scheduled",
    description:
      "Product roadmap session to prioritize upcoming features based on customer feedback and business value.",
    hostVideo: true,
    participantVideo: false,
    waitingRoom: true,
    recording: false,
    joinUrl: "https://zoom.us/j/111-2222-3333",
    startUrl: "https://zoom.us/s/111-2222-3333",
  },
  {
    id: 12,
    title: "Team Building Workshop - Collaboration & Communication",
    meetingId: "222-3333-4444",
    password: "TEAM25",
    startTime: "2025-12-12 15:00",
    duration: 60,
    host: makeParticipant(4, "Michelle Hall"),
    participants: [
      makeParticipant(4, "Michelle Hall"),
      makeParticipant(1, "Amanda White"),
      makeParticipant(12, "Mark Allen"),
      makeParticipant(8, "Anthony Walker"),
    ],
    status: "Ended",
    description:
      "Virtual team building workshop focused on improving collaboration, communication skills, and team cohesion.",
    hostVideo: true,
    participantVideo: true,
    waitingRoom: false,
    recording: true,
    joinUrl: "https://zoom.us/j/222-3333-4444",
    startUrl: "https://zoom.us/s/222-3333-4444",
  },
  {
    id: 13,
    title: "Customer Success Review - Retention Strategy Discussion",
    meetingId: "333-4444-5555",
    password: "CUST25",
    startTime: "2025-12-05 11:00",
    duration: 45,
    host: makeParticipant(2, "Alex Vendor"),
    participants: [
      makeParticipant(2, "Alex Vendor"),
      makeParticipant(9, "Prime Materials Ltd"),
      makeParticipant(10, "Professional Services"),
    ],
    status: "Ended",
    description:
      "Customer success review to analyze retention metrics, identify at-risk accounts, and develop proactive engagement strategies.",
    hostVideo: false,
    participantVideo: false,
    waitingRoom: true,
    recording: true,
    joinUrl: "https://zoom.us/j/333-4444-5555",
    startUrl: "https://zoom.us/s/333-4444-5555",
  },
  {
    id: 14,
    title: "Security Audit Meeting - Compliance Framework Review",
    meetingId: "444-5555-6666",
    password: "SEC2026",
    startTime: "2026-05-20 09:00",
    duration: 120,
    host: makeParticipant(3, "Sam Supplier"),
    participants: [
      makeParticipant(3, "Sam Supplier"),
      makeParticipant(6, "Michael Brown"),
      makeParticipant(11, "James Garcia"),
    ],
    status: "Scheduled",
    description:
      "Security audit meeting to review compliance framework, identify vulnerabilities, and plan remediation activities.",
    hostVideo: true,
    participantVideo: false,
    waitingRoom: true,
    recording: true,
    joinUrl: "https://zoom.us/j/444-5555-6666",
    startUrl: "https://zoom.us/s/444-5555-6666",
  },
  {
    id: 15,
    title: "Vendor Partnership Meeting - Contract Negotiation & Review",
    meetingId: "555-6666-7777",
    password: "VEND25",
    startTime: "2025-11-30 14:30",
    duration: 60,
    host: makeParticipant(12, "Mark Allen"),
    participants: [
      makeParticipant(12, "Mark Allen"),
      makeParticipant(2, "Alex Vendor"),
      makeParticipant(3, "Sam Supplier"),
    ],
    status: "Ended",
    description:
      "Vendor partnership meeting to review contract terms, discuss renewal options, and negotiate service level agreements.",
    hostVideo: false,
    participantVideo: false,
    waitingRoom: false,
    recording: false,
    joinUrl: "https://zoom.us/j/555-6666-7777",
    startUrl: "https://zoom.us/s/555-6666-7777",
  },
];

const ALL_PARTICIPANTS = HOSTS;
const STATUS_OPTIONS: MeetingStatus[] = [
  "Scheduled",
  "Started",
  "Ended",
  "Cancelled",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SortIcon = () => (
  <span className="inline-flex flex-col ml-1 text-gray-400">
    <ChevronUp className="w-3 h-3 -mb-0.5" />
    <ChevronDown className="w-3 h-3" />
  </span>
);

// Avatar circle
const Avatar: React.FC<{ p: Participant; size?: number }> = ({
  p,
  size = 28,
}) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundColor: p.color,
      fontSize: size * 0.38,
    }}
    className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 border-2 border-white"
    title={p.name}
  >
    {p.avatar}
  </div>
);

// Stacked avatars
const ParticipantAvatars: React.FC<{ participants: Participant[] }> = ({
  participants,
}) => {
  const shown = participants.slice(0, 4);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar p={p} size={28} />
        </div>
      ))}
      {participants.length > 4 && (
        <div
          style={{ marginLeft: -8, width: 28, height: 28, fontSize: 10 }}
          className="rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium border-2 border-white"
        >
          +{participants.length - 4}
        </div>
      )}
    </div>
  );
};

// Status badge config
const statusCfg: Record<MeetingStatus, { cls: string; dotCls: string }> = {
  Started: {
    cls: "bg-green-100 text-green-700 border border-green-200",
    dotCls: "bg-green-500",
  },
  Scheduled: {
    cls: "bg-blue-100 text-blue-600 border border-blue-200",
    dotCls: "bg-blue-500",
  },
  Ended: { cls: "text-gray-600", dotCls: "bg-gray-400" },
  Cancelled: {
    cls: "bg-red-100 text-red-500 border border-red-200",
    dotCls: "bg-red-400",
  },
};

// Toggle switch
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-gray-300"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
    <span className="text-sm text-gray-700">{label}</span>
  </div>
);

// Radio
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

// ─── Status Dropdown Badge ────────────────────────────────────────────────────

const StatusDropdown: React.FC<{
  status: MeetingStatus;
  onChange: (s: MeetingStatus) => void;
}> = ({ status, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const cfg = statusCfg[status];
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${cfg.cls}`}
      >
        {(status === "Started" || status === "Scheduled") && (
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotCls}`} />
        )}
        {status}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors ${s === status ? "font-medium text-emerald-600" : "text-gray-700"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Meeting Details Modal ────────────────────────────────────────────────────

const MeetingDetailsModal: React.FC<{
  meeting: ZoomMeeting;
  onClose: () => void;
}> = ({ meeting, onClose }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  const cfg = statusCfg[meeting.status];

  const FeaturePill: React.FC<{ enabled: boolean; label: string }> = ({
    enabled,
    label,
  }) => (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${enabled ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 border border-gray-200"}`}
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">
            Meeting Details
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 2-col info grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">
                Title
              </div>
              <div className="text-sm text-gray-900">{meeting.title}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">
                Meeting ID
              </div>
              <div className="text-sm text-gray-900 font-mono">
                {meeting.meetingId}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">
                Meeting Password
              </div>
              <div className="text-sm text-gray-900 font-mono">
                {meeting.password}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">
                Start Time
              </div>
              <div className="text-sm text-gray-900">{meeting.startTime}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">
                Duration
              </div>
              <div className="text-sm text-gray-900">
                {meeting.duration} minutes
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">
                Status
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}
              >
                {meeting.status}
              </span>
            </div>
          </div>

          {/* Host */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">Host</div>
            <div className="flex items-center gap-2">
              <Avatar p={meeting.host} size={32} />
              <span className="text-sm text-gray-900">{meeting.host.name}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">
              Description
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {meeting.description}
            </p>
          </div>

          {/* Participants */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Participants
            </div>
            <div className="flex flex-wrap gap-2">
              {meeting.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-0.5 pr-3 py-0.5"
                >
                  <Avatar p={p} size={24} />
                  <span className="text-xs text-gray-700">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature toggles */}
          <div className="grid grid-cols-2 gap-4">
            <FeaturePill enabled={meeting.hostVideo} label="Host Video" />
            <FeaturePill
              enabled={meeting.participantVideo}
              label="Participant Video"
            />
            <FeaturePill enabled={meeting.waitingRoom} label="Waiting Room" />
            <FeaturePill enabled={meeting.recording} label="Recording" />
          </div>

          {/* Meeting Links */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-800">
                Meeting Links
              </div>
              <button
                onClick={() => copy(meeting.joinUrl, "join-header")}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 border border-gray-200 rounded px-2 py-1"
              >
                {copied === "join-header" ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                Copy Join URL
              </button>
            </div>
            {[
              { label: "Join URL:", url: meeting.joinUrl, key: "join" },
              { label: "Start URL:", url: meeting.startUrl, key: "start" },
            ].map((row) => (
              <div key={row.key} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                  {row.label}
                </span>
                <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                  <span className="text-xs text-gray-600 font-mono truncate flex-1">
                    {row.url}
                  </span>
                  <button
                    onClick={() => copy(row.url, row.key)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    {copied === row.key ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onSave: (data: Partial<ZoomMeeting>) => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [password, setPassword] = useState("");
  const [startTime, setStart] = useState("");
  const [duration, setDuration] = useState(0);
  const [hostVideo, setHV] = useState(false);
  const [partVideo, setPV] = useState(false);
  const [waitRoom, setWR] = useState(false);
  const [recording, setRec] = useState(false);
  const [status, setStatus] = useState<MeetingStatus>("Scheduled");
  const [participantIds, setParticipantIds] = useState<number[]>([]);
  const [hostId, setHostId] = useState<number | null>(null);

  const handleCreate = () => {
    if (!title.trim() || !startTime) return;
    const host = HOSTS.find((h) => h.id === hostId) ?? HOSTS[0];
    const participants = HOSTS.filter((h) => participantIds.includes(h.id));
    const id = Date.now();
    onSave({
      id,
      title: title.trim(),
      description,
      password,
      startTime,
      duration,
      host,
      participants,
      status,
      hostVideo,
      participantVideo: partVideo,
      waitingRoom: waitRoom,
      recording,
      meetingId: `${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
      joinUrl: `https://zoom.us/j/${id}`,
      startUrl: `https://zoom.us/s/${id}`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">
            Create Zoom Meeting
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter Title"
              className="w-full border border-emerald-500 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Enter Description"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none resize-y focus:border-emerald-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Meeting Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Meeting Password"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Start Time <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden focus-within:border-emerald-500">
              <span className="px-3 py-2 text-gray-400">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStart(e.target.value)}
                placeholder="Select Start Time"
                className="flex-1 py-2 pr-3 text-sm outline-none bg-white text-gray-700"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Duration <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          {/* Feature toggles */}
          <div className="space-y-3">
            <Toggle checked={hostVideo} onChange={setHV} label="Host Video" />
            <Toggle
              checked={partVideo}
              onChange={setPV}
              label="Participant Video"
            />
            <Toggle checked={waitRoom} onChange={setWR} label="Waiting Room" />
            <Toggle checked={recording} onChange={setRec} label="Recording" />
          </div>

          {/* Status radios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-4 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <Radio
                  key={s}
                  label={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                />
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Participants
            </label>
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id && !participantIds.includes(id))
                    setParticipantIds((p) => [...p, id]);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white appearance-none focus:border-emerald-500"
              >
                <option value="">Select Participants...</option>
                {HOSTS.filter((h) => !participantIds.includes(h.id)).map(
                  (h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ),
                )}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {participantIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {participantIds.map((id) => {
                  const p = HOSTS.find((h) => h.id === id)!;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
                    >
                      {p.name}
                      <button
                        onClick={() =>
                          setParticipantIds((prev) =>
                            prev.filter((i) => i !== id),
                          )
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Host
            </label>
            <div className="relative">
              <select
                value={hostId ?? ""}
                onChange={(e) => setHostId(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none bg-white appearance-none focus:border-emerald-500"
              >
                <option value="">Select Host</option>
                {HOSTS.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────────────────

const DeleteModal: React.FC<{
  meeting: ZoomMeeting | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ meeting, onClose, onConfirm }) => {
  if (!meeting) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Delete Meeting
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete{" "}
          <span className="font-medium text-gray-900">"{meeting.title}"</span>?
          This cannot be undone.
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

export const ZoomMeetings: React.FC = () => {
  const [meetings, setMeetings] = useState<ZoomMeeting[]>(initialMeetings);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [viewingMeeting, setViewingMeeting] = useState<ZoomMeeting | null>(
    null,
  );
  const [deletingMeeting, setDeletingMeeting] = useState<ZoomMeeting | null>(
    null,
  );
  const [showCreate, setShowCreate] = useState(false);
  const [joinTooltip, setJoinTooltip] = useState<number | null>(null);

  const filtered = meetings.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.host.name.toLowerCase().includes(search.toLowerCase()) ||
      m.status.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const updateStatus = (id: number, status: MeetingStatus) =>
    setMeetings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status } : m)),
    );

  const handleDelete = () => {
    if (!deletingMeeting) return;
    setMeetings((prev) => prev.filter((m) => m.id !== deletingMeeting.id));
    setDeletingMeeting(null);
  };

  const handleCreate = (data: Partial<ZoomMeeting>) => {
    setMeetings((prev) => [data as ZoomMeeting, ...prev]);
    setPage(1);
  };

  // Determine which action icons to show based on status
  const getActions = (m: ZoomMeeting) => {
    const canStart = m.status === "Started" || m.status === "Scheduled";
    const canEdit = m.status === "Scheduled";
    return { canStart, canEdit };
  };

  return (
    <div className="flex-1 bg-[#FAFBFC] flex flex-col overflow-hidden">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">Zoom Meetings</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1">
          <Globe className="w-4 h-4" />
          <span>en English</span>
        </div>
      </div>

      {/* Page title */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Manage Zoom Meetings
        </h1>
        <button
          onClick={() => setShowCreate(true)}
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
                placeholder="Search Zoom Meetings..."
                className="px-3 py-2 text-sm outline-none w-52"
              />
            </div>
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium">
              Search
            </button>
          </div>
          <div className="flex items-center gap-2">
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
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-600 bg-white hover:bg-gray-50">
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
                    Title <SortIcon />
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Start Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Host Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Participants
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((m) => {
                const { canStart, canEdit } = getActions(m);
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5 text-gray-900 text-sm max-w-xs">
                      {m.title}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-sm whitespace-nowrap">
                      {m.startTime}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-sm whitespace-nowrap">
                      {m.duration} minutes
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <Avatar p={m.host} size={26} />
                        <span className="text-sm text-gray-700">
                          {m.host.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <ParticipantAvatars participants={m.participants} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusDropdown
                        status={m.status}
                        onChange={(s) => updateStatus(m.id, s)}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 relative">
                        {/* External link — only for Started/Scheduled */}
                        {canStart && (
                          <div
                            className="relative"
                            onMouseEnter={() => setJoinTooltip(m.id * 10 + 1)}
                            onMouseLeave={() => setJoinTooltip(null)}
                          >
                            <button className="text-pink-400 hover:text-pink-600 transition-colors">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {joinTooltip === m.id * 10 + 1 && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-white border border-gray-200 shadow text-xs text-gray-700 rounded whitespace-nowrap z-10">
                                Join Meeting
                              </div>
                            )}
                          </div>
                        )}
                        {/* Play — only for Started/Scheduled */}
                        {canStart && (
                          <button className="text-pink-400 hover:text-pink-600 transition-colors">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {/* Eye */}
                        <button
                          onClick={() => setViewingMeeting(m)}
                          className="text-teal-500 hover:text-teal-700 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Edit — only Scheduled */}
                        {canEdit && (
                          <button
                            className="text-blue-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {/* Delete */}
                        <button
                          onClick={() => setDeletingMeeting(m)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-gray-400"
                  >
                    No meetings found.
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
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40"
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
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {viewingMeeting && (
        <MeetingDetailsModal
          meeting={viewingMeeting}
          onClose={() => setViewingMeeting(null)}
        />
      )}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}
      <DeleteModal
        meeting={deletingMeeting}
        onClose={() => setDeletingMeeting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default ZoomMeetings;
