/**
 * Training List + Tasks — /api/v1/training/trainings (+ nested tasks/feedbacks)
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchTrainings,
  createTraining,
  updateTraining,
  deleteTraining,
  fetchTrainingTasks,
  createTrainingTask,
  updateTrainingTask,
  completeTrainingTask,
  deleteTrainingTask,
  createTaskFeedback,
  fetchTaskFeedbacks,
  searchBranches,
  searchDepartments,
  searchTrainingTypes,
  searchTrainers,
  searchEmployees,
  TRAINING_STATUSES,
  type TrainingRow,
  type TrainingTaskRow,
} from "@/services/training";
import { Field, inputCls, selectCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2, ListTodo, ArrowLeft, CheckCircle2, MessageSquare } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STATUS_CHIP: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700",
  Ongoing: "bg-amber-100 text-amber-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
};

const emptyTraining = () => ({
  id: "",
  title: "",
  description: "",
  typeId: "",
  typeName: "",
  trainerId: "",
  trainerName: "",
  branchId: "",
  branchName: "",
  departmentId: "",
  departmentName: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  location: "",
  maxParticipants: "" as string | number,
  cost: "" as string | number,
  status: "Scheduled",
});

const emptyTask = () => ({
  id: "",
  title: "",
  description: "",
  dueDate: "",
  assignedToId: "",
  assignedToName: "",
});

const TrainingList: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyTraining());
  const [deleteTarget, setDeleteTarget] = useState<TrainingRow | null>(null);

  const [activeTraining, setActiveTraining] = useState<TrainingRow | null>(null);
  const [taskSearchInput, setTaskSearchInput] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskPage, setTaskPage] = useState(1);
  const [taskPerPage, setTaskPerPage] = useState(10);
  const [taskModal, setTaskModal] = useState<"create" | "edit" | null>(null);
  const [taskDraft, setTaskDraft] = useState(emptyTask());
  const [deleteTask, setDeleteTask] = useState<TrainingTaskRow | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<TrainingTaskRow | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTaskSearch(taskSearchInput.trim());
      setTaskPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [taskSearchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["trainings", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchTrainings({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("start_date", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    enabled: !activeTraining,
    placeholderData: (prev) => prev,
  });

  const { data: taskData, isLoading: tasksLoading } = useQuery({
    queryKey: ["training-tasks", activeTraining?.id, taskPage, taskPerPage, taskSearch],
    queryFn: () =>
      fetchTrainingTasks(activeTraining!.id, {
        page: taskPage,
        limit: taskPerPage,
        searchTerm: taskSearch || undefined,
        sort: buildListSortParam("createdAt", "Descending"),
      }),
    enabled: !!activeTraining?.id,
    placeholderData: (prev) => prev,
  });

  const { data: feedbackData } = useQuery({
    queryKey: ["training-feedbacks", feedbackTask?.id],
    queryFn: () => fetchTaskFeedbacks(feedbackTask!.id, { page: 1, limit: 20 }),
    enabled: !!feedbackTask?.id,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const tasks = taskData?.rows ?? [];
  const taskTotal = taskData?.pagination?.totalData ?? 0;

  const invalidateTrainings = () => qc.invalidateQueries({ queryKey: ["trainings"] });
  const invalidateTasks = () => qc.invalidateQueries({ queryKey: ["training-tasks"] });

  const submitTraining = async () => {
    if (
      !draft.title.trim() ||
      !draft.typeId ||
      !draft.trainerId ||
      !draft.branchId ||
      !draft.departmentId ||
      !draft.startDate ||
      !draft.endDate ||
      !draft.startTime ||
      !draft.endTime
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }
    const body = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      training_type_id: draft.typeId,
      trainer_id: draft.trainerId,
      branch_id: draft.branchId,
      department_id: draft.departmentId,
      start_date: draft.startDate,
      end_date: draft.endDate,
      start_time: draft.startTime,
      end_time: draft.endTime,
      location: draft.location.trim() || undefined,
      max_participants: draft.maxParticipants === "" ? undefined : Number(draft.maxParticipants),
      cost: draft.cost === "" ? undefined : Number(draft.cost),
      status: draft.status,
    };
    try {
      if (modal === "edit") {
        await updateTraining(draft.id, body);
        showToast("Training updated", "success");
      } else {
        await createTraining(body);
        showToast("Training created", "success");
      }
      await invalidateTrainings();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save training", "error");
    }
  };

  const confirmDeleteTraining = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTraining(deleteTarget.id);
      showToast("Training deleted", "success");
      await invalidateTrainings();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const submitTask = async () => {
    if (!activeTraining || !taskDraft.title.trim() || !taskDraft.assignedToId) {
      showToast("Title and assignee are required", "error");
      return;
    }
    const body = {
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || undefined,
      due_date: taskDraft.dueDate || undefined,
      assigned_to: taskDraft.assignedToId,
    };
    try {
      if (taskModal === "edit") {
        await updateTrainingTask(taskDraft.id, body);
        showToast("Task updated", "success");
      } else {
        await createTrainingTask(activeTraining.id, body);
        showToast("Task created", "success");
      }
      await invalidateTasks();
      setTaskModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save task", "error");
    }
  };

  const confirmDeleteTask = async () => {
    if (!deleteTask) return;
    try {
      await deleteTrainingTask(deleteTask.id);
      showToast("Task deleted", "success");
      await invalidateTasks();
      setDeleteTask(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  const markComplete = async (task: TrainingTaskRow) => {
    try {
      await completeTrainingTask(task.id);
      showToast("Task completed", "success");
      await invalidateTasks();
    } catch (e: any) {
      showToast(e?.message || "Failed to complete task", "error");
    }
  };

  const submitFeedback = async () => {
    if (!feedbackTask) return;
    try {
      await createTaskFeedback(feedbackTask.id, {
        rating: feedbackRating,
        comments: feedbackComments.trim() || undefined,
      });
      showToast("Feedback submitted", "success");
      qc.invalidateQueries({ queryKey: ["training-feedbacks", feedbackTask.id] });
      setFeedbackComments("");
      setFeedbackRating(5);
    } catch (e: any) {
      showToast(e?.message || "Failed to submit feedback", "error");
    }
  };

  if (activeTraining) {
    return (
      <>
        <ListShell
          module="Training"
          current="Training List"
          title={`Tasks — ${activeTraining.title}`}
          onCreate={() => {
            setTaskDraft(emptyTask());
            setTaskModal("create");
          }}
          search={taskSearchInput}
          setSearch={setTaskSearchInput}
          searchPlaceholder="Search tasks…"
          perPage={taskPerPage}
          setPerPage={setTaskPerPage}
          page={taskPage}
          setPage={setTaskPage}
          total={taskTotal}
        >
          <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTraining(null)}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4" /> Back to trainings
            </button>
            <span className="text-xs text-gray-500">
              {activeTraining.startDate} → {activeTraining.endDate} · {activeTraining.status}
            </span>
          </div>
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
              <tr>
                {["Title", "Assignee", "Due Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-gray-900">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">{t.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{t.assignedToName || "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600">{t.dueDate || "—"}</td>
                  <td className="px-4 py-3.5">
                    {chip(
                      t.status,
                      t.status.toLowerCase() === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700",
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {t.status.toLowerCase() !== "completed" && (
                        <button
                          type="button"
                          onClick={() => void markComplete(t)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                          title="Complete"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackTask(t);
                          setFeedbackComments("");
                          setFeedbackRating(5);
                        }}
                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                        title="Feedback"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTaskDraft({
                            id: t.id,
                            title: t.title,
                            description: t.description,
                            dueDate: t.dueDate,
                            assignedToId: t.assignedToId,
                            assignedToName: t.assignedToName,
                          });
                          setTaskModal("edit");
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTask(t)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!tasksLoading && tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No tasks found.
                  </td>
                </tr>
              )}
              {tasksLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ListShell>

        {taskModal && (
          <ModalShell
            title={taskModal === "edit" ? "Edit Task" : "Create Task"}
            onClose={() => setTaskModal(null)}
            onSubmit={submitTask}
            submitLabel={taskModal === "edit" ? "Update" : "Create"}
          >
            <div className="space-y-4">
              <Field label="Title" required>
                <input
                  value={taskDraft.title}
                  onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })}
                  className={inputCls}
                  placeholder="Task title"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={taskDraft.description}
                  onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })}
                  rows={3}
                  className={inputCls}
                />
              </Field>
              <Field label="Assigned Employee" required>
                <AsyncSearchSelect
                  value={taskDraft.assignedToId}
                  displayName={taskDraft.assignedToName}
                  onChange={(id, opt) =>
                    setTaskDraft({
                      ...taskDraft,
                      assignedToId: id,
                      assignedToName: opt?.name || "",
                    })
                  }
                  onSearch={searchEmployees}
                  placeholder="Search employees…"
                />
              </Field>
              <Field label="Due Date">
                <AppDatePicker
                  value={taskDraft.dueDate}
                  onChange={(e) => setTaskDraft({ ...taskDraft, dueDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </ModalShell>
        )}

        {deleteTask && (
          <DeleteConfirm
            what="task"
            name={deleteTask.title}
            onConfirm={() => void confirmDeleteTask()}
            onCancel={() => setDeleteTask(null)}
          />
        )}

        {feedbackTask && (
          <ModalShell
            title={`Feedback — ${feedbackTask.title}`}
            onClose={() => setFeedbackTask(null)}
            onSubmit={submitFeedback}
            submitLabel="Submit Feedback"
          >
            <div className="space-y-4">
              <Field label="Rating (1–5)" required>
                <select
                  value={feedbackRating}
                  onChange={(e) => setFeedbackRating(Number(e.target.value))}
                  className={selectCls}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Comments">
                <textarea
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  rows={3}
                  className={inputCls}
                  placeholder="Optional comments"
                />
              </Field>
              {(feedbackData?.rows?.length ?? 0) > 0 && (
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase">Existing feedback</p>
                  {feedbackData!.rows.map((f: any) => (
                    <div key={String(f._id)} className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
                      Rating {f.rating}
                      {f.comments ? ` — ${f.comments}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalShell>
        )}
      </>
    );
  }

  return (
    <>
      <ListShell
        module="Training"
        current="Training List"
        title="Manage Training"
        onCreate={() => {
          setDraft(emptyTraining());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search trainings…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...TRAINING_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setSortAsc(!sortAsc);
                    setPage(1);
                  }}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Title / Start <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Type", "Trainer", "Branch", "Dates", "Cost", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5">
                  <div className="font-medium text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-500">{r.location || r.departmentName || ""}</div>
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.typeName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.trainerName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.branchName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">
                  {r.startDate} → {r.endDate}
                  <div className="text-xs text-gray-400">
                    {r.startTime} – {r.endTime}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-gray-900">{money(r.cost)}</td>
                <td className="px-4 py-3.5">{chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Scheduled)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTraining(r)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                      title="Tasks"
                    >
                      <ListTodo className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          title: r.title,
                          description: r.description,
                          typeId: r.typeId,
                          typeName: r.typeName,
                          trainerId: r.trainerId,
                          trainerName: r.trainerName,
                          branchId: r.branchId,
                          branchName: r.branchName,
                          departmentId: r.departmentId,
                          departmentName: r.departmentName,
                          startDate: r.startDate,
                          endDate: r.endDate,
                          startTime: r.startTime,
                          endTime: r.endTime,
                          location: r.location,
                          maxParticipants: r.maxParticipants || "",
                          cost: r.cost || "",
                          status: r.status,
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  No trainings found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Training" : "Create Training"}
          onClose={() => setModal(null)}
          onSubmit={submitTraining}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <Field label="Title" required>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={inputCls}
                placeholder="Training title"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Training Type" required>
                <AsyncSearchSelect
                  value={draft.typeId}
                  displayName={draft.typeName}
                  onChange={(id, opt) => setDraft({ ...draft, typeId: id, typeName: opt?.name || "" })}
                  onSearch={searchTrainingTypes}
                  placeholder="Search types…"
                />
              </Field>
              <Field label="Trainer" required>
                <AsyncSearchSelect
                  value={draft.trainerId}
                  displayName={draft.trainerName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, trainerId: id, trainerName: opt?.name || "" })
                  }
                  onSearch={searchTrainers}
                  placeholder="Search trainers…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Branch" required>
                <AsyncSearchSelect
                  value={draft.branchId}
                  displayName={draft.branchName}
                  onChange={(id, opt) =>
                    setDraft({
                      ...draft,
                      branchId: id,
                      branchName: opt?.name || "",
                      departmentId: "",
                      departmentName: "",
                    })
                  }
                  onSearch={searchBranches}
                  placeholder="Search branches…"
                />
              </Field>
              <Field label="Department" required>
                <AsyncSearchSelect
                  value={draft.departmentId}
                  displayName={draft.departmentName}
                  onChange={(id, opt) =>
                    setDraft({ ...draft, departmentId: id, departmentName: opt?.name || "" })
                  }
                  onSearch={(q) => searchDepartments(q, draft.branchId || undefined)}
                  placeholder="Search departments…"
                  disabled={!draft.branchId}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start Date" required>
                <AppDatePicker
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="End Date" required>
                <AppDatePicker
                  value={draft.endDate}
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Start Time" required>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="End Time" required>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Location">
                <input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={selectCls}
                >
                  {TRAINING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Max Participants">
                <input
                  type="number"
                  min={0}
                  value={draft.maxParticipants}
                  onChange={(e) => setDraft({ ...draft, maxParticipants: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Cost">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.cost}
                  onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="training"
          name={deleteTarget.title}
          onConfirm={() => void confirmDeleteTraining()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default TrainingList;
