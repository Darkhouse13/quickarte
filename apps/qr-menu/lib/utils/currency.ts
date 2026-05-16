const DEFAULT_LOCALE = "fr-MA";
const DEFAULT_CURRENCY = "MAD";

function makeCurrencyFormatter(
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): Intl.NumberFormat {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

const amountFormatter = makeCurrencyFormatter(2, 2);

const amountFormatterCompactInteger = makeCurrencyFormatter(0, 0);
const amountFormatterCompactDecimal = makeCurrencyFormatter(2, 2);

const decimalFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimalFormatterCompactInteger = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormatterCompactDecimal = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyCodePattern = new RegExp(`\\b${DEFAULT_CURRENCY}\\b`, "g");

function formatWithCurrencyCode(
  formatter: Intl.NumberFormat,
  fallbackFormatter: Intl.NumberFormat,
  value: number,
): string {
  const formatted = formatter.format(value);
  const amount = formatted
    .replace(currencyCodePattern, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${amount || fallbackFormatter.format(value)} ${DEFAULT_CURRENCY}`;
}

function isRoundAmount(value: number): boolean {
  return Math.abs(value - Math.round(value)) < Number.EPSILON;
}

function toNumber(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export function formatAmount(value: number | string): string {
  const valueAsNumber = toNumber(value);
  return formatWithCurrencyCode(amountFormatter, decimalFormatter, valueAsNumber);
}

export function formatAmountCompact(value: number | string): string {
  const valueAsNumber = toNumber(value);
  return isRoundAmount(valueAsNumber)
    ? formatWithCurrencyCode(
        amountFormatterCompactInteger,
        decimalFormatterCompactInteger,
        valueAsNumber,
      )
    : formatWithCurrencyCode(
        amountFormatterCompactDecimal,
        decimalFormatterCompactDecimal,
        valueAsNumber,
      );
}

export const CURRENCY_SYMBOL = DEFAULT_CURRENCY;
