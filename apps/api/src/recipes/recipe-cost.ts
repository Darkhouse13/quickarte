import {
  convertToStockUom,
  type IngredientConversionContext,
  type UnitDefinition,
  UnitConversionError,
} from "../ingredients/unit-conversion";

export class RecipeCostError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_DECIMAL"
      | "MISSING_YIELD_PERCENT"
      | "INVALID_YIELD_PERCENT"
      | "UNCONVERTIBLE_SUB_RECIPE_UOM"
      | "INVALID_VARIANT_PRICE",
  ) {
    super(message);
    this.name = "RecipeCostError";
  }
}

export type LineCost = {
  cost: string;
  complete: boolean;
};

export type IngredientLineCostInput = {
  quantity: string;
  uom: string;
  quantityIsCooked: boolean;
  yieldPct: string | null;
  ingredient: Omit<IngredientConversionContext, "units"> & {
    currentCostPerUom: string | null;
  };
  units: readonly UnitDefinition[];
};

export type SubRecipeLineCostInput = {
  quantity: string;
  uom: string;
  subRecipe: {
    computedCost: string;
    yieldQty: string;
    yieldUom: string;
    costIsComplete: boolean;
  };
  units: readonly UnitDefinition[];
};

export function calculateIngredientLineCost(
  input: IngredientLineCostInput,
): LineCost {
  const rawQuantity = input.quantityIsCooked
    ? applyYieldToCookedQuantity(input.quantity, input.yieldPct)
    : input.quantity;

  const convertedQuantity = convertToStockUom(rawQuantity, input.uom, {
    stockUom: input.ingredient.stockUom,
    conversions: input.ingredient.conversions,
    units: [...input.units],
  });

  if (input.ingredient.currentCostPerUom === null) {
    return { cost: "0.0000", complete: false };
  }

  return {
    cost: multiplyDecimalStrings(convertedQuantity, input.ingredient.currentCostPerUom),
    complete: true,
  };
}

export function calculateSubRecipeLineCost(
  input: SubRecipeLineCostInput,
): LineCost {
  let convertedQuantity: string;
  try {
    convertedQuantity = convertToStockUom(input.quantity, input.uom, {
      stockUom: input.subRecipe.yieldUom,
      conversions: [],
      units: [...input.units],
    });
  } catch (error) {
    if (error instanceof UnitConversionError) {
      throw new RecipeCostError(
        `Cannot convert ${input.uom} to sub-recipe yield unit ${input.subRecipe.yieldUom}`,
        "UNCONVERTIBLE_SUB_RECIPE_UOM",
      );
    }
    throw error;
  }

  const unitCost = divideDecimalStrings(
    input.subRecipe.computedCost,
    input.subRecipe.yieldQty,
  );
  return {
    cost: multiplyDecimalStrings(unitCost, convertedQuantity),
    complete: input.subRecipe.costIsComplete,
  };
}

export function calculateRecipeTotals(input: {
  lineCosts: LineCost[];
  variantPrice: string | null;
}) {
  const computedCost = input.lineCosts.reduce(
    (sum, line) => addDecimalStrings(sum, line.cost),
    "0.0000",
  );
  const costIsComplete = input.lineCosts.every((line) => line.complete);
  const foodCostPct =
    input.variantPrice !== null && costIsComplete
      ? calculateFoodCostPercent(computedCost, input.variantPrice)
      : null;

  return {
    computedCost,
    costIsComplete,
    foodCostPct,
  };
}

const OUTPUT_SCALE = 4;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

function applyYieldToCookedQuantity(
  cookedQuantity: string,
  yieldPct: string | null,
): string {
  if (yieldPct === null) {
    throw new RecipeCostError(
      "Cooked recipe lines require yield_pct",
      "MISSING_YIELD_PERCENT",
    );
  }
  const pct = parseDecimal(yieldPct);
  if (pct.int <= 0n || compareDecimal(yieldPct, "100") > 0) {
    throw new RecipeCostError("yield_pct must be between 0 and 100", "INVALID_YIELD_PERCENT");
  }
  return formatScaled(
    divideHalfUp(
      parseDecimal(cookedQuantity).int * 100n * pow10(pct.scale + OUTPUT_SCALE),
      pow10(parseDecimal(cookedQuantity).scale) * pct.int,
    ),
    OUTPUT_SCALE,
  );
}

function calculateFoodCostPercent(cost: string, price: string): string | null {
  if (compareDecimal(price, "0") <= 0) {
    throw new RecipeCostError("Variant price must be positive", "INVALID_VARIANT_PRICE");
  }
  return formatScaled(
    divideHalfUp(
      parseDecimal(cost).int * 100n * pow10(parseDecimal(price).scale + OUTPUT_SCALE),
      pow10(parseDecimal(cost).scale) * parseDecimal(price).int,
    ),
    OUTPUT_SCALE,
  );
}

function addDecimalStrings(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale, OUTPUT_SCALE);
  return formatScaled(
    a.int * pow10(scale - a.scale) + b.int * pow10(scale - b.scale),
    scale,
  );
}

function multiplyDecimalStrings(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  return formatScaled(
    divideHalfUp(a.int * b.int * pow10(OUTPUT_SCALE), pow10(a.scale + b.scale)),
    OUTPUT_SCALE,
  );
}

function divideDecimalStrings(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (b.int === 0n) {
    throw new RecipeCostError("Cannot divide by zero", "INVALID_DECIMAL");
  }
  return formatScaled(
    divideHalfUp(a.int * pow10(b.scale + OUTPUT_SCALE), pow10(a.scale) * b.int),
    OUTPUT_SCALE,
  );
}

function compareDecimal(left: string, right: string): number {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const scale = Math.max(a.scale, b.scale);
  const leftInt = a.int * pow10(scale - a.scale);
  const rightInt = b.int * pow10(scale - b.scale);
  return leftInt === rightInt ? 0 : leftInt > rightInt ? 1 : -1;
}

function parseDecimal(value: string) {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new RecipeCostError(`Invalid decimal: ${value}`, "INVALID_DECIMAL");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return {
    int: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
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
