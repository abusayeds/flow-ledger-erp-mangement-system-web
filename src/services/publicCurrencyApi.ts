export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
  name: string;
}

const FALLBACK_CURRENCIES: CurrencyOption[] = [
  { code: "USD", name: "United States Dollar", symbol: "$", label: "USD - United States Dollar ($)" },
  { code: "EUR", name: "Euro", symbol: "EUR", label: "EUR - Euro" },
  { code: "GBP", name: "British Pound Sterling", symbol: "GBP", label: "GBP - British Pound Sterling" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "Tk", label: "BDT - Bangladeshi Taka (Tk)" },
  { code: "INR", name: "Indian Rupee", symbol: "Rs", label: "INR - Indian Rupee (Rs)" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", label: "AED - UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", label: "SAR - Saudi Riyal" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", label: "CAD - Canadian Dollar (C$)" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", label: "AUD - Australian Dollar (A$)" },
  { code: "JPY", name: "Japanese Yen", symbol: "JPY", label: "JPY - Japanese Yen" },
];

type RestCountriesCurrencyMap = Record<string, { name?: string; symbol?: string }>;
type RestCountriesRow = { currencies?: RestCountriesCurrencyMap };

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";

export async function fetchPublicCurrencies(): Promise<CurrencyOption[]> {
  try {
    const res = await fetch("https://restcountries.com/v3.1/all?fields=currencies");
    if (!res.ok) throw new Error("Could not load currencies");
    const rows = (await res.json()) as RestCountriesRow[];
    const byCode = new Map<string, CurrencyOption>();

    rows.forEach((row) => {
      const entries = Object.entries(row.currencies ?? {});
      entries.forEach(([code, meta]) => {
        const cleanCode = text(code).toUpperCase();
        if (!cleanCode || byCode.has(cleanCode)) return;
        const name = text(meta?.name) || cleanCode;
        const symbol = text(meta?.symbol);
        byCode.set(cleanCode, {
          code: cleanCode,
          name,
          symbol,
          label: symbol ? `${cleanCode} - ${name} (${symbol})` : `${cleanCode} - ${name}`,
        });
      });
    });

    const result = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
    return result.length > 0 ? result : FALLBACK_CURRENCIES;
  } catch {
    return FALLBACK_CURRENCIES;
  }
}
