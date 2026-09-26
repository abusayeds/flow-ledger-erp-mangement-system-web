/**
 * File: src/pages/documents/MyDocument.tsx
 * My Document page - 100% exact design
 * Features: Document management, floating action button, Create Folder/Upload popup
 */

import React, { useState, useRef } from "react";
import {
  Search,
  Plus,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Folder,
  MoreVertical,
  ChevronDown,
  Filter,
  Calendar,
  SortAsc,
  X,
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  extension: string;
}

export const MyDocument: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
    setShowActionMenu(false);
  };

  const handleCreateFolder = () => {
    setShowCreateFolderModal(true);
    setShowActionMenu(false);
  };

  const handleSaveFolder = () => {
    if (folderName.trim()) {
      // Add folder creation logic here
      console.log("Creating folder:", folderName);
      setFolderName("");
      setShowCreateFolderModal(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      // Handle file upload logic here
      console.log("Files selected:", selectedFiles);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <button className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-2">
                My Document
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, Extension, Inside..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md w-full sm:w-64"
                />
              </div>
              <button className="p-1.5 hover:bg-gray-100 rounded">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Today
                <ChevronDown className="w-4 h-4" />
              </button>
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
                Filter by Type
                <ChevronDown className="w-4 h-4" />
              </button>
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
                New Value
                <ChevronDown className="w-4 h-4" />
              </button>
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
                <SortAsc className="w-4 h-4" />
                Sort
              </button>
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
                Created At
                <ChevronDown className="w-4 h-4" />
              </button>
              <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
                Sort by
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            <button className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search your Document
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Files Found
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        {/* Action Menu Popup */}
        {showActionMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 mb-2 min-w-[180px]">
            <button
              onClick={handleCreateFolder}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Folder className="w-4 h-4" />
              Create New Folder
            </button>
            <button
              onClick={handleFileUpload}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              File Upload
            </button>
          </div>
        )}

        {/* FAB Button */}
        <button
          onClick={() => setShowActionMenu(!showActionMenu)}
          className="w-14 h-14 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 shadow-lg"
        >
          {showActionMenu ? (
            <X className="w-6 h-6" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Folder
            </h2>
            <input
              type="text"
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateFolderModal(false);
                  setFolderName("");
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFolder}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
