/**
 * Persist "marked as invoiced" for time logs across API resyncs.
 * Backend TimeLog docs do not yet carry an invoiced flag.
 */

const KEY = "qayd:timelog-invoiced";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function isTimelogInvoiced(key: string | number | null | undefined): boolean {
  if (key == null || key === "") return false;
  return readSet().has(String(key));
}

export function setTimelogInvoiced(key: string | number | null | undefined, value: boolean) {
  if (key == null || key === "") return;
  const set = readSet();
  const k = String(key);
  if (value) set.add(k);
  else set.delete(k);
  writeSet(set);
}
