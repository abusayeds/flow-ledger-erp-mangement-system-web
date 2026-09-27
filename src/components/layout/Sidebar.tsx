/**
 * File: src/components/layout/Sidebar.tsx
 * Sidebar structured to match the reference design:
 *   Dashboard · Sales · Purchases · Items · Time Logs · Projects ·
 *   Documents · Reports · Team · Rewards · Banking · … · Companies (last)
 * All existing modules are kept and grouped below the reference core.
 *
 * Legacy: MainLayout now shows these modules in the navbar (TopNav.tsx).
 * Kept for OldApp; menu data lives in ./navItems.
 */

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, HelpCircle, Menu, X } from "lucide-react";
import Logo from "../../assets/logo.png";
import { useVisibleNavItems, type NavItem } from "./navItems";

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const COLLAPSED_WIDTH = 60;
const DEFAULT_WIDTH = 260;

export const Sidebar: React.FC<SidebarProps> = ({
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const location = useLocation();
  const visibleItems = useVisibleNavItems();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Sales"]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 1024px)").matches,
  );

  // Sidebar width is now driven purely by collapsed state (toggled via the
  // burger icon) — no drag-to-resize. Only the middle list panel is resizable.
  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : DEFAULT_WIDTH;

  // Track desktop vs. mobile so the collapse behaviour (a desktop-only
  // feature) never leaks into the mobile slide-in drawer.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // On mobile the drawer is always full-width/expanded, regardless of the width
  // the user dragged to or collapsed on desktop.
  const collapsed = isDesktop && isCollapsed;

  const toggleCollapse = () => setIsCollapsed((c) => !c);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label],
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isParentActive = (children?: NavItem[]) => {
    if (!children) return false;
    return children.some((child) => location.pathname === child.path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed lg:relative inset-y-0 left-0 z-50
          h-screen w-72 max-w-[85vw] lg:max-w-none flex flex-col
          transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
        {/* Logo Header */}
        <div className="app-navbar h-16 flex-shrink-0 flex items-center justify-between px-4 bg-white border-b border-gray-200">
          {!collapsed && (
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
              {/* Logo Icon */}
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                <img src={Logo} alt="Qayd Logo" />
              </div>
              {/* Logo Text */}
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Qayd
              </h1>
            </Link>
          )}

          {collapsed && (
            <div className="flex items-center justify-center w-full">
              <button
                className="hidden lg:flex p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                onClick={toggleCollapse}
                title="Expand sidebar"
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          )}

          {/* Mobile Close / Desktop Menu Toggle */}
          {!collapsed && (
            <>
              <button
                className="lg:hidden p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
              <button
                className="hidden lg:block p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                onClick={toggleCollapse}
              >
                <Menu className="w-5 h-5 text-gray-700" />
              </button>
            </>
          )}
        </div>

        {/* Menu & Footer Container */}
        <div className="sidebar-nav-shell flex-1 overflow-hidden flex flex-col my-2 ml-2 border border-r-0 shadow-sm">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2 hover-scrollbar">
          <ul className="">
            {visibleItems.map((item) => (
              <li key={item.label}>
                {/* Parent with Children */}
                {item.children && item.children.length > 0 ? (
                  <>
                    <button
                      onClick={() => !collapsed && toggleExpand(item.label)}
                      className={`
                        sidebar-nav-item w-full flex items-center ${collapsed ? "justify-center" : "justify-between"} px-2.5 py-2
                         font-normal transition-all duration-150 border-y border-transparent
                        ${
                          isParentActive(item.children)
                            ? "is-active bg-blue-600 shadow-sm"
                            : "hover:bg-black/10"
                        }
                      `}
                      title={collapsed ? item.label : ""}
                    >
                      <div
                        className={`flex items-center ${collapsed ? "" : "gap-2.5"}`}
                      >
                        <item.icon
                          className="w-[16px] h-[16px]"
                          strokeWidth={1.8}
                        />
                        {!collapsed && (
                          <span className="tracking-tight">{item.label}</span>
                        )}
                      </div>
                      {!collapsed &&
                        (expandedItems.includes(item.label) ? (
                          <ChevronDown
                            className="w-3.5 h-3.5 opacity-70"
                            strokeWidth={2}
                          />
                        ) : (
                          <ChevronRight
                            className="w-3.5 h-3.5 opacity-70"
                            strokeWidth={2}
                          />
                        ))}
                    </button>

                    {/* Children - icon + label */}
                    {!collapsed && expandedItems.includes(item.label) && (
                      <ul className="sidebar-nav-children mt-0.5 space-y-0.5 ml-5 border-l border-current/15">
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <Link
                              to={child.path || "#"}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`
                                sidebar-nav-item flex items-center gap-2.5 px-2.5 py-2
                                 transition-all duration-150
                                ${
                                  isActive(child.path)
                                    ? "is-active bg-blue-600 font-medium shadow-sm"
                                    : "hover:bg-black/10"
                                }
                              `}
                            >
                              <child.icon
                                className="w-[15px] h-[15px] flex-shrink-0"
                                strokeWidth={1.8}
                              />
                              <span className="tracking-tight">
                                {child.label}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  /* Single Item */
                  <Link
                    to={item.path || "#"}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      sidebar-nav-item flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-2.5 py-2
                       font-normal transition-all duration-150
                      ${
                        isActive(item.path)
                          ? "is-active bg-blue-600 font-medium shadow-sm"
                          : "hover:bg-black/10"
                      }
                    `}
                    title={collapsed ? item.label : ""}
                  >
                    <item.icon
                      className="w-[16px] h-[16px]"
                      strokeWidth={1.8}
                    />
                    {!collapsed && (
                      <span className="tracking-tight">{item.label}</span>
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Get Help Footer */}
        <div className="sidebar-nav-footer border-t border-current/15 p-2">
          <Link
            to="/get-help"
            className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2.5"} px-2.5 py-2 rounded-md hover:bg-black/10 transition-all duration-150`}
            title={collapsed ? "Get Help" : ""}
          >
            <HelpCircle className="w-[16px] h-[16px]" strokeWidth={1.8} />
            {!collapsed && <span className="tracking-tight">Get Help</span>}
          </Link>
        </div>
        </div>
      </div>
    </>
  );
};
