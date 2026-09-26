/**
 * Vendor Payments — /api/v1/account/vendor-payments
 */
import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../utils/toast";
import { money } from "@/lib/db";
import { buildListSortParam } from "@/lib/listSort";
import {
  fetchVendorPayments,
  fetchVendorOutstanding,
  createVendorPayment,
  updateVendorPaymentStatus,
  deleteVendorPayment,
  searchVendors,
  searchBankAccounts,
  PAYMENT_STATUSES,
  type VendorPaymentRow,
} from "@/services/accountingApi";
import { Field, inputCls, AsyncSearchSelect } from "../hrm/hrmShared";
import { ListShell, DeleteConfirm, ModalShell, chip } from "../goal/goalShared";
import { ArrowUpDown, Trash2, CheckCircle2 } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

const STATUS_CHIP: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Cleared: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-600",
};

type Alloc = { invoiceId: string; invoiceNumber: string; outstanding: number; allocated: number };

export const VendorPayments: React.FC = () => {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VendorPaymentRow | null>(null);
  const [draft, setDraft] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    vendor_id: "",
    vendor_name: "",
    bank_account_id: "",
    bank_account_name: "",
    reference_number: "",
    payment_amount: "" as string | number,
    notes: "",
  });
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-payments", page, perPage, search, sortAsc, statusFilter],
    queryFn: () =>
      fetchVendorPayments({
        page,
        limit: perPage,
        searchTerm: search || undefined,
        sort: buildListSortParam("payment_date", sortAsc ? "Ascending" : "Descending"),
        status: statusFilter === "All" ? undefined : statusFilter,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.pagination?.totalData ?? 0;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["vendor-payments"] });

  const onVendor = async (id: string, name: string) => {
    setDraft((d) => ({ ...d, vendor_id: id, vendor_name: name }));
    setAllocs([]);
    if (!id) return;
    setLoadingOutstanding(true);
    try {
      const list = await fetchVendorOutstanding(id);
      setAllocs(list.map((o: { invoiceId: string; invoiceNumber: string; outstanding: number }) => ({ ...o, allocated: 0 })));
    } catch (e: any) {
      showToast(e?.message || "Could not load outstanding bills", "error");
    } finally {
      setLoadingOutstanding(false);
    }
  };

  const submit = async () => {
    if (!draft.vendor_id || !draft.bank_account_id) {
      showToast("Vendor and bank account are required", "error");
      return;
    }
    const amount = Number(draft.payment_amount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid payment amount", "error");
      return;
    }
    const used = allocs.filter((a) => a.allocated > 0);
    try {
      await createVendorPayment({
        payment_date: draft.payment_date,
        vendor_id: draft.vendor_id,
        bank_account_id: draft.bank_account_id,
        reference_number: draft.reference_number.trim() || undefined,
        payment_amount: amount,
        notes: draft.notes.trim() || undefined,
        allocations: used.map((a) => ({ invoice_id: a.invoiceId, allocated_amount: a.allocated })),
        debit_notes: [],
      });
      showToast("Payment created", "success");
      setModal(false);
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed to create payment", "error");
    }
  };

  const markCleared = async (p: VendorPaymentRow) => {
    try {
      await updateVendorPaymentStatus(p.id, "cleared");
      showToast("Marked cleared", "success");
      await invalidate();
    } catch (e: any) {
      showToast(e?.message || "Failed", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteVendorPayment(deleteTarget.id);
      showToast("Payment deleted", "success");
      await invalidate();
      setDeleteTarget(null);
    } catch (e: any) {
      showToast(e?.message || "Delete failed", "error");
    }
  };

  return (
    <>
      <ListShell
        module="Accounting"
        current="Vendor Payments"
        title="Vendor Payments"
        onCreate={() => {
          setDraft({
            payment_date: new Date().toISOString().slice(0, 10),
            vendor_id: "",
            vendor_name: "",
            bank_account_id: "",
            bank_account_name: "",
            reference_number: "",
            payment_amount: "",
            notes: "",
          });
          setAllocs([]);
          setModal(true);
        }}
        search={searchInput}
        setSearch={setSearchInput}
        searchPlaceholder="Search payments…"
        perPage={perPage}
        setPerPage={setPerPage}
        page={page}
        setPage={setPage}
        total={total}
        filterOptions={[...PAYMENT_STATUSES]}
        filterValue={statusFilter}
        setFilterValue={setStatusFilter}
      >
        <table className="w-full text-sm min-w-[950px]">
          <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                <button type="button" onClick={() => { setSortAsc(!sortAsc); setPage(1); }} className="flex items-center gap-1 hover:text-gray-900">
                  Date <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {["Number", "Vendor", "Amount", "Bank", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3.5 text-gray-600">{r.date}</td>
                <td className="px-4 py-3.5 font-medium text-gray-900">{r.number || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{r.vendorName || "—"}</td>
                <td className="px-4 py-3.5 text-gray-900">{money(r.amount)}</td>
                <td className="px-4 py-3.5 text-gray-600">{r.bankAccountName || "—"}</td>
                <td className="px-4 py-3.5">{chip(r.status, STATUS_CHIP[r.status] || STATUS_CHIP.Pending)}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {r.status === "Pending" && (
                      <button type="button" onClick={() => void markCleared(r)} className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50" title="Mark cleared">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No payments found.</td></tr>
            )}
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </ListShell>

      {modal && (
        <ModalShell title="Create Vendor Payment" onClose={() => setModal(false)} onSubmit={submit} submitLabel="Create" wide>
          <div className="space-y-4">
            <Field label="Payment Date" required>
              <AppDatePicker value={draft.payment_date} onChange={(e) => setDraft({ ...draft, payment_date: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Vendor" required>
              <AsyncSearchSelect value={draft.vendor_id} displayName={draft.vendor_name} onChange={(id, opt) => void onVendor(id, opt?.name || "")} onSearch={searchVendors} placeholder="Search vendors…" />
            </Field>
            <Field label="Bank Account" required>
              <AsyncSearchSelect value={draft.bank_account_id} displayName={draft.bank_account_name} onChange={(id, opt) => setDraft({ ...draft, bank_account_id: id, bank_account_name: opt?.name || "" })} onSearch={searchBankAccounts} placeholder="Search bank accounts…" />
            </Field>
            <Field label="Amount" required>
              <input type="number" min={0.01} step="0.01" value={draft.payment_amount} onChange={(e) => setDraft({ ...draft, payment_amount: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Reference">
              <input value={draft.reference_number} onChange={(e) => setDraft({ ...draft, reference_number: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Notes">
              <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className={inputCls} />
            </Field>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Bill allocations</p>
              {loadingOutstanding && <p className="text-sm text-gray-500">Loading outstanding…</p>}
              {!loadingOutstanding && allocs.length === 0 && <p className="text-sm text-gray-500">Select a vendor to load bills.</p>}
              {allocs.length > 0 && (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-gray-600">Bill</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-600">Outstanding</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-600">Allocate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allocs.map((a) => (
                        <tr key={a.invoiceId}>
                          <td className="px-3 py-2">{a.invoiceNumber}</td>
                          <td className="px-3 py-2">{money(a.outstanding)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={a.outstanding}
                              step="0.01"
                              value={a.allocated || ""}
                              onChange={(e) =>
                                setAllocs((prev) =>
                                  prev.map((x) => (x.invoiceId === a.invoiceId ? { ...x, allocated: Number(e.target.value) || 0 } : x)),
                                )
                              }
                              className={inputCls}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {deleteTarget && (
        <DeleteConfirm what="payment" name={deleteTarget.number || deleteTarget.vendorName} onConfirm={() => void confirmDelete()} onCancel={() => setDeleteTarget(null)} />
      )}
    </>
  );
};
