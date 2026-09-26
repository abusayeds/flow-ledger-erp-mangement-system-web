/**
 * File: src/lib/db/CreateDocForm.tsx
 * Full INLINE create form for line-item documents — shared layout with Create Invoice SS.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings, Pencil, ChevronDown, X, Plus, Check, Info } from "lucide-react";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { LineItemSuggestFlyout } from "@/components/ui/LineItemSuggestFlyout";
import { SalespersonField } from "@/components/forms/SalespersonField";
import { LineTaxSelect } from "@/components/forms/LineTaxSelect";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { DocumentCreateHeader, type SendMenuAction } from "@/components/documents/DocumentCreateHeader";
import { DocumentSendEmailModal } from "@/components/documents/DocumentSendEmailModal";
import { DOC_FIELD, RECURRING_OPTIONS, emailNavForCollection, isRecurringActive } from "@/components/documents/documentCreateShared";
import { toIsoDate, todayIso } from "@/lib/dateIso";
import { useCollection } from "./hooks";
import { repo, nextNumber } from "./repo";
import { money } from "./format";
import { CreateContactModal } from "./CreateContactModal";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PaymentMethodsModal } from "@/components/modals/PaymentMethodsModal";
import {
  useAppSettings,
  isLayoutSettingOn,
  DOC_LAYOUTS,
  COLLECTION_TO_DOC_LAYOUT,
  type DocLayoutId,
} from "./appSettings";
import type { CollectionName } from "./db";

const SETTINGS_TAB_FOR_COLLECTION: Partial<Record<CollectionName, string>> = {
  proformas: "Proforma Invoice",
  estimates: "Estimate",
  salesReceipts: "Sales Receipt",
  deliveryChallans: "Delivery Challan",
  creditNotes: "Credit Note",
  debitNotes: "Debit Note",
  purchaseOrders: "Purchase Order",
  bills: "Bill",
};

const SETTINGS_SECTION_FOR_COLLECTION: Partial<Record<CollectionName, string>> = {
  salesReceipts: "doc:salesReceipt",
  deliveryChallans: "doc:deliveryChallan",
  estimates: "doc:estimate",
  proformas: "doc:proformaInvoice",
  invoices: "doc:invoice",
  creditNotes: "doc:creditNote",
  purchaseOrders: "doc:purchaseOrder",
  bills: "doc:bill",
  debitNotes: "doc:debitNote",
};

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

const DOC_EMPTY_ROW = (kind: "product" | "service"): DraftRow => ({
  key: "",
  kind,
  name: "",
  description: "",
  qty: 1,
  rate: 0,
  mrp: 0,
  taxId: 0,
  taxRate: 0,
  discount: 0,
});

export const CreateDocForm: React.FC<{
  collection: CollectionName;
  title: string;
  party?: "customers" | "vendors";
  buy?: boolean;
  amountDue?: boolean;
  creditTotals?: boolean;
  paymentType?: boolean;
  showPoNumber?: boolean;
  hideCurrency?: boolean;
  enableSendDropdown?: boolean;
  record?: any;
  onClose: () => void;
  onSaved: (id: number) => void;
}> = ({
  collection,
  title,
  party = "customers",
  buy = false,
  amountDue = false,
  creditTotals = false,
  paymentType = false,
  showPoNumber = false,
  hideCurrency = false,
  enableSendDropdown = false,
  record,
  onClose,
  onSaved,
}) => {
  const isEdit = !!record?.id;
  const layoutId = COLLECTION_TO_DOC_LAYOUT[collection] as DocLayoutId | undefined;
  const layout = layoutId ? DOC_LAYOUTS[layoutId] : null;
  const settingsSection = SETTINGS_SECTION_FOR_COLLECTION[collection];
  const docSettings = useAppSettings(settingsSection || "doc:invoice");
  const gated = !!layout;
  const show = (key: string) =>
    gated ? isLayoutSettingOn(layout!.fieldKeys, docSettings?.fieldVisibility, key) : true;
  const showCol = (key: string) =>
    gated ? isLayoutSettingOn(layout!.columnKeys, docSettings?.columns, key) : true;
  const showSum = (key: string) =>
    gated ? isLayoutSettingOn(layout!.summaryKeys, docSettings?.summary, key) : true;
  const lineOption = docSettings?.general?.lineOption || "Both";
  const allowProduct = !gated || lineOption === "Both" || lineOption === "Product";
  const allowService = !gated || lineOption === "Both" || lineOption === "Service";
  const qtyMode = docSettings?.columnsQuantity || "Show for Both";
  const showQtyCol = (!layout || layout.showQuantitySelect) && (
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

  const parties = useCollection<any>(party, "name");
  const products = useCollection<any>("products", "name");
  const services = useCollection<any>("services", "name");
  const catalog = useMemo(
    () => [
      ...products.map((p) => ({
        key: "p" + p.id,
        kind: "product" as const,
        name: p.name,
        rate: (buy ? p.buyPrice : p.price) || 0,
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
    [products, services, buy],
  );
  const isVendor = party === "vendors";
  const partyLabel = isVendor ? "Vendor" : "Customer";
  const docNoLabel = title.replace(/^Create |^New |^Edit /i, "").split(" ")[0] === "Bill" ? "Bill" : title.includes("Purchase") ? "Invoice" : title.replace(/^(Create|New|Edit)\s+/i, "").split("#")[0].trim();

  const partyKeyName = isVendor ? "vendorId" : "customerId";
  const [query, setQuery] = useState("");
  const [partyId, setPartyId] = useState<number | "">(record?.[partyKeyName] ?? "");
  const [partyEmail, setPartyEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [addContact, setAddContact] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ id: number; number: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const matches = parties.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const p = partyId !== "" ? parties.find((c) => c.id === partyId) : null;
    if (p?.email) setPartyEmail(String(p.email));
  }, [partyId, parties]);

  const [date, setDate] = useState(toIsoDate(record?.date) || todayIso());
  const [due, setDue] = useState(toIsoDate(record?.due) || todayIso());
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [terms, setTerms] = useState(record?.terms ?? "Perferendis ad vero");
  const [internalNotes, setInternalNotes] = useState(record?.internalNotes ?? "");
  const [rows, setRows] = useState<DraftRow[]>(
    record?.items?.length
      ? record.items.map((it: any) => ({
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
      : [DOC_EMPTY_ROW("product"), DOC_EMPTY_ROW("service")],
  );
  const [sugRow, setSugRow] = useState<number | null>(null);
  const [sortRecent, setSortRecent] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [cols, setCols] = useState({ qty: true, mrp: true, tax: true, discount: false, autoFit: true });
  useEffect(() => {
    if (!gated) return;
    setCols({
      qty: showQtyCol,
      mrp: showCol("MRP"),
      tax: showCol("Tax"),
      discount: showCol("Discount"),
      autoFit: showCol("Auto Fit"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gated,
    docSettings?.columns?.MRP,
    docSettings?.columns?.Tax,
    docSettings?.columns?.Discount,
    docSettings?.columns?.["Auto Fit"],
    docSettings?.columnsQuantity,
    layout?.showQuantitySelect,
  ]);
  const colMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const [recent, setRecent] = useState<string[]>([]);
  const itemsRef = useRef<HTMLDivElement>(null);
  const sugAnchorRefs = useRef<Record<number, HTMLElement | null>>({});
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
  const [subTitle, setSubTitle] = useState(record?.subTitle ?? "");
  const [poNumber, setPoNumber] = useState(record?.poNumber ?? "");
  const [poDate, setPoDate] = useState(toIsoDate(record?.poDate) || "");
  const [recipientName, setRecipientName] = useState(record?.recipientName ?? "");
  const [salesperson, setSalesperson] = useState(() => {
    const sp = record?.salesperson;
    if (sp && typeof sp === "object") return String(sp.name || "");
    return typeof sp === "string" && !/^[a-f\d]{24}$/i.test(sp) ? sp : (record?.salespersonName ?? "");
  });
  const [salespersonId, setSalespersonId] = useState(() => {
    const sp = record?.salesperson;
    if (sp && typeof sp === "object") return String(sp._id || "");
    if (record?.salespersonId) return String(record.salespersonId);
    if (typeof sp === "string" && /^[a-f\d]{24}$/i.test(sp)) return sp;
    return "";
  });
  const [shippingMethod, setShippingMethod] = useState(record?.shippingMethod ?? "");
  const [shippingTax, setShippingTax] = useState(String(record?.shippingTax ?? ""));
  const [customCharges, setCustomCharges] = useState(String(record?.customCharges ?? ""));
  const [roundOff, setRoundOff] = useState(String(record?.roundOff ?? ""));
  const [payType, setPayType] = useState(record?.paymentType ?? "");
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(
    record?.payment_method ?? record?.paymentMethod ?? (record?.paymentType ? [record.paymentType] : []),
  );
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);
  const [attachment, setAttachment] = useState(record?.Attachment || record?.attachments || "");
  const [discountBeforeTax, setDiscountBeforeTax] = useState(!!record?.discountBeforeTax);
  const [recurring, setRecurring] = useState(record?.recurring ?? "None");
  const [recurringUntil, setRecurringUntil] = useState(toIsoDate(record?.recurringUntil) || todayIso());
  const [deposit, setDeposit] = useState(record?.deposit ?? "");
  const [docDiscount, setDocDiscount] = useState(record?.docDiscount ?? "");
  const [shippingCost, setShippingCost] = useState(String(record?.shipping ?? record?.shippingCost ?? ""));

  const emptyAddr = { street1: "", street2: "", city: "", state: "", zip: "", country: "" };
  const [addrOpen, setAddrOpen] = useState(false);
  const [billing, setBilling] = useState({ ...emptyAddr });
  const [shipping, setShipping] = useState({ ...emptyAddr });
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [updateToParty, setUpdateToParty] = useState(false);
  useEffect(() => {
    const p: any = parties.find((c) => c.id === partyId);
    if (!p) return;
    setBilling({ street1: p.street1 || "", street2: p.street2 || "", city: p.city || "", state: p.state || "", zip: p.zip || "", country: p.country || "" });
    setShipping({ street1: p.shipStreet1 || "", street2: p.shipStreet2 || "", city: p.shipCity || "", state: p.shipState || "", zip: p.shipZip || "", country: p.shipCountry || "" });
  }, [partyId, parties]);
  const shipVal = (k: keyof typeof emptyAddr) => (sameAsBilling ? billing[k] : shipping[k]);

  const addRow = (kind: "product" | "service") => {
    setRows((r) => [...r, DOC_EMPTY_ROW(kind)]);
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
  const total = subTotal + taxTotal + shippingNum + shippingTaxNum + customChargesNum + roundOffNum;
  const moneyFmt = (amount: number) => {
    if (negParen && amount < 0) return `(${money(Math.abs(amount))})`;
    return money(amount);
  };
  const lineDisplayAmount = (r: DraftRow) => {
    const base = lineAmount(r);
    if (!showLineTax) return base;
    return base * (1 + (r.taxRate || 0) / 100);
  };
  const partyDisabled = partyId === "" && !query.trim();

  const persist = async (): Promise<{ id: number; number: string } | null> => {
    let pid: number | "" = partyId;
    if (pid === "" && query.trim()) {
      pid = (await repo.add(party, isVendor
        ? { name: query.trim(), status: "Active", payable: 0 }
        : { name: query.trim(), status: "Active", balance: 0 })) as number;
    }
    if (pid === "") return null;
    const items = rows.filter((r) => r.name).map((r, i) => ({
      id: i + 1, name: r.name, description: r.description, qty: r.qty, rate: r.rate, mrp: r.mrp,
      taxId: r.taxId, taxRate: r.taxRate || 0, discount: r.discount || 0, amount: +lineAmount(r).toFixed(2),
    }));
    const partyKey = isVendor ? "vendorId" : "customerId";
    const common = {
      [partyKey]: pid, date, due, status: "Draft" as const,
      items, subTotal: +subTotal.toFixed(2), tax: +taxTotal.toFixed(2),
      shipping: shippingNum, total: +total.toFixed(2), notes, terms, internalNotes,
      subTitle, poNumber, poDate, recipientName, salesperson, salespersonId, shippingMethod, shippingTax,
      customCharges, roundOff, inlineDiscount: +inlineDiscount.toFixed(2),
      discountBeforeTax, recurring, recurringUntil: isRecurringActive(recurring) ? recurringUntil : "",
      deposit, docDiscount, shippingCost,
      ...(paymentType ? { paymentType: payType } : { paymentMethod: selectedPaymentMethods, payment_method: selectedPaymentMethods }),
      Attachment: attachment, attachments: attachment,
    };
    let id: number;
    let numStr: string;
    if (isEdit) {
      numStr = record.number || "";
      await repo.update(collection, record.id, {
        ...common,
        amountDue: +(total - (record.amountPaid || 0)).toFixed(2),
      });
      id = record.id;
    } else {
      const n = await nextNumber(collection);
      numStr = "#" + n;
      id = (await repo.add(collection, {
        number: numStr, ts: Date.now(),
        ...common, amountPaid: 0, amountDue: +total.toFixed(2),
        ...(creditTotals ? { amountUsed: 0 } : {}),
      })) as number;
    }
    if (updateToParty && typeof pid === "number") {
      await repo.update(party, pid, {
        street1: billing.street1, street2: billing.street2, city: billing.city, state: billing.state, zip: billing.zip, country: billing.country,
        shipStreet1: shipVal("street1"), shipStreet2: shipVal("street2"), shipCity: shipVal("city"), shipState: shipVal("state"), shipZip: shipVal("zip"), shipCountry: shipVal("country"),
        sameAsBilling,
      });
    }
    return { id, number: numStr };
  };

  const finishSave = (id: number, closeAfter = true) => {
    onSaved(id);
    if (closeAfter) onClose();
  };

  const openEmailFor = (saved: { id: number; number: string }) => {
    setLastSaved(saved);
    setEmailOpen(true);
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
      openEmailFor(saved);
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
      if (action === "preview" || action === "print") {
        finishSave(saved.id);
        return;
      }
      if (action === "new") {
        finishSave(saved.id, false);
        setPartyId("");
        setQuery("");
        setPartyEmail("");
        setRows([DOC_EMPTY_ROW("product"), DOC_EMPTY_ROW("service")]);
        return;
      }
    } catch {
      /* keep form open on backend failure */
    } finally {
      setSaving(false);
    }
  };

  const partyRecord = partyId ? parties.find((c) => c.id === partyId) : null;
  const partyName = partyRecord?.name || query;
  const resolvedPartyEmail = (partyEmail || partyRecord?.email || "").trim();
  const docNumber = record?.number?.replace?.("#", "") || "—";
  const emailTitle = `${title.replace(/^Create |^New /i, "")} ${lastSaved?.number || docNumber} from info`;
  const emailSubject = emailTitle;

  return (
    <section className="module-detail-panel custom-scrollbar flex-1 overflow-y-auto">
      <DocumentCreateHeader
        title={title}
        onSettings={() => setSettingsOpen(true)}
        onCancel={onClose}
        onSaveDraft={() => void saveDraft()}
        onSaveAndSend={() => void saveAndSend()}
        saveDisabled={partyDisabled || saving}
        enableSendDropdown={enableSendDropdown}
        onSendMenu={(a) => void handleSendMenu(a)}
      />

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2 relative fl-wrap" ref={ref}>
            <label className="fl-label">{partyLabel} *</label>
            <div className="relative">
              <input value={partyName} onChange={(e) => { setQuery(e.target.value); setPartyId(""); setPartyEmail(""); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={`Find or add a ${partyLabel.toLowerCase()}`} className={DOC_FIELD} />
              <button type="button" onClick={() => setAddContact(true)} title={`Create ${partyLabel}`} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500"><Pencil className="w-4 h-4" /></button>
            </div>
            {open && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl py-1 max-h-60 overflow-y-auto custom-scrollbar">
                {matches.map((c) => <button key={c.id} type="button" onClick={() => { setPartyId(c.id); setQuery(c.name); setPartyEmail(c.email ? String(c.email) : ""); setOpen(false); setAddrOpen(true); }} className="w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 text-left">{c.name}</button>)}
                {matches.length === 0 && <div className="px-3 py-2.5 text-sm text-gray-400">None found — click the pencil to add</div>}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-2 px-1 bg-white text-[11px] text-gray-500 z-10">Address</label>
            <button type="button" onClick={() => setAddrOpen((o) => !o)} className={`w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-md text-sm text-gray-500 hover:border-gray-400 bg-white ${DOC_FIELD}`}>
              <span /> <ChevronDown className={`w-4 h-4 transition-transform ${addrOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          <div className="relative fl-wrap">
            <label className="fl-label">{docNoLabel} #</label>
            <div className="relative">
              <input readOnly value={docNumber} placeholder=" " className={DOC_FIELD} />
              <Info className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          {!hideCurrency ? (
            <div className="relative fl-wrap"><label className="fl-label">Currency</label><input readOnly defaultValue="৳ BDT" placeholder=" " className={DOC_FIELD} /></div>
          ) : (
            <div className="hidden md:block" aria-hidden />
          )}
          <AppDatePicker floatingLabel={`${docNoLabel} date *`} value={date} onValueChange={setDate} className={DOC_FIELD} />
          {show("Due Date") && (
            <AppDatePicker floatingLabel="Due Date" value={due} onValueChange={setDue} className={DOC_FIELD} />
          )}
        </div>

        {addrOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 border-b border-gray-300 pb-5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800"><input type="checkbox" defaultChecked className="accent-blue-600" /> Billing</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={updateToParty} onChange={() => setUpdateToParty((v) => !v)} className="accent-blue-600" /> Update to {partyLabel.toLowerCase()}</label>
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
          {(showPoNumber || show("PO #")) && (
            <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO #" className={DOC_FIELD} />
          )}
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
            <div className={paymentType ? "md:col-span-1" : "md:col-span-2"}>
              <input value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)} placeholder="Shipping Method" className={DOC_FIELD} />
            </div>
          )}
          {paymentType && show("Payment Type") ? (
            <div className="md:col-span-2 relative fl-wrap">
              <label className="fl-label">Payment Type *</label>
              <input value={payType} onChange={(e) => setPayType(e.target.value)} placeholder=" " className={DOC_FIELD} />
            </div>
          ) : !paymentType && show("Payment Methods") ? (
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
                      formatPrice={moneyFmt}
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
                  {cols.mrp && <td className="px-2 py-3 text-right"><input type="number" min={0} value={r.mrp || ""} onChange={(e) => setMrp(i, Number(e.target.value))} className="w-16 bg-transparent text-sm text-right outline-none" placeholder="MRP" /></td>}
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
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{moneyFmt(lineDisplayAmount(r))}</td>
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
                  <div className="px-4 py-1.5 text-xs text-gray-400">Columns</div>
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
          </div>
          <div className="border border-gray-300 rounded-md overflow-hidden self-start bg-white">
            {showSum("Total Quantity") && (
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Total Quantity</span><span className="font-semibold text-gray-900">{totalQty}</span></div>
            )}
            <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{moneyFmt(subTotal)}</span></div>
            {showSum("Inline Discount") && inlineDiscount > 0 && (
              <div className="flex justify-between px-4 py-2 text-sm"><span className="text-gray-700">Inline Discount</span><span className="font-semibold text-gray-900">{moneyFmt(inlineDiscount)}</span></div>
            )}
            <div className="flex justify-between items-center px-4 py-2 text-sm gap-2">
              <span className="text-gray-700">Deposit</span>
              <input value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="30 or 30%" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
            </div>
            <div className="flex justify-between items-center px-4 py-2 text-sm gap-2">
              <span className="text-gray-700">Discount</span>
              <input value={docDiscount} onChange={(e) => setDocDiscount(e.target.value)} placeholder="30 or 30%" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
            </div>
            {show("Shipping Cost And Method") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2">
                <span className="text-gray-700">Shipping Cost</span>
                <input value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} placeholder="Shipping Cost" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
              </div>
            )}
            {show("Shipping Tax") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2">
                <span className="text-gray-700">Shipping Tax</span>
                <input value={shippingTax} onChange={(e) => setShippingTax(e.target.value)} placeholder="0" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
              </div>
            )}
            {showSum("Custom Charges") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2">
                <span className="text-gray-700">Custom Charges</span>
                <input value={customCharges} onChange={(e) => setCustomCharges(e.target.value)} placeholder="0" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
              </div>
            )}
            {showSum("Round Off") && (
              <div className="flex justify-between items-center px-4 py-2 text-sm gap-2">
                <span className="text-gray-700">Round Off</span>
                <input value={roundOff} onChange={(e) => setRoundOff(e.target.value)} placeholder="0" className="w-28 text-right text-sm border border-gray-300 rounded px-2 py-1 bg-white" />
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-300"><span className="text-gray-700">Total</span><span className="font-semibold text-gray-900">{moneyFmt(total)}</span></div>
            {amountDue && (
              <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-300"><span className="font-semibold text-gray-900">Amount Due</span><span className="font-semibold text-gray-900">{moneyFmt(total)}</span></div>
            )}
            {creditTotals && (
              <>
                <div className="flex justify-between px-4 py-2 text-sm text-gray-500"><span>Amount Used</span><span>{moneyFmt(0)}</span></div>
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-300"><span className="font-semibold text-gray-900">Amount Unused</span><span className="font-semibold text-gray-900">{moneyFmt(total)}</span></div>
              </>
            )}
          </div>
        </div>
      </div>

      {addContact && <CreateContactModal collection={party} onClose={() => setAddContact(false)} onSaved={(id, name) => { setPartyId(id); setQuery(name); }} />}
      {settingsOpen && <AppSettingsModal initialTab={SETTINGS_TAB_FOR_COLLECTION[collection] ?? "General"} onClose={() => setSettingsOpen(false)} />}
      {paymentMethodsOpen && (
        <PaymentMethodsModal
          selectedNames={selectedPaymentMethods}
          onSaveSelection={setSelectedPaymentMethods}
          onClose={() => setPaymentMethodsOpen(false)}
        />
      )}
      <DocumentSendEmailModal
        open={emailOpen}
        onClose={() => { setEmailOpen(false); onClose(); }}
        title={emailTitle}
        toEmail={resolvedPartyEmail}
        subject={emailSubject}
        fromEmail="info@inovoic.com"
        bodyText={`Dear ${partyName}\n\n${docNoLabel} #: ${lastSaved?.number || docNumber}\nTotal: ${moneyFmt(total)}`}
        attachmentLabel={lastSaved ? `${docNoLabel} ${lastSaved.number}` : undefined}
        emailNav={emailNavForCollection(collection)}
      />
    </section>
  );
};

export default CreateDocForm;
