import test from "node:test";
import assert from "node:assert/strict";
import { summarizeOrderItemOptions } from "./order-item-options";
import { validateConfiguredLine, type DbProductForOrder } from "./line-validation";

const productId = "22222222-2222-4222-8222-222222222222";
const variantM = "33333333-3333-4333-8333-333333333331";
const variantL = "33333333-3333-4333-8333-333333333332";
const variantXl = "33333333-3333-4333-8333-333333333333";
const viande = "11111111-1111-4111-8111-111111111111";
const sauces = "11111111-1111-4111-8111-111111111112";
const supplements = "11111111-1111-4111-8111-111111111113";
const poulet = "44444444-4444-4444-8444-444444444441";
const kefta = "44444444-4444-4444-8444-444444444442";
const mixte = "44444444-4444-4444-8444-444444444443";
const algerienne = "55555555-5555-4555-8555-555555555551";
const samourai = "55555555-5555-4555-8555-555555555552";
const harissa = "55555555-5555-4555-8555-555555555553";
const blanche = "55555555-5555-4555-8555-555555555554";
const cheddar = "66666666-6666-4666-8666-666666666661";

function snackAtlasTacos(): DbProductForOrder {
  return {
    id: productId,
    name: "Tacos Atlas",
    price: "45.00",
    available: true,
    variants: [
      {
        id: variantM,
        productId,
        name: "M",
        priceOverride: "45.00",
        isDefault: false,
        available: true,
      },
      {
        id: variantL,
        productId,
        name: "L",
        priceOverride: "55.00",
        isDefault: true,
        available: true,
      },
      {
        id: variantXl,
        productId,
        name: "XL",
        priceOverride: "70.00",
        isDefault: false,
        available: true,
      },
    ],
    options: [
      {
        id: viande,
        productId,
        name: "Viande",
        type: "multi_select",
        required: true,
        minSelect: 1,
        maxSelect: 2,
        available: true,
        values: [
          { id: poulet, optionId: viande, name: "Poulet", priceAddition: "0.00", available: true },
          { id: kefta, optionId: viande, name: "Kefta", priceAddition: "0.00", available: true },
          { id: mixte, optionId: viande, name: "Mixte", priceAddition: "0.00", available: true },
        ],
      },
      {
        id: sauces,
        productId,
        name: "Sauces",
        type: "multi_select",
        required: false,
        minSelect: 0,
        maxSelect: 3,
        available: true,
        values: [
          { id: algerienne, optionId: sauces, name: "Algerienne", priceAddition: "0.00", available: true },
          { id: samourai, optionId: sauces, name: "Samourai", priceAddition: "0.00", available: true },
          { id: harissa, optionId: sauces, name: "Harissa", priceAddition: "0.00", available: true },
          { id: blanche, optionId: sauces, name: "Blanche", priceAddition: "0.00", available: true },
        ],
      },
      {
        id: supplements,
        productId,
        name: "Supplements",
        type: "multi_select",
        required: false,
        minSelect: 0,
        maxSelect: null,
        available: true,
        values: [
          { id: cheddar, optionId: supplements, name: "Cheddar", priceAddition: "6.00", available: true },
        ],
      },
    ],
  };
}

test("placeOrder validation rejects a missing required option with a typed code", () => {
  const result = validateConfiguredLine(
    {
      product_id: productId,
      quantity: 1,
      variant_id: variantL,
      selected_option_value_ids: [],
      unit_price: 1,
    },
    snackAtlasTacos(),
  );

  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.code, "OPTION_REQUIRED_MISSING");
    assert.match(result.message, /viande/i);
  }
});

test("placeOrder validation rejects multi-select choices above max_select", () => {
  const result = validateConfiguredLine(
    {
      product_id: productId,
      quantity: 1,
      variant_id: variantL,
      selected_option_value_ids: [kefta, mixte, algerienne, samourai, harissa, blanche],
      unit_price: 55,
    },
    snackAtlasTacos(),
  );

  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.statusCode, 422);
    assert.equal(result.code, "OPTION_MAX_EXCEEDED");
  }
});

test("placeOrder validation rejects a variant from another product", () => {
  const result = validateConfiguredLine(
    {
      product_id: productId,
      quantity: 1,
      variant_id: "99999999-9999-4999-8999-999999999999",
      selected_option_value_ids: [kefta],
      unit_price: 55,
    },
    snackAtlasTacos(),
  );

  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.code, "VARIANT_INVALID");
  }
});

test("placeOrder recomputes seeded Snack Atlas tacos price and ignores client unit_price", () => {
  const result = validateConfiguredLine(
    {
      product_id: productId,
      quantity: 1,
      variant_id: variantL,
      selected_option_value_ids: [kefta, mixte, algerienne, samourai],
      unit_price: 1,
    },
    snackAtlasTacos(),
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.line.unitPrice, 55);
    assert.equal(result.line.subtotal, 55);
    assert.deepEqual(summarizeOrderItemOptions(result.line.optionsJson), [
      "  Variante : L",
      "  Viande : Kefta, Mixte",
      "  Sauces : Algerienne, Samourai",
    ]);
    assert.deepEqual(result.line.optionsJson?.selections[0], {
      optionId: viande,
      optionName: "Viande",
      optionType: "multi_select",
      values: [
        { valueId: kefta, valueName: "Kefta", priceAddition: 0 },
        { valueId: mixte, valueName: "Mixte", priceAddition: 0 },
      ],
    });
  }
});

test("placeOrder rejects a recomputed negative unit price", () => {
  const product = snackAtlasTacos();
  product.options[2]!.values[0]!.priceAddition = "-80.00";

  const result = validateConfiguredLine(
    {
      product_id: productId,
      quantity: 1,
      variant_id: variantM,
      selected_option_value_ids: [kefta, cheddar],
      unit_price: 1,
    },
    product,
  );

  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.code, "PRICE_RESOLVED_NEGATIVE");
  }
});

test("QR order validation still accepts products with no real variant rows", () => {
  const result = validateConfiguredLine(
    {
      product_id: productId,
      quantity: 2,
      variant_id: null,
      selected_option_value_ids: [],
      unit_price: 1,
    },
    {
      id: productId,
      name: "Eau minérale",
      price: "12.50",
      available: true,
      variants: [],
      options: [],
    },
  );

  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.line.unitPrice, 12.5);
    assert.equal(result.line.subtotal, 25);
    assert.equal(result.line.optionsJson, null);
  }
});

test.skip("placeOrder writes canonical options_json in Postgres; requires live DATABASE_URL");
test.skip("transitionOrderStatus rejects when caller does not own the order business; requires live DATABASE_URL");
test.skip("getOrdersByBusinessId scopes order list to the caller business; requires live DATABASE_URL");
