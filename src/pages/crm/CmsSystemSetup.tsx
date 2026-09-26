/**
 * File: src/pages/crm/CmsSystemSetup.tsx
 * CRM System Setup — pipelines, stages, labels, sources via backend API.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import {
  fetchCrmSetupBundle,
  createCrmPipeline,
  updateCrmPipeline,
  deleteCrmPipeline,
  createCrmLeadStage,
  updateCrmLeadStage,
  deleteCrmLeadStage,
  createCrmDealStage,
  updateCrmDealStage,
  deleteCrmDealStage,
  createCrmLabel,
  updateCrmLabel,
  deleteCrmLabel,
  createCrmSource,
  updateCrmSource,
  deleteCrmSource,
} from "@/services/crmApi";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  GitBranch,
  Layers,
  Target,
  Tag,
  Globe,
  GripVertical,
} from "lucide-react";

// ─── Types & persistence ─────────────────────────────────────────────────────
interface Named {
  id: string;
  name: string;
}
interface Stage {
  id: string;
  name: string;
  pipeline: string;
  pipelineId?: string;
  order: number;
}
interface Label {
  id: string;
  name: string;
  pipeline: string;
  pipelineId?: string;
  color: string;
}
interface SetupData {
  pipelines: Named[];
  leadStages: Stage[];
  dealStages: Stage[];
  labels: Label[];
  sources: Named[];
}

const EMPTY_SETUP: SetupData = {
  pipelines: [],
  leadStages: [],
  dealStages: [],
  labels: [],
  sources: [],
};

const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

// ─── Component ────────────────────────────────────────────────────────────────
type TabId = "Pipelines" | "Lead Stages" | "Deal Stages" | "Labels" | "Sources";

export const CrmSystemSetup: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<SetupData>(EMPTY_SETUP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const bundle = await fetchCrmSetupBundle();
      const pipeName: Record<string, string> = {};
      bundle.pipelines.forEach((p) => {
        pipeName[p._id] = p.name;
      });
      const stages = (list: typeof bundle.leadStages) =>
        list.map((s) => ({
          id: s._id,
          name: s.name,
          pipeline: (s.pipeline_id && pipeName[s.pipeline_id]) || "",
          pipelineId: s.pipeline_id || "",
          order: s.order || 0,
        }));
      setData({
        pipelines: bundle.pipelines.map((p) => ({ id: p._id, name: p.name })),
        leadStages: stages(bundle.leadStages),
        dealStages: stages(bundle.dealStages),
        labels: bundle.labels.map((l) => ({
          id: l._id,
          name: l.name,
          pipeline: (l.pipeline_id && pipeName[l.pipeline_id]) || "",
          pipelineId: l.pipeline_id || "",
          color: l.color || "#3b82f6",
        })),
        sources: bundle.sources.map((s) => ({ id: s._id, name: s.name })),
      });
    } catch (err: any) {
      showToast(err?.message || "Couldn't load system setup", "error");
      setData(EMPTY_SETUP);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const [tab, setTab] = useState<TabId>("Pipelines");
  const pipelineNames = data.pipelines.map((p) => p.name);
  const [subPipe, setSubPipe] = useState<string>("");
  const activePipe = subPipe || pipelineNames[0] || "";

  // Modal state
  const [modal, setModal] = useState<null | TabId>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    pipeline: "",
    color: LABEL_COLORS[0],
  });

  const tabs: { id: TabId; icon: React.ElementType }[] = [
    { id: "Pipelines", icon: GitBranch },
    { id: "Lead Stages", icon: Layers },
    { id: "Deal Stages", icon: Target },
    { id: "Labels", icon: Tag },
    { id: "Sources", icon: Globe },
  ];

  const pipeIdByName = (name: string) => data.pipelines.find((p) => p.name === name)?.id || "";

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", pipeline: activePipe || pipelineNames[0] || "", color: LABEL_COLORS[0] });
    setModal(tab);
  };
  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      pipeline: item.pipeline || activePipe,
      color: item.color || LABEL_COLORS[0],
    });
    setModal(tab);
  };

  const save = async () => {
    if (!form.name.trim()) return showToast("Name is required", "info");
    setSaving(true);
    try {
      const name = form.name.trim();
      const pipeline_id = pipeIdByName(form.pipeline);
      if (tab === "Pipelines") {
        if (editingId) await updateCrmPipeline(editingId, name);
        else await createCrmPipeline(name);
      } else if (tab === "Sources") {
        if (editingId) await updateCrmSource(editingId, name);
        else await createCrmSource(name);
      } else if (tab === "Lead Stages") {
        if (!pipeline_id) {
          showToast("Select a pipeline", "info");
          setSaving(false);
          return;
        }
        if (editingId) await updateCrmLeadStage(editingId, { name, pipeline_id });
        else await createCrmLeadStage({ name, pipeline_id });
      } else if (tab === "Deal Stages") {
        if (!pipeline_id) {
          showToast("Select a pipeline", "info");
          setSaving(false);
          return;
        }
        if (editingId) await updateCrmDealStage(editingId, { name, pipeline_id });
        else await createCrmDealStage({ name, pipeline_id });
      } else if (tab === "Labels") {
        if (editingId) await updateCrmLabel(editingId, { name, color: form.color, pipeline_id: pipeline_id || undefined });
        else await createCrmLabel({ name, color: form.color, pipeline_id: pipeline_id || undefined });
      }
      setModal(null);
      showToast(editingId ? "Updated" : "Created", "success");
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't save", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kind: keyof SetupData, id: string) => {
    setSaving(true);
    try {
      if (kind === "pipelines") await deleteCrmPipeline(id);
      else if (kind === "leadStages") await deleteCrmLeadStage(id);
      else if (kind === "dealStages") await deleteCrmDealStage(id);
      else if (kind === "labels") await deleteCrmLabel(id);
      else if (kind === "sources") await deleteCrmSource(id);
      showToast("Deleted", "success");
      await reload();
    } catch (err: any) {
      showToast(err?.message || "Couldn't delete", "error");
    } finally {
      setSaving(false);
    }
  };

    const countFor = (list: { pipeline: string }[], pipe: string) =>
    list.filter((s) => s.pipeline === pipe).length;

  // ── sub components ──
  const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <button onClick={openCreate} className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );

  const PipeSubTabs = () => (
    <div className="flex items-center gap-6 px-5 border-b border-gray-100 overflow-x-auto">
      {data.pipelines.map((p) => {
        const count =
          tab === "Lead Stages"
            ? countFor(data.leadStages, p.name)
            : tab === "Deal Stages"
              ? countFor(data.dealStages, p.name)
              : countFor(data.labels, p.name);
        const active = activePipe === p.name;
        return (
          <button
            key={p.id}
            onClick={() => setSubPipe(p.name)}
            className={`py-3 text-sm whitespace-nowrap border-b-2 -mb-px flex items-center gap-2 ${active ? "border-blue-600 text-blue-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {p.name}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );

  const StageList: React.FC<{ list: Stage[] }> = ({ list }) => {
    const rows = list.filter((s) => s.pipeline === activePipe).sort((a, b) => a.order - b.order);
    return (
      <div className="p-5 space-y-3">
        {rows.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3">
            <GripVertical className="w-4 h-4 text-gray-300" />
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">{i + 1}</div>
            <span className="flex-1 text-sm text-gray-900">{s.name}</span>
            <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => void remove(tab === "Lead Stages" ? "leadStages" : "dealStages", s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {rows.length === 0 && <div className="text-center text-gray-400 py-8">No stages in this pipeline.</div>}
      </div>
    );
  };

  const renderTab = () => {
    switch (tab) {
      case "Pipelines":
        return (
          <Card title="Pipelines">
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Name</th>
                    <th className="px-5 py-3 text-left font-medium w-40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.pipelines.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 text-gray-900">{p.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => void remove("pipelines", p.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      case "Lead Stages":
        return (
          <Card title="Lead Stages">
            {PipeSubTabs()}
            <StageList list={data.leadStages} />
          </Card>
        );
      case "Deal Stages":
        return (
          <Card title="Deal Stages">
            {PipeSubTabs()}
            <StageList list={data.dealStages} />
          </Card>
        );
      case "Labels": {
        const rows = data.labels.filter((l) => l.pipeline === activePipe);
        return (
          <Card title="Labels">
            {PipeSubTabs()}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((l) => (
                <div key={l.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3" style={{ borderLeft: `4px solid ${l.color}` }}>
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="flex-1 text-sm text-gray-900">{l.name}</span>
                  <button onClick={() => openEdit(l)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => void remove("labels", l.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {rows.length === 0 && <div className="col-span-full text-center text-gray-400 py-8">No labels in this pipeline.</div>}
            </div>
          </Card>
        );
      }
      case "Sources":
        return (
          <Card title="Sources">
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Source</th>
                    <th className="px-5 py-3 text-left font-medium w-40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.sources.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 text-gray-900">{s.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => void remove("sources", s.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
    }
  };

  const showPipelineField = modal === "Lead Stages" || modal === "Deal Stages" || modal === "Labels";
  const showColorField = modal === "Labels";
  const modalTitle = `${editingId ? "Edit" : "Create"} ${modal === "Pipelines" ? "Pipeline" : modal === "Lead Stages" ? "Lead Stage" : modal === "Deal Stages" ? "Deal Stage" : modal === "Labels" ? "Label" : "Source"}`;

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      {/* Breadcrumb */}
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">Dashboard</button>
          <span>›</span>
          <button onClick={() => navigate("/crm/leads")} className="hover:text-gray-700">CRM</button>
          <span>›</span>
          <span className="text-gray-500">System Setup</span>
          <span>›</span>
          <span className="text-gray-900 font-medium">{tab}</span>
        </div>
      </div>

      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <h1 className="text-lg font-semibold text-gray-900">System Setup</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tab rail */}
          <div className="lg:w-56 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-xl p-2 lg:sticky lg:top-0">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id);
                      setSubPipe("");
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg whitespace-nowrap transition-colors ${tab === t.id ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.id}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="flex-1 min-w-0">{renderTab()}</div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-28 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter Name" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              {showPipelineField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline</label>
                  <select value={form.pipeline} onChange={(e) => setForm({ ...form, pipeline: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white">
                    {pipelineNames.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
              {showColorField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-12 h-9 rounded border border-gray-300 p-0.5 bg-white" />
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: form.color }}>
                      {form.name || "Preview"}
                    </span>
                    <div className="flex gap-1.5 ml-auto">
                      {LABEL_COLORS.map((c) => (
                        <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-5 h-5 rounded-full border border-white shadow" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => void save()} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">{saving ? "Saving…" : editingId ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmSystemSetup;
