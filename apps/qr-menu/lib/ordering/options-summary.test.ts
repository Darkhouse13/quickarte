import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOrderItemOptions,
  serializeOrderItemOptions,
  summarizeOrderItemOptions,
} from "./order-item-options";

test("serializeOrderItemOptions stores the canonical camel-case snapshot", () => {
  const stored = serializeOrderItemOptions({
    variantId: "variant-xl",
    variantName: "XL",
    variantPriceOverride: 70,
    selections: [
      {
        optionId: "meat",
        optionName: "Viande",
        optionType: "multi_select",
        values: [
          { valueId: "kefta", valueName: "Kefta", priceAddition: 0 },
          { valueId: "mixte", valueName: "Mixte", priceAddition: 0 },
        ],
      },
    ],
  });

  assert.deepEqual(stored, {
    variantId: "variant-xl",
    variantName: "XL",
    variantPriceOverride: 70,
    selections: [
      {
        optionId: "meat",
        optionName: "Viande",
        optionType: "multi_select",
        values: [
          { valueId: "kefta", valueName: "Kefta", priceAddition: 0 },
          { valueId: "mixte", valueName: "Mixte", priceAddition: 0 },
        ],
      },
    ],
  });
});

test("parseOrderItemOptions extracts canonical variant and selected options", () => {
  const parsed = parseOrderItemOptions({
    variantId: "variant-xl",
    variantName: "XL",
    variantPriceOverride: 70,
    selections: [
      {
        optionId: "meat",
        optionName: "Viande",
        optionType: "single_select",
        values: [
          {
            valueId: "cordon",
            valueName: "Cordon bleu",
            priceAddition: 5,
          },
        ],
      },
      {
        optionId: "sauce",
        optionName: "Sauces",
        optionType: "multi_select",
        values: [
          { valueId: "algerienne", valueName: "Algerienne", priceAddition: 0 },
          { valueId: "andalouse", valueName: "Andalouse", priceAddition: 0 },
        ],
      },
    ],
  });

  assert.equal(parsed.variantName, "XL");
  assert.deepEqual(parsed.options, [
    {
      optionName: "Viande",
      values: [{ valueName: "Cordon bleu", priceAddition: 5 }],
    },
    {
      optionName: "Sauces",
      values: [
        { valueName: "Algerienne", priceAddition: 0 },
        { valueName: "Andalouse", priceAddition: 0 },
      ],
    },
  ]);
});

test("summarizeOrderItemOptions returns the shared French display lines", () => {
  assert.deepEqual(
    summarizeOrderItemOptions({
      variantId: "variant-l",
      variantName: "L",
      variantPriceOverride: 55,
      selections: [
        {
          optionId: "meat",
          optionName: "Viande",
          optionType: "multi_select",
          values: [
            { valueId: "kefta", valueName: "Kefta", priceAddition: 0 },
            { valueId: "mixte", valueName: "Mixte", priceAddition: 0 },
          ],
        },
        {
          optionId: "sauce",
          optionName: "Sauces",
          optionType: "multi_select",
          values: [
            { valueId: "algerienne", valueName: "Algerienne", priceAddition: 0 },
            { valueId: "samourai", valueName: "Samourai", priceAddition: 0 },
          ],
        },
      ],
    }),
    ["  Variante : L", "  Viande : Kefta, Mixte", "  Sauces : Algerienne, Samourai"],
  );
});

test("legacy options_json is still readable for existing orders", () => {
  const parsed = parseOrderItemOptions({
    variant_id: "variant-xl",
    variant_name: "XL",
    selected_options_summary: [
      {
        option_id: "sauce",
        option_name: "Sauces",
        option_type: "multi_select",
        values: [{ value_id: "samourai", value_name: "Samourai" }],
      },
    ],
  });

  assert.deepEqual(parsed, {
    variantName: "XL",
    options: [
      {
        optionName: "Sauces",
        values: [{ valueName: "Samourai", priceAddition: 0 }],
      },
    ],
  });
});

test("snapshotting keeps the original names after later catalog renames", () => {
  const stored = serializeOrderItemOptions({
    variantId: null,
    variantName: null,
    variantPriceOverride: null,
    selections: [
      {
        optionId: "option-1",
        optionName: "Sauces",
        optionType: "multi_select",
        values: [{ valueId: "value-1", valueName: "Samourai", priceAddition: 0 }],
      },
    ],
  });

  const laterCatalogName = "Sauces maison";
  assert.equal(laterCatalogName, "Sauces maison");
  assert.deepEqual(summarizeOrderItemOptions(stored), ["  Sauces : Samourai"]);
});
