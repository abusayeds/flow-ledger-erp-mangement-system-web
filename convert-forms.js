const fs = require('fs');
const path = require('path');

const base = 'D:/invoice generation frontend/src/pages/sales/';

// Config per file
const configs = [
  {
    file: base + 'Estimates.tsx',
    stateDecl: `  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);`,
    handleSaveOld: `  const handleSave = () => {
    if (showEditModal && selectedEstimate) {
      setEstimates((prev) =>
        prev.map((est) => (est.id === formData.id ? formData : est)),
      );
      setSelectedEstimate(formData);
      setShowEditModal(false);
    } else if (showCreateModal) {
      const newEstimate = { ...formData, id: Date.now().toString() };
      setEstimates((prev) => [...prev, newEstimate]);
      setSelectedEstimate(newEstimate);
      setShowCreateModal(false);
    }
  };`,
    handleSaveNew: `  const handleSave = () => {
    if (isEditing && selectedEstimate) {
      setEstimates((prev) =>
        prev.map((est) => (est.id === formData.id ? formData : est)),
      );
      setSelectedEstimate(formData);
      showToast("Estimate updated!", "success");
    } else {
      const newEstimate = { ...formData, id: Date.now().toString() };
      setEstimates((prev) => [...prev, newEstimate]);
      setSelectedEstimate(newEstimate);
      showToast("Estimate created!", "success");
    }
    setShowForm(false);
  };

  const handleCancel = () => setShowForm(false);`,
    handleEditOld: `  const handleEdit = () => {
    if (selectedEstimate) {
      setFormData(selectedEstimate);
      setShowEditModal(true);
    }
  };`,
    handleEditNew: `  const handleEdit = () => {
    if (selectedEstimate) {
      setFormData(selectedEstimate);
      setIsEditing(true);
      setShowForm(true);
      setShowMobileList(false);
    }
  };`,
    handleCreateOld: `    setShowCreateModal(true);`,
    handleCreateNew: `    setIsEditing(false);
    setShowForm(true);
    setShowMobileList(false);`,
    // Header: first {isMultiSelectMode in action area
    headerOld: `                {isMultiSelectMode ? (
                  <>
                    <button
                      onClick={() => {
                        setEstimates((prev) => prev.filter((e) => !selectedEstimates.includes(e.id)));`,
    headerNew: `                {showForm ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                    <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
                  </div>
                ) : isMultiSelectMode ? (
                  <>
                    <button
                      onClick={() => {
                        setEstimates((prev) => prev.filter((e) => !selectedEstimates.includes(e.id)));`,
    // Right panel
    rightPanelOld: `              {isMultiSelectMode && selectedEstimates.length > 0 ? (`,
    rightPanelNew: `              {showForm ? (
                <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer</label><input type="text" value={formData.customerName} onChange={(e) => handleInputChange("customerName", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><select className="w-full px-3 py-2 border border-gray-300 rounded-md"><option>Default Taxes (Service)</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimate #</label><select className="w-full px-3 py-2 border border-gray-300 rounded-md"><option>Default Taxes (Product)</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Currency</label><input type="text" placeholder="$" className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label><select className="w-full px-3 py-2 border border-gray-300 rounded-md"><option>Default Company</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimate Date</label><div className="relative"><input type="text" placeholder="24" className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /></div></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Shipping Method</label><input type="text" placeholder="Paypal" className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div className="flex items-center pt-7"><label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="rounded border-gray-300" checked={formData.discountBeforeTax} onChange={(e) => handleInputChange("discountBeforeTax", e.target.checked)} />Discount Before Tax</label></div>
                  </div>
                  <div className="mb-6 overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead><tr className="border-b border-gray-200"><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Sr. No.</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Items</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Quantity</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Rate</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Tax</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Discount</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Amount</th></tr></thead>
                      <tbody><tr className="border-b border-gray-100"><td className="px-2 py-3">01</td><td className="px-2 py-3"><div className="flex items-center gap-2"><span>Electronics</span><button className="text-gray-400 hover:text-gray-600"><Edit className="w-4 h-4" /></button></div><div className="text-xs text-gray-500">Description</div></td><td className="px-2 py-3">23</td><td className="px-2 py-3">$40000</td><td className="px-2 py-3"><select className="border border-gray-300 rounded px-2 py-1 text-xs"><option>Tax</option></select></td><td className="px-2 py-3">2%</td><td className="px-2 py-3 flex items-center gap-2"><span>$32000</span><button className="text-green-600"><Plus className="w-4 h-4" /></button><button className="text-red-600"><Trash2 className="w-4 h-4" /></button></td></tr></tbody>
                    </table>
                  </div>
                  <div className="flex gap-3 mb-6">
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"><Plus className="w-4 h-4" />Add Product</button>
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"><Plus className="w-4 h-4" />Add Services</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label><textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div className="border-2 border-blue-400 rounded-md p-4"><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-gray-600">Sub Total</span><span className="text-blue-600">$80.00</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Shipping Cost</span><span className="text-blue-600">$3.20</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Sales Tax 4%</span><span className="text-blue-600">$10.00</span></div><div className="flex justify-between text-sm font-semibold border-t pt-2"><span className="text-gray-900">Total</span><span className="text-blue-600">$93.20</span></div></div></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label><textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                    <div><button className="w-full py-8 border-2 border-dashed border-gray-300 rounded-md text-gray-400 hover:border-gray-400 flex flex-col items-center justify-center gap-2"><Plus className="w-6 h-6" /><span className="text-sm">Upload Computer</span></button></div>
                  </div>
                  <div className="border-2 border-dashed border-blue-400 rounded-md p-4 mb-6">
                    <label className="block text-xs text-gray-500 mb-2">Customer Signature</label>
                    <button onClick={() => setShowSignatureModal(true)} className="w-full py-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Customer Signature</button>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                    <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                    <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
                  </div>
                </div>
              ) : isMultiSelectMode && selectedEstimates.length > 0 ? (`,
    // Modal to remove
    modalOld: `      {/* Create/Edit Modal */}
      {(showEditModal || showCreateModal) && (`,
    modalNew: `      {/* form is now inline in right panel */}
      {false && (`,
  },
  {
    file: base + 'SalesReceipts.tsx',
    stateDecl: `  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);`,
    handleSaveOld: `  const handleSave = () => {
    if (showEditModal) {
      setReceipts((prev) =>
        prev.map((rec) => (rec.id === formData.id ? formData : rec)),
      );
      setSelectedReceipt(formData);
      setShowEditModal(false);
    } else if (showCreateModal) {
      const newReceipt = { ...formData, id: Date.now().toString() };
      setReceipts((prev) => [...prev, newReceipt]);
      setSelectedReceipt(newReceipt);
      setShowCreateModal(false);
    }
  };`,
    handleSaveNew: `  const handleSave = () => {
    if (isEditing) {
      setReceipts((prev) =>
        prev.map((rec) => (rec.id === formData.id ? formData : rec)),
      );
      setSelectedReceipt(formData);
      showToast("Receipt updated!", "success");
    } else {
      const newReceipt = { ...formData, id: Date.now().toString() };
      setReceipts((prev) => [...prev, newReceipt]);
      setSelectedReceipt(newReceipt);
      showToast("Receipt created!", "success");
    }
    setShowForm(false);
  };

  const handleCancel = () => setShowForm(false);`,
    handleEditOld: `  const handleEdit = () => {
    setFormData(selectedReceipt);
    setShowEditModal(true);
  };`,
    handleEditNew: `  const handleEdit = () => {
    setFormData(selectedReceipt);
    setIsEditing(true);
    setShowForm(true);
    setShowMobileList(false);
  };`,
    handleCreateOld: `    setShowCreateModal(true);`,
    handleCreateNew: `    setIsEditing(false);
    setShowForm(true);
    setShowMobileList(false);`,
    headerOld: `            {isMultiSelectMode ? (
              <>
                <button
                  onClick={() => showToast("Receipts deleted!", "success")}`,
    headerNew: `            {showForm ? (
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
              </div>
            ) : isMultiSelectMode ? (
              <>
                <button
                  onClick={() => showToast("Receipts deleted!", "success")}`,
    rightPanelOld: `          {isMultiSelectMode && selectedReceipts.length > 0 ? (`,
    rightPanelNew: `          {showForm ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer</label><input type="text" value={formData.customerName} onChange={(e) => handleInputChange("customerName", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><select className="w-full px-3 py-2 border border-gray-300 rounded-md"><option>Default Taxes (Service)</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Sales Receipts #</label><select className="w-full px-3 py-2 border border-gray-300 rounded-md"><option>Default Taxes (Product)</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Currency</label><input type="text" placeholder="$" className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label><select className="w-full px-3 py-2 border border-gray-300 rounded-md"><option>Default Company</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label><input type="text" placeholder="$0" className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Shipping Method</label><input type="text" placeholder="24" className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Sales Receipts Date</label><div className="relative"><input type="text" placeholder="24" className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /></div></div>
              </div>
              <div className="mb-6 overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead><tr className="border-b border-gray-200"><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Sr. No.</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Items</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Quantity</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Rate</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Tax</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Discount</th><th className="px-2 py-2 text-left text-xs font-medium text-gray-600">Amount</th></tr></thead>
                  <tbody><tr className="border-b border-gray-100"><td className="px-2 py-3">01</td><td className="px-2 py-3"><div className="flex items-center gap-2"><span>Electronics</span><button className="text-gray-400 hover:text-gray-600"><Edit className="w-4 h-4" /></button></div><div className="text-xs text-gray-500">Description</div></td><td className="px-2 py-3">23</td><td className="px-2 py-3">$40000</td><td className="px-2 py-3"><select className="border border-gray-300 rounded px-2 py-1 text-xs"><option>Tax</option></select></td><td className="px-2 py-3">2%</td><td className="px-2 py-3 flex items-center gap-2"><span>$32000</span><button className="text-green-600 hover:text-green-700"><Plus className="w-4 h-4" /></button><button className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></button></td></tr></tbody>
                </table>
              </div>
              <div className="flex gap-3 mb-6">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"><Plus className="w-4 h-4" />Add Product</button>
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"><Plus className="w-4 h-4" />Add Services</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label><textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                <div><div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-gray-600">Sub Total</span><span className="text-blue-600">$80.00</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Shipping Cost</span><span className="text-blue-600">$3.20</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Sales Tax 4%</span><span className="text-blue-600">$10.00</span></div><div className="flex justify-between text-sm font-semibold border-t pt-2"><span className="text-gray-900">Total</span><span className="text-blue-600">$93.20</span></div></div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label><textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
                <div><button className="w-full py-8 border-2 border-dashed border-gray-300 rounded-md text-gray-400 hover:border-gray-400 hover:text-gray-500 flex flex-col items-center justify-center gap-2 transition-colors"><Plus className="w-6 h-6" /><span className="text-sm">Upload Computer</span></button></div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Signature</label>
                <button onClick={() => setShowSignatureModal(true)} className="w-full py-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Customer Signature</button>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
              </div>
            </div>
          ) : isMultiSelectMode && selectedReceipts.length > 0 ? (`,
    modalOld: `      {/* Create/Edit Sales Receipt Modal */}
      {(showEditModal || showCreateModal) && (`,
    modalNew: `      {/* form is now inline in right panel */}
      {false && (`,
  },
  {
    file: base + 'Proformainvoices.tsx',
    stateDecl: `  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);`,
    handleSaveOld: `  const handleSave = () => {
    if (showEditModal && selectedInvoice) {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === formData.id ? formData : inv)),
      );
      setSelectedInvoice(formData);
      setShowEditModal(false);
    } else if (showCreateModal) {
      const newInvoice = { ...formData, id: Date.now().toString() };
      setInvoices((prev) => [...prev, newInvoice]);
      setSelectedInvoice(newInvoice);
      setShowCreateModal(false);
    }
  };`,
    handleSaveNew: `  const handleSave = () => {
    if (isEditing && selectedInvoice) {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === formData.id ? formData : inv)),
      );
      setSelectedInvoice(formData);
      showToast("Proforma Invoice updated!", "success");
    } else {
      const newInvoice = { ...formData, id: Date.now().toString() };
      setInvoices((prev) => [...prev, newInvoice]);
      setSelectedInvoice(newInvoice);
      showToast("Proforma Invoice created!", "success");
    }
    setShowForm(false);
  };

  const handleCancel = () => setShowForm(false);`,
    handleEditOld: `  const handleEdit = () => {
    if (selectedInvoice) {
      setFormData(selectedInvoice);
      setShowEditModal(true);
    }
  };`,
    handleEditNew: `  const handleEdit = () => {
    if (selectedInvoice) {
      setFormData(selectedInvoice);
      setIsEditing(true);
      setShowForm(true);
      setShowMobileList(false);
    }
  };`,
    handleCreateOld: `    setShowCreateModal(true);`,
    handleCreateNew: `    setIsEditing(false);
    setShowForm(true);
    setShowMobileList(false);`,
    headerOld: `                {isMultiSelectMode ? (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Call"
                    >
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Email"
                    >
                      <Mail className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="View"
                    >
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Check"
                    >
                      <Check className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Favorite"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-600" />`,
    headerNew: `                {showForm ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                    <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
                  </div>
                ) : isMultiSelectMode ? (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Call"
                    >
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Email"
                    >
                      <Mail className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="View"
                    >
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Check"
                    >
                      <Check className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Favorite"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-600" />`,
    rightPanelOld: null, // handled differently - proforma has different right panel structure
    rightPanelNew: null,
    modalOld: null, // handled separately
    modalNew: null,
  },
];

// --- Helper: add showToast import if missing ---
function ensureShowToastImport(content) {
  if (!content.includes('import { showToast }') && !content.includes("showToast")) return content;
  if (content.includes('import { showToast }')) return content; // already there
  // Add after last import
  return content.replace(/^(import .+from ".+";)\n([^i])/m, '$1\nimport { showToast } from "../../utils/toast";\n$2');
}

for (const cfg of configs) {
  let content;
  try {
    content = fs.readFileSync(cfg.file, 'utf8');
  } catch(e) {
    console.error('Could not read', cfg.file, e.message);
    continue;
  }

  // 1. State
  if (cfg.stateDecl && content.includes(cfg.stateDecl)) {
    content = content.replace(cfg.stateDecl,
      `  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);`);
    console.log(cfg.file, '- state replaced');
  } else {
    console.warn(cfg.file, '- state NOT found');
  }

  // 2. handleSave
  if (cfg.handleSaveOld && content.includes(cfg.handleSaveOld)) {
    content = content.replace(cfg.handleSaveOld, cfg.handleSaveNew);
    console.log(cfg.file, '- handleSave replaced');
  } else {
    console.warn(cfg.file, '- handleSave NOT found');
  }

  // 3. handleEdit
  if (cfg.handleEditOld && content.includes(cfg.handleEditOld)) {
    content = content.replace(cfg.handleEditOld, cfg.handleEditNew);
    console.log(cfg.file, '- handleEdit replaced');
  } else {
    console.warn(cfg.file, '- handleEdit NOT found');
  }

  // 4. handleCreate
  if (cfg.handleCreateOld && content.includes(cfg.handleCreateOld)) {
    content = content.replace(cfg.handleCreateOld, cfg.handleCreateNew);
    console.log(cfg.file, '- handleCreate replaced');
  } else {
    console.warn(cfg.file, '- handleCreate NOT found');
  }

  // 5. Header
  if (cfg.headerOld && content.includes(cfg.headerOld)) {
    content = content.replace(cfg.headerOld, cfg.headerNew);
    console.log(cfg.file, '- header replaced');
  } else {
    console.warn(cfg.file, '- header NOT found');
  }

  // 6. Right panel
  if (cfg.rightPanelOld && content.includes(cfg.rightPanelOld)) {
    content = content.replace(cfg.rightPanelOld, cfg.rightPanelNew);
    console.log(cfg.file, '- right panel replaced');
  } else if (cfg.rightPanelOld) {
    console.warn(cfg.file, '- right panel NOT found');
  }

  // 7. Modal disable
  if (cfg.modalOld && content.includes(cfg.modalOld)) {
    content = content.replace(cfg.modalOld, cfg.modalNew);
    console.log(cfg.file, '- modal disabled');
  } else if (cfg.modalOld) {
    console.warn(cfg.file, '- modal NOT found');
  }

  // Ensure showToast import for Proformainvoices
  if (!content.includes("showToast") || content.indexOf("import { showToast }") < 0) {
    if (content.includes("import { useNavigate }")) {
      content = content.replace('import { useNavigate } from "react-router-dom";',
        'import { useNavigate } from "react-router-dom";\nimport { showToast } from "../../utils/toast";');
    }
  }

  fs.writeFileSync(cfg.file, content, 'utf8');
  console.log('Written:', cfg.file);
}

console.log('\nDone! Now handling CreditNotes and DeliveryChallan...');

// --- CreditNotes.tsx ---
{
  const file = base + 'CreditNotes.tsx';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    `  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);`,
    `  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);`
  );

  content = content.replace(
    `  const handleSave = () => {
    if (showEditModal && selectedNote) {
      setNotes((prev) =>
        prev.map((n) => (n.id === formData.id ? formData : n)),
      );
      setSelectedNote(formData);
      setShowEditModal(false);
    } else if (showCreateModal) {
      const newNote = { ...formData, id: Date.now().toString() };
      setNotes((prev) => [...prev, newNote]);
      setSelectedNote(newNote);
      setShowCreateModal(false);
    }
  };`,
    `  const handleSave = () => {
    if (isEditing && selectedNote) {
      setNotes((prev) =>
        prev.map((n) => (n.id === formData.id ? formData : n)),
      );
      setSelectedNote(formData);
      showToast("Credit Note updated!", "success");
    } else {
      const newNote = { ...formData, id: Date.now().toString() };
      setNotes((prev) => [...prev, newNote]);
      setSelectedNote(newNote);
      showToast("Credit Note created!", "success");
    }
    setShowForm(false);
  };

  const handleCancel = () => setShowForm(false);`
  );

  content = content.replace(
    `  const handleEdit = () => {
    if (selectedNote) {
      setFormData(selectedNote);
      setShowEditModal(true);
    }
  };`,
    `  const handleEdit = () => {
    if (selectedNote) {
      setFormData(selectedNote);
      setIsEditing(true);
      setShowForm(true);
      setShowMobileList(false);
    }
  };`
  );

  content = content.replace(`    setShowCreateModal(true);`,
    `    setIsEditing(false);
    setShowForm(true);
    setShowMobileList(false);`);

  // Add showToast import
  if (!content.includes("import { showToast }")) {
    content = content.replace('import React, { useState } from "react";',
      'import React, { useState } from "react";\nimport { showToast } from "../../utils/toast";');
  }

  // Header - find the isMultiSelectMode check in action area for CreditNotes
  const cnHeaderOld = `                {isMultiSelectMode ? (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Call"
                    >
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Email"
                    >
                      <Mail className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="View"
                    >
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Check"
                    >
                      <Check className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Favorite"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-600" />`;

  if (content.includes(cnHeaderOld)) {
    content = content.replace(cnHeaderOld,
      `                {showForm ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                    <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
                  </div>
                ) : isMultiSelectMode ? (
                  <>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Delete"><Trash2 className="w-5 h-5 text-gray-600" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Call"><svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Email"><Mail className="w-5 h-5 text-gray-600" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="View"><Eye className="w-5 h-5 text-gray-600" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Check"><Check className="w-5 h-5 text-gray-600" /></button>
                  </>
                ) : (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Favorite"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-600" />`);
    console.log('CreditNotes - header replaced');
  } else {
    console.warn('CreditNotes - header NOT found');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Written CreditNotes');
}

// --- Deliverychallan .tsx ---
{
  const file = base + 'Deliverychallan .tsx';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    `  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);`,
    `  // Form states
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);`
  );

  content = content.replace(
    `  const handleSave = () => {
    if (showEditModal && selectedChallan) {
      setChallans((prev) =>
        prev.map((ch) => (ch.id === formData.id ? formData : ch)),
      );
      setSelectedChallan(formData);
      setShowEditModal(false);
    } else if (showCreateModal) {
      const newChallan = { ...formData, id: Date.now().toString() };
      setChallans((prev) => [...prev, newChallan]);
      setSelectedChallan(newChallan);
      setShowCreateModal(false);
    }
  };`,
    `  const handleSave = () => {
    if (isEditing && selectedChallan) {
      setChallans((prev) =>
        prev.map((ch) => (ch.id === formData.id ? formData : ch)),
      );
      setSelectedChallan(formData);
      showToast("Delivery Challan updated!", "success");
    } else {
      const newChallan = { ...formData, id: Date.now().toString() };
      setChallans((prev) => [...prev, newChallan]);
      setSelectedChallan(newChallan);
      showToast("Delivery Challan created!", "success");
    }
    setShowForm(false);
  };

  const handleCancel = () => setShowForm(false);`
  );

  content = content.replace(
    `  const handleEdit = () => {
    if (selectedChallan) {
      setFormData(selectedChallan);
      setShowEditModal(true);
    }
  };`,
    `  const handleEdit = () => {
    if (selectedChallan) {
      setFormData(selectedChallan);
      setIsEditing(true);
      setShowForm(true);
      setShowMobileList(false);
    }
  };`
  );

  content = content.replace(`    setShowCreateModal(true);`,
    `    setIsEditing(false);
    setShowForm(true);
    setShowMobileList(false);`);

  // Add showToast import
  if (!content.includes("import { showToast }")) {
    content = content.replace('import React, { useState } from "react";',
      'import React, { useState } from "react";\nimport { showToast } from "../../utils/toast";');
  }

  // Header for DeliveryChallan - same pattern as CreditNotes
  const dcHeaderOld = `                {isMultiSelectMode ? (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Call"
                    >
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Email"
                    >
                      <Mail className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="View"
                    >
                      <Eye className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Check"
                    >
                      <Check className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Favorite"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-600" />`;

  if (content.includes(dcHeaderOld)) {
    content = content.replace(dcHeaderOld,
      `                {showForm ? (
                  <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Cancel</button>
                    <button onClick={() => { showToast("Saved as draft", "success"); setShowForm(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm">Save as Draft</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">Save & Send</button>
                  </div>
                ) : isMultiSelectMode ? (
                  <>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Delete"><Trash2 className="w-5 h-5 text-gray-600" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Call"><svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Email"><Mail className="w-5 h-5 text-gray-600" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="View"><Eye className="w-5 h-5 text-gray-600" /></button>
                    <button className="p-2 hover:bg-gray-100 rounded-md" title="Check"><Check className="w-5 h-5 text-gray-600" /></button>
                  </>
                ) : (
                  <>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-md"
                      title="Favorite"
                    >
                      <CheckCircle className="w-5 h-5 text-gray-600" />`);
    console.log('DeliveryChallan - header replaced');
  } else {
    console.warn('DeliveryChallan - header NOT found');
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Written DeliveryChallan');
}

console.log('\nAll done!');
