/**
 * File: src/pages/superadmin/SuperAdminCompanies.tsx
 * Superadmin landing page — list every company account and block/unblock it.
 * v1 is intentionally minimal: built only from existing backend endpoints
 * (`GET /user/all-user`, `POST /user/block-user`), no new backend routes.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import {
  fetchCompanies,
  toggleCompanyBlock,
  type TSuperAdminCompanyRow,
} from "@/services/superAdminApi";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { alertApiError, alertToast } from "@/utils/alert";
import Swal from "@/utils/alert";

export const SuperAdminCompanies: React.FC = () => {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["superadmin", "companies", page],
    queryFn: () => fetchCompanies({ page, limit: LIST_PAGE_SIZE }),
  });

  const rows: TSuperAdminCompanyRow[] = data?.rows ?? [];

  const handleToggle = async (row: TSuperAdminCompanyRow) => {
    const blocking = row.status !== "blocked";
    const result = await Swal.fire({
      icon: "warning",
      title: blocking ? "Block this company?" : "Unblock this company?",
      html: blocking
        ? `<b>${row.name || row.email}</b> will not be able to log in until unblocked.`
        : `<b>${row.name || row.email}</b> will be able to log in again.`,
      showCancelButton: true,
      confirmButtonText: blocking ? "Yes, block" : "Yes, unblock",
      cancelButtonText: "Cancel",
      confirmButtonColor: blocking ? "#dc2626" : "#2563eb",
    });
    if (!result.isConfirmed) return;

    setBusyId(row._id);
    try {
      await toggleCompanyBlock(row._id);
      alertToast(
        blocking ? "Company blocked." : "Company unblocked.",
        "success",
      );
      await queryClient.invalidateQueries({ queryKey: ["superadmin", "companies"] });
    } catch (err) {
      alertApiError(err, "Couldn't update this company's status.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Companies</h1>
        <p className="text-sm text-gray-500">
          Every registered company account. Block a company to prevent its users from logging in.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-500">Loading companies…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No companies found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 sticky top-0">
              <tr>
                <th className="px-5 py-2.5 font-medium">Company</th>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const blocked = row.status === "blocked";
                return (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{row.name || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{row.email || "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          blocked
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        disabled={busyId === row._id}
                        onClick={() => void handleToggle(row)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-50 ${
                          blocked
                            ? "border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                            : "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                        }`}
                      >
                        {blocked ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldOff className="w-3.5 h-3.5" />
                        )}
                        {blocked ? "Unblock" : "Block"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ListSidebarFooter
        total={isFetching ? "…" : `${data?.pagination.totalData ?? 0}`}
        countLabel="Companies"
        pagination={data?.pagination}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
};

export default SuperAdminCompanies;
