/**
 * Trainers — /api/v1/training/trainers
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchTrainers,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  searchBranches,
  searchDepartments,
  type TrainerRow,
} from "@/services/training";
import { Field, inputCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  name: "",
  contact: "",
  email: "",
  experience: "",
  expertise: "",
  qualification: "",
  branchId: "",
  branchName: "",
  departmentId: "",
  departmentName: "",
});

const Trainers: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<TrainerRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["trainers", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchTrainers({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["trainers"] });

  const submit = async () => {
    if (
      !draft.name.trim() ||
      !draft.contact.trim() ||
      !draft.email.trim() ||
      !draft.experience.trim() ||
      !draft.branchId ||
      !draft.departmentId
    ) {
      showToast("Name, contact, email, experience, branch and department are required", "error");
      return;
    }
    const body = {
      name: draft.name.trim(),
      contact: draft.contact.trim(),
      email: draft.email.trim(),
      experience: draft.experience.trim(),
      branch_id: draft.branchId,
      department_id: draft.departmentId,
      expertise: draft.expertise.trim() || undefined,
      qualification: draft.qualification.trim() || undefined,
    };
    try {
      if (modal === "edit") {
        await updateTrainer(draft.id, body);
        showToast("Trainer updated", "success");
      } else {
        await createTrainer(body);
        showToast("Trainer created", "success");
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
      await deleteTrainer(deleteTarget.id);
      showToast("Trainer deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Training"
        current="Trainers"
        title="Manage Trainers"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search trainers…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
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
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Contact", "Email", "Experience", "Branch", "Department", "Actions"].map((h) => (
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
                  <div className="font-medium text-gray-900">{r.name}</div>
                  {(r.expertise || r.qualification) && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                      {[r.expertise, r.qualification].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.contact || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.email || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.experience || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.branchName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.departmentName || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          name: r.name,
                          contact: r.contact,
                          email: r.email,
                          experience: r.experience,
                          expertise: r.expertise,
                          qualification: r.qualification,
                          branchId: r.branchId,
                          branchName: r.branchName,
                          departmentId: r.departmentId,
                          departmentName: r.departmentName,
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
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No trainers found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell
          title={modal === "edit" ? "Edit Trainer" : "Create Trainer"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Trainer name"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact" required>
                <input
                  value={draft.contact}
                  onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                  placeholder="Phone"
                  className={inputCls}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="Email"
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Experience" required>
              <input
                value={draft.experience}
                onChange={(e) => setDraft({ ...draft, experience: e.target.value })}
                placeholder="e.g. 5 years"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Expertise">
                <input
                  value={draft.expertise}
                  onChange={(e) => setDraft({ ...draft, expertise: e.target.value })}
                  placeholder="Optional"
                  className={inputCls}
                />
              </Field>
              <Field label="Qualification">
                <input
                  value={draft.qualification}
                  onChange={(e) => setDraft({ ...draft, qualification: e.target.value })}
                  placeholder="Optional"
                  className={inputCls}
                />
              </Field>
            </div>
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
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="trainer"
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default Trainers;
