import type { BarcodeConfig } from "./types";
import { DEFAULT_BARCODE_CONFIG } from "./types";

const CONFIG_KEY = "idimitr-barcode-config";
const QUEUE_KEY = "idimitr-barcode-import-queue";

export function loadBarcodeConfig(): BarcodeConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_BARCODE_CONFIG };
    return { ...DEFAULT_BARCODE_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BARCODE_CONFIG };
  }
}

export function saveBarcodeConfig(config: BarcodeConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function pushImportQueue(items: unknown[]): void {
  if (!items.length) return;
  try {
    const prev = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]");
    const next = Array.isArray(prev) ? [...prev, ...items] : items;
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  }
}

export function consumeImportQueue<T>(): T[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    sessionStorage.removeItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    sessionStorage.removeItem(QUEUE_KEY);
    return [];
  }
}
