const fs = require("fs");

function stripCustomerFilterComponent(s) {
  return s.replace(
    /\nconst CustomerFilter: React\.FC<\{[\s\S]*?\n\};\n\n(?=export const)/,
    "\n",
  );
}

function migrateLocalPage(f, opts = {}) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  s = stripCustomerFilterComponent(s);

  if (!s.includes("PartyFilterPopover")) {
    // add import after ListFilterDropdown or first ui import
    if (s.includes('from "@/components/ui/ListFilterDropdown"')) {
      s = s.replace(
        /import \{ ListFilterDropdown as Dropdown \} from "@\/components\/ui\/ListFilterDropdown";/,
        `import { ListFilterDropdown as Dropdown } from "@/components/ui/ListFilterDropdown";\nimport { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";`,
      );
    } else if (s.includes('from "@/components/ui/ListSidebarFooter"')) {
      s = s.replace(
        /import \{ ListSidebarFooter[^;]+;/,
        (m) => `${m}\nimport { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";`,
      );
    } else {
      s = s.replace(
        /(import React[^\n]+\n)/,
        `$1import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";\n`,
      );
    }
  } else if (!s.includes("partyFilterParam")) {
    s = s.replace(
      /import \{ PartyFilterPopover([^}]*)\} from "@\/components\/ui\/PartyFilterPopover";/,
      'import { PartyFilterPopover, partyFilterParam } from "@/components/ui/PartyFilterPopover";',
    );
  }

  s = s.replace(
    /const \[customerFilter, setCustomerFilter\] = useState<string \| null>\(null\);/g,
    "const [customerFilter, setCustomerFilter] = useState<string[]>([]);\n  const [customerFilterLabels, setCustomerFilterLabels] = useState<string[]>([]);",
  );
  s = s.replace(/customer_id: customerFilter \|\| undefined/g, "customer_id: partyFilterParam(customerFilter)");
  s = s.replace(/!!customerFilter/g, "customerFilter.length > 0");
  // bare customerFilter in conditions like && customerFilter) or || customerFilter)
  s = s.replace(/\|\| customerFilter\)/g, "|| customerFilter.length > 0)");
  s = s.replace(/&& customerFilter\)/g, "&& customerFilter.length > 0)");
  s = s.replace(/&& !customerFilter\)/g, "&& !customerFilter.length)");
  s = s.replace(/!customerFilter &&/g, "!customerFilter.length &&");

  s = s.replace(
    /<CustomerFilter applied=\{customerFilter\} onApply=\{setCustomerFilter\} \/>/g,
    `<PartyFilterPopover
            kind="customer"
            appliedIds={customerFilter}
            appliedLabels={customerFilterLabels}
            onApply={(ids, labels) => {
              setCustomerFilter(ids);
              setCustomerFilterLabels(labels);
            }}
          />`,
  );

  if (s !== orig) {
    fs.writeFileSync(f, s);
    console.log("updated", f);
  } else console.log("NO CHANGE", f);
}

[
  "src/pages/sales/Estimates.tsx",
  "src/pages/sales/SalesReceipts.tsx",
  "src/pages/sales/Deliverychallan .tsx",
  "src/pages/sales/Proformainvoices.tsx",
].forEach((f) => migrateLocalPage(f));

// Fix TimeLogs local filter
{
  const f = "src/pages/TimeLogs.tsx";
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(
    /const filteredCustomerLocalId = customerFilter\s*\? dbCustomers\.find\(\(c\) => String\(c\._id\) === customerFilter\)\?\.id\s*: null;\s*let list = logs\.filter\(\(l\) => \{\s*if \(statusFilter === "Invoiced" && !l\.invoiced\) return false;\s*if \(statusFilter === "Not Invoiced" && l\.invoiced\) return false;\s*if \(customerFilter\) \{\s*const matchLocal = filteredCustomerLocalId != null && l\.customerId === filteredCustomerLocalId;\s*const matchDirect = String\(l\.customerId \|\| ""\) === customerFilter;\s*if \(!matchLocal && !matchDirect\) return false;\s*\}/s,
    `const selectedCustomerKeys = new Set(customerFilter.map(String));
    const selectedLocalIds = new Set(
      dbCustomers
        .filter((c) => selectedCustomerKeys.has(String(c._id)))
        .map((c) => c.id),
    );
    let list = logs.filter((l) => {
      if (statusFilter === "Invoiced" && !l.invoiced) return false;
      if (statusFilter === "Not Invoiced" && l.invoiced) return false;
      if (customerFilter.length) {
        const matchLocal = selectedLocalIds.has(l.customerId as any);
        const matchDirect = selectedCustomerKeys.has(String(l.customerId || ""));
        if (!matchLocal && !matchDirect) return false;
      }`,
  );
  fs.writeFileSync(f, s);
  console.log("fixed TimeLogs filter");
}

// Fix PurchaseOrders vendor local id
{
  const f = "src/pages/purchase/PurchaseOrders.tsx";
  let s = fs.readFileSync(f, "utf8");
  s = s.replace(
    /if \(!vendorFilter\) return null;\s*const ven = dbVendors\.find\(\(v\) => String\(v\._id\) === vendorFilter\);/g,
    `if (!vendorFilter.length) return null;\n    const ven = dbVendors.find((v) => vendorFilter.includes(String(v._id)));`,
  );
  // also check how vendor filter is used in filtered list
  fs.writeFileSync(f, s);
  console.log("fixed PurchaseOrders vendor");
}
