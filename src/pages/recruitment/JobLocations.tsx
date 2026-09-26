/**
 * Job Locations — /api/v1/recruitment/job-locations
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchJobLocations,
  createJobLocation,
  updateJobLocation,
  deleteJobLocation,
  ACTIVE_INACTIVE,
  boolFilterValue,
  statusLabel,
  type JobLocationRow,
} from "@/services/recruitmentApi";
import { Field, inputCls, selectCls } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip, STATUS_CHIP } from "../goal/goalShared";
import { ArrowUpDown, Edit, Trash2 } from "lucide-react";

const emptyDraft = () => ({
  id: "",
  name: "",
  remoteWork: false,
  address: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  status: true,
});

export const JobLocations: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<JobLocationRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["recruitment-job-locations", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchJobLocations({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("name", sortAsc ? "Ascending" : "Descending"),
        status: boolFilterValue(statusFilter),
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["recruitment-job-locations"] });

  const submit = async () => {
    if (!draft.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    const body = {
      name: draft.name.trim(),
      remote_work: draft.remoteWork,
      address: draft.address.trim() || undefined,
      city: draft.city.trim() || undefined,
      state: draft.state.trim() || undefined,
      country: draft.country.trim() || undefined,
      postal_code: draft.postalCode.trim() || undefined,
      status: draft.status,
    };
    try {
      if (modal === "edit") {
        await updateJobLocation(draft.id, body);
        showToast("Job location updated", "success");
      } else {
        await createJobLocation(body);
        showToast("Job location created", "success");
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
      await deleteJobLocation(deleteTarget.id);
      showToast("Job location deleted", "success");
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
        current="Job Locations"
        title="Manage Job Locations"
        onCreate={() => {
          setDraft(emptyDraft());
          setModal("create");
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search locations…"
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
                >
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Type", "City", "Country", "Address", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.remoteWork ? "Remote" : "On-site"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.city || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.country || "—"}</td>
                <td className="px-4 py-3.5 text-gray-600 max-w-[200px] truncate">{r.address || "—"}</td>
                <td className="px-4 py-3.5">
                  {chip(statusLabel(r.status), STATUS_CHIP[statusLabel(r.status)] || STATUS_CHIP.Active)}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: r.id,
                          name: r.name,
                          remoteWork: r.remoteWork,
                          address: r.address,
                          city: r.city,
                          state: r.state,
                          country: r.country,
                          postalCode: r.postalCode,
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
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No job locations found.
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
          title={modal === "edit" ? "Edit Job Location" : "Create Job Location"}
          onClose={() => setModal(null)}
          onSubmit={submit}
          submitLabel={modal === "edit" ? "Update" : "Create"}
        >
          <div className="space-y-4">
            <Field label="Name" required>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputCls}
                placeholder="Location name"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Remote work">
                <select
                  value={draft.remoteWork ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, remoteWork: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="false">On-site</option>
                  <option value="true">Remote</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={draft.status ? "true" : "false"}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value === "true" })}
                  className={selectCls}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
            <Field label="Address">
              <input
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="City">
                <input
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <input
                  value={draft.state}
                  onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Country">
                <input
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Postal code">
                <input
                  value={draft.postalCode}
                  onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm
          what="job location"
          name={deleteTarget.name}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
};

export default JobLocations;
