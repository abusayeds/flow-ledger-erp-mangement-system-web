export type BarcodeRow = {
  id: string;
  productId?: string;
  itemName: string;
  sku: string;
  labels: number;
  header: string;
  line1: string;
  line2: string;
  currency?: string;
};

export type BarcodeConfig = {
  printMode: "Normal" | "Thermal";
  boxHeight: number;
  boxWidth: number;
  barHeight: number;
  barWidth: string;
  barcodeType: string;
  text: "Show" | "Hide";
  textAlignment: "Left" | "Center" | "Right";
  barcodeAlignment: "Left" | "Center" | "Right";
  fontSize: "Small" | "Medium" | "Large";
  paperSize: "A4 Paper" | "Letter" | "Thermal Roll";
};

export const DEFAULT_BARCODE_CONFIG: BarcodeConfig = {
  printMode: "Normal",
  boxHeight: 140,
  boxWidth: 90,
  barHeight: 140,
  barWidth: "2 mm",
  barcodeType: "CODE128",
  text: "Show",
  textAlignment: "Center",
  barcodeAlignment: "Center",
  fontSize: "Medium",
  paperSize: "A4 Paper",
};

export type LibraryImportItem = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  currency: string;
  header?: string;
  line1?: string;
  line2?: string;
};

export function formatMoney(amount: number | string, currency = "BDT"): string {
  const n = typeof amount === "number" ? amount : Number(amount) || 0;
  const fixed = n.toFixed(2);
  if (currency.toUpperCase() === "BDT") return `৳${fixed}`;
  return `${fixed} ${currency}`;
}

export function newRowId(): string {
  return `bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function rowFromImport(item: LibraryImportItem): BarcodeRow {
  const price = formatMoney(item.price, item.currency);
  return {
    id: newRowId(),
    productId: item.productId,
    itemName: item.name,
    sku: item.sku || "—",
    labels: Math.max(1, item.quantity || 1),
    header: item.header ?? item.name,
    line1: item.line1 ?? price,
    line2: item.line2 ?? "",
    currency: item.currency,
  };
}
