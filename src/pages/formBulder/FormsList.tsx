/**
 * Forms list — /api/v1/form-builder/forms/all
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchForms,
  deleteForm,
  formShareUrl,
  type FormRow,
} from "@/services/formBuilderApi";
import { ListShell, DeleteConfirm, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Copy, Edit, Eye, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";

const FormsList: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FormRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["form-builder-forms", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchForms({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        is_active:
          statusFilter === "Active" ? true : statusFilter === "Inactive" ? false : undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const copyLink = async (row: FormRow) => {
    try {
      await navigator.clipboard.writeText(formShareUrl(row.code));
      showToast("Share link copied", "success");
    } catch {
      showToast("Could not copy link", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteForm(deleteTarget.id);
      showToast("Form deleted", "success");
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
        current="Forms"
        title="Manage Forms"
        onCreate={() => navigate("/form-builder/create")}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search forms…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={["Active", "Inactive"]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
        filterLabel="Status"
      >
        <table className="w-full text-sm min-w-[1000px]">
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
                  title="Sort A–Z / Z–A"
                >
                  Name (A–Z) <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Fields", "Responses", "Status", "Created", "Actions"].map((h) => (
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
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    <span className="truncate max-w-[220px]">{formShareUrl(r.code)}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.fieldCount}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.responseCount}</td>
                <td className="px-4 py-3.5">
                  {chip(
                    r.isActive ? "Active" : "Inactive",
                    STATUS_CHIP[r.isActive ? "Active" : "Inactive"] || STATUS_CHIP.Active,
                  )}
                </td>
                <td className="px-4 py-3.5 text-gray-600">{r.createdAt || "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Open share form"
                      onClick={() => window.open(formShareUrl(r.code), "_blank", "noopener,noreferrer")}
                      className="p-1.5 text-gray-400 hover:text-violet-600 rounded hover:bg-violet-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="View responses"
                      onClick={() => navigate(`/form-builder/${r.id}/responses`)}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Copy share link"
                      onClick={() => void copyLink(r)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => navigate(`/form-builder/${r.id}/edit`)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
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
                  <div className="space-y-3">
                    <p>No forms yet.</p>
                    <button
                      type="button"
                      onClick={() => navigate("/form-builder/create")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md"
                    >
                      <Plus className="w-4 h-4" /> Create form
                    </button>
                  </div>
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

      {deleteTarget && (
        <DeleteConfirm
          what="form"
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default FormsList;
