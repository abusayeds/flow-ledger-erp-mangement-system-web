/**
 * Canonical date helpers for form ↔ API.
 * Stored / submitted value is always `yyyy-MM-dd` (or empty string).
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function toIsoDate(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  if (isIsoDate(raw.slice(0, 10))) return raw.slice(0, 10);

  // Already ISO datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const slice = raw.slice(0, 10);
    return isIsoDate(slice) ? slice : "";
  }

  // yyyy/MM/dd or yyyy.MM.dd
  let m = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (m) {
    const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : "";
  }

  // MM/dd/yyyy or MM-dd-yyyy
  m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : "";
  }

  // dd/MM/yyyy (European) — only when day > 12 so it's unambiguous
  m = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day > 12 && month <= 12) {
      const iso = `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return isIsoDate(iso) ? iso : "";
    }
  }

  // "Sep 18, 2026" / "September 18, 2026"
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : "";
  }

  return "";
}

export function isoToLocalDate(iso: string): Date | null {
  if (!isIsoDate(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return localDateToIso(new Date());
}
