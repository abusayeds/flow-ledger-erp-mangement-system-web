import React, { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface BankDetailsModalProps {
  onClose: () => void;
}

export const BankDetailsModal: React.FC<BankDetailsModalProps> = ({ onClose }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [textColor, setTextColor] = useState("#000000");
  const [fontSize, setFontSize] = useState("");

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handleColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setTextColor(color);
    exec("foreColor", color);
  };

  const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFontSize(e.target.value);
    if (e.target.value) exec("fontSize", e.target.value);
  };

  const isEmpty = () => {
    const text = editorRef.current?.innerText ?? "";
    return text.trim() === "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: "80vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Bank Details</h2>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 flex-shrink-0">
          {/* Bold */}
          <button
            onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-800 font-bold text-sm"
            title="Bold"
          >
            B
          </button>

          {/* Italic */}
          <button
            onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-800 italic text-sm font-medium"
            title="Italic"
          >
            I
          </button>

          {/* Underline */}
          <button
            onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-800 underline text-sm font-medium"
            title="Underline"
          >
            U
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Text Color */}
          <label
            className="relative flex items-center gap-0.5 border border-gray-300 rounded px-2 py-1 cursor-pointer hover:bg-gray-50"
            title="Text Color"
          >
            <div className="w-4 h-4 rounded-sm border border-gray-400" style={{ backgroundColor: textColor }} />
            <ChevronDown className="w-3 h-3 text-gray-500" />
            <input
              type="color"
              value={textColor}
              onChange={handleColor}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>

          {/* Font size */}
          <div className="relative">
            <select
              value={fontSize}
              onChange={handleFontSize}
              className="appearance-none border border-gray-300 rounded px-2 pr-6 py-1 text-sm text-gray-700 bg-white focus:outline-none hover:bg-gray-50 cursor-pointer min-w-[52px]"
            >
              <option value=""></option>
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3">12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">36pt</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[260px] relative">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              /* force re-render to update placeholder visibility */
            }}
            className="w-full h-full min-h-[240px] outline-none text-sm text-gray-800 leading-relaxed"
            style={{ wordBreak: "break-word" }}
          />
          {/* Placeholder */}
          {isEmpty() && (
            <span className="absolute top-3 left-4 text-sm text-gray-400 pointer-events-none select-none">
              Bank Details
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
