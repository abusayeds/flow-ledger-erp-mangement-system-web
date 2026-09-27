/**
 * File: src/components/layout/Header.tsx
 * Top app header (the app has no left sidebar — modules live here):
 *   Dashboard ▾ · Sales ▾ · … as many modules as fit (TopNav)
 *   | search icon (search field opens as a dropdown)
 *   | orange (+): Create new + the modules that did not fit | settings | bell | avatar
 */

import React, { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Bell,
  ChevronDown,
  Search,
  X,
  Check,
  Megaphone,
  Building2,
  Grid3x3,
  Users,
  FileText,
  Receipt,
  FileSpreadsheet,
  StickyNote,
  DollarSign,
  Truck,
  ShoppingCart,
  CreditCard,
  Package,
  Wrench,
  FolderOpen,
  Clock,
  Scan,
} from "lucide-react";
import { SettingsDropdown } from "@/pages/SettingsDropdown";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { ModuleColumns, TopNav } from "@/components/layout/TopNav";
import { filterModuleGroups, groupModules, type NavItem } from "@/components/layout/navItems";
import { FOCUS_GLOBAL_SEARCH_EVENT, focusNavbarSearch } from "@/lib/listToolbarEvents";
import { MyAccountModal } from "@/components/modals/MyAccountModal";
import useAuth from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import { toArray } from "@/services/_http";
import { resolveMediaUrl } from "@/lib/env";

/* ── Create mega-menu (columns mirror the reference) ─────────────── */
const createGroups: {
  title: string;
  items: { label: string; icon: React.ElementType; path: string }[];
}[] = [
  {
    title: "Sales",
    items: [
      { label: "Customer", icon: Users, path: "/sales/customers" },
      { label: "Invoice", icon: FileText, path: "/sales/sales-invoice" },
      { label: "Sales Receipt", icon: Receipt, path: "/sales/sales-receipts" },
      { label: "Proforma Invoice", icon: FileSpreadsheet, path: "/sales/proforma-invoices" },
      { label: "Estimate", icon: FileSpreadsheet, path: "/sales/estimates" },
      { label: "Delivery Challan", icon: Truck, path: "/sales/delivery-challan" },
      { label: "Credit Note", icon: CreditCard, path: "/sales/credit-notes" },
      { label: "Payment Received", icon: DollarSign, path: "/sales/payment-received" },
    ],
  },
  {
    title: "Purchases",
    items: [
      { label: "Vendor", icon: Building2, path: "/purchase/vendors" },
      { label: "Bill", icon: FileText, path: "/purchase/bills" },
      { label: "Debit Note", icon: CreditCard, path: "/purchase/debit-notes" },
      { label: "Purchase Order", icon: ShoppingCart, path: "/purchase/purchase-orders" },
      { label: "Expense", icon: Receipt, path: "/purchase/expense" },
      { label: "Payment Made", icon: DollarSign, path: "/purchase/payment-made" },
    ],
  },
  {
    title: "Items",
    items: [
      { label: "Product", icon: Package, path: "/items/product" },
      { label: "Service", icon: Wrench, path: "/items/services" },
    ],
  },
  {
    title: "Others",
    items: [
      { label: "Project", icon: FolderOpen, path: "/project/projects" },
      { label: "Time Log", icon: Clock, path: "/time-logs" },
      // { label: "My Documents", icon: StickyNote, path: "/documents/my-documents" },
      // { label: "Quick Scan", icon: Scan, path: "/documents/quick-scan" },
    ],
  },
];

const sampleAnnouncements = [
  { id: 1, title: "New feature: Bulk Invoice Export", description: "You can now export multiple invoices at once as PDF or CSV from the Invoices page.", date: "Apr 26, 2026", isNew: true },
  { id: 2, title: "Scheduled maintenance — Apr 30", description: "The app will be unavailable from 2:00 AM to 4:00 AM UTC on April 30 for scheduled maintenance.", date: "Apr 24, 2026", isNew: true },
  { id: 3, title: "Tax season reminder", description: "Don't forget to generate your quarterly tax reports before the deadline.", date: "Apr 18, 2026", isNew: false },
];

const sampleNotifications = [
  { id: 1, title: "Invoice #1 is overdue", description: "Spark Tech Agency — $5,000 due", time: "2h ago", unread: true },
  { id: 2, title: "Payment received", description: "Tech Corp paid Invoice #2", time: "5h ago", unread: true },
  { id: 3, title: "New vendor added", description: "Fair Electronics was added", time: "1d ago", unread: false },
];

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const displayName = user?.name || "Faisal Chowdhury";
  const displayEmail = user?.email || "chowdhuryfaisal66@gmail.com";

  const [companyName, setCompanyName] = useState(displayName);
  const [companyEmail, setCompanyEmail] = useState(displayEmail);
  const [companyLogo, setCompanyLogo] = useState("");
  const [logoBroken, setLogoBroken] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [planBadge, setPlanBadge] = useState<{ name: string; trial: boolean; expired: boolean } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  /** Modules that did not fit in the navbar — listed inside the (+) menu. */
  const [moreModules, setMoreModules] = useState<NavItem[]>([]);
  const [createFilter, setCreateFilter] = useState("");
  const createFilterRef = useRef<HTMLInputElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMyAccount, setShowMyAccount] = useState(false);
  const [showApps, setShowApps] = useState(false);
  const [notifications, setNotifications] = useState(sampleNotifications);
  const [announcements, setAnnouncements] = useState(sampleAnnouncements);
  const [notifTab, setNotifTab] = useState<"notifications" | "announcements">("notifications");

  const createRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const appsRef = useRef<HTMLDivElement>(null);

  const loadCompany = React.useCallback(async () => {
    try {
      const res = await api.raw.get("/company-register/all");
      const list = toArray<any>(res.data);
      const owner = list.find((c) => c.is_owner) || list[0];
      if (!owner) return;
      setCompanyName(String(owner.business_name || displayName).trim() || displayName);
      setCompanyEmail(String(owner.email || displayEmail).trim() || displayEmail);
      const logo = String(owner.logo || owner.company_logo || "").trim();
      setCompanyLogo(logo);
      setLogoBroken(false);
      setIsOwner(!!owner.is_owner || list.length <= 1);
    } catch {
      /* keep defaults from auth */
    }
  }, [displayName, displayEmail]);

  const loadPlan = React.useCallback(async () => {
    try {
      const sub = await api.get<any>("/subscription/my-subscription");
      if (sub && sub.exists !== false && (sub.plan_name || sub.plan_id)) {
        const expired = !!sub.expired;
        setPlanBadge({
          name: String(sub.plan_name || "Premium").trim() || "Premium",
          trial: !!sub.is_trial,
          expired,
        });
      } else {
        setPlanBadge(null);
      }
    } catch {
      setPlanBadge(null);
    }
  }, []);

  useEffect(() => {
    void loadCompany();
    void loadPlan();
  }, [loadCompany, loadPlan]);

  // Refresh logo/name when returning to the tab or after Companies save.
  useEffect(() => {
    const onFocus = () => {
      void loadCompany();
      void loadPlan();
    };
    const onCompanyChanged = () => void loadCompany();
    const onSubChanged = () => void loadPlan();
    window.addEventListener("focus", onFocus);
    window.addEventListener("qayd:company-changed", onCompanyChanged);
    window.addEventListener("qayd:subscription-changed", onSubChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("qayd:company-changed", onCompanyChanged);
      window.removeEventListener("qayd:subscription-changed", onSubChanged);
    };
  }, [loadCompany, loadPlan]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (createRef.current && !createRef.current.contains(t)) setShowCreate(false);
      if (notifRef.current && !notifRef.current.contains(t)) setShowNotifications(false);
      if (appsRef.current && !appsRef.current.contains(t)) setShowApps(false);
      // The search's date picker renders in a body portal — clicks there are "inside".
      const inDatePicker = (t as Element).closest?.(".app-date-panel");
      if (searchRef.current && !searchRef.current.contains(t) && !inDatePicker) setShowSearch(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSearch(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Search lives behind an icon: the icon and the list pages' Search buttons
  // (focusNavbarSearch) both open the dropdown; GlobalSearch stays mounted and
  // focuses its own input on the same event.
  useEffect(() => {
    const open = () => {
      // Commit synchronously: GlobalSearch focuses its input right after this
      // event, and a still-hidden input can't take focus.
      flushSync(() => {
        setShowSearch(true);
        setShowCreate(false);
        setShowNotifications(false);
      });
    };
    window.addEventListener(FOCUS_GLOBAL_SEARCH_EVENT, open);
    return () => window.removeEventListener(FOCUS_GLOBAL_SEARCH_EVENT, open);
  }, []);
  useEffect(() => {
    setShowSearch(false);
    setShowCreate(false);
  }, [location.pathname]);

  // (+) menu: fresh filter + focus each time it opens.
  useEffect(() => {
    if (!showCreate) return;
    setCreateFilter("");
    createFilterRef.current?.focus();
  }, [showCreate]);

  const createQuery = createFilter.trim().toLowerCase();
  const createShown = createGroups
    .map((g) => ({
      ...g,
      items:
        !createQuery || g.title.toLowerCase().includes(createQuery)
          ? g.items
          : g.items.filter((i) => i.label.toLowerCase().includes(createQuery)),
    }))
    .filter((g) => g.items.length > 0);
  const moreGroups = filterModuleGroups(groupModules(moreModules), createFilter);
  const moreActive = moreModules.some(
    (m) => m.path === location.pathname || !!m.children?.some((c) => c.path === location.pathname),
  );

  const unreadCount = notifications.filter((n) => n.unread).length;
  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

  const appShortcuts = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Invoices", path: "/sales/sales-invoice" },
    { label: "Customers", path: "/accounting/customer" },
    { label: "Products", path: "/items/product" },
    { label: "Reports", path: "/reports" },
    { label: "HRM", path: "/hrm/employees" },
    { label: "CRM", path: "/crm/leads" },
    { label: "Projects", path: "/project/projects" },
    { label: "Timesheet", path: "/timesheet" },
  ];

  const companyInitial = (companyName || displayName || "?").charAt(0).toUpperCase();
  const companyLogoUrl = resolveMediaUrl(companyLogo);
  const showLogo = !!companyLogoUrl && !logoBroken;

  const CompanyAvatar: React.FC<{ size?: string; textSize?: string }> = ({
    size = "w-8 h-8",
    textSize = "text-sm",
  }) => (
    <div className={`${size} rounded-full bg-blue-600 flex items-center justify-center text-white ${textSize} font-semibold overflow-hidden flex-shrink-0`}>
      {showLogo ? (
        <img
          src={companyLogoUrl}
          alt={companyName || "Company"}
          className="w-full h-full object-cover"
          onError={() => setLogoBroken(true)}
        />
      ) : (
        companyInitial
      )}
    </div>
  );

  return (
    <div className="app-navbar h-16 bg-white border-b border-gray-200 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 relative z-40">
      {/* Main modules: Dashboard first, then as many as fit (the rest → (+) menu) */}
      <TopNav onOverflowChange={setMoreModules} />

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Search icon → search field opens as a dropdown */}
        <div className="relative" ref={searchRef}>
          <button
            type="button"
            onClick={() => (showSearch ? setShowSearch(false) : focusNavbarSearch())}
            className={`p-1.5 rounded transition-colors ${showSearch ? "is-open bg-gray-100" : "hover:bg-gray-100"}`}
            title="Search"
            aria-expanded={showSearch}
          >
            <Search className="w-6 h-6 text-gray-700" />
          </button>
          {/* Kept mounted (hidden) so list-page Search buttons can still focus it. */}
          <div
            className={`${showSearch ? "" : "hidden"} absolute right-0 top-11 z-50 w-[min(92vw,480px)] bg-white rounded-lg shadow-xl border border-gray-200 p-3`}
          >
            <div className="flex">
              <GlobalSearch />
            </div>
          </div>
        </div>

        {/* Orange (+): create new + the modules that don't fit in the navbar */}
        <div className="relative" ref={createRef}>
          <button
            onClick={() => {
              setShowCreate((s) => !s);
              setShowNotifications(false);
              setShowApps(false);
              setShowSearch(false);
            }}
            className={`w-9 h-9 flex-shrink-0 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center transition-colors shadow-sm ${
              moreActive ? "ring-2 ring-offset-2 ring-blue-600" : ""
            }`}
            title={moreModules.length ? "Create new · More modules" : "Create new"}
            aria-expanded={showCreate}
          >
            <Plus className="w-5 h-5 text-white" strokeWidth={2.2} />
          </button>

          {showCreate && (
            <div className="top-nav-dropdown absolute right-0 top-[calc(100%+0.6rem)] z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-[min(96vw,980px)] max-h-[calc(100vh-6rem)] overflow-y-auto hover-scrollbar">
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={createFilterRef}
                  value={createFilter}
                  onChange={(e) => setCreateFilter(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const firstCreate = createShown[0]?.items[0];
                    const firstPage = moreGroups[0]?.children?.[0];
                    if (firstCreate) {
                      setShowCreate(false);
                      navigate(firstCreate.path, { state: { openCreate: true } });
                    } else if (firstPage?.path) {
                      navigate(firstPage.path);
                    }
                  }}
                  placeholder="Search to create or open a module…"
                  className="keep-box ua-field w-full h-9 pl-9 pr-3 text-sm rounded-md border border-gray-300 focus:outline-none"
                />
              </div>

              {createShown.length > 0 && (
                <>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Create new</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 mb-5">
                    {createShown.map((group) => (
                      <div key={group.title} className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1.5 tracking-tight">{group.title}</h4>
                        <ul className="space-y-0.5">
                          {group.items.map((it) => (
                            <li key={it.label}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCreate(false);
                                  navigate(it.path, { state: { openCreate: true } });
                                }}
                                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
                              >
                                <it.icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="truncate">{it.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {moreGroups.length > 0 && (
                <>
                  <h3 className="mb-2 pt-4 border-t border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    More modules
                  </h3>
                  <ModuleColumns groups={moreGroups} onNavigate={() => setShowCreate(false)} />
                </>
              )}

              {createShown.length === 0 && moreGroups.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-500">Nothing matches “{createFilter}”</p>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="hidden sm:block">
          <SettingsDropdown />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications((s) => !s);
              setShowCreate(false);
              setShowApps(false);
            }}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-6 h-6 text-gray-700" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-medium">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Updates</h3>
                <div className="flex items-center gap-2">
                  {notifTab === "notifications" && unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setNotifTab("notifications")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${notifTab === "notifications" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                >
                  <Bell className="w-3.5 h-3.5" /> Notifications
                </button>
                <button
                  onClick={() => setNotifTab("announcements")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${notifTab === "announcements" ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
                >
                  <Megaphone className="w-3.5 h-3.5" /> Announcements
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifTab === "notifications"
                  ? notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, unread: false } : n)))}
                        className={`px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 ${notif.unread ? "bg-blue-50" : ""}`}
                      >
                        <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{notif.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                      </div>
                    ))
                  : announcements.map((ann) => (
                      <div
                        key={ann.id}
                        onClick={() => setAnnouncements((prev) => prev.map((a) => (a.id === ann.id ? { ...a, isNew: false } : a)))}
                        className={`px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 ${ann.isNew ? "bg-orange-50" : ""}`}
                      >
                        <p className="text-sm font-medium text-gray-900">{ann.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ann.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{ann.date}</p>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </div>

        {/* Company / account — opens the My Account modal directly */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCreate(false);
              setShowNotifications(false);
              setShowApps(false);
              setShowMyAccount(true);
            }}
            className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-gray-100 rounded-full transition-colors"
            title={companyName || "Company"}
          >
            <CompanyAvatar />
            <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      <MyAccountModal
        open={showMyAccount}
        onClose={() => setShowMyAccount(false)}
        companyName={companyName}
        companyLogoUrl={showLogo ? companyLogoUrl : ""}
        companyInitial={companyInitial}
        isOwner={isOwner}
        planBadge={planBadge}
        onLogoBroken={() => setLogoBroken(true)}
      />
    </div>
  );
};
