/** Import / Export module catalog — matches gear submenu screenshot order. */

export type TransferModuleId =
  | "contacts"
  | "invoices"
  | "sales-receipts"
  | "proforma-invoices"
  | "estimates"
  | "delivery-challans"
  | "credit-notes"
  | "payment-received"
  | "purchase-orders"
  | "bills"
  | "debit-notes"
  | "payment-made"
  | "expenses"
  | "projects"
  | "services"
  | "products"
  | "timelogs";

export type ExportModuleId = TransferModuleId;
export type ImportModuleId = TransferModuleId;

export type DataField = { key: string; label: string };

export type ExportModuleDef = {
  id: ExportModuleId;
  label: string;
  title: string;
  fields: DataField[];
};

export type ImportModuleDef = {
  id: ImportModuleId;
  label: string;
  title: string;
  templateHeaders: string[];
};

/** Export Data flyout — only these 5 (owner confirmed) */
export const EXPORT_MENU_ORDER: { id: ExportModuleId; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "estimates", label: "Estimates" },
  { id: "services", label: "Services" },
  { id: "products", label: "Products" },
  { id: "timelogs", label: "Time Logs" },
];

/** Import Data flyout — full module list */
export const IMPORT_MENU_ORDER: { id: ImportModuleId; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "invoices", label: "Invoices" },
  { id: "sales-receipts", label: "Sales Receipts" },
  { id: "proforma-invoices", label: "Proforma Invoices" },
  { id: "estimates", label: "Estimates" },
  { id: "delivery-challans", label: "Delivery Challans" },
  { id: "credit-notes", label: "Credit Notes" },
  { id: "payment-received", label: "Payment Received" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "bills", label: "Bills" },
  { id: "debit-notes", label: "Debit Notes" },
  { id: "payment-made", label: "Payment Made" },
  { id: "expenses", label: "Expenses" },
  { id: "projects", label: "Projects" },
  { id: "services", label: "Services" },
  { id: "products", label: "Products" },
];

/** @deprecated use EXPORT_MENU_ORDER / IMPORT_MENU_ORDER */
export const TRANSFER_MENU_ORDER = IMPORT_MENU_ORDER;

const CONTACTS_FIELDS: DataField[] = [
  { key: "companyName", label: "Company Name" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "taxId", label: "Tax ID" },
  { key: "regNo", label: "Reg. No" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "billingStreet1", label: "Billing Street 1" },
  { key: "billingStreet2", label: "Billing Street 2" },
  { key: "billingCity", label: "Billing City" },
  { key: "billingZip", label: "Billing Zip" },
  { key: "billingState", label: "Billing State" },
  { key: "billingCountry", label: "Billing Country" },
  { key: "shippingStreet1", label: "Shipping Street 1" },
  { key: "shippingStreet2", label: "Shipping Street 2" },
  { key: "shippingCity", label: "Shipping City" },
  { key: "shippingZip", label: "Shipping Zip" },
  { key: "shippingState", label: "Shipping State" },
  { key: "shippingCountry", label: "Shipping Country" },
  { key: "businessPhone", label: "Business Phone" },
  { key: "homePhone", label: "Home Phone" },
  { key: "fax", label: "Fax" },
  { key: "notes", label: "Notes" },
  { key: "hourlyRate", label: "Hourly Rate" },
  { key: "openingBalance", label: "Opening Balance" },
  { key: "openingBalanceDate", label: "Opening Balance Date" },
  { key: "outstanding", label: "Outstanding" },
  { key: "payableAmount", label: "Payable Amount" },
  { key: "sales", label: "Sales" },
  { key: "paymentReceived", label: "Payment Received" },
  { key: "estimates", label: "Estimates" },
  { key: "overdue", label: "Overdue" },
  { key: "creditNotes", label: "Credit Notes" },
  { key: "bills", label: "Bills" },
  { key: "purchaseOrders", label: "Purchase Orders" },
  { key: "paymentMade", label: "Payment Made" },
  { key: "debitNotes", label: "Debit Notes" },
];

const SALES_DOC_FIELDS: DataField[] = [
  { key: "date", label: "Date" },
  { key: "number", label: "Number" },
  { key: "customerName", label: "Customer Name" },
  { key: "discountRate", label: "Discount Rate" },
  { key: "applyDiscountBeforeTax", label: "Apply discount before tax" },
  { key: "taxId", label: "Tax ID" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "shippingCost", label: "Shipping Cost" },
  { key: "shippingMethod", label: "Shipping Method" },
  { key: "roundOff", label: "Round Off" },
  { key: "notes", label: "Notes" },
  { key: "termsConditions", label: "Terms Conditions" },
  { key: "subTitle", label: "Sub Title" },
  { key: "currency", label: "Currency" },
  { key: "billingStreet1", label: "Billing Street 1" },
  { key: "billingStreet2", label: "Billing Street 2" },
  { key: "billingCity", label: "Billing City" },
  { key: "billingState", label: "Billing State" },
  { key: "billingCountry", label: "Billing Country" },
  { key: "billingZip", label: "Billing Zip" },
  { key: "shippingStreet1", label: "Shipping Street 1" },
  { key: "shippingStreet2", label: "Shipping Street 2" },
  { key: "shippingCity", label: "Shipping City" },
  { key: "shippingState", label: "Shipping State" },
  { key: "shippingCountry", label: "Shipping Country" },
  { key: "itemQuantity", label: "Item Quantity" },
  { key: "itemUnitType", label: "Item Unit Type" },
  { key: "itemPrice", label: "Item Price" },
  { key: "itemCode", label: "Item Code" },
  { key: "itemDiscount", label: "Item Discount" },
  { key: "itemTax1Name", label: "Item Tax1 Name" },
  { key: "itemTax1Rate", label: "Item Tax1 Rate" },
  { key: "itemTax1Type", label: "Item Tax1 Type (Inclusive / Exclusive)" },
  { key: "itemTax2Name", label: "Item Tax2 Name" },
  { key: "itemTax2Rate", label: "Item Tax2 Rate" },
  { key: "itemTax2Type", label: "Item Tax2 Type" },
  { key: "itemTax3Name", label: "Item Tax3 Name" },
  { key: "itemTax3Rate", label: "Item Tax3 Rate" },
  { key: "itemTax3Type", label: "Item Tax3 Type" },
  { key: "subTotal", label: "Sub Total" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "status", label: "Status" },
];

const PURCHASE_DOC_FIELDS: DataField[] = [
  { key: "date", label: "Date" },
  { key: "number", label: "Number" },
  { key: "vendorName", label: "Vendor Name" },
  { key: "currency", label: "Currency" },
  { key: "subTotal", label: "Sub Total" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Total" },
  { key: "status", label: "Status" },
  { key: "notes", label: "Notes" },
  { key: "itemQuantity", label: "Item Quantity" },
  { key: "itemPrice", label: "Item Price" },
  { key: "itemDiscount", label: "Item Discount" },
];

const PAYMENT_FIELDS: DataField[] = [
  { key: "date", label: "Date" },
  { key: "number", label: "Number" },
  { key: "partyName", label: "Contact / Vendor" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
];

const EXPENSE_FIELDS: DataField[] = [
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "vendorName", label: "Vendor Name" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
];

const PROJECT_FIELDS: DataField[] = [
  { key: "name", label: "Project Name" },
  { key: "customerName", label: "Customer Name" },
  { key: "status", label: "Status" },
  { key: "startDate", label: "Start Date" },
  { key: "endDate", label: "End Date" },
  { key: "notes", label: "Notes" },
];

const SERVICE_FIELDS: DataField[] = [
  { key: "serviceName", label: "Service Name" },
  { key: "quantity", label: "Quantity" },
  { key: "rate", label: "Rate" },
  { key: "unitType", label: "Unit Type" },
  { key: "taxable", label: "Taxable" },
  { key: "notes", label: "Notes" },
  { key: "sac", label: "SAC" },
];

const PRODUCT_FIELDS: DataField[] = [
  { key: "parentSku", label: "Parent SKU" },
  { key: "sku", label: "SKU" },
  { key: "productName", label: "Product Name" },
  { key: "attribute1", label: "Attribute 1" },
  { key: "attribute2", label: "Attribute 2" },
  { key: "attribute3", label: "Attribute 3" },
  { key: "buyPrice", label: "Buy Price" },
  { key: "sellPrice", label: "Sell Price" },
  { key: "mrp", label: "MRP" },
  { key: "category", label: "Category" },
  { key: "quantity", label: "Quantity" },
  { key: "unit", label: "Unit" },
  { key: "quantity2", label: "Quantity 2" },
  { key: "unitType2", label: "Unit Type 2" },
  { key: "quantity3", label: "Quantity 3" },
  { key: "unitType3", label: "Unit Type 3" },
  { key: "stock", label: "Stock" },
  { key: "isTaxable", label: "isTaxable" },
  { key: "notes", label: "Notes" },
  { key: "showOnMenu", label: "Show on menu" },
  { key: "hsn", label: "HSN" },
];

const TIMELOG_FIELDS: DataField[] = [
  { key: "date", label: "Date" },
  { key: "projectName", label: "Project Name" },
  { key: "serviceName", label: "Service Name" },
  { key: "hours", label: "Hours" },
  { key: "createdInvoice", label: "Created Invoice" },
  { key: "notes", label: "Notes" },
];

const FIELDS_BY_ID: Record<TransferModuleId, DataField[]> = {
  contacts: CONTACTS_FIELDS,
  invoices: SALES_DOC_FIELDS,
  "sales-receipts": SALES_DOC_FIELDS,
  "proforma-invoices": SALES_DOC_FIELDS,
  estimates: SALES_DOC_FIELDS,
  "delivery-challans": SALES_DOC_FIELDS,
  "credit-notes": SALES_DOC_FIELDS,
  "payment-received": PAYMENT_FIELDS,
  "purchase-orders": PURCHASE_DOC_FIELDS,
  bills: PURCHASE_DOC_FIELDS,
  "debit-notes": PURCHASE_DOC_FIELDS,
  "payment-made": PAYMENT_FIELDS,
  expenses: EXPENSE_FIELDS,
  projects: PROJECT_FIELDS,
  services: SERVICE_FIELDS,
  products: PRODUCT_FIELDS,
  timelogs: TIMELOG_FIELDS,
};

const DOC_TEMPLATE = [
  "Date",
  "Number",
  "Party Name",
  "Currency",
  "Item Name",
  "Item Quantity",
  "Item Price",
  "Notes",
];

export const EXPORT_MODULES: ExportModuleDef[] = EXPORT_MENU_ORDER.map(({ id, label }) => ({
  id,
  label,
  title: `Export ${label === "Time Logs" ? "Timelogs" : label}`,
  fields: FIELDS_BY_ID[id],
}));

export const IMPORT_MODULES: ImportModuleDef[] = IMPORT_MENU_ORDER.map(({ id, label }) => {
  let templateHeaders: string[];
  if (id === "contacts") {
    templateHeaders = [
      "Company Name",
      "First Name",
      "Last Name",
      "Email",
      "Mobile",
      "Tax ID",
      "Billing Street 1",
      "Billing City",
      "Billing Country",
      "Notes",
    ];
  } else if (id === "services") {
    templateHeaders = ["Service Name", "Quantity", "Rate", "Unit Type", "Taxable", "Notes", "SAC"];
  } else if (id === "products") {
    templateHeaders = [
      "SKU",
      "Product Name",
      "Buy Price",
      "Sell Price",
      "Category",
      "Quantity",
      "Unit",
      "Notes",
      "HSN",
    ];
  } else if (id === "projects") {
    templateHeaders = ["Project Name", "Customer Name", "Status", "Start Date", "End Date", "Notes"];
  } else if (id === "expenses") {
    templateHeaders = ["Date", "Category", "Amount", "Currency", "Vendor Name", "Notes"];
  } else if (id === "payment-received" || id === "payment-made") {
    templateHeaders = ["Date", "Number", "Contact / Vendor", "Amount", "Currency", "Payment Method", "Notes"];
  } else {
    templateHeaders = DOC_TEMPLATE;
  }
  return { id, label, title: `Import ${label}`, templateHeaders };
});

export function exportModuleById(id: ExportModuleId): ExportModuleDef {
  const fromMenu = EXPORT_MODULES.find((m) => m.id === id);
  if (fromMenu) return fromMenu;
  const label =
    IMPORT_MENU_ORDER.find((m) => m.id === id)?.label ||
    (id === "timelogs" ? "Time Logs" : id);
  return {
    id,
    label,
    title: `Export ${label === "Time Logs" ? "Timelogs" : label}`,
    fields: FIELDS_BY_ID[id] || CONTACTS_FIELDS,
  };
}

export function importModuleById(id: ImportModuleId): ImportModuleDef {
  return IMPORT_MODULES.find((m) => m.id === id) || IMPORT_MODULES[0];
}
