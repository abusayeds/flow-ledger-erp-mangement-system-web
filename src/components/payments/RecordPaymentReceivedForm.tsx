/**
 * Record Payment Received — full panel with searchable Customer + Invoice.
 * Prefills when opened from an invoice.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { fetchCustomers, type TCustomerRow } from "@/services/customersApi";
import { fetchInvoices, type InvoiceListRow } from "@/services/invoicesApi";
import { createInvoicePayment } from "@/services/paymentReceivedApi";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { showToast } from "@/utils/toast";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

export type PaymentReceivedPrefillInvoice = {
  _id: string;
  number: string;
  dueAmount: number;
  currency: string;
  customerId?: string;
};

export type PaymentReceivedPrefill = {
  customerId?: string;
  customerName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  dueAmount?: number;
  currency?: string;
  invoices?: PaymentReceivedPrefillInvoice[];
};

type SelectedInvoice = {
  _id: string;
  number: string;
  dueAmount: number;
  currency: string;
  customerId?: string;
  customerName?: string;
};

type Props = {
  onClose: () => void;
  onSaved: (id: string) => void;
  prefill?: PaymentReceivedPrefill;
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

const invoiceLabel = (number: string) => (number.startsWith("#") ? number : `#${number}`);

const initSelectedFromPrefill = (prefill?: PaymentReceivedPrefill): SelectedInvoice[] => {
  if (prefill?.invoices?.length) {
    return prefill.invoices.map((inv) => ({
      _id: inv._id,
      number: inv.number,
      dueAmount: inv.dueAmount,
      currency: inv.currency || prefill.currency || "USD",
      customerId: inv.customerId ?? prefill.customerId,
    }));
  }
  if (prefill?.invoiceId) {
    return [
      {
        _id: prefill.invoiceId,
        number: prefill.invoiceNumber ?? "",
        dueAmount: prefill.dueAmount ?? 0,
        currency: prefill.currency ?? "USD",
        customerId: prefill.customerId,
        customerName: prefill.customerName,
      },
    ];
  }
  return [];
};

const initLineAmounts = (invoices: SelectedInvoice[]): Record<string, string> => {
  const next: Record<string, string> = {};
  for (const inv of invoices) {
    next[inv._id] = inv.dueAmount > 0 ? inv.dueAmount.toFixed(2) : "0.00";
  }
  return next;
};

export const RecordPaymentReceivedForm: React.FC<Props> = ({ onClose, onSaved, prefill }) => {
  const [customerId, setCustomerId] = useState(prefill?.customerId ?? "");
  const [customerQuery, setCustomerQuery] = useState(prefill?.customerName ?? "");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const [selectedInvoices, setSelectedInvoices] = useState<SelectedInvoice[]>(() => initSelectedFromPrefill(prefill));
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
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
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setCustomerOpen(false);
      if (invoiceRef.current && !invoiceRef.current.contains(e.target as Node)) setInvoiceOpen(false);
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
    return names.length ? names : ["Cash", "Master Card", "Stripe", "PayPal", "Bank Transfer"];
  }, [methodsData]);

  useEffect(() => {
    if (!methods.includes(method)) setMethod(methods[0] || "Cash");
  }, [methods, method]);

  const { data: customersData } = useQuery({
    queryKey: ["payment-received-customer-search", customerQuery],
    queryFn: () => fetchCustomers({ page: 1, limit: 30, searchTerm: customerQuery.trim() || undefined }),
    staleTime: 10_000,
  });
  const customerOptions: TCustomerRow[] = customersData?.rows ?? [];

  const { data: invoicesData } = useQuery({
    queryKey: ["payment-received-invoice-search", customerId, invoiceQuery],
    queryFn: () =>
      fetchInvoices({
        page: 1,
        limit: 50,
        customer_id: customerId || undefined,
        searchTerm: invoiceQuery.trim() || undefined,
        sort: "-createdAt",
      }),
    staleTime: 10_000,
  });

  const invoiceOptions = useMemo(() => {
    const rows = invoicesData?.rows ?? [];
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (inv) => inv.number.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q),
    );
  }, [invoicesData?.rows, invoiceQuery]);

  const selectedIdSet = useMemo(() => new Set(selectedInvoices.map((inv) => inv._id)), [selectedInvoices]);

  const totalLineAmount = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + Math.max(0, Number(lineAmounts[inv._id]) || 0), 0),
    [lineAmounts, selectedInvoices],
  );

  const outstandingTotal = useMemo(
    () => selectedInvoices.reduce((sum, inv) => sum + Math.max(0, inv.dueAmount), 0),
    [selectedInvoices],
  );

  const currency =
    selectedInvoices[0]?.currency || prefill?.currency || "USD";

  useEffect(() => {
    setLineAmounts((prev) => {
      const next: Record<string, string> = {};
      for (const inv of selectedInvoices) {
        next[inv._id] =
          prev[inv._id] ?? (inv.dueAmount > 0 ? inv.dueAmount.toFixed(2) : "0.00");
      }
      return next;
    });
  }, [selectedInvoices]);

  const pickCustomer = (c: TCustomerRow) => {
    setCustomerId(c._id);
    setCustomerQuery(c.name);
    setCustomerOpen(false);
    const mismatch = selectedInvoices.some((inv) => inv.customerId && inv.customerId !== c._id);
    if (mismatch) {
      setSelectedInvoices([]);
      setLineAmounts({});
    }
  };

  const toggleInvoice = (inv: InvoiceListRow) => {
    setSelectedInvoices((prev) => {
      const exists = prev.some((item) => item._id === inv._id);
      if (exists) return prev.filter((item) => item._id !== inv._id);
      return [
        ...prev,
        {
          _id: inv._id,
          number: inv.number,
          dueAmount: inv.dueAmount,
          currency: inv.currency,
          customerId: inv.customerId,
          customerName: inv.customerName,
        },
      ];
    });
    if (inv.customerId && inv.customerId !== customerId) {
      setCustomerId(inv.customerId);
      setCustomerQuery(inv.customerName);
    }
  };

  const save = async () => {
    if (!customerId) {
      showToast("Select a customer", "warning");
      return;
    }
    if (selectedInvoices.length === 0) {
      showToast("Select an invoice", "warning");
      return;
    }

    const customerKeys = [
      ...new Set(
        selectedInvoices.map((inv) => inv.customerId).filter(Boolean) as string[],
      ),
    ];
    if (customerKeys.length > 1) {
      showToast("Selected invoices must belong to the same customer", "warning");
      return;
    }
    if (customerKeys.length === 1 && customerKeys[0] !== customerId) {
      showToast("Selected invoices must match the chosen customer", "warning");
      return;
    }

    const creates = selectedInvoices
      .map((inv) => ({
        inv,
        parsedAmount: Math.max(0, Number(lineAmounts[inv._id]) || 0),
      }))
      .filter(({ parsedAmount }) => parsedAmount > 0);

    if (creates.length === 0) {
      showToast("Enter a valid amount", "warning");
      return;
    }

    setSaving(true);
    try {
      const serialBase = `PR-${Date.now().toString().slice(-8)}`;
      const results = await Promise.all(
        creates.map(({ inv, parsedAmount }, index) =>
          createInvoicePayment({
            customer_id: customerId,
            invoice_id: inv._id,
            payment_number: index === 0 ? serialBase : `${serialBase}-${index + 1}`,
            payment_date: date,
            payment_type: method || "Cash",
            amount: parsedAmount,
            notes: notes || undefined,
            internal_notes: internalNotes || undefined,
            attachments: attachment || undefined,
            type: "invoice",
          }),
        ),
      );
      showToast("Payment recorded", "success");
      onSaved(String(results[0]._id));
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      showToast(message || "Couldn't save payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectedInvoicesLabel = selectedInvoices.map((inv) => invoiceLabel(inv.number)).join(", ");

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar m-2 bg-white border border-gray-300 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300 sticky top-0 bg-white z-20">
        <h1 className="text-lg font-semibold text-gray-900">Add Payment</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !customerId || selectedInvoices.length === 0 || totalLineAmount <= 0}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !customerId || selectedInvoices.length === 0 || totalLineAmount <= 0}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save & Send"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500">Customer *</label>
            <div className="relative" ref={customerRef}>
              <input
                value={customerQuery}
                onFocus={() => setCustomerOpen(true)}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerOpen(true);
                  if (!e.target.value.trim()) setCustomerId("");
                }}
                placeholder="Search customer"
                className={fieldClass}
              />
              {customerOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {customerOptions.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => pickCustomer(c)}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {c.name}
                    </button>
                  ))}
                  {customerOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Invoice *</label>
            {selectedInvoices.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {selectedInvoices.map((inv) => (
                  <span
                    key={inv._id}
                    className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-800"
                  >
                    {invoiceLabel(inv.number)}
                  </span>
                ))}
              </div>
            )}
            {selectedInvoices.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 truncate" title={selectedInvoicesLabel}>
                {selectedInvoicesLabel}
              </p>
            )}
            <div className="relative" ref={invoiceRef}>
              <input
                value={invoiceQuery}
                onFocus={() => setInvoiceOpen(true)}
                onChange={(e) => {
                  setInvoiceQuery(e.target.value);
                  setInvoiceOpen(true);
                }}
                placeholder={customerId ? "Search invoice" : "Select customer first (or search invoice)"}
                className={fieldClass}
              />
              {invoiceOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {invoiceOptions.map((inv) => {
                    const selected = selectedIdSet.has(inv._id);
                    return (
                      <button
                        key={inv._id}
                        type="button"
                        onClick={() => toggleInvoice(inv)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          {inv.number} · {inv.customerName} · {money(inv.dueAmount, inv.currency)} due
                        </span>
                      </button>
                    );
                  })}
                  {invoiceOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No invoices found</div>
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
              {selectedInvoices.length === 0 && (
                <p className="text-sm text-gray-400">Select one or more invoices to enter amounts.</p>
              )}
              {selectedInvoices.map((inv) => (
                <div key={inv._id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLineAmounts((prev) => ({
                        ...prev,
                        [inv._id]: inv.dueAmount > 0 ? inv.dueAmount.toFixed(2) : "0.00",
                      }))
                    }
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 whitespace-nowrap"
                  >
                    Full Payment
                  </button>
                  <span className="min-w-[7rem] truncate text-sm text-gray-700">{invoiceLabel(inv.number)}</span>
                  <input
                    value={lineAmounts[inv._id] ?? ""}
                    onChange={(e) =>
                      setLineAmounts((prev) => ({
                        ...prev,
                        [inv._id]: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-md text-sm text-right bg-white text-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {selectedInvoices.length > 0 && (
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
