/**
 * Shared Customer / Vendor create+edit form (Details + Settings tabs).
 * Reused by PartyDetailModal and can replace page-local forms later.
 */

import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bold, ChevronDown, Italic, Underline, X } from "lucide-react";
import { AppDatePicker } from "@/components/ui/AppDatePicker";
import { TabSlide } from "@/components/ui/TabSlide";
import { useAppSettings, isCustomerFieldVisible, isVendorFieldVisible } from "@/lib/db/appSettings";
import { showToast } from "@/utils/toast";
import {
  createCustomer,
  updateCustomer,
  backendToRow,
  type CustomerFormData,
} from "@/services/customersApi";
import { createVendor, updateVendor } from "@/services/vendorsApi";
import type { TBackendParty } from "@/services/customerTypes";

export type PartyKind = "customer" | "vendor";

const PAYMENT_TERMS = ["Default Company", "Net on receipt", "Net 7", "Net 10", "Net 15", "Net 30", "Net 60"];
const CURRENCIES = ["$ USD", "৳ BDT", "€ EUR", "£ GBP", "₹ INR"];

const fieldCls =
  "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600";

export function partyDocToForm(doc: TBackendParty): CustomerFormData {
  const p = doc.businessProfile ?? {};
  const billing = p.billing_address ?? {};
  const shipping = p.shipping_address ?? {};
  const [firstName = "", ...lastParts] = (doc.name ?? "").split(" ");
  return {
    name: p.companyName ?? "",
    firstName,
    lastName: lastParts.join(" "),
    email: doc.email ?? "",
    phone: p.business_phone ?? "",
    mobile: doc.phone ?? "",
    fax: p.fax ?? "",
    homePhone: p.home_phone ?? "",
    regNo: p.registration_number ?? "",
    taxId: p.tax_number ?? "",
    birthday: p.birthday ? String(p.birthday).slice(0, 10) : "",
    anniversary: p.anniversary ? String(p.anniversary).slice(0, 10) : "",
    bank: p.bank_details ?? "",
    street1: billing.address_line_1 ?? "",
    street2: billing.address_line_2 ?? "",
    zip: billing.zip_code ?? "",
    city: billing.city ?? "",
    state: billing.state ?? "",
    country: billing.country ?? "",
    sameAsBilling: p.same_as_billing ?? false,
    shipStreet1: shipping.address_line_1 ?? "",
    shipStreet2: shipping.address_line_2 ?? "",
    shipZip: shipping.zip_code ?? "",
    shipCity: shipping.city ?? "",
    shipState: shipping.state ?? "",
    shipCountry: shipping.country ?? "",
    currency: doc.currency ?? "$ USD",
    defaultTaxService:
      typeof p.default_tax_service_id === "object"
        ? `${(p.default_tax_service_id as any).name ?? ""} (${(p.default_tax_service_id as any).rate ?? ""}%)`
        : "None",
    defaultTaxProduct:
      typeof p.default_tax_product_id === "object"
        ? `${(p.default_tax_product_id as any).name ?? ""} (${(p.default_tax_product_id as any).rate ?? ""}%)`
        : "None",
    hourlyRate: p.hourly_rate != null ? String(p.hourly_rate) : "",
    paymentTerms: p.payment_terms ?? "Default Company",
    openingBalance: p.opening_balance != null ? String(p.opening_balance) : "",
    openingBalanceDate: p.opening_balance_date ? String(p.opening_balance_date).slice(0, 10) : "",
    notes: p.notes ?? "",
    paymentReminder: p.payment_reminder !== false,
    isLoginRequired: p.is_login_required ?? false,
  };
}

function emptyForm(): CustomerFormData {
  return {
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    homePhone: "",
    regNo: "",
    taxId: "",
    birthday: "",
    anniversary: "",
    bank: "",
    street1: "",
    street2: "",
    zip: "",
    city: "",
    state: "",
    country: "",
    sameAsBilling: false,
    shipStreet1: "",
    shipStreet2: "",
    shipZip: "",
    shipCity: "",
    shipState: "",
    shipCountry: "",
    currency: "$ USD",
    defaultTaxService: "None",
    defaultTaxProduct: "None",
    hourlyRate: "",
    paymentTerms: "Default Company",
    openingBalance: "",
    openingBalanceDate: "",
    notes: "",
    paymentReminder: true,
    isLoginRequired: false,
  };
}

const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`w-9 h-5 rounded-full transition-colors relative ${on ? "bg-blue-600" : "bg-gray-300"}`}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
  </button>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, type = "text", disabled }) =>
  type === "date" ? (
    <AppDatePicker floatingLabel={label} value={value} onValueChange={onChange} disabled={disabled} placeholder={placeholder} />
  ) : (
    <div className={`relative fl-wrap ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      <label className="fl-label">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder && placeholder !== label ? placeholder : " "}
        className={`${fieldCls} ${disabled ? "bg-gray-50 text-gray-400" : ""}`}
      />
    </div>
  );

const SelectField: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="relative fl-wrap">
    <label className="fl-label">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldCls} appearance-none pr-8`}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
  </div>
);

const RichTextEditor: React.FC<{ value: string; onChange: (html: string) => void; placeholder?: string }> = ({
  value,
  onChange,
  placeholder,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState("#000000");
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML || "");
  };
  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-300 bg-gray-50">
        {([["bold", Bold], ["italic", Italic], ["underline", Underline]] as const).map(([cmd, Ic]) => (
          <button
            key={cmd}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"
          >
            <Ic className="w-4 h-4" />
          </button>
        ))}
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <label className="relative w-6 h-6 rounded border border-gray-300 cursor-pointer" style={{ background: color }}>
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              exec("foreColor", e.target.value);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <select
          defaultValue="3"
          onChange={(e) => exec("fontSize", e.target.value)}
          className="ml-1 text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
        >
          {[["1", "12"], ["2", "14"], ["3", "16"], ["4", "18"], ["5", "20"], ["6", "24"]].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML || "")}
        data-placeholder={placeholder}
        className="w-full min-h-28 p-3 text-sm text-gray-800 outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400"
      />
    </div>
  );
};

type Props = {
  party: PartyKind;
  doc: TBackendParty | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  /** When true, omit outer page margins (for use inside PartyDetailModal). */
  embedded?: boolean;
};

export const PartyEditForm: React.FC<Props> = ({ party, doc, onClose, onSaved, embedded }) => {
  const qc = useQueryClient();
  const isCreate = doc === null;
  const isCustomer = party === "customer";
  const settings = useAppSettings(isCustomer ? "customer" : "vendor");
  const show = (key: string) =>
    isCustomer
      ? isCustomerFieldVisible(settings?.fieldVisibility, key)
      : isVendorFieldVisible(settings?.fieldVisibility, key);

  const [tab, setTab] = useState<"Details" | "Settings">("Details");
  const [tabDir, setTabDir] = useState<"" | "left" | "right">("");
  const switchTab = (t: "Details" | "Settings") => {
    if (t === tab) return;
    setTabDir(t === "Settings" ? "right" : "left");
    setTab(t);
  };

  const [f, setF] = useState<CustomerFormData>(() => (doc ? partyDocToForm(doc) : emptyForm()));
  const [sameAsBilling, setSameAsBilling] = useState(!!f.sameAsBilling);
  const [emailEditing, setEmailEditing] = useState(!f.email);
  const [taxpayerType, setTaxpayerType] = useState("Regular");
  const set = (k: keyof CustomerFormData, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!doc) return;
    const next = partyDocToForm(doc);
    setF(next);
    setSameAsBilling(!!next.sameAsBilling);
    setEmailEditing(!next.email);
  }, [doc?._id]);

  const createMut = useMutation({
    mutationFn: (data: CustomerFormData) => (isCustomer ? createCustomer(data) : createVendor(data)),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: isCustomer ? ["customers"] : ["vendors-backend-list"] });
      showToast(isCustomer ? "Customer created" : "Vendor created", "success");
      onSaved(String(created._id));
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? "Save failed", "error"),
  });

  const updateMut = useMutation({
    mutationFn: (data: CustomerFormData) =>
      isCustomer ? updateCustomer(doc!._id, data) : updateVendor(doc!._id, data),
    onSuccess: (updated) => {
      const bid = String(updated._id ?? doc!._id);
      qc.invalidateQueries({ queryKey: isCustomer ? ["customers"] : ["vendors-backend-list"] });
      qc.invalidateQueries({ queryKey: isCustomer ? ["customer", bid] : ["vendor", bid] });
      qc.invalidateQueries({ queryKey: ["party-detail-modal", party, bid] });
      showToast(isCustomer ? "Customer updated" : "Vendor updated", "success");
      if (isCustomer) backendToRow(updated);
      onSaved(bid);
      onClose();
    },
    onError: (err: any) => showToast(err?.message ?? "Update failed", "error"),
  });

  const isBusy = createMut.isPending || updateMut.isPending;

  const save = () => {
    const name = f.name.trim() || `${f.firstName} ${f.lastName}`.trim();
    if (!name) {
      showToast(isCustomer ? "Company name is required" : "Enter a company or contact name", "warning");
      return;
    }
    const payload: CustomerFormData = { ...f, name, sameAsBilling };
    if (isCreate) createMut.mutate(payload);
    else updateMut.mutate(payload);
  };

  const shipVal = (k: "Street1" | "Street2" | "Zip" | "City" | "State" | "Country") =>
    sameAsBilling ? (f as any)[k.charAt(0).toLowerCase() + k.slice(1)] : (f as any)["ship" + k];

  const title = isCreate
    ? isCustomer
      ? "Create Customer"
      : "Create Vendor"
    : isCustomer
      ? "Edit Customer"
      : "Edit Vendor";

  const paymentTermsLabel = isCustomer ? "Payment Terms (Sales)" : "Payment Terms (Purchases)";

  return (
    <section
      className={
        embedded
          ? "flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 bg-[var(--surface)]"
          : "flex-1 overflow-y-auto custom-scrollbar flex flex-col m-2 bg-white border border-gray-300 shadow-sm"
      }
    >
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-300 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isBusy}
            className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-60"
          >
            {isBusy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8 border-b border-gray-300 flex-shrink-0">
        {(["Details", "Settings"] as const).map((t) => (
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
          {tab === "Details" ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-6">
                  <Field label="Company Name" value={f.name} onChange={(v) => set("name", v)} />
                  <div className="grid grid-cols-2 gap-4">
                    {show("Reg. No") && <Field label="Reg. No" value={f.regNo} onChange={(v) => set("regNo", v)} />}
                    {show("GSTIN / VAT Number") && (
                      <Field label="GSTIN / VAT Number" value={f.taxId} onChange={(v) => set("taxId", v)} />
                    )}
                  </div>
                  {show("Taxpayer Type") && (
                    <SelectField
                      label="Taxpayer Type"
                      value={taxpayerType}
                      options={["Regular", "Composition", "Unregistered", "Consumer"]}
                      onChange={setTaxpayerType}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {show("Business Phone") && <Field label="Business Phone" value={f.phone} onChange={(v) => set("phone", v)} />}
                    {show("Fax") && <Field label="Fax" value={f.fax} onChange={(v) => set("fax", v)} />}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name" value={f.firstName} onChange={(v) => set("firstName", v)} />
                    {show("Last Name") && <Field label="Last Name" value={f.lastName} onChange={(v) => set("lastName", v)} />}
                  </div>
                  {show("Email") && (
                    <div className="relative">
                      <label className="absolute -top-2 left-2 px-1 bg-white text-[11px] text-gray-500 z-10">Email</label>
                      {f.email && !emailEditing ? (
                        <div className={`${fieldCls} flex items-center`}>
                          <span className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-300 rounded-full pl-3 pr-1.5 py-0.5 text-sm text-gray-800">
                            {f.email}
                            <button
                              type="button"
                              onClick={() => {
                                set("email", "");
                                setEmailEditing(true);
                              }}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-400 text-white hover:bg-gray-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        </div>
                      ) : (
                        <input
                          value={f.email}
                          onChange={(e) => set("email", e.target.value)}
                          onBlur={() => f.email.trim() && setEmailEditing(false)}
                          onKeyDown={(e) => e.key === "Enter" && f.email.trim() && setEmailEditing(false)}
                          placeholder="Email"
                          className={fieldCls}
                        />
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {show("Mobile") && <Field label="Mobile" value={f.mobile} onChange={(v) => set("mobile", v)} />}
                    {show("Home Phone") && <Field label="Home Phone" value={f.homePhone} onChange={(v) => set("homePhone", v)} />}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {show("Birthday") && <Field label="Birthday" value={f.birthday} onChange={(v) => set("birthday", v)} type="date" />}
                    {show("Anniversary") && (
                      <Field label="Anniversary" value={f.anniversary} onChange={(v) => set("anniversary", v)} type="date" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Address</span>
                  <span className="text-xs text-gray-400">Billing</span>
                </div>
                {show("Entire Shipping Address") ? (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={() => setSameAsBilling((v) => !v)}
                        className="accent-blue-600"
                      />{" "}
                      Same as Billing
                    </label>
                    <span className="text-xs text-gray-400">Shipping</span>
                  </div>
                ) : (
                  <div />
                )}
                <div className="space-y-4">
                  <Field label="Street 1" value={f.street1} onChange={(v) => set("street1", v)} />
                  {show("Street 2") && <Field label="Street 2" value={f.street2} onChange={(v) => set("street2", v)} />}
                  <div className="grid grid-cols-3 gap-3">
                    {show("Zip Code") && <Field label="Zip Code" value={f.zip} onChange={(v) => set("zip", v)} />}
                    {show("City") && <Field label="City" value={f.city} onChange={(v) => set("city", v)} />}
                    {show("State") && <Field label="State" value={f.state} onChange={(v) => set("state", v)} />}
                  </div>
                  {show("Country") && <Field label="Country" value={f.country} onChange={(v) => set("country", v)} />}
                </div>
                {show("Entire Shipping Address") && (
                  <div className={`space-y-4 ${sameAsBilling ? "opacity-60 pointer-events-none" : ""}`}>
                    <Field label="Street 1" value={shipVal("Street1")} onChange={(v) => set("shipStreet1", v)} disabled={sameAsBilling} />
                    {show("Street 2") && (
                      <Field label="Street 2" value={shipVal("Street2")} onChange={(v) => set("shipStreet2", v)} disabled={sameAsBilling} />
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      {show("Zip Code") && (
                        <Field label="Zip Code" value={shipVal("Zip")} onChange={(v) => set("shipZip", v)} disabled={sameAsBilling} />
                      )}
                      {show("City") && (
                        <Field label="City" value={shipVal("City")} onChange={(v) => set("shipCity", v)} disabled={sameAsBilling} />
                      )}
                      {show("State") && (
                        <Field label="State" value={shipVal("State")} onChange={(v) => set("shipState", v)} disabled={sameAsBilling} />
                      )}
                    </div>
                    {show("Country") && (
                      <Field label="Country" value={shipVal("Country")} onChange={(v) => set("shipCountry", v)} disabled={sameAsBilling} />
                    )}
                  </div>
                )}
              </div>

              {show("Bank Details") && (
                <div className="pt-2">
                  <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
                  <RichTextEditor value={f.bank} onChange={(html) => set("bank", html)} placeholder="Bank Details" />
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {show("Currency") && (
                  <SelectField label="Currency" value={f.currency} options={CURRENCIES} onChange={(v) => set("currency", v)} />
                )}
                {isCustomer && show("Default Taxes (Services)") && (
                  <Field label="Default Taxes (Services)" value={f.defaultTaxService} onChange={(v) => set("defaultTaxService", v)} />
                )}
                {isCustomer && show("Default Taxes (Product)") && (
                  <Field label="Default Taxes (Product)" value={f.defaultTaxProduct} onChange={(v) => set("defaultTaxProduct", v)} />
                )}
                {isCustomer && show("Hourly Rate") && (
                  <Field label="Hourly Rate" value={f.hourlyRate} onChange={(v) => set("hourlyRate", v)} />
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {show("Payment Terms (Sales)") && (
                  <div className="lg:col-span-2">
                    <SelectField
                      label={paymentTermsLabel}
                      value={f.paymentTerms}
                      options={PAYMENT_TERMS}
                      onChange={(v) => set("paymentTerms", v)}
                    />
                  </div>
                )}
                {show("Opening Balance") && (
                  <Field label="Opening Balance" value={f.openingBalance} onChange={(v) => set("openingBalance", v)} />
                )}
                {show("Opening Balance Date") && (
                  <Field
                    label="Opening Balance Date"
                    value={f.openingBalanceDate}
                    onChange={(v) => set("openingBalanceDate", v)}
                    type="date"
                  />
                )}
              </div>
              {show("Notes") && (
                <textarea
                  value={f.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Notes"
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-600 resize-y"
                />
              )}
              {show("Payment Reminder") && (
                <div className="flex items-center gap-6">
                  <span className="text-sm font-semibold text-gray-900">Payment Reminder</span>
                  <Toggle on={f.paymentReminder} onChange={() => set("paymentReminder", !f.paymentReminder)} />
                </div>
              )}
              <div className="flex items-center gap-6">
                <span className="text-sm font-semibold text-gray-900">Contact Login</span>
                <Toggle on={!!f.isLoginRequired} onChange={() => set("isLoginRequired", !f.isLoginRequired)} />
              </div>
            </div>
          )}
        </TabSlide>
      </div>
    </section>
  );
};

export default PartyEditForm;
