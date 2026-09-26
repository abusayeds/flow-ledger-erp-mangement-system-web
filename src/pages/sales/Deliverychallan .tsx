import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListEmptyState } from "@/components/ListEmptyState";
import { ListSidebarFooter, LIST_PAGE_SIZE } from "@/components/ui/ListSidebarFooter";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import { useCollection, repo, nextNumber, money as fmtMoney, CreateDocForm, PdfPreviewModal } from "@/lib/db";
import { PdfPrintSettingsModal } from "@/components/modals/PdfPrintSettingsModal";
import { SignatureModal } from "@/components/modals/SignatureModal";
import { SignatureBlock } from "@/components/ui/SignatureBlock";
import { SignatureRequestModal } from "@/components/modals/SignatureRequestModal";
import { ActivityLogModal } from "@/components/modals/ActivityLogModal";
import { ConfirmAlert } from "@/components/ui/ConfirmAlert";
import { showToast } from "@/utils/toast";
import { DocAttachmentField } from "@/components/ui/DocAttachmentField";
import { api } from "@/lib/api/client";
import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";
import { buildListSortParam } from "@/lib/listSort";
import { dateRangeFor } from "@/lib/listDateRange";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { MoreMenuFlyoutRow } from "@/components/ui/MoreMenuFlyoutRow";
import { deleteDeliveryChallan, hardDeleteDeliveryChallan, hardDeleteDeliveryChallans, restoreDeliveryChallans, fetchDeliveryChallan, fetchDeliveryChallans, updateDeliveryChallan, deliveryChallanCustomerId, type BackendDeliveryChallanDoc } from "@/services/deliveryChallansApi";
import { DocPartyHeader, partyIdFromRef } from "@/components/modals/PartyDetailModal";
import { Search, Plus, ChevronDown, ChevronRight, Check, Settings, SlidersHorizontal, Pencil, PenTool, Eye, Printer, Mail, MoreVertical, Trash2, MessageCircle, CircleChevronUp, CircleChevronDown, RotateCcw } from "lucide-react";
import { focusNavbarSearch, openListImport, openListExport } from "@/lib/listToolbarEvents";

/* ── Types & data ──────────────────────────────────────────────── */
type Status = "Draft" | "Open" | "Delivered" | "Cancelled";
type ChallanRow = {
  id: number | string;
  backendId: string;
  name: string;
  customerSubtitle: string;
  number: string;
  note: string;
  date: string;
  amount: string;
  status: string;
  currency: string;
};

const sortFields = ["Created On", "Name", "Delivery Challan date", "Delivery Challan #", "Status", "Total"];
const sortDirections: Array<"Ascending" | "Descending"> = ["Ascending", "Descending"];
const statusList = ["All", "Draft", "Open", "Delivered", "Cancelled", "Trash"];
const markAsStatuses = ["Open", "Draft", "Delivered", "Cancelled"];
const duplicateAs = ["As Invoice", "As Delivery Challan"];
const CH_TAX_NAME: Record<number, string> = { 1: "new test tax", 2: "Test Tax", 3: "VAT", 4: "GST" };
const nowLabel = () => "Today " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const dateRanges = ["All", "Today", "This Week", "This Month", "Last 30 Days", "This Year"];
const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-gray-600 text-white border-transparent",
  Open: "bg-blue-50 text-blue-700 border-blue-200",
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "");
const numberValue = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const badgeOf = (value: string) => STATUS_BADGE[value] || "bg-gray-600 text-white border-transparent";
const apiText = (value: unknown): string => text(value);
const customerDisplayName = (customer: any): string => apiText(customer?.businessProfile?.companyName) || apiText(customer?.company_name) || apiText(customer?.name) || "—";
const customerDisplaySubtitle = (customer: any): string => [apiText(customer?.name), apiText(customer?.email)].filter(Boolean).join(" · ");
const addressLines = (address?: BackendDeliveryChallanDoc["billing_address"]) => [address?.street, address?.street2, [address?.city, address?.state, address?.zip].filter(Boolean).join(", "), address?.country].filter(Boolean);
const challanSortToBackend = (value: string) => {
  switch (value) {
    case "Delivery Challan #":
      return "invoice_number";
    case "Name":
      return "customer_name";
    case "Status":
      return "status";
    case "Total":
      return "total";
    case "Delivery Challan date":
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

/* ── Modal shell ───────────────────────────────────────────────── */
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

/* ── DELIVERY CHALLAN preview (white document) ─────────────────── */
const EmailModal: React.FC<{ onClose: () => void; row: ChallanRow }> = ({ onClose, row }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-2xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
        <h3 className="text-base font-medium text-gray-900">Delivery Challan {row.number} from info</h3>
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
        <input defaultValue={`Delivery Challan ${row.number} from info`} className="w-full border-b border-gray-300 pb-2 text-sm outline-none bg-transparent text-gray-900" />
        <div className="text-sm text-gray-700 border-b border-gray-300 pb-2">From: info@inovoic.com</div>
        <div className="text-sm text-gray-800 space-y-2 min-h-[120px]">
          <p>Dear {row.name}</p>
          <p>Delivery Challan {row.number}<br />Total Amount: {row.amount}</p>
          <span className="inline-block px-4 py-2 bg-gray-100 rounded text-blue-600 font-semibold">Delivery Challan {row.number}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pt-1">
          <input type="checkbox" defaultChecked className="accent-blue-600" /> Powered by Moon Invoice
        </label>
      </div>
    </div>
  </Overlay>
);

export const DeliveryChallan: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as { selectedId?: number | string; openCreate?: boolean } | null) ?? null;
  const navSelectedId = navState?.selectedId;
  const [selectedId, setSelectedId] = useState<number | string>(navSelectedId ?? 0);
  useEffect(() => { if (navSelectedId != null) setSelectedId(navSelectedId); }, [navSelectedId]);
  const [sortBy, setSortBy] = useState("Created On");
  const [sortDir, setSortDir] = useState<"Ascending" | "Descending">("Descending");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "settings" | "preview" | "email" | "pdfSettings">(null);
  const [markAsOpen, setMarkAsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigRequestOpen, setSigRequestOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "trashOne" | "trashSelected">(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(!!navState?.openCreate);
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    if (navState?.openCreate) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [navState?.openCreate, location.pathname, navigate]);
  const dbChallans = useCollection<any>("deliveryChallans");
  const dbCustomers = useCollection<any>("customers", "name");
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [sortBy, sortDir, statusFilter, customerFilter, dateFilter]);
  const range = useMemo(() => dateRangeFor(dateFilter), [dateFilter]);
  const listQuery = useQuery({
    queryKey: ["delivery-challans", page, search, sortBy, sortDir, statusFilter, customerFilter, dateFilter],
    queryFn: async () => fetchDeliveryChallans({
      page,
      limit: LIST_PAGE_SIZE,
      searchTerm: search || undefined,
      sort: buildListSortParam(challanSortToBackend(sortBy), sortDir),
      status: statusFilter === "Trash" ? undefined : statusFilter,
      isDeleted: statusFilter === "Trash" || undefined,
      customer_id: partyFilterParam(customerFilter),
      dateField: "date",
      ...range,
    }),
    staleTime: 10_000,
  });
  const listPagination = listQuery.data?.pagination;
  const challans: ChallanRow[] = useMemo(
    () => (listQuery.data?.rows ?? []).map((row) => {
      const linkedLocal = dbChallans.find((item) => String(item._id) === row._id);
      return {
        id: linkedLocal?.id ?? row._id,
        backendId: row._id,
        name: row.customerName,
        customerSubtitle: row.customerSubtitle,
        number: row.number,
        note: linkedLocal?.notes || "No Notes",
        date: row.dateLabel,
        amount: fmtMoney(row.amount),
        status: row.status,
        currency: row.currency || "USD",
      };
    }),
    [dbChallans, listQuery.data?.rows],
  );
  useEffect(() => {
    if (challans.length === 0) return;
    const active = challans.find((item) => item.backendId === String(selectedId) || String(item.id) === String(selectedId));
    if (!active) setSelectedId(challans[0].backendId);
  }, [challans, selectedId]);
  const selected = challans.find((item) => item.backendId === String(selectedId) || String(item.id) === String(selectedId)) || challans[0];
  const selectedDb: any = dbChallans.find((item) => String(item._id) === selected?.backendId || String(item.id) === String(selectedId)) || {};
  const detailQuery = useQuery({
    queryKey: ["delivery-challan", selected?.backendId],
    queryFn: async () => (selected?.backendId ? fetchDeliveryChallan(selected.backendId) : null),
    enabled: !!selected?.backendId && !createOpen && !editOpen,
    staleTime: 10_000,
  });
  const selectedDoc = detailQuery.data;
  const selectedCustomer: any = selectedDb.customerId ? dbCustomers.find((c) => c.id === selectedDb.customerId) : null;

  /* Append an event to the challan's activity log. */
  const logActivity = async (kind: string, text: string) => {
    const rec = dbChallans.find((d) => d.id === selectedDb.id);
    await repo.update("deliveryChallans", selectedDb.id, { activity: [...(rec?.activity || []), { kind, text, ts: Date.now(), dateLabel: nowLabel() }] });
  };
  const markAs = async (status: string) => {
    if (selected?.backendId) {
      await updateDeliveryChallan(selected.backendId, { status });
      await queryClient.invalidateQueries({ queryKey: ["delivery-challans"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-challan", selected.backendId] });
    }
    if (selectedDb?.id) await repo.update("deliveryChallans", selectedDb.id, { status });
    await logActivity(status === "Open" ? "sent" : "status", `Delivery Challan ${selectedDb.number} mark as ${status.toLowerCase()}.`);
    showToast(`Delivery challan marked as ${status}`, "success");
  };
  const convertToInvoice = async () => {
    if (!selectedDb?.id) return;
    const n = await nextNumber("invoices");
    const id = await repo.add("invoices", {
      number: "#" + n, customerId: selectedDb.customerId, date: selectedDb.date, due: selectedDb.due || selectedDb.date,
      ts: Date.now(), status: "Draft", items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0,
      tax: selectedDb.tax || 0, shipping: 0, total: selectedDb.total || 0, amountPaid: 0,
      amountDue: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    });
    await repo.update("deliveryChallans", selectedDb.id, { invoiceNo: "#" + n, invoiceStatus: "Invoiced" });
    await logActivity("sent", `Delivery Challan ${selectedDb.number} converted to invoice.`);
    showToast("Converted to invoice", "success");
    navigate("/sales/sales-invoice", { state: { selectedId: id } });
  };
  const duplicateChAs = async (label: string) => {
    const base = {
      customerId: selectedDb.customerId, date: selectedDb.date, due: selectedDb.due, ts: Date.now(),
      items: selectedDb.items || [], subTotal: selectedDb.subTotal || 0, tax: selectedDb.tax || 0,
      total: selectedDb.total || 0, notes: selectedDb.notes || "", terms: selectedDb.terms || "",
    };
    if (label === "As Invoice") {
      const n = await nextNumber("invoices");
      const id = await repo.add("invoices", { ...base, number: "#" + n, status: "Draft", amountPaid: 0, amountDue: base.total });
      showToast("Invoice created", "success");
      navigate("/sales/sales-invoice", { state: { selectedId: id } });
    } else if (label === "As Delivery Challan") {
      const n = await nextNumber("deliveryChallans");
      const id = await repo.add("deliveryChallans", { ...base, number: "#" + n, status: "Draft", invoiceNo: "-", invoiceStatus: "Not Invoiced", amountPaid: 0, amountDue: base.total });
      setSelectedId(id);
      showToast("Delivery challan duplicated", "success");
    }
  };
  const trashCurrent = async () => {
    if (selected?.backendId) {
      if (statusFilter === "Trash") await hardDeleteDeliveryChallan(selected.backendId);
      else await deleteDeliveryChallan(selected.backendId);
    }
    showToast(
      statusFilter === "Trash"
        ? `Delivery Challan ${selectedDb.number} permanently deleted`
        : `Delivery Challan ${selectedDb.number} moved to trash`,
      "success",
    );
    await queryClient.invalidateQueries({ queryKey: ["delivery-challans"] });
    setSelectedId(challans.find((c) => c.backendId !== selected?.backendId)?.backendId ?? 0);
    setConfirmAction(null);
  };
  const trashSelectedCh = async () => {
    const ids = [...checked];
    if (statusFilter === "Trash") await hardDeleteDeliveryChallans(ids.map(String));
    else await Promise.all(ids.map((id) => deleteDeliveryChallan(id)));
    showToast(
      statusFilter === "Trash"
        ? `${ids.length} delivery ${ids.length === 1 ? "challan" : "challans"} permanently deleted`
        : `${ids.length} delivery ${ids.length === 1 ? "challan" : "challans"} moved to trash`,
      "success",
    );
    await queryClient.invalidateQueries({ queryKey: ["delivery-challans"] });
    if (selected?.backendId && ids.includes(selected.backendId)) setSelectedId(challans.find((c) => !ids.includes(c.backendId))?.backendId ?? 0);
    setConfirmAction(null);
    exitSelect();
  };
  const restoreSelectedCh = async () => {
    const ids = [...checked].map(String);
    if (ids.length === 0) { showToast("Select delivery challans to restore", "warning"); return; }
    await restoreDeliveryChallans(ids);
    await queryClient.invalidateQueries({ queryKey: ["delivery-challans"] });
    showToast(`${ids.length} delivery ${ids.length === 1 ? "challan" : "challans"} restored`, "success");
    exitSelect();
  };
  const saveSignature = async (data: { image: string; name: string; title: string; date: string }) => {
    let signatureValue = data.image;
    if (selected?.backendId) {
      const file = await dataUrlToFile(data.image, `delivery-challan-signature-${selected.backendId}.png`);
      const formData = new FormData();
      formData.append("file", file);
      const upload = await api.raw.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      signatureValue = text(upload.data?.data?.[0]?.path || upload.data?.data?.path || upload.data?.path) || data.image;
      await updateDeliveryChallan(selected.backendId, { signature: signatureValue });
      await queryClient.invalidateQueries({ queryKey: ["delivery-challan", selected.backendId] });
    }
    if (selectedDb?.id) await repo.update("deliveryChallans", selectedDb.id, { signature: signatureValue, signatureName: data.name, signatureTitle: data.title, signatureDate: data.date });
    await logActivity("status", `Customer signature added to Delivery Challan ${selectedDb.number}.`);
    showToast("Signature saved", "success");
  };

  const num = (s: string) => parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const filtered = challans;
  const listTotal = filtered.reduce((s, i) => s + num(i.amount), 0);
  const allSelected = filtered.length > 0 && filtered.every((i) => checked.has(i.backendId));
  const selectedTotal = challans.filter((i) => checked.has(i.backendId)).reduce((s, i) => s + num(i.amount), 0);
  const exitSelect = () => { setSelectMode(false); setChecked(new Set()); };
  const toggleRow = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => (allSelected ? exitSelect() : setChecked(new Set(filtered.map((i) => i.backendId))));
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && selectMode && exitSelect();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [selectMode]);

  const actionIcons: { icon: React.ElementType; title: string; onClick?: () => void }[] = [
    { icon: Settings, title: "Settings", onClick: () => setModal("settings") },
    { icon: expanded ? CircleChevronUp : CircleChevronDown, title: expanded ? "Collapse" : "Expand", onClick: () => setExpanded((v) => !v) },
    { icon: SlidersHorizontal, title: "PDF & Print Settings", onClick: () => setModal("pdfSettings") },
    { icon: Pencil, title: "Edit", onClick: () => setEditOpen(true) },
    { icon: PenTool, title: "Customer Signature", onClick: () => setSigOpen(true) },
    { icon: Eye, title: "Preview", onClick: () => setModal("preview") },
    { icon: Printer, title: "Print", onClick: () => { logActivity("printed", `Delivery Challan ${selectedDb.number} printed.`); setModal("preview"); } },
    { icon: Mail, title: "Email", onClick: () => setModal("email") },
  ];

  if (!selected && !createOpen && !search && statusFilter === "All" && !customerFilter.length) return <ListEmptyState title="No delivery challans yet" onCreate={() => setCreateOpen(true)} createLabel="New Delivery Challan" />;

  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      {/* ════════ LIST PANEL ════════ */}
      <ResizableListPanel onCreate={() => setCreateOpen(true)} createTitle="Create Delivery Challan" hideCreate={selectMode}>
        {selectMode ? (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300">
            <button onClick={toggleAll} className={`w-5 h-5 rounded-[5px] border flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{allSelected && <Check className="w-3.5 h-3.5 text-white" />}</button>
            <div className="flex items-center gap-0.5">
              {statusFilter === "Trash" && (
                <button title="Restore" onClick={() => (checked.size === 0 ? showToast("Select delivery challans to restore", "warning") : restoreSelectedCh())} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><RotateCcw className="w-4 h-4" /></button>
              )}
              <button title={statusFilter === "Trash" ? "Delete permanently" : "Delete"} onClick={() => (checked.size === 0 ? showToast("Select delivery challans to delete", "warning") : setConfirmAction("trashSelected"))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Trash2 className="w-4 h-4" /></button>
              <button title="WhatsApp" onClick={() => showToast("Opening WhatsApp…", "info")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><MessageCircle className="w-4 h-4" /></button>
              <button title="Email" onClick={() => setModal("email")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Mail className="w-4 h-4" /></button>
              <button title="Preview" onClick={() => setModal("preview")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Eye className="w-4 h-4" /></button>
              <button title="Done" onClick={exitSelect} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><Check className="w-4 h-4" /></button>
            </div>
          </div>
        ) : (
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Delivery Challans</h2>
            <div className="flex items-center gap-0.5">
              <button type="button" title="Search" onClick={() => focusNavbarSearch("Delivery Challans")} className="p-1.5 hover:bg-gray-100 rounded-md"><Search className="w-4 h-4 text-gray-500" /></button>
              <button onClick={() => setSelectMode(true)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Select"><Pencil className="w-4 h-4 text-gray-500" /></button>
              <Dropdown align="right" trigger={<span className="p-1.5 hover:bg-gray-100 rounded-md inline-flex cursor-pointer"><MoreVertical className="w-4 h-4 text-gray-500" /></span>}>{(close) => (<><button onClick={() => { openListImport("delivery-challans"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Import</button><button onClick={() => { openListExport("delivery-challans"); close(); }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Export</button></>)}</Dropdown>
            </div>
          </div>
        )}

        {/* search */}
        <div className="px-3 py-2 border-b border-gray-300">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search delivery challans..." className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600" />
          </div>
        </div>

        {/* toolbar */}
        <div className="list-filter-toolbar hover-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 border-b border-gray-300">
          <Dropdown trigger={<span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap">Sort by | <span className="text-gray-800 font-medium">{sortBy}</span><ChevronDown className="w-3.5 h-3.5" /></span>}>
            {(close) => (
              <>
                {sortFields.map((o) => (
                  <button key={o} onClick={() => { setSortBy(o); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{o} {o === sortBy && <Check className="w-4 h-4 text-blue-600" />}</button>
                ))}
                <div className="border-t border-gray-200 my-1" />
                {sortDirections.map((d) => (
                  <button key={d} onClick={() => { setSortDir(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === sortDir && <Check className="w-4 h-4 text-blue-600" />}</button>
                ))}
              </>
            )}
          </Dropdown>
          <Dropdown trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Status{statusFilter !== "All" ? ` | ${statusFilter}` : ""}</span>}>
            {(close) => statusList.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); close(); }} className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-gray-50 ${s === "Trash" ? "text-red-500 border-t border-gray-200" : "text-gray-700"}`}>{s} {s === statusFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
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
          <Dropdown align="right" trigger={<span className="inline-flex items-center gap-1 text-xs text-gray-600 border border-dashed border-gray-300 rounded-full px-2.5 py-1 whitespace-nowrap hover:border-gray-400"><Plus className="w-3 h-3" />Delivery Challan date | {dateFilter}<ChevronDown className="w-3 h-3" /></span>}>
            {(close) => dateRanges.map((d) => (
              <button key={d} onClick={() => { setDateFilter(d); close(); }} className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">{d} {d === dateFilter && <Check className="w-4 h-4 text-blue-600" />}</button>
            ))}
          </Dropdown>
        </div>

        {/* rows */}
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto hover-scrollbar">
          {filtered.map((p) => {
            const active = !selectMode && !createOpen && !editOpen && p.backendId === selected?.backendId;
            const isChecked = checked.has(p.backendId);
            return (
              <button key={p.backendId} onClick={() => (selectMode ? toggleRow(p.backendId) : (setSelectedId(p.backendId), setCreateOpen(false), setEditOpen(false)))}
                className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-start gap-3 transition-colors ${active || (selectMode && isChecked) ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                {selectMode && (
                  <span className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-[5px] border flex items-center justify-center ${isChecked ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>{isChecked && <Check className="w-3.5 h-3.5 text-white" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.number}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{p.note}</div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-xs text-gray-500">{p.date}</span>
                  <span className="text-sm font-semibold text-gray-900 mt-0.5">{p.amount}</span>
                  <span className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeOf(p.status)}`}>{p.status}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* footer */}
        <ListSidebarFooter
          total={money(listTotal)}
          countLabel={`${listPagination?.totalData ?? filtered.length} Delivery Challans`}
          pagination={listPagination}
          page={page}
          onPageChange={setPage}
        />
      </ResizableListPanel>

      {/* ════════ RIGHT PANEL ════════ */}
      {createOpen || (!selected && (search || statusFilter !== "All" || customerFilter.length > 0)) ? (
        <CreateDocForm collection="deliveryChallans" title="New Delivery Challan" party="customers" onClose={() => setCreateOpen(false)} onSaved={(id) => { setSortBy("Created On"); setSortDir("Descending"); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["delivery-challans"] }); }} />
      ) : editOpen ? (
        <CreateDocForm key={selectedId} collection="deliveryChallans" title="Edit Delivery Challan" party="customers" record={selectedDb} onClose={() => setEditOpen(false)} onSaved={(id) => { setEditOpen(false); setSelectedId(id); void queryClient.invalidateQueries({ queryKey: ["delivery-challans"] }); }} />
      ) : selectMode ? (
        <section className="flex-1 flex items-center justify-center m-2 bg-white border border-gray-300 shadow-sm">
          <div className="text-center">
            <h2 className="text-2xl font-normal text-gray-900 mb-8">{checked.size} Delivery {checked.size === 1 ? "Challan" : "Challans"} Selected</h2>
            <div className="inline-grid grid-cols-[auto_auto] gap-x-10 gap-y-3 text-left">
              <span className="text-gray-500">Total</span><span className="font-semibold text-gray-900">{money(selectedTotal)}</span>
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
                  partyId={deliveryChallanCustomerId(selectedDoc) || partyIdFromRef((selectedCustomer as any)?._id)}
                  title={selected.name}
                  subtitle={selected.customerSubtitle || customerDisplaySubtitle(selectedCustomer) || ""}
                />
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {actionIcons.map((a) => (
                  <button key={a.title} title={a.title} onClick={a.onClick} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600"><a.icon className="w-4 h-4" /></button>
                ))}
                {/* ⋮ menu (reference: WhatsApp / Convert to Invoice / Mark As ▸ / Duplicate ▸ / Signature Request / Activity Log / Trash) */}
                <Dropdown align="right" panelClass="min-w-[200px]" trigger={<span title="More" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 cursor-pointer"><MoreVertical className="w-4 h-4" /></span>}>
                  {(close) => (
                    <div className="py-1">
                      <button type="button" onClick={() => { showToast("Opening WhatsApp…", "info"); close(); }} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">WhatsApp <MessageCircle className="w-4 h-4 text-gray-500" /></button>
                      <button type="button" onClick={() => { convertToInvoice(); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">Convert to Invoice</button>
                      <MoreMenuFlyoutRow label="Mark As">
                        {markAsStatuses.map((st) => (
                          <button key={st} type="button" onClick={() => { markAs(st); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">{st}</button>
                        ))}
                      </MoreMenuFlyoutRow>
                      <MoreMenuFlyoutRow label="Duplicate">
                        {duplicateAs.map((st) => (
                          <button key={st} type="button" onClick={() => { duplicateChAs(st); close(); }} className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left whitespace-nowrap">{st}</button>
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

            {/* Expandable info panel (chevron toggle) */}
            {expanded && (
            <>
            {/* meta row — #, date, Invoice #, Invoice Status, status badge */}
            <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-300">
              <div className="flex items-center gap-10">
                <div><div className="text-xs text-gray-500">{selected.number}</div><div className="text-sm font-semibold text-gray-900">{selected.amount}</div></div>
                <div><div className="text-xs text-gray-500">Delivery Challan date</div><div className="text-sm font-semibold text-gray-900">{selected.date}</div></div>
                <div><div className="text-xs text-gray-500">Invoice #</div><div className="text-sm font-semibold text-gray-900">{apiText(selectedDoc?.invoice_number) || "—"}</div></div>
                <div><div className="text-xs text-gray-500">Currency</div><div className="text-sm font-semibold text-gray-900">{selected.currency}</div></div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeOf(selected.status)}`}>{selected.status}</span>
            </div>

            {/* billing address + sub title (live from the customer / record) */}
            <div className="px-5 py-4 border-b border-gray-300 space-y-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Billing Address</div>
                {addressLines(selectedDoc?.billing_address).length
                  ? addressLines(selectedDoc?.billing_address).map((l, i) => (
                      <div key={i} className={`text-sm ${i === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{l}</div>
                    ))
                  : <div className="text-sm text-gray-400">—</div>}
              </div>
              <div>
                <div className="text-xs text-gray-500">Sub Title</div>
                <div className="text-sm font-semibold text-gray-900">{apiText(selectedDoc?.sub_title) || selectedDb.subTitle || "—"}</div>
              </div>
            </div>
            </>
            )}

            {/* line items */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-left font-semibold px-5 py-2.5">Sr. No.</th>
                    <th className="text-left font-semibold px-2 py-2.5">Items</th>
                    <th className="text-right font-semibold px-2 py-2.5">Quantity</th>
                    <th className="text-right font-semibold px-2 py-2.5">Rate</th>
                    <th className="text-left font-semibold px-2 py-2.5">Tax</th>
                    <th className="text-right font-semibold px-2 py-2.5">Discount</th>
                    <th className="text-right font-semibold px-5 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(((selectedDoc?.product ?? []) as any[]).length === 0) && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-400">No items</td></tr>
                  )}
                  {((selectedDoc?.product ?? []) as any[]).map((it: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-300 align-top">
                      <td className="px-5 py-3 text-gray-700">{idx + 1}</td>
                      <td className="px-2 py-3"><div className="font-semibold text-gray-900">{apiText(it.product_name) || apiText(it.service_name) || "Item"}</div>{it.description && <div className="text-xs text-gray-500 mt-0.5">{it.description}</div>}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{numberValue(it.quantity) || 1}</td>
                      <td className="px-2 py-3 text-right text-gray-800">{fmtMoney(numberValue(it.rate))}</td>
                      <td className="px-2 py-3 text-gray-800">{CH_TAX_NAME[numberValue(it.tax) || 1]}</td>
                      <td className="px-2 py-3 text-right text-gray-500 text-xs">{numberValue(it.discount) ? `${numberValue(it.discount)}%` : "—"}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtMoney(numberValue(it.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* terms + notes + attachment + totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 px-5 py-5">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">Terms &amp; Conditions</label>
                  <div className="mt-1 min-h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.terms_and_conditions) || selectedDb.terms || "—"}</div>
                </div>
                <div>
                  <DocAttachmentField
                    compact
                    value={selectedDoc?.Attachment || selectedDb?.Attachment || selectedDb?.attachments || ""}
                    onChange={async (path) => {
                      const id = String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "");
                      if (!id) {
                        showToast("Save the document first", "error");
                        throw new Error("missing id");
                      }
                      await updateDeliveryChallan(id, { Attachment: path });
                      await queryClient.invalidateQueries({ queryKey: ["delivery-challan", id] });
                      await queryClient.invalidateQueries({ queryKey: ["delivery-challans"] });
                      if (selectedDb?.id) await repo.update("deliveryChallans", selectedDb.id, { Attachment: path });
                      showToast(path ? "Attachment saved" : "Attachment removed", "success");
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Notes</label>
                <div className="mt-1 h-24 border border-gray-200 rounded-md p-3 text-sm text-gray-700">{apiText(selectedDoc?.notes) || selected.note}</div>
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden self-start">
                <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-gray-700">Sub Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.sub_total ?? selectedDb.subTotal))}</span></div>
                <div className="flex justify-between px-4 py-3 bg-gray-100 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-semibold text-gray-900">{fmtMoney(numberValue(selectedDoc?.total ?? selectedDb.total))}</span></div>
              </div>
            </div>

            {/* saved signature (shows after Add Signature) */}
            <SignatureBlock record={{ ...selectedDb, signature: selectedDoc?.signature || selectedDb.signature }} label="Customer Signature" />

            {/* status corner ribbon */}
            <div className="absolute bottom-0 left-0 w-24 h-24 overflow-hidden pointer-events-none">
              <div className={`absolute bottom-[18px] -left-[34px] w-32 rotate-45 border text-[10px] font-semibold py-1 text-center ${badgeOf(selected.status)}`}>{selected.status}</div>
            </div>
          </div>
        </section>
      )}

      {/* ════════ MODALS ════════ */}
      {modal === "settings" && <AppSettingsModal initialTab="Delivery Challan" onClose={() => setModal(null)} />}
      {modal === "preview" && (() => {
        const d: any =
          dbChallans.find(
            (x) => String(x._id) === selected?.backendId || String(x.id) === String(selectedId),
          ) || {};
        return (
          <PdfPreviewModal
            docType="deliveryChallan"
            recordId={d.id}
            backendId={String(selected?.backendId || d._id || "") || undefined}
            title={`Delivery Challan `}
            onClose={() => setModal(null)}
          />
        );
      })()}
      {modal === "email" && selected && <EmailModal onClose={() => setModal(null)} row={selected} />}
      {modal === "pdfSettings" && (
        <PdfPrintSettingsModal onClose={() => setModal(null)} initialDocType="deliveryChallan" />
      )}
      {sigOpen && (
        <SignatureModal
          heading="Customer Signature"
          defaultName={selectedCustomer?.contact || selectedCustomer?.name || customerDisplayName(selectedDoc?.customer_id) || ""}
          onDone={saveSignature}
          onClose={() => setSigOpen(false)}
        />
      )}
      {sigRequestOpen && (
        <SignatureRequestModal
          docLabel="Delivery Challan"
          number={selectedDb.number || selected?.number || ""}
          customer={selectedCustomer || selectedDoc?.customer_id}
          documentId={String(selectedDoc?._id || selected?.backendId || selectedDb?._id || "") || undefined}
          emailType="delivery_challan"
          emailNav="delivery_challan"
          pdfDocType="deliveryChallan"
          recordId={typeof selectedDb?.id === "number" ? selectedDb.id : undefined}
          documentUpdate={{
            status:
              selectedDoc?.status && selectedDoc.status !== "Draft"
                ? selectedDoc.status
                : "Open",
          }}
          onClose={() => setSigRequestOpen(false)}
          onSend={() => {
            void logActivity("sent", `Signature request for Delivery Challan ${selectedDb.number} sent.`);
            void queryClient.invalidateQueries({ queryKey: ["delivery-challans"] });
            if (selected?.backendId) void queryClient.invalidateQueries({ queryKey: ["delivery-challan", selected.backendId] });
          }}
        />
      )}
      {activityOpen && <ActivityLogModal docLabel="Delivery Challan" record={selectedDb} onClose={() => setActivityOpen(false)} />}
      {confirmAction === "trashOne" && (
        <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete this delivery challan? This cannot be undone." : "Are you sure want to trash this delivery challan?"} onNo={() => setConfirmAction(null)} onYes={trashCurrent} />
      )}
      {confirmAction === "trashSelected" && (
        <ConfirmAlert message={statusFilter === "Trash" ? "Permanently delete these delivery challans? This cannot be undone." : "Are you sure want to delete these delivery challans?"} onNo={() => setConfirmAction(null)} onYes={trashSelectedCh} />
      )}
      
    </div>
  );
};

export default DeliveryChallan;
