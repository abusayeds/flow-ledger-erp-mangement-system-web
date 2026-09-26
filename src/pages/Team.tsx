/**
 * File: src/pages/Team.tsx
 * Team page - Complete with Invite Team modal and permissions
 * Based on Figma screenshot
 */

import React, { useState } from "react";
import {
  Plus,
  X,
  Users,
  Mail,
  MoreVertical,
  Edit2,
  Trash2,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending" | "inactive";
}

interface ModulePermission {
  id: string;
  name: string;
  sharing: "Sharing" | "View Only" | "Edit";
  access: "Access" | "Full Access" | "Limited";
}

const modulePermissions: ModulePermission[] = [
  { id: "modules", name: "Modules", sharing: "Sharing", access: "Access" },
  { id: "invoices", name: "Invoices", sharing: "Sharing", access: "Access" },
  {
    id: "sales-receipt",
    name: "Sales Receipt",
    sharing: "Sharing",
    access: "Access",
  },
  { id: "estimates", name: "Estimates", sharing: "Sharing", access: "Access" },
  {
    id: "purchase-order",
    name: "Purchase Order",
    sharing: "Sharing",
    access: "Access",
  },
  { id: "bills", name: "Bills", sharing: "Sharing", access: "Access" },
  { id: "expenses", name: "Expenses", sharing: "Sharing", access: "Access" },
  { id: "time-logs", name: "Time logs", sharing: "Sharing", access: "Access" },
  { id: "company", name: "Company", sharing: "Sharing", access: "Access" },
  { id: "contacts", name: "Contacts", sharing: "Sharing", access: "Access" },
  { id: "products", name: "Products", sharing: "Sharing", access: "Access" },
  { id: "services", name: "Services", sharing: "Sharing", access: "Access" },
  {
    id: "projects-task",
    name: "Projects & Task",
    sharing: "Sharing",
    access: "Access",
  },
];

const additionalPermissions = [
  { id: "dashboard", label: "Dashboard", checked: true },
  { id: "reports", label: "Reports", checked: true },
  { id: "import", label: "Import", checked: true },
  { id: "export", label: "Export", checked: true },
  { id: "times", label: "Times", checked: true },
  { id: "settings", label: "Settings", checked: true },
  { id: "e-invoicing", label: "E- Invoicing", checked: false },
  { id: "e-way-bill", label: "E- Way Bill", checked: false },
];

export const Team: React.FC = () => {
  const [isEmpty, setIsEmpty] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [inviteFormData, setInviteFormData] = useState({
    name: "",
    email: "",
  });

  const [permissions, setPermissions] = useState(modulePermissions);
  const [additionalPerms, setAdditionalPerms] = useState(additionalPermissions);

  const handleInviteTeam = () => {
    setShowInviteModal(true);
  };

  const handleSendInvite = () => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteFormData.name,
      email: inviteFormData.email,
      role: "Member",
      status: "pending",
    };

    setTeamMembers([...teamMembers, newMember]);
    setIsEmpty(false);
    setShowInviteModal(false);
    setInviteFormData({ name: "", email: "" });
  };

  const handlePermissionChange = (
    id: string,
    field: "sharing" | "access",
    value: string,
  ) => {
    setPermissions((prev) =>
      prev.map((perm) => (perm.id === id ? { ...perm, [field]: value } : perm)),
    );
  };

  const handleAdditionalPermChange = (id: string) => {
    setAdditionalPerms((prev) =>
      prev.map((perm) =>
        perm.id === id ? { ...perm, checked: !perm.checked } : perm,
      ),
    );
  };

  // EMPTY STATE
  if (isEmpty && !showInviteModal) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FAFBFC]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-6">
            <Users className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-blue-600 mb-2">
            Invite Your Team
          </h3>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            Collaborate with your team by inviting members.
            <br />
            Set permissions and manage access easily.
          </p>
          <button
            onClick={handleInviteTeam}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium"
          >
            <Plus className="w-5 h-5" />
            Invite Team
          </button>
        </div>
      </div>
    );
  }

  // MAIN CONTENT
  return (
    <div className="flex-1 flex flex-col bg-[#FAFBFC] overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Team</h1>
          <button
            onClick={handleInviteTeam}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            <Plus className="w-5 h-5" />
            Invite Team
          </button>
        </div>
      </div>

      {/* Team Members List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="overflow-x-auto">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden min-w-[500px]">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {member.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {member.role}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          member.status === "active"
                            ? "bg-green-100 text-green-700"
                            : member.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded">
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invite Team Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Invite Team
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
                <button
                  onClick={handleSendInvite}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Invite
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Form Fields */}
              <div className="space-y-4 mb-6">
                <div>
                  <input
                    type="text"
                    placeholder="Enter your Name"
                    value={inviteFormData.name}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-gray-400"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Enter your Email"
                    value={inviteFormData.email}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Permissions Table */}
              <div className="overflow-x-auto mb-6">
                <div className="border border-gray-200 rounded-lg overflow-hidden min-w-[400px]">
                  <table className="w-full">
                    <tbody>
                      {permissions.map((perm) => (
                        <tr
                          key={perm.id}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 w-1/3">
                            {perm.name}
                          </td>
                          <td className="px-4 py-3 w-1/3">
                            <select
                              value={perm.sharing}
                              onChange={(e) =>
                                handlePermissionChange(
                                  perm.id,
                                  "sharing",
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option>Sharing</option>
                              <option>View Only</option>
                              <option>Edit</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 w-1/3">
                            <select
                              value={perm.access}
                              onChange={(e) =>
                                handlePermissionChange(
                                  perm.id,
                                  "access",
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option>Access</option>
                              <option>Full Access</option>
                              <option>Limited</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Permissions - 4 Columns */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {additionalPerms.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={perm.checked}
                      onChange={() => handleAdditionalPermChange(perm.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="text-sm text-gray-700">{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
