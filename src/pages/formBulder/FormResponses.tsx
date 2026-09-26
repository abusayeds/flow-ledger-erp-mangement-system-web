/**
 * Form responses list + view modal
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchForm,
  fetchFormResponses,
  deleteFormResponse,
  formShareUrl,
  type FormResponseRow,
} from "@/services/formBuilderApi";
import { ListShell, DeleteConfirm, ModalShell } from "../goal/goalShared";
import { ArrowUpDown, Copy, Eye, Trash2 } from "lucide-react";

const FormResponses: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(false);
  const [viewRow, setViewRow] = useState<FormResponseRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormResponseRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const formQ = useQuery({
    queryKey: ["form-builder-form", id],
    queryFn: () => fetchForm(id),
    enabled: Boolean(id),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["form-builder-responses", id, page, perPage, sortAsc],
    queryFn: () =>
      fetchFormResponses(id, {
        page,
        limit: perPage,
        sort: buildListSortParam("createdAt", sortAsc ? "Ascending" : "Descending"),
      }),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
  });

  const form = formQ.data;
  const fieldMap = useMemo(() => {
    const m = new Map<string, string>();
    (form?.fields || []).forEach((f) => {
      if (f._id) m.set(f._id, f.label);
    });
    return m;
  }, [form]);

  const allRows = data?.rows ?? [];
  const rows = useMemo(() => {
    if (!search) return allRows;
    const q = search.toLowerCase();
    return allRows.filter((r) =>
      Object.values(r.responseData)
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [allRows, search]);

  const total = data?.pagination?.totalData ?? 0;

  const previewText = (r: FormResponseRow) => {
    const vals = Object.values(r.responseData)
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    return vals.slice(0, 2).join(" · ") || "—";
  };

  const copyLink = async () => {
    if (!form?.code) return;
    try {
      await navigator.clipboard.writeText(formShareUrl(form.code));
      showToast("Share link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFormResponse(id, deleteTarget.id);
      showToast("Response deleted", "success");
      await qc.invalidateQueries({ queryKey: ["form-builder-responses", id] });
      await qc.invalidateQueries({ queryKey: ["form-builder-forms"] });
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Form Builder"
        current={form?.name || "Responses"}
        title={form ? `Responses · ${form.name}` : "Form Responses"}
        onCreate={() => navigate("/form-builder/create")}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Filter responses on this page…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-white">
          <button
            type="button"
            onClick={() => navigate("/form-builder")}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to forms
          </button>
          {form?.code && (
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <Copy className="w-3.5 h-3.5" /> Copy share link
            </button>
          )}
          {form && (
            <button
              type="button"
              onClick={() => navigate(`/form-builder/${form.id}/edit`)}
              className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Edit form
            </button>
          )}
        </div>

        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Preview</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setSortAsc(!sortAsc);
                    setPage(1);
                  }}
                  className="flex items-center gap-1 hover:text-gray-900"
                >
                  Submitted <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 text-gray-500">{(page - 1) * perPage + i + 1}</td>
                <td className="px-4 py-3.5 text-gray-900 max-w-[420px] truncate">{previewText(r)}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.createdAt || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewRow(r)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
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
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  No responses yet. Share the form link to collect submissions.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {viewRow && (
        <ModalShell
          title="Response details"
          onClose={() => setViewRow(null)}
          onSubmit={() => setViewRow(null)}
          submitLabel="Close"
          wide
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Submitted: {viewRow.createdAt || "—"}</p>
            {Object.keys(viewRow.responseData).length === 0 ? (
              <p className="text-sm text-gray-500">Empty response</p>
            ) : (
              Object.entries(viewRow.responseData).map(([fieldId, value]) => (
                <div key={fieldId} className="border border-gray-100 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">
                    {fieldMap.get(fieldId) || fieldId}
                  </div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                    {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                  </div>
                </div>
              ))
            )}
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="response"
          name={previewText(deleteTarget)}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default FormResponses;
