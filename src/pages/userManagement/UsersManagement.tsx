/**
 * File: src/pages/UsersManagement.tsx
 * Complete Users Management page with user listing and edit user modal.
 *
 * The Edit User modal loads its permission matrix from the backend:
 *   GET /permission/all-permissions
 * Response shape (unwrapped by the api client to the `data` array):
 *   [{ addOn, label, packageName, modules: [{ module, moduleLabel,
 *       permissions: [{ value, label, module }] }] }]
 *   - addOn.label        -> tab name
 *   - module.moduleLabel -> permission card title (with a "select all" checkbox)
 *   - permission.label   -> checkbox label, permission.value -> stored value
 *
 * The user's currently-granted permissions are pre-checked, and saving issues:
 *   PATCH /permission/update-user-permission  body: { userId, permissions: string[] }
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Filter,
  Download,
  Plus,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  XCircle,
  X,
  UserCheck,
} from "lucide-react";
import { api } from "../../lib/api/client";
import { alertApiError } from "../../utils/alert";
import { fetchPaginatedList, FALLBACK_LIST_PAGINATION } from "@/services/paginatedList";
import type { TPartyPagination } from "@/services/customerTypes";

// User type definition (UI-facing, mapped from the API)
interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  loginStatus: "Enabled" | "Disabled";
  avatar: string;
  /** Flat list of permission keys currently granted to this user. */
  permissions: string[];
}

/** Shape of one entry in GET /user/all-user-for-company -> data[]. */
interface ApiUser {
  _id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  companyId?: string;
  login?: boolean;
  image?: string;
  permissions?: string[];
}

/** Shape returned by GET /permission/all-permissions (one entry per add-on). */
interface ApiPermission {
  value: string;
  label: string;
  module: string;
}
interface ApiModule {
  module: string;
  moduleLabel: string;
  permissions: ApiPermission[];
}
interface ApiAddOn {
  addOn: string;
  label: string;
  packageName: string;
  modules: ApiModule[];
}

/** Filters sent as query params to /user/all-user-for-company. */
interface UserFilters {
  email?: string;
  role?: string;
  login?: boolean;
  searchTerm?: string;
  page?: number;
  limit?: number;
}

/** Build initials from a name, e.g. "Staff Company" -> "SC". */
const initialsFromName = (name?: string | null): string =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

/** Map a raw API user to the UI User model. */
const mapApiUser = (u: ApiUser): User => ({
  id: String(u?._id ?? ""),
  name: String(u?.name ?? ""),
  email: String(u?.email ?? ""),
  mobile: u?.phone ? String(u.phone) : "—",
  role: u?.role ? String(u.role).charAt(0).toUpperCase() + String(u.role).slice(1) : "",
  loginStatus: u?.login ? "Enabled" : "Disabled",
  avatar: initialsFromName(u?.name),
  permissions: Array.isArray(u?.permissions) ? u.permissions : [],
});

/** UI role label -> API role value. (UI shows "Client" for the "customer" role.) */
const roleFilterToApi: Record<string, string | undefined> = {
  All: undefined,
  Staff: "staff",
  Client: "customer",
  Vendor: "vendor",
  Hr: "hr",
};

export const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<TPartyPagination>(FALLBACK_LIST_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  // Filter inputs sent to the API as ?email=&role=&login=
  const [emailFilter, setEmailFilter] = useState("");
  const [loginFilter, setLoginFilter] = useState<"All" | "Enabled" | "Disabled">(
    "All",
  );

  // Debounce search → server searchTerm (only reset page when term changes)
  useEffect(() => {
    const t = setTimeout(() => {
      const next = String(searchInput || "").trim();
      setSearchTerm((prev) => {
        if (prev !== next) setCurrentPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Load users from the backend (server-side page / limit / filters) ─────
  const loadUsers = useCallback(async (filters: UserFilters = {}) => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 10;
      const { rows, pagination: meta } = await fetchPaginatedList<ApiUser>(
        "/user/all-user-for-company",
        {
          page,
          limit,
          searchTerm: filters.searchTerm,
          role: filters.role,
          email: filters.email,
          login: filters.login,
        },
      );
      const list = Array.isArray(rows) ? rows : [];
      setUsers(list.map(mapApiUser));
      setPagination(meta ?? FALLBACK_LIST_PAGINATION);
    } catch (err) {
      setLoadError("Couldn't load users. Please try again.");
      alertApiError(err, "Couldn't load users.");
      setUsers([]);
      setPagination(FALLBACK_LIST_PAGINATION);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever page, page size, search, role, or login filter change.
  // Email filter is applied via Apply / Enter (see applyFilters).
  useEffect(() => {
    void loadUsers({
      page: currentPage,
      limit: itemsPerPage,
      searchTerm: searchTerm || undefined,
      role: roleFilterToApi[roleFilter],
      email: String(emailFilter || "").trim() || undefined,
      login: loginFilter === "All" ? undefined : loginFilter === "Enabled",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- email applied via Apply button
  }, [
    loadUsers,
    currentPage,
    itemsPerPage,
    searchTerm,
    roleFilter,
    loginFilter,
  ]);

  // Role buttons update filter state; useEffect reloads.
  const handleRoleFilter = (uiRole: string) => {
    setRoleFilter(uiRole);
    setCurrentPage(1);
  };

  // Apply email / login filters from the filter panel.
  const applyFilters = () => {
    setCurrentPage(1);
    void loadUsers({
      page: 1,
      limit: itemsPerPage,
      searchTerm: searchTerm || undefined,
      role: roleFilterToApi[roleFilter],
      email: String(emailFilter || "").trim() || undefined,
      login: loginFilter === "All" ? undefined : loginFilter === "Enabled",
    });
  };

  // Reset every filter and reload the full list.
  const resetFilters = () => {
    setRoleFilter("All");
    setEmailFilter("");
    setLoginFilter("All");
    setSearchInput("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ── Permission catalog (GET /permission/all-permissions) ─────────────────
  const [permCatalog, setPermCatalog] = useState<ApiAddOn[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(""); // packageName
  const [featureSearch, setFeatureSearch] = useState("");
  const [savingPerms, setSavingPerms] = useState(false);
  // Selected permissions for the user being edited, keyed by permission.value.
  const [selectedPerms, setSelectedPerms] = useState<Record<string, boolean>>(
    {},
  );

  // ── Create user form ─────────────────────────────────────────────────────
  // Posted to POST /user/create-user-by-company as { name, email, password, role }.
  const emptyCreateForm = {
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    role: "",
    loginStatus: "Enabled" as "Enabled" | "Disabled",
  };
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form data for edit
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "Staff",
    loginStatus: "Enabled" as "Enabled" | "Disabled",
  });

  const totalPages = Math.max(1, pagination.totalPage || 1);
  const totalData = pagination.totalData ?? users.length;

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.min(Math.max(1, page), totalPages));
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const reloadCurrentList = () =>
    loadUsers({
      page: currentPage,
      limit: itemsPerPage,
      searchTerm: searchTerm || undefined,
      role: roleFilterToApi[roleFilter],
      email: String(emailFilter || "").trim() || undefined,
      login: loginFilter === "All" ? undefined : loginFilter === "Enabled",
    });

  // ── Permission catalog helpers ───────────────────────────────────────────
  // Load the catalog once; cached in state so re-opening the modal is instant.
  const loadPermCatalog = useCallback(async () => {
    if (permCatalog.length > 0) return permCatalog;
    setPermLoading(true);
    setPermError(null);
    try {
      const catalog = await api.get<ApiAddOn[]>("/permission/all-permissions/");
      const list = Array.isArray(catalog) ? catalog : [];
      setPermCatalog(list);
      setActiveTab((prev) => prev || list[0]?.packageName || "");
      return list;
    } catch (err) {
      setPermError("Couldn't load permissions. Please try again.");
      alertApiError(err, "Couldn't load permissions.");
      return [];
    } finally {
      setPermLoading(false);
    }
  }, [permCatalog]);

  const activeAddOn = permCatalog.find((a) => a.packageName === activeTab);

  // Filter the active add-on's modules/permissions by the feature search box.
  const visibleModules = useMemo(() => {
    const mods = activeAddOn?.modules ?? [];
    if (!featureSearch.trim()) return mods;
    const q = featureSearch.toLowerCase();
    return mods
      .map((m) => {
        const moduleMatches = m.moduleLabel.toLowerCase().includes(q);
        const matchingPerms = m.permissions.filter((p) =>
          p.label.toLowerCase().includes(q),
        );
        if (moduleMatches) return m;
        if (matchingPerms.length > 0)
          return { ...m, permissions: matchingPerms };
        return null;
      })
      .filter(Boolean) as ApiModule[];
  }, [activeAddOn, featureSearch]);

  const selectedCount = useMemo(
    () => Object.values(selectedPerms).filter(Boolean).length,
    [selectedPerms],
  );

  // Toggle a single permission by its value.
  const togglePermission = (value: string) =>
    setSelectedPerms((s) => ({ ...s, [value]: !s[value] }));

  const isModuleAllSelected = (m: ApiModule) =>
    m.permissions.length > 0 &&
    m.permissions.every((p) => selectedPerms[p.value]);

  const isModuleSomeSelected = (m: ApiModule) =>
    m.permissions.some((p) => selectedPerms[p.value]);

  // Toggle every permission in a module on/off.
  const toggleModule = (m: ApiModule) => {
    const next = !isModuleAllSelected(m);
    setSelectedPerms((s) => {
      const updated = { ...s };
      m.permissions.forEach((p) => {
        updated[p.value] = next;
      });
      return updated;
    });
  };

  // Show toast notification
  const showToast = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  // UI role label -> API role value, for the Create User form.
  const roleLabelToApi: Record<string, string> = {
    Staff: "staff",
    Client: "customer",
    Vendor: "vendor",
    Hr: "hr",
  };

  // Open / reset the Create User modal.
  const openCreateModal = () => {
    setCreateForm(emptyCreateForm);
    setCreateError(null);
    setShowCreateModal(true);
  };

  // Create a new user under the current company.
  // POST /user/create-user-by-company  body: { name, email, password, role }
  const handleCreateUser = async () => {
    const name = createForm.name.trim();
    const email = createForm.email.trim();
    const { password, confirmPassword, role } = createForm;

    if (!name || !email || !password || !role) {
      setCreateError("Name, email, password and role are required.");
      return;
    }
    if (password !== confirmPassword) {
      setCreateError("Passwords do not match.");
      return;
    }

    setCreateError(null);
    setCreating(true);
    try {
      await api.post("/user/create-user-by-company", {
        name,
        email,
        password,
        role: roleLabelToApi[role] ?? role,
      });
      setShowCreateModal(false);
      setCreateForm(emptyCreateForm);
      await reloadCurrentList();
      showToast("User created successfully!");
    } catch (err) {
      alertApiError(err, "Couldn't create user.");
    } finally {
      setCreating(false);
    }
  };

  // Edit User — persist the selected permissions for this user.
  // PATCH /permission/update-user-permission  body: { userId, permissions: string[] }
  const handleEditUser = async () => {
    if (!selectedUser) return;
    const permissions = Object.keys(selectedPerms).filter(
      (k) => selectedPerms[k],
    );
    setSavingPerms(true);
    try {
      await api.patch("/permission/update-user-permission", {
        userId: selectedUser.id,
        permissions,
      });
      // Reflect the changes locally so the list stays in sync.
      setUsers((prev) =>
        prev.map((user) =>
          user.id === selectedUser.id
            ? {
                ...user,
                name: formData.name,
                email: formData.email,
                mobile: formData.mobile,
                role: formData.role,
                loginStatus: formData.loginStatus,
                permissions,
                avatar: initialsFromName(formData.name),
              }
            : user,
        ),
      );
      setShowEditModal(false);
      setSelectedUser(null);
      setFormData({
        name: "",
        email: "",
        mobile: "",
        role: "Staff",
        loginStatus: "Enabled",
      });
      showToast("User permissions updated successfully!");
    } catch (err) {
      alertApiError(err, "Couldn't update user permissions.");
    } finally {
      setSavingPerms(false);
    }
  };

  // Delete User
  // DELETE /user/delete/:id
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    try {
      await api.delete(`/user/delete/${selectedUser.id}`);
      setShowDeleteModal(false);
      setSelectedUser(null);
      await reloadCurrentList();
      showToast("User deleted successfully!");
    } catch (err) {
      alertApiError(err, "Couldn't delete user.");
    } finally {
      setDeleting(false);
    }
  };

  // Open Edit Modal — pre-check the user's current permissions, then load the
  // permission catalog (cached after the first open).
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      loginStatus: user.loginStatus,
    });
    setSelectedPerms(
      user.permissions.reduce<Record<string, boolean>>((acc, value) => {
        acc[value] = true;
        return acc;
      }, {}),
    );
    setFeatureSearch("");
    setShowEditModal(true);
    void loadPermCatalog();
  };

  // Open Delete Modal
  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  // Open View Modal
  const openViewModal = (user: User) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "vendor":
        return "bg-purple-100 text-purple-700";
      case "hr":
        return "bg-blue-100 text-blue-700";
      case "client":
      case "customer":
        return "bg-green-100 text-green-700";
      case "staff":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "Enabled") {
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    }
    return <XCircle className="w-3 h-3 text-red-600" />;
  };

  const getStatusColor = (status: string) => {
    return status === "Enabled"
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";
  };

  return (
    <div className="module-page-shell !p-0 overflow-hidden flex flex-col">
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </div>
        </div>
      )}

      <div className="dashboard-title-bar shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Manage Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage system users, roles, and access permissions
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto">
        {/* User Summary Stats — top */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-600 font-medium">Total Users</div>
                <div className="text-2xl font-bold text-gray-900">{totalData}</div>
                <div className="text-xs text-gray-500 mt-1">All accounts</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-600 font-medium">Active Users</div>
                <div className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => u.loginStatus === "Enabled").length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Login enabled</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-purple-600 font-medium">Roles</div>
                <div className="text-2xl font-bold text-gray-900">
                  {new Set(users.map((u) => u.role)).size}
                </div>
                <div className="text-xs text-gray-500 mt-1">Different roles</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-orange-600 font-medium">Disabled</div>
                <div className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => u.loginStatus === "Disabled").length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Login disabled</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              {/* Role */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-sm text-gray-600 w-20 shrink-0">Role:</span>
                <div className="flex gap-2 flex-wrap">
                  {["All", "Staff", "Client", "Vendor", "Hr"].map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleFilter(role)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        roleFilter === role
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Email + Login status */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={emailFilter}
                      onChange={(e) => setEmailFilter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFilters();
                      }}
                      placeholder="Filter by email..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="sm:w-44">
                  <label className="block text-sm text-gray-600 mb-1">
                    Login Status
                  </label>
                  <select
                    value={loginFilter}
                    onChange={(e) => {
                      setLoginFilter(e.target.value as typeof loginFilter);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All</option>
                    <option value="Enabled">Enabled</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyFilters()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Avatar
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mobile No
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Login Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16">
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading users…</span>
                      </div>
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <div className="text-sm text-red-600 text-center">
                        {loadError}
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <div className="text-sm text-gray-500 text-center">
                        No users found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                        {user.avatar}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {user.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {user.mobile}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(
                          user.role,
                        )}`}
                      >
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          user.loginStatus,
                        )}`}
                      >
                        {getStatusIcon(user.loginStatus)}
                        {user.loginStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openViewModal(user)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View User"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
                className="px-2 py-1 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-sm text-gray-500">per page</span>
            </div>

            <div className="text-sm text-gray-500">
              Showing{" "}
              {totalData === 0
                ? 0
                : (currentPage - 1) * itemsPerPage + 1}{" "}
              to {Math.min(currentPage * itemsPerPage, totalData)} of{" "}
              {totalData} results
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNumber}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentPage === pageNumber
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Create User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {createError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={createForm.mobile}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, mobile: e.target.value })
                  }
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Format: +[country code][phone number]
                </p>
              </div>

              {/* Password + Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, password: e.target.value })
                    }
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={createForm.confirmPassword}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Confirm password"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Role + Login Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="" disabled>
                      Select role
                    </option>
                    <option value="Staff">Staff</option>
                    <option value="Client">Client</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Hr">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Login Status
                  </label>
                  <select
                    value={createForm.loginStatus}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        loginStatus: e.target.value as "Enabled" | "Disabled",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="Enabled">Enabled</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={creating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal with Permissions - Transparent Background */}
      {showEditModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit User: {selectedUser.name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Update user information and access permissions
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - User Info */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      User Information
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mobile Number
                        </label>
                        <input
                          type="text"
                          value={formData.mobile}
                          onChange={(e) =>
                            setFormData({ ...formData, mobile: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          value={formData.role}
                          onChange={(e) =>
                            setFormData({ ...formData, role: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Staff">Staff</option>
                          <option value="Client">Client</option>
                          <option value="Vendor">Vendor</option>
                          <option value="Hr">HR</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Login Status
                        </label>
                        <select
                          value={formData.loginStatus}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              loginStatus: e.target.value as
                                | "Enabled"
                                | "Disabled",
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="Enabled">Enabled</option>
                          <option value="Disabled">Disabled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Permissions with Tabs (loaded from the API) */}
                <div className="lg:col-span-2">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900">
                        Access Permissions
                      </h3>
                      <div className="text-sm text-gray-500">
                        {selectedCount} permissions granted
                      </div>
                    </div>

                    {/* Search features */}
                    <div className="relative mb-4">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={featureSearch}
                        onChange={(e) => setFeatureSearch(e.target.value)}
                        placeholder="Search features..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {permLoading ? (
                      <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading permissions…</span>
                      </div>
                    ) : permError ? (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-6 text-center">
                        {permError}
                      </div>
                    ) : permCatalog.length === 0 ? (
                      <div className="text-sm text-gray-500 py-12 text-center border border-dashed border-gray-200 rounded-lg">
                        No permissions available.
                      </div>
                    ) : (
                      <>
                        {/* Add-on Tabs */}
                        <div className="border-b border-gray-200 overflow-x-auto mb-4">
                          <div className="flex gap-1 min-w-max">
                            {permCatalog.map((addOn) => (
                              <button
                                key={addOn.packageName}
                                onClick={() => setActiveTab(addOn.packageName)}
                                className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors -mb-px ${
                                  activeTab === addOn.packageName
                                    ? "border-blue-600 text-blue-600 font-medium"
                                    : "border-transparent text-gray-600 hover:text-gray-900"
                                }`}
                              >
                                {addOn.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Modules + permissions for the active add-on */}
                        {visibleModules.length === 0 ? (
                          <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                            No permissions match your search.
                          </div>
                        ) : (
                          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                            {visibleModules.map((module) => {
                              const allSelected = isModuleAllSelected(module);
                              const someSelected =
                                isModuleSomeSelected(module);
                              return (
                                <div
                                  key={module.module}
                                  className="bg-white border border-gray-200 rounded-lg p-4"
                                >
                                  {/* Module header (select-all checkbox) */}
                                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input
                                      type="checkbox"
                                      ref={(el) => {
                                        if (el)
                                          el.indeterminate =
                                            someSelected && !allSelected;
                                      }}
                                      checked={allSelected}
                                      onChange={() => toggleModule(module)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-900">
                                      {module.moduleLabel}
                                    </span>
                                  </label>

                                  {/* Permission checkboxes */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 pl-6">
                                    {module.permissions.map((perm) => (
                                      <label
                                        key={perm.value}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!selectedPerms[perm.value]}
                                          onChange={() =>
                                            togglePermission(perm.value)
                                          }
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">
                                          {perm.label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={savingPerms}
                className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                disabled={permLoading || savingPerms}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPerms ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Edit className="w-4 h-4" />
                )}
                {savingPerms ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
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
                Delete User
              </h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{selectedUser.name}</span>? This
                action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {showViewModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                User Details
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-medium">
                  {selectedUser.avatar}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedUser.name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedUser.role}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-900">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Mobile Number</p>
                    <p className="text-sm text-gray-900">
                      {selectedUser.mobile}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Role</p>
                    <p className="text-sm text-gray-900">{selectedUser.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedUser.loginStatus)}
                  <div>
                    <p className="text-xs text-gray-500">Login Status</p>
                    <p className="text-sm text-gray-900">
                      {selectedUser.loginStatus}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(selectedUser);
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit User
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
