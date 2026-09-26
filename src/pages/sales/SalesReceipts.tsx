/**
 * File: src/pages/sales/SalesReceipts.tsx
 * Sales Receipt — backend-driven master/detail layout.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { ActivityLogModal } from "@/components/modals/ActivityLogModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { showToast } from "@/utils/toast";
import { useCollection, repo, nextNumber, money as fmtMoney, PdfPreviewModal } from "@/lib/db";
import { api } from "@/lib/api/client";
import { buildListSortParam } from "@/lib/listSort";
import { dateRangeFor } from "@/lib/listDateRange";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { CreateDocForm } from "@/lib/db";
import { PaymentMethodsModal } from "@/components/modals/PaymentMethodsModal";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { fetchSalesReceipt, fetchSalesReceipts, hardDeleteSalesReceipt, hardDeleteSalesReceipts, restoreSalesReceipts } from "@/services/salesReceiptsApi";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
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
  Copy,
  Signature,
  History,
  RotateCcw,
  CircleChevronUp,
  CircleChevronDown,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

type ReceiptRow = {
  id: number | string;
  backendId: string;
  name: string;
  customerSubtitle: string;
  number: string;
  note: string;
  date: string;
  amount: string;
  currency: string;
  paymentType: string;
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

const SR_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const SR_TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const duplicateAs = ["As Sales Receipt", "As Invoice", "As Estimate"];
const sortFields = ["Created On", "Name", "Sales receipt date", "Sales Receipt #", "Total"];
const sortDirections: Array<"Ascending" | "Descending"> = ["Ascending", "Descending"];
const statusList = ["All", "Trash"];
const dateRanges = ["All", "Today", "This Week", "This Month", "Last 30 Days", "This Year"];

const nowLabel = () => "Today " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const apiText = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const numberValue = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const customerDisplayName = (customer: any): string => apiText(customer?.businessProfile?.companyName) || apiText(customer?.company_name) || apiText(customer?.name) || apiText(customer?.contact) || "—";
const customerDisplaySubtitle = (customer: any): string => [apiText(customer?.name), apiText(customer?.email)].filter(Boolean).join(" · ");
const addressLines = (address?: { street?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string }) => [address?.street, address?.street2, [address?.city, address?.state, address?.zip].filter(Boolean).join(", "), address?.country].filter(Boolean);
const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};
const receiptSortToBackend = (value: string) => {
  switch (value) {
    case "Sales Receipt #":
      return "invoice_number";
    case "Name":
      return "customer_name";
    case "Total":
      return "total";
    case "Sales receipt date":
      return "date";
    case "Created On":
    default:
      return "createdAt";
  }
};
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

const EmailModal: React.FC<{ onClose: () => void; row: ReceiptRow }> = ({ onClose, row }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
        <h3 className="text-base font-medium text-gray-900">Sales Receipt {row.number} from info</h3>
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
        <input defaultValue={`Sales Receipt ${row.number} from info`} className="w-full border-b border-gray-300 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-300 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {row.name}</p>
          <p>Sales Receipt {row.number}<br />Total Amount: {row.amount}</p>
        </div>
      </div>
    </div>
  </Overlay>
);

export const SalesReceipts: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number | string; openCreate?: boolean } | null) ?? null;
  const [selectedId, setSelectedId] = useState<number | string>(navState?.selectedId ?? 0);
  const [sortBy, setSortBy] = useState("Created On");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "pdfSettings">(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);

  useEffect(() => {
    if (navState?.selectedId != null) setSelectedId(navState.selectedId);
  }, [navState?.selectedId]);
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
  useEffect(() => { setPage(1); }, [sortBy, sortDir, statusFilter, customerFilter, dateFilter]);

  const dbReceipts = useCollection<any>("salesReceipts");
  const dbCustomers = useCollection<any>("customers", "name");

  const dateRange = dateRangeFor(dateFilter);
  const { data: backendList } = useQuery({
    queryKey: ["sales-receipt-backend-list", page, search, sortBy, sortDir, customerFilter, dateFilter, statusFilter],
    queryFn: () => fetchSalesReceipts({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(receiptSortToBackend(sortBy), sortDir),
      status: statusFilter === "Trash" ? undefined : statusFilter,
      isDeleted: statusFilter === "Trash" || undefined,
      customer_id: partyFilterParam(customerFilter),
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      dateField: "date",
    }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const listPagination = backendList?.pagination;

  const filtered = useMemo<ReceiptRow[]>(() => {
    const backendRows = backendList?.rows ?? [];
    return backendRows.map((row) => {
      const linkedLocal = dbReceipts.find((item) => item._id === row._id) || dbReceipts.find((item) => String(item.number).replace(/^#/, "") === row.number);
      return {
        id: linkedLocal?.id ?? (Number(row.number) || Math.abs(String(row._id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0))),
        backendId: row._id,
        name: row.customerName || customerDisplayName(dbCustomers.find((c) => c._id === row.customerId)),
        customerSubtitle: row.customerSubtitle || "",
        number: `#${row.number}`,
        note: linkedLocal?.notes || "No Notes",
        date: row.dateLabel,
        amount: fmtMoney(row.amount),
        currency: row.currency || "USD",
        paymentType: row.paymentType || linkedLocal?.paymentType || linkedLocal?.method || "",
      };
    });
  }, [backendList?.rows, dbCustomers, dbReceipts]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((item) => item.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0];
  const selectedDb = dbReceipts.find((item) => item.id === selected?.id) || dbReceipts.find((item) => item._id === selected?.backendId) || {};
  const selectedCustomer = dbCustomers.find((item) => item.id === selectedDb.customerId) || {};
  const { data: selectedDoc } = useQuery({
    queryKey: ["sales-receipt-backend-detail", selected?.backendId],
    queryFn: () => fetchSalesReceipt(String(selected?.backendId)),
    enabled: !!selected?.backendId,
    staleTime: 30_000,
  });

  const lines = useMemo<DetailLine[]>(() => {
    const products = (selectedDoc?.product ?? []).map((item, index) => ({
      id: `p-${index}`,
      name: apiText(item.product_name || (typeof item.product_id === "object" ? item.product_id?.productName : "")) || "Product",
      description: apiText(item.description || (typeof item.product_id === "object" ? item.product_id?.description : "")),
      qty: numberValue(item.quantity),
      rate: numberValue(item.rate),
      tax: numberValue(item.tax),
      discount: numberValue(item.discount),
      amount: numberValue(item.amount),
    }));
    const services = (selectedDoc?.service ?? []).map((item, index) => ({
      id: `s-${index}`,
      name: apiText(item.service_name || (typeof item.service_id === "object" ? item.service_id?.serviceName : "")) || "Service",
      description: apiText(item.description || (typeof item.service_id === "object" ? item.service_id?.description : "")),
      qty: numberValue(item.quantity),
      rate: numberValue(item.rate),
      tax: numberValue(item.tax),
      discount: numberValue(item.discount),
      amount: numberValue(item.amount),
    }));
    if (products.length || services.length) return [...products, ...services];
    return (selectedDb.items || []).map((item: any, index: number) => ({ id: `l-${index}`, name: item.name || "Item", description: item.description || "", qty: numberValue(item.qty ?? 1), rate: numberValue(item.rate), tax: 0, discount: numberValue(item.discount), amount: numberValue(item.amount ?? numberValue(item.qty) * numberValue(item.rate)) }));
  }, [selectedDb.items, selectedDoc?.product, selectedDoc?.service]);

  const logActivity = async (kind: string, text: string) => {
    if (!selectedDb?.id) return;
    const rec = dbReceipts.find((d) => d.id === selectedDb.id);
    await repo.update("salesReceipts", selectedDb.id, { activity: [...(rec?.activity || []), { kind, text, ts: Date.now(), dateLabel: nowLabel() }] });
  };

  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedDoc?._id || selected?.backendId || selectedDb?._id;
    let signaturePath = data.image;
    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `sales-receipt-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
        signaturePath = uploadRes.data?.data?.file_path || uploadRes.data?.data?.path || data.image;
        await repo.update("salesReceipts", selectedDb.id, { signature: signaturePath });
        await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-detail", String(backendId)] });
      }
      if (selectedDb?.id) {
        await repo.update("salesReceipts", selectedDb.id, { signature: signaturePath, signatureName: data.name, signatureTitle: data.title, signatureDate: data.date });
      }
      await logActivity("status", `Customer signature added to Sales Receipt ${selectedDb.number}.`);
      showToast("Signature saved", "success");
    } catch {
      showToast("Could not save signature", "error");
    }
  };

  const duplicateReceiptAs = async (label: string) => {
    const base = { customerId: selectedDb.customerId, date: selectedDb.date, due: selectedDb.due, ts: Date.now(), items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0, tax: selectedDb.tax || 0, total: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "", inlineDiscount: selectedDb.inlineDiscount || 0, currency: selectedDb.currency || "USD" };
    if (label === "As Sales Receipt") {
      const n = await nextNumber("salesReceipts");
      const id = await repo.add("salesReceipts", { ...base, number: "#" + n, paymentType: selectedDb.paymentType || "", paymentMethod: selectedDb.paymentType ? [selectedDb.paymentType] : [] });
      setSelectedId(id);
      showToast("Sales receipt duplicated", "success");
    } else if (label === "As Invoice") {
      const n = await nextNumber("invoices");
      const id = await repo.add("invoices", { ...base, number: "#" + n, status: "Draft", shipping: 0, amountPaid: 0, amountDue: base.total });
      showToast("Invoice created", "success");
      navigate("/sales/sales-invoice", { state: { selectedId: id } });
    } else if (label === "As Estimate") {
      const n = await nextNumber("estimates");
      const id = await repo.add("estimates", { ...base, number: "#" + n, status: "Draft" });
      showToast("Estimate created", "success");
      navigate("/sales/estimates", { state: { selectedId: id } });
    }
  };

  const trashCurrent = async () => {
    if (!selectedDb?.id && !selected?.backendId) return;
    if (statusFilter === "Trash") {
      const backendId = selected?.backendId || selectedDb?._id;
      if (backendId) await hardDeleteSalesReceipt(String(backendId));
    } else if (selectedDb?.id) {
      await repo.remove("salesReceipts", selectedDb.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] });
    showToast(
      statusFilter === "Trash"
        ? `Sales Receipt ${selectedDb.number} permanently deleted`
        : `Sales Receipt ${selectedDb.number} moved to trash`,
      "success",
    );
    setSelectedId(filtered.find((item) => item.id !== selectedDb.id)?.id ?? 0);
    setConfirmAction(null);
  };
  const trashSelectedReceipts = async () => {
    const ids = [...checked];
    const backendIds = filtered.filter((item) => ids.includes(Number(item.id)) && item.backendId).map((item) => String(item.backendId));
    if (statusFilter === "Trash") {
      if (backendIds.length) await hardDeleteSalesReceipts(backendIds);
    } else {
      await repo.removeMany("salesReceipts", ids);
    }
    await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] });
    showToast(
      statusFilter === "Trash"
        ? `${ids.length} sales ${ids.length === 1 ? "receipt" : "receipts"} permanently deleted`
        : `${ids.length} sales ${ids.length === 1 ? "receipt" : "receipts"} moved to trash`,
      "success",
    );
    if (ids.includes(Number(selectedId))) setSelectedId(filtered.find((item) => !ids.includes(Number(item.id)))?.id ?? 0);
    setConfirmAction(null);
    exitSelect();
  };
  const restoreSelectedReceipts = async () => {
    const ids = [...checked];
    const backendIds = filtered.filter((item) => ids.includes(Number(item.id)) && item.backendId).map((item) => String(item.backendId));
    if (backendIds.length === 0) { showToast("Select sales receipts to restore", "warning"); return; }
    await restoreSalesReceipts(backendIds);
    await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] });
    showToast(`${backendIds.length} sales ${backendIds.length === 1 ? "receipt" : "receipts"} restored`, "success");
    exitSelect();
  };

  const listTotal = filtered.reduce((sum, item) => sum + numberValue(item.amount.replace(/[^0-9.-]/g, "")), 0);
  const allSelected = filtered.length > 0 && filtered.every((item) => checked.has(Number(item.id)));
  const selectedTotal = filtered.filter((item) => checked.has(Number(item.id))).reduce((sum, item) => sum + numberValue(item.amount.replace(/[^0-9.-]/g, "")), 0);
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: number) => setChecked((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((item) => Number(item.id)))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const hasActiveListFilters = !!search.trim() || customerFilter.length > 0 || dateFilter !== "All" || statusFilter !== "All";
  if (!selected && !createOpen && !hasActiveListFilters) {
    return <ListEmptyState title="No sales receipts yet" onCreate={() => setCreateOpen(true)} createLabel="New Sales Receipt" />;
  }

  const billingLines = addressLines(selectedDoc?.billing_address);
  const shippingLines = addressLines(selectedDoc?.shipping_address);
  const localBillingLines = [selectedCustomer.street1, selectedCustomer.street2, [selectedCustomer.city, selectedCustomer.zip].filter(Boolean).join(" "), selectedCustomer.country].filter(Boolean);
  const localShippingLines = [selectedCustomer.shipStreet1, selectedCustomer.shipStreet2, [selectedCustomer.shipCity, selectedCustomer.shipZip].filter(Boolean).join(" "), selectedCustomer.shipCountry].filter(Boolean);
  const paymentType = apiText(selectedDoc?.payment_method?.[0]) || selected.paymentType || selectedDb.paymentType || selectedDb.method || "—";

  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Sales Receipt" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              {statusFilter === "Trash" && (
                <button title="Restore" onClick={() => (checked.size === 0 ? showToast("Select sales receipts to restore", "warning") : restoreSelectedReceipts())} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
              )}
              <button title={statusFilter === "Trash" ? "Delete permanently" : "Delete"} onClick={() => (checked.size === 0 ? showToast("Select sales receipts to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp...", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Sales Receipts</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Sales Receipts")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("sales-receipts"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("sales-receipts"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}
        <div className="px-3 py-2 border-b border-gray-300"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search sales receipts..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" /></div></div>
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>{(close) => (<>{sortFields.map((item) => <button key={item} onClick={() => { setSortBy(item); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{item} {item === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>)}<div className="border-t border-gray-200 my-1" />{sortDirections.map((dir) => <button key={dir} onClick={() => { setSortDir(dir); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{dir} {dir === sortDir && <Check className="w-4 h-4 text-blue-600" />}</button>)}</>)}</Dropdown>
          <Dropdown trigger={<span className={`inline-flex items-center gap-1 text-xs border border-dashed rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400 ${statusFilter === "Trash" ? "text-red-500 border-red-300" : "text-gray-600 border-gray-300"}`}><Plus className="w-3 h-3" />Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}</span>}>{(close) => statusList.map((item) => <button key={item} onClick={() => { setStatusFilter(item); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${item === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{item} {item === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>)}</Dropdown>
          <PartyFilterPopover
            kind="customer"
            appliedIds={customerFilter}
            appliedLabels={customerFilterLabels}
            onApply={(ids, labels) => {
              setCustomerFilter(ids);
              setCustomerFilterLabels(labels);
            }}
          />
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Sales receipt date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>{(close) => dateRanges.map((item) => <button key={item} onClick={() => { setDateFilter(item); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{item} {item === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>)}</Dropdown>
        </div>
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
            {filtered.map((row) => {
              const active = !selectMode && !createOpen && !editOpen && row.id === selectedId;
              const isChecked = checked.has(Number(row.id));
              return (
                <button key={String(row.id)} onClick={() => (selectMode ? toggleRow(Number(row.id)) : (setSelectedId(row.id), setCreateOpen(false), setEditOpen(false)))} className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                  {selectMode && <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{row.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{row.number}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{row.customerSubtitle || row.note}</div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-gray-500">{row.date}</span>
                    <span className="text-sm font-semibold text-gray-900 mt-1">{row.amount}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <ListSidebarFooter
          total={fmtMoney(listTotal)}
          countLabel={`${listPagination?.totalData ?? filtered.length} Sales Receipts`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {createOpen || (!selected && hasActiveListFilters) ? (
        <CreateDocForm collection="salesReceipts" title="Create Sales Receipt" party="customers" paymentType amountDue onClose={() => setCreateOpen(false)} onSaved={(id) => { setSortBy("Created On"); setSortDir("Descending"); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] }); }} />
      ) : editOpen ? (
        <CreateDocForm key={selectedDb.id || selected.backendId} collection="salesReceipts" title="Edit Sales Receipt" party="customers" paymentType amountDue record={selectedDb} onClose={() => setEditOpen(false)} onSaved={(id) => { setEditOpen(false); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] }); }} />
      ) : selectMode ? (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm"><div className="text-center"><h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} Sales {checked.size === 1 ? "Receipt" : "Receipts"} Selected</h2><div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left"><span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedTotal)}</span></div></div></section>
      ) : (
        <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="h-12 flex items-center justify-between gap-3 px-6 border-b border-gray-300 bg-gray-100">
              <DocPartyHeader
                party="customer"
                partyId={partyIdFromRef(selectedDoc?.customer_id) || partyIdFromRef((selectedCustomer as any)._id)}
                title={selected.name}
                subtitle={selected.customerSubtitle || customerDisplaySubtitle(selectedCustomer) || ""}
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {[{ icon: Settings, title: "Settings", onClick: () => setModal("settings") }, { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) }, { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") }, { icon: Pencil, title: "Edit", onClick: () => setEditOpen(true) }, { icon: PenTool, title: "Customer Signature", onClick: () => setSigOpen(true) }, { icon: Eye, title: "Preview", onClick: () => setModal("preview") }, { icon: Printer, title: "Print", onClick: () => { logActivity("printed", `Sales Receipt ${selectedDb.number} printed.`); setModal("preview"); } }, { icon: Mail, title: "Email", onClick: () => setModal("email") }].map((item) => <button key={item.title} title={item.title} onClick={item.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><item.icon className="w-4 h-4" /></button>)}
                <Dropdown align="right" panelClass="w-56" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <>
                      <button type="button" onClick={() => { showToast("Opening WhatsApp...", "info"); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-400" /></button>
                      <MoreMenuFlyoutRow
                        label={<span className="flex items-center gap-2"><Copy className="w-4 h-4 text-gray-400" /> Duplicate</span>}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        {duplicateAs.map((item) => (
                          <button key={item} type="button" onClick={() => { duplicateReceiptAs(item); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{item}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <button type="button" onClick={() => { setSigRequestOpen(true); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><Signature className="w-4 h-4 text-gray-400" /> Signature Request</button>
                      <button type="button" onClick={() => { setActivityOpen(true); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"><History className="w-4 h-4 text-gray-400" /> Activity Log</button>
                      <button type="button" onClick={() => { setConfirmAction("trashOne"); close(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left border-t border-gray-200"><Trash2 className="w-4 h-4" /> Trash</button>
                    </>
                  )}
                </Dropdown>
              </div>
            </div>
            {expanded && <>
              <div className="flex items-center gap-12 px-5 py-3 border-b border-gray-300">
                <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.total ?? selectedDb.total))}</div></div>
                <div><div className="text-xs text-gray-500">Sales receipt date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                <div>
                  <button type="button" onClick={() => setPaymentMethodsOpen(true)} className="mb-0.5 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    Payment Type <Pencil className="w-3 h-3" />
                  </button>
                  <div className="text-sm font-semibold text-gray-900">{paymentType}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-5 py-4 border-b border-gray-300">
                <div><div className="text-xs text-gray-500 mb-1">Billing Address</div>{(billingLines.length ? billingLines : localBillingLines).length ? (billingLines.length ? billingLines : localBillingLines).map((line: string, index: number) => <div key={index} className={`text-sm ${index === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{line}</div>) : <div className="text-sm text-gray-400">—</div>}</div>
                <div><div className="text-xs text-gray-500 mb-1">Shipping Address</div>{(shippingLines.length ? shippingLines : localShippingLines).length ? (shippingLines.length ? shippingLines : localShippingLines).map((line: string, index: number) => <div key={index} className={`text-sm ${index === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{line}</div>) : <div className="text-sm text-gray-400">—</div>}</div>
              </div>
            </>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead><tr className="bg-gray-50 text-gray-500 text-xs"><th className="text-left font-semibold px-5 py-2.5">Sr. No.</th><th className="text-left font-semibold px-2 py-2.5">Items</th><th className="text-right font-semibold px-2 py-2.5">Quantity</th><th className="text-right font-semibold px-2 py-2.5">Rate</th><th className="text-left font-semibold px-2 py-2.5">Tax</th><th className="text-right font-semibold px-2 py-2.5">Discount</th><th className="text-right font-semibold px-5 py-2.5">Amount</th></tr></thead>
                <tbody>{lines.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>}{lines.map((item, index) => <tr key={item.id} className="border-b border-gray-300 align-top"><td className="px-5 py-3 text-gray-700">{index + 1}</td><td className="px-2 py-3"><div className="font-semibold text-gray-900">{item.name}</div>{item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}</td><td className="px-2 py-3 text-right text-gray-800">{item.qty || 1}</td><td className="px-2 py-3 text-right text-gray-800">{fmtMoney(item.rate)}</td><td className="px-2 py-3 text-gray-800">{item.tax ? `${item.tax}%` : SR_TAX_NAME[1]}</td><td className="px-2 py-3 text-right text-gray-500 text-xs">{item.discount ? `${item.discount}%` : "—"}</td><td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(item.amount || item.qty * item.rate)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              <div className="space-y-4"><div><label className="text-xs text-gray-500">Terms &amp; Conditions</label><div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.terms_and_conditions) || selectedDb.terms || "—"}</div></div><DocAttachmentField compact value={selectedDoc?.Attachment || selectedDb?.Attachment || selectedDb?.attachments || ""} onChange={async (path) => { const id = String(selectedDoc?._id || selected?.backendId || selectedDb?._id || ""); if (!id) { showToast("Save the document first", "error"); throw new Error("missing id"); } await api.raw.post(`/sales-receipt/edit/${id}`, { Attachment: path }); await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-detail", id] }); await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] }); if (selectedDb?.id) await repo.update("salesReceipts", selectedDb.id, { Attachment: path }); showToast(path ? "Attachment saved" : "Attachment removed", "success"); }} /></div>
              <div><label className="text-xs text-gray-500">Notes</label><div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.notes) || selectedDb.notes || "—"}</div></div>
              <div className="border border-gray-200 rounded-md overflow-hidden self-start"><div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.sub_total ?? selectedDb.subTotal))}</span></div>{(selectedDb.inlineDiscount || 0) > 0 && <div className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>Inline Discount</span><span>{fmtMoney(selectedDb.inlineDiscount)}</span></div>}{Object.entries(lines.reduce((acc: Record<number, number>, item) => { const rate = item.tax || 0; acc[rate] = (acc[rate] || 0) + item.amount; return acc; }, {})).map(([taxId, base]: [string, number]) => <div key={taxId} className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>{SR_TAX_NAME[Number(taxId)] || "Tax"} {Number(taxId)}% on {fmtMoney(base)}</span><span>{fmtMoney((base * Number(taxId)) / 100)}</span></div>)}<div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.total ?? selectedDb.total))}</span></div></div>
            </div>
            <SignatureBlock record={{ ...selectedDb, signature: selectedDoc?.signature || selectedDb.signature }} label="Customer Signature" />
          </div>
        </section>
      )}

      {modal === "settings" && <AppSettingsModal initialTab="Sales Receipt" onClose={() => setModal(null)} />}
      {modal === "preview" && !!selectedDb.id && (
        <PdfPreviewModal
          docType="salesReceipt"
          recordId={selectedDb.id}
          backendId={String(selected?.backendId || selectedDb._id || "") || undefined}
          title="Sales Receipt "
          onClose={() => setModal(null)}
        />
      )}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} row={selected} />}
      {sigOpen && <SignatureModal heading="Customer Signature" defaultName={selectedCustomer.contact || selectedCustomer.name || ""} onDone={saveSignature} onClose={() => setSigOpen(false)} />}
      {sigRequestOpen && (
        <SignatureRequestModal
          docLabel="Sales Receipt"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedCustomer}
          documentId={String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="sales_receipt"
          emailNav="sales_receipt"
          pdfDocType="salesReceipt"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{
            status:
              selectedDoc?.status && selectedDoc.status !== "Draft"
                ? selectedDoc.status
                : "Open",
          }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void logActivity("sent", `Signature request for Sales Receipt ${selectedDb.number} sent.`);
            void queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] });
            if (selected?.backendId) void queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-detail", String(selected.backendId)] });
          }}
        />
      )}
      {paymentMethodsOpen && (
        <PaymentMethodsModal
          selectedNames={paymentType && paymentType !== "—" ? [paymentType] : []}
          allowMultiple={false}
          onSaveSelection={async (names) => {
            const id = String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "");
            if (!id) {
              showToast("Select a sales receipt first", "warning");
              return;
            }
            const name = names[0] || "";
            try {
              await api.raw.post(`/sales-receipt/edit/${id}`, { payment_method: name ? [name] : [] });
              await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-detail", id] });
              await queryClient.invalidateQueries({ queryKey: ["sales-receipt-backend-list"] });
              if (selectedDb?.id) {
                await repo.update("salesReceipts", selectedDb.id, { paymentType: name, payment_method: name ? [name] : [] });
              }
              showToast("Payment method updated", "success");
            } catch {
              showToast("Could not update payment method", "error");
            }
          }}
          onClose={() => setPaymentMethodsOpen(false)}
        />
      )}
      {modal === "pdfSettings" && <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="salesReceipt" />}
      {activityOpen && <ActivityLogModal docLabel="Sales Receipt" record={selectedDb} onClose={() => setActivityOpen(false)} />}
      {confirmAction === "trashOne" && <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete this sales receipt? This cannot be undone." : "Are you sure want to trash this sales receipt?"} onNo={() => setConfirmAction(null)} onYes={trashCurrent} />}
      {confirmAction === "trashSelected" && <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete these sales receipts? This cannot be undone." : "Are you sure want to delete these sales receipts?"} onNo={() => setConfirmAction(null)} onYes={trashSelectedReceipts} />}
    </div>
  );
};

export default SalesReceipts;
