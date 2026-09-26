import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildListSortParam } from "@/lib/listSort";
import { dateRangeFor } from "@/lib/listDateRange";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useCollection, repo, nextNumber, money as fmtMoney, PdfPreviewModal } from "@/lib/db";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { ActivityLogModal } from "@/components/modals/ActivityLogModal";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { api } from "@/lib/api/client";
import { CreateInvoiceForm } from "./CreateInvoiceForm";
import { fetchEstimate, fetchEstimates, updateEstimate, deleteEstimate, hardDeleteEstimate, hardDeleteEstimates, restoreEstimates, estimateCustomerId, type BackendEstimateDoc } from "@/services/estimatesApi";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
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
  Trash2,
  MessageCircle,
  Copy,
  Signature,
  History,
  RotateCcw,
  CircleChevronUp,
  CircleChevronDown,
  Package,
} from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

type Status = "Draft" | "Sent" | "Approved" | "Invoiced" | "On Hold" | "Disputed" | "Declined" | "Cancelled";
type EstimateRow = { id: number | string; backendId: string; name: string; customerSubtitle: string; number: string; note: string; date: string; amount: string; status: string; currency: string };
type DetailLine = { id: string; name: string; description: string; qty: number; rate: number; tax: number; discount: number; amount: number };

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-gray-600 text-white border-transparent",
  Sent: "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-green-100 text-green-700 border-green-200",
  Invoiced: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "On Hold": "bg-amber-100 text-amber-700 border-amber-200",
  Disputed: "bg-orange-100 text-orange-700 border-orange-200",
  Declined: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};
const EST_TAX_RATE: Record<number, number> = { 1: 58, 2: 72, 3: 15, 4: 5 };
const EST_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const sortFields = ["Created On", "Name", "Estimate date", "Estimate #", "Status", "Total"];
const sortDirections: Array<"Ascending" | "Descending"> = ["Ascending", "Descending"];
const statusList = ["All", "Draft", "Sent", "Approved", "Invoiced", "On Hold", "Disputed", "Declined", "Cancelled", "Trash"];
const markAsStatuses = ["Draft", "Sent", "Approved", "Invoiced", "On Hold", "Disputed", "Declined", "Cancelled"];
const duplicateAs = ["As Invoice", "As Estimate", "As Proforma Invoice", "As Purchase Order"];
const dateRanges = ["All", "Today", "This Week", "This Month", "Last 30 Days", "This Year"];

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const numberValue = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const nowLabel = () => "Today " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const badgeOf = (value: string) => STATUS_BADGE[value] || "bg-gray-600 text-white border-transparent";
const customerDisplayName = (customer: any): string => apiText(customer?.businessProfile?.companyName) || apiText(customer?.company_name) || apiText(customer?.name) || "—";
const customerDisplaySubtitle = (customer: any): string => [apiText(customer?.name), apiText(customer?.email)].filter(Boolean).join(" · ");
const apiText = (value: unknown): string => text(value);
const addressLines = (address?: BackendEstimateDoc["billing_address"]) => [address?.street, address?.street2, [address?.city, address?.state, address?.zip].filter(Boolean).join(", "), address?.country].filter(Boolean);
const estimateSortToBackend = (value: string) => {
  switch (value) {
    case "Estimate #":
      return "invoice_number";
    case "Name":
      return "customer_name";
    case "Status":
      return "status";
    case "Total":
      return "total";
    case "Estimate date":
      return "date";
    case "Created On":
    default:
      return "createdAt";
  }
};
const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}><div onMouseDown={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div></div>;
};

const EmailModal: React.FC<{ onClose: () => void; row: EstimateRow }> = ({ onClose, row }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
        <h3 className="text-base font-medium text-gray-900">Estimate {row.number} from info</h3>
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
        <input defaultValue={`Estimate ${row.number} from info`} className="w-full border-b border-gray-300 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-300 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {row.name}</p>
          <p>Estimate {row.number}<br />Total Amount: {row.amount}</p>
        </div>
      </div>
    </div>
  </Overlay>
);

const PackingSlipModal: React.FC<{ onClose: () => void; row: EstimateRow }> = ({ onClose, row }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl bg-white">
      <div className="flex items-center justify-between px-5 py-3 bg-[#2a2f36] text-white">
        <h3 className="text-base font-medium">Packing Slip {row.number}</h3>
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-white/10">Close</button>
      </div>
      <div className="p-6 text-sm text-gray-700">
        <div className="border border-gray-300 p-5">
          <h2 className="text-center text-xl font-semibold text-gray-900 border-b border-gray-300 pb-3">PACKING SLIP</h2>
          <div className="mt-4 grid grid-cols-2 gap-6">
            <div><div className="font-semibold text-gray-900">{row.name}</div><div>{row.number}</div></div>
            <div className="text-right"><div>{row.date}</div></div>
          </div>
        </div>
      </div>
    </div>
  </Overlay>
);

export const Estimates: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number | string; openCreate?: boolean } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<number | string>(navSelectedId ?? 0);
  const [sortBy, setSortBy] = useState("Created On");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "settings" | "preview" | "packing" | "email" | "pdfSettings">(null);
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  const [editOpen, setEditOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  useEffect(() => { if (navSelectedId != null) setSelectedId(navSelectedId); }, [navSelectedId]);
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

  const dbEstimates = useCollection<any>("estimates");
  const dbCustomers = useCollection<any>("customers", "name");

  const dateRange = dateRangeFor(dateFilter);
  useEffect(() => { setPage(1); }, [sortBy, sortDir, statusFilter, customerFilter, dateFilter]);
  const { data: backendList } = useQuery({
    queryKey: ["estimate-list", page, search, sortBy, sortDir, statusFilter, customerFilter, dateFilter],
    queryFn: () => fetchEstimates({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(estimateSortToBackend(sortBy), sortDir),
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

  const filtered = useMemo<EstimateRow[]>(() => {
    const rows = backendList?.rows ?? [];
    return rows.map((row) => {
      const linkedLocal = dbEstimates.find((item) => item._id === row._id) || dbEstimates.find((item) => String(item.number).replace(/^#/, "") === row.number);
      return {
        id: linkedLocal?.id ?? (Number(row.number) || Math.abs(String(row._id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0))),
        backendId: row._id,
        name: row.customerName || customerDisplayName(dbCustomers.find((c) => c._id === row.customerId)),
        customerSubtitle: row.customerSubtitle || "",
        number: `#${row.number}`,
        note: linkedLocal?.notes || "No Notes",
        date: row.dateLabel,
        amount: fmtMoney(row.amount),
        status: row.status || "Draft",
        currency: row.currency || "USD",
      };
    });
  }, [backendList?.rows, dbCustomers, dbEstimates]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((item) => item.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0];
  const selectedDb = dbEstimates.find((item) => item.id === selected?.id) || dbEstimates.find((item) => item._id === selected?.backendId) || {};
  const selectedCustomer = dbCustomers.find((item) => item.id === selectedDb.customerId) || {};
  const { data: selectedDoc } = useQuery({
    queryKey: ["estimate-detail", selected?.backendId],
    queryFn: () => fetchEstimate(String(selected?.backendId)),
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
    return (selectedDb.items || []).map((item: any, index: number) => ({ id: `l-${index}`, name: item.name || "Item", description: item.description || "", qty: numberValue(item.qty ?? 1), rate: numberValue(item.rate), tax: EST_TAX_RATE[item.taxId || 1] || 0, discount: numberValue(item.discount), amount: numberValue(item.amount ?? numberValue(item.qty) * numberValue(item.rate)) }));
  }, [selectedDb.items, selectedDoc?.product, selectedDoc?.service]);

  const logActivity = async (kind: string, message: string) => {
    if (!selectedDb?.id) return;
    const current = dbEstimates.find((item) => item.id === selectedDb.id);
    await repo.update("estimates", selectedDb.id, { activity: [...(current?.activity || []), { kind, text: message, ts: Date.now(), dateLabel: nowLabel() }] });
  };
  const markAs = async (status: string) => {
    const backendId = selectedDoc?._id || selected?.backendId;
    if (backendId) await updateEstimate(String(backendId), { status });
    if (selectedDb?.id) await repo.update("estimates", selectedDb.id, { status });
    await queryClient.invalidateQueries({ queryKey: ["estimate-list"] });
    await queryClient.invalidateQueries({ queryKey: ["estimate-detail", String(backendId)] });
    await logActivity(status === "Sent" ? "sent" : "status", `Estimate ${selectedDb.number} marked as ${status.toLowerCase()}.`);
    showToast(`Estimate marked as ${status}`, "success");
  };
  const convertToInvoice = async () => {
    const est = selectedDb;
    if (!est?.id) return;
    const number = await nextNumber("invoices");
    const id = await repo.add("invoices", {
      number: "#" + number,
      customerId: est.customerId,
      date: est.date,
      due: est.due || est.date,
      ts: Date.now(),
      status: "Draft",
      items: est.items || [],
      subTotal: est.subTotal || 0,
      tax: est.tax || 0,
      shipping: 0,
      total: est.total || 0,
      amountPaid: 0,
      amountDue: est.total || 0,
      notes: `Converted from Estimate ${est.number}`,
      terms: est.terms || "",
      currency: est.currency || "USD",
    });
    await markAs("Invoiced");
    showToast("Converted to invoice", "success");
    navigate("/sales/sales-invoice", { state: { selectedId: id } });
  };
  const duplicateEstAs = async (label: string) => {
    const base = { customerId: selectedDb.customerId, date: selectedDb.date, due: selectedDb.due, ts: Date.now(), items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0, tax: selectedDb.tax || 0, total: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "", currency: selectedDb.currency || "USD" };
    if (label === "As Invoice") {
      const number = await nextNumber("invoices");
      const id = await repo.add("invoices", { ...base, number: "#" + number, status: "Draft", amountPaid: 0, amountDue: base.total });
      showToast("Invoice created", "success");
      navigate("/sales/sales-invoice", { state: { selectedId: id } });
    } else if (label === "As Estimate") {
      const number = await nextNumber("estimates");
      const id = await repo.add("estimates", { ...base, number: "#" + number, status: "Draft" });
      setSelectedId(id);
      showToast("Estimate duplicated", "success");
    } else if (label === "As Proforma Invoice") {
      const number = await nextNumber("proformas");
      const id = await repo.add("proformas", { ...base, number: "#" + number, status: "Sent", amountPaid: 0, amountDue: base.total });
      showToast("Proforma invoice created", "success");
      navigate("/sales/proforma-invoices", { state: { selectedId: id } });
    } else if (label === "As Purchase Order") {
      const vendors = await repo.getAll("vendors");
      const number = await nextNumber("purchaseOrders");
      const id = await repo.add("purchaseOrders", { ...base, number: "#" + number, vendorId: vendors[0]?.id ?? 1, status: "Draft", billStatus: "Not Billed", amountPaid: 0, amountDue: base.total });
      showToast("Purchase order created", "success");
      navigate("/purchase/purchase-orders", { state: { selectedId: id } });
    }
  };
  const trashCurrent = async () => {
    const backendId = selectedDoc?._id || selected?.backendId;
    if (statusFilter === "Trash") {
      if (backendId) await hardDeleteEstimate(String(backendId));
    } else if (selectedDb?.id) {
      await repo.remove("estimates", selectedDb.id);
    } else if (backendId) {
      await deleteEstimate(String(backendId));
    }
    await queryClient.invalidateQueries({ queryKey: ["estimate-list"] });
    showToast(
      statusFilter === "Trash"
        ? `Estimate ${selectedDb.number} permanently deleted`
        : `Estimate ${selectedDb.number} moved to trash`,
      "success",
    );
    setSelectedId(filtered.find((item) => item.id !== selectedDb.id)?.id ?? 0);
    setConfirmAction(null);
  };
  const trashSelectedEst = async () => {
    const ids = [...checked];
    const backendIds = filtered.filter((item) => ids.includes(Number(item.id)) && item.backendId).map((item) => String(item.backendId));
    if (statusFilter === "Trash") {
      if (backendIds.length) await hardDeleteEstimates(backendIds);
    } else {
      await repo.removeMany("estimates", ids);
    }
    await queryClient.invalidateQueries({ queryKey: ["estimate-list"] });
    showToast(
      statusFilter === "Trash"
        ? `${ids.length} ${ids.length === 1 ? "estimate" : "estimates"} permanently deleted`
        : `${ids.length} ${ids.length === 1 ? "estimate" : "estimates"} moved to trash`,
      "success",
    );
    if (ids.includes(Number(selectedId))) setSelectedId(filtered.find((item) => !ids.includes(Number(item.id)))?.id ?? 0);
    setConfirmAction(null);
    exitSelect();
  };
  const restoreSelectedEst = async () => {
    const ids = [...checked];
    const backendIds = filtered.filter((item) => ids.includes(Number(item.id)) && item.backendId).map((item) => String(item.backendId));
    if (backendIds.length === 0) { showToast("Select estimates to restore", "warning"); return; }
    await restoreEstimates(backendIds);
    await queryClient.invalidateQueries({ queryKey: ["estimate-list"] });
    showToast(`${backendIds.length} ${backendIds.length === 1 ? "estimate" : "estimates"} restored`, "success");
    exitSelect();
  };
  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    const backendId = selectedDoc?._id || selected?.backendId || selectedDb?._id;
    let signaturePath = data.image;
    try {
      if (backendId && data.image.startsWith("data:")) {
        const formData = new FormData();
        formData.append("files", await dataUrlToFile(data.image, `estimate-signature-${backendId}.png`));
        const uploadRes = await api.raw.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
        signaturePath = uploadRes.data?.data?.file_path || uploadRes.data?.data?.path || data.image;
        await updateEstimate(String(backendId), { signature: signaturePath });
        await queryClient.invalidateQueries({ queryKey: ["estimate-detail", String(backendId)] });
      }
      if (selectedDb?.id) await repo.update("estimates", selectedDb.id, { signature: signaturePath, signatureName: data.name, signatureTitle: data.title, signatureDate: data.date });
      await logActivity("status", `Customer signature added to Estimate ${selectedDb.number}.`);
      showToast("Signature saved", "success");
    } catch {
      showToast("Could not save signature", "error");
    }
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

  const hasActiveFilters = !!search.trim() || customerFilter.length > 0 || dateFilter !== "All" || statusFilter !== "All";
  if (!selected && !createOpen && !hasActiveFilters) {
    return <ListEmptyState title="No estimates yet" onCreate={() => setCreateOpen(true)} createLabel="New Estimate" />;
  }

  const billing = addressLines(selectedDoc?.billing_address);
  const shipping = addressLines(selectedDoc?.shipping_address);
  const localBilling = [selectedCustomer.street1, selectedCustomer.street2, [selectedCustomer.city, selectedCustomer.zip].filter(Boolean).join(" "), selectedCustomer.country].filter(Boolean);
  const localShipping = [selectedCustomer.shipStreet1, selectedCustomer.shipStreet2, [selectedCustomer.shipCity, selectedCustomer.shipZip].filter(Boolean).join(" "), selectedCustomer.shipCountry].filter(Boolean);

  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Estimate" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              {statusFilter === "Trash" && (
                <button title="Restore" onClick={() => (checked.size === 0 ? showToast("Select estimates to restore", "warning") : restoreSelectedEst())} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
              )}
              <button title={statusFilter === "Trash" ? "Delete permanently" : "Delete"} onClick={() => (checked.size === 0 ? showToast("Select estimates to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp...", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Estimates</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Estimates")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("estimates"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("estimates"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}
        <div className="px-3 py-2 border-b border-gray-300"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search estimates..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" /></div></div>
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
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Estimate date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>{(close) => dateRanges.map((item) => <button key={item} onClick={() => { setDateFilter(item); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{item} {item === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>)}</Dropdown>
        </div>
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
            {filtered.map((row) => {
              const active = !selectMode && !createOpen && !editOpen && row.id === selectedId;
              const isChecked = checked.has(Number(row.id));
              return (
                <button key={String(row.id)} onClick={() => (selectMode ? toggleRow(Number(row.id)) : (setSelectedId(row.id), setCreateOpen(false), setEditOpen(false)))} className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                  {selectMode && <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>}
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-gray-900 truncate">{row.name}</div><div className="text-xs text-gray-500 mt-0.5">{row.number}</div><div className="text-xs text-gray-500 mt-0.5 truncate">{row.customerSubtitle || row.note}</div></div>
                  <div className="flex flex-col items-end flex-shrink-0"><span className="text-xs text-gray-500">{row.date}</span><span className="text-sm font-semibold text-gray-900 mt-0.5">{row.amount}</span><span className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeOf(row.status)}`}>{row.status}</span></div>
                </button>
              );
            })}
          </div>
        </div>
        <ListSidebarFooter
          total={fmtMoney(listTotal)}
          countLabel={`${listPagination?.totalData ?? filtered.length} Estimates`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {createOpen || (!selected && hasActiveFilters) ? (
        <CreateInvoiceForm mode="estimate" onClose={() => setCreateOpen(false)} onSaved={(id) => { setSortBy("Created On"); setSortDir("Descending"); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["estimate-list"] }); }} />
      ) : editOpen ? (
        <CreateInvoiceForm key={selectedDb.id || selected.backendId} mode="estimate" invoice={selectedDb} onClose={() => setEditOpen(false)} onSaved={(id) => { setEditOpen(false); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["estimate-list"] }); }} />
      ) : selectMode ? (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm"><div className="text-center"><h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} {checked.size === 1 ? "Estimate" : "Estimates"} Selected</h2><div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left"><span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{fmtMoney(selectedTotal)}</span></div></div></section>
      ) : (
        <section className="flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm">
          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="h-12 flex items-center justify-between gap-3 px-6 border-b border-gray-300 bg-gray-100">
              <DocPartyHeader
                party="customer"
                partyId={estimateCustomerId(selectedDoc) || partyIdFromRef((selectedCustomer as any)._id)}
                title={selected.name}
                subtitle={selected.customerSubtitle || customerDisplaySubtitle(selectedCustomer) || ""}
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {[{ icon: Settings, title: "Settings", onClick: () => setModal("settings") }, { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) }, { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") }, { icon: Pencil, title: "Edit", onClick: () => setEditOpen(true) }, { icon: PenTool, title: "Customer Signature", onClick: () => setSigOpen(true) }, { icon: Eye, title: "Preview", onClick: () => setModal("preview") }, { icon: Printer, title: "Print", onClick: () => { logActivity("printed", `Estimate ${selectedDb.number} printed.`); setModal("preview"); } }, { icon: Mail, title: "Email", onClick: () => setModal("email") }].map((item) => <button key={item.title} title={item.title} onClick={item.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><item.icon className="w-4 h-4" /></button>)}
                <Dropdown align="right" panelClass="min-w-[200px]" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <div className="py-1">
                      <button type="button" onClick={() => { showToast("Opening WhatsApp...", "info"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
                      <button type="button" onClick={() => { setModal("packing"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Packing Slip <Package className="w-4 h-4 text-gray-500" /></button>
                      <button type="button" onClick={() => { convertToInvoice(); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Convert to Invoice</button>
                      <MoreMenuFlyoutRow label="Mark As">
                        {markAsStatuses.map((item) => (
                          <button key={item} type="button" onClick={() => { markAs(item); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">{item}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <MoreMenuFlyoutRow label="Duplicate">
                        {duplicateAs.map((item) => (
                          <button key={item} type="button" onClick={() => { duplicateEstAs(item); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{item}</button>
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
            {expanded && <>
              <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-300">
                <div className="flex items-center gap-12"><div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.total ?? selectedDb.total))}</div></div><div><div className="text-xs text-gray-500">Estimate date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div></div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeOf(selectedDoc?.status || selected.status)}`}>{selectedDoc?.status || selected.status}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-5 py-4 border-b border-gray-300">
                <div><div className="text-xs text-gray-500 mb-1">Billing Address</div>{(billing.length ? billing : localBilling).length ? (billing.length ? billing : localBilling).map((line: string, index: number) => <div key={index} className={`text-sm ${index === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{line}</div>) : <div className="text-sm text-gray-400">—</div>}</div>
                <div><div className="text-xs text-gray-500 mb-1">Shipping Address</div>{(shipping.length ? shipping : localShipping).length ? (shipping.length ? shipping : localShipping).map((line: string, index: number) => <div key={index} className={`text-sm ${index === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{line}</div>) : <div className="text-sm text-gray-400">—</div>}</div>
              </div>
            </>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead><tr className="bg-gray-50 text-gray-500 text-xs"><th className="text-left font-semibold px-5 py-2.5">Sr. No.</th><th className="text-left font-semibold px-2 py-2.5">Items</th><th className="text-right font-semibold px-2 py-2.5">Quantity</th><th className="text-right font-semibold px-2 py-2.5">Rate</th><th className="text-left font-semibold px-2 py-2.5">Tax</th><th className="text-right font-semibold px-2 py-2.5">Discount</th><th className="text-right font-semibold px-5 py-2.5">Amount</th></tr></thead>
                <tbody>{lines.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>}{lines.map((item, index) => <tr key={item.id} className="border-b border-gray-300 align-top"><td className="px-5 py-3 text-gray-700">{index + 1}</td><td className="px-2 py-3"><div className="font-semibold text-gray-900">{item.name}</div>{item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}</td><td className="px-2 py-3 text-right text-gray-800">{item.qty || 1}</td><td className="px-2 py-3 text-right text-gray-800">{fmtMoney(item.rate)}</td><td className="px-2 py-3 text-gray-800">{item.tax ? `${item.tax}%` : EST_TAX_NAME[1]}</td><td className="px-2 py-3 text-right text-gray-500 text-xs">{item.discount ? `${item.discount}%` : "—"}</td><td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(item.amount || item.qty * item.rate)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              <div className="space-y-4"><div><label className="text-xs text-gray-500">Terms &amp; Conditions</label><div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.terms_and_conditions) || selectedDb.terms || "—"}</div></div><DocAttachmentField compact value={selectedDoc?.Attachment || selectedDb?.Attachment || selectedDb?.attachments || ""} onChange={async (path) => { const id = String(selectedDoc?._id || selected?.backendId || selectedDb?._id || ""); if (!id) { showToast("Save the document first", "error"); throw new Error("missing id"); } await updateEstimate(id, { Attachment: path }); await queryClient.invalidateQueries({ queryKey: ["estimate-detail", id] }); await queryClient.invalidateQueries({ queryKey: ["estimate-list"] }); if (selectedDb?.id) await repo.update("estimates", selectedDb.id, { Attachment: path }); showToast(path ? "Attachment saved" : "Attachment removed", "success"); }} /></div>
              <div><label className="text-xs text-gray-500">Notes</label><div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.notes) || selectedDb.notes || "—"}</div></div>
              <div className="border border-gray-200 rounded-md overflow-hidden self-start"><div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.sub_total ?? selectedDb.subTotal))}</span></div>{Object.entries(lines.reduce((acc: Record<number, number>, item) => { const taxRate = item.tax || 0; acc[taxRate] = (acc[taxRate] || 0) + item.amount; return acc; }, {})).map(([taxId, base]: [string, number]) => <div key={taxId} className="flex justify-between px-4 py-2 text-xs text-gray-500"><span>{EST_TAX_NAME[Number(taxId)] || "Tax"} {Number(taxId)}% on {fmtMoney(base)}</span><span>{fmtMoney((base * Number(taxId)) / 100)}</span></div>)}<div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.total ?? selectedDb.total))}</span></div></div>
            </div>
            <SignatureBlock record={{ ...selectedDb, signature: selectedDoc?.signature || selectedDb.signature }} label="Customer Signature" />
            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none"><div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 border py-1 text-center text-[10px] font-semibold ${badgeOf(selectedDoc?.status || selected.status)}`}>{selectedDoc?.status || selected.status}</div></div>
          </div>
        </section>
      )}

      {modal === "settings" && <AppSettingsModal initialTab="Estimate" onClose={() => setModal(null)} />}
      {modal === "preview" && !!selectedDb.id && (
        <PdfPreviewModal
          docType="estimate"
          recordId={selectedDb.id}
          backendId={String(selected?.backendId || selectedDb._id || "") || undefined}
          title="Estimate "
          onClose={() => setModal(null)}
        />
      )}
      {modal === "packing" && <PackingSlipModal onClose={() => setModal(null)} row={selected} />}
      {modal === "email" && <EmailModal onClose={() => setModal(null)} row={selected} />}
      {modal === "pdfSettings" && <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="estimate" />}
      {sigOpen && <SignatureModal heading="Customer Signature" defaultName={selectedCustomer.contact || selectedCustomer.name || ""} onDone={saveSignature} onClose={() => setSigOpen(false)} />}
      {sigRequestOpen && (
        <SignatureRequestModal
          docLabel="Estimate"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedCustomer}
          documentId={String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="estimate"
          emailNav="estimate"
          pdfDocType="estimate"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{
            status:
              selectedDoc?.status && selectedDoc.status !== "Draft"
                ? selectedDoc.status
                : "Sent",
          }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void logActivity("sent", `Signature request for Estimate ${selectedDb.number} sent.`);
            void queryClient.invalidateQueries({ queryKey: ["estimate-list"] });
            if (selected?.backendId) void queryClient.invalidateQueries({ queryKey: ["estimate-detail", String(selected.backendId)] });
          }}
        />
      )}
      {activityOpen && <ActivityLogModal docLabel="Estimate" record={selectedDb} onClose={() => setActivityOpen(false)} />}
      {confirmAction === "trashOne" && <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete this estimate? This cannot be undone." : "Are you sure want to trash this estimate?"} onNo={() => setConfirmAction(null)} onYes={trashCurrent} />}
      {confirmAction === "trashSelected" && <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete these estimates? This cannot be undone." : "Are you sure want to delete these estimates?"} onNo={() => setConfirmAction(null)} onYes={trashSelectedEst} />}
    </div>
  );
};

export default Estimates;
