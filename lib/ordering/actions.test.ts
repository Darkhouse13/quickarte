import test from "node:test";
import assert from "node:assert/strict";
import { validateConfiguredLine, type DbProductForOrder } from "./line-validation";

test("placeOrder validation rejects selections above variant-effective max", () => {
  const product: DbProductForOrder = {
    id: "22222222-2222-4222-8222-222222222222",
    price: "40.00",
    available: true,
    variants: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        productId: "22222222-2222-4222-8222-222222222222",
        name: "1 Viande",
        priceOverride: "45.00",
        optionMaxSelectionsOverrides: {
          "11111111-1111-4111-8111-111111111111": 1,
        },
      },
    ],
    options: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        productId: "22222222-2222-4222-8222-222222222222",
        name: "Viandes",
        type: "multi_select",
        required: true,
        maxSelections: 3,
        values: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            optionId: "11111111-1111-4111-8111-111111111111",
            name: "Poulet",
            priceAddition: "0.00",
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            optionId: "11111111-1111-4111-8111-111111111111",
            name: "Viande hachée",
            priceAddition: "0.00",
          },
        ],
      },
    ],
  };

  const result = validateConfiguredLine(
    {
      product_id: product.id,
      quantity: 1,
      variant_id: product.variants[0]!.id,
      selected_option_value_ids: product.options[0]!.values.map(
        (value) => value.id,
      ),
      unit_price: 45,
    },
    product,
  );

  assert.equal(result.status, "error");
  if (result.status === "error") {
    assert.equal(result.statusCode, 422);
    assert.equal(result.message, "Trop de choix sélectionnés");
  }
});

test.skip("placeOrder rejects when client unit_price diverges; requires live Postgres on DATABASE_URL");
test.skip("placeOrder rejects when a required option is missing; requires live Postgres on DATABASE_URL");
test.skip("placeOrder rejects when multi_select exceeds max_selections; requires live Postgres on DATABASE_URL");
test.skip("placeOrder rejects when an option value belongs to another business; requires live Postgres on DATABASE_URL");
test.skip("placeOrder accepts configured order and writes options_json; requires live Postgres on DATABASE_URL");
test.skip("transitionOrderStatus rejects when caller does not own the order business; requires live Postgres on DATABASE_URL");
test.skip("getOrdersByBusinessId scopes order list to the caller business; requires live Postgres on DATABASE_URL");
