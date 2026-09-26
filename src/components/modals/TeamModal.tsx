/**
 * File: src/components/modals/TeamModal.tsx
 * Team drawer — matches references/companies/team/*.png (Moon Invoice) in
 * the Qayd blue theme: member list (Owner / invitees with Pending + Resend +
 * pencil) and the Invite Team panel with the per-module Sharing/Access
 * matrix. Members persist in meta row `company:team`.
 */

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { showToast } from "../../utils/toast";
import { Pencil, Info } from "lucide-react";

interface ModulePerm {
  sharing: string; // All Data | My Data
  access: string; // View | Edit | No Access
}
interface Member {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Member";
  status: "Accepted" | "Pending";
  perms: Record<string, ModulePerm>;
}

const MODULES: { name: string; note?: string }[] = [
  { name: "Invoices", note: "Credit Notes, Delivery Challans, Payments Received included" },
  { name: "Sales Receipt" },
  { name: "Proforma Invoices" },
  { name: "Estimates" },
  { name: "Purchase Orders" },
  { name: "Bill", note: "Debit Notes, Payments Made included" },
  { name: "Expenses" },
  { name: "Time Logs" },
  { name: "Company", note: "Taxes, Themes, Notes, T & C" },
  { name: "Contacts" },
  { name: "Products" },
  { name: "Services" },
  { name: "Projects & Tasks" },
];

const KEY = "company:team";
const defaultPerms = (): Record<string, ModulePerm> =>
  Object.fromEntries(MODULES.map((m) => [m.name, { sharing: "All Data", access: "View" }]));

const SEED_MEMBERS: Member[] = [
  { id: "m1", name: "", email: "info@inovoic.com", role: "Owner", status: "Accepted", perms: {} },
  { id: "m2", name: "sayed", email: "sayed@oryzn.com", role: "Member", status: "Pending", perms: defaultPerms() },
  { id: "m3", name: "bipul", email: "info@syedbipul.me", role: "Member", status: "Accepted", perms: defaultPerms() },
];

export const TeamModal: React.FC<{ onClose: () => void; companyEmail?: string }> = ({ onClose }) => {
  const members = useLiveQuery(async () => {
    const row = await db.meta.get(KEY);
    return (row?.value as Member[]) || null;
  }, []);
  useEffect(() => {
    if (members === null) db.meta.put({ key: KEY, value: SEED_MEMBERS });
  }, [members]);
  const save = (list: Member[]) => db.meta.put({ key: KEY, value: list });

  const [invite, setInvite] = useState<Member | null>(null); // member being created/edited
  const [isNew, setIsNew] = useState(true);

  const list = members || [];

  const openInvite = () => {
    setInvite({ id: "", name: "", email: "", role: "Member", status: "Pending", perms: defaultPerms() });
    setIsNew(true);
  };

  const submitInvite = async () => {
    if (!invite) return;
    if (!invite.email.trim() || !/\S+@\S+\.\S+/.test(invite.email)) {
      showToast("Enter a valid email address", "error");
      return;
    }
    if (isNew) {
      await save([...list, { ...invite, id: "m" + Math.random().toString(36).slice(2, 8) }]);
      showToast("Invitation sent", "success");
    } else {
      await save(list.map((m) => (m.id === invite.id ? invite : m)));
      showToast("Team member updated", "success");
    }
    setInvite(null);
  };

  const setPerm = (mod: string, patch: Partial<ModulePerm>) => {
    if (!invite) return;
    setInvite({ ...invite, perms: { ...invite.perms, [mod]: { ...invite.perms[mod], ...patch } } });
  };
  const setAllPerms = (patch: Partial<ModulePerm>) => {
    if (!invite) return;
    setInvite({
      ...invite,
      perms: Object.fromEntries(MODULES.map((m) => [m.name, { ...invite.perms[m.name], ...patch }])),
    });
  };

  /* ── invite panel ── */
  if (invite) {
    const selCls = "text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white";
    return (
      <Shell>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{isNew ? "Invite Team" : "Edit Team Member"}</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setInvite(null)} className="text-sm text-gray-600 hover:text-gray-900">Close</button>
            <button onClick={submitInvite} className="px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              {isNew ? "Invite" : "Save"}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email <span className="text-red-500">*</span></label>
              <input value={invite.email} readOnly={!isNew} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${!isNew ? "bg-gray-50 text-gray-500" : ""}`} />
            </div>
          </div>

          {/* modules header with global selects */}
          <div className="px-6 py-3 border-y border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Modules</span>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 uppercase">Sharing</label>
              <select onChange={(e) => setAllPerms({ sharing: e.target.value })} className={selCls} defaultValue="All Data">
                <option>All Data</option>
                <option>My Data</option>
              </select>
              <label className="text-[10px] text-gray-400 uppercase">Access</label>
              <select onChange={(e) => setAllPerms({ access: e.target.value })} className={selCls} defaultValue="View">
                <option>View</option>
                <option>Edit</option>
                <option>No Access</option>
              </select>
            </div>
          </div>

          {/* per-module rows */}
          <div className="divide-y divide-gray-100">
            {MODULES.map((m) => (
              <div key={m.name} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  {m.note && <p className="text-xs text-gray-400">{m.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Sharing</label>
                    <select value={invite.perms[m.name]?.sharing || "All Data"} onChange={(e) => setPerm(m.name, { sharing: e.target.value })} className={selCls}>
                      <option>All Data</option>
                      <option>My Data</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Access</label>
                    <select value={invite.perms[m.name]?.access || "View"} onChange={(e) => setPerm(m.name, { access: e.target.value })} className={selCls}>
                      <option>View</option>
                      <option>Edit</option>
                      <option>No Access</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  /* ── member list ── */
  return (
    <Shell>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Team</h2>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">Close</button>
          <button onClick={openInvite} className="px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {list.map((m) => (
          <div key={m.id} className="px-6 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{m.email}</p>
              <p className="text-sm text-gray-500 mt-0.5">{m.role === "Owner" ? "Owner" : "All"}</p>
            </div>
            {m.role !== "Owner" && (
              <div className="flex items-center gap-3 shrink-0">
                {m.status === "Pending" && (
                  <>
                    <span className="text-sm font-medium text-orange-500">Pending</span>
                    <button
                      onClick={() => showToast(`Invitation resent to ${m.email}`, "success")}
                      className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                    >
                      Resend
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setInvite({ ...m, perms: { ...defaultPerms(), ...m.perms } });
                    setIsNew(false);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                  title="Edit member"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="px-6 py-12 text-center text-sm text-gray-400">No team members.</div>}
      </div>
    </Shell>
  );
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "85vh", minHeight: "420px" }}>
        {children}
      </div>
    </div>
  );
}
