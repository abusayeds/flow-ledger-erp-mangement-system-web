/**
 * Reusable Customer / Vendor detail modal.
 * Same Overview / Details / Settings layout as the Customers & Vendors pages.
 * Open from any sales/purchase document by clicking the party name / contact link.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  ChevronDown,
  DollarSign,
  FileText,
  MoreVertical,
  Pencil,
  Settings,
  X,
} from "lucide-react";
import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";
import { TabSlide } from "@/components/ui/TabSlide";
import { RecentActivities } from "@/components/ui/RecentActivities";
import { AppSettingsModal } from "@/components/modals/AppSettingsModal";
import { PartyStatementModal } from "@/components/modals/PartyStatementModal";
import { InvoicePaymentsModal } from "@/components/modals/InvoicePaymentsModal";
import { BillPaymentsModal } from "@/components/modals/BillPaymentsModal";
import { PartyEditForm, partyDocToForm, type PartyKind } from "@/components/parties/PartyEditForm";
import { useAppSettings, isCustomerFieldVisible, isVendorFieldVisible } from "@/lib/db/appSettings";
import { useCollection } from "@/lib/db";
import { showToast } from "@/utils/toast";
import { numericId } from "@/lib/db/sync";
import {
  fetchCustomer,
  updateCustomer,
  type CustomerFormData,
} from "@/services/customersApi";
import { fetchVendor, updateVendor } from "@/services/vendorsApi";
import { fetchPaymentMethods } from "@/services/paymentMethodsApi";
import { fetchVendorPayments } from "@/services/vendorPaymentsApi";

export type { PartyKind };

export const NO_CUSTOMER_AVAILABLE = "No customer available";
export const NO_VENDOR_AVAILABLE = "No vendor available";

export function partyIdFromRef(ref: unknown): string {
  if (!ref) return "";
  if (typeof ref === "string") return ref.trim();
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return String((ref as { _id?: unknown })._id || "").trim();
  }
  return "";
}

export function isMissingPartyName(name?: string | null): boolean {
  const n = (name || "").trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  return (
    lower === "—" ||
    lower === "-" ||
    lower === "no customer" ||
    lower === "no vendor" ||
    lower === NO_CUSTOMER_AVAILABLE.toLowerCase() ||
    lower === NO_VENDOR_AVAILABLE.toLowerCase()
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  party: PartyKind;
  /** Backend Mongo id. Empty / missing → empty state inside the modal. */
  partyId?: string | null;
};

const tabs = ["Overview", "Details", "Settings"] as const;
type Tab = (typeof tabs)[number];

const customerActivityFilters = ["All", "Created", "Updated", "Archived", "Draft", "Sent", "Invoiced"];
const vendorActivityFilters = ["All", "Created", "Updated", "Archived", "Bill", "Expense", "Payment"];

const chartData = [
  { name: "Jan '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Feb '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Mar '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Apr '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "May '26", Sales: 0, Overdue: 0, Paid: 0 },
  { name: "Jun '26", Sales: 0, Overdue: 0, Paid: 0 },
];

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${on ? "bg-blue-600" : "bg-gray-300"}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
  </button>
);

export const PartyDetailModal: React.FC<Props> = ({ open, onClose, party, partyId }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const customerSettings = useAppSettings("customer");
  const vendorSettings = useAppSettings("vendor");
  const showField = (key: string) =>
    party === "customer"
      ? isCustomerFieldVisible(customerSettings?.fieldVisibility, key)
      : isVendorFieldVisible(vendorSettings?.fieldVisibility, key);

  const id = (partyId || "").trim();
  const isCustomer = party === "customer";
  const emptyLabel = isCustomer ? NO_CUSTOMER_AVAILABLE : NO_VENDOR_AVAILABLE;

  const [tab, setTab] = useState<Tab>("Overview");
  const [tabDir, setTabDir] = useState<"" | "left" | "right">("");
  const [activityFilter, setActivityFilter] = useState("All");
  const [chartPeriod, setChartPeriod] = useState("Months");
  const [recordsType, setRecordsType] = useState<"Expenses" | "Bill" | "Payment Made">("Expenses");
  const [nested, setNested] = useState<null | "settings" | "payment" | "statement">(null);
  const [editMode, setEditMode] = useState(false);

  const dbCustomers = useCollection<any>("customers");
  const dbVendors = useCollection<any>("vendors");
  const dbBills = useCollection<any>("bills");
  const dbExpenses = useCollection<any>("expenses");

  useEffect(() => {
    if (!open) return;
    setTab("Overview");
    setActivityFilter("All");
    setNested(null);
    setEditMode(false);
  }, [open, id, party]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (nested) setNested(null);
      else if (editMode) setEditMode(false);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, nested, editMode, onClose]);

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ["party-detail-modal", party, id],
    queryFn: () => (isCustomer ? fetchCustomer(id) : fetchVendor(id)),
    enabled: open && !!id,
    staleTime: 30_000,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["party-detail-payment-methods"],
    queryFn: fetchPaymentMethods,
    enabled: open && nested === "payment",
    staleTime: 60_000,
  });

  const { data: venPayments = [] } = useQuery({
    queryKey: ["party-detail-vendor-payments", id],
    queryFn: async () => {
      const res = await fetchVendorPayments({ vendor_id: id, limit: 50 });
      return res.rows ?? [];
    },
    enabled: open && !!id && !isCustomer,
    staleTime: 30_000,
  });

  const displayName =
    doc?.businessProfile?.companyName?.trim() ||
    doc?.name?.trim() ||
    emptyLabel;

  const outstanding = typeof doc?.businessProfile?.opening_balance === "number"
    ? doc.businessProfile.opening_balance
    : 0;

  const localNumericId = useMemo(() => {
    if (!id) return undefined;
    if (isCustomer) {
      const local = dbCustomers.find((c) => String(c._id) === id);
      return (local?.id as number | undefined) ?? numericId(id);
    }
    const local = dbVendors.find((v) => String(v._id) === id);
    return (local?.id as number | undefined) ?? numericId(id);
  }, [dbCustomers, dbVendors, id, isCustomer]);

  const venBills = !isCustomer && localNumericId != null
    ? dbBills.filter((b) => b.vendorId === localNumericId)
    : [];
  const venExpenses = !isCustomer && localNumericId != null
    ? dbExpenses.filter((x) => x.vendorId === localNumericId)
    : [];
  const venPayable = venBills.reduce((s, b) => s + (b.amountDue || 0), 0);
  const venTotal = venBills.reduce((s, b) => s + (b.total || 0), 0);
  const venPaid = (venPayments as any[]).reduce((s, p) => s + (p.amount || 0), 0);

  const profile = doc?.businessProfile ?? {};
  const billing = profile.billing_address ?? {};
  const shipping = profile.shipping_address ?? {};
  const billingLines = [
    billing.address_line_1,
    showField("Street 2") ? billing.address_line_2 : null,
    [showField("City") ? billing.city : null, showField("Zip Code") ? billing.zip_code : null].filter(Boolean).join(" ") || null,
    showField("State") ? billing.state : null,
    showField("Country") ? billing.country : null,
  ].filter(Boolean) as string[];
  const shippingLines = [
    shipping.address_line_1,
    showField("Street 2") ? shipping.address_line_2 : null,
    [showField("City") ? shipping.city : null, showField("Zip Code") ? shipping.zip_code : null].filter(Boolean).join(" ") || null,
    showField("State") ? shipping.state : null,
    showField("Country") ? shipping.country : null,
  ].filter(Boolean) as string[];

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTabDir(tabs.indexOf(t) > tabs.indexOf(tab) ? "right" : "left");
    setTab(t);
  };

  const goEdit = () => {
    if (!id || !doc) return;
    setEditMode(true);
  };

  const openFullPage = () => {
    if (!id) return;
    onClose();
    navigate(isCustomer ? "/sales/customers" : "/purchase/vendors", { state: { selectedId: id } });
  };

  const toggleMut = useMutation({
    mutationFn: async (patch: Partial<CustomerFormData>) => {
      if (!doc || !id) return;
      const form = { ...partyDocToForm(doc), ...patch };
      return isCustomer ? updateCustomer(id, form) : updateVendor(id, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-detail-modal", party, id] });
      showToast("Saved", "success");
    },
    onError: () => showToast("Update failed", "error"),
  });

  if (!open) return null;

  const activityFilters = isCustomer ? customerActivityFilters : vendorActivityFilters;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
        onMouseDown={() => { if (!nested && !editMode) onClose(); }}
      >
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full max-w-4xl my-4 module-detail-panel custom-scrollbar shadow-xl border border-gray-300 rounded-lg overflow-hidden max-h-[min(92vh,900px)] flex flex-col"
        >
          {editMode && doc ? (
            <PartyEditForm
              party={party}
              doc={doc}
              embedded
              onClose={() => setEditMode(false)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["party-detail-modal", party, id] });
                setEditMode(false);
              }}
            />
          ) : (
            <>
          {/* Header */}
          <div className="module-title-bar flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-gray-900 tracking-tight truncate">
                {!id ? emptyLabel : isLoading ? "Loading…" : isError || !doc ? emptyLabel : displayName}
              </h1>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {id && doc && (
                <>
                  <button type="button" onClick={goEdit} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setNested("settings")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Settings">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setNested("payment")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Add Payment">
                    <DollarSign className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setNested("statement")} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Statement">
                    <FileText className="w-4 h-4" />
                  </button>
                  <Dropdown
                    align="right"
                    trigger={
                      <span className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer" title="More">
                        <MoreVertical className="w-4 h-4" />
                      </span>
                    }
                  >
                    {(close) => (
                      <button
                        type="button"
                        onClick={() => { openFullPage(); close(); }}
                        className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        Open full page
                      </button>
                    )}
                  </Dropdown>
                </>
              )}
              <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!id || isError || (!isLoading && !doc) ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <p className="text-sm text-gray-500">{emptyLabel}</p>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center p-10">
              <p className="text-sm text-gray-500">Loading…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-8 border-b border-gray-300 flex-shrink-0">
                {tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchTab(t)}
                    className={`py-3 text-sm transition-colors border-b-2 -mb-px ${tab === t ? "text-gray-900 font-medium border-blue-600" : "text-gray-500 border-transparent hover:text-gray-700"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <TabSlide tabKey={tab} dir={tabDir}>
                  {tab === "Overview" && isCustomer && (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: "Outstanding", value: money(outstanding < 0 ? Math.abs(outstanding) : outstanding > 0 ? outstanding : 0), color: "text-red-500" },
                          { label: "Net Profit", value: money(0), color: "text-gray-900" },
                          { label: "Sales", value: money(0), color: "text-gray-900" },
                        ].map((c) => (
                          <div key={c.label} className="text-center py-2">
                            <div className={`text-xs font-medium mb-1 ${c.label === "Outstanding" ? "text-red-500" : "text-gray-500"}`}>{c.label}</div>
                            <div className={`text-lg font-semibold ${c.color}`}>{c.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <span className="text-sm font-semibold text-gray-900">Sales</span>
                          <div className="flex items-center gap-4 flex-wrap">
                            {[{ c: "#007aff", l: "Sales" }, { c: "#ff3b30", l: "Overdue" }, { c: "#34a853", l: "Paid" }].map((x) => (
                              <span key={x.l} className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className="w-3 h-3 rounded-[3px]" style={{ background: x.c }} />
                                {x.l}
                              </span>
                            ))}
                            <Dropdown
                              align="right"
                              trigger={
                                <span className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                  {chartPeriod} <ChevronDown className="w-3.5 h-3.5" />
                                </span>
                              }
                            >
                              {(close) =>
                                ["Days", "Weeks", "Months", "Years"].map((o) => (
                                  <button
                                    key={o}
                                    type="button"
                                    onClick={() => { setChartPeriod(o); close(); }}
                                    className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                                  >
                                    {o}
                                  </button>
                                ))
                              }
                            </Dropdown>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-200)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: "var(--color-gray-500)", fontSize: 11 }} axisLine={{ stroke: "var(--color-gray-200)" }} tickLine={false} />
                            <YAxis tick={{ fill: "var(--color-gray-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              cursor={{ fill: "var(--color-gray-100)" }}
                              contentStyle={{ background: "var(--surface)", border: "1px solid var(--color-gray-200)", borderRadius: 8, color: "var(--color-gray-900)" }}
                            />
                            <Bar dataKey="Sales" fill="#007aff" barSize={36} radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Overdue" fill="#ff3b30" barSize={36} radius={[3, 3, 0, 0]} />
                            <Bar dataKey="Paid" fill="#34a853" barSize={36} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-medium text-gray-900">Recent Activities</h3>
                          <Dropdown
                            align="right"
                            trigger={
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                {activityFilter} <ChevronDown className="w-3.5 h-3.5" />
                              </span>
                            }
                          >
                            {(close) =>
                              activityFilters.map((o) => (
                                <button
                                  key={o}
                                  type="button"
                                  onClick={() => { setActivityFilter(o); close(); }}
                                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                                >
                                  {o} {o === activityFilter && <Check className="w-4 h-4 text-blue-600" />}
                                </button>
                              ))
                            }
                          </Dropdown>
                        </div>
                        <RecentActivities customerId={localNumericId} filter={activityFilter} />
                      </div>
                    </div>
                  )}

                  {tab === "Overview" && !isCustomer && (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-x divide-gray-200">
                        {[
                          { label: "Payable Amount", value: money(-venPayable), red: true },
                          { label: "Net Profit", value: money(venTotal - venPayable), red: false },
                          { label: "Bills", value: money(venTotal), red: false },
                          { label: "Payment Made", value: money(venPaid), red: false },
                        ].map((c) => (
                          <div key={c.label} className="text-center py-2">
                            <div className={`text-xs font-medium mb-1 ${c.red ? "text-red-500" : "text-gray-500"}`}>{c.label}</div>
                            <div className="text-lg font-semibold text-gray-900">{c.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg">
                        <div className="px-4 py-3">
                          <Dropdown
                            trigger={
                              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 cursor-pointer">
                                {recordsType} <ChevronDown className="w-4 h-4 text-gray-500" />
                              </span>
                            }
                          >
                            {(close) =>
                              (["Expenses", "Bill", "Payment Made"] as const).map((o) => (
                                <button
                                  key={o}
                                  type="button"
                                  onClick={() => { setRecordsType(o); close(); }}
                                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                                >
                                  {o} {o === recordsType && <Check className="w-4 h-4 text-blue-600" />}
                                </button>
                              ))
                            }
                          </Dropdown>
                        </div>
                        {(() => {
                          const rows =
                            recordsType === "Expenses"
                              ? venExpenses.map((x) => ({ id: `x${x.id}`, title: x.category || `Expense ${x.number}`, sub: x.date, right: money(x.amount || 0), status: "" }))
                              : recordsType === "Bill"
                                ? venBills.map((b) => ({ id: `b${b.id}`, title: `Bill ${b.number}`, sub: b.date, right: money(b.total || 0), status: b.status || "" }))
                                : (venPayments as any[]).map((p) => ({ id: `p${p._id}`, title: `Payment ${p.number}`, sub: p.dateLabel, right: money(p.amount || 0), status: p.method || "" }));
                          return rows.length === 0 ? (
                            <div className="px-4 pb-10 pt-6 text-center text-sm text-gray-400">No Records</div>
                          ) : (
                            <div>
                              {rows.map((r) => (
                                <div key={r.id} className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{r.sub}</div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-semibold text-gray-900">{r.right}</div>
                                    {r.status && <div className="text-xs text-gray-500 mt-0.5">{r.status}</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-medium text-gray-900">Recent Activities</h3>
                          <Dropdown
                            align="right"
                            trigger={
                              <span className="inline-flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                                {activityFilter} <ChevronDown className="w-3.5 h-3.5" />
                              </span>
                            }
                          >
                            {(close) =>
                              activityFilters.map((o) => (
                                <button
                                  key={o}
                                  type="button"
                                  onClick={() => { setActivityFilter(o); close(); }}
                                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                                >
                                  {o} {o === activityFilter && <Check className="w-4 h-4 text-blue-600" />}
                                </button>
                              ))
                            }
                          </Dropdown>
                        </div>
                        <RecentActivities vendorId={localNumericId} filter={activityFilter} />
                      </div>
                    </div>
                  )}

                  {tab === "Details" && (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {[
                          ["Company", profile.companyName || displayName],
                          showField("Reg. No") ? ["Reg. No", profile.registration_number || "—"] : null,
                          showField("GSTIN / VAT Number") ? ["GSTIN / VAT Number", profile.tax_number || "—"] : null,
                          showField("Business Phone") ? ["Business Phone", profile.business_phone || "—"] : null,
                          showField("Fax") ? ["Fax", profile.fax || "—"] : null,
                          showField("Email") ? ["Email", doc?.email || "—"] : null,
                          ["First Name", (doc?.name ?? "").split(" ")[0] || "—"],
                          showField("Last Name") ? ["Last Name", (doc?.name ?? "").split(" ").slice(1).join(" ") || "—"] : null,
                          showField("Mobile") ? ["Mobile Number", doc?.phone || "—"] : null,
                          showField("Home Phone") ? ["Home Phone", profile.home_phone || "—"] : null,
                          showField("Birthday") ? ["Birthday", profile.birthday ? String(profile.birthday).slice(0, 10) : "—"] : null,
                          showField("Anniversary") ? ["Anniversary", profile.anniversary ? String(profile.anniversary).slice(0, 10) : "—"] : null,
                        ].filter(Boolean).map((pair) => {
                          const [k, v] = pair as [string, string];
                          return (
                            <div key={k}>
                              <div className="text-xs text-gray-500">{k}</div>
                              <div className="text-sm font-semibold text-gray-900 mt-0.5 break-words">{v}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Billing Address</div>
                          <div className="text-sm text-gray-800 leading-relaxed">
                            {billingLines.length ? billingLines.map((l, i) => <div key={i}>{l}</div>) : "—"}
                          </div>
                        </div>
                        {showField("Entire Shipping Address") && (
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Shipping Address</div>
                            <div className="text-sm text-gray-800 leading-relaxed">
                              {shippingLines.length ? shippingLines.map((l, i) => <div key={i}>{l}</div>) : "—"}
                            </div>
                          </div>
                        )}
                      </div>
                      {showField("Bank Details") && (
                        <div className="pt-4 border-t border-gray-200">
                          <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
                          {profile.bank_details
                            ? <div className="text-sm text-gray-800 leading-relaxed [&_b]:font-bold" dangerouslySetInnerHTML={{ __html: profile.bank_details }} />
                            : <div className="text-sm text-gray-400">—</div>}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === "Settings" && (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                          showField("Currency") ? ["Currency", doc?.currency || "$ USD"] : null,
                          showField("Default Taxes (Services)") ? ["Default Taxes (Services)", typeof profile.default_tax_service_id === "object" ? (profile.default_tax_service_id as any)?.name ?? "None" : "None"] : null,
                          showField("Default Taxes (Product)") ? ["Default Taxes (Product)", typeof profile.default_tax_product_id === "object" ? (profile.default_tax_product_id as any)?.name ?? "None" : "None"] : null,
                          showField("Hourly Rate") ? ["Hourly Rate", profile.hourly_rate ? money(profile.hourly_rate) : "—"] : null,
                          showField("Payment Terms (Sales)")
                            ? ["Payment Terms (Sales)", profile.payment_terms || "Default Company"]
                            : null,
                          showField("Opening Balance") ? ["Opening Balance", profile.opening_balance ? money(profile.opening_balance) : "—"] : null,
                          showField("Opening Balance Date") ? ["Opening Balance Date", profile.opening_balance_date ? String(profile.opening_balance_date).slice(0, 10) : "—"] : null,
                        ].filter(Boolean).map((pair) => {
                          const [k, v] = pair as [string, string];
                          return (
                            <div key={k}>
                              <div className="text-xs text-gray-500">{k}</div>
                              <div className="text-sm font-semibold text-gray-900 mt-0.5">{v}</div>
                            </div>
                          );
                        })}
                      </div>
                      {showField("Notes") && profile.notes && (
                        <div className="pt-4 border-t border-gray-200">
                          <div className="text-xs text-gray-500 mb-1">Notes</div>
                          <div className="text-sm text-gray-800">{profile.notes}</div>
                        </div>
                      )}
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        {showField("Payment Reminder") && (
                          <div className="flex items-center justify-between max-w-sm">
                            <span className="text-sm text-gray-700">Payment Reminder</span>
                            <Toggle
                              on={profile.payment_reminder !== false}
                              onChange={() => toggleMut.mutate({ paymentReminder: !(profile.payment_reminder !== false) })}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between max-w-sm">
                          <span className="text-sm text-gray-700">Contact Login</span>
                          <Toggle
                            on={profile.is_login_required ?? false}
                            onChange={() => toggleMut.mutate({ isLoginRequired: !(profile.is_login_required ?? false) })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </TabSlide>
              </div>
            </>
          )}
            </>
          )}
        </div>
      </div>

      {nested === "settings" && (
        <AppSettingsModal initialTab={isCustomer ? "Customer" : "Vendor"} onClose={() => setNested(null)} />
      )}
      {nested === "payment" && id && isCustomer && (
        <InvoicePaymentsModal
          open
          invoice={null}
          customerId={id}
          customerName={displayName}
          paymentMethods={paymentMethods}
          onClose={() => setNested(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["party-detail-modal", party, id] });
          }}
        />
      )}
      {nested === "payment" && id && !isCustomer && (
        <BillPaymentsModal
          open
          bill={null}
          vendorId={id}
          vendorName={displayName}
          paymentMethods={paymentMethods}
          onClose={() => setNested(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["party-detail-modal", party, id] });
            qc.invalidateQueries({ queryKey: ["party-detail-vendor-payments", id] });
          }}
        />
      )}
      {nested === "statement" && (
        <PartyStatementModal
          party={party}
          onClose={() => setNested(null)}
          onExport={() => {
            setNested(null);
            showToast("Open the full Customers / Vendors page to export statements", "info");
          }}
        />
      )}
    </>
  );
};

export default PartyDetailModal;

/** Clickable company/contact header used on document detail panels. */
export const DocPartyHeader: React.FC<{
  party: PartyKind;
  partyId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  titleClassName?: string;
}> = ({
  party,
  partyId,
  title,
  subtitle,
  titleClassName = "text-base font-semibold text-gray-900 tracking-tight truncate",
}) => {
  const [open, setOpen] = useState(false);
  const id = (partyId || "").trim();
  const empty = party === "customer" ? NO_CUSTOMER_AVAILABLE : NO_VENDOR_AVAILABLE;
  const displayTitle = !id || isMissingPartyName(title) ? empty : String(title);

  return (
    <>
      <div className="min-w-0">
        {id ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${titleClassName} block max-w-full text-left hover:text-blue-700`}
          >
            {displayTitle}
          </button>
        ) : (
          <h1 className={titleClassName}>{displayTitle}</h1>
        )}
        {id ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            {subtitle?.trim() || "View Contact"}
          </button>
        ) : null}
      </div>
      <PartyDetailModal open={open} onClose={() => setOpen(false)} party={party} partyId={id || null} />
    </>
  );
};
