export class UnitConversionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_DECIMAL"
      | "UNKNOWN_UNIT"
      | "INCOMPATIBLE_DIMENSIONS"
      | "MISSING_INGREDIENT_CONVERSION",
  ) {
    super(message);
    this.name = "UnitConversionError";
  }
}

export type UnitDefinition = {
  code: string;
  dimension: string;
  factorToBase: string;
};

export type IngredientConversionContext = {
  stockUom: string;
  units: UnitDefinition[];
  conversions: Array<{
    altUom: string;
    qtyInStockUom: string;
  }>;
};

const OUTPUT_SCALE = 4;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

export function convertToStockUom(
  quantity: string,
  fromUom: string,
  ingredient: IngredientConversionContext,
): string {
  const qty = parseDecimal(quantity);
  const stockUom = ingredient.stockUom;

  if (fromUom === stockUom) {
    return formatScaled(roundToScale(qty.int, qty.scale, OUTPUT_SCALE), OUTPUT_SCALE);
  }

  const customConversion = ingredient.conversions.find(
    (conversion) => conversion.altUom === fromUom,
  );
  if (customConversion) {
    const qtyInStock = parseDecimal(customConversion.qtyInStockUom);
    return formatScaled(
      multiplyToScale(qty, qtyInStock, OUTPUT_SCALE),
      OUTPUT_SCALE,
    );
  }

  const unitByCode = new Map(ingredient.units.map((unit) => [unit.code, unit]));
  const fromUnit = unitByCode.get(fromUom);
  const toUnit = unitByCode.get(stockUom);
  if (!fromUnit || !toUnit) {
    throw new UnitConversionError(
      `Unknown unit conversion from ${fromUom} to ${stockUom}`,
      "UNKNOWN_UNIT",
    );
  }

  if (fromUnit.dimension !== toUnit.dimension) {
    throw new UnitConversionError(
      `No ingredient conversion from ${fromUom} to ${stockUom}`,
      "MISSING_INGREDIENT_CONVERSION",
    );
  }

  return formatScaled(
    ratioToScale(
      qty,
      parseDecimal(fromUnit.factorToBase),
      parseDecimal(toUnit.factorToBase),
      OUTPUT_SCALE,
    ),
    OUTPUT_SCALE,
  );
}

type ParsedDecimal = {
  int: bigint;
  scale: number;
};

function parseDecimal(value: string): ParsedDecimal {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new UnitConversionError(`Invalid decimal: ${value}`, "INVALID_DECIMAL");
  }
  const [whole, fraction = ""] = value.split(".");
  return {
    int: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function multiplyToScale(
  left: ParsedDecimal,
  right: ParsedDecimal,
  outputScale: number,
): bigint {
  return divideHalfUp(
    left.int * right.int * pow10(outputScale),
    pow10(left.scale + right.scale),
  );
}

function ratioToScale(
  quantity: ParsedDecimal,
  fromFactor: ParsedDecimal,
  toFactor: ParsedDecimal,
  outputScale: number,
): bigint {
  const numerator =
    quantity.int * fromFactor.int * pow10(toFactor.scale + outputScale);
  const denominator = pow10(quantity.scale + fromFactor.scale) * toFactor.int;
  if (denominator === 0n) {
    throw new UnitConversionError("Unit factor cannot be zero", "INVALID_DECIMAL");
  }
  return divideHalfUp(numerator, denominator);
}

function roundToScale(
  value: bigint,
  currentScale: number,
  outputScale: number,
): bigint {
  if (currentScale === outputScale) return value;
  if (currentScale < outputScale) return value * pow10(outputScale - currentScale);
  return divideHalfUp(value, pow10(currentScale - outputScale));
}

function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function formatScaled(value: bigint, scale: number): string {
  const raw = value.toString().padStart(scale + 1, "0");
  const whole = raw.slice(0, -scale);
  const fraction = raw.slice(-scale);
  return `${whole}.${fraction}`;
}
