/**
 * File: src/components/layout/MainLayout.tsx
 * Main application layout with Header, Sidebar, and Outlet
 */

import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { DataTransferHost } from "@/features/dataTransfer";
import { GlobalApiLoadingBar } from "./GlobalApiLoadingBar";

export const MainLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // List filter toolbars are single-row + overflow-x. Convert vertical wheel
  // into horizontal scroll so chips never need to wrap when the list is narrow.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      const bar = target?.closest?.(".list-filter-toolbar") as HTMLElement | null;
      if (!bar) return;
      if (bar.scrollWidth <= bar.clientWidth + 1) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      bar.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", onWheel, true);
  }, []);

  return (
    <div className="flex h-screen bg-[#FAFBFC]">
      {/* Sidebar - Fixed */}
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Content Area — keep overflow on <main> only so header
          dropdowns (company menu, create, settings) are not clipped. */}
      <div className="relative flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header - Fixed */}
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <div className="pointer-events-none absolute left-0 right-0 top-16 z-30">
          <GlobalApiLoadingBar />
        </div>

        {/* Content - Dynamic (Outlet renders child routes here) */}
        <main className="flex-1 min-h-0 overflow-auto flex flex-col w-full">
          <Outlet />
        </main>
      </div>
      <DataTransferHost />
    </div>
  );
};
