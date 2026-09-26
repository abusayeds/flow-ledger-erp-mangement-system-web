/**
 * File: src/components/layout/ResizableListPanel.tsx
 * Drop-in list panel used across all master/detail pages (Sales, Purchase, …).
 *
 * Changes (2026-09):
 *  - Header slot: dark bg (#1b232b) with white text — matches sidebar + outlet header.
 *  - Borders: straight (no rounding).
 *  - + FAB: fixed above the list footer via shared ListCreateFab (onCreate prop).
 *  - Filter/toolbar area: sticky below the header — never scrolls away.
 *  - Scroll area: only the list rows scroll; header + toolbar + footer are fixed.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { ListCreateFab } from "@/components/ui/ListCreateFab";

const MIN_WIDTH = 320;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 450;

interface ResizableListPanelProps {
  children: React.ReactNode;
  className?: string;
  /** Opens the module create UI. When set, a shared + FAB is rendered above the footer. */
  onCreate?: () => void;
  createTitle?: string;
  /** Hide FAB (e.g. while select/bulk mode is active). */
  hideCreate?: boolean;
}

export const ResizableListPanel: React.FC<ResizableListPanelProps> = ({
  children,
  className = "",
  onCreate,
  createTitle = "Create",
  hideCreate = false,
}) => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [width, handleMouseMove, handleMouseUp],
  );

  useEffect(
    () => () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp],
  );

  return (
    <aside
      style={{ width }}
      className={`relative flex-shrink-0 flex flex-col m-2 mr-0 bg-white border-r border-t border-b border-gray-300 shadow-sm overflow-hidden ${className}`}
    >
      {children}

      {onCreate && !hideCreate && (
        <ListCreateFab onClick={onCreate} title={createTitle} />
      )}

      {/* Vertical drag handle */}
      <div
        onMouseDown={handleDragStart}
        title="Drag to resize"
        className="group absolute right-0 top-0 bottom-0 w-2 translate-x-1/2 z-20 cursor-col-resize flex items-center justify-center"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover:bg-blue-400 transition-colors" />
      </div>
    </aside>
  );
};

export default ResizableListPanel;
