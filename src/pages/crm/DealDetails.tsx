/**
 * File: src/pages/crm/DealDetails.tsx
 * CRM Deal detail — reached from the eye icon on the Deals list (/crm/deals/:id).
 * Rebuilt from the ERPGO reference in the Qayd light/blue theme. Mirrors
 * LeadDetail (vertical tab rail + stat cards + info card + Notes + Emails/
 * Discussions) but adds Price/Creator, an editable Status dropdown in the
 * info header, and a Clients tab. Sub-data persists per-deal in the Dexie
 * `meta` table under `crm:deal:<id>` via src/lib/db/leadDetail.ts.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { showToast } from "../../utils/toast";
import { toArray } from "@/services/_http";
import { fetchCrmUsers, fetchCrmSources } from "@/services/crmApi";
import type { Deal } from "./Deals";
import {
  useDealDetail,
  saveDealDetail,
  syncDealDetail,
  leadDetailFromApi,
  type LeadDetailData,
  type LeadTask,
  type LeadCall,
  type LeadEmail,
  type LeadDiscussion,
  type LeadNamed,
  type LeadActivity,
} from "../../lib/db/leadDetail";
import {
  RichEditor,
  AddPicker,
  uid,
  nowStamp,
  type PickerOption,
} from "./crmDetailShared";
import {
  ArrowLeft,
  DollarSign,
  Phone,
  Calendar,
  GitBranch,
  Layers,
  Package,
  Database,
  CheckSquare,
  User,
  Users,
  FileText,
  PhoneCall,
  Activity as ActivityIcon,
  Plus,
  Trash2,
  Pencil,
  X,
  Mail,
  Clock,
} from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const activityIcon = (kind: LeadActivity["kind"]) => {
  switch (kind) {
    case "email":
      return Mail;
    case "call":
      return PhoneCall;
    default:
      return ActivityIcon;
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "Won":
      return "bg-green-100 text-green-700";
    case "Loss":
    case "Lost":
      return "bg-red-100 text-red-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
};

export const DealDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Fetch the real deal from the backend.
  const [deal, setDeal] = useState<Deal | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    api.raw.get(`/crm/deals/${id}`).then((res) => {
      const d = (res.data?.data ?? res.data) as any;
      if (!d || !d._id) return;
      const nm = (v: any) => (v && typeof v === "object" ? v.name ?? "" : "");
      const idOf = (v: any) => (v && typeof v === "object" ? String(v._id) : String(v || ""));
      setDeal({
        id: String(d._id),
        name: d.name ?? "",
        price: Number(d.price) || 0,
        tasks: { completed: (d.tasks ?? []).filter((t: any) => t.status === "completed" || t.completed).length, total: (d.tasks ?? []).length },
        clients: (d.clients ?? []).map((c: any) => c?.name ?? c).filter(Boolean),
        clientIds: (d.clients ?? []).map((c: any) => idOf(c)).filter(Boolean),
        stage: nm(d.stage_id),
        stageId: idOf(d.stage_id),
        status: d.status === "Won" ? "Won" : d.status === "Lost" ? "Lost" : "Active",
        phone: d.phone ?? "",
        pipeline: nm(d.pipeline_id),
        pipelineId: idOf(d.pipeline_id),
        sources: (d.sources ?? []).map((s: any) => s?.name ?? s).filter(Boolean),
        sourceIds: (d.sources ?? []).map((s: any) => idOf(s)).filter(Boolean),
        products: (d.products ?? []).map((p: any) => p?.productName ?? p?.name ?? p).filter(Boolean),
        notes: d.notes ?? "",
        createdAt: d.createdAt ?? "",
      });
      // Seed the local detail from the REAL, company-scoped deal document.
      saveDealDetail(id, leadDetailFromApi(d));
    }).catch(() => {});
  }, [id]);
  const seed = useMemo(
    () =>
      leadDetailFromApi({
        clients: (deal?.clients ?? []).map((n) => ({ name: n })),
        sources: (deal?.sources ?? []).map((n) => ({ name: n })),
        products: (deal?.products ?? []).map((n) => ({ name: n })),
        status: deal?.status,
      }),
    [deal],
  );

  const stored = useDealDetail(id);
  const data: LeadDetailData = stored ?? seed;

  useEffect(() => {
    if (id && stored === null) saveDealDetail(id, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stored]);

  const commit = (next: LeadDetailData) => {
    if (id) {
      saveDealDetail(id, next); // optimistic local update
      void syncDealDetail(id, data, next); // push to backend, then mirror server truth
    }
  };
  const logActivity = (
    base: LeadDetailData,
    kind: LeadActivity["kind"],
    label: string,
  ): LeadActivity[] => [
    { id: uid(), kind, label, date: nowStamp() },
    ...base.activity,
  ];

  const [userOptions, setUserOptions] = useState<PickerOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<PickerOption[]>([]);
  const [productOptions, setProductOptions] = useState<PickerOption[]>([]);
  const [clientOptions, setClientOptions] = useState<PickerOption[]>([]);
  useEffect(() => {
    void fetchCrmUsers().then((rows) => {
      const opts = rows.map((u) => ({ id: u._id, name: u.name }));
      setUserOptions(opts);
      setClientOptions(opts);
    });
    void fetchCrmSources().then((rows) =>
      setSourceOptions(rows.map((s) => ({ id: s._id, name: s.name }))),
    );
    void api.raw
      .get("/product/all", { params: { page: 1, limit: 200 } })
      .then((res) => {
        const rows = toArray<any>(res.data);
        setProductOptions(
          rows
            .map((p) => ({
              id: String(p._id),
              name: String(p.productName ?? p.name ?? ""),
            }))
            .filter((p) => p.id && p.name),
        );
      })
      .catch(() => {});
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const files = data.files ?? [];

  const [activeTab, setActiveTab] = useState("General");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (stored) setNotes(stored.notes || "");
  }, [stored]);

  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);
  const [taskForm, setTaskForm] = useState<Omit<LeadTask, "id">>({
    name: "",
    date: "",
    time: "",
    priority: "Low",
    status: "On Going",
  });
  const [callModal, setCallModal] = useState(false);
  const [editingCall, setEditingCall] = useState<LeadCall | null>(null);
  const [callForm, setCallForm] = useState<Omit<LeadCall, "id">>({
    subject: "",
    callType: "Outbound",
    duration: "",
    assignee: "",
    description: "",
    result: "",
  });
  const [emailModal, setEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", description: "" });
  const [discussionModal, setDiscussionModal] = useState(false);
  const [discussionMsg, setDiscussionMsg] = useState("");
  const [pickerModal, setPickerModal] = useState<
    null | "users" | "products" | "sources" | "clients"
  >(null);

  const tabs = [
    { id: "General", label: "General", icon: User },
    { id: "Tasks", label: "Tasks", icon: CheckSquare },
    { id: "Users", label: "Users", icon: Users },
    { id: "Products", label: "Products", icon: Package },
    { id: "Sources", label: "Sources", icon: Database },
    { id: "Files", label: "Files", icon: FileText },
    { id: "Calls", label: "Calls", icon: PhoneCall },
    { id: "Clients", label: "Clients", icon: User },
    { id: "Activity", label: "Activity", icon: ActivityIcon },
  ];

  // ── Tasks ──
  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ name: "", date: "", time: "", priority: "Low", status: "On Going" });
    setTaskModal(true);
  };
  const openEditTask = (t: LeadTask) => {
    setEditingTask(t);
    setTaskForm({ name: t.name, date: t.date, time: t.time, priority: t.priority, status: t.status });
    setTaskModal(true);
  };
  const saveTask = () => {
    if (!taskForm.name.trim()) return showToast("Name is required", "info");
    if (!taskForm.date) return showToast("Date is required", "info");
    if (editingTask) {
      commit({ ...data, tasks: data.tasks.map((t) => (t.id === editingTask.id ? { ...t, ...taskForm } : t)) });
      showToast("Task updated", "success");
    } else {
      commit({ ...data, tasks: [{ id: uid(), ...taskForm }, ...data.tasks], activity: logActivity(data, "task", taskForm.name) });
      showToast("Task created", "success");
    }
    setTaskModal(false);
  };
  const deleteTask = (tid: string) => commit({ ...data, tasks: data.tasks.filter((t) => t.id !== tid) });

  // ── Calls ──
  const openCreateCall = () => {
    setEditingCall(null);
    setCallForm({ subject: "", callType: "Outbound", duration: "", assignee: "", description: "", result: "" });
    setCallModal(true);
  };
  const openEditCall = (c: LeadCall) => {
    setEditingCall(c);
    setCallForm({ subject: c.subject, callType: c.callType, duration: c.duration, assignee: c.assignee, description: c.description || "", result: c.result || "" });
    setCallModal(true);
  };
  const saveCall = () => {
    if (!callForm.subject.trim()) return showToast("Subject is required", "info");
    if (!callForm.assignee.trim()) return showToast("Assignee is required", "info");
    if (editingCall) {
      commit({ ...data, calls: data.calls.map((c) => (c.id === editingCall.id ? { ...c, ...callForm } : c)) });
      showToast("Call updated", "success");
    } else {
      commit({ ...data, calls: [{ id: uid(), ...callForm }, ...data.calls], activity: logActivity(data, "call", "Create new Deal Call") });
      showToast("Call created", "success");
    }
    setCallModal(false);
  };
  const deleteCall = (cid: string) => commit({ ...data, calls: data.calls.filter((c) => c.id !== cid) });

  // ── Users / Products / Sources / Clients ──
  const addNamed = (
    key: "users" | "products" | "sources" | "clients",
    items: PickerOption[],
    activityLabel: string,
    activityKind: LeadActivity["kind"],
  ) => {
    const list = (data[key] as LeadNamed[]) || [];
    const existingIds = new Set(list.map((x) => x.id));
    const toAdd: LeadNamed[] = items
      .filter((i) => /^[a-f0-9]{24}$/i.test(i.id) && !existingIds.has(i.id))
      .map((i) => ({ id: i.id, name: i.name }));
    if (toAdd.length === 0) {
      showToast("Select items from the list", "info");
      return;
    }
    commit({
      ...data,
      [key]: [...list, ...toAdd],
      activity: logActivity(data, activityKind, activityLabel),
    } as LeadDetailData);
    setPickerModal(null);
    showToast("Added", "success");
  };

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    e.target.value = "";
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await api.raw.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const path =
        uploadRes.data?.data?.file_path || uploadRes.data?.data?.path || "";
      const newFile = { id: uid(), name: file.name, url: path };
      commit({
        ...data,
        files: [...files, newFile],
        activity: logActivity(data, "user", `Uploaded file ${file.name}`),
      });
      showToast("File added", "success");
    } catch {
      showToast("Upload failed", "error");
    }
  };

  const removeFile = (fid: string) =>
    commit({ ...data, files: files.filter((f) => f.id !== fid) });
  const removeNamed = (key: "users" | "products" | "sources" | "clients", rid: string) =>
    commit({ ...data, [key]: ((data[key] as LeadNamed[]) || []).filter((x) => x.id !== rid) } as LeadDetailData);

  // ── Emails / Discussions / Status / Notes ──
  const sendEmail = () => {
    if (!emailForm.to.trim()) return showToast("Recipient is required", "info");
    if (!emailForm.subject.trim()) return showToast("Subject is required", "info");
    const email: LeadEmail = { id: uid(), ...emailForm, date: nowStamp() };
    commit({ ...data, emails: [email, ...data.emails], activity: logActivity(data, "email", "Create new Deal Email") });
    setEmailForm({ to: "", subject: "", description: "" });
    setEmailModal(false);
    showToast("Email sent", "success");
  };
  const addDiscussion = () => {
    if (!discussionMsg.trim()) return showToast("Message is required", "info");
    const d: LeadDiscussion = { id: uid(), author: "Company", message: discussionMsg.trim(), date: nowStamp() };
    commit({ ...data, discussions: [d, ...data.discussions] });
    setDiscussionMsg("");
    setDiscussionModal(false);
    showToast("Message added", "success");
  };
  const changeStatus = (status: string) => commit({ ...data, status });
  const saveNotes = () => {
    commit({ ...data, notes });
    showToast("Notes saved", "success");
  };

  if (!deal) {
    return (
      <div className="flex-1 bg-[#FAFBFC] flex flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Deal not found.</p>
        <button onClick={() => navigate("/crm/deals")} className="px-4 py-2 bg-blue-600 text-white rounded-md">
          Back to Deals
        </button>
      </div>
    );
  }

  const status = data.status || deal.status || "Active";
  const clients = data.clients || [];

  const StatCard: React.FC<{ icon: React.ElementType; tint: string; count: number; label: string }> = ({
    icon: Icon,
    tint,
    count,
    label,
  }) => (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tint}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">{count}</div>
        <div className="text-sm text-gray-500 mt-1">{label}</div>
      </div>
    </div>
  );

  const InfoRow: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({
    icon: Icon,
    label,
    value,
  }) => (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <div className="text-[11px] tracking-wide text-gray-400 font-medium uppercase">{label}</div>
        <div className="text-sm text-gray-900">{value || "—"}</div>
      </div>
    </div>
  );

  const SectionCard: React.FC<{ title: string; onAdd?: () => void; children: React.ReactNode }> = ({
    title,
    onAdd,
    children,
  }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {onAdd && (
          <button type="button" onClick={onAdd} className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );

  const NamedTable: React.FC<{
    col: string;
    rows: LeadNamed[];
    onDelete: (id: string) => void;
    empty: string;
  }> = ({ col, rows, onDelete, empty }) => (
    <div className="overflow-x-auto border-t border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-5 py-3 text-left font-medium">{col}</th>
            <th className="px-5 py-3 text-left font-medium w-32">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-3 text-gray-900">{r.name}</td>
              <td className="px-5 py-3">
                <button onClick={() => onDelete(r.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="px-5 py-10 text-center text-gray-400">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderTab = () => {
    switch (activeTab) {
      case "General":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={Mail} tint="bg-blue-50 text-blue-600" count={data.emails.length} label="Emails" />
              <StatCard icon={Database} tint="bg-green-50 text-green-600" count={data.sources.length} label="Sources" />
              <StatCard icon={Package} tint="bg-orange-50 text-orange-600" count={data.products.length} label="Products" />
              <StatCard icon={CheckSquare} tint="bg-purple-50 text-purple-600" count={data.tasks.length} label="Tasks" />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-blue-50/70 px-5 py-4 border-b border-blue-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">{deal.name}</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(status)}`}>{status}</span>
                </div>
                <select
                  value={status}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
                >
                  <option>Active</option>
                  <option>Won</option>
                  <option>Loss</option>
                </select>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                <InfoRow icon={DollarSign} label="Price" value={`$${deal.price.toLocaleString()}`} />
                <InfoRow icon={Phone} label="Phone" value={deal.phone} />
                <InfoRow icon={User} label="Creator" value="Company" />
                <InfoRow icon={GitBranch} label="Pipeline" value={deal.pipeline} />
                <InfoRow icon={Layers} label="Stage" value={deal.stage} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Notes</h3>
              <RichEditor value={notes} onChange={setNotes} />
              <div className="mt-4 flex justify-end">
                <button onClick={saveNotes} className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SectionCard title="Emails" onAdd={() => setEmailModal(true)}>
                {data.emails.length === 0 ? (
                  <div className="px-5 pb-8 pt-2 text-center text-sm text-gray-400">No emails found</div>
                ) : (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {data.emails.map((e) => (
                      <div key={e.id} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /> {e.to}</span>
                          <span className="text-xs text-gray-400">{e.date}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 mt-1">{e.subject}</div>
                        <div className="text-sm text-gray-500 mt-0.5" dangerouslySetInnerHTML={{ __html: e.description }} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Discussions" onAdd={() => setDiscussionModal(true)}>
                {data.discussions.length === 0 ? (
                  <div className="px-5 pb-8 pt-2 text-center text-sm text-gray-400">No discussions yet</div>
                ) : (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {data.discussions.map((d) => (
                      <div key={d.id} className="px-5 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{d.author}</span>
                          <span className="text-xs text-gray-400">{d.date}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">{d.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        );

      case "Tasks":
        return (
          <SectionCard title="Tasks" onAdd={openCreateTask}>
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Name</th>
                    <th className="px-5 py-3 text-left font-medium">Date</th>
                    <th className="px-5 py-3 text-left font-medium">Time</th>
                    <th className="px-5 py-3 text-left font-medium">Priority</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.tasks.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-3 text-gray-900">{t.name}</td>
                      <td className="px-5 py-3 text-gray-600">{t.date}</td>
                      <td className="px-5 py-3 text-gray-600">{t.time || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${t.priority === "High" ? "bg-red-100 text-red-700" : t.priority === "Medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"}`}>{t.priority}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${t.status === "Complete" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{t.status}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditTask(t)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteTask(t.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.tasks.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No tasks yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );

      case "Users":
        return (
          <SectionCard title="Users" onAdd={() => setPickerModal("users")}>
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium w-24">Avatar</th>
                    <th className="px-5 py-3 text-left font-medium">User Name</th>
                    <th className="px-5 py-3 text-left font-medium w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">{u.name.charAt(0)}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-900">{u.name}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => removeNamed("users", u.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {data.users.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-400">No users assigned.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );

      case "Products":
        return (
          <SectionCard title="Products" onAdd={() => setPickerModal("products")}>
            <NamedTable col="Product Name" rows={data.products} onDelete={(rid) => removeNamed("products", rid)} empty="No products linked." />
          </SectionCard>
        );

      case "Sources":
        return (
          <SectionCard title="Sources" onAdd={() => setPickerModal("sources")}>
            <NamedTable col="Source Name" rows={data.sources} onDelete={(rid) => removeNamed("sources", rid)} empty="No sources linked." />
          </SectionCard>
        );

      case "Clients":
        return (
          <SectionCard title="Clients" onAdd={() => setPickerModal("clients")}>
            <NamedTable col="Client Name" rows={clients} onDelete={(rid) => removeNamed("clients", rid)} empty="No clients linked." />
          </SectionCard>
        );

      case "Files":
        return (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFilePick}
            />
            <SectionCard title="Files" onAdd={() => fileInputRef.current?.click()}>
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">File Name</th>
                      <th className="px-5 py-3 text-left font-medium w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td className="px-5 py-3 text-gray-900">
                          {f.url ? (
                            <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                              {f.name}
                            </a>
                          ) : (
                            f.name
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <button type="button" onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {files.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-5 py-10 text-center text-gray-400">
                          No files uploaded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );

      case "Calls":
        return (
          <SectionCard title="Calls" onAdd={openCreateCall}>
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Subject</th>
                    <th className="px-5 py-3 text-left font-medium">Call Type</th>
                    <th className="px-5 py-3 text-left font-medium">Duration</th>
                    <th className="px-5 py-3 text-left font-medium">Assignee</th>
                    <th className="px-5 py-3 text-left font-medium w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.calls.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 text-gray-900">{c.subject}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.callType === "Inbound" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{c.callType}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{c.duration || "—"}</td>
                      <td className="px-5 py-3 text-gray-600">{c.assignee}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEditCall(c)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteCall(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.calls.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No calls logged.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );

      case "Activity":
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.activity.map((a) => {
                const Icon = activityIcon(a.kind);
                return (
                  <div key={a.id} className="border border-gray-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
                    <div>
                      <div className="text-sm text-gray-900">{a.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{a.date}</div>
                    </div>
                  </div>
                );
              })}
              {data.activity.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-10">No activity yet.</div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button>
          <span>›</span>
          <button onClick={() => navigate("/crm/deals")} className="hover:text-gray-700">CRM</button>
          <span>›</span>
          <button onClick={() => navigate("/crm/deals")} className="hover:text-gray-700">Deals</button>
          <span>›</span>
          <span className="text-gray-900 font-medium">{deal.name}</span>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Deal Details</h1>
        <button onClick={() => navigate("/crm/deals")} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl p-2 lg:sticky lg:top-0">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg whitespace-nowrap transition-colors ${activeTab === tab.id ? "bg-blue-50 text-blue-600 font-medium ring-1 ring-blue-200" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
          <div className="flex-1 min-w-0">{renderTab()}</div>
        </div>
      </div>

      {/* ── Task modal ── */}
      {taskModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-24 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingTask ? "Edit Task" : "Create Task"}</h3>
              <button onClick={() => setTaskModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input autoFocus value={taskForm.name} onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })} placeholder="Enter task name" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <AppDatePicker value={taskForm.date} onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input type="time" value={taskForm.time} onChange={(e) => setTaskForm({ ...taskForm, time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as LeadTask["priority"] })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                    <option>Low</option><option>Medium</option><option>High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as LeadTask["status"] })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                    <option>On Going</option><option>Complete</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setTaskModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveTask} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingTask ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Call modal ── */}
      {callModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-16 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editingCall ? "Edit Call" : "Create Call"}</h3>
              <button onClick={() => setCallModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                <input autoFocus value={callForm.subject} onChange={(e) => setCallForm({ ...callForm, subject: e.target.value })} placeholder="Enter call subject" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Call Type <span className="text-red-500">*</span></label>
                  <select value={callForm.callType} onChange={(e) => setCallForm({ ...callForm, callType: e.target.value as LeadCall["callType"] })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                    <option>Outbound</option><option>Inbound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={callForm.duration} onChange={(e) => setCallForm({ ...callForm, duration: e.target.value })} placeholder="e.g. 09:05" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignee <span className="text-red-500">*</span></label>
                <select value={callForm.assignee} onChange={(e) => setCallForm({ ...callForm, assignee: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                  <option value="">Select assignee</option>
                  {data.users.map((u) => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={3} value={callForm.description} onChange={(e) => setCallForm({ ...callForm, description: e.target.value })} placeholder="Enter call description" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Result</label>
                <RichEditor value={callForm.result || ""} onChange={(html) => setCallForm({ ...callForm, result: html })} minHeight={120} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setCallModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={saveCall} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{editingCall ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Email modal ── */}
      {emailModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-16 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Send Email</h3>
              <button onClick={() => setEmailModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To <span className="text-red-500">*</span></label>
                <input autoFocus value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} placeholder="Enter email address" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                <input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder="Enter subject" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <RichEditor value={emailForm.description} onChange={(html) => setEmailForm({ ...emailForm, description: html })} minHeight={140} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setEmailModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={sendEmail} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Send Email</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Message modal ── */}
      {discussionModal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-24 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Message</h3>
              <button onClick={() => setDiscussionModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
              <textarea autoFocus rows={4} value={discussionMsg} onChange={(e) => setDiscussionMsg(e.target.value)} placeholder="Enter your message" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setDiscussionModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={addDiscussion} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add pickers ── */}
      {pickerModal === "users" && (
        <AddPicker title="Add Users" label="Select Users" options={userOptions} existing={data.users.map((u) => u.id)} onClose={() => setPickerModal(null)} onAdd={(items) => addNamed("users", items, items.map((i) => i.name).join(", "), "user")} />
      )}
      {pickerModal === "products" && (
        <AddPicker title="Add Products" label="Select Products" options={productOptions} existing={data.products.map((p) => p.id)} onClose={() => setPickerModal(null)} onAdd={(items) => addNamed("products", items, items.map((i) => i.name).join(", "), "products")} />
      )}
      {pickerModal === "sources" && (
        <AddPicker title="Add Sources" label="Select Sources" options={sourceOptions} existing={data.sources.map((s) => s.id)} onClose={() => setPickerModal(null)} onAdd={(items) => addNamed("sources", items, "Update Sources", "sources")} />
      )}
      {pickerModal === "clients" && (
        <AddPicker title="Add Clients" label="Select Clients" options={clientOptions} existing={clients.map((c) => c.id)} onClose={() => setPickerModal(null)} onAdd={(items) => addNamed("clients", items, items.map((i) => i.name).join(", "), "user")} />
      )}
    </div>
  );
};

export default DealDetail;
