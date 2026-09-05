// Phase 17 — Multi-currency formatting.
// Currency is hydrated from settings on app load (see _authenticated.tsx).
// Backwards-compatible: formatKS still exists and now uses the active currency.

const KEY = "mycase.currency";
let _currency: string = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "KS";
const listeners = new Set<() => void>();

export const getCurrency = () => _currency;
export const setCurrency = (c: string) => {
  if (!c || c === _currency) return;
  _currency = c;
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
};
export const onCurrencyChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const formatMoney = (n: number | null | undefined, currency?: string) => {
  const v = Number(n ?? 0);
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency ?? _currency}`;
};

// Kept for backwards compatibility — now respects active currency.
export const formatKS = (n: number | null | undefined) => formatMoney(n);

export const formatDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
