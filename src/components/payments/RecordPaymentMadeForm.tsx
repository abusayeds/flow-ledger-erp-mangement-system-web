/**
 * Record Payment Made — full panel (same layout as Payment Received).
 * Vendor + Bill are searchable; prefills when opened from a bill.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { fetchVendors, type VendorListRow } from "@/services/vendorsApi";
import { fetchBills, updateBill, type BillListRow } from "@/services/billsApi";
import { createVendorPayment } from "@/services/vendorPaymentsApi";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { showToast } from "@/utils/toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

export type PaymentMadePrefillBill = {
  _id: string;
  number: string;
  dueAmount: number;
  currency: string;
  vendorId?: string;
  amount?: number;
  paidAmount?: number;
};

export type PaymentMadePrefill = {
  vendorId?: string;
  vendorName?: string;
  billId?: string;
  billNumber?: string;
  dueAmount?: number;
  bills?: PaymentMadePrefillBill[];
};

type SelectedBill = {
  _id: string;
  number: string;
  dueAmount: number;
  currency: string;
  vendorId?: string;
  vendorName?: string;
  amount: number;
  paidAmount: number;
};

type Props = {
  onClose: () => void;
  onSaved: (id: string) => void;
  prefill?: PaymentMadePrefill;
  /** When true, drop page margins so the form fits a centered modal shell. */
  asModal?: boolean;
};

const fieldClass =
  "w-full mt-1 px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";

const todayInput = () => new Date().toISOString().slice(0, 10);

const money = (n: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const billLabel = (number: string) => (number.startsWith("#") ? number : `#${number}`);

const initSelectedFromPrefill = (prefill?: PaymentMadePrefill): SelectedBill[] => {
  if (prefill?.bills?.length) {
    return prefill.bills.map((b) => ({
      _id: b._id,
      number: b.number,
      dueAmount: b.dueAmount,
      currency: b.currency || "USD",
      vendorId: b.vendorId ?? prefill.vendorId,
      amount: b.amount ?? b.dueAmount + (b.paidAmount ?? 0),
      paidAmount: b.paidAmount ?? 0,
    }));
  }
  if (prefill?.billId) {
    return [
      {
        _id: prefill.billId,
        number: prefill.billNumber ?? "",
        dueAmount: prefill.dueAmount ?? 0,
        currency: "USD",
        vendorId: prefill.vendorId,
        vendorName: prefill.vendorName,
        amount: prefill.dueAmount ?? 0,
        paidAmount: 0,
      },
    ];
  }
  return [];
};

const initLineAmounts = (bills: SelectedBill[]): Record<string, string> => {
  const next: Record<string, string> = {};
  for (const bill of bills) {
    next[bill._id] = bill.dueAmount > 0 ? bill.dueAmount.toFixed(2) : "0.00";
  }
  return next;
};

export const RecordPaymentMadeForm: React.FC<Props> = ({ onClose, onSaved, prefill, asModal = false }) => {
  const [vendorId, setVendorId] = useState(prefill?.vendorId ?? "");
  const [vendorQuery, setVendorQuery] = useState(prefill?.vendorName ?? "");
  const [vendorOpen, setVendorOpen] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);

  const [selectedBills, setSelectedBills] = useState<SelectedBill[]>(() => initSelectedFromPrefill(prefill));
  const [billQuery, setBillQuery] = useState("");
  const [billOpen, setBillOpen] = useState(false);
  const billRef = useRef<HTMLDivElement>(null);
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>(() =>
    initLineAmounts(initSelectedFromPrefill(prefill)),
  );

  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayInput());
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attachment, setAttachment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(e.target as Node)) setVendorOpen(false);
      if (billRef.current && !billRef.current.contains(e.target as Node)) setBillOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const { data: methodsData } = useQuery({
    queryKey: ["payment-methods-options"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });
  const methods = useMemo(() => {
    const names = (methodsData ?? []).map((m) => m.name).filter(Boolean);
    return names.length ? names : ["Cash", "Bank Transfer", "Cheque", "PayPal", "Stripe"];
  }, [methodsData]);

  useEffect(() => {
    if (!methods.includes(method)) setMethod(methods[0] || "Cash");
  }, [methods, method]);

  const { data: vendorsData } = useQuery({
    queryKey: ["payment-made-vendor-search", vendorQuery],
    queryFn: () => fetchVendors({ page: 1, limit: 30, searchTerm: vendorQuery.trim() || undefined }),
    staleTime: 10_000,
  });
  const vendorOptions: VendorListRow[] = vendorsData?.rows ?? [];

  const { data: billsData } = useQuery({
    queryKey: ["payment-made-bill-search", vendorId, billQuery],
    queryFn: () =>
      fetchBills({
        page: 1,
        limit: 50,
        vendor_id: vendorId || undefined,
        searchTerm: billQuery.trim() || undefined,
        sort: "-createdAt",
      }),
    staleTime: 10_000,
  });

  const billOptions = useMemo(() => {
    const rows = billsData?.rows ?? [];
    const q = billQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (b) => b.number.toLowerCase().includes(q) || b.vendorName.toLowerCase().includes(q),
    );
  }, [billsData?.rows, billQuery]);

  const selectedIdSet = useMemo(() => new Set(selectedBills.map((b) => b._id)), [selectedBills]);

  const totalLineAmount = useMemo(
    () => selectedBills.reduce((sum, b) => sum + Math.max(0, Number(lineAmounts[b._id]) || 0), 0),
    [lineAmounts, selectedBills],
  );

  const outstandingTotal = useMemo(
    () => selectedBills.reduce((sum, b) => sum + Math.max(0, b.dueAmount), 0),
    [selectedBills],
  );

  useEffect(() => {
    setLineAmounts((prev) => {
      const next: Record<string, string> = {};
      for (const bill of selectedBills) {
        next[bill._id] =
          prev[bill._id] ?? (bill.dueAmount > 0 ? bill.dueAmount.toFixed(2) : "0.00");
      }
      return next;
    });
  }, [selectedBills]);

  const pickVendor = (v: VendorListRow) => {
    setVendorId(v._id);
    setVendorQuery(v.name);
    setVendorOpen(false);
    const mismatch = selectedBills.some((b) => b.vendorId && b.vendorId !== v._id);
    if (mismatch) {
      setSelectedBills([]);
      setLineAmounts({});
    }
  };

  const toggleBill = (b: BillListRow) => {
    setSelectedBills((prev) => {
      const exists = prev.some((item) => item._id === b._id);
      if (exists) return prev.filter((item) => item._id !== b._id);
      return [
        ...prev,
        {
          _id: b._id,
          number: b.number,
          dueAmount: b.dueAmount,
          currency: b.currency,
          vendorId: b.vendorId,
          vendorName: b.vendorName,
          amount: b.amount,
          paidAmount: b.paidAmount,
        },
      ];
    });
    if (b.vendorId && b.vendorId !== vendorId) {
      setVendorId(b.vendorId);
      setVendorQuery(b.vendorName);
    }
  };

  const save = async () => {
    if (!vendorId) {
      showToast("Select a vendor", "warning");
      return;
    }
    if (selectedBills.length === 0) {
      showToast("Select a bill", "warning");
      return;
    }

    const vendorKeys = [...new Set(selectedBills.map((b) => b.vendorId).filter(Boolean) as string[])];
    if (vendorKeys.length > 1) {
      showToast("Selected bills must belong to the same vendor", "warning");
      return;
    }
    if (vendorKeys.length === 1 && vendorKeys[0] !== vendorId) {
      showToast("Selected bills must match the chosen vendor", "warning");
      return;
    }

    const allocations = selectedBills
      .map((bill) => ({
        bill,
        parsedAmount: Math.max(0, Number(lineAmounts[bill._id]) || 0),
      }))
      .filter(({ parsedAmount }) => parsedAmount > 0);

    if (allocations.length === 0) {
      showToast("Enter a valid amount", "warning");
      return;
    }

    setSaving(true);
    try {
      const serial = `PM-${Date.now().toString().slice(-8)}`;
      const paymentTotal = allocations.reduce((sum, item) => sum + item.parsedAmount, 0);

      const created = await createVendorPayment({
        vendor_id: vendorId,
        payment_amount: paymentTotal,
        payment_date: date,
        payment_method: [method],
        notes: notes || undefined,
        reference_number: serial,
        attachment: attachment || undefined,
        attachments: attachment || undefined,
        allocations: allocations.map(({ bill, parsedAmount }) => ({
          invoice_id: bill._id,
          allocated_amount: parsedAmount,
        })),
      });

      await Promise.all(
        allocations.map(async ({ bill, parsedAmount }) => {
          const paid = bill.paidAmount + parsedAmount;
          const due = Math.max(0, bill.amount - paid);
          await updateBill(bill._id, {
            paid_amount: +paid.toFixed(2),
            balance_amount: +due.toFixed(2),
            status: due <= 0 ? "Paid" : "Partial",
          });
        }),
      );

      showToast("Payment recorded", "success");
      onSaved(String(created._id));
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      showToast(message || "Couldn't save payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedBillsLabel = selectedBills.map((b) => billLabel(b.number)).join(", ");
  const currency = selectedBills[0]?.currency || "USD";

  return (
    <section
      className={`overflow-y-auto custom-scrollbar bg-white border border-gray-300 shadow-sm ${
        asModal ? "rounded-lg max-h-[90vh]" : "flex-1 m-2"
      }`}
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300 sticky top-0 bg-white z-20">
        <h1 className="text-lg font-semibold text-gray-900">Add Payment</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !vendorId || selectedBills.length === 0 || totalLineAmount <= 0}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !vendorId || selectedBills.length === 0 || totalLineAmount <= 0}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save & Send"}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="ml-1 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">Vendor *</label>
            <div className="relative" ref={vendorRef}>
              <input
                value={vendorQuery}
                onFocus={() => setVendorOpen(true)}
                onChange={(e) => {
                  setVendorQuery(e.target.value);
                  setVendorOpen(true);
                  if (!e.target.value.trim()) setVendorId("");
                }}
                placeholder="Search vendor"
                className={fieldClass}
              />
              {vendorOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {vendorOptions.map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => pickVendor(v)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {v.name}
                    </button>
                  ))}
                  {vendorOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No vendors found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Bill *</label>
            {selectedBills.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {selectedBills.map((b) => (
                  <span
                    key={b._id}
                    className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-800"
                  >
                    {billLabel(b.number)}
                  </span>
                ))}
              </div>
            )}
            {selectedBills.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 truncate" title={selectedBillsLabel}>
                {selectedBillsLabel}
              </p>
            )}
            <div className="relative" ref={billRef}>
              <input
                value={billQuery}
                onFocus={() => setBillOpen(true)}
                onChange={(e) => {
                  setBillQuery(e.target.value);
                  setBillOpen(true);
                }}
                placeholder={vendorId ? "Search bill" : "Select vendor first (or search bill)"}
                className={fieldClass}
              />
              {billOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {billOptions.map((b) => {
                    const selected = selectedIdSet.has(b._id);
                    return (
                      <button
                        key={b._id}
                        type="button"
                        onClick={() => toggleBill(b)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          {b.number} · {b.vendorName} · {money(b.dueAmount, b.currency)} due
                        </span>
                      </button>
                    );
                  })}
                  {billOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No bills found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Payment date</label>
              <AppDatePicker value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Payment Type</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Amount</label>
            <div className="space-y-2 mt-1">
              {selectedBills.length === 0 && (
                <p className="text-sm text-gray-400">Select one or more bills to enter amounts.</p>
              )}
              {selectedBills.map((b) => (
                <div key={b._id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLineAmounts((prev) => ({
                        ...prev,
                        [b._id]: b.dueAmount > 0 ? b.dueAmount.toFixed(2) : "0.00",
                      }))
                    }
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
                  >
                    Full Payment
                  </button>
                  <span className="min-w-[7rem] truncate text-sm text-gray-700">{billLabel(b.number)}</span>
                  <input
                    value={lineAmounts[b._id] ?? ""}
                    onChange={(e) =>
                      setLineAmounts((prev) => ({
                        ...prev,
                        [b._id]: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-md text-sm text-right bg-white text-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {selectedBills.length > 0 && (
            <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-3">
              Outstanding balance:{" "}
              <span className="font-semibold text-gray-900">{money(outstandingTotal, currency)}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full h-20 border border-gray-300 rounded-md p-3 text-sm outline-none resize-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">Internal Notes</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal Notes"
              className="mt-1 w-full h-20 border border-gray-300 rounded-md p-3 text-sm outline-none resize-none"
            />
          </div>
          <DocAttachmentField compact value={attachment} onChange={(p) => setAttachment(p)} />
        </div>
      </div>
    </section>
  );
};
