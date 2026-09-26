/**
 * Custom Questions — /api/v1/recruitment/custom-questions
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchCustomQuestions,
  createCustomQuestion,
  updateCustomQuestion,
  deleteCustomQuestion,
  QUESTION_TYPES,
  ACTIVE_INACTIVE,
  boolFilterValue,
  statusLabel,
  type CustomQuestionRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const needsOptions = (t: string) => ["select", "radio", "checkbox"].includes(t);

const emptyDraft = () => ({
  id: "",
  question: "",
  type: "text",
  optionsText: "",
  isRequired: false,
  isActive: true,
  sortOrder: "",
});

export const CustomQuestions: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<CustomQuestionRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-custom-questions", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchCustomQuestions({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("question", sortAsc ? "Ascending" : "Descending"),
        is_active: boolFilterValue(statusFilter),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-custom-questions"] });

  const submit = async () => {
    if (!draft.question.trim()) {
      showToast("Question is required", "error");
      return;
    }
    const options = needsOptions(draft.type)
      ? draft.optionsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const body = {
      question: draft.question.trim(),
      type: draft.type,
      options,
      is_required: draft.isRequired,
      is_active: draft.isActive,
      sort_order: draft.sortOrder === "" ? undefined : Number(draft.sortOrder),
    };
    try {
      if (modal === "edit") {
        await updateCustomQuestion(draft.id, body);
        showToast("Question updated", "success");
      } else {
        await createCustomQuestion(body);
        showToast("Question created", "success");
      }
      await invalidate();
      setModal(null);
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCustomQuestion(deleteTarget.id);
      showToast("Question deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Recruitment"
        current="Custom Questions"
        title="Manage Custom Questions"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search questions…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...ACTIVE_INACTIVE]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[900px]">
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
                  Question <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Type", "Required", "Status", "Order", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900 max-w-[320px] truncate">{r.question}</td>
                <td className="px-4 py-3.5 text-gray-600 capitalize">{r.type}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.isRequired ? "Yes" : "No"}</td>
                <td className="px-4 py-3.5">
                  {chip(statusLabel(r.isActive), STATUS_CHIP[statusLabel(r.isActive)] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.sortOrder ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          question: r.question,
                          type: r.type,
                          optionsText: r.options.join(", "),
                          isRequired: r.isRequired,
                          isActive: r.isActive,
                          sortOrder: r.sortOrder == null ? "" : String(r.sortOrder),
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No custom questions found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Question" : "Create Question"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Question" required>
              <input
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Type" required>
                <select
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className={selectCls}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            {needsOptions(draft.type) && (
              <Field label="Options" hint="Comma-separated">
                <input
                  value={draft.optionsText}
                  onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })}
                  className={inputCls}
                  placeholder="Option A, Option B"
                />
              </Field>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Required">
                <select
                  value={draft.isRequired ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, isRequired: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={draft.isActive ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="custom question"
          name={deleteTarget.question}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default CustomQuestions;
