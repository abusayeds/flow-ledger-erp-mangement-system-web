import React, { useState, useEffect } from "react";
import { api } from "@/lib/api/client";
import { toArray } from "@/services/_http";
import { showToast } from "../utils/toast";
import {
  Search, Plus, Edit, Trash2, MoreVertical, Building2, Columns, CheckCircle, Copy,
} from "lucide-react";

interface BankAccount {
  id: string;
  accountName: string;
  accountCode: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountType: string;
  currency: string;
  notes: string;
  balance: number;
}

const sampleAccounts: BankAccount[] = [
  { id: "1", accountName: "Main Business Account", accountCode: "ACC001", accountNumber: "1234567890", bankName: "National Bank", ifscCode: "NATB0001234", accountType: "Current", currency: "USD", notes: "Primary operating account", balance: 45230 },
  { id: "2", accountName: "Savings Account", accountCode: "ACC002", accountNumber: "9876543210", bankName: "City Bank", ifscCode: "CITB0009876", accountType: "Savings", currency: "USD", notes: "Reserve funds", balance: 120000 },
];

export const Banking: React.FC = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<BankAccount>(sampleAccounts[0]);
  // Load real bank accounts from the backend (falls back to samples).
  useEffect(() => {
    let alive = true;
    api.raw.get("/account/bank-accounts/all").then((res) => {
      const arr = toArray<any>(res.data);
      if (!alive || !arr.length) return;
      const mapped = arr.map((a: any) => ({
        id: String(a._id),
        accountName: a.account_name ?? "",
        accountCode: a.account_code ?? "",
        accountNumber: a.account_number ?? "",
        bankName: a.bank_name ?? "",
        ifscCode: a.branch_name ?? a.ifsc_code ?? "",
        accountType: a.account_type ?? "",
        currency: a.currency ?? "",
        notes: a.notes ?? "",
        balance: Number(a.current_balance ?? a.opening_balance) || 0,
      })) as BankAccount[];
      setAccounts(mapped);
      setSelectedAccount(mapped[0]);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);
  const [formData, setFormData] = useState<BankAccount>(sampleAccounts[0]);

  const handleInputChange = (field: keyof BankAccount, value: any) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (isEditing) {
      setAccounts((prev) => prev.map((a) => (a.id === formData.id ? formData : a)));
      setSelectedAccount(formData);
      showToast("Bank account updated!", "success");
    } else {
      const newAccount = { ...formData, id: Date.now().toString() };
      setAccounts((prev) => [...prev, newAccount]);
      setSelectedAccount(newAccount);
      showToast("Bank account added!", "success");
    }
    setShowForm(false);
  };

  const handleEdit = () => { setFormData(selectedAccount); setIsEditing(true); setShowForm(true); setShowMobileList(false); };
  const handleCreate = () => { setFormData({ id: "", accountName: "", accountCode: "", accountNumber: "", bankName: "", ifscCode: "", accountType: "Current", currency: "USD", notes: "", balance: 0 }); setIsEditing(false); setShowForm(true); setShowMobileList(false); };
  const handleCancel = () => setShowForm(false);

  const filteredAccounts = accounts.filter((a) =>
    a.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.bankName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "Current": return "bg-blue-100 text-blue-700";
      case "Savings": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="module-page-shell overflow-hidden flex flex-col p-0">
      <div className="bg-white border-b border-gray-300 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-6"><button className="text-sm font-medium text-gray-900 border-b-2 border-blue-600 pb-2">Summary</button></div>
          <div className="flex items-center gap-3">
            <select className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"><option>This Year</option><option>This Month</option></select>
            <button className="p-1.5 hover:bg-gray-100 rounded"><svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 10h18M3 16h18" /></svg></button>
          </div>
        </div>
      </div>

      <div className="module-title-bar px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <h2 className="text-lg font-semibold text-gray-900">{showForm ? (isEditing ? "Edit Bank Account" : "Add Bank Account") : "Banking"}</h2>
            {!showForm && (<><h3 className="text-lg font-medium text-gray-700">{selectedAccount.accountName}</h3><span className="text-sm text-gray-500">{selectedAccount.bankName}</span></>)}
          </div>
          {showForm ? (
            <div className="flex items-center gap-2">
              <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2 relative">
              <button onClick={() => showToast("Column settings coming soon", "info")} className="p-2 hover:bg-gray-100 rounded-md"><Columns className="w-5 h-5 text-gray-600" /></button>
              <button onClick={handleEdit} className="p-2 hover:bg-gray-100 rounded-md"><Edit className="w-5 h-5 text-gray-600" /></button>
              <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-2 hover:bg-gray-100 rounded-md"><MoreVertical className="w-5 h-5 text-gray-600" /></button>
              {showMoreMenu && (
                <div className="absolute right-0 top-12 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <button onClick={() => { const dup = { ...selectedAccount, id: Date.now().toString(), accountName: `${selectedAccount.accountName} (Copy)` }; setAccounts(prev => [...prev, dup]); showToast("Duplicated!", "success"); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Copy className="w-4 h-4" /> Duplicate</button>
                  <div className="border-t border-gray-200 my-1" />
                  <button onClick={() => { setAccounts(prev => prev.filter(a => a.id !== selectedAccount.id)); if (accounts.length > 1) setSelectedAccount(accounts.find(a => a.id !== selectedAccount.id) || accounts[0]); showToast("Account removed!", "info"); setShowMoreMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Remove</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-2">
        <button onClick={() => setShowMobileList(!showMobileList)} className="flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-md px-3 py-1.5">
          {showMobileList ? "← Back to Details" : "☰ View Accounts"}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className={`${showMobileList ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-64 bg-white border-r border-gray-200`}>
          <div className="p-3 border-b border-gray-200">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search accounts" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredAccounts.map((account) => (
              <div key={account.id} onClick={() => { setSelectedAccount(account); setShowForm(false); setShowMobileList(false); }} className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${selectedAccount?.id === account.id && !showForm ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{account.accountName}</div>
                    <div className="text-xs text-gray-500">{account.bankName}</div>
                  </div>
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getAccountTypeColor(account.accountType)}`}>{account.accountType}</span>
                  <span className="text-sm font-semibold text-gray-900">${account.balance.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200"><button onClick={handleCreate} className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 mx-auto"><Plus className="w-6 h-6" /></button></div>
          <div className="p-4 border-t border-gray-200 text-center">
            <div className="text-xl font-semibold text-gray-900">${accounts.reduce((s, a) => s + a.balance, 0).toLocaleString()}</div>
            <div className="text-xs text-gray-500">Total Balance</div>
          </div>
        </div>

        <div className={`${showMobileList ? "hidden" : "flex"} lg:flex flex-col flex-1 overflow-y-auto p-4 sm:p-6`}>
          {showForm ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Add Bank Account Manually</h3>
              <p className="text-sm text-gray-500 mb-6">Enter your bank account details below.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Account Name <span className="text-red-500">*</span></label><input type="text" value={formData.accountName} onChange={(e) => handleInputChange("accountName", e.target.value)} placeholder="e.g. Main Business Account" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label><input type="text" value={formData.accountCode} onChange={(e) => handleInputChange("accountCode", e.target.value)} placeholder="e.g. ACC001" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Account Number <span className="text-red-500">*</span></label><input type="text" value={formData.accountNumber} onChange={(e) => handleInputChange("accountNumber", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Bank Name <span className="text-red-500">*</span></label><input type="text" value={formData.bankName} onChange={(e) => handleInputChange("bankName", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">IFSC / Routing Code</label><input type="text" value={formData.ifscCode} onChange={(e) => handleInputChange("ifscCode", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label><select value={formData.accountType} onChange={(e) => handleInputChange("accountType", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"><option>Current</option><option>Savings</option><option>Fixed Deposit</option><option>Credit Card</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Currency</label><select value={formData.currency} onChange={(e) => handleInputChange("currency", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"><option>USD</option><option>EUR</option><option>GBP</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label><input type="number" value={formData.balance} onChange={(e) => handleInputChange("balance", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea rows={3} value={formData.notes} onChange={(e) => handleInputChange("notes", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-6 border-t border-gray-200">
                <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save Account</button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-start gap-4 mb-6 pb-4 border-b border-gray-200">
                <div className="w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedAccount.accountName}</h3>
                  <p className="text-sm text-gray-500">{selectedAccount.bankName}</p>
                  <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${getAccountTypeColor(selectedAccount.accountType)}`}>{selectedAccount.accountType}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">Current Balance</div>
                  <div className="text-2xl font-bold text-blue-600">${selectedAccount.balance.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{selectedAccount.currency}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">Total Received</div>
                  <div className="text-2xl font-bold text-green-600">$0</div>
                  <div className="text-xs text-gray-500">This month</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-gray-500 mb-1">Total Paid</div>
                  <div className="text-2xl font-bold text-red-600">$0</div>
                  <div className="text-xs text-gray-500">This month</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div><label className="text-xs text-gray-500 block mb-1">Account Name</label><p className="text-sm text-gray-900">{selectedAccount.accountName}</p></div>
                <div><label className="text-xs text-gray-500 block mb-1">Account Code</label><p className="text-sm text-gray-900">{selectedAccount.accountCode}</p></div>
                <div><label className="text-xs text-gray-500 block mb-1">Account Number</label><p className="text-sm font-mono text-gray-900">{selectedAccount.accountNumber}</p></div>
                <div><label className="text-xs text-gray-500 block mb-1">Bank Name</label><p className="text-sm text-gray-900">{selectedAccount.bankName}</p></div>
                <div><label className="text-xs text-gray-500 block mb-1">IFSC / Routing Code</label><p className="text-sm font-mono text-gray-900">{selectedAccount.ifscCode}</p></div>
                <div><label className="text-xs text-gray-500 block mb-1">Currency</label><p className="text-sm text-gray-900">{selectedAccount.currency}</p></div>
                <div className="sm:col-span-2"><label className="text-xs text-gray-500 block mb-1">Notes</label><p className="text-sm text-gray-900">{selectedAccount.notes || "—"}</p></div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Transactions</h4>
                <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-md">
                  <p className="text-sm">No transactions yet</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
