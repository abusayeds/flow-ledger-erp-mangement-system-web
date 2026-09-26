import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, MoreVertical, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { showToast } from "@/utils/toast";
import { useCollection } from "@/lib/db";
import type { BackendInvoiceDoc } from "@/services/invoicesApi";
import {
  createInvoicePayment,
  createPaymentReceived,
  deleteInvoicePayment,
  deletePaymentReceived,
  fetchInvoiceDirectPayments,
  fetchPaymentReceived,
  updateInvoicePayment,
  updatePaymentReceived,
  type BackendInvoicePaymentDoc,
  type BackendPaymentReceivedDoc,
} from "@/services/paymentReceivedApi";
import type { PaymentMethodOption } from "@/services/paymentMethodsApi";
import { fetchCustomers, type TCustomerRow } from "@/services/customersApi";
import { AppDatePicker } from "@/components/ui/AppDatePicker";

interface InvoicePaymentsModalProps {
  open: boolean;
  invoice: BackendInvoiceDoc | null;
  /** When set, payment form allocates one amount row per invoice (batch from list selection). */
  invoices?: BackendInvoiceDoc[];
  /** Open from Customers page (no invoice) — list/create payments for this customer. */
  customerId?: string;
  customerName?: string;
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

const dateLabel = (value?: string): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const inputDateValue = (value?: string): string => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
};

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

const customerName = (invoice: BackendInvoiceDoc | null) => {
  if (!invoice) return "No Customer";
  const customer = invoice.customer_id;
  if (customer && typeof customer === "object") {
    return customer.businessProfile?.companyName?.trim() || customer.name?.trim() || text(invoice.customer_name) || "No Customer";
  }
  return text(invoice.customer_name) || "No Customer";
};

const customerSubtitle = (invoice: BackendInvoiceDoc | null) => {
  const customer = invoice?.customer_id;
  if (customer && typeof customer === "object") return text(customer.name);
  return "";
};

const invoiceCustomerIdOf = (doc: BackendInvoiceDoc | null) => {
  if (!doc) return "";
  const customer = doc.customer_id;
  if (customer && typeof customer === "object") return text(customer._id);
  return text(customer) || text(doc.customer_name);
};

const invoiceNumberOf = (doc: BackendInvoiceDoc) => text(doc.invoice_number).replace(/^#/, "") || "—";

const dueOfInvoice = (doc: BackendInvoiceDoc) => numberValue(doc.balance_amount ?? doc.total);

const initLineAmountsForDocs = (docs: BackendInvoiceDoc[]): Record<string, string> => {
  const next: Record<string, string> = {};
  for (const doc of docs) {
    const due = dueOfInvoice(doc);
    next[doc._id] = due > 0 ? due.toFixed(2) : "0.00";
  }
  return next;
};

const firstPaymentMethod = (payment: BackendPaymentReceivedDoc) =>
  Array.isArray(payment.payment_method) && payment.payment_method.length > 0
    ? text(payment.payment_method[0]) || "Cash"
    : "Cash";

type UnifiedPayment = {
  id: string;
  serial: string;
  invoiceNumber: string;
  dateLabel: string;
  timestamp: number;
  amount: number;
  currency: string;
  method: string;
  notes: string;
  internalNotes: string;
  attachment: string;
  source: "payment" | "paymentReceived";
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
          className={`absolute z-30 mt-2 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-xl ${align === "right" ? "right-0" : "left-0"} ${panelClass}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
};

export const InvoicePaymentsModal: React.FC<InvoicePaymentsModalProps> = ({
  open,
  invoice,
  invoices: invoicesProp,
  customerId: partyCustomerId,
  customerName: partyCustomerName,
  paymentMethods,
  onClose,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const localInvoices = useCollection<any>("invoices");
  const localPaymentsReceived = useCollection<any>("paymentsReceived");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const [showForm, setShowForm] = useState(true);
  const [paymentSerial, setPaymentSerial] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInput());
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attachment, setAttachment] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  const paymentDocs = useMemo(() => {
    if (invoicesProp && invoicesProp.length > 0) return invoicesProp;
    if (invoice) return [invoice];
    return [];
  }, [invoice, invoicesProp]);

  /** Customer page: no invoice docs — show this customer's payment history. */
  const partyMode = paymentDocs.length === 0 && !!partyCustomerId;

  const paymentDocIds = useMemo(() => paymentDocs.map((doc) => doc._id).filter(Boolean), [paymentDocs]);
  const paymentDocIdsKey = useMemo(
    () => (partyMode ? `customer:${partyCustomerId}` : paymentDocIds.slice().sort().join(",")),
    [partyMode, partyCustomerId, paymentDocIds],
  );

  const allowedLocalInvoiceKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const id of paymentDocIds) {
      keys.add(String(id));
      const local = localInvoices.find((item) => String(item._id) === id);
      if (local?.id != null) keys.add(String(local.id));
    }
    return keys;
  }, [paymentDocIds, localInvoices]);

  const invoiceId = invoice?._id ?? "";
  const invoiceCustomerId =
    invoice?.customer_id && typeof invoice.customer_id === "object"
      ? text(invoice.customer_id._id)
      : text(invoice?.customer_id);
  const resolvedCustomerId = partyCustomerId || invoiceCustomerId;
  const displayCustomerName = partyCustomerName || customerName(invoice);
  const dueAmount = paymentDocs.reduce((sum, doc) => sum + dueOfInvoice(doc), 0);
  const invoiceNumbersLabel = partyMode ? "—" : paymentDocs.map(invoiceNumberOf).join(", ");
  const totalLineAmount = useMemo(
    () => paymentDocs.reduce((sum, doc) => sum + Math.max(0, Number(lineAmounts[doc._id]) || 0), 0),
    [lineAmounts, paymentDocs],
  );
  const preferredMethods = useMemo(() => {
    const configured = paymentMethods.map((item) => item.name).filter(Boolean);
    const invoiceSpecific = Array.isArray(invoice?.payment_method) ? invoice.payment_method.filter(Boolean) : [];
    return [...new Set([...invoiceSpecific, ...configured])];
  }, [invoice?.payment_method, paymentMethods]);

  useEffect(() => {
    if (!open) return;
    setCustomerId(resolvedCustomerId);
    setCustomerQuery(displayCustomerName);
    setPaymentDate(todayInput());
    setPaymentSerial("");
    setMethod(preferredMethods[0] || "Cash");
    setLineAmounts(initLineAmountsForDocs(paymentDocs));
    setAmount(dueAmount > 0 ? dueAmount.toFixed(2) : "0.00");
    setNotes("");
    setInternalNotes("");
    setEditingPaymentId(null);
  }, [open, preferredMethods, dueAmount, invoiceId, paymentDocs, resolvedCustomerId, displayCustomerName]);

  const { data: paymentsData, isFetching } = useQuery({
    queryKey: ["invoice-payments", paymentDocIdsKey],
    queryFn: async () => {
      if (partyMode && partyCustomerId) {
        const received = await fetchPaymentReceived({
          customer_id: partyCustomerId,
          limit: 100,
          sort: "-date",
        });
        return { received: received.rows, direct: [] as BackendInvoicePaymentDoc[] };
      }
      const perInvoice = await Promise.all(
        paymentDocIds.map(async (id) => {
          const [received, direct] = await Promise.all([
            fetchPaymentReceived({ invoice_id: id, limit: 100, sort: "-date" }),
            fetchInvoiceDirectPayments(id),
          ]);
          return { received: received.rows, direct };
        }),
      );
      const received = perInvoice.flatMap((item) => item.received);
      const direct = perInvoice.flatMap((item) => item.direct);
      const seenReceived = new Set<string>();
      const dedupedReceived = received.filter((row) => {
        if (seenReceived.has(row._id)) return false;
        seenReceived.add(row._id);
        return true;
      });
      const seenDirect = new Set<string>();
      const dedupedDirect = direct.filter((row) => {
        if (seenDirect.has(row._id)) return false;
        seenDirect.add(row._id);
        return true;
      });
      return { received: dedupedReceived, direct: dedupedDirect };
    },
    enabled: open && (partyMode || paymentDocIds.length > 0),
    placeholderData: (prev) => prev,
  });

  const invoiceNumberForReceived = (payment: BackendPaymentReceivedDoc) => {
    const fromNumber = text(payment.invoice_number);
    if (fromNumber) return fromNumber.replace(/^#/, "");
    const invRef = payment.invoice_id;
    if (invRef && typeof invRef === "object") {
      const fromRef = text(invRef.invoice_number);
      if (fromRef) return fromRef.replace(/^#/, "");
    }
    const invId = typeof invRef === "string" ? invRef : text((invRef as { _id?: string } | null)?._id);
    const doc = invId ? paymentDocs.find((item) => item._id === invId) : undefined;
    return doc ? invoiceNumberOf(doc) : text(invoice?.invoice_number).replace(/^#/, "") || "—";
  };

  const invoiceNumberForDirect = (payment: BackendInvoicePaymentDoc) => {
    const doc = payment.invoice_id ? paymentDocs.find((item) => item._id === payment.invoice_id) : undefined;
    return doc ? invoiceNumberOf(doc) : text(invoice?.invoice_number).replace(/^#/, "") || "—";
  };

  const payments = useMemo<UnifiedPayment[]>(() => {
    const received = (paymentsData?.received ?? []).map((payment, index) => ({
      id: payment._id,
      serial: text(payment.payment_number) || `PR-${String(index + 1).padStart(4, "0")}`,
      invoiceNumber: invoiceNumberForReceived(payment),
      dateLabel: dateLabel(payment.date ?? payment.createdAt),
      timestamp: new Date(payment.date ?? payment.createdAt ?? 0).getTime() || 0,
      amount: numberValue(payment.total ?? payment.sub_total),
      currency: text(payment.currency) || text(invoice?.currency) || "USD",
      method: firstPaymentMethod(payment),
      notes: text(payment.notes),
      internalNotes: text(payment.internal_notes),
      attachment: text(payment.Attachment),
      source: "paymentReceived" as const,
    }));
    const direct = (paymentsData?.direct ?? []).map((payment: BackendInvoicePaymentDoc, index) => ({
      id: payment._id,
      serial: text(payment.payment_number) || `PAY-${String(index + 1).padStart(4, "0")}`,
      invoiceNumber: invoiceNumberForDirect(payment),
      dateLabel: dateLabel(payment.payment_date ?? payment.createdAt),
      timestamp: new Date(payment.payment_date ?? payment.createdAt ?? 0).getTime() || 0,
      amount: numberValue(payment.amount),
      currency: text(invoice?.currency) || "USD",
      method: text(payment.payment_type) || "Cash",
      notes: text(payment.notes),
      internalNotes: text(payment.internal_notes),
      attachment: text(payment.attachments),
      source: "payment" as const,
    }));
    const local = localPaymentsReceived
      .filter((payment) => allowedLocalInvoiceKeys.has(String(payment.invoiceId ?? "")))
      .map((payment, index) => ({
        id: `local-${payment.id}`,
        serial: text(payment.number) || `PR-LOCAL-${String(index + 1).padStart(4, "0")}`,
        invoiceNumber: text(payment.invoiceNumber) || text(invoice?.invoice_number),
        dateLabel: dateLabel(payment.date),
        timestamp: new Date(payment.date ?? 0).getTime() || 0,
        amount: numberValue(payment.amount ?? payment.total ?? payment.subTotal),
        currency: text(payment.currency) || text(invoice?.currency) || "USD",
        method: text(payment.method) || "Cash",
        notes: text(payment.notes),
        internalNotes: text(payment.internalNotes),
        attachment: text(payment.Attachment || payment.attachments),
        source: "paymentReceived" as const,
      }));
    const merged = [...direct, ...received, ...local].sort((a, b) => b.timestamp - a.timestamp);
    return merged.filter((payment, index, arr) => arr.findIndex((item) => item.id === payment.id && item.source === payment.source) === index);
  }, [allowedLocalInvoiceKeys, invoice, invoiceCustomerId, localPaymentsReceived, paymentDocs, paymentsData]);

  const customerSearch = useQuery({
    queryKey: ["invoice-payment-customers", customerQuery],
    queryFn: async () => fetchCustomers({ page: 1, limit: 20, searchTerm: customerQuery.trim() || undefined }),
    staleTime: 30_000,
    enabled: open && showForm,
  });
  const customerOptions = customerSearch.data?.rows ?? [];
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(event.target as Node)) setCustomerOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const nextPaymentNumber = useMemo(
    () =>
      `PAY-${String(
        (partyMode ? payments.length : payments.filter((payment) => payment.source === "payment").length) + 1,
      ).padStart(4, "0")}`,
    [payments, partyMode],
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
    setEditingPaymentId(null);
    setSelectedPaymentId("");
    setCustomerId(resolvedCustomerId);
    setCustomerQuery(displayCustomerName);
    setPaymentSerial(nextPaymentNumber);
    setMethod(preferredMethods[0] || "Cash");
    setLineAmounts(initLineAmountsForDocs(paymentDocs));
    setAmount(dueAmount > 0 ? dueAmount.toFixed(2) : partyMode ? "0.00" : "0.00");
    setPaymentDate(todayInput());
    setNotes("");
    setInternalNotes("");
  };

  const openEditForm = () => {
    if (!selectedPayment) return;
    setEditingPaymentId(selectedPayment.id);
    setShowForm(true);
    setSelectedPaymentId(selectedPayment.id);
    setCustomerId(resolvedCustomerId);
    setCustomerQuery(displayCustomerName);
    setPaymentSerial(selectedPayment.serial);
    setPaymentDate(inputDateValue(selectedPayment.dateLabel));
    setMethod(selectedPayment.method || preferredMethods[0] || "Cash");
    setAmount(selectedPayment.amount.toFixed(2));
    setNotes(selectedPayment.notes);
    setInternalNotes(selectedPayment.internalNotes);
    setAttachment(selectedPayment.attachment || "");
  };

  const persistPaymentAttachment = async (path: string) => {
    if (!selectedPayment) {
      showToast("Save the document first", "error");
      throw new Error("missing payment");
    }
    if (selectedPayment.source === "paymentReceived") {
      await updatePaymentReceived(selectedPayment.id, { Attachment: path });
    } else {
      await updateInvoicePayment(selectedPayment.id, { attachments: path || undefined });
    }
    await refreshPayments();
    showToast(path ? "Attachment saved" : "Attachment removed", "success");
  };

  const refreshPayments = async () => {
    await queryClient.invalidateQueries({ queryKey: ["invoice-payments", paymentDocIdsKey] });
    await queryClient.invalidateQueries({ queryKey: ["payment-received-list"] });
    await Promise.all(
      paymentDocIds.map((id) =>
        queryClient.invalidateQueries({ queryKey: ["sales-invoice-backend-detail", id] }),
      ),
    );
  };

  const savePaymentMut = useMutation({
    mutationFn: async () => {
      const serial = text(paymentSerial) || nextPaymentNumber;
      const sharedCustomer = customerId || resolvedCustomerId;

      if (partyMode) {
        const parsedAmount = Math.max(0, Number(amount) || 0);
        if (!sharedCustomer) throw new Error("No customer");
        if (parsedAmount <= 0) throw new Error("Enter a payment amount");
        if (editingPaymentId) {
          return updatePaymentReceived(editingPaymentId, {
            customer_id: sharedCustomer,
            payment_number: serial,
            date: paymentDate,
            payment_method: [method || "Cash"],
            notes,
            internal_notes: internalNotes,
            Attachment: attachment || undefined,
            total: parsedAmount,
            sub_total: parsedAmount,
            product: [],
            service: [],
          });
        }
        return createPaymentReceived({
          customer_id: sharedCustomer,
          customer_name: displayCustomerName || undefined,
          payment_number: serial,
          date: paymentDate,
          payment_method: [method || "Cash"],
          notes,
          internal_notes: internalNotes,
          Attachment: attachment || undefined,
          product: [],
          service: [],
          sub_total: parsedAmount,
          total: parsedAmount,
        });
      }

      if (editingPaymentId && selectedPayment && invoice) {
        const parsedAmount = Math.max(0, Number(amount) || 0);
        if (selectedPayment.source === "paymentReceived") {
          return updatePaymentReceived(editingPaymentId, {
            customer_id: sharedCustomer || undefined,
            invoice_id: invoiceId || undefined,
            invoice_number: text(invoice.invoice_number) || undefined,
            payment_number: serial,
            currency: text(invoice.currency) || undefined,
            date: paymentDate,
            payment_method: [method || "Cash"],
            notes,
            internal_notes: internalNotes,
            Attachment: attachment || undefined,
            total: parsedAmount,
            sub_total: parsedAmount,
            product: [],
            service: [],
          });
        }
        return updateInvoicePayment(editingPaymentId, {
          customer_id: sharedCustomer,
          invoice_id: invoiceId,
          payment_number: serial,
          payment_date: paymentDate,
          payment_type: method || "Cash",
          amount: parsedAmount,
          notes,
          internal_notes: internalNotes,
          attachments: attachment || undefined,
          type: "invoice",
        });
      }

      if (paymentDocs.length > 1) {
        const customerKeys = [...new Set(paymentDocs.map((doc) => invoiceCustomerIdOf(doc)).filter(Boolean))];
        if (customerKeys.length > 1) {
          throw new Error("Selected invoices must belong to the same customer");
        }
      }

      const creates = paymentDocs
        .map((doc) => ({
          doc,
          parsedAmount: Math.max(0, Number(lineAmounts[doc._id]) || 0),
        }))
        .filter(({ parsedAmount }) => parsedAmount > 0);

      if (creates.length === 0) {
        throw new Error("Enter a payment amount");
      }

      const customerForCreate = sharedCustomer || invoiceCustomerIdOf(paymentDocs[0]);

      return Promise.all(
        creates.map(({ doc, parsedAmount }, index) =>
          createInvoicePayment({
            customer_id: customerForCreate,
            invoice_id: doc._id,
            payment_number: index === 0 ? serial : `${serial}-${index + 1}`,
            payment_date: paymentDate,
            payment_type: method || "Cash",
            amount: parsedAmount,
            notes,
            internal_notes: internalNotes,
            attachments: attachment || undefined,
            type: "invoice",
          }),
        ),
      );
    },
    onSuccess: () => {
      refreshPayments();
      showToast(editingPaymentId ? "Payment updated" : "Payment saved", "success");
      setEditingPaymentId(null);
      setShowForm(false);
      onSaved?.();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "";
      showToast(message || (editingPaymentId ? "Payment update failed" : "Payment save failed"), "error");
    },
  });

  const saveDisabled =
    savePaymentMut.isPending ||
    (partyMode || editingPaymentId ? !(Number(amount) > 0) : totalLineAmount <= 0);

  const deletePaymentMut = useMutation({
    mutationFn: async () => {
      if (!selectedPayment) throw new Error("No payment selected");
      if (selectedPayment.source === "paymentReceived") {
        await deletePaymentReceived(selectedPayment.id);
        return;
      }
      await deleteInvoicePayment(selectedPayment.id);
    },
    onSuccess: async () => {
      await refreshPayments();
      setSelectedPaymentId("");
      showToast("Payment deleted", "success");
    },
    onError: () => {
      showToast("Could not delete payment", "error");
    },
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
                <div>${displayCustomerName}</div>
                <div>${partyMode ? "" : customerSubtitle(invoice) || ""}</div>
              </div>
              <table>
                <tr><td><strong>Payment #</strong></td><td>${selectedPayment.serial}</td></tr>
                <tr><td><strong>Payment date</strong></td><td>${selectedPayment.dateLabel}</td></tr>
                <tr><td><strong>Payment Type</strong></td><td>${selectedPayment.method}</td></tr>
                <tr><td><strong>Amount</strong></td><td>${currencyLabel(selectedPayment.amount, selectedPayment.currency)}</td></tr>
              </table>
            </div>
            <div class="amount">${currencyLabel(selectedPayment.amount, selectedPayment.currency)}</div>
            <div class="section"><strong>Invoice</strong><div>${selectedPayment.invoiceNumber ? `#${selectedPayment.invoiceNumber}` : "—"}</div></div>
            <div class="section"><strong>Notes</strong><div>${selectedPayment.notes || "No Notes"}</div></div>
            <div class="section"><strong>Internal Notes</strong><div>${selectedPayment.internalNotes || "No Internal Notes"}</div></div>
          </div>
        </body>
      </html>
    `;

    if (mode === "email") {
      const subject = encodeURIComponent(title);
      const mailBody = encodeURIComponent(
        `Customer: ${displayCustomerName}\nPayment #: ${selectedPayment.serial}\nInvoice: ${selectedPayment.invoiceNumber ? `#${selectedPayment.invoiceNumber}` : "—"}\nPayment date: ${selectedPayment.dateLabel}\nPayment type: ${selectedPayment.method}\nAmount: ${currencyLabel(selectedPayment.amount, selectedPayment.currency)}\n\nNotes: ${selectedPayment.notes || "No Notes"}`,
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

  if (!open || (!invoice && !partyMode)) return null;

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
                <h2 className="text-lg font-semibold">Payment Received</h2>
              </div>

              <div className={`border-b px-4 py-3 ${modalSidebar}`}>
                <button
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
                      onClick={() => {
                        setSelectedPaymentId(payment.id);
                        setShowForm(false);
                      }}
                      className={`w-full border-b border-gray-300 px-4 py-3 text-left transition-colors ${active ? "bg-gray-100" : modalHover}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-gray-900">{displayCustomerName}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{payment.serial}</div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">{payment.notes || "No Notes"}</div>
                        </div>
                        <div className="flex max-w-[140px] min-w-0 flex-col items-end">
                          <span className="truncate text-xs text-gray-500">{payment.dateLabel}</span>
                          <span className="mt-0.5 text-sm font-semibold text-gray-900">{currencyLabel(payment.amount, payment.currency)}</span>
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
                  {currencyLabel(payments.reduce((sum, item) => sum + item.amount, 0), text(invoice?.currency))}
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
                    <h3 className="text-lg font-semibold text-gray-900">{editingPaymentId ? "Edit Payment" : "Add Payment"}</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!resolvedCustomerId && !customerId) {
                            showToast("Select a customer", "warning");
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
                        onClick={() => {
                          if (!resolvedCustomerId && !customerId) {
                            showToast("Select a customer", "warning");
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
                        <input value={paymentSerial || nextPaymentNumber} onChange={(e) => setPaymentSerial(e.target.value)} className={fieldClass} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Customer</label>
                        <div className="relative" ref={customerRef}>
                          <input
                            value={customerQuery}
                            onFocus={() => setCustomerOpen(true)}
                            onChange={(e) => { setCustomerQuery(e.target.value); setCustomerOpen(true); }}
                            placeholder="Search customer"
                            className={fieldClass}
                          />
                          {customerOpen && (
                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                              {customerOptions.map((customer: TCustomerRow) => (
                                <button
                                  key={customer._id}
                                  type="button"
                                  onClick={() => {
                                    setCustomerId(customer._id);
                                    setCustomerQuery(customer.name);
                                    setCustomerOpen(false);
                                  }}
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  {customer.name}
                                </button>
                              ))}
                              {customerOptions.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Invoice #</label>
                        <input value={invoiceNumbersLabel} readOnly className={fieldClass} />
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs text-gray-500">Payment date</label>
                          <AppDatePicker value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={fieldClass} />
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
                        {partyMode || editingPaymentId ? (
                          <div className="mt-1 flex items-center gap-2">
                            {!partyMode && invoice && (
                              <button
                                type="button"
                                onClick={() => setAmount(dueOfInvoice(invoice).toFixed(2))}
                                className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                              >
                                Full Payment
                              </button>
                            )}
                            <input
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2.5 text-right text-sm text-gray-900"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {paymentDocs.map((doc) => (
                              <div key={doc._id} className="mt-1 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLineAmounts((prev) => ({
                                      ...prev,
                                      [doc._id]: dueOfInvoice(doc).toFixed(2),
                                    }))
                                  }
                                  className="whitespace-nowrap rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                  Full Payment
                                </button>
                                <span className="min-w-[7rem] truncate text-sm text-gray-700">{invoiceNumberOf(doc)}</span>
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
                            {currencyLabel(dueAmount, text(invoice?.currency))}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Notes</label>
                        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 h-20 w-full resize-none rounded-md border border-gray-300 p-3 text-sm outline-none" />
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
                      <h3 className="truncate text-base font-semibold tracking-tight text-gray-900">{displayCustomerName}</h3>
                      {customerSubtitle(invoice) && <p className="truncate text-xs text-gray-500">{customerSubtitle(invoice)}</p>}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button title="Edit" onClick={openEditForm} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button title="Preview" onClick={() => openReceiptWindow("preview")} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button title="Print" onClick={() => openReceiptWindow("print")} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                        <Printer className="h-4 w-4" />
                      </button>
                      <button title="Email" onClick={() => openReceiptWindow("email")} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                        <Mail className="h-4 w-4" />
                      </button>
                      <Dropdown
                        align="right"
                        panelClass="w-48"
                        trigger={<span className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"><MoreVertical className="h-4 w-4" /></span>}
                      >
                        {(close) => (
                          <>
                            <button onClick={() => { openEditForm(); close(); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                              Edit
                              <Pencil className="h-4 w-4 text-gray-400" />
                            </button>
                            <button onClick={() => { deletePaymentMut.mutate(); close(); }} disabled={deletePaymentMut.isPending} className="flex w-full items-center gap-2 border-t border-gray-200 px-3 py-2 text-left text-sm text-red-500 hover:bg-gray-50 disabled:opacity-50">
                              <Trash2 className="h-4 w-4" />
                              {deletePaymentMut.isPending ? "Deleting..." : "Trash"}
                            </button>
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-b border-gray-300 px-5 py-3">
                    <div>
                      <div className="text-xs text-gray-500">{selectedPayment.serial}</div>
                      <div className="text-sm font-semibold text-gray-900">{currencyLabel(selectedPayment.amount, selectedPayment.currency)}</div>
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
                    <div className="border-b border-gray-300 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">Invoices</div>
                    <div className="flex items-center justify-between px-5 py-4 text-sm text-gray-900">
                      <span>{selectedPayment.invoiceNumber ? `#${selectedPayment.invoiceNumber}` : "—"}</span>
                      <span className="font-semibold text-gray-900">{currencyLabel(selectedPayment.amount, selectedPayment.currency)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 border-b border-gray-300 md:grid-cols-2">
                    <div className="border-b border-gray-300 px-5 py-3 md:border-b-0 md:border-r md:border-gray-200">
                      <div className="mb-2 text-sm font-semibold text-gray-900">Notes</div>
                      <div className="text-sm text-gray-600">{selectedPayment.notes || "No Notes"}</div>
                    </div>
                    <div className="px-5 py-3">
                      <div className="mb-2 text-sm font-semibold text-gray-900">Internal Notes</div>
                      <div className="text-sm text-gray-600">{selectedPayment.internalNotes || "No Internal Notes"}</div>
                    </div>
                  </div>

                  <div className="px-5 py-4 max-w-md">
                    <DocAttachmentField
                      value={selectedPayment.attachment || ""}
                      onChange={persistPaymentAttachment}
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

export default InvoicePaymentsModal;
