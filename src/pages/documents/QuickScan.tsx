/**
 * File: src/pages/documents/QuickScan.tsx
 * Quick Scan page - 100% exact design
 * Features: Drag and drop upload, file scanning
 */

import React, { useState, useRef } from "react";
import {
  Search,
  Plus,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";

interface ScannedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  processed: boolean;
}

export const QuickScan: React.FC = () => {
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = (uploadedFiles: File[]) => {
    const newFiles: ScannedFile[] = uploadedFiles.map((file) => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      type: file.type,
      size: file.size,
      uploadDate: new Date().toLocaleDateString(),
      processed: false,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Quick Scan</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg mb-6 transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-white"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ minHeight: "280px" }}
          >
            <div className="flex flex-col items-center justify-center h-full py-16 px-6">
              <button
                onClick={handleUploadClick}
                className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-6 h-6 text-gray-600" />
              </button>

              <p className="text-base text-gray-700 mb-1 text-center">
                Drag and Drop your file here or{" "}
                <button
                  onClick={handleUploadClick}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Upload from Computer
                </button>
              </p>

              <p className="text-sm text-gray-500">
                Supported File : PDF, Photos & Image
              </p>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Unprocessed File Section */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-medium text-gray-700">
                Unprocessed File
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Your Document"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* File List */}
            {filteredFiles.length > 0 ? (
              <div className="bg-white rounded-lg border border-gray-200">
                {filteredFiles.map((file, index) => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between p-4 ${
                      index !== filteredFiles.length - 1
                        ? "border-b border-gray-200"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        {file.type.includes("pdf") ? (
                          <FileText className="w-5 h-5 text-blue-600" />
                        ) : file.type.includes("image") ? (
                          <ImageIcon className="w-5 h-5 text-blue-600" />
                        ) : (
                          <File className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(2)} KB • {file.uploadDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
                        Unprocessed
                      </span>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <svg
                          className="w-5 h-5 text-gray-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {searchQuery
                    ? "No files found matching your search"
                    : "No unprocessed files yet. Upload files to get started."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
