/**
 * File: src/pages/userManagement/UserRoles.tsx
 * Complete Roles Management page with role listing + Edit Role view
 * Click the Edit (pencil) icon on any row to open the Edit Role page.
 *
 * The Edit Role view loads its permission matrix from the backend:
 *   GET /permission/all-permissions
 * Response shape (unwrapped by the api client to the `data` array):
 *   [{ addOn, label, packageName, modules: [{ module, moduleLabel,
 *       permissions: [{ value, label, module }] }] }]
 *   - addOn.label      -> tab name
 *   - module.moduleLabel -> permission card title (with a "select all" checkbox)
 *   - permission.label -> checkbox label, permission.value -> stored value
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Edit3,
  Trash2,
  Users,
  Key,
  Filter,
  Download,
  Clock,
  ArrowLeft,
  Loader2,
  Copy,
} from "lucide-react";
import { api } from "../../lib/api/client";
import { alertApiError, alertSuccess, alertToast } from "../../utils/alert";
import Swal from "../../utils/alert";

/* ---------- Types ---------- */
/** A user belonging to a role, as returned by GET /user/all-role. */
interface RoleUser {
  _id: string;
  name: string;
  email?: string;
}

/** Shape of one entry in GET /user/all-role -> data[]. */
interface Role {
  name: string;
  label: string;
  permissions: number;
  users: RoleUser[];
  isActive?: boolean;
  testEmail?: string;
  /** False for system roles (staff/hr/vendor/customer) — those can never be renamed/deleted. */
  isCustom?: boolean;
}

const DEMO_PASSWORD = "1qazxsw2";

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

/** Shape returned by GET /user/role-permissions/:role -> data. */
interface ApiRolePermissions {
  name: string;
  label: string;
  count: number;
  permissions: string[];
}

/* ---------- Data ---------- */

/* ===================================================================== */
/*                          ROLES LIST VIEW                              */
/* ===================================================================== */
interface RolesListProps {
  onEditRole: (role: Role) => void;
  onAddRole: () => void;
}

const RolesList: React.FC<RolesListProps> = ({ onEditRole, onAddRole }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);

  const loadRoles = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<Role[]>("/user/all-role");
      setRoles(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError("Couldn't load roles. Please try again.");
      alertApiError(err, "Couldn't load roles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.get<Role[]>("/user/all-role");
        if (!active) return;
        setRoles(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) return;
        setLoadError("Couldn't load roles. Please try again.");
        alertApiError(err, "Couldn't load roles.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredRoles.length / itemsPerPage);
  const paginatedRoles = filteredRoles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handlePageChange = (page: number) => setCurrentPage(page);
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleToggleActive = async (role: Role) => {
    const next = !(role.isActive !== false);
    setTogglingRole(role.name);
    try {
      await api.patch("/permission/role-active", {
        role: role.name,
        isActive: next,
      });
      setRoles((prev) =>
        prev.map((r) =>
          r.name === role.name ? { ...r, isActive: next } : r,
        ),
      );
      alertSuccess(
        next
          ? `${role.label} activated — users can log in again.`
          : `${role.label} deactivated — users with this role cannot log in.`,
      );
    } catch (err) {
      alertApiError(err, "Couldn't update role status.");
    } finally {
      setTogglingRole(null);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.users.length > 0) return; // guarded in the UI too; defensive no-op
    const result = await Swal.fire({
      icon: "warning",
      title: `Delete "${role.label}"?`,
      html: "This role has no users assigned. This cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/permission/delete-role/${encodeURIComponent(role.name)}`);
      setRoles((prev) => prev.filter((r) => r.name !== role.name));
      alertSuccess(`"${role.label}" deleted.`);
    } catch (err) {
      alertApiError(err, "Couldn't delete this role.");
    }
  };

  const handleRenameRole = async (role: Role) => {
    if (role.users.length > 0) return; // guarded in the UI too; defensive no-op
    const result = await Swal.fire({
      title: `Rename "${role.label}"`,
      input: "text",
      inputLabel: "New role name",
      inputValue: role.name,
      showCancelButton: true,
      confirmButtonText: "Rename",
      inputValidator: (value) => (!value?.trim() ? "Role name is required" : undefined),
    });
    if (!result.isConfirmed || !result.value) return;
    const newRole = String(result.value).trim();
    if (newRole === role.name) return;
    try {
      await api.patch("/permission/rename-role", { role: role.name, newRole });
      setRoles((prev) =>
        prev.map((r) => (r.name === role.name ? { ...r, name: newRole } : r)),
      );
      alertSuccess(`Renamed to "${newRole}".`);
    } catch (err) {
      alertApiError(err, "Couldn't rename this role.");
    }
  };

  const copyTestEmail = async (email: string) => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      alertToast("Email copied — use it on the Login page to test.", "success");
    } catch {
      alertToast(email, "info");
    }
  };

  const activeCount = roles.filter((r) => r.isActive !== false).length;

  return (
    <div className="module-page-shell !p-0 overflow-hidden flex flex-col">
      <div className="dashboard-title-bar shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Manage Roles</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Same roles appear on Login. Deactivate a role to block its users from signing in.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddRole}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Add Role
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto">
        {/* Summary Cards — top */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-600 font-medium">Total Roles</div>
                <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
                <div className="text-xs text-gray-500 mt-1">{activeCount} active</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-600 font-medium">Total Permissions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {roles.reduce((sum, role) => sum + role.permissions, 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Across all roles</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Key className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-purple-600 font-medium">Total Users</div>
                <div className="text-2xl font-bold text-gray-900">
                  {roles.reduce((sum, role) => sum + role.users.length, 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Assigned to roles</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 border border-gray-300 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-orange-600 font-medium">Roles in Use</div>
                <div className="text-2xl font-bold text-gray-900">
                  {roles.filter((role) => role.users.length > 0).length}
                </div>
                <div className="text-xs text-gray-500 mt-1">With assigned users</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void loadRoles()}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Refresh
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Label
                  </th>
                
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Users
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
                        <span className="text-sm">Loading roles…</span>
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
                ) : paginatedRoles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12">
                      <div className="text-sm text-gray-500 text-center">
                        No roles found.
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRoles.map((role) => {
                    const active = role.isActive !== false;
                    const testEmail =
                      role.testEmail ||
                      role.users.find((u) => u.email)?.email ||
                      "";
                    return (
                      <tr
                        key={role.name}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Shield className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900">
                              {role.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {role.label}
                          </span>
                        </td>
                      
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            disabled={togglingRole === role.name}
                            onClick={() => void handleToggleActive(role)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                              active ? "bg-blue-600" : "bg-gray-300"
                            }`}
                            title={
                              active
                                ? "Active — click to deactivate"
                                : "Inactive — click to activate"
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                active ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <div className="mt-1 text-[10px] text-gray-500">
                            {togglingRole === role.name
                              ? "Saving…"
                              : active
                                ? "Active"
                                : "Inactive"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Key className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {role.permissions}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm text-gray-700">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              <span>{role.users.length} users</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {role.users.slice(0, 3).map((user) => (
                                <span
                                  key={user._id}
                                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                                >
                                  {user.name.length > 15
                                    ? user.name.substring(0, 12) + "..."
                                    : user.name}
                                </span>
                              ))}
                              {role.users.length > 3 && (
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                  +{role.users.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                         
                            <button
                              type="button"
                              onClick={() => onEditRole(role)}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                              title="Edit permissions"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {role.isCustom && (
                              <>
                                <button
                                  type="button"
                                  disabled={role.users.length > 0}
                                  onClick={() => void handleRenameRole(role)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                  title={
                                    role.users.length > 0
                                      ? "Reassign this role's users before renaming"
                                      : "Rename role"
                                  }
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={role.users.length > 0}
                                  onClick={() => void handleDeleteRole(role)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                  title={
                                    role.users.length > 0
                                      ? "Reassign this role's users before deleting"
                                      : "Delete role"
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredRoles.length)} of{" "}
              {filteredRoles.length} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) pageNumber = i + 1;
                else if (currentPage <= 3) pageNumber = i + 1;
                else if (currentPage >= totalPages - 2)
                  pageNumber = totalPages - 4 + i;
                else pageNumber = currentPage - 2 + i;
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
                className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

/* ===================================================================== */
/*                          EDIT ROLE VIEW                               */
/* ===================================================================== */
/** Role names a company may not create/redefine (mirrors the backend's reserved-name check). */
const RESERVED_ROLE_NAMES = new Set(["superadmin", "company"]);

interface EditRoleProps {
  /** "create" has no existing role yet — starts blank, POSTs /permission/create-role. */
  mode?: "edit" | "create";
  role: Role | null;
  onBack: () => void;
  onCancel: () => void;
  onUpdate: (updated: {
    name: string;
    label: string;
    permissions: string[];
  }) => void;
}

const EditRole: React.FC<EditRoleProps> = ({
  mode = "edit",
  role,
  onBack,
  onCancel,
  onUpdate,
}) => {
  const isCreate = mode === "create";
  const [name, setName] = useState(role?.name ?? "");
  const [label, setLabel] = useState(role?.label ?? "");
  const [featureSearch, setFeatureSearch] = useState("");

  // Permission matrix from the backend.
  const [addOns, setAddOns] = useState<ApiAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(""); // packageName

  // Selected permissions, keyed by permission.value.
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // ── Load the permission catalog (+ this role's current permissions, when editing) ──
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [catalog, rolePerms] = await Promise.all([
          api.get<ApiAddOn[]>("/permission/all-permissions/"),
          isCreate || !role
            ? Promise.resolve<ApiRolePermissions | null>(null)
            : api.get<ApiRolePermissions>(
                `/user/role-permissions/${encodeURIComponent(role.name)}`,
              ),
        ]);
        if (!active) return;
        const list = Array.isArray(catalog) ? catalog : [];
        setAddOns(list);
        setActiveTab(list[0]?.packageName ?? "");

        // Pre-check the permissions the role already has (none yet when creating).
        const granted = rolePerms?.permissions ?? [];
        setSelected(
          granted.reduce<Record<string, boolean>>((acc, value) => {
            acc[value] = true;
            return acc;
          }, {}),
        );
      } catch (err) {
        if (!active) return;
        setLoadError("Couldn't load permissions. Please try again.");
        alertApiError(err, "Couldn't load permissions.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isCreate, role]);

  const activeAddOn = addOns.find((a) => a.packageName === activeTab);

  // Filter modules/permissions by the feature search box.
  const visibleModules = useMemo(() => {
    const modules = activeAddOn?.modules ?? [];
    if (!featureSearch.trim()) return modules;
    const q = featureSearch.toLowerCase();
    return modules
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
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  // ── Selection helpers ────────────────────────────────────────────────────
  const togglePermission = (value: string) =>
    setSelected((s) => ({ ...s, [value]: !s[value] }));

  const isModuleAllSelected = (m: ApiModule) =>
    m.permissions.length > 0 && m.permissions.every((p) => selected[p.value]);

  const isModuleSomeSelected = (m: ApiModule) =>
    m.permissions.some((p) => selected[p.value]);

  const toggleModule = (m: ApiModule) => {
    const next = !isModuleAllSelected(m);
    setSelected((s) => {
      const updated = { ...s };
      m.permissions.forEach((p) => {
        updated[p.value] = next;
      });
      return updated;
    });
  };

  // ── Persist the role ─────────────────────────────────────────────────────
  // Create: POST /permission/create-role  body: { role, label, permissions }
  // Edit:   PATCH /permission/update-permission  body: { role, permissions }
  const handleUpdate = async () => {
    const permissions = Object.keys(selected).filter((k) => selected[k]);

    if (isCreate) {
      const roleName = name.trim();
      if (!roleName) {
        alertApiError(null, "Role name is required.");
        return;
      }
      if (RESERVED_ROLE_NAMES.has(roleName.toLowerCase())) {
        alertApiError(null, "This role name is reserved.");
        return;
      }
      setSaving(true);
      try {
        await api.post("/permission/create-role", {
          role: roleName,
          label: label.trim(),
          permissions,
        });
        await alertSuccess("Role created successfully.");
        onUpdate({ name: roleName, label, permissions });
      } catch (err) {
        alertApiError(err, "Couldn't create the role.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await api.patch("/permission/update-permission", {
        role: role!.name,
        permissions,
      });
      await alertSuccess("Role permissions updated successfully.");
      onUpdate({ name, label, permissions });
    } catch (err) {
      alertApiError(err, "Couldn't update role permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="module-page-shell !p-0 overflow-hidden flex flex-col">
      <div className="dashboard-title-bar shrink-0 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-gray-900">
          {isCreate ? (
            "Add Role"
          ) : (
            <>
              Edit Role: <span className="text-blue-600">{role?.label}</span>
            </>
          )}
        </h1>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto">
        {/* Form card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-6">
          {/* Name + Label */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="staff"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Label <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Staff"
              />
            </div>
          </div>

          {/* Search features */}
          <div className="mt-6 relative w-full md:w-1/3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={featureSearch}
              onChange={(e) => setFeatureSearch(e.target.value)}
              placeholder="Search features..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Loading / error / content */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading permissions…</span>
            </div>
          ) : loadError ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-6 text-center mt-6">
              {loadError}
            </div>
          ) : addOns.length === 0 ? (
            <div className="text-sm text-gray-500 py-12 text-center border border-dashed border-gray-200 rounded-lg mt-6">
              No permissions available.
            </div>
          ) : (
            <>
              {/* Tabs (one per add-on label) */}
              <div className="mt-6 border-b border-gray-200 overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                  {addOns.map((addOn) => (
                    <button
                      key={addOn.packageName}
                      onClick={() => setActiveTab(addOn.packageName)}
                      className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors -mb-px ${
                        activeTab === addOn.packageName
                          ? "border-blue-600 text-blue-600 font-medium bg-white rounded-t-lg"
                          : "border-transparent text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {addOn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Permissions
                  </h3>
                  <span className="text-xs text-gray-500">
                    {selectedCount} selected
                  </span>
                </div>

                {visibleModules.length === 0 ? (
                  <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                    No permissions match your search.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visibleModules.map((module) => {
                      const allSelected = isModuleAllSelected(module);
                      const someSelected = isModuleSomeSelected(module);
                      return (
                        <div
                          key={module.module}
                          className="border border-gray-200 rounded-lg p-4"
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

                          {/* Permission checkboxes: 3-column grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 pl-6">
                            {module.permissions.map((perm) => (
                              <label
                                key={perm.value}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!selected[perm.value]}
                                  onChange={() => togglePermission(perm.value)}
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
              </div>
            </>
          )}

          {/* Footer actions */}
          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-5 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={loading || saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreate
                ? saving
                  ? "Creating…"
                  : "Create Role"
                : saving
                  ? "Updating…"
                  : "Update"}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

/* ===================================================================== */
/*                         MAIN EXPORT (Router)                          */
/* ===================================================================== */
export const UserRoles: React.FC = () => {
  const [view, setView] = useState<"list" | "edit" | "create">("list");
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setView("edit");
  };

  const handleAddRole = () => {
    setEditingRole(null);
    setView("create");
  };

  const handleBack = () => {
    setView("list");
    setEditingRole(null);
  };

  // Called after EditRole/CreateRole has already persisted the change via the API.
  const handleUpdate = () => {
    setView("list");
    setEditingRole(null);
  };

  if (view === "edit" && editingRole) {
    return (
      <EditRole
        mode="edit"
        role={editingRole}
        onBack={handleBack}
        onCancel={handleBack}
        onUpdate={handleUpdate}
      />
    );
  }

  if (view === "create") {
    return (
      <EditRole
        mode="create"
        role={null}
        onBack={handleBack}
        onCancel={handleBack}
        onUpdate={handleUpdate}
      />
    );
  }

  return <RolesList onEditRole={handleEditRole} onAddRole={handleAddRole} />;
};
