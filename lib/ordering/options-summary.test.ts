import assert from "node:assert/strict";
import test from "node:test";
import { parseOrderItemOptions } from "./options-summary";

test("parseOrderItemOptions extracts variant and selected options", () => {
  const parsed = parseOrderItemOptions({
    variant_id: "variant-xl",
    variant_name: "XL",
    selected_options_summary: [
      {
        option_id: "meat",
        option_name: "Viande",
        option_type: "single_select",
        values: [
          {
            value_id: "cordon",
            value_name: "Cordon bleu",
            price_addition: 5,
          },
        ],
      },
      {
        option_id: "sauce",
        option_name: "Sauces",
        option_type: "multi_select",
        values: [
          { value_id: "algerienne", value_name: "Algerienne", price_addition: 0 },
          { value_id: "andalouse", value_name: "Andalouse", price_addition: 0 },
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

test("parseOrderItemOptions treats plain orders as empty configuration", () => {
  assert.deepEqual(parseOrderItemOptions(null), {
    variantName: null,
    options: [],
  });
});

test("parseOrderItemOptions ignores malformed option payload fragments", () => {
  const parsed = parseOrderItemOptions({
    variant_name: "M",
    selected_options_summary: [
      null,
      { option_name: "Sauces", values: [{ value_name: "Samourai" }] },
      { option_name: "Vide", values: [] },
    ],
  });

  assert.deepEqual(parsed, {
    variantName: "M",
    options: [
      {
        optionName: "Sauces",
        values: [{ valueName: "Samourai", priceAddition: 0 }],
      },
    ],
  });
});
