import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import { toArray } from "@/services/_http";
import { resolveMediaUrl } from "@/lib/env";
import useAuth from "@/hooks/useAuth";
import { PdfPrintSettingsModal } from "../components/modals/PdfPrintSettingsModal";
import { AppSettingsModal } from "../components/modals/AppSettingsModal";
import { PaymentMethodsModal } from "../components/modals/PaymentMethodsModal";
import { TermsConditionsModal } from "../components/modals/TermsConditionsModal";
import { TaxesModal } from "../components/modals/TaxesModal";
import { BankDetailsModal } from "../components/modals/BankDetailsModal";
import { NotesModal } from "../components/modals/NotesModal";
import { SignatureModal } from "../components/modals/SignatureModal";
import { TeamModal } from "../components/modals/TeamModal";
import { EmailTemplatesModal } from "../components/modals/EmailTemplatesModal";
import { showToast } from "@/utils/toast";
import {
  fetchPrimaryCompanySignature,
  createCompanySignature,
  updateCompanySignature,
  uploadSignatureImage,
  resolveSignatureUrl,
  type CompanySignature,
} from "@/services/companySignaturesApi";
import { ListSidebarFooter } from "@/components/ui/ListSidebarFooter";
import { ResizableListPanel } from "@/components/layout/ResizableListPanel";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  FileText,
  CreditCard,
  FileCheck,
  Percent,
  Mail,
  Building2,
  StickyNote,
  PenLine,
  Users,
  X,
  ImagePlus,
} from "lucide-react";

interface AddressParts {
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface Company {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  website: string;
  billingAddress: string;
  shippingAddress?: string;
  sameAsBilling?: boolean;
  regNo: string;
  vat: string;
  paymentTermsSales: string;
  paymentTermsPurchase: string;
  startFiscalYear: string;
  logo: string;
  isOwner: boolean;
  reverseChargeSales?: boolean;
}

const resolveLogoUrl = (value?: string) => resolveMediaUrl(value);

const uploadCompanyLogo = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("files", file);
  const uploadRes = await api.raw.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return (
    uploadRes.data?.data?.file_path ||
    uploadRes.data?.data?.url ||
    uploadRes.data?.data?.path ||
    ""
  );
};

const emptyAddress = (): AddressParts => ({
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "Bangladesh",
});

const parseAddress = (raw?: string): AddressParts => {
  const lines = String(raw || "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return emptyAddress();
  if (lines.length === 1) {
    return { ...emptyAddress(), country: lines[0] };
  }
  return {
    street1: lines[0] || "",
    street2: lines[1] || "",
    city: lines[2] || "",
    state: lines[3] || "",
    zip: lines[4] || "",
    country: lines[5] || lines[lines.length - 1] || "Bangladesh",
  };
};

const joinAddress = (a: AddressParts) =>
  [a.street1, a.street2, a.city, a.state, a.zip, a.country].map((x) => x.trim()).filter(Boolean).join("\n");

const mapCompany = (d: any): Company => ({
  id: String(d._id),
  businessName: d.business_name ?? "",
  email: d.email ?? "",
  phone: d.phone ?? "",
  mobile: d.mobile ?? "",
  fax: d.fax ?? "",
  website: d.website ?? "",
  billingAddress: d.billing_address ?? "",
  shippingAddress: d.shipping_address ?? "",
  sameAsBilling: !!d.same_as_billing,
  regNo: d.reg_no ?? "",
  vat: d.vat ?? "",
  paymentTermsSales: d.payment_terms_sales ?? "",
  paymentTermsPurchase: d.payment_terms_purchase ?? "",
  startFiscalYear: d.start_fiscal_year ?? "January",
  logo: d.logo ?? "",
  isOwner: !!d.is_owner,
});

const companyBody = (c: Company) => ({
  business_name: c.businessName,
  email: c.email,
  phone: c.phone,
  mobile: c.mobile,
  fax: c.fax,
  website: c.website,
  billing_address: c.billingAddress,
  shipping_address: c.shippingAddress ?? "",
  same_as_billing: !!c.sameAsBilling,
  reg_no: c.regNo,
  vat: c.vat,
  payment_terms_sales: c.paymentTermsSales,
  payment_terms_purchase: c.paymentTermsPurchase,
  start_fiscal_year: c.startFiscalYear,
  logo: c.logo || "",
  is_owner: !!c.isOwner,
});

const PAYMENT_TERMS = ["Net on receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface SettingCard {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tab: string;
}

const SETTING_CARDS: SettingCard[] = [
  { icon: <Settings className="w-5 h-5 text-white" />, title: "Currency & Format", tab: "Currency & Format" },
  { icon: <FileText className="w-5 h-5 text-white" />, title: "PDF & Print Settings", subtitle: "Standard", tab: "Printer" },
  { icon: <CreditCard className="w-5 h-5 text-white" />, title: "Payment Methods", subtitle: "---", tab: "General" },
  { icon: <FileCheck className="w-5 h-5 text-white" />, title: "Terms & Conditions", tab: "General" },
  { icon: <Percent className="w-5 h-5 text-white" />, title: "Taxes", tab: "General" },
  { icon: <Mail className="w-5 h-5 text-white" />, title: "Email Templates", subtitle: "Dear <customer> <no...", tab: "General" },
  { icon: <Building2 className="w-5 h-5 text-white" />, title: "Bank Details", tab: "General" },
  { icon: <StickyNote className="w-5 h-5 text-white" />, title: "Notes", tab: "General" },
  { icon: <PenLine className="w-5 h-5 text-white" />, title: "Signature", tab: "General" },
  { icon: <Users className="w-5 h-5 text-white" />, title: "Team", subtitle: "Members", tab: "General" },
];

const fieldLabel = "block text-xs text-gray-500 mb-1";
const underlineInput =
  "w-full bg-transparent border-0 border-b border-gray-300 rounded-none px-0 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500";
const underlineSelect =
  "w-full bg-transparent border-0 border-b border-gray-300 rounded-none px-0 py-2 text-sm text-gray-900 focus:outline-none focus:ring-0 focus:border-blue-500";

type CompanyFormState = Company & {
  billing: AddressParts;
  shipping: AddressParts;
};

const emptyForm = (): CompanyFormState => ({
  id: "",
  businessName: "",
  email: "",
      phone: "",
      mobile: "",
      fax: "",
      website: "",
  billingAddress: "",
  shippingAddress: "",
  sameAsBilling: false,
      regNo: "",
      vat: "",
  paymentTermsSales: "Net on receipt",
  paymentTermsPurchase: "Net on receipt",
      startFiscalYear: "January",
  logo: "",
      isOwner: true,
  reverseChargeSales: false,
  billing: emptyAddress(),
  shipping: emptyAddress(),
});

const fromCompany = (c: Company): CompanyFormState => ({
  ...c,
  paymentTermsSales: c.paymentTermsSales || "Net on receipt",
  paymentTermsPurchase: c.paymentTermsPurchase || "Net on receipt",
  logo: c.logo || "",
  billing: parseAddress(c.billingAddress),
  shipping: parseAddress(c.shippingAddress || (c.sameAsBilling ? c.billingAddress : "")),
});

const toCompany = (f: CompanyFormState): Company => {
  const billingAddress = joinAddress(f.billing);
  const shippingAddress = f.sameAsBilling ? billingAddress : joinAddress(f.shipping);
  return {
    id: f.id,
    businessName: f.businessName.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    mobile: f.mobile.trim(),
    fax: f.fax.trim(),
    website: f.website.trim(),
    billingAddress,
    shippingAddress,
    sameAsBilling: !!f.sameAsBilling,
    regNo: f.regNo.trim(),
    vat: f.vat.trim(),
    paymentTermsSales: f.paymentTermsSales,
    paymentTermsPurchase: f.paymentTermsPurchase,
    startFiscalYear: f.startFiscalYear,
    logo: f.logo || "",
    isOwner: !!f.isOwner,
    reverseChargeSales: !!f.reverseChargeSales,
  };
};

const AddressCol: React.FC<{
  label: string;
  parts: AddressParts;
  onChange: (p: Partial<AddressParts>) => void;
  headerRight?: React.ReactNode;
  disabled?: boolean;
}> = ({ label, parts, onChange, headerRight, disabled }) => (
  <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
      {headerRight}
    </div>
    <div className="space-y-4">
      <div>
        <label className={fieldLabel}>Street 1</label>
        <input className={underlineInput} value={parts.street1} onChange={(e) => onChange({ street1: e.target.value })} />
      </div>
      <div>
        <label className={fieldLabel}>Street 2</label>
        <input className={underlineInput} value={parts.street2} onChange={(e) => onChange({ street2: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={fieldLabel}>City</label>
          <input className={underlineInput} value={parts.city} onChange={(e) => onChange({ city: e.target.value })} />
        </div>
        <div>
          <label className={fieldLabel}>State</label>
          <input className={underlineInput} value={parts.state} onChange={(e) => onChange({ state: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={fieldLabel}>Zip</label>
          <input className={underlineInput} value={parts.zip} onChange={(e) => onChange({ zip: e.target.value })} />
        </div>
        <div>
          <label className={fieldLabel}>
            Country <span className="text-red-500">*</span>
          </label>
          <input className={underlineInput} value={parts.country} onChange={(e) => onChange({ country: e.target.value })} />
        </div>
      </div>
    </div>
  </div>
);

/** Create / Edit Company modal — layout matches client, app theme colors. */
const CompanyFormModal: React.FC<{
  initial: CompanyFormState;
  title: string;
  onClose: () => void;
  onSave: (company: Company) => Promise<void>;
  loginEmail?: string;
}> = ({ initial, title, onClose, onSave, loginEmail }) => {
  const [form, setForm] = useState<CompanyFormState>(initial);
  const [addrOpen, setAddrOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const patch = (p: Partial<CompanyFormState>) => setForm((f) => ({ ...f, ...p }));
  const patchBilling = (p: Partial<AddressParts>) =>
    setForm((f) => ({ ...f, billing: { ...f.billing, ...p } }));
  const patchShipping = (p: Partial<AddressParts>) =>
    setForm((f) => ({ ...f, shipping: { ...f.shipping, ...p } }));

  const commitEmail = () => {
    const v = emailDraft.trim();
    if (!v) return;
    const next = { email: v } as Partial<CompanyFormState>;
    if (loginEmail && v.toLowerCase() === loginEmail.toLowerCase()) next.isOwner = true;
    patch(next);
    setEmailDraft("");
  };

  const onLogoPick = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "error");
      return;
    }
    setUploadingLogo(true);
    try {
      const path = await uploadCompanyLogo(file);
      if (!path) throw new Error("Upload failed");
      patch({ logo: path });
      showToast("Logo uploaded", "success");
    } catch (e: any) {
      showToast(e?.message || "Logo upload failed", "error");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleNext = async () => {
    if (!form.businessName.trim()) return;
    if (!form.billing.country.trim()) return;
    setSaving(true);
    try {
      const payload = toCompany(form);
      if (
        loginEmail &&
        payload.email &&
        payload.email.toLowerCase() === loginEmail.toLowerCase()
      ) {
        payload.isOwner = true;
      }
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const logoUrl = resolveLogoUrl(form.logo);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl my-6 rounded-lg overflow-hidden shadow-2xl bg-white border border-gray-300">
        <div className="h-12 flex items-center justify-between px-5 border-b border-gray-300 bg-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 px-2 py-1">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !form.businessName.trim()}
              onClick={() => void handleNext()}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="flex justify-center">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onLogoPick(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploadingLogo}
              onClick={() => logoInputRef.current?.click()}
              className="relative w-28 h-28 border border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-blue-400 overflow-hidden disabled:opacity-60"
            >
              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Logo" className="absolute inset-0 w-full h-full object-contain p-2 bg-white" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] py-1">
                    {uploadingLogo ? "Uploading…" : "Change Logo"}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                    {uploadingLogo ? <ImagePlus className="w-5 h-5 animate-pulse" /> : <Plus className="w-5 h-5" />}
                  </span>
                  <span className="text-xs font-medium text-blue-600">
                    {uploadingLogo ? "Uploading…" : "Add Logo"}
                  </span>
                </>
              )}
            </button>
          </div>
          {form.logo && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => patch({ logo: "" })}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove logo
              </button>
            </div>
          )}

          <div>
            <label className={fieldLabel}>
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              className={underlineInput}
              value={form.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
          </div>

          <div>
            <label className={fieldLabel}>Email</label>
            {form.email ? (
              <div className="flex items-center gap-2 py-2 border-b border-gray-300">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-300 px-2.5 py-1 text-sm text-gray-800">
                  {form.email}
                  <button type="button" onClick={() => patch({ email: "" })} className="text-gray-500 hover:text-gray-800">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            ) : (
              <input
                type="email"
                className={underlineInput}
                value={emailDraft}
                placeholder="Add email"
                onChange={(e) => setEmailDraft(e.target.value)}
                onBlur={commitEmail}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEmail();
                  }
                }}
              />
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.isOwner}
              onChange={(e) => patch({ isOwner: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
            />
            Owner company (login account)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={fieldLabel}>Phone</label>
              <input className={underlineInput} value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>Mobile</label>
              <input className={underlineInput} value={form.mobile} onChange={(e) => patch({ mobile: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>Fax</label>
              <input className={underlineInput} value={form.fax} onChange={(e) => patch({ fax: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabel}>Website</label>
              <input className={underlineInput} value={form.website} onChange={(e) => patch({ website: e.target.value })} />
            </div>
          </div>

          <div className="border border-gray-300 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setAddrOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 text-sm font-semibold text-gray-900"
            >
              Address
              {addrOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {addrOpen && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-8 border-t border-gray-300">
                <AddressCol label="Billing" parts={form.billing} onChange={patchBilling} />
                <AddressCol
                  label="Shipping"
                  parts={form.sameAsBilling ? form.billing : form.shipping}
                  onChange={patchShipping}
                  disabled={!!form.sameAsBilling}
                  headerRight={
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.sameAsBilling}
                        onChange={(e) =>
                          patch({
                            sameAsBilling: e.target.checked,
                            shipping: e.target.checked ? { ...form.billing } : form.shipping,
                          })
                        }
                        className="w-3.5 h-3.5 accent-blue-600"
                      />
                      Same as Billing
                    </label>
                  }
                />
              </div>
            )}
          </div>

          <div className="border border-gray-300 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 text-sm font-semibold text-gray-900"
            >
              Settings
              {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {settingsOpen && (
              <div className="p-4 space-y-5 border-t border-gray-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={fieldLabel}>Reg. No</label>
                    <input className={underlineInput} value={form.regNo} onChange={(e) => patch({ regNo: e.target.value })} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Tax ID</label>
                    <input className={underlineInput} value={form.vat} onChange={(e) => patch({ vat: e.target.value })} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Payment Terms (Sales)</label>
                    <select
                      className={underlineSelect}
                      value={form.paymentTermsSales}
                      onChange={(e) => patch({ paymentTermsSales: e.target.value })}
                    >
                      {PAYMENT_TERMS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel}>Payment Terms (Purchases)</label>
                    <select
                      className={underlineSelect}
                      value={form.paymentTermsPurchase}
                      onChange={(e) => patch({ paymentTermsPurchase: e.target.value })}
                    >
                      {PAYMENT_TERMS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel}>Start Financial Year</label>
                    <select
                      className={underlineSelect}
                      value={form.startFiscalYear}
                      onChange={(e) => patch({ startFiscalYear: e.target.value })}
                    >
                      {MONTHS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.reverseChargeSales}
                    onChange={(e) => patch({ reverseChargeSales: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Reverse Charge for Sales
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = "",
}) => (
  <div className={className}>
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <div className="text-sm text-gray-900 min-h-[1.25rem]">{children}</div>
    <div className="border-b border-gray-300 mt-2" />
  </div>
);

const SectionBar: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-4 py-2.5 bg-gray-100 border-y border-gray-300 -mx-6 mb-4">
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
  </div>
);

export const Companies: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const loginEmail = String(user?.email || "").trim();
  const [showMobileList, setShowMobileList] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [sortBy, setSortBy] = useState<"Name">("Name");
  const [sortOpen, setSortOpen] = useState(false);
  const [formOpen, setFormOpen] = useState<"create" | "edit" | null>(null);
  const [loading, setLoading] = useState(true);

  const [settingsModal, setSettingsModal] = useState<{ open: boolean; tab: string }>({
    open: false,
    tab: "Currency & Format",
  });
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showTaxesModal, setShowTaxesModal] = useState(false);
  const [showBankDetailsModal, setShowBankDetailsModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showEmailTemplatesModal, setShowEmailTemplatesModal] = useState(false);
  const [companySignature, setCompanySignature] = useState<CompanySignature | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.raw.get("/company-register/all");
      const list = toArray<any>(res.data).map(mapCompany);
      setCompanies(list);
      setSelectedCompany((prev) => {
        if (!list.length) return null;
        if (prev && list.some((c) => c.id === prev.id)) {
          return list.find((c) => c.id === prev.id) || list[0];
        }
        const owner =
          list.find((c) => c.isOwner) ||
          (loginEmail
            ? list.find((c) => c.email.toLowerCase() === loginEmail.toLowerCase())
            : undefined) ||
          list[0];
        return owner;
      });
    } catch {
      setCompanies([]);
      setSelectedCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompanies();
    void fetchPrimaryCompanySignature()
      .then(setCompanySignature)
      .catch(() => setCompanySignature(null));
  }, []);

  const openCompanySignature = () => {
    void fetchPrimaryCompanySignature()
      .then((s) => {
        setCompanySignature(s);
        setShowSignatureModal(true);
      })
      .catch(() => {
        setCompanySignature(null);
        setShowSignatureModal(true);
      });
  };

  const saveCompanySignature = async (data: {
    image: string;
    name: string;
    title: string;
    date: string;
  }) => {
    try {
      const imagePath = await uploadSignatureImage(
        data.image,
        `company-signature-${Date.now()}.png`,
      );
      const name =
        data.name.trim() ||
        selectedCompany?.businessName ||
        "Authorized Signatory";
      let saved: CompanySignature | null;
      if (companySignature?.id) {
        saved = await updateCompanySignature(companySignature.id, {
          name,
          image: imagePath,
        });
      } else {
        saved = await createCompanySignature({ name, image: imagePath });
      }
      setCompanySignature(saved);
      showToast("Company signature saved", "success");
    } catch {
      showToast("Couldn't save company signature", "error");
    }
  };

  useEffect(() => {
    const openCreate = !!(location.state as { openCreate?: boolean } | null)?.openCreate;
    if (!openCreate) return;
    setFormOpen("create");
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  const sorted = useMemo(() => {
    const list = [...companies];
    list.sort((a, b) => a.businessName.localeCompare(b.businessName));
    return list;
  }, [companies, sortBy]);

  const openCreate = () => setFormOpen("create");
  const openEdit = () => {
    if (selectedCompany) setFormOpen("edit");
  };

  const handleSave = async (company: Company) => {
    try {
      if (company.id) {
        await api.raw.patch(`/company-register/${company.id}`, companyBody(company));
        showToast("Company updated", "success");
      } else {
        await api.raw.post("/company-register/create", companyBody(company));
        showToast("Company created", "success");
      }
      setFormOpen(null);
      await loadCompanies();
      window.dispatchEvent(new Event("qayd:company-changed"));
    } catch (e: any) {
      showToast(e?.message || "Could not save company", "error");
      throw e;
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;
    try {
      await api.raw.delete(`/company-register/${selectedCompany.id}`);
    } catch {
      /* ignore */
    }
      await loadCompanies();
      window.dispatchEvent(new Event("qayd:company-changed"));
  };

  const handleCardClick = (card: SettingCard) => {
    if (card.title === "PDF & Print Settings") setShowPdfModal(true);
    else if (card.title === "Payment Methods") setShowPaymentModal(true);
    else if (card.title === "Terms & Conditions") setShowTermsModal(true);
    else if (card.title === "Taxes") setShowTaxesModal(true);
    else if (card.title === "Bank Details") setShowBankDetailsModal(true);
    else if (card.title === "Notes") setShowNotesModal(true);
    else if (card.title === "Email Templates") setShowEmailTemplatesModal(true);
    else if (card.title === "Signature") openCompanySignature();
    else if (card.title === "Team") setShowTeamModal(true);
    else setSettingsModal({ open: true, tab: card.tab });
  };

  return (
    <div className="flex h-full w-full bg-[#FAFBFC] overflow-hidden">
      {settingsModal.open && (
        <AppSettingsModal
          initialTab={settingsModal.tab}
          onClose={() => setSettingsModal({ open: false, tab: "Currency & Format" })}
        />
      )}
      {showPdfModal && <PdfPrintSettingsModal onClose={() => setShowPdfModal(false)} />}
      {showPaymentModal && <PaymentMethodsModal onClose={() => setShowPaymentModal(false)} />}
      {showTermsModal && <TermsConditionsModal onClose={() => setShowTermsModal(false)} />}
      {showTaxesModal && <TaxesModal onClose={() => setShowTaxesModal(false)} />}
      {showBankDetailsModal && <BankDetailsModal onClose={() => setShowBankDetailsModal(false)} />}
      {showNotesModal && <NotesModal onClose={() => setShowNotesModal(false)} />}
      {showEmailTemplatesModal && (
        <EmailTemplatesModal onClose={() => setShowEmailTemplatesModal(false)} />
      )}
      {showSignatureModal && (
        <SignatureModal
          heading="Company Signature"
          authorizedLabel="Authorized Signatory"
          defaultName={companySignature?.name || selectedCompany?.businessName || ""}
          initialImage={resolveSignatureUrl(companySignature?.image)}
          onDone={saveCompanySignature}
          onClose={() => setShowSignatureModal(false)}
        />
      )}
      {showTeamModal && (
        <TeamModal onClose={() => setShowTeamModal(false)} companyEmail={selectedCompany?.email} />
      )}

      {formOpen && (
        <CompanyFormModal
          title={formOpen === "edit" ? "Edit Company" : "Create Company"}
          initial={
            formOpen === "edit" && selectedCompany
              ? fromCompany(selectedCompany)
              : {
                  ...emptyForm(),
                  email: loginEmail || "",
                  isOwner: true,
                }
          }
          loginEmail={loginEmail}
          onClose={() => setFormOpen(null)}
          onSave={handleSave}
        />
      )}

      {/* Mobile toggle */}
      <div className="lg:hidden absolute top-2 left-2 z-30 bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-md">
        <button
          type="button"
          onClick={() => setShowMobileList(!showMobileList)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600"
        >
          {showMobileList ? "← Details" : "☰ Companies"}
        </button>
      </div>

      {/* LEFT — same ResizableListPanel as Customers / Vendors */}
      <div className={`${showMobileList ? "flex" : "hidden"} lg:flex h-full`}>
        <ResizableListPanel onCreate={openCreate} createTitle="Create Company">
          <div className="h-12 flex items-center justify-between px-4 border-b border-gray-300 bg-gray-100">
            <h2 className="text-base font-semibold text-gray-900 tracking-tight">Companies</h2>
            <button
              type="button"
              onClick={openEdit}
              disabled={!selectedCompany}
              className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500 disabled:opacity-40"
              title="Edit company"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          <div className="list-filter-toolbar flex flex-nowrap items-center gap-2 overflow-x-auto px-3 py-2 border-b border-gray-300">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-full px-3 py-1 whitespace-nowrap"
              >
                Sort by | <span className="text-gray-800 font-medium">{sortBy}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {sortOpen && (
                <div className="absolute left-0 top-8 z-20 min-w-[140px] rounded-md border border-gray-300 bg-white shadow-lg py-1">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    onClick={() => {
                      setSortBy("Name");
                      setSortOpen(false);
                    }}
                  >
                    Name
              </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-28">
            {loading && <p className="px-4 py-4 text-sm text-gray-500">Loading…</p>}
            {!loading && !sorted.length && (
              <p className="px-4 py-4 text-sm text-gray-500">No companies yet</p>
            )}
            {sorted.map((company) => {
              const active = selectedCompany?.id === company.id;
              return (
                <button
                key={company.id}
                  type="button"
                  onClick={() => {
                    setSelectedCompany(company);
                    setShowMobileList(false);
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-300 flex items-center gap-3 transition-colors ${
                    active ? "bg-gray-100" : "hover:bg-gray-50"
                }`}
              >
                <div className="w-9 h-9 bg-blue-600 rounded flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
                    {company.logo ? (
                      <img
                        src={resolveLogoUrl(company.logo)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (company.businessName || "?").charAt(0).toUpperCase()
                    )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                      {company.businessName || "—"}
                  </div>
                  {company.email && (
                    <div className="text-xs text-gray-500 truncate">{company.email}</div>
                  )}
                </div>
                {company.isOwner && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">Owner</span>
                )}
                </button>
              );
            })}
          </div>

          <ListSidebarFooter total={`${sorted.length}`} countLabel="Companies" />
        </ResizableListPanel>
        </div>

      {/* RIGHT — detail panel with m-2 like other modules */}
      <section
        className={`${showMobileList ? "hidden" : "flex"} lg:flex flex-1 overflow-y-auto custom-scrollbar flex-col m-2 bg-white border border-gray-300 shadow-sm`}
      >
        {selectedCompany ? (
          <>
            <div className="h-12 flex items-center justify-between px-6 border-b border-gray-300 bg-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{selectedCompany.businessName}</h2>
                {selectedCompany.isOwner && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium flex-shrink-0">
                    Owner
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                  <button
                  type="button"
                  onClick={() => void handleDelete()}
                    title="Delete company"
                  className="p-2 hover:bg-gray-200 rounded-md text-gray-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                  type="button"
                  onClick={openEdit}
                    title="Edit company"
                  className="p-2 hover:bg-gray-200 rounded-md text-gray-500"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-[1fr_auto] gap-6">
                <InfoField label="Business Name">{selectedCompany.businessName}</InfoField>
                <div className="w-14 h-14 bg-blue-600 rounded flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
                  {selectedCompany.logo ? (
                    <img
                      src={resolveLogoUrl(selectedCompany.logo)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (selectedCompany.businessName || "?").charAt(0).toUpperCase()
                  )}
                  </div>
                </div>

              <InfoField label="Email">
                {selectedCompany.email ? (
                  <a href={`mailto:${selectedCompany.email}`} className="text-blue-600 hover:underline">
                    {selectedCompany.email}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </InfoField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoField label="Phone">{selectedCompany.phone || <span className="text-gray-400">—</span>}</InfoField>
                <InfoField label="Fax">{selectedCompany.fax || <span className="text-gray-400">—</span>}</InfoField>
                <InfoField label="Mobile">{selectedCompany.mobile || <span className="text-gray-400">—</span>}</InfoField>
                <InfoField label="Website">{selectedCompany.website || <span className="text-gray-400">—</span>}</InfoField>
                </div>

              <SectionBar title="Address" />
              <InfoField label="Billing Address">
                <span className="whitespace-pre-line">
                      {selectedCompany.billingAddress || <span className="text-gray-400">—</span>}
                </span>
              </InfoField>

              <SectionBar title="Settings" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <InfoField label="Reg. No">{selectedCompany.regNo || <span className="text-gray-400">—</span>}</InfoField>
                <InfoField label="Tax ID">{selectedCompany.vat || <span className="text-gray-400">—</span>}</InfoField>
                <InfoField label="Payment Terms (Sales)">
                  {selectedCompany.paymentTermsSales || <span className="text-gray-400">—</span>}
                </InfoField>
                <InfoField label="Payment Terms (Purchases)">
                  {selectedCompany.paymentTermsPurchase || <span className="text-gray-400">—</span>}
                </InfoField>
                <InfoField label="Start Financial Year">{selectedCompany.startFiscalYear || "January"}</InfoField>
                    </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" disabled checked={!!selectedCompany.reverseChargeSales} className="w-4 h-4" />
                Reverse Charge for Sales
              </label>

              <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {SETTING_CARDS.map((card) => (
                    <button
                      key={card.title}
                    type="button"
                    onClick={() => handleCardClick(card)}
                    className="flex flex-col items-start p-3 bg-gray-100 border border-gray-300 rounded-xl hover:border-blue-400 hover:shadow-sm transition-all text-left"
                    >
                      <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center mb-2">
                        {card.icon}
                      </div>
                    <p className="text-xs font-medium text-gray-800 leading-tight">{card.title}</p>
                      {card.subtitle && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate w-full">{card.subtitle}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            {loading ? "Loading…" : "Select a company or create one"}
                </div>
        )}
      </section>
    </div>
  );
};
