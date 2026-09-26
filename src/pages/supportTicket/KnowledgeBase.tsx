/**
 * Knowledge Base — /api/v1/support/knowledge
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchKnowledgeArticles,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  deleteKnowledgeArticle,
  searchKnowledgeCategories,
  type KnowledgeRow,
} from "@/services/supportApi";
import { Field, inputCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({ id: "", title: "", description: "", categoryId: "", categoryName: "" });

const KnowledgeBase: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["support-knowledge", page, perPage, search, sortAsc],
    queryFn: () =>
      fetchKnowledgeArticles({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("title", sortAsc ? "Ascending" : "Descending"),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["support-knowledge"] });

  const submit = async () => {
    if (!draft.title.trim()) {
      showToast("Title is required", "error");
      return;
    }
    const body = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      category: draft.categoryId || undefined,
    };
    try {
      if (modal === "edit") {
        await updateKnowledgeArticle(draft.id, body);
        showToast("Article updated", "success");
      } else {
        await createKnowledgeArticle(body);
        showToast("Article created", "success");
      }
      setModal(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed to save", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteKnowledgeArticle(deleteTarget.id);
      showToast("Article deleted", "success");
      setDeleteTarget(null);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Support Ticket"
        current="Knowledge Base"
        title="Knowledge Base"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search articles…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Title <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Category", "Created", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5">
                  <div className="font-medium text-gray-900">{r.title}</div>
                  {r.description && <div className="text-xs text-gray-500 truncate max-w-md">{r.description}</div>}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.categoryName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.createdAt || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          title: r.title,
                          description: r.description,
                          categoryId: r.categoryId,
                          categoryName: r.categoryName,
                        });
                        setModal("edit");
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">No articles found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title={modal === "edit" ? "Edit Article" : "Create Article"} onClose={() => setModal(null)} onSubmit={submit} submitLabel={modal === "edit" ? "Update" : "Create"} wide>
          <div className="space-y-4">
            <Field label="Title" required>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Category">
              <AsyncSearchSelect
                value={draft.categoryId}
                displayName={draft.categoryName}
                onChange={(id, opt) => setDraft({ ...draft, categoryId: id, categoryName: opt?.name || "" })}
                onSearch={searchKnowledgeCategories}
                placeholder="Search categories…"
              />
            </Field>
            <Field label="Content">
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={8} className={inputCls} />
            </Field>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="article" name={deleteTarget.title} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};

export default KnowledgeBase;
