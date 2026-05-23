import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UnitConversionError,
  convertToStockUom,
  type IngredientConversionContext,
} from "./unit-conversion";

const units = [
  { code: "g", dimension: "mass", factorToBase: "1" },
  { code: "kg", dimension: "mass", factorToBase: "1000" },
  { code: "ml", dimension: "volume", factorToBase: "1" },
  { code: "l", dimension: "volume", factorToBase: "1000" },
  { code: "unit", dimension: "count", factorToBase: "1" },
  { code: "dozen", dimension: "count", factorToBase: "12" },
] satisfies IngredientConversionContext["units"];

test("convertToStockUom converts same-dimension units through base factors", () => {
  assert.equal(
    convertToStockUom("1.25", "kg", {
      stockUom: "g",
      units,
      conversions: [],
    }),
    "1250.0000",
  );
});

test("convertToStockUom converts count to ingredient stock mass using a custom conversion", () => {
  assert.equal(
    convertToStockUom("1", "unit", {
      stockUom: "g",
      units,
      conversions: [{ altUom: "unit", qtyInStockUom: "150" }],
    }),
    "150.0000",
  );
});

test("convertToStockUom converts count to ingredient stock volume using a custom conversion", () => {
  assert.equal(
    convertToStockUom("2.5", "unit", {
      stockUom: "ml",
      units,
      conversions: [{ altUom: "unit", qtyInStockUom: "60" }],
    }),
    "150.0000",
  );
});

test("convertToStockUom avoids JavaScript float drift and rounds once to four decimals", () => {
  assert.equal(
    convertToStockUom("0.1", "kg", {
      stockUom: "g",
      units,
      conversions: [],
    }),
    "100.0000",
  );
  assert.equal(
    convertToStockUom("0.1", "unit", {
      stockUom: "g",
      units,
      conversions: [{ altUom: "unit", qtyInStockUom: "3" }],
    }),
    "0.3000",
  );
  assert.notEqual(0.1 * 3, 0.3);
});

test("convertToStockUom throws a typed error for unconvertible unit pairs", () => {
  assert.throws(
    () =>
      convertToStockUom("1", "unit", {
        stockUom: "g",
        units,
        conversions: [],
      }),
    UnitConversionError,
  );
});

test("convertToStockUom rejects malformed decimal quantities", () => {
  assert.throws(
    () =>
      convertToStockUom("1.2.3", "kg", {
        stockUom: "g",
        units,
        conversions: [],
      }),
    UnitConversionError,
  );
});
