/**
 * Bank Transactions — /api/v1/account/bank-transactions
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchBankTransactions,
  markBankTxnReconciled,
  searchBankAccounts,
  type BankTxnRow,
} from "@/services/accountingApi";
import { AsyncSearchSelect } from "../../hrm/hrmShared";
import { ListShell, chip } from "../../goal/goalShared";
import { CheckCircle2 } from "lucide-react";

export const BankTransactions: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [bankId, setBankId] = useState("");
  const [bankName, setBankName] = useState("");
  const [reconFilter, setReconFilter] = useState("All");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["bank-transactions", page, perPage, search, bankId, reconFilter],
    queryFn: () =>
      fetchBankTransactions({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("transaction_date", "Descending"),
        bank_account_id: bankId || undefined,
        reconciliation_status:
          reconFilter === "Reconciled" ? "reconciled" : reconFilter === "Open" ? "unreconciled" : undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;

  const mark = async (t: BankTxnRow) => {
    try {
      await markBankTxnReconciled(t.id);
      showToast("Marked reconciled", "success");
      qc.invalidateQueries({ queryKey: ["bank-transactions"] });
    } catch (e: any) {
      showToast(e?.message || "Failed", "error");
    }
  };

  return (
    <ListShell
      module="Accounting"
      current="Bank Transaction"
      title="Bank Transactions"
      search={searchInput}
      setSearch={setSearchInput}
      searchPlaceholder="Search transactions…"
      perPage={perPage}
      setPerPage={setPerPage}
      page={page}
      setPage={setPage}
      total={total}
      filterOptions={["Reconciled", "Open"]}
      filterValue={reconFilter}
      setFilterValue={(v) => {
        setReconFilter(v);
        setPage(1);
      }}
      filterLabel="Status"
    >
      <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-white">
        <div className="max-w-sm">
          <AsyncSearchSelect
            value={bankId}
            displayName={bankName}
            onChange={(id, opt) => {
              setBankId(id);
              setBankName(opt?.name || "");
              setPage(1);
            }}
            onSearch={searchBankAccounts}
            placeholder="Filter by bank account…"
          />
        </div>
      </div>
      <table className="w-full text-sm min-w-[950px]">
        <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
          <tr>
            {["Date", "Bank Account", "Type", "Amount", "Reference", "Description", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="px-4 py-3.5 text-gray-600">{r.date || "—"}</td>
              <td className="px-4 py-3.5 text-gray-900">{r.bankAccountName || "—"}</td>
              <td className="px-4 py-3.5 text-gray-600 capitalize">{r.type || "—"}</td>
              <td className="px-4 py-3.5 text-gray-900">{money(r.amount)}</td>
              <td className="px-4 py-3.5 text-gray-600">{r.reference || "—"}</td>
              <td className="px-4 py-3.5 text-gray-600 max-w-[220px] truncate">{r.description || "—"}</td>
              <td className="px-4 py-3.5">
                {chip(
                  r.reconciled ? "Reconciled" : "Open",
                  r.reconciled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                )}
              </td>
              <td className="px-4 py-3.5">
                {!r.reconciled && (
                  <button
                    type="button"
                    onClick={() => void mark(r)}
                    className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                    title="Mark reconciled"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                No transactions found.
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
  );
};
