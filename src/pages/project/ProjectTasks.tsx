/**
 * Project Task Board — columns from Task Stages (GET /taskboard/:projectId).
 * Separate from Issues/Bugs which use Bug Stages.
 */
import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trash2, X, Search, Check } from "lucide-react";
import { showToast } from "../../utils/toast";
import {
  fetchProjectDetail,
  fetchTaskboard,
  createOrUpdateTask,
  deleteTask,
  moveTaskStage,
  fetchProjectUsers,
  type BoardTask,
  type ProjectUser,
} from "@/services/projectApi";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const field =
  "keep-box ua-field w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600";
const label = "block text-sm font-medium text-gray-700 mb-1";

const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    High: "bg-red-500/15 text-red-400",
    Medium: "bg-amber-500/15 text-amber-400",
    Low: "bg-emerald-500/15 text-emerald-400",
    Critical: "bg-red-500/20 text-red-500",
  };
  return map[p] || "bg-gray-500/15 text-gray-400";
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 22 }) => (
  <span
    className="inline-flex items-center justify-center rounded-full bg-blue-500 text-white font-medium ring-2 ring-[var(--surface,#1a212a)]"
    style={{ width: size, height: size, fontSize: size * 0.4 }}
    title={name}
  >
    {initials(name)}
  </span>
);

const UserMultiSelect: React.FC<{
  options: ProjectUser[];
  value: string[];
  onChange: (v: string[]) => void;
}> = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = options.filter(
    (o) =>
      !q.trim() ||
      o.name.toLowerCase().includes(q.toLowerCase()) ||
      o.email.toLowerCase().includes(q.toLowerCase()),
  );
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${field} text-left`}>
        {value.length ? `${value.length} selected` : "Select assignees"}
      </button>
      {open && (
        <div className="mt-2 border border-gray-200 rounded-md overflow-hidden bg-white ua-dropdown-panel">
          <div className="p-2 border-b border-gray-100 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users…"
              className="keep-box ua-field w-full pl-8 pr-3 py-1.5 text-sm"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 text-left"
              >
                <span>
                  {o.name}
                  {o.email ? <span className="text-gray-400 text-xs ml-1">({o.email})</span> : null}
                </span>
                {value.includes(o.id) && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-gray-400">No users</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateTaskModal: React.FC<{
  projectId: string;
  stageId: string;
  users: ProjectUser[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ projectId, stageId, users, onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return showToast("Enter task title", "info");
    if (!assignees.length) return showToast("Select at least one assignee", "info");
    setSaving(true);
    try {
      await createOrUpdateTask({
        project_id: projectId,
        title: title.trim(),
        description,
        priority,
        stage_id: stageId,
        assigned_to: assignees,
        duration: endDate ? `${startDate} - ${endDate}` : startDate,
      });
      showToast("Task created", "success");
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e?.message || "Failed to create task", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Create Task</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={label}>Title *</label>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={label}>Priority</label>
            <select className={field} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {["Low", "Medium", "High", "Critical"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Start</label>
              <AppDatePicker className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={label}>End</label>
              <AppDatePicker className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label}>Assignees *</label>
            <UserMultiSelect options={users} value={assignees} onChange={setAssignees} />
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea className={`${field} resize-y`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm">
            Cancel
          </button>
          <button disabled={saving} onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProjectTasks: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const qc = useQueryClient();
  const [createStageId, setCreateStageId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: () => fetchProjectDetail(String(id)),
    enabled: !!id,
  });

  const { data: columns = [], isLoading: loadingBoard } = useQuery({
    queryKey: ["project-taskboard", id],
    queryFn: () => fetchTaskboard(String(id)),
    enabled: !!id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["project-users"],
    queryFn: fetchProjectUsers,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project-taskboard", id] });
    qc.invalidateQueries({ queryKey: ["project-detail", id] });
  };

  const allTasks = useMemo(
    () => columns.flatMap((c) => c.tasks.map((t) => ({ ...t, stageId: c.id }))),
    [columns],
  );

  const move = async (taskId: string, stageId: string) => {
    try {
      await moveTaskStage(taskId, stageId);
      invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed to move task", "error");
    }
  };

  const remove = async (task: BoardTask) => {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      await deleteTask(task.id);
      showToast("Task deleted", "success");
      invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed to delete", "error");
    }
  };

  if (loadingProject || loadingBoard) {
    return <div className="module-page-shell flex items-center justify-center text-gray-500">Loading task board…</div>;
  }

  if (!project) {
    return (
      <div className="module-page-shell flex items-center justify-center text-gray-500">
        Project not found.{" "}
        <button onClick={() => navigate("/project/projects")} className="ml-2 text-blue-500">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="module-page-shell overflow-y-auto p-0">
      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate("/")} className="hover:text-gray-700">
            Dashboard
          </button>
          <span>›</span>
          <button onClick={() => navigate("/project/projects")} className="hover:text-gray-700">
            Project
          </button>
          <span>›</span>
          <button onClick={() => navigate(`/project/projects/${project.id}`)} className="hover:text-gray-700">
            {project.name}
          </button>
          <span>›</span>
          <span className="text-gray-900 font-medium">Tasks</span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">
            {project.name} — Tasks
            <span className="ml-2 text-sm font-normal text-gray-500">({allTasks.length})</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/project/projects/${project.id}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setCreateStageId(columns[0]?.id || null)}
              disabled={!columns.length}
              className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              title="Create task"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!columns.length ? (
          <div className="text-center text-gray-500 py-16">
            No task stages yet. Configure them in{" "}
            <button onClick={() => navigate("/project/system-setup")} className="text-blue-500 underline">
              System Setup → Task Stage
            </button>
            .
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {columns.map((col) => (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) {
                    void move(dragId, col.id);
                    setDragId(null);
                  }
                }}
                className="rounded-xl border min-h-[420px] flex flex-col bg-blue-500/[0.04] border-blue-500/20"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-gray-900">{col.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 text-xs">{col.tasks.length}</span>
                  </div>
                  <button onClick={() => setCreateStageId(col.id)} className="text-gray-400 hover:text-blue-500">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 p-3 space-y-3">
                  {col.tasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-gray-900 text-sm">{t.title}</div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </div>
                      {t.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex -space-x-2">
                          {t.assignees.map((a) => (
                            <Avatar key={a.id} name={a.name} />
                          ))}
                        </div>
                        <button onClick={() => void remove(t)} className="text-red-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {col.tasks.length === 0 && <div className="text-center text-xs text-gray-400 py-8">Drop tasks here</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createStageId && (
        <CreateTaskModal
          projectId={project.id}
          stageId={createStageId}
          users={users}
          onClose={() => setCreateStageId(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
};

export default ProjectTasks;
