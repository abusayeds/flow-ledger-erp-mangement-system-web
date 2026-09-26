/**
 * File: src/pages/media/ManageMediaLibrary.tsx
 * Manage Media Library — exact match for all 3 screenshots:
 *
 * Layout:
 *   Left sidebar (fixed 300px):
 *     - QUICK ACCESS → "All Files" with green badge count (20)
 *     - FOLDERS section with + button: services(6) | products(10) each with ⋮ menu → Edit / Delete
 *     - STORAGE USAGE at bottom: storage icon + "Used Space" + "3.35 MB"
 *
 *   Right content panel:
 *     - Top bar: Search media files... | Grid(active) / List toggle | Date↑ sort | 20 Files | 3.35 MB | 20 Images
 *     - Upload Files button (top-right of page)
 *     - Grid view: 5-col grid of image cards
 *       Each card: PNG badge top-left | image | filename | file-size icon + KB | calendar icon + date
 *     - Pagination: Previous / 1 / 2 / Next
 *
 * Media Details modal (clicking any card):
 *   Left: large image preview
 *   Right: File Information — File Name | Display Name | File Type (pill) | File Size | Upload Date | File URL (copy btn)
 *          Actions: View | Download | Delete
 *
 * Folder ⋮ context menu: Edit | Delete (with icons)
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Globe,
  Upload,
  Search,
  Grid3X3,
  List,
  ChevronUp,
  ChevronDown,
  Folder,
  Plus,
  MoreVertical,
  Home,
  HardDrive,
  Image as ImageIcon,
  FileText,
  Calendar,
  File,
  Pencil,
  Trash2,
  Eye,
  Download,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaFile {
  id: number;
  fileName: string;
  displayName: string;
  fileType: string;
  sizeKB: number;
  uploadDate: string;
  folder: string;
  url: string;
  // We use placeholder colored backgrounds instead of real images
  bgColor: string;
  emoji: string;
}

interface FolderItem {
  id: number;
  name: string;
  count: number;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const mediaFiles: MediaFile[] = [
  {
    id: 1,
    fileName: "t4iwz05uklx1y5vPVBujJ090Bi7wfWhjTSXaQsB6.png",
    displayName: "hp-desktop",
    fileType: "image/png",
    sizeKB: 70.35,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#e8f4fd",
    emoji: "🖥️",
    url: "https://example.com/media/t4iwz05uklx1y5vPVBujJ090Bi7wfWhjTSXaQsB6.png",
  },
  {
    id: 2,
    fileName: "hvac_system_img_2026.png",
    displayName: "hvac-system",
    fileType: "image/png",
    sizeKB: 109.92,
    uploadDate: "1/29/2026",
    folder: "services",
    bgColor: "#e8f5e9",
    emoji: "🌀",
    url: "https://example.com/media/hvac_system_img_2026.png",
  },
  {
    id: 3,
    fileName: "industrial_printer_2026.png",
    displayName: "industrial-printer",
    fileType: "image/png",
    sizeKB: 85.45,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#fce4ec",
    emoji: "🖨️",
    url: "https://example.com/media/industrial_printer_2026.png",
  },
  {
    id: 4,
    fileName: "ink_cartridge_image_2026.png",
    displayName: "ink_cartridge_image",
    fileType: "image/png",
    sizeKB: 194.61,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#fff3e0",
    emoji: "🖊️",
    url: "https://example.com/media/ink_cartridge_image_2026.png",
  },
  {
    id: 5,
    fileName: "iphone_pro_image_2026.png",
    displayName: "iphone-pro",
    fileType: "image/png",
    sizeKB: 68.93,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#f3e5f5",
    emoji: "📱",
    url: "https://example.com/media/iphone_pro_image_2026.png",
  },
  {
    id: 6,
    fileName: "laptop_battery_image_2026.png",
    displayName: "laptop_battery_image",
    fileType: "image/png",
    sizeKB: 145.01,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#e0f2f1",
    emoji: "🔋",
    url: "https://example.com/media/laptop_battery_image_2026.png",
  },
  {
    id: 7,
    fileName: "laptop_images_3_2026.png",
    displayName: "laptop_images_3",
    fileType: "image/png",
    sizeKB: 171.07,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#e8eaf6",
    emoji: "💻",
    url: "https://example.com/media/laptop_images_3_2026.png",
  },
  {
    id: 8,
    fileName: "light_bulb_image_2026.png",
    displayName: "light_bulb_image",
    fileType: "image/png",
    sizeKB: 179.03,
    uploadDate: "1/29/2026",
    folder: "services",
    bgColor: "#fffde7",
    emoji: "💡",
    url: "https://example.com/media/light_bulb_image_2026.png",
  },
  {
    id: 9,
    fileName: "notebook_image_2026.png",
    displayName: "notebook_image",
    fileType: "image/png",
    sizeKB: 233.22,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#e8f5e9",
    emoji: "📔",
    url: "https://example.com/media/notebook_image_2026.png",
  },
  {
    id: 10,
    fileName: "football_image_2026.png",
    displayName: "football_image",
    fileType: "image/png",
    sizeKB: 276.83,
    uploadDate: "1/29/2026",
    folder: "products",
    bgColor: "#fce4ec",
    emoji: "⚽",
    url: "https://example.com/media/football_image_2026.png",
  },
  {
    id: 11,
    fileName: "soccer_ball_image_2026.png",
    displayName: "soccer-ball",
    fileType: "image/png",
    sizeKB: 88.4,
    uploadDate: "1/28/2026",
    folder: "products",
    bgColor: "#fff8e1",
    emoji: "⚽",
    url: "https://example.com/media/soccer_ball_image_2026.png",
  },
  {
    id: 12,
    fileName: "hvac_outdoor_unit_2026.png",
    displayName: "hvac-outdoor-unit",
    fileType: "image/png",
    sizeKB: 120.55,
    uploadDate: "1/28/2026",
    folder: "services",
    bgColor: "#e3f2fd",
    emoji: "❄️",
    url: "https://example.com/media/hvac_outdoor_unit_2026.png",
  },
  {
    id: 13,
    fileName: "smart_watch_2026.png",
    displayName: "smart-watch",
    fileType: "image/png",
    sizeKB: 95.3,
    uploadDate: "1/28/2026",
    folder: "products",
    bgColor: "#fbe9e7",
    emoji: "⌚",
    url: "https://example.com/media/smart_watch_2026.png",
  },
  {
    id: 14,
    fileName: "solar_panel_2026.png",
    displayName: "solar-panel",
    fileType: "image/png",
    sizeKB: 143.72,
    uploadDate: "1/27/2026",
    folder: "services",
    bgColor: "#f9fbe7",
    emoji: "☀️",
    url: "https://example.com/media/solar_panel_2026.png",
  },
  {
    id: 15,
    fileName: "wireless_headphones_2026.png",
    displayName: "wireless-headphones",
    fileType: "image/png",
    sizeKB: 112.18,
    uploadDate: "1/27/2026",
    folder: "products",
    bgColor: "#e8eaf6",
    emoji: "🎧",
    url: "https://example.com/media/wireless_headphones_2026.png",
  },
  {
    id: 16,
    fileName: "mechanical_keyboard_2026.png",
    displayName: "mechanical-keyboard",
    fileType: "image/png",
    sizeKB: 160.45,
    uploadDate: "1/26/2026",
    folder: "products",
    bgColor: "#fce4ec",
    emoji: "⌨️",
    url: "https://example.com/media/mechanical_keyboard_2026.png",
  },
  {
    id: 17,
    fileName: "air_purifier_2026.png",
    displayName: "air-purifier",
    fileType: "image/png",
    sizeKB: 98.77,
    uploadDate: "1/26/2026",
    folder: "services",
    bgColor: "#e0f7fa",
    emoji: "💨",
    url: "https://example.com/media/air_purifier_2026.png",
  },
  {
    id: 18,
    fileName: "drone_camera_2026.png",
    displayName: "drone-camera",
    fileType: "image/png",
    sizeKB: 204.33,
    uploadDate: "1/25/2026",
    folder: "products",
    bgColor: "#f3e5f5",
    emoji: "🚁",
    url: "https://example.com/media/drone_camera_2026.png",
  },
  {
    id: 19,
    fileName: "electric_scooter_2026.png",
    displayName: "electric-scooter",
    fileType: "image/png",
    sizeKB: 188.9,
    uploadDate: "1/25/2026",
    folder: "products",
    bgColor: "#e8f5e9",
    emoji: "🛴",
    url: "https://example.com/media/electric_scooter_2026.png",
  },
  {
    id: 20,
    fileName: "gaming_chair_2026.png",
    displayName: "gaming-chair",
    fileType: "image/png",
    sizeKB: 225.6,
    uploadDate: "1/24/2026",
    folder: "products",
    bgColor: "#fce4ec",
    emoji: "🪑",
    url: "https://example.com/media/gaming_chair_2026.png",
  },
];

const initialFolders: FolderItem[] = [
  { id: 1, name: "services", count: 6 },
  { id: 2, name: "products", count: 10 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOTAL_SIZE_MB = 3.35;
const TOTAL_FILES = 20;
const TOTAL_IMAGES = 20;
const PER_PAGE = 10;

// ─── Folder Context Menu ──────────────────────────────────────────────────────

const FolderMenu: React.FC<{
  folder: FolderItem;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ folder, onEdit, onDelete }) => {
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
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
          <button
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-500" /> Edit
          </button>
          <button
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Media Card ───────────────────────────────────────────────────────────────

const MediaCard: React.FC<{ file: MediaFile; onClick: () => void }> = ({
  file,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
  >
    {/* Image area */}
    <div
      className="relative"
      style={{ height: 180, backgroundColor: file.bgColor }}
    >
      <span className="absolute top-2 left-2 bg-gray-700/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
        PNG
      </span>
      <div className="w-full h-full flex items-center justify-center text-7xl select-none">
        {file.emoji}
      </div>
    </div>
    {/* Info */}
    <div className="px-3 py-2.5">
      <div className="text-sm font-medium text-gray-900 truncate mb-1.5">
        {file.displayName}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <File className="w-3 h-3" />
          {file.sizeKB} KB
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {file.uploadDate}
        </span>
      </div>
    </div>
  </div>
);

// ─── Media Details Modal ──────────────────────────────────────────────────────

const MediaDetailsModal: React.FC<{
  file: MediaFile;
  onClose: () => void;
  onDelete: () => void;
}> = ({ file, onClose, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(file.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-start gap-3">
            <ImageIcon className="w-5 h-5 text-gray-600 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Media Details
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                View detailed information about this media
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Image preview */}
          <div className="flex-1 bg-gray-50 border-r border-gray-200 flex items-center justify-center p-6 overflow-hidden">
            <div
              className="w-full rounded-lg flex items-center justify-center"
              style={{
                height: 500,
                backgroundColor: file.bgColor,
                fontSize: 120,
              }}
            >
              {file.emoji}
            </div>
          </div>

          {/* Info panel */}
          <div className="w-80 flex-shrink-0 overflow-y-auto px-6 py-5 space-y-5">
            <h3 className="text-base font-bold text-gray-900">
              File Information
            </h3>

            {/* File Name */}
            <div>
              <div className="text-xs text-gray-400 mb-1">File Name</div>
              <div className="text-sm text-gray-900 break-all font-medium">
                {file.fileName}
              </div>
            </div>
            {/* Display Name */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Display Name</div>
              <div className="text-sm font-semibold text-gray-900">
                {file.displayName}
              </div>
            </div>
            {/* File Type */}
            <div>
              <div className="text-xs text-gray-400 mb-1">File Type</div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-gray-300 text-xs text-gray-700 bg-gray-50">
                {file.fileType}
              </span>
            </div>
            {/* File Size */}
            <div>
              <div className="text-xs text-gray-400 mb-1">File Size</div>
              <div className="text-sm font-semibold text-gray-900">
                {file.sizeKB} KB
              </div>
            </div>
            {/* Upload Date */}
            <div>
              <div className="text-xs text-gray-400 mb-1">Upload Date</div>
              <div className="text-sm font-semibold text-gray-900">
                {file.uploadDate}
              </div>
            </div>
            {/* File URL */}
            <div>
              <div className="text-xs text-gray-400 mb-1">File URL</div>
              <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                <span className="text-xs text-gray-600 break-all flex-1 font-mono">
                  {file.url}
                </span>
                <button
                  onClick={copy}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-3">
                Actions
              </h3>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Eye className="w-4 h-4 text-teal-500" /> View
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4 text-emerald-500" /> Download
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-red-500 hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Add Folder Modal ─────────────────────────────────────────────────────────

const FolderModal: React.FC<{
  mode: "add" | "edit";
  folder?: FolderItem;
  onClose: () => void;
  onSave: (name: string) => void;
}> = ({ mode, folder, onClose, onSave }) => {
  const [name, setName] = useState(folder?.name ?? "");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "add" ? "New Folder" : "Edit Folder"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Folder Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full border border-emerald-500 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Enter folder name"
          />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onSave(name.trim());
                onClose();
              }
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium"
          >
            {mode === "add" ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const MediaLibrary: React.FC = () => {
  const [files, setFiles] = useState<MediaFile[]>(mediaFiles);
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFolder, setActiveFolder] = useState<string>("all");

  const [detailFile, setDetailFile] = useState<MediaFile | null>(null);
  const [folderModal, setFolderModal] = useState<{
    mode: "add" | "edit";
    folder?: FolderItem;
  } | null>(null);

  // Filter
  const filtered = files.filter((f) => {
    const matchSearch =
      f.displayName.toLowerCase().includes(search.toLowerCase()) ||
      f.fileName.toLowerCase().includes(search.toLowerCase());
    const matchFolder = activeFolder === "all" || f.folder === activeFolder;
    return matchSearch && matchFolder;
  });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleDeleteFile = (id: number) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setPage(1);
  };

  const handleAddFolder = (name: string) => {
    setFolders((prev) => [...prev, { id: Date.now(), name, count: 0 }]);
  };

  const handleEditFolder = (id: number, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const handleDeleteFolder = (id: number) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="flex-1 bg-[#FAFBFC] flex flex-col overflow-hidden">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span className="text-gray-400">›</span>
          <span className="hover:text-gray-700 cursor-pointer">Dashboard</span>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 font-medium">Media Library</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-md px-2 py-1">
            <Globe className="w-4 h-4" />
            <span>en English</span>
          </div>
        </div>
      </div>

      {/* Page title + Upload button */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Manage Media Library
        </h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md font-medium transition-colors">
          <Upload className="w-4 h-4" /> Upload Files
        </button>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex-1 overflow-hidden flex">
        {/* ── Left Sidebar ── */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Quick Access */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Quick Access
              </p>
              <button
                onClick={() => {
                  setActiveFolder("all");
                  setPage(1);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${activeFolder === "all" ? "bg-emerald-50 border border-emerald-200" : "hover:bg-gray-50"}`}
              >
                <div className="flex items-center gap-2">
                  <Home
                    className={`w-4 h-4 ${activeFolder === "all" ? "text-emerald-600" : "text-gray-500"}`}
                  />
                  <span
                    className={`text-sm font-medium ${activeFolder === "all" ? "text-emerald-700" : "text-gray-700"}`}
                  >
                    All Files
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {files.length}
                </span>
              </button>
            </div>

            {/* Folders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Folders
                </p>
                <button
                  onClick={() => setFolderModal({ mode: "add" })}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer group ${activeFolder === folder.name ? "bg-gray-100" : "hover:bg-gray-50"}`}
                    onClick={() => {
                      setActiveFolder(folder.name);
                      setPage(1);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">
                        {folder.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                      <span className="text-xs text-gray-500">
                        {folder.count}
                      </span>
                      <FolderMenu
                        folder={folder}
                        onEdit={() => setFolderModal({ mode: "edit", folder })}
                        onDelete={() => handleDeleteFolder(folder.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="border-t border-gray-200 p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Storage Usage
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <HardDrive className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm text-gray-600">Used Space</span>
                <span className="text-sm font-bold text-gray-900">
                  {TOTAL_SIZE_MB} MB
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Content Panel ── */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
              <Search className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search media files..."
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
            </div>

            {/* Grid / List toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-emerald-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-emerald-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Sort */}
            <button className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors">
              Date <ChevronUp className="w-3.5 h-3.5" />
            </button>

            {/* Stats */}
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">{TOTAL_FILES} Files</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <HardDrive className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">{TOTAL_SIZE_MB} MB</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">{TOTAL_IMAGES} Images</span>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-5 gap-4">
            {paged.map((file) => (
              <MediaCard
                key={file.id}
                file={file}
                onClick={() => setDetailFile(file)}
              />
            ))}
            {paged.length === 0 && (
              <div className="col-span-5 flex flex-col items-center justify-center py-20 text-gray-400">
                <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">No media files found.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-auto pt-2">
            <span className="text-sm text-gray-500">
              Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1} to{" "}
              {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}{" "}
              files
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 transition-colors"
              >
                Previous
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
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {detailFile && (
        <MediaDetailsModal
          file={detailFile}
          onClose={() => setDetailFile(null)}
          onDelete={() => handleDeleteFile(detailFile.id)}
        />
      )}

      {folderModal && (
        <FolderModal
          mode={folderModal.mode}
          folder={folderModal.folder}
          onClose={() => setFolderModal(null)}
          onSave={(name) => {
            if (folderModal.mode === "add") {
              handleAddFolder(name);
            } else if (folderModal.folder) {
              handleEditFolder(folderModal.folder.id, name);
            }
          }}
        />
      )}
    </div>
  );
};

export default MediaLibrary;
