/**
 * File: src/pages/sales/CreateInvoiceForm.tsx
 * Inline create form for Invoice / Proforma / Estimate — shared SS layout.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, Pencil, ChevronDown, X, Plus, Check, Info } from "lucide-react";
import { useCollection, repo, nextNumber, CreateContactModal } from "@/lib/db";
import { db } from "@/lib/db/db";
import { numericId } from "@/lib/db/sync";
import { showToast } from "@/utils/toast";
import { useAppSettings, isLayoutSettingOn, DOC_LAYOUTS, type DocLayoutId } from "@/lib/db/appSettings";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PaymentMethodsModal } from "@/components/modals/PaymentMethodsModal";
import { CurrencyCombobox } from "@/components/forms/CurrencyCombobox";
import { SalespersonField } from "@/components/forms/SalespersonField";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { LineItemSuggestFlyout } from "@/components/ui/LineItemSuggestFlyout";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { DocumentCreateHeader, type SendMenuAction } from "@/components/documents/DocumentCreateHeader";
import { DocumentSendEmailModal } from "@/components/documents/DocumentSendEmailModal";
import { DOC_FIELD, RECURRING_OPTIONS, isRecurringActive } from "@/components/documents/documentCreateShared";
import { PdfPreviewModal } from "@/lib/db/PdfPreviewModal";
import { printServerPdf } from "@/lib/db/serverPdf";
import { toIsoDate, todayIso } from "@/lib/dateIso";
import { fetchCustomer, fetchCustomers } from "@/services/customersApi";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { LineTaxSelect } from "@/components/forms/LineTaxSelect";
import type { EmailNavKey } from "@/services/emailTemplatesApi";

type DraftRow = {
  key: string;
  kind: "product" | "service";
  name: string;
  description: string;
  qty: number;
  rate: number;
  mrp: number;
  taxId: number;
  taxRate: number;
  discount: number;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const formatCurrencyValue = (amount: number, currencyCode: string) => {
  const code = text(currencyCode).toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  } catch {
    return `${code} ${(amount || 0).toFixed(2)}`;
  }
};
const mapAddr = (address?: { address_line_1?: string; address_line_2?: string; city?: string; state?: string; zip_code?: string; country?: string }) => ({
  street1: text(address?.address_line_1),
  street2: text(address?.address_line_2),
  city: text(address?.city),
  state: text(address?.state),
  zip: text(address?.zip_code),
  country: text(address?.country),
});

const EMAIL_NAV: Record<string, EmailNavKey> = {
  invoice: "invoice",
  proforma: "proforma_invoice",
  estimate: "estimate",
};

export const CreateInvoiceForm: React.FC<{
  onClose: () => void;
  onSaved: (id: number) => void;
  invoice?: any;
  mode?: "invoice" | "proforma" | "estimate";
  prefillCustomer?: {
    localId?: number;
    backendId?: string;
    name?: string;
    email?: string;
  };
}> = ({ onClose, onSaved, invoice, mode = "invoice", prefillCustomer }) => {
  const isEdit = !!(invoice?.id || invoice?._id);
  const isProforma = mode === "proforma";
  const isEstimate = mode === "estimate";
  const isInvoice = mode === "invoice";
  const collection = isProforma ? "proformas" : isEstimate ? "estimates" : "invoices";
  const docLabel = isProforma ? "Proforma Invoice" : isEstimate ? "Estimate" : "Invoice";
  const pdfDocType = isProforma ? "proformaInvoice" : isEstimate ? "estimate" : "invoice";
  const settingsSection = isProforma ? "doc:proformaInvoice" : isEstimate ? "doc:estimate" : "doc:invoice";
  const layoutId: DocLayoutId = isProforma ? "proformaInvoice" : isEstimate ? "estimate" : "invoice";
  const layout = DOC_LAYOUTS[layoutId];
  const docSettings = useAppSettings(settingsSection);
  const show = (key: string) => isLayoutSettingOn(layout.fieldKeys, docSettings?.fieldVisibility, key);
  const showCol = (key: string) => isLayoutSettingOn(layout.columnKeys, docSettings?.columns, key);
  const showSum = (key: string) => isLayoutSettingOn(layout.summaryKeys, docSettings?.summary, key);
  const showPay = (key: string) => layout.showPayment && !!docSettings?.payment?.[key];
  const lineOption = docSettings?.general?.lineOption || "Both";
  const allowProduct = lineOption === "Both" || lineOption === "Product";
  const allowService = lineOption === "Both" || lineOption === "Service";
  const qtyMode = docSettings?.columnsQuantity || "Show for Both";
  const showQtyCol = layout.showQuantitySelect && (
    qtyMode === "Show for Both" || qtyMode === "Show for Product" || qtyMode === "Show for Service"
  );
  const showQtyFor = (kind: "product" | "service") => {
    if (!showQtyCol) return false;
    if (qtyMode === "Show for Both") return true;
    if (qtyMode === "Show for Product") return kind === "product";
    return kind === "service";
  };
  const negParen = showSum("Negative Value format with ( )");
  const showLineTax = showSum("Show Line Total with Tax");
  const descFullWidth = showCol("Line description full width");
  const showItemName = (kind: "product" | "service") =>
    kind === "product" ? showCol("Product Name") : showCol("Service Name");
  const showDesc = showCol("Description");
  const showDescSug = showCol("Description In Suggestion List");
  const showItemCodeSug = showCol("Item Code in Suggestion List");
  const createPublicUrl = layout.showPublicUrl && docSettings?.general?.createPublicUrlInEmail !== false;
  const markSentOnPrint = isLayoutSettingOn(layout.printKeys, docSettings?.printEmail, "Mark as Sent on Print");
  const markSentOnEmail = isLayoutSettingOn(layout.printKeys, docSettings?.printEmail, "Mark as Sent on Email/WhatsApp");

  const customers = useCollection<any>("customers", "name");
  const products = useCollection<any>("products", "name");
  const services = useCollection<any>("services", "name");
  const catalog = useMemo(
    () => [
      ...products.map((p) => ({
        key: "p" + p.id,
        kind: "product" as const,
        name: p.name,
        rate: p.price || 0,
        taxId: p.taxId || 0,
        taxRate: Number(p.taxRate) || 0,
        stock: p.stock ?? null,
        description: p.note || p.description || "",
      })),
      ...services.map((s) => ({
        key: "s" + s.id,
        kind: "service" as const,
        name: s.name,
        rate: s.price || 0,
        taxId: s.taxId || 0,
        taxRate: Number(s.taxRate) || 0,
        stock: null as number | null,
        description: s.note || s.description || "",
      })),
    ],
    [products, services],
  );

  const [custQuery, setCustQuery] = useState(
    prefillCustomer?.name || invoice?.customerName || "",
  );
  const [customerId, setCustomerId] = useState<number | "">(invoice?.customerId ?? prefillCustomer?.localId ?? "");
  const [customerBackendId, setCustomerBackendId] = useState<string>(
    prefillCustomer?.backendId || invoice?.customerBackendId || "",
  );
  const [customerEmail, setCustomerEmail] = useState<string>(
    prefillCustomer?.email || invoice?.customerEmail || "",
  );
  const [custOpen, setCustOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addContact, setAddContact] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ id: number; number: string; backendId?: string } | null>(null);
  const cref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (cref.current && !cref.current.contains(e.target as Node)) setCustOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const customerSearch = useQuery({
    queryKey: ["invoice-form-customers", custQuery],
    queryFn: () => fetchCustomers({ page: 1, limit: 50, searchTerm: custQuery.trim() || undefined }),
    placeholderData: (prev) => prev,
    staleTime: 20_000,
  });
  const matches = useMemo(() => {
    const remoteRows = customerSearch.data?.rows ?? [];
    if (remoteRows.length > 0 || custQuery.trim()) return remoteRows;
    return customers.map((c) => ({ id: c.id, _id: c._id || String(c.id), name: c.name, contact: "", email: c.email || "", amount: 0, status: "Active" }));
  }, [customerSearch.data, custQuery, customers]);

  const emptyAddr = { street1: "", street2: "", city: "", state: "", zip: "", country: "" };
  const [addrOpen, setAddrOpen] = useState(false);
  const [billing, setBilling] = useState({
    street1: invoice?.street1 || "",
    street2: invoice?.street2 || "",
    city: invoice?.city || "",
    state: invoice?.state || "",
    zip: invoice?.zip || "",
    country: invoice?.country || "",
  });
  const [shipping, setShipping] = useState({
    street1: invoice?.shipStreet1 || "",
    street2: invoice?.shipStreet2 || "",
    city: invoice?.shipCity || "",
    state: invoice?.shipState || "",
    zip: invoice?.shipZip || "",
    country: invoice?.shipCountry || "",
  });
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [updateToCustomer, setUpdateToCustomer] = useState(false);
  const { data: paymentMethodOptions = [] } = useQuery({
    queryKey: ["invoice-form-payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(invoice?.payment_method ?? invoice?.paymentMethod ?? []);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);

  useEffect(() => {
    const p: any = customers.find((c) => c.id === customerId);
    if (!p) return;
    setBilling({ street1: p.street1 || "", street2: p.street2 || "", city: p.city || "", state: p.state || "", zip: p.zip || "", country: p.country || "" });
    setShipping({ street1: p.shipStreet1 || "", street2: p.shipStreet2 || "", city: p.shipCity || "", state: p.shipState || "", zip: p.shipZip || "", country: p.shipCountry || "" });
    if (p.email) setCustomerEmail(String(p.email));
    if (p.name && !custQuery) setCustQuery(String(p.name));
  }, [customerId, customers]);
  useEffect(() => {
    if (!prefillCustomer) return;
    if (prefillCustomer.backendId) setCustomerBackendId(prefillCustomer.backendId);
    if (prefillCustomer.name) setCustQuery(prefillCustomer.name);
    if (prefillCustomer.email) setCustomerEmail(prefillCustomer.email);
    if (prefillCustomer.localId != null) setCustomerId(prefillCustomer.localId);
  }, [prefillCustomer]);
  useEffect(() => {
    if (!customerBackendId) return;
    let active = true;
    fetchCustomer(customerBackendId).then(async (doc) => {
      if (!active || !doc) return;
      const billingAddr = mapAddr(doc.businessProfile?.billing_address);
      const shippingAddr = mapAddr(doc.businessProfile?.shipping_address);
      setBilling(billingAddr);
      setShipping(shippingAddr);
      if (doc.email) setCustomerEmail(doc.email);
      const existingLocal = customers.find((item) => item._id === doc._id);
      if (existingLocal) {
        setCustomerId(existingLocal.id);
        if (existingLocal.email) setCustomerEmail(String(existingLocal.email));
        return;
      }
      const localId = await repo.add("customers", {
        _id: doc._id,
        name: doc.businessProfile?.companyName || doc.name || "(No name)",
        contact: doc.name || "",
        email: doc.email || "",
        street1: billingAddr.street1,
        street2: billingAddr.street2,
        city: billingAddr.city,
        state: billingAddr.state,
        zip: billingAddr.zip,
        country: billingAddr.country,
        shipStreet1: shippingAddr.street1,
        shipStreet2: shippingAddr.street2,
        shipCity: shippingAddr.city,
        shipState: shippingAddr.state,
        shipZip: shippingAddr.zip,
        shipCountry: shippingAddr.country,
      });
      setCustomerId(localId as number);
    });
    return () => { active = false; };
  }, [customerBackendId, customers]);
  const shipVal = (k: keyof typeof emptyAddr) => (sameAsBilling ? billing[k] : shipping[k]);

  const [date, setDate] = useState(toIsoDate(invoice?.date) || todayIso());
  const [due, setDue] = useState(toIsoDate(invoice?.due) || todayIso());
  const [notes, setNotes] = useState(invoice?.notes ?? "Mollit fugiat elit");
  const [terms, setTerms] = useState(invoice?.terms ?? "Perferendis ad vero");
  const [internalNotes, setInternalNotes] = useState(invoice?.internalNotes ?? "");
  const [currency, setCurrency] = useState(invoice?.currency || "BDT");
  const [subTitle, setSubTitle] = useState(invoice?.subTitle ?? "");
  const [poNumber, setPoNumber] = useState(invoice?.poNumber ?? "");
  const [poDate, setPoDate] = useState(toIsoDate(invoice?.poDate) || "");
  const [recipientName, setRecipientName] = useState(invoice?.recipientName ?? "");
  const [salesperson, setSalesperson] = useState(() => {
    const sp = invoice?.salesperson;
    if (sp && typeof sp === "object") return String(sp.name || "");
    return typeof sp === "string" && !/^[a-f\d]{24}$/i.test(sp) ? sp : (invoice?.salespersonName ?? "");
  });
  const [salespersonId, setSalespersonId] = useState(() => {
    const sp = invoice?.salesperson;
    if (sp && typeof sp === "object") return String(sp._id || "");
    if (invoice?.salespersonId) return String(invoice.salespersonId);
    if (typeof sp === "string" && /^[a-f\d]{24}$/i.test(sp)) return sp;
    return "";
  });
  const [shippingMethod, setShippingMethod] = useState(invoice?.shippingMethod ?? "");
  const [shippingTax, setShippingTax] = useState(String(invoice?.shippingTax ?? ""));
  const [customCharges, setCustomCharges] = useState(String(invoice?.customCharges ?? ""));
  const [roundOff, setRoundOff] = useState(String(invoice?.roundOff ?? ""));
  const [cashDenomination, setCashDenomination] = useState(invoice?.cashDenomination ?? "");
  const [discountBeforeTax, setDiscountBeforeTax] = useState(!!invoice?.discountBeforeTax);
  const [recurring, setRecurring] = useState(invoice?.recurring ?? "None");
  const [recurringUntil, setRecurringUntil] = useState(toIsoDate(invoice?.recurringUntil) || todayIso());
  const [deposit, setDeposit] = useState(invoice?.deposit ?? "");
  const [docDiscount, setDocDiscount] = useState(invoice?.docDiscount ?? "");
  const [shippingCost, setShippingCost] = useState(String(invoice?.shipping ?? ""));
  const [attachment, setAttachment] = useState(invoice?.Attachment || invoice?.attachments || "");

  const [rows, setRows] = useState<DraftRow[]>(
    invoice?.items?.length
      ? invoice.items.map((it: any) => ({
          key: "",
          kind: "product" as const,
          name: it.name || "",
          description: it.description || "",
          qty: it.qty ?? 1,
          rate: it.rate ?? 0,
          mrp: it.mrp ?? 0,
          taxId: it.taxId || 0,
          taxRate: Number(it.taxRate ?? it.tax) || 0,
          discount: it.discount || 0,
        }))
      : [
          { key: "", kind: "product", name: "", description: "", qty: 1, rate: 0, mrp: 0, taxId: 0, taxRate: 0, discount: 0 },
          { key: "", kind: "service", name: "", description: "", qty: 1, rate: 0, mrp: 0, taxId: 0, taxRate: 0, discount: 0 },
        ],
  );
  const [sugRow, setSugRow] = useState<number | null>(null);
  const [sortRecent, setSortRecent] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [cols, setCols] = useState({
    qty: true,
    mrp: true,
    tax: true,
    discount: true,
    autoFit: true,
  });
  // Sync column visibility from App Settings (local gear can still override for this session).
  useEffect(() => {
    setCols({
      qty: showQtyCol,
      mrp: showCol("MRP"),
      tax: showCol("Tax"),
      discount: showCol("Discount"),
      autoFit: showCol("Auto Fit"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    docSettings?.columns?.MRP,
    docSettings?.columns?.Tax,
    docSettings?.columns?.Discount,
    docSettings?.columns?.["Auto Fit"],
    docSettings?.columnsQuantity,
  ]);
  const itemsRef = useRef<HTMLDivElement>(null);
  const sugAnchorRefs = useRef<Record<number, HTMLElement | null>>({});
  const colMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-line-item-suggest]")) return;
      if (t?.closest?.("[data-line-tax-select]")) return;
      if (itemsRef.current && !itemsRef.current.contains(e.target as Node)) setSugRow(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const addRow = (kind: "product" | "service") => {
    setRows((r) => [...r, { key: "", kind, name: "", description: "", qty: 1, rate: 0, mrp: 0, taxId: 0, taxRate: 0, discount: 0 }]);
    setSugRow(rows.length);
  };
  const setRowName = (i: number, name: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, name, key: "" } : row)));
  const setRowDesc = (i: number, description: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, description } : row)));
  const pickSuggestion = (i: number, key: string) => {
    const it = catalog.find((c) => c.key === key);
    if (!it) return;
    setRows((r) =>
      r.map((row, idx) =>
        idx === i
          ? { ...row, key, name: it.name, rate: it.rate, taxId: it.taxId || 0, taxRate: it.taxRate || 0 }
          : row,
      ),
    );
    setRecent((p) => [key, ...p.filter((k) => k !== key)]);
    setSugRow(null);
  };
  const suggestionsFor = (row: DraftRow) => {
    const q = row.name.trim().toLowerCase();
    let list = catalog.filter((c) => c.kind === row.kind && (!q || c.name.toLowerCase().includes(q)));
    if (sortRecent) list = [...list].sort((a, b) => {
      const ia = recent.indexOf(a.key), ib = recent.indexOf(b.key);
      return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    });
    return list;
  };
  const setQty = (i: number, qty: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, qty } : row)));
  const setRate = (i: number, rate: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, rate } : row)));
  const setMrp = (i: number, mrp: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, mrp } : row)));
  const setTax = (i: number, taxId: number, taxRate: number) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, taxId, taxRate } : row)));
  const setDiscount = (i: number, discount: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, discount: Math.min(100, Math.max(0, discount)) } : row)));
  const lineAmount = (r: DraftRow) => r.qty * r.rate * (1 - (r.discount || 0) / 100);
  const removeRow = (i: number) => setRows((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r));

  const subTotal = rows.reduce((s, r) => s + lineAmount(r), 0);
  const inlineDiscount = rows.reduce((s, r) => s + r.qty * r.rate * ((r.discount || 0) / 100), 0);
  const taxTotal = rows.reduce((s, r) => s + lineAmount(r) * ((r.taxRate || 0) / 100), 0);
  const shippingNum = show("Shipping Cost And Method") ? (parseFloat(shippingCost) || 0) : 0;
  const shippingTaxNum = show("Shipping Tax") ? (parseFloat(shippingTax) || 0) : 0;
  const customChargesNum = showSum("Custom Charges") ? (parseFloat(customCharges) || 0) : 0;
  const roundOffNum = showSum("Round Off") ? (parseFloat(roundOff) || 0) : 0;
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const rawTotal = subTotal + taxTotal + shippingNum + shippingTaxNum + customChargesNum + roundOffNum;
  const total = rawTotal;
  const moneyWithCurrency = (amount: number) => {
    const formatted = formatCurrencyValue(amount, currency);
    if (negParen && amount < 0) {
      return `(${formatCurrencyValue(Math.abs(amount), currency)})`;
    }
    return formatted;
  };
  const lineDisplayAmount = (r: DraftRow) => {
    const base = lineAmount(r);
    if (!showLineTax) return base;
    return base * (1 + (r.taxRate || 0) / 100);
  };
  const custDisabled = customerId === "" && !custQuery.trim();

  const persist = async (): Promise<{ id: number; number: string; backendId?: string } | null> => {
    let cid: number | "" = customerId;
    if (cid === "" && custQuery.trim()) {
      cid = (await repo.add("customers", { name: custQuery.trim(), status: "Active", balance: 0 })) as number;
    }
    if (cid === "") return null;
    const items = rows.filter((r) => r.name).map((r, i) => ({
      id: i + 1, name: r.name, description: r.description, qty: r.qty, rate: r.rate, mrp: r.mrp,
      taxId: r.taxId, taxRate: r.taxRate || 0, discount: r.discount || 0, amount: +lineAmount(r).toFixed(2),
    }));
    const common = {
      customerId: cid, date, due, status: "Draft" as const,
      items, subTotal: +subTotal.toFixed(2), tax: +taxTotal.toFixed(2), shipping: shippingNum,
      total: +total.toFixed(2), amountPaid: 0, amountDue: +total.toFixed(2),
      notes, terms, internalNotes, currency,
      subTitle, poNumber, poDate, recipientName, salesperson, salespersonId,
      shippingMethod, shippingTax, discountBeforeTax, recurring,
      recurringUntil: isRecurringActive(recurring) ? recurringUntil : "",
      deposit, docDiscount, shippingCost, customCharges, roundOff, cashDenomination,
      paymentMethod: isInvoice ? selectedPaymentMethods : [],
      payment_method: isInvoice ? selectedPaymentMethods : [],
      inlineDiscount: +inlineDiscount.toFixed(2),
      Attachment: attachment, attachments: attachment,
      street1: billing.street1, street2: billing.street2, city: billing.city, state: billing.state, zip: billing.zip, country: billing.country,
      shipStreet1: shipVal("street1"), shipStreet2: shipVal("street2"), shipCity: shipVal("city"), shipState: shipVal("state"), shipZip: shipVal("zip"), shipCountry: shipVal("country"),
    };
    if (updateToCustomer) {
      await repo.update("customers", cid, {
        street1: billing.street1, street2: billing.street2, city: billing.city, state: billing.state, zip: billing.zip, country: billing.country,
        shipStreet1: shipVal("street1"), shipStreet2: shipVal("street2"), shipCity: shipVal("city"), shipState: shipVal("state"), shipZip: shipVal("zip"), shipCountry: shipVal("country"),
      });
    }
    let id: number;
    let numStr: string;
    let backendId = invoice?._id ? String(invoice._id) : "";
    if (isEdit) {
      numStr = invoice.number || "";
      const localId =
        typeof invoice.id === "number"
          ? invoice.id
          : backendId
            ? numericId(backendId)
            : 0;
      if (!localId) {
        showToast("Cannot update invoice — missing id", "error");
        return null;
      }
      // Ensure a local row exists so repo.update can resolve Mongo `_id`.
      const existing = await (db as any)[collection].get(localId);
      if (!existing && backendId) {
        await (db as any)[collection].put({
          ...common,
          id: localId,
          _id: backendId,
          number: numStr,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      await repo.update(collection, localId, common);
      id = localId;
    } else {
      const n = await nextNumber(collection);
      numStr = "#" + n;
      id = (await repo.add(collection, { number: numStr, ts: Date.now(), ...common })) as number;
    }
    try {
      const row = await (db as any)[collection].get(id);
      if (row?._id) backendId = String(row._id);
    } catch {
      /* ignore */
    }
    return { id, number: numStr, backendId: backendId || undefined };
  };

  const finishSave = (id: number, closeAfter = true) => {
    onSaved(id);
    if (closeAfter) onClose();
  };

  const saveDraft = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await persist();
      if (saved) finishSave(saved.id);
    } catch {
      /* keep form open on backend failure */
    } finally {
      setSaving(false);
    }
  };

  const saveAndSend = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await persist();
      if (!saved) return;
      onSaved(saved.id);
      setLastSaved(saved);
      if (markSentOnEmail) {
        void repo.update(collection, saved.id, { status: "Sent" }).catch(() => undefined);
      }
      setEmailOpen(true);
    } catch {
      /* keep form open on backend failure */
    } finally {
      setSaving(false);
    }
  };

  const handleSendMenu = async (action: SendMenuAction) => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await persist();
      if (!saved) return;
      onSaved(saved.id);
      setLastSaved(saved);
      if (action === "preview") {
        setPreviewOpen(true);
        return;
      }
      if (action === "print") {
        void printServerPdf(pdfDocType, saved.id, saved.backendId).catch(() => undefined);
        if (markSentOnPrint) {
          void repo.update(collection, saved.id, { status: "Sent" }).catch(() => undefined);
        }
        finishSave(saved.id);
        return;
      }
      if (action === "new") {
        finishSave(saved.id, false);
        setCustomerId("");
        setCustQuery("");
        setCustomerEmail("");
        setRows([
          { key: "", kind: "product", name: "", description: "", qty: 1, rate: 0, mrp: 0, taxId: 0, taxRate: 0, discount: 0 },
          { key: "", kind: "service", name: "", description: "", qty: 1, rate: 0, mrp: 0, taxId: 0, taxRate: 0, discount: 0 },
        ]);
      }
    } catch {
      /* keep form open on backend failure */
    } finally {
      setSaving(false);
    }
  };

  const custRecord = customerId ? customers.find((c) => c.id === customerId) : null;
  const custName = custRecord?.name || custQuery;
  useEffect(() => {
    if (!showSum("Contact Note as Default Note") || invoice?.notes) return;
    const note = (custRecord as any)?.notes || (custRecord as any)?.note;
    if (typeof note === "string" && note.trim()) setNotes(note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, docSettings?.summary?.["Contact Note as Default Note"]]);
  const custEmail = (customerEmail || custRecord?.email || "").trim();
  const docNumber = invoice?.number?.replace?.("#", "") || "80";
  const formTitle = isEdit ? `Edit ${docLabel}` : `Create ${docLabel}`;

  return (
    <section className="module-detail-panel custom-scrollbar flex-1 overflow-y-auto">
      <DocumentCreateHeader
        title={formTitle}
        onSettings={() => setSettingsOpen(true)}
        onCancel={onClose}
        onSaveDraft={() => void saveDraft()}
        onSaveAndSend={() => void saveAndSend()}
        saveDisabled={custDisabled || saving}
        enableSendDropdown={isInvoice}
        onSendMenu={(a) => void handleSendMenu(a)}
      />

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2 relative fl-wrap" ref={cref}>
            <label className="fl-label">Customer *</label>
            <div className="relative">
              <input value={custName} onChange={(e) => { setCustQuery(e.target.value); setCustomerId(""); setCustomerEmail(""); setCustOpen(true); }} onFocus={() => setCustOpen(true)} placeholder="Find or add a customer" className={DOC_FIELD} />
              <button type="button" onClick={() => setAddContact(true)} title="Create Contact" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500"><Pencil className="w-4 h-4" /></button>
            </div>
            {custOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl py-1 max-h-60 overflow-y-auto custom-scrollbar">
                {matches.map((c) => <button key={c._id} type="button" onClick={() => { setCustomerBackendId(c._id); setCustomerId(customers.find((item) => item._id === c._id)?.id ?? ""); setCustQuery(c.name); setCustomerEmail(("email" in c && c.email) ? String(c.email) : ""); setCustOpen(false); setAddrOpen(true); }} className="w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 text-left">{c.name}</button>)}
                {matches.length === 0 && <div className="px-3 py-2.5 text-sm text-gray-400">No customer found — click the pencil to add</div>}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-2 px-1 bg-white text-[11px] text-gray-500 z-10">Address</label>
            <button type="button" onClick={() => setAddrOpen((o) => !o)} className={`w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400 bg-white`}>
              <span /> <ChevronDown className={`w-4 h-4 transition-transform ${addrOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          <div className="relative fl-wrap">
            <label className="fl-label">{docLabel} #</label>
            <div className="relative">
              <input readOnly value={docNumber} placeholder=" " className={DOC_FIELD} />
              <Info className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          <CurrencyCombobox value={currency} onChange={setCurrency} />
          <AppDatePicker floatingLabel={`${docLabel} date *`} value={date} onValueChange={setDate} className={DOC_FIELD} />
          {show("Due Date") && (
            <AppDatePicker floatingLabel="Due Date" value={due} onValueChange={setDue} className={DOC_FIELD} />
          )}
        </div>

        {addrOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 border-b border-gray-300 pb-5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800"><input type="checkbox" defaultChecked className="accent-blue-600" /> Billing</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={updateToCustomer} onChange={() => setUpdateToCustomer((v) => !v)} className="accent-blue-600" /> Update to customer</label>
            </div>
            {show("Shipping Address") ? (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800"><input type="checkbox" defaultChecked className="accent-blue-600" /> Shipping</label>
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={sameAsBilling} onChange={() => setSameAsBilling((v) => !v)} className="accent-blue-600" /> Same as Billing</label>
              </div>
            ) : (
              <div />
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {show("Street 1") && <div className="relative fl-wrap"><label className="fl-label">Street 1</label><input value={billing.street1} onChange={(e) => setBilling((b) => ({ ...b, street1: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                {show("Street 2") && <div className="relative"><input value={billing.street2} onChange={(e) => setBilling((b) => ({ ...b, street2: e.target.value }))} placeholder="Street 2" className={DOC_FIELD} /></div>}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {show("City") && <div className="relative fl-wrap"><label className="fl-label">City</label><input value={billing.city} onChange={(e) => setBilling((b) => ({ ...b, city: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                {show("State") && <div className="relative"><input value={billing.state} onChange={(e) => setBilling((b) => ({ ...b, state: e.target.value }))} placeholder="State" className={DOC_FIELD} /></div>}
                {show("Zip Code") && <div className="relative fl-wrap"><label className="fl-label">Zip Code</label><input value={billing.zip} onChange={(e) => setBilling((b) => ({ ...b, zip: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                {show("Country") && <div className="relative fl-wrap"><label className="fl-label">Country</label><input value={billing.country} onChange={(e) => setBilling((b) => ({ ...b, country: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
              </div>
            </div>
            {show("Shipping Address") && (
              <div className={`space-y-3 ${sameAsBilling ? "opacity-60 pointer-events-none" : ""}`}>
                <div className="grid grid-cols-2 gap-3">
                  {show("Street 1") && <div className="relative fl-wrap"><label className="fl-label">Street 1</label><input value={shipVal("street1")} onChange={(e) => setShipping((s) => ({ ...s, street1: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                  {show("Street 2") && <div className="relative"><input value={shipVal("street2")} onChange={(e) => setShipping((s) => ({ ...s, street2: e.target.value }))} placeholder="Street 2" className={DOC_FIELD} /></div>}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {show("City") && <div className="relative fl-wrap"><label className="fl-label">City</label><input value={shipVal("city")} onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                  {show("State") && <div className="relative"><input value={shipVal("state")} onChange={(e) => setShipping((s) => ({ ...s, state: e.target.value }))} placeholder="State" className={DOC_FIELD} /></div>}
                  {show("Zip Code") && <div className="relative fl-wrap"><label className="fl-label">Zip Code</label><input value={shipVal("zip")} onChange={(e) => setShipping((s) => ({ ...s, zip: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                  {show("Country") && <div className="relative fl-wrap"><label className="fl-label">Country</label><input value={shipVal("country")} onChange={(e) => setShipping((s) => ({ ...s, country: e.target.value }))} placeholder=" " className={DOC_FIELD} /></div>}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {show("Sub Title") && <input value={subTitle} onChange={(e) => setSubTitle(e.target.value)} placeholder="Sub Title" className={DOC_FIELD} />}
          {show("PO #") && <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO #" className={DOC_FIELD} />}
          {show("P.O. Date") && (
            <AppDatePicker floatingLabel="P.O. Date" value={poDate} onValueChange={setPoDate} className={DOC_FIELD} />
          )}
          {show("Recipient name") && <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name" className={DOC_FIELD} />}
          {show("Salesperson") && (
            <SalespersonField
              className="md:col-span-2"
              valueId={salespersonId}
              valueName={salesperson}
              onChange={(next) => {
                setSalespersonId(next?.id || "");
                setSalesperson(next?.name || "");
              }}
            />
          )}
          {show("Shipping Cost And Method") && (
            <div className="md:col-span-2">
              <input value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)} placeholder="Shipping Method" className={DOC_FIELD} />
            </div>
          )}
          {isInvoice && show("Payment Methods") ? (
            <div className="md:col-span-2 relative">
              <label className="absolute -top-2 left-2 px-1 bg-white text-[11px] text-gray-500 z-10">Payment Methods</label>
              <button type="button" onClick={() => setPaymentMethodsOpen(true)} className="flex min-h-[46px] w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2.5 text-left hover:border-gray-400">
                <div className="flex min-w-0 flex-wrap gap-2">
                  {selectedPaymentMethods.length > 0 ? selectedPaymentMethods.map((name) => (
                    <span key={name} className="rounded-full border border-blue-600 bg-blue-50 px-3 py-1 text-xs text-blue-700">{name}</span>
                  )) : (
                    <span className="text-sm text-gray-400">Select payment methods</span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-sm text-gray-600"><Pencil className="w-4 h-4" /></span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
          {show("Apply discount before tax") && (
            <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
              <input type="checkbox" checked={discountBeforeTax} onChange={() => setDiscountBeforeTax((v) => !v)} className="accent-blue-600" />
              Discount before tax
            </label>
          )}
          <div className="relative fl-wrap">
            <label className="fl-label">Recurring</label>
            <select value={recurring} onChange={(e) => setRecurring(e.target.value)} className={DOC_FIELD}>
              {RECURRING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {isRecurringActive(recurring) ? (
            <AppDatePicker floatingLabel="Up to" value={recurringUntil} onValueChange={setRecurringUntil} className={DOC_FIELD} />
          ) : (
            <div className="hidden md:block" aria-hidden />
          )}
        </div>

        <div ref={itemsRef} className="border border-gray-300 rounded-md overflow-visible">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="bg-gray-100 text-gray-500 text-xs"><th className="text-left font-semibold px-4 py-2.5 w-14">Sr. No.</th><th className="text-left font-semibold px-2 py-2.5">Items</th>{cols.qty && <th className="text-right font-semibold px-2 py-2.5">Quantity</th>}{cols.mrp && <th className="text-right font-semibold px-2 py-2.5">MRP</th>}<th className="text-right font-semibold px-2 py-2.5">Rate</th>{cols.tax && <th className="text-left font-semibold px-2 py-2.5">Tax</th>}{cols.discount && <th className="text-right font-semibold px-2 py-2.5">Discount</th>}<th className="text-right font-semibold px-4 py-2.5">Amount</th><th className="w-8" /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-300 align-top">
                  <td className="px-4 py-3 text-gray-700">{i + 1}</td>
                  <td className={`px-2 py-2 relative ${descFullWidth ? "min-w-[280px]" : ""}`}>
                    <div
                      ref={(el) => { sugAnchorRefs.current[i] = el; }}
                      className="relative"
                    >
                      <div className="text-[11px] text-gray-400 capitalize">{r.kind}</div>
                      {showItemName(r.kind) && (
                        <input value={r.name} onChange={(e) => { setRowName(i, e.target.value); setSugRow(i); }} onFocus={() => setSugRow(i)} placeholder={r.kind === "product" ? "Product" : "Service"} className="w-full bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400" />
                      )}
                      {showDesc && (
                        <input value={r.description} onChange={(e) => setRowDesc(i, e.target.value)} placeholder="Description" className={`w-full bg-transparent text-xs text-gray-600 outline-none placeholder:text-gray-400 mt-0.5 ${descFullWidth ? "block" : ""}`} />
                      )}
                    </div>
                    <LineItemSuggestFlyout
                      open={sugRow === i}
                      anchorRef={{ current: sugAnchorRefs.current[i] }}
                      options={suggestionsFor(r).map((c) => ({
                        key: c.key,
                        name: c.name,
                        rate: c.rate,
                        description: c.description,
                        stock: c.stock,
                        code: showItemCodeSug ? c.key : undefined,
                      }))}
                      onPick={(key) => pickSuggestion(i, key)}
                      sortRecent={sortRecent}
                      onSortRecentChange={setSortRecent}
                      emptyLabel={`No matching ${r.kind}s`}
                      showPrice
                      formatPrice={moneyWithCurrency}
                      showCode={showItemCodeSug}
                      showDescription={showDescSug}
                      showStock
                    />
                  </td>
                  {cols.qty && (
                    <td className="px-2 py-3 text-right">
                      {showQtyFor(r.kind) ? (
                        <input type="number" min={0} value={r.qty} onChange={(e) => setQty(i, Number(e.target.value))} className="w-14 bg-transparent text-sm text-right outline-none" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  )}
                  {cols.mrp && <td className="px-2 py-3 text-right"><input type="number" min={0} value={r.mrp || ""} onChange={(e) => setMrp(i, Number(e.target.value))} className="w-16 bg-transparent text-sm text-right outline-none" /></td>}
                  <td className="px-2 py-3 text-right"><input type="number" min={0} value={r.rate} onChange={(e) => setRate(i, Number(e.target.value))} className="w-20 bg-transparent text-sm text-right outline-none" /></td>
                  {cols.tax && (
                    <td className="px-2 py-3">
                      <LineTaxSelect
                        valueId={r.taxId}
                        valueRate={r.taxRate}
                        kind={r.kind}
                        onChange={(next) => setTax(i, next?.taxId || 0, next?.taxRate || 0)}
                      />
                    </td>
                  )}
                  {cols.discount && (
                    <td className="px-2 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <input type="number" min={0} max={100} value={r.discount || ""} onChange={(e) => setDiscount(i, Number(e.target.value))} placeholder="Discount" className="w-16 bg-transparent text-sm text-right outline-none placeholder:text-gray-400" />
                        <span className="px-1 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600">%</span>
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{moneyWithCurrency(lineDisplayAmount(r))}</td>
                  <td className="px-2 py-3 text-right"><button type="button" onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-300">
            {allowProduct && <button type="button" onClick={() => addRow("product")} className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Product</button>}
            {allowService && <button type="button" onClick={() => addRow("service")} className="flex items-center gap-1.5 text-sm text-blue-600"><Plus className="w-4 h-4" /> Add Service</button>}
            <div className="relative ml-auto" ref={colMenuRef}>
              <button type="button" title="Columns" onClick={() => setColMenuOpen((o) => !o)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600"><Settings className="w-4 h-4" /></button>
              {colMenuOpen && (
                <div className="absolute right-0 bottom-full z-40 mb-1 min-w-[180px] bg-white border border-gray-300 rounded-md shadow-xl py-1">
                  {([["qty", "Quantity"], ["mrp", "MRP"], ["tax", "Tax"], ["discount", "Discount"]] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setCols((c) => ({ ...c, [k]: !c[k] }))} className="w-full flex items-center justify-between gap-6 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 text-left">
                      {label} {cols[k] && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-4">
            {show("Terms & Conditions") && (
              <div><label className="text-xs text-gray-500">Terms &amp; Conditions</label><textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="mt-1 w-full h-20 border border-gray-300 rounded-md p-3 text-sm text-gray-700 outline-none resize-none bg-white" /></div>
            )}
            {show("Internal Notes") && (
              <div><label className="text-xs text-gray-500">Internal Notes</label><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal Notes" className="mt-1 w-full h-20 border border-gray-300 rounded-md p-3 text-sm text-gray-700 outline-none resize-none bg-white" /></div>
            )}
          </div>
          <div className="space-y-4">
            {show("Notes") && (
              <div><label className="text-xs text-gray-500">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full h-20 border border-gray-300 rounded-md p-3 text-sm text-gray-700 outline-none resize-none bg-white" /></div>
            )}
            {show("Attachment") && <DocAttachmentField compact value={attachment} onChange={(p) => setAttachment(p)} />}
            {isInvoice && showPay("Cash Received Denomination") && (
              <div>
                <label className="text-xs text-gray-500">Cash Received Denomination</label>
                <textarea value={cashDenomination} onChange={(e) => setCashDenomination(e.target.value)} placeholder="e.g. 500×2, 100×3" className="mt-1 w-full h-20 border border-gray-300 rounded-md p-3 text-sm text-gray-700 outline-none resize-none bg-white" />
              </div>
            )}
          </div>
          <div className="border border-gray-300 rounded-md overflow-hidden self-start bg-white">
            {showSum("Total Quantity") && (
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Total Quantity</span><span className="font-semibold text-gray-900">{totalQty}</span></div>
            )}
            <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{moneyWithCurrency(subTotal)}</span></div>
            {showSum("Inline Discount") && inlineDiscount > 0 && (
              <div className="flex justify-between px-4 py-2 text-sm"><span className="text-gray-700">Inline Discount</span><span className="font-semibold text-gray-900">{moneyWithCurrency(inlineDiscount)}</span></div>
            )}
            <div className="flex justify-between items-center px-4 py-2 text-sm gap-2"><span className="text-gray-700">Deposit</span><input value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="30 or 30%" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" /></div>
            <div className="flex justify-between items-center px-4 py-2 text-sm gap-2"><span className="text-gray-700">Discount</span><input value={docDiscount} onChange={(e) => setDocDiscount(e.target.value)} placeholder="30 or 30%" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" /></div>
            {show("Shipping Cost And Method") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2"><span className="text-gray-700">Shipping Cost</span><input value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="Shipping Cost" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" /></div>
            )}
            {show("Shipping Tax") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2"><span className="text-gray-700">Shipping Tax</span><input value={shippingTax} onChange={(e) => setShippingTax(e.target.value)} placeholder="0" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" /></div>
            )}
            {showSum("Custom Charges") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2"><span className="text-gray-700">Custom Charges</span><input value={customCharges} onChange={(e) => setCustomCharges(e.target.value)} placeholder="0" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" /></div>
            )}
            {showSum("Round Off") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2"><span className="text-gray-700">Round Off</span><input value={roundOff} onChange={(e) => setRoundOff(e.target.value)} placeholder="0" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" /></div>
            )}
            <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-300"><span className="text-gray-700">Total</span><span className="font-semibold text-gray-900">{moneyWithCurrency(total)}</span></div>
            <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-300"><span className="font-semibold text-gray-900">Amount Due</span><span className="font-semibold text-gray-900">{moneyWithCurrency(total)}</span></div>
          </div>
        </div>
      </div>

      {addContact && <CreateContactModal collection="customers" onClose={() => setAddContact(false)} onSaved={(id, name) => { setCustomerId(id); setCustQuery(name); }} />}
      {settingsOpen && <AppSettingsModal initialTab={docLabel} onClose={() => setSettingsOpen(false)} />}
      {paymentMethodsOpen && <PaymentMethodsModal selectedNames={selectedPaymentMethods} onSaveSelection={setSelectedPaymentMethods} onClose={() => setPaymentMethodsOpen(false)} />}
      <DocumentSendEmailModal
        open={emailOpen}
        onClose={() => { setEmailOpen(false); onClose(); }}
        title={`${docLabel} #: ${lastSaved?.number || docNumber} from info`}
        toEmail={custEmail}
        subject={`${docLabel} #: ${lastSaved?.number || docNumber} from info`}
        fromEmail="info@inovoic.com"
        bodyText={`Dear ${custName}\n\n${docLabel} #: ${lastSaved?.number || docNumber}\nTotal: ${moneyWithCurrency(total)}`}
        attachmentLabel={lastSaved ? `${docLabel} ${lastSaved.number}` : undefined}
        emailNav={EMAIL_NAV[mode]}
        /* createPublicUrl reserved for email template link when backend supports it */
        key={createPublicUrl ? "pub-on" : "pub-off"}
      />
      {previewOpen && lastSaved && (
        <PdfPreviewModal
          docType={pdfDocType}
          recordId={lastSaved.id}
          backendId={lastSaved.backendId}
          title={`${docLabel} `}
          onClose={() => { setPreviewOpen(false); onClose(); }}
        />
      )}
    </section>
  );
};

export default CreateInvoiceForm;
