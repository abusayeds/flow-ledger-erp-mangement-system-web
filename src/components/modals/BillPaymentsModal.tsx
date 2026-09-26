/**
 * Bill → Add Payment modal — same split-pane UX as InvoicePaymentsModal,
 * with Vendor / Bill instead of Customer / Invoice (Payment Made).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, MoreVertical, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { useCollection, repo } from "@/lib/db";
import { fetchVendors, type VendorListRow } from "@/services/vendorsApi";
import { updateBill } from "@/services/billsApi";
import {
  createVendorPayment,
  deleteVendorPayment,
  fetchVendorPayments,
  recordVendorPayment,
  type VendorPaymentListRow,
} from "@/services/vendorPaymentsApi";
import type { PaymentMethodOption } from "@/services/paymentMethodsApi";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

export type BillPaymentDoc = {
  _id: string;
  bill_number?: string;
  currency?: string;
  total?: number;
  balance_amount?: number;
  paid_amount?: number;
  vendor_id?: string | { _id?: string; name?: string; businessProfile?: { companyName?: string } };
  vendor_name?: string;
  payment_method?: string[];
};

interface BillPaymentsModalProps {
  open: boolean;
  bill: BillPaymentDoc | null;
  /** When set, one amount row per bill (batch from list selection). */
  bills?: BillPaymentDoc[];
  /** Open from Vendors page (no bill) — list/create payments for this vendor. */
  vendorId?: string;
  vendorName?: string;
  paymentMethods: PaymentMethodOption[];
  onClose: () => void;
  onSaved?: () => void;
}

const text = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const numberValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;

const todayInput = () => new Date().toISOString().slice(0, 10);

const currencyLabel = (amount: number, currency?: string) => {
  const cur = text(currency) || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
};

const vendorNameOf = (bill: BillPaymentDoc | null) => {
  if (!bill) return "No Vendor";
  const vendor = bill.vendor_id;
  if (vendor && typeof vendor === "object") {
    return vendor.businessProfile?.companyName?.trim() || vendor.name?.trim() || text(bill.vendor_name) || "No Vendor";
  }
  return text(bill.vendor_name) || "No Vendor";
};

const vendorIdOf = (bill: BillPaymentDoc | null) => {
  const vendor = bill?.vendor_id;
  if (vendor && typeof vendor === "object") return text(vendor._id);
  return text(vendor);
};

const billNumberOf = (bill: BillPaymentDoc | null) =>
  text(bill?.bill_number).replace(/^#/, "") || "—";

const dueOfBill = (bill: BillPaymentDoc) => numberValue(bill.balance_amount ?? bill.total);

const initLineAmountsForBills = (docs: BillPaymentDoc[]): Record<string, string> => {
  const next: Record<string, string> = {};
  for (const doc of docs) {
    const due = dueOfBill(doc);
    next[doc._id] = due > 0 ? due.toFixed(2) : "0.00";
  }
  return next;
};

const modalShell = "bg-white text-gray-900 border-gray-300";
const modalSidebar = "bg-white border-gray-300";
const modalHeader = "bg-gray-100 border-gray-300";
const modalSection = "bg-gray-50 border-gray-300";
const modalHover = "hover:bg-gray-50";
const fieldClass =
  "w-full mt-1 px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";

const Dropdown: React.FC<{
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  panelClass?: string;
}> = ({ trigger, children, align = "left", panelClass = "" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((value) => !value)}>
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-2 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClass}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

type UnifiedPayment = {
  id: string;
  serial: string;
  billNumber: string;
  dateLabel: string;
  timestamp: number;
  amount: number;
  currency: string;
  method: string;
  notes: string;
  internalNotes: string;
  attachment: string;
};

export const BillPaymentsModal: React.FC<BillPaymentsModalProps> = ({
  open,
  bill,
  bills: billsProp,
  vendorId: partyVendorId,
  vendorName: partyVendorName,
  paymentMethods,
  onClose,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const localPaymentsMade = useCollection<any>("paymentsMade");
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [paymentSerial, setPaymentSerial] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInput());
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attachment, setAttachment] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);

  const paymentDocs = useMemo(() => {
    if (billsProp && billsProp.length > 0) return billsProp;
    if (bill) return [bill];
    return [];
  }, [bill, billsProp]);

  const partyMode = paymentDocs.length === 0 && !!partyVendorId;

  const paymentDocIds = useMemo(() => paymentDocs.map((doc) => doc._id).filter(Boolean), [paymentDocs]);
  const paymentDocIdsKey = useMemo(
    () => (partyMode ? `vendor:${partyVendorId}` : paymentDocIds.slice().sort().join(",")),
    [partyMode, partyVendorId, paymentDocIds],
  );
  const paymentDocBillNumbers = useMemo(
    () => new Set(paymentDocs.map((doc) => billNumberOf(doc)).filter((n) => n !== "—")),
    [paymentDocs],
  );

  const billId = bill?._id ?? "";
  const billVendorId = vendorIdOf(bill);
  const resolvedVendorId = partyVendorId || billVendorId;
  const displayVendorName = partyVendorName || vendorNameOf(bill);
  const dueAmount = paymentDocs.reduce((sum, doc) => sum + dueOfBill(doc), 0);
  const billNumbersLabel = partyMode ? "—" : paymentDocs.map((doc) => billNumberOf(doc)).join(", ");
  const totalLineAmount = useMemo(
    () => paymentDocs.reduce((sum, doc) => sum + Math.max(0, Number(lineAmounts[doc._id]) || 0), 0),
    [lineAmounts, paymentDocs],
  );
  const preferredMethods = useMemo(() => {
    const configured = paymentMethods.map((item) => item.name).filter(Boolean);
    const billSpecific = Array.isArray(bill?.payment_method) ? bill.payment_method.filter(Boolean) : [];
    return [...new Set([...billSpecific, ...configured])];
  }, [bill?.payment_method, paymentMethods]);

  useEffect(() => {
    if (!open) return;
    setVendorId(resolvedVendorId);
    setVendorQuery(displayVendorName);
    setPaymentDate(todayInput());
    setPaymentSerial("");
    setMethod(preferredMethods[0] || "Cash");
    setLineAmounts(initLineAmountsForBills(paymentDocs));
    setAmount(dueAmount > 0 ? dueAmount.toFixed(2) : "0.00");
    setNotes("");
    setInternalNotes("");
  }, [open, preferredMethods, dueAmount, billId, resolvedVendorId, displayVendorName, paymentDocs]);

  const { data: paymentsData, isFetching } = useQuery({
    queryKey: ["bill-payments", paymentDocIdsKey],
    queryFn: async () => {
      if (partyMode && partyVendorId) {
        const res = await fetchVendorPayments({
          vendor_id: partyVendorId,
          limit: 100,
          sort: "-payment_date",
        });
        return { rows: res.rows };
      }
      const results = await Promise.all(
        paymentDocIds.map((id) => fetchVendorPayments({ bill_id: id, limit: 100, sort: "-payment_date" })),
      );
      const rows = results.flatMap((result) => result.rows);
      const seen = new Set<string>();
      const unique = rows.filter((row) => {
        if (seen.has(row._id)) return false;
        seen.add(row._id);
        return true;
      });
      const filtered =
        paymentDocBillNumbers.size > 0
          ? unique.filter((row) => {
              const noHash = row.billNo.replace(/^#/, "");
              return paymentDocBillNumbers.has(noHash) || paymentDocBillNumbers.has(row.billNo.replace(/^#/, ""));
            })
          : unique;
      return { rows: filtered.length > 0 ? filtered : unique };
    },
    enabled: open && (partyMode || paymentDocIds.length > 0),
    placeholderData: (prev) => prev,
  });

  const payments = useMemo<UnifiedPayment[]>(() => {
    const rows = (paymentsData?.rows ?? []) as VendorPaymentListRow[];
    return rows
      .map((payment) => ({
        id: payment._id,
        serial: payment.number || "—",
        billNumber: payment.billNo.replace(/^#/, "") || billNumberOf(bill),
        dateLabel: payment.dateLabel,
        timestamp: payment.paymentDateIso ? new Date(payment.paymentDateIso).getTime() || 0 : 0,
        amount: payment.amount,
        currency: text(bill?.currency) || "USD",
        method: payment.method || "Cash",
        notes: payment.note === "No Notes" ? "" : payment.note,
        internalNotes: "",
        attachment:
          text(
            localPaymentsMade.find((p) => String(p._id) === payment._id)?.Attachment ||
              localPaymentsMade.find((p) => String(p._id) === payment._id)?.attachments,
          ) || "",
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [bill, localPaymentsMade, paymentsData?.rows]);

  const persistBillPaymentAttachment = async (path: string) => {
    if (!selectedPayment) {
      showToast("Save the document first", "error");
      throw new Error("missing payment");
    }
    const local = localPaymentsMade.find((p) => String(p._id) === selectedPayment.id);
    if (local?.id) {
      await repo.update("paymentsMade", local.id, { Attachment: path, attachments: path });
      showToast(path ? "Attachment saved" : "Attachment removed", "success");
      return;
    }
    showToast("Save the payment locally to attach files", "info");
    throw new Error("no local payment");
  };

  const vendorSearch = useQuery({
    queryKey: ["bill-payment-vendors", vendorQuery],
    queryFn: async () => fetchVendors({ page: 1, limit: 20, searchTerm: vendorQuery.trim() || undefined }),
    staleTime: 30_000,
    enabled: open && showForm,
  });
  const vendorOptions: VendorListRow[] = vendorSearch.data?.rows ?? [];

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (vendorRef.current && !vendorRef.current.contains(event.target as Node)) setVendorOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const nextPaymentNumber = useMemo(
    () => `PM-${String(payments.length + 1).padStart(4, "0")}`,
    [payments.length],
  );

  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0] ?? null;

  useEffect(() => {
    if (!open) return;
    if (payments.length > 0) {
      setShowForm(false);
      setSelectedPaymentId((current) => current || payments[0].id);
      return;
    }
    setShowForm(true);
    setSelectedPaymentId("");
  }, [open, payments]);

  const openCreateForm = () => {
    setShowForm(true);
    setSelectedPaymentId("");
    setVendorId(resolvedVendorId);
    setVendorQuery(displayVendorName);
    setPaymentSerial(nextPaymentNumber);
    setMethod(preferredMethods[0] || "Cash");
    setLineAmounts(initLineAmountsForBills(paymentDocs));
    setAmount(dueAmount > 0 ? dueAmount.toFixed(2) : "0.00");
    setPaymentDate(todayInput());
    setNotes("");
    setInternalNotes("");
  };

  const refreshPayments = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bill-payments", paymentDocIdsKey] });
    await queryClient.invalidateQueries({ queryKey: ["bills-backend-list"] });
    await queryClient.invalidateQueries({ queryKey: ["vendor-payments-list"] });
  };

  const savePaymentMut = useMutation({
    mutationFn: async () => {
      const serial = text(paymentSerial) || nextPaymentNumber;
      const vId = vendorId || resolvedVendorId;
      if (!vId) throw new Error("No vendor");

      if (partyMode) {
        const parsedAmount = Math.max(0, Number(amount) || 0);
        if (parsedAmount <= 0) throw new Error("Enter a payment amount");
        return recordVendorPayment({
          vendor_id: vId,
          payment_amount: parsedAmount,
          payment_date: paymentDate,
          payment_method: [method || "Cash"],
          notes: notes || undefined,
          reference_number: serial,
        });
      }

      if (paymentDocs.length > 1) {
        const vendorKeys = [...new Set(paymentDocs.map((doc) => vendorIdOf(doc)).filter(Boolean))];
        if (vendorKeys.length > 1) {
          throw new Error("Selected bills must belong to the same vendor");
        }
      }

      const allocations = paymentDocs
        .map((doc) => ({
          doc,
          parsedAmount: Math.max(0, Number(lineAmounts[doc._id]) || 0),
        }))
        .filter(({ parsedAmount }) => parsedAmount > 0);

      if (allocations.length === 0) {
        throw new Error("Enter a payment amount");
      }

      const paymentTotal = allocations.reduce((sum, item) => sum + item.parsedAmount, 0);

      await createVendorPayment({
        vendor_id: vId,
        payment_amount: paymentTotal,
        payment_date: paymentDate,
        payment_method: [method || "Cash"],
        notes: notes || undefined,
        reference_number: serial,
        allocations: allocations.map(({ doc, parsedAmount }) => ({
          invoice_id: doc._id,
          allocated_amount: parsedAmount,
        })),
      });

      await Promise.all(
        allocations.map(async ({ doc, parsedAmount }) => {
          const docDue = dueOfBill(doc);
          const paid = numberValue(doc.paid_amount) + parsedAmount;
          const due = Math.max(0, docDue - parsedAmount);
          await updateBill(doc._id, {
            paid_amount: +paid.toFixed(2),
            balance_amount: +due.toFixed(2),
            status: due <= 0 ? "Paid" : "Partial",
          });
        }),
      );
    },
    onSuccess: () => {
      void refreshPayments();
      showToast("Payment saved", "success");
      setShowForm(false);
      onSaved?.();
    },
    onError: (err: any) => {
      showToast(err?.message || "Payment save failed", "error");
    },
  });

  const saveDisabled =
    savePaymentMut.isPending ||
    (partyMode ? !(Number(amount) > 0) : totalLineAmount <= 0);

  const deletePaymentMut = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) throw new Error("No payment");
      await deleteVendorPayment(selectedPayment.id);
    },
    onSuccess: async () => {
      await refreshPayments();
      setSelectedPaymentId("");
      showToast("Payment deleted", "success");
    },
    onError: (err: any) => showToast(err?.message || "Delete failed", "error"),
  });

  const openReceiptWindow = (mode: "preview" | "print" | "email") => {
    if (!selectedPayment) return;
    const title = `Payment Receipt ${selectedPayment.serial}`;
    const body = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            .sheet { border: 1px solid #d1d5db; }
            .row { display: flex; justify-content: space-between; gap: 24px; padding: 16px; border-bottom: 1px solid #e5e7eb; }
            .amount { font-size: 28px; font-weight: 700; text-align: center; padding: 28px 16px; border-bottom: 1px solid #e5e7eb; }
            .section { padding: 16px; border-bottom: 1px solid #e5e7eb; }
            table { border-collapse: collapse; }
            td { border: 1px solid #d1d5db; padding: 6px 10px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1 style="text-align:center; padding:16px; margin:0; border-bottom:1px solid #d1d5db;">PAYMENT RECEIPT</h1>
            <div class="row">
              <div>
                <div style="font-size:20px; font-weight:700;">info</div>
                <div>${displayVendorName}</div>
              </div>
              <table>
                <tr><td><strong>Payment #</strong></td><td>${selectedPayment.serial}</td></tr>
                <tr><td><strong>Payment date</strong></td><td>${selectedPayment.dateLabel}</td></tr>
                <tr><td><strong>Payment Type</strong></td><td>${selectedPayment.method}</td></tr>
                <tr><td><strong>Amount</strong></td><td>${currencyLabel(selectedPayment.amount, selectedPayment.currency)}</td></tr>
              </table>
            </div>
            <div class="amount">${currencyLabel(selectedPayment.amount, selectedPayment.currency)}</div>
            <div class="section"><strong>Bill</strong><div>${selectedPayment.billNumber ? `#${selectedPayment.billNumber}` : "—"}</div></div>
            <div class="section"><strong>Notes</strong><div>${selectedPayment.notes || "No Notes"}</div></div>
            <div class="section"><strong>Internal Notes</strong><div>${selectedPayment.internalNotes || "No Internal Notes"}</div></div>
          </div>
        </body>
      </html>
    `;

    if (mode === "email") {
      const subject = encodeURIComponent(title);
      const mailBody = encodeURIComponent(
        `Vendor: ${displayVendorName}\nPayment #: ${selectedPayment.serial}\nBill: ${selectedPayment.billNumber ? `#${selectedPayment.billNumber}` : "—"}\nPayment date: ${selectedPayment.dateLabel}\nPayment type: ${selectedPayment.method}\nAmount: ${currencyLabel(selectedPayment.amount, selectedPayment.currency)}\n\nNotes: ${selectedPayment.notes || "No Notes"}`,
      );
      window.location.href = `mailto:?subject=${subject}&body=${mailBody}`;
      return;
    }

    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      showToast("Popup blocked by browser", "warning");
      return;
    }
    popup.document.open();
    popup.document.write(body);
    popup.document.close();
    if (mode === "print") popup.print();
  };

  if (!open || (!bill && !partyMode)) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 p-4" onMouseDown={onClose}>
      <div className="flex h-full w-full items-center justify-center" onMouseDown={(e) => e.stopPropagation()}>
        <div className={`relative h-[86vh] w-full max-w-6xl overflow-hidden rounded-2xl border shadow-2xl ${modalShell}`}>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex h-full">
            <aside className={`flex w-full max-w-sm flex-col border-r ${modalSidebar}`}>
              <div className={`flex items-center border-b px-4 py-3 ${modalHeader}`}>
                <h2 className="text-lg font-semibold">Payment Made</h2>
              </div>

              <div className={`border-b px-4 py-3 ${modalSidebar}`}>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:border-gray-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Record Payment
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {payments.map((payment) => {
                  const active = !showForm && selectedPayment?.id === payment.id;
                  return (
                    <button
                      key={payment.id}
                      type="button"
                      onClick={() => {
                        setSelectedPaymentId(payment.id);
                        setShowForm(false);
                      }}
                      className={`w-full border-b border-gray-300 px-4 py-3 text-left transition-colors ${
                        active ? "bg-gray-100" : modalHover
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{displayVendorName}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{payment.serial}</div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">{payment.notes || "No Notes"}</div>
                        </div>
                        <div className="flex max-w-[140px] min-w-0 flex-col items-end">
                          <span className="truncate text-xs text-gray-500">{payment.dateLabel}</span>
                          <span className="mt-0.5 text-sm font-semibold text-gray-900">
                            {currencyLabel(payment.amount, payment.currency)}
                          </span>
                          <span className="mt-0.5 w-full truncate text-right text-xs text-gray-500">{payment.method}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {!isFetching && payments.length === 0 && (
                  <div className="px-4 py-12 text-center text-sm text-gray-500">No payments recorded yet.</div>
                )}
              </div>

              <div className={`border-t px-4 py-3 text-center ${modalHeader}`}>
                <div className="text-lg font-semibold text-gray-900">
                  {currencyLabel(
                    payments.reduce((sum, item) => sum + item.amount, 0),
                    text(bill?.currency),
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {payments.length} {payments.length === 1 ? "Payment" : "Payments"}
                </div>
              </div>
            </aside>

            <section className="flex min-w-0 flex-1 flex-col bg-[#FAFBFC]">
              {showForm ? (
                <div className="flex-1 overflow-y-auto border-0 bg-white">
                  <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-300 bg-white px-6 py-3 pr-14">
                    <h3 className="text-lg font-semibold text-gray-900">Add Payment</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!(vendorId || resolvedVendorId)) {
                            showToast("Select a vendor", "warning");
                            return;
                          }
                          savePaymentMut.mutate();
                        }}
                        disabled={saveDisabled}
                        className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!(vendorId || resolvedVendorId)) {
                            showToast("Select a vendor", "warning");
                            return;
                          }
                          savePaymentMut.mutate();
                        }}
                        disabled={saveDisabled}
                        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        {savePaymentMut.isPending ? "Saving..." : "Save & Send"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-gray-500">Payment #</label>
                        <input
                          value={paymentSerial || nextPaymentNumber}
                          onChange={(e) => setPaymentSerial(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Vendor</label>
                        <div className="relative" ref={vendorRef}>
                          <input
                            value={vendorQuery}
                            onFocus={() => setVendorOpen(true)}
                            onChange={(e) => {
                              setVendorQuery(e.target.value);
                              setVendorOpen(true);
                            }}
                            placeholder="Search vendor"
                            className={fieldClass}
                          />
                          {vendorOpen && (
                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                              {vendorOptions.map((vendor) => (
                                <button
                                  key={vendor._id}
                                  type="button"
                                  onClick={() => {
                                    setVendorId(vendor._id);
                                    setVendorQuery(vendor.name);
                                    setVendorOpen(false);
                                  }}
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  {vendor.name}
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
                        <label className="text-xs text-gray-500">Bill #</label>
                        <input value={billNumbersLabel} readOnly className={fieldClass} />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs text-gray-500">Payment date</label>
                          <AppDatePicker
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Payment Type</label>
                          <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass}>
                            {preferredMethods.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                            {preferredMethods.length === 0 && <option value="Cash">Cash</option>}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Amount</label>
                        {partyMode ? (
                          <input
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-900"
                          />
                        ) : (
                          <div className="space-y-2">
                            {paymentDocs.map((doc) => (
                              <div key={doc._id} className="mt-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLineAmounts((prev) => ({
                                      ...prev,
                                      [doc._id]: dueOfBill(doc).toFixed(2),
                                    }))
                                  }
                                  className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                  Full Payment
                                </button>
                                <span className="min-w-[7rem] truncate text-sm text-gray-700">{billNumberOf(doc)}</span>
                                <input
                                  value={lineAmounts[doc._id] ?? ""}
                                  onChange={(e) =>
                                    setLineAmounts((prev) => ({
                                      ...prev,
                                      [doc._id]: e.target.value,
                                    }))
                                  }
                                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-900"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={`rounded-md border p-4 ${modalSection}`}>
                        <div className="text-sm text-gray-500">
                          Outstanding Balance:{" "}
                          <span className="font-semibold text-gray-900">
                            {currencyLabel(dueAmount, text(bill?.currency))}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Notes</label>
                        <textarea
                          rows={4}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="mt-1 h-20 w-full resize-none rounded-md border border-gray-300 p-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-gray-500">Internal Notes</label>
                        <textarea
                          rows={4}
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          className="mt-1 h-20 w-full resize-none rounded-md border border-gray-300 p-3 text-sm outline-none"
                        />
                      </div>
                      <DocAttachmentField compact value={attachment} onChange={(p) => setAttachment(p)} />
                    </div>
                  </div>
                </div>
              ) : selectedPayment ? (
                <div className="flex flex-1 flex-col overflow-y-auto bg-white">
                  <div className="flex h-12 items-center justify-between gap-3 border-b border-gray-300 bg-gray-100 px-6 pr-14">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold tracking-tight text-gray-900">
                        {displayVendorName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Edit"
                        onClick={openCreateForm}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Preview"
                        onClick={() => openReceiptWindow("preview")}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Print"
                        onClick={() => openReceiptWindow("print")}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Email"
                        onClick={() => openReceiptWindow("email")}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                      <Dropdown
                        align="right"
                        panelClass="w-48"
                        trigger={
                          <span className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                            <MoreVertical className="h-4 w-4" />
                          </span>
                        }
                      >
                        {(close) => (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                openCreateForm();
                                close();
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                              <Pencil className="h-4 w-4 text-gray-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                showToast("Trash is not available for vendor payments yet", "info");
                                close();
                              }}
                              className="flex w-full items-center gap-2 border-t border-gray-200 px-3 py-2 text-left text-sm text-red-500 hover:bg-gray-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Trash
                            </button>
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-b border-gray-300 px-5 py-3">
                    <div>
                      <div className="text-xs text-gray-500">{selectedPayment.serial}</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {currencyLabel(selectedPayment.amount, selectedPayment.currency)}
                      </div>
                    </div>
                    <div className="flex items-center gap-12">
                      <div>
                        <div className="text-xs text-gray-500">Payment date</div>
                        <div className="text-sm font-semibold text-gray-900">{selectedPayment.dateLabel}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Payment Type</div>
                        <div className="text-sm font-semibold text-gray-900">{selectedPayment.method}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-gray-300">
                    <div className="border-b border-gray-300 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
                      Bills
                    </div>
                    <div className="flex items-center justify-between px-5 py-4 text-sm text-gray-900">
                      <span>{selectedPayment.billNumber ? `#${selectedPayment.billNumber}` : "—"}</span>
                      <span className="font-semibold text-gray-900">
                        {currencyLabel(selectedPayment.amount, selectedPayment.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 border-b border-gray-300 md:grid-cols-2">
                    <div className="border-b border-gray-300 px-5 py-3 md:border-b-0 md:border-r md:border-gray-200">
                      <div className="mb-2 text-sm font-semibold text-gray-900">Notes</div>
                      <div className="text-sm text-gray-600">{selectedPayment.notes || "No Notes"}</div>
                    </div>
                    <div className="px-5 py-3">
                      <div className="mb-2 text-sm font-semibold text-gray-900">Internal Notes</div>
                      <div className="text-sm text-gray-600">
                        {selectedPayment.internalNotes || "No Internal Notes"}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 max-w-md">
                    <DocAttachmentField
                      value={selectedPayment.attachment || ""}
                      onChange={persistBillPaymentAttachment}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center bg-white text-sm text-gray-500">
                  Select a payment from the left side.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillPaymentsModal;
