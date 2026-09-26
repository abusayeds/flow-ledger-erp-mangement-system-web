/**
 * File: src/pages/sales/Proformainvoices.tsx
 * Proforma Invoice — backend-driven master/detail layout.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { useCollection, repo, nextNumber, money as fmtMoney, PdfPreviewModal } from "@/lib/db";
import { api } from "@/lib/api/client";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { CreateInvoiceForm } from "./CreateInvoiceForm";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { buildListSortParam } from "@/lib/listSort";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import {
  fetchProformaInvoice,
  fetchProformaInvoices,
  updateProformaInvoice,
  hardDeleteProformaInvoice,
  hardDeleteProformaInvoices,
  restoreProformaInvoices,
  proformaCustomerId,
  type BackendProformaInvoiceDoc,
} from "@/services/proformaInvoicesApi";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  Settings,
  SlidersHorizontal,
  Pencil,
  PenTool,
  Eye,
  Printer,
  Mail,
  MoreVertical,
  X,
  Trash2,
  MessageCircle,
  CircleChevronUp,
  CircleChevronDown,
  RotateCcw,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

type Status = "Draft" | "Sent" | "Invoiced" | "Cancelled";
type ProformaRow = {
  id: number | string;
  backendId: string;
  name: string;
  customerSubtitle: string;
  number: string;
  note: string;
  date: string;
  amount: string;
  currency: string;
  status: string;
};

type DetailLine = {
  id: string;
  name: string;
  description: string;
  qty: number;
  rate: number;
  tax: number;
  discount: number;
  amount: number;
};

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};

const sortFields = ["Created On", "Proforma Invoice date", "Amount", "Proforma Invoice #", "Status", "Customer"];
const statusList = ["All", "Draft", "Sent", "Invoiced", "Cancelled", "Trash"];
const PF_TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const PF_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };

const apiText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const numberValue = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;

const statusBadge = (status: string) => {
  switch (status) {
    case "Sent":
      return "bg-gray-900 text-white";
    case "Invoiced":
      return "bg-green-500 text-white";
    case "Cancelled":
    case "Void":
      return "bg-red-500 text-white";
    case "Paid":
      return "bg-green-500 text-white";
    case "Partial":
      return "bg-orange-500 text-white";
    default:
      return "bg-gray-600 text-white";
  }
};

const proformaSortToBackend = (value: string) => {
  switch (value) {
    case "Proforma Invoice #":
      return "invoice_number";
    case "Status":
      return "status";
    case "Customer":
      return "customer_name";
    case "Amount":
      return "total";
    case "Proforma Invoice date":
      return "date";
    case "Created On":
    default:
      return "createdAt";
  }
};

const customerDisplayName = (customer: any): string =>
  apiText(customer?.businessProfile?.companyName) ||
  apiText(customer?.company_name) ||
  apiText(customer?.name) ||
  apiText(customer?.contact) ||
  "—";

const customerDisplaySubtitle = (customer: any): string =>
  [apiText(customer?.name), apiText(customer?.email)].filter(Boolean).join(" · ");

const addressLines = (address?: {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}) => [address?.street, address?.street2, [address?.city, address?.state, address?.zip].filter(Boolean).join(", "), address?.country].filter(Boolean);

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div>
    </div>
  );
};

const EmailModal: React.FC<{ onClose: () => void; row: ProformaRow }> = ({ onClose, row }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
        <h3 className="text-base font-medium text-gray-900">Proforma Invoice {row.number} from info</h3>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></button>
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
          <button onClick={onClose} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Send</button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <input placeholder="To" className="flex-1 bg-transparent text-sm outline-none" />
          <button className="text-xs text-gray-500 hover:text-gray-700">Cc &amp; Bcc</button>
        </div>
        <input defaultValue={`Proforma Invoice ${row.number} from info`} className="w-full border-b border-gray-300 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-300 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {row.name}</p>
          <p>Proforma Invoice {row.number}<br />Total Amount: {row.amount}</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Proforma Invoice {row.number}</span>
        </div>
      </div>
    </div>
  </Overlay>
);

export const ProformaInvoices: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number | string; openCreate?: boolean } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<number | string>(navSelectedId ?? 0);
  const [sortBy, setSortBy] = useState("Created On");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "pdfSettings">(null);
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  const [editRecord, setEditRecord] = useState<any>(null);

  useEffect(() => {
    if (navSelectedId != null) setSelectedId(navSelectedId);
  }, [navSelectedId]);

  useEffect(() => {
    if (navState?.openCreate) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, location.pathname, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [sortBy, statusFilter, customerFilter]);

  const dbProformas = useCollection<any>("proformas");
  const dbCustomers = useCollection<any>("customers", "name");

  const { data: backendList } = useQuery({
    queryKey: ["proforma-backend-list", page, search, sortBy, statusFilter, customerFilter],
    queryFn: () =>
      fetchProformaInvoices({
        page,
        limit: LIST_PAGE_SIZE,
        searchTerm: search || undefined,
        sort: buildListSortParam(proformaSortToBackend(sortBy), "Descending"),
        status: statusFilter === "Trash" ? undefined : statusFilter,
        isDeleted: statusFilter === "Trash" || undefined,
        customer_id: partyFilterParam(customerFilter),
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = backendList?.pagination;

  const filtered = useMemo<ProformaRow[]>(() => {
    const backendRows = backendList?.rows ?? [];
    return backendRows.map((row) => {
      const linkedLocal =
        dbProformas.find((item) => item._id === row._id) ||
        dbProformas.find((item) => String(item.number).replace(/^#/, "") === row.number);
      return {
        id: linkedLocal?.id ?? row._id,
        backendId: row._id,
        name: row.customerName || customerDisplayName(dbCustomers.find((c) => c._id === row.customerId)),
        customerSubtitle: row.customerSubtitle || "",
        number: `#${row.number}`,
        note: linkedLocal?.notes || "No Notes",
        date: row.dateLabel,
        amount: fmtMoney(row.amount),
        currency: row.currency || "USD",
        status: row.status || "Draft",
      };
    });
  }, [backendList?.rows, dbCustomers, dbProformas]);

  useEffect(() => {
    if (
      filtered.length > 0 &&
      !filtered.some((item) => item.id === selectedId || item.backendId === selectedId)
    ) {
      setSelectedId(filtered[0].backendId || filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected =
    filtered.find((item) => item.id === selectedId) ||
    filtered.find((item) => item.backendId === selectedId) ||
    filtered[0];
  const selectedDb =
    dbProformas.find((item) => item.id === selected?.id) ||
    dbProformas.find((item) => item._id === selected?.backendId) ||
    {};
  const selectedCustomer = dbCustomers.find((item) => item.id === selectedDb.customerId) || {};

  const { data: selectedDoc } = useQuery({
    queryKey: ["proforma-backend-detail", selected?.backendId],
    queryFn: () => fetchProformaInvoice(String(selected?.backendId)),
    enabled: !!selected?.backendId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const lines = useMemo<DetailLine[]>(() => {
    const productLines = (selectedDoc?.product ?? []).map((item, index) => ({
      id: `p-${index}`,
      name: apiText(item.product_name || (typeof item.product_id === "object" ? item.product_id?.productName : "")) || "Product",
      description: apiText(item.description || (typeof item.product_id === "object" ? item.product_id?.description : "")),
      qty: numberValue(item.quantity),
      rate: numberValue(item.rate),
      tax: numberValue(item.tax),
      discount: numberValue(item.discount),
      amount: numberValue(item.amount),
    }));
    const serviceLines = (selectedDoc?.service ?? []).map((item, index) => ({
      id: `s-${index}`,
      name: apiText(item.service_name || (typeof item.service_id === "object" ? item.service_id?.serviceName : "")) || "Service",
      description: apiText(item.description || (typeof item.service_id === "object" ? item.service_id?.description : "")),
      qty: numberValue(item.quantity),
      rate: numberValue(item.rate),
      tax: numberValue(item.tax),
      discount: numberValue(item.discount),
      amount: numberValue(item.amount),
    }));
    if (productLines.length || serviceLines.length) return [...productLines, ...serviceLines];
    return (selectedDb.items || []).map((item: any, index: number) => ({
      id: `l-${index}`,
      name: item.name || "Item",
      description: item.description || "",
      qty: numberValue(item.qty ?? 1),
      rate: numberValue(item.rate),
      tax: 0,
      discount: numberValue(item.discount),
      amount: numberValue(item.amount ?? numberValue(item.qty) * numberValue(item.rate)),
    }));
  }, [selectedDb.items, selectedDoc?.product, selectedDoc?.service]);

  const listTotal = useMemo(
    () => filtered.reduce((sum, item) => sum + numberValue(item.amount.replace(/[^0-9.-]/g, "")), 0),
    [filtered],
  );

  const allSelected = filtered.length > 0 && filtered.every((item) => checked.has(Number(item.id)));
  const selectedTotal = filtered
    .filter((item) => checked.has(Number(item.id)))
    .reduce((sum, item) => sum + numberValue(item.amount.replace(/[^0-9.-]/g, "")), 0);

  const exitSelect = () => {
    setSelectMode(false);
    setChecked(new Set());
  };

  const toggleRow = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (allSelected) exitSelect();
    else setChecked(new Set(filtered.map((item) => Number(item.id))));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const markAs = async (status: Status) => {
    try {
      if (selected?.backendId) {
        await updateProformaInvoice(selected.backendId, { status });
      }
      if (selectedDb?.id) {
        await repo.update("proformas", selectedDb.id, { status });
      }
      showToast(`Proforma invoice marked as ${status}`, "success");
    } catch {
      showToast("Could not update status", "error");
    }
  };

  const convertToInvoice = async () => {
    if (!selectedDb?.id) return;
    const n = await nextNumber("invoices");
    const id = await repo.add("invoices", {
      number: "#" + n,
      customerId: selectedDb.customerId,
      date: selectedDb.date,
      due: selectedDb.due || selectedDb.date,
      ts: Date.now(),
      status: "Draft",
      items: selectedDb.items || [],
      subTotal: selectedDb.subTotal || numberValue(selectedDoc?.sub_total),
      tax: selectedDb.tax || numberValue(selectedDoc?.tax),
      shipping: 0,
      total: selectedDb.total || numberValue(selectedDoc?.total),
      amountPaid: 0,
      amountDue: selectedDb.total || numberValue(selectedDoc?.total),
      notes: selectedDb.notes || apiText(selectedDoc?.notes),
      terms: selectedDb.terms || apiText(selectedDoc?.terms_and_conditions),
      paymentMethod: selectedDb.paymentMethod || selectedDoc?.payment_method || [],
    });
    await markAs("Invoiced");
    showToast("Converted to invoice", "success");
    navigate("/sales/sales-invoice", { state: { selectedId: id } });
  };

  const duplicateAs = async (label: string) => {
    if (!selectedDb?.id) return;
    const base = {
      customerId: selectedDb.customerId,
      date: selectedDb.date,
      due: selectedDb.due,
      ts: Date.now(),
      items: selectedDb.items || [],
      subTotal: selectedDb.subTotal || 0,
      tax: selectedDb.tax || 0,
      total: selectedDb.total || 0,
      notes: selectedDb.notes || "",
      terms: selectedDb.terms || "",
      paymentMethod: selectedDb.paymentMethod || [],
    };
    if (label === "As Invoice") {
      const n = await nextNumber("invoices");
      const id = await repo.add("invoices", { ...base, number: "#" + n, status: "Draft", amountPaid: 0, amountDue: base.total });
      showToast("Invoice created", "success");
      navigate("/sales/sales-invoice", { state: { selectedId: id } });
    } else if (label === "As Proforma Invoice") {
      const n = await nextNumber("proformas");
      const id = await repo.add("proformas", { ...base, number: "#" + n, status: "Draft", amountPaid: 0, amountDue: base.total });
      setSelectedId(id);
      showToast("Proforma invoice duplicated", "success");
    } else if (label === "As Purchase Order") {
      const vendors = await repo.getAll("vendors");
      const n = await nextNumber("purchaseOrders");
      const id = await repo.add("purchaseOrders", { ...base, number: "#" + n, vendorId: vendors[0]?.id ?? 1, status: "Draft", billStatus: "Not Billed", amountPaid: 0, amountDue: base.total });
      showToast("Purchase order created", "success");
      navigate("/purchase/purchase-orders", { state: { selectedId: id } });
    }
  };

  const trashCurrent = async () => {
    if (!selectedDb?.id && !selected?.backendId) return;
    if (statusFilter === "Trash") {
      const backendId = selected?.backendId || selectedDb?._id;
      if (backendId) await hardDeleteProformaInvoice(String(backendId));
    } else if (selectedDb?.id) {
      await repo.remove("proformas", selectedDb.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] });
    showToast(
      statusFilter === "Trash"
        ? `Proforma invoice ${selectedDb.number} permanently deleted`
        : `Proforma invoice ${selectedDb.number} moved to trash`,
      "success",
    );
    setSelectedId(filtered.find((item) => item.id !== selectedDb.id)?.id ?? 0);
    setConfirmAction(null);
  };

  const trashSelected = async () => {
    const ids = [...checked];
    const backendIds = filtered.filter((item) => ids.includes(Number(item.id)) && item.backendId).map((item) => String(item.backendId));
    if (statusFilter === "Trash") {
      if (backendIds.length) await hardDeleteProformaInvoices(backendIds);
    } else {
      await repo.removeMany("proformas", ids);
    }
    await queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] });
    showToast(
      statusFilter === "Trash"
        ? `${ids.length} proforma ${ids.length === 1 ? "invoice" : "invoices"} permanently deleted`
        : `${ids.length} proforma ${ids.length === 1 ? "invoice" : "invoices"} moved to trash`,
      "success",
    );
    if (ids.includes(Number(selectedId))) setSelectedId(filtered.find((item) => !ids.includes(Number(item.id)))?.id ?? 0);
    setConfirmAction(null);
    exitSelect();
  };

  const restoreSelected = async () => {
    const ids = [...checked];
    const backendIds = filtered.filter((item) => ids.includes(Number(item.id)) && item.backendId).map((item) => String(item.backendId));
    if (backendIds.length === 0) { showToast("Select proforma invoices to restore", "warning"); return; }
    await restoreProformaInvoices(backendIds);
    await queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] });
    showToast(`${backendIds.length} proforma ${backendIds.length === 1 ? "invoice" : "invoices"} restored`, "success");
    exitSelect();
  };

  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedDoc?._id || selected?.backendId || selectedDb?._id;
    let signaturePath = data.image;

    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `proforma-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        signaturePath = uploadRes.data?.data?.file_path || uploadRes.data?.data?.path || data.image;
        await updateProformaInvoice(String(backendId), { signature: signaturePath });
        await queryClient.invalidateQueries({ queryKey: ["proforma-backend-detail", String(backendId)] });
      }

      if (selectedDb?.id) {
        await repo.update("proformas", selectedDb.id, {
          signature: signaturePath,
          signatureName: data.name,
          signatureTitle: data.title,
          signatureDate: data.date,
        });
      }

      showToast("Signature saved", "success");
    } catch {
      showToast("Could not save signature", "error");
    }
  };

  const hasActiveListFilters = !!search.trim() || statusFilter !== "All" || customerFilter.length > 0;

  if (!selected && !createOpen && !hasActiveListFilters) {
    return <ListEmptyState title="No proforma invoices yet" onCreate={() => setCreateOpen(true)} createLabel="New Proforma Invoice" />;
  }

  const billingLines = addressLines(selectedDoc?.billing_address);
  const shippingLines = addressLines(selectedDoc?.shipping_address);
  const localBillingLines = [selectedCustomer.street1, selectedCustomer.street2, [selectedCustomer.city, selectedCustomer.zip].filter(Boolean).join(" "), selectedCustomer.country].filter(Boolean);
  const localShippingLines = [selectedCustomer.shipStreet1, selectedCustomer.shipStreet2, [selectedCustomer.shipCity, selectedCustomer.shipZip].filter(Boolean).join(" "), selectedCustomer.shipCountry].filter(Boolean);
  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Proforma Invoice" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              {statusFilter === "Trash" && (
                <button title="Restore" onClick={() => (checked.size === 0 ? showToast("Select proforma invoices to restore", "warning") : restoreSelected())} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
              )}
              <button title={statusFilter === "Trash" ? "Delete permanently" : "Delete"} onClick={() => (checked.size === 0 ? showToast("Select proforma invoices to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp...", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Proforma Invoices</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Proforma Invoices")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>
                {(close) => (
                  <>
                    <button onClick={() => { openListImport("proforma-invoices"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button>
                    <button onClick={() => { openListExport("proforma-invoices"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button>
                  </>
                )}
              </Dropdown>
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search proforma invoices..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => sortFields.map((item) => (
              <button key={item} onClick={() => { setSortBy(item); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                {item} {item === sortBy && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </Dropdown>
          <Dropdown trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusList.map((item) => (
              <button key={item} onClick={() => { setStatusFilter(item); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${item === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>
                {item} {item === statusFilter && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </Dropdown>
          <PartyFilterPopover
            kind="customer"
            appliedIds={customerFilter}
            appliedLabels={customerFilterLabels}
            onApply={(ids, labels) => {
              setCustomerFilter(ids);
              setCustomerFilterLabels(labels);
            }}
          />
        </div>

        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
            {filtered.map((row) => {
              const active = !selectMode && !createOpen && !editRecord && (row.backendId ? row.backendId === selected?.backendId : row.id === selectedId);
              const isChecked = checked.has(Number(row.id));
              return (
                <button
                  key={String(row.backendId || row.id)}
                  type="button"
                  onClick={() => (selectMode ? toggleRow(Number(row.id)) : (setSelectedId(row.backendId || row.id), setCreateOpen(false), setEditRecord(null)))}
                  className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}
                >
                  {selectMode && (
                    <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{row.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{row.number}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{row.customerSubtitle || row.note}</div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-gray-500">{row.date}</span>
                    <span className="text-sm font-semibold text-gray-900 mt-0.5">{row.amount}</span>
                    <span className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge(row.status)}`}>{row.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <ListSidebarFooter
          total={fmtMoney(listTotal)}
          countLabel={`${listPagination?.totalData ?? filtered.length} Proforma Invoices`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {createOpen || (!selected && hasActiveListFilters) ? (
        <CreateInvoiceForm mode="proforma" onClose={() => setCreateOpen(false)} onSaved={(id) => { setSortBy("Created On"); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] }); }} />
      ) : editRecord ? (
        <CreateInvoiceForm key={selectedDb.id || selected.backendId} mode="proforma" invoice={editRecord} onClose={() => setEditRecord(null)} onSaved={(id) => { setEditRecord(null); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] }); }} />
      ) : selectMode ? (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} Proforma {checked.size === 1 ? "Invoice" : "Invoices"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedTotal)}</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="h-12 flex items-center justify-between gap-3 px-6 border-b border-gray-300 bg-gray-100">
              <div className="min-w-0">
                <DocPartyHeader
                  party="customer"
                  partyId={proformaCustomerId(selectedDoc) || partyIdFromRef((selectedCustomer as any)._id)}
                  title={selected.name}
                  subtitle={selected.customerSubtitle || customerDisplaySubtitle(selectedCustomer) || ""}
                />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {[
                  { icon: Settings, title: "Settings", onClick: () => setModal("settings") },
                  { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) },
                  { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") },
                  { icon: Pencil, title: "Edit", onClick: () => selectedDb?.id && setEditRecord(selectedDb) },
                  { icon: PenTool, title: "Customer Signature", onClick: () => setSigOpen(true) },
                  { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
                  { icon: Printer, title: "Print", onClick: () => setModal("preview") },
                  { icon: Mail, title: "Email", onClick: () => setModal("email") },
                ].map((item) => (
                  <button key={item.title} title={item.title} onClick={item.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><item.icon className="w-4 h-4" /></button>
                ))}
                <Dropdown align="right" panelClass="min-w-[200px]" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <div className="py-1">
                      <button type="button" onClick={() => { showToast("Opening WhatsApp...", "info"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
                      <button type="button" onClick={() => { convertToInvoice(); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Convert to Invoice</button>
                      <MoreMenuFlyoutRow label="Mark As">
                        {(["Draft", "Sent", "Invoiced", "Cancelled"] as Status[]).map((item) => (
                          <button key={item} type="button" onClick={() => { markAs(item); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">{item}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <MoreMenuFlyoutRow label="Duplicate">
                        {["As Invoice", "As Proforma Invoice", "As Purchase Order"].map((item) => (
                          <button key={item} type="button" onClick={() => { duplicateAs(item); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{item}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={() => { setSigRequestOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left border-t border-gray-200">Signature Request</button>
                      <button type="button" onClick={() => { setActivityOpen(true); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Activity Log</button>
                      <button type="button" onClick={() => { setConfirmAction("trashOne"); close(); }} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200">Trash</button>
                    </div>
                  )}
                </Dropdown>
              </div>
            </div>

            {expanded && (
              <>
                <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-300">
                  <div className="flex items-center gap-10">
                    <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
                    <div><div className="text-xs text-gray-500">Proforma Invoice date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(selected.status)}`}>{selected.status}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-5 py-4 border-b border-gray-300">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Billing Address</div>
                    {(billingLines.length ? billingLines : localBillingLines).length
                      ? (billingLines.length ? billingLines : localBillingLines).map((line: string, index: number) => (
                          <div key={index} className={`text-sm ${index === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{line}</div>
                        ))
                      : <div className="text-sm text-gray-400">—</div>}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Shipping Address</div>
                    {(shippingLines.length ? shippingLines : localShippingLines).length
                      ? (shippingLines.length ? shippingLines : localShippingLines).map((line: string, index: number) => (
                          <div key={index} className={`text-sm ${index === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{line}</div>
                        ))
                      : <div className="text-sm text-gray-400">—</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 px-5 py-3 border-b border-gray-300">
                  <div>
                    <div className="text-xs text-gray-500">Sub Title</div>
                    <div className="text-sm font-semibold text-gray-900">{apiText(selectedDoc?.sub_title) || selectedDb.subTitle || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Shipping Method</div>
                    <div className="text-sm font-semibold text-gray-900">{apiText(selectedDoc?.shipping_method) || selectedDb.shippingMethod || "—"}</div>
                  </div>
                </div>
              </>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-left font-semibold px-5 py-2.5">Sr. No.</th>
                    <th className="text-left font-semibold px-2 py-2.5">Items</th>
                    <th className="text-right font-semibold px-2 py-2.5">Quantity</th>
                    <th className="text-right font-semibold px-2 py-2.5">MRP</th>
                    <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                    <th className="text-left font-semibold px-2 py-2.5">Tax</th>
                    <th className="text-right font-semibold px-2 py-2.5">Discount</th>
                    <th className="text-right font-semibold px-5 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>}
                  {lines.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-300 align-top">
                      <td className="px-5 py-3 text-gray-700">{index + 1}</td>
                      <td className="px-2 py-3"><div className="font-semibold text-gray-900">{item.name}</div>{item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{item.qty || 1}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(0)}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(item.rate)}</td>
                      <td className="px-2 py-3 text-gray-800">{item.tax ? `${item.tax}%` : PF_TAX_NAME[1]}</td>
                      <td className="px-2 py-3 text-right text-gray-500 text-xs">{item.discount ? fmtMoney(item.discount) : "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(item.amount || item.qty * item.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.notes) || selectedDb.notes || "—"}</div>
              </div>
              <DocAttachmentField
                compact
                value={selectedDoc?.Attachment || selectedDb?.Attachment || selectedDb?.attachments || ""}
                onChange={async (path) => {
                  const id = String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "");
                  if (!id) {
                    showToast("Save the document first", "error");
                    throw new Error("missing id");
                  }
                  await updateProformaInvoice(id, { Attachment: path });
                  await queryClient.invalidateQueries({ queryKey: ["proforma-backend-detail", id] });
                  await queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] });
                  if (selectedDb?.id) await repo.update("proformas", selectedDb.id, { Attachment: path });
                  showToast(path ? "Attachment saved" : "Attachment removed", "success");
                }}
              />
              <div className="border border-gray-200 rounded-md overflow-hidden self-start">
                <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.sub_total ?? selectedDb.subTotal))}</span></div>
                <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Total Qty</span><span>{lines.reduce((sum, item) => sum + item.qty, 0).toFixed(2)}</span></div>
                {Object.entries(
                  lines.reduce((acc: Record<number, number>, item) => {
                    const rate = item.tax || 0;
                    acc[rate] = (acc[rate] || 0) + item.amount;
                    return acc;
                  }, {}),
                ).map(([rate, base]: [string, number]) => (
                  <div key={rate} className="flex justify-between px-4 py-2 text-xs text-gray-500">
                    <span>{(PF_TAX_NAME[Number(rate)] || "Tax")} {Number(rate)}% on {fmtMoney(base)}</span>
                    <span>{fmtMoney((base * Number(rate)) / 100)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.total ?? selectedDb.total))}</span></div>
              </div>
            </div>

            <div className="px-5 pb-5">
              <label className="text-xs text-gray-500">Terms &amp; Conditions</label>
              <div className="mt-1 min-h-20 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.terms_and_conditions) || selectedDb.terms || "—"}</div>
            </div>

            <SignatureBlock
              record={{
                ...selectedDb,
                signature: selectedDoc?.signature || selectedDb.signature,
                signatureName: selectedDb.signatureName,
                signatureTitle: selectedDb.signatureTitle,
                signatureDate: selectedDb.signatureDate,
              }}
              label="Customer Signature"
            />

            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 text-[10px] font-semibold py-1 text-center ${statusBadge(selected.status)}`}>{selected.status}</div>
            </div>
          </div>
        </section>
      )}

      {modal === "settings" && <AppSettingsModal initialTab="Proforma Invoice" onClose={() => setModal(null)} />}
      {modal === "preview" && !!selectedDb.id && (
        <PdfPreviewModal
          docType="proformaInvoice"
          recordId={selectedDb.id}
          backendId={String(selected?.backendId || selectedDb._id || "") || undefined}
          title="Proforma Invoice "
          onClose={() => setModal(null)}
        />
      )}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} row={selected} />}
      {modal === "pdfSettings" && <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="proformaInvoice" />}
      {sigOpen && <SignatureModal heading="Customer Signature" defaultName={selectedCustomer.contact || selectedCustomer.name || ""} onDone={saveSignature} onClose={() => setSigOpen(false)} />}
      {sigRequestOpen && (
        <SignatureRequestModal
          docLabel="Proforma Invoice"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedCustomer}
          documentId={String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="proforma_invoice"
          emailNav="proforma_invoice"
          pdfDocType="proformaInvoice"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{
            status:
              selectedDoc?.status && selectedDoc.status !== "Draft"
                ? selectedDoc.status
                : "Sent",
          }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void queryClient.invalidateQueries({ queryKey: ["proforma-backend-list"] });
            if (selected?.backendId) void queryClient.invalidateQueries({ queryKey: ["proforma-backend-detail", String(selected.backendId)] });
          }}
        />
      )}
      {activityOpen && (
        <Overlay onClose={() => setActivityOpen(false)}>
          <div className="w-full max-w-md my-16 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
              <h3 className="text-base font-semibold text-gray-900">Activity Log — Proforma Invoice {selected.number}</h3>
              <button onClick={() => setActivityOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {[
                ...(selectedDb.signatureDate ? [{ text: `Customer signature added by ${selectedDb.signatureName || "customer"}.`, date: selectedDb.signatureDate }] : []),
                ...(selected.status && selected.status !== "Draft" ? [{ text: `Marked as ${selected.status}.`, date: selected.date }] : []),
                { text: `Proforma Invoice ${selected.number} created.`, date: selected.date },
              ].map((row, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></div>
                  <div>
                    <div className="text-sm text-gray-800">{row.text}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{row.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Overlay>
      )}
      {confirmAction === "trashOne" && <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete this proforma invoice? This cannot be undone." : "Are you sure want to trash this proforma invoice?"} onNo={() => setConfirmAction(null)} onYes={trashCurrent} />}
      {confirmAction === "trashSelected" && <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete these proforma invoices? This cannot be undone." : "Are you sure want to delete these proforma invoices?"} onNo={() => setConfirmAction(null)} onYes={trashSelected} />}
    </div>
  );
};

export default ProformaInvoices;
