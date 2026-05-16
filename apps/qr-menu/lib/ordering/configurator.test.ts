import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderItemOptions,
  computeConfiguratorTotal,
  hasUnorderableRequiredOption,
  isConfiguratorValid,
  isOptionSatisfied,
  isValueDisabledByCap,
  optionValidationHint,
} from "./configurator";
import { summarizeOrderItemOptions } from "./order-item-options";
import type {
  MenuItemOption,
  MenuItemOptionValue,
  MenuItemVariant,
} from "../catalog/fixtures";

// Mirrors the seeded Snack Atlas "Tacos Atlas": base 45 MAD, sizes M/L/XL,
// required Viande (1–2), optional Sauces (≤3), uncapped Supplements.

function variant(
  id: string,
  name: string,
  priceOverride: number | null,
  isDefault = false,
): MenuItemVariant {
  return {
    id,
    name,
    priceOverride,
    isDefault,
    available: true,
    optionMaxSelectionsOverrides: {},
  };
}

function val(
  id: string,
  name: string,
  priceAddition = 0,
  available = true,
): MenuItemOptionValue {
  return { id, name, priceAddition, available };
}

const variantL = variant("var-l", "L", 55, true);

const viande: MenuItemOption = {
  id: "viande",
  name: "Viande",
  type: "multi_select",
  required: true,
  minSelect: 1,
  maxSelect: 2,
  maxSelections: 2,
  available: true,
  values: [val("poulet", "Poulet"), val("kefta", "Kefta"), val("mixte", "Mixte")],
};

const sauces: MenuItemOption = {
  id: "sauces",
  name: "Sauces",
  type: "multi_select",
  required: false,
  minSelect: 0,
  maxSelect: 3,
  maxSelections: 3,
  available: true,
  values: [
    val("alg", "Algerienne"),
    val("sam", "Samourai"),
    val("har", "Harissa"),
    val("bla", "Blanche"),
  ],
};

const supplements: MenuItemOption = {
  id: "supp",
  name: "Supplements",
  type: "multi_select",
  required: false,
  minSelect: 0,
  maxSelect: null,
  maxSelections: null,
  available: true,
  values: [val("cheddar", "Cheddar", 6)],
};

const cuisson: MenuItemOption = {
  id: "cuisson",
  name: "Cuisson",
  type: "single_select",
  required: true,
  maxSelections: null,
  available: true,
  values: [val("saignant", "Saignant"), val("apoint", "À point")],
};

// --- total computation ---

test("computeConfiguratorTotal: seeded L tacos with two meats and two free sauces totals 55 MAD", () => {
  const total = computeConfiguratorTotal(
    55,
    45,
    [
      { priceAddition: 0 },
      { priceAddition: 0 },
      { priceAddition: 0 },
      { priceAddition: 0 },
    ],
    1,
  );
  assert.equal(total, 55);
});

test("computeConfiguratorTotal: paid supplements and quantity both apply", () => {
  // M base 45 + Cheddar 6 + Oeuf 5 = 56, ×2 = 112
  assert.equal(
    computeConfiguratorTotal(45, 45, [{ priceAddition: 6 }, { priceAddition: 5 }], 2),
    112,
  );
});

test("computeConfiguratorTotal: a null variant override falls back to the base price", () => {
  assert.equal(computeConfiguratorTotal(null, 45, [], 3), 135);
});

// --- validity ---

test("isConfiguratorValid: a required single_select with nothing chosen is invalid", () => {
  assert.equal(isConfiguratorValid([cuisson], {}, variantL), false);
});

test("isConfiguratorValid: a required multi_select below its min is invalid", () => {
  assert.equal(isConfiguratorValid([viande], {}, variantL), false);
});

test("isConfiguratorValid: selections within bounds are valid", () => {
  assert.equal(
    isConfiguratorValid(
      [viande, sauces],
      { viande: ["kefta", "mixte"], sauces: ["alg", "sam"] },
      variantL,
    ),
    true,
  );
});

test("isConfiguratorValid: an optional multi_select with no min and no selection is valid", () => {
  assert.equal(isConfiguratorValid([sauces, supplements], {}, variantL), true);
});

test("isOptionSatisfied: a count above the effective max can never pass — the cap prevents reaching it", () => {
  assert.equal(isOptionSatisfied(viande, 3, variantL), false);
});

// --- inline hints ---

test("optionValidationHint: a required group with nothing chosen reads 'Veuillez choisir.'", () => {
  assert.equal(optionValidationHint(viande, 0), "Veuillez choisir.");
  assert.equal(optionValidationHint(cuisson, 0), "Veuillez choisir.");
});

test("optionValidationHint: a multi_select below a min above one names the min", () => {
  const minTwo: MenuItemOption = { ...viande, minSelect: 2 };
  assert.equal(optionValidationHint(minTwo, 1), "Choisissez au moins 2.");
});

test("optionValidationHint: a satisfied group has no hint", () => {
  assert.equal(optionValidationHint(viande, 1), null);
  assert.equal(optionValidationHint(sauces, 0), null);
});

// --- multi-select cap helper ---

test("isValueDisabledByCap: an unchecked value is disabled once the cap is hit", () => {
  assert.equal(
    isValueDisabledByCap(viande, ["poulet", "kefta"], "mixte", variantL),
    true,
  );
});

test("isValueDisabledByCap: an already-checked value is never disabled by the cap", () => {
  assert.equal(
    isValueDisabledByCap(viande, ["poulet", "kefta"], "kefta", variantL),
    false,
  );
});

test("isValueDisabledByCap: below the cap, nothing is disabled", () => {
  assert.equal(isValueDisabledByCap(viande, ["poulet"], "mixte", variantL), false);
});

test("isValueDisabledByCap: single_select rows are never cap-disabled", () => {
  assert.equal(
    isValueDisabledByCap(cuisson, ["saignant"], "apoint", variantL),
    false,
  );
});

test("isValueDisabledByCap: a variant max override raises the cap", () => {
  const wide: MenuItemVariant = {
    ...variantL,
    optionMaxSelectionsOverrides: { viande: 3 },
  };
  assert.equal(
    isValueDisabledByCap(viande, ["poulet", "kefta"], "mixte", wide),
    false,
  );
});

test("isValueDisabledByCap: an uncapped multi_select never disables a value", () => {
  assert.equal(
    isValueDisabledByCap(supplements, ["cheddar"], "oeuf", variantL),
    false,
  );
});

// --- unorderable required option ---

test("hasUnorderableRequiredOption: a required option whose values are all unavailable is unorderable", () => {
  const dead: MenuItemOption = {
    ...viande,
    values: viande.values.map((v) => ({ ...v, available: false })),
  };
  assert.equal(hasUnorderableRequiredOption([dead, sauces]), true);
});

test("hasUnorderableRequiredOption: a required option with at least one available value is orderable", () => {
  assert.equal(hasUnorderableRequiredOption([viande, sauces]), false);
});

test("hasUnorderableRequiredOption: an optional option with no available values is not blocking", () => {
  const deadOptional: MenuItemOption = {
    ...sauces,
    values: sauces.values.map((v) => ({ ...v, available: false })),
  };
  assert.equal(hasUnorderableRequiredOption([deadOptional]), false);
});

// --- canonical OrderItemOptions payload ---

test("buildOrderItemOptions: builds the canonical snapshot the Step 7 server expects", () => {
  const snapshot = buildOrderItemOptions(variantL, [viande, sauces, supplements], {
    viande: ["kefta", "mixte"],
    sauces: ["alg", "sam"],
  });

  assert.equal(snapshot.variantId, "var-l");
  assert.equal(snapshot.variantName, "L");
  assert.equal(snapshot.variantPriceOverride, 55);
  assert.deepEqual(summarizeOrderItemOptions(snapshot), [
    "  Variante : L",
    "  Viande : Kefta, Mixte",
    "  Sauces : Algerienne, Samourai",
  ]);
});

test("buildOrderItemOptions: omits the variant for products without a size choice", () => {
  const snapshot = buildOrderItemOptions(null, [viande], { viande: ["kefta"] });

  assert.equal(snapshot.variantId, null);
  assert.equal(snapshot.variantName, null);
  assert.equal(snapshot.variantPriceOverride, null);
  assert.equal(snapshot.selections.length, 1);
});
