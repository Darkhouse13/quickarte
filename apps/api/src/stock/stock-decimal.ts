export class StockDecimalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockDecimalError";
  }
}

const OUTPUT_SCALE = 4;
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const POSITIVE_DECIMAL_PATTERN = /^(?!0+(?:\.0+)?$)\d+(?:\.\d+)?$/;

export function addDecimalStrings(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale, OUTPUT_SCALE);
  return formatScaled(
    a.int * pow10(scale - a.scale) + b.int * pow10(scale - b.scale),
    scale,
  );
}

export function negateDecimalString(value: string): string {
  const parsed = parseDecimal(value);
  return formatScaled(roundToScale(-parsed.int, parsed.scale, OUTPUT_SCALE), OUTPUT_SCALE);
}

export function multiplyDecimalStrings(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  return formatScaled(
    divideHalfAwayFromZero(a.int * b.int * pow10(OUTPUT_SCALE), pow10(a.scale + b.scale)),
    OUTPUT_SCALE,
  );
}

export function divideDecimalStrings(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (b.int === 0n) throw new StockDecimalError("Cannot divide by zero");
  return formatScaled(
    divideHalfAwayFromZero(a.int * pow10(b.scale + OUTPUT_SCALE), pow10(a.scale) * b.int),
    OUTPUT_SCALE,
  );
}

export function compareDecimal(left: string, right: string): number {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale);
  const leftInt = a.int * pow10(scale - a.scale);
  const rightInt = b.int * pow10(scale - b.scale);
  return leftInt === rightInt ? 0 : leftInt > rightInt ? 1 : -1;
}

export function normalizeDecimal(value: string): string {
  const parsed = parseDecimal(value);
  return formatScaled(roundToScale(parsed.int, parsed.scale, OUTPUT_SCALE), OUTPUT_SCALE);
}

export function assertPositiveDecimal(value: string): string {
  if (!POSITIVE_DECIMAL_PATTERN.test(value)) {
    throw new StockDecimalError(`Expected a positive decimal: ${value}`);
  }
  return normalizeDecimal(value);
}

export function applyYieldToCookedQuantity(
  cookedQuantity: string,
  yieldPct: string | null,
): string {
  if (yieldPct === null) {
    throw new StockDecimalError("Cooked recipe lines require yield_pct");
  }
  if (compareDecimal(yieldPct, "0") <= 0 || compareDecimal(yieldPct, "100") > 0) {
    throw new StockDecimalError("yield_pct must be between 0 and 100");
  }
  return divideDecimalStrings(multiplyDecimalStrings(cookedQuantity, "100"), yieldPct);
}

function parseDecimal(value: string) {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new StockDecimalError(`Invalid decimal: ${value}`);
  }
  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  return {
    int: sign * BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function roundToScale(value: bigint, currentScale: number, outputScale: number): bigint {
  if (currentScale === outputScale) return value;
  if (currentScale < outputScale) return value * pow10(outputScale - currentScale);
  return divideHalfAwayFromZero(value, pow10(currentScale - outputScale));
}

function divideHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new StockDecimalError("Cannot divide by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = (absNumerator + absDenominator / 2n) / absDenominator;
  return negative ? -quotient : quotient;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function formatScaled(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const raw = abs.toString().padStart(scale + 1, "0");
  const whole = raw.slice(0, -scale);
  const fraction = raw.slice(-scale);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}
