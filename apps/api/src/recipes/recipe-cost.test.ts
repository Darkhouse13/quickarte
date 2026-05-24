import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RecipeCostError,
  calculateIngredientLineCost,
  calculateRecipeTotals,
  calculateSubRecipeLineCost,
} from "./recipe-cost";

const units = [
  { code: "g", dimension: "mass", factorToBase: "1" },
  { code: "kg", dimension: "mass", factorToBase: "1000" },
  { code: "ml", dimension: "volume", factorToBase: "1" },
  { code: "l", dimension: "volume", factorToBase: "1000" },
  { code: "unit", dimension: "count", factorToBase: "1" },
] as const;

test("ingredient line cost converts quantity into stock UOM and multiplies by ingredient cost", () => {
  const result = calculateIngredientLineCost({
    quantity: "0.2500",
    uom: "kg",
    quantityIsCooked: false,
    yieldPct: null,
    ingredient: {
      stockUom: "g",
      currentCostPerUom: "0.0200",
      conversions: [],
    },
    units,
  });

  assert.deepEqual(result, { cost: "5.0000", complete: true });
});

test("ingredient line cost adjusts cooked quantity through yield percentage without float drift", () => {
  const result = calculateIngredientLineCost({
    quantity: "100.0000",
    uom: "g",
    quantityIsCooked: true,
    yieldPct: "80.0000",
    ingredient: {
      stockUom: "g",
      currentCostPerUom: "0.0300",
      conversions: [],
    },
    units,
  });

  assert.deepEqual(result, { cost: "3.7500", complete: true });
});

test("ingredient line with unknown cost contributes zero and marks the recipe incomplete", () => {
  const result = calculateIngredientLineCost({
    quantity: "1.0000",
    uom: "kg",
    quantityIsCooked: false,
    yieldPct: null,
    ingredient: {
      stockUom: "kg",
      currentCostPerUom: null,
      conversions: [],
    },
    units,
  });

  assert.deepEqual(result, { cost: "0.0000", complete: false });
});

test("sub-recipe line cost uses unit cost from yield and same-dimension conversion", () => {
  const result = calculateSubRecipeLineCost({
    quantity: "100.0000",
    uom: "g",
    subRecipe: {
      computedCost: "20.0000",
      yieldQty: "500.0000",
      yieldUom: "g",
      costIsComplete: true,
    },
    units,
  });

  assert.deepEqual(result, { cost: "4.0000", complete: true });
});

test("sub-recipe line rejects incompatible yield units", () => {
  assert.throws(
    () =>
      calculateSubRecipeLineCost({
        quantity: "1.0000",
        uom: "unit",
        subRecipe: {
          computedCost: "20.0000",
          yieldQty: "500.0000",
          yieldUom: "g",
          costIsComplete: true,
        },
        units,
      }),
    RecipeCostError,
  );
});

test("recipe totals sum exact decimal costs and compute variant food cost percentage", () => {
  const totals = calculateRecipeTotals({
    lineCosts: [
      { cost: "5.0000", complete: true },
      { cost: "4.0000", complete: true },
    ],
    variantPrice: "45.00",
  });

  assert.deepEqual(totals, {
    computedCost: "9.0000",
    costIsComplete: true,
    foodCostPct: "20.0000",
  });
});

test("recipe totals keep food cost percentage null for sub-recipes", () => {
  const totals = calculateRecipeTotals({
    lineCosts: [{ cost: "7.5000", complete: true }],
    variantPrice: null,
  });

  assert.deepEqual(totals, {
    computedCost: "7.5000",
    costIsComplete: true,
    foodCostPct: null,
  });
});
