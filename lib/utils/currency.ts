const eurFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurFormatterCompact = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function toNumber(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export function formatEUR(value: number | string): string {
  return eurFormatter.format(toNumber(value));
}

export function formatEURCompact(value: number | string): string {
  return eurFormatterCompact.format(toNumber(value));
}

const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatterCompact = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatAmount(value: number | string): string {
  return decimalFormatter.format(toNumber(value));
}

export function formatAmountCompact(value: number | string): string {
  return decimalFormatterCompact.format(toNumber(value));
}

export const CURRENCY_SYMBOL = "\u20AC";
