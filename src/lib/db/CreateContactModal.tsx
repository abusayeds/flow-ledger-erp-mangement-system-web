/**
 * File: src/lib/db/CreateContactModal.tsx
 * Full "Create Contact" form (matches the reference design: Details/Settings
 * tabs, company + person + address + bank-details fields). Persists a real
 * customer or vendor to the datastore. Used by the invoice create flow's
 * customer-finder pencil, and by the Customers / Vendors "+" buttons — so
 * "add" shows the same fields as "edit".
 *
 * Customer / Vendor field visibility follows App Settings → Field Visibility
 * (true = show, false = hide). Missing keys default to visible so the app
 * never breaks.
 */

import React, { useEffect, useState } from "react";
import { Calendar, Bold, Italic, Underline } from "lucide-react";
import { repo } from "./repo";
import { useAppSettings, isCustomerFieldVisible, isVendorFieldVisible } from "./appSettings";

const fc = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600";
const Float: React.FC<{ label?: string; placeholder?: string; value?: string; onChange?: (v: string) => void; icon?: React.ReactNode }> = ({ label, placeholder, value, onChange, icon }) => (
  <div className="relative fl-wrap">
    {label && <label className="fl-label">{label}</label>}
    <div className="relative">
      <input {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : { defaultValue: value })} placeholder={placeholder && placeholder !== label ? placeholder : " "} className={fc} />
      {icon && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
    </div>
  </div>
);

export const CreateContactModal: React.FC<{
  collection?: "customers" | "vendors";
  onClose: () => void;
  onSaved: (id: number, name: string) => void;
}> = ({ collection = "customers", onClose, onSaved }) => {
  const [tab, setTab] = useState<"Details" | "Settings">("Details");
  const [same, setSame] = useState(false);
  const [company, setCompany] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [taxpayerType, setTaxpayerType] = useState("Regular");
  const label = collection === "vendors" ? "Vendor" : "Customer";
  const isVendor = collection === "vendors";
  const customerSettings = useAppSettings("customer");
  const vendorSettings = useAppSettings("vendor");
  const show = (key: string) =>
    isVendor
      ? isVendorFieldVisible(vendorSettings?.fieldVisibility, key)
      : isCustomerFieldVisible(customerSettings?.fieldVisibility, key);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const save = async () => {
    const name = company.trim() || `${first} ${last}`.trim() || "New " + label;
    const contact = `${first} ${last}`.trim();
    const extra = collection === "vendors" ? { payable: 0 } : { balance: 0 };
    const id = await repo.add(collection, { name, contact, email: email.trim(), phone: mobile.trim(), subtitle: contact, status: "Active", ...extra });
    onSaved(id, name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-4xl my-8 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Create {label}</h3>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6">
              {(["Details", "Settings"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`text-sm pb-0.5 border-b-2 ${tab === t ? "text-gray-900 border-blue-600 font-medium" : "text-gray-500 border-transparent"}`}>{t}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={save} className="px-5 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>

        {tab === "Details" ? (
          <div className="p-6 max-h-[72vh] overflow-y-auto custom-scrollbar space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-6">
                <Float label="Company Name" placeholder="Company Name" value={company} onChange={setCompany} />
                {show("Reg. No") && <Float label="Reg. No" placeholder="Reg. No" />}
                {show("GSTIN / VAT Number") && (
                  <div className="relative fl-wrap">
                    <label className="fl-label">GSTIN / VAT Number</label>
                    <div className="relative">
                      <input placeholder=" " className={fc} />
                      <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Fetch Details</button>
                    </div>
                  </div>
                )}
                {show("Taxpayer Type") && (
                  <div className="relative fl-wrap">
                    <label className="fl-label">Taxpayer Type</label>
                    <select value={taxpayerType} onChange={(e) => setTaxpayerType(e.target.value)} className={fc}>
                      {["Regular", "Composition", "Unregistered", "Consumer"].map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(show("Business Phone") || show("Fax")) && (
                  <div className="grid grid-cols-2 gap-4">
                    {show("Business Phone") && <Float label="Business Phone" placeholder="Business Phone" />}
                    {show("Fax") && <Float label="Fax" placeholder="Fax" />}
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <Float label="First Name" placeholder="First Name" value={first} onChange={setFirst} />
                {show("Last Name") && <Float label="Last Name" placeholder="Last Name" value={last} onChange={setLast} />}
                {show("Email") && <Float label="Email" placeholder="Email" value={email} onChange={setEmail} />}
                {(show("Mobile") || show("Home Phone")) && (
                  <div className="grid grid-cols-2 gap-4">
                    {show("Mobile") && <Float label="Mobile" placeholder="Mobile" value={mobile} onChange={setMobile} />}
                    {show("Home Phone") && <Float label="Home Phone" placeholder="Home Phone" />}
                  </div>
                )}
                {(show("Birthday") || show("Anniversary")) && (
                  <div className="grid grid-cols-2 gap-4">
                    {show("Birthday") && <Float label="Birthday" placeholder="Birthday" icon={<Calendar className="w-4 h-4" />} />}
                    {show("Anniversary") && <Float label="Anniversary" placeholder="Anniversary" icon={<Calendar className="w-4 h-4" />} />}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">Address</span><span className="text-xs text-gray-400">Billing</span></div>
              {show("Entire Shipping Address") ? (
                <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={same} onChange={() => setSame((v) => !v)} className="accent-blue-600" /> Same as Billing</label><span className="text-xs text-gray-400">Shipping</span></div>
              ) : (
                <div />
              )}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Float placeholder="Street 1" />
                  {show("Street 2") && <Float placeholder="Street 2" />}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {show("Zip Code") && <Float placeholder="Zip" />}
                  {show("City") && <Float placeholder="City" />}
                  {show("State") && <Float placeholder="State" />}
                  {show("Country") && <Float placeholder="Country" />}
                </div>
              </div>
              {show("Entire Shipping Address") && (
                <div className={`space-y-4 ${same ? "opacity-60 pointer-events-none" : ""}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <Float placeholder="Street 1" />
                    {show("Street 2") && <Float placeholder="Street 2" />}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {show("Zip Code") && <Float placeholder="Zip" />}
                    {show("City") && <Float placeholder="City" />}
                    {show("State") && <Float placeholder="State" />}
                    {show("Country") && <Float placeholder="Country" />}
                  </div>
                </div>
              )}
            </div>
            {show("Bank Details") && (
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Bank Details</div>
                <div className="border border-gray-300 rounded-md overflow-hidden">
                  <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
                    {[Bold, Italic, Underline].map((Ic, i) => <button key={i} type="button" className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"><Ic className="w-4 h-4" /></button>)}
                  </div>
                  <textarea placeholder="Bank Details" className="w-full h-24 p-3 text-sm text-gray-800 outline-none resize-none" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 max-h-[72vh] overflow-y-auto custom-scrollbar space-y-5">
            {show("Currency") && <Float label="Currency" value="$ USD" />}
            {show("Payment Terms (Sales)") && <Float label="Payment Terms" placeholder="Due on Receipt" />}
            {show("Default Taxes (Services)") && <Float label="Default Taxes (Services)" placeholder="None" />}
            {show("Default Taxes (Product)") && <Float label="Default Taxes (Product)" placeholder="None" />}
            {show("Hourly Rate") && <Float label="Hourly Rate" placeholder="Hourly Rate" />}
            {show("Opening Balance") && <Float label="Opening Balance" placeholder="Opening Balance" />}
            {show("Opening Balance Date") && <Float label="Opening Balance Date" placeholder="Opening Balance Date" icon={<Calendar className="w-4 h-4" />} />}
            {show("Notes") && <textarea placeholder="Notes" rows={4} className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-y" />}
            {show("Payment Reminder") && (
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" defaultChecked /> Send payment reminders</label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="accent-blue-600" /> Enable contact login</label>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateContactModal;
